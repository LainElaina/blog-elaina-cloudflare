import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	rollbackLocalBlogPublish,
	saveLocalBlogPublishFile,
	uploadLocalBlogPublishImage,
	type LocalBlogPublishFileBackup,
	type LocalBlogPublishUploadBackup
} from './local-publish-rollback.ts'

type FetchCall = {
	input: string
	init?: RequestInit
}

function textResponse(body: string, ok = true, status = ok ? 200 : 404) {
	return new Response(body, { status })
}

test('local publish file saves record previous content before writing', async () => {
	const calls: FetchCall[] = []
	const writtenFiles: LocalBlogPublishFileBackup[] = []
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/blogs/post-a/index.md') {
			return textResponse('old markdown')
		}
		return textResponse('{"success":true}')
	}

	await saveLocalBlogPublishFile({ path: 'public/blogs/post-a/index.md', content: 'new markdown' }, '保存 Markdown', writtenFiles, fetchLocal)

	assert.deepEqual(writtenFiles, [{ path: 'public/blogs/post-a/index.md', existed: true, content: 'old markdown' }])
	assert.equal(calls[0].input, '/blogs/post-a/index.md')
	assert.equal(calls[1].input, '/api/save-file')
	assert.equal(calls[1].init?.body, JSON.stringify({ path: 'public/blogs/post-a/index.md', content: 'new markdown' }))
})

test('local publish file backup read failure aborts before overwriting files', async () => {
	const calls: FetchCall[] = []
	const writtenFiles: LocalBlogPublishFileBackup[] = []
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/blogs/post-a/index.md') {
			return textResponse('temporary failure', false, 500)
		}
		return textResponse('{"success":true}')
	}

	await assert.rejects(
		() => saveLocalBlogPublishFile({ path: 'public/blogs/post-a/index.md', content: 'new markdown' }, '保存 Markdown', writtenFiles, fetchLocal),
		/读取 public\/blogs\/post-a\/index\.md 备份失败/
	)

	assert.deepEqual(writtenFiles, [])
	assert.deepEqual(calls.map(call => call.input), ['/blogs/post-a/index.md'])
})

test('local publish image backup read failure aborts before uploading image', async () => {
	const calls: FetchCall[] = []
	const uploadedFiles: LocalBlogPublishUploadBackup[] = []
	const image = new File(['image'], 'cover.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/blogs/post-a/cover.png') {
			return textResponse('temporary failure', false, 500)
		}
		return textResponse('{"success":true}')
	}

	await assert.rejects(
		() => uploadLocalBlogPublishImage({ file: image, path: 'public/blogs/post-a/cover.png', actionName: '上传图片', uploadedFiles }, fetchLocal),
		/读取 public\/blogs\/post-a\/cover\.png 备份失败/
	)

	assert.deepEqual(uploadedFiles, [])
	assert.deepEqual(calls.map(call => call.input), ['/blogs/post-a/cover.png'])
})

test('local publish rollback restores previous files and deletes newly created files and images', async () => {
	const calls: FetchCall[] = []
	const writtenFiles: LocalBlogPublishFileBackup[] = [
		{ path: 'public/blogs/post-a/index.md', existed: true, content: 'old markdown' },
		{ path: 'public/blogs/index.json', existed: false, content: '' }
	]
	const uploadedFiles: LocalBlogPublishUploadBackup[] = [{ path: 'public/blogs/post-a/new.png', existed: false }]
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		return textResponse('{"success":true}')
	}

	await rollbackLocalBlogPublish(writtenFiles, uploadedFiles, fetchLocal)

	assert.deepEqual(
		calls.map(call => [call.input, call.init?.body]),
		[
			['/api/delete-file', JSON.stringify({ path: 'public/blogs/index.json' })],
			['/api/save-file', JSON.stringify({ path: 'public/blogs/post-a/index.md', content: 'old markdown' })],
			['/api/delete-image', JSON.stringify({ path: 'public/blogs/post-a/new.png' })]
		]
	)
})

test('local publish rollback reports files that failed to restore', async () => {
	const writtenFiles: LocalBlogPublishFileBackup[] = [
		{ path: 'public/blogs/post-a/index.md', existed: true, content: 'old markdown' },
		{ path: 'public/blogs/index.json', existed: false, content: '' }
	]
	const uploadedFiles: LocalBlogPublishUploadBackup[] = [{ path: 'public/blogs/post-a/new.png', existed: false }]
	const fetchLocal = async (input: string, init?: RequestInit) => {
		if (input === '/api/save-file') {
			return textResponse('restore failed', false, 500)
		}
		return textResponse('{"success":true}')
	}

	await assert.rejects(() => rollbackLocalBlogPublish(writtenFiles, uploadedFiles, fetchLocal), /回滚失败：public\/blogs\/post-a\/index\.md/)
})

test('local publish upload tracks newly created image paths for rollback', async () => {
	const calls: FetchCall[] = []
	const uploadedFiles: LocalBlogPublishUploadBackup[] = []
	const image = new File(['image'], 'cover.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/blogs/post-a/cover.png') {
			return textResponse('', false)
		}
		return textResponse('{"success":true}')
	}

	await uploadLocalBlogPublishImage({ file: image, path: 'public/blogs/post-a/cover.png', actionName: '上传图片', uploadedFiles }, fetchLocal)

	assert.deepEqual(uploadedFiles, [{ path: 'public/blogs/post-a/cover.png', existed: false }])
	assert.equal(calls[0].input, '/blogs/post-a/cover.png')
	assert.equal(calls[1].input, '/api/upload-image')
	assert.equal(calls[1].init?.method, 'POST')
})

test('local publish rollback restores overwritten image backups', async () => {
	const calls: FetchCall[] = []
	const uploadedFiles: LocalBlogPublishUploadBackup[] = []
	const previousImage = new File(['previous image'], 'cover.png', { type: 'image/png' })
	const nextImage = new File(['next image'], 'cover.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/blogs/post-a/cover.png') {
			return new Response(previousImage, { status: 200, headers: { 'Content-Type': previousImage.type } })
		}
		return textResponse('{"success":true}')
	}

	await uploadLocalBlogPublishImage({ file: nextImage, path: 'public/blogs/post-a/cover.png', actionName: '上传图片', uploadedFiles }, fetchLocal)
	await rollbackLocalBlogPublish([], uploadedFiles, fetchLocal)

	assert.equal(uploadedFiles.length, 1)
	assert.equal(uploadedFiles[0].existed, true)
	assert.equal(uploadedFiles[0].file?.type, 'image/png')
	assert.equal(await uploadedFiles[0].file?.text(), 'previous image')
	assert.equal(calls[1].input, '/api/upload-image')
	assert.equal(calls[2].input, '/api/upload-image')
	const restoreFormData = calls[2].init?.body as FormData
	const restoredFile = restoreFormData.get('file') as File
	assert.equal(await restoredFile.text(), 'previous image')
	assert.equal(restoredFile.type, 'image/png')
	assert.equal(restoreFormData.get('path'), 'public/blogs/post-a/cover.png')
})
