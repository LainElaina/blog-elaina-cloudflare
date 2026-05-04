import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	deleteLocalShareLogo,
	rollbackLocalShareSave,
	saveLocalShareFile,
	uploadLocalShareLogo,
	type LocalShareSaveFileBackup,
	type LocalShareSaveUploadBackup
} from './local-share-save-rollback.ts'

type FetchCall = {
	input: string
	init?: RequestInit
}

function textResponse(body: string, ok = true, status = ok ? 200 : 404) {
	return new Response(body, { status })
}

test('local share save records previous artifact content before writing', async () => {
	const calls: FetchCall[] = []
	const writtenFiles: LocalShareSaveFileBackup[] = []
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/share/list.json') {
			return textResponse('[{"name":"old"}]')
		}
		return textResponse('{"success":true}')
	}

	await saveLocalShareFile({ path: 'public/share/list.json', content: '[{"name":"new"}]' }, '保存分享产物', writtenFiles, fetchLocal)

	assert.deepEqual(writtenFiles, [{ path: 'public/share/list.json', existed: true, content: '[{"name":"old"}]' }])
	assert.equal(calls[0].input, '/share/list.json')
	assert.equal(calls[1].input, '/api/save-file')
	assert.equal(calls[1].init?.body, JSON.stringify({ path: 'public/share/list.json', content: '[{"name":"new"}]' }))
})

test('local share artifact backup read failure aborts before overwriting files', async () => {
	const calls: FetchCall[] = []
	const writtenFiles: LocalShareSaveFileBackup[] = []
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/share/list.json') {
			return textResponse('temporary failure', false, 500)
		}
		return textResponse('{"success":true}')
	}

	await assert.rejects(
		() => saveLocalShareFile({ path: 'public/share/list.json', content: '[{"name":"new"}]' }, '保存分享产物', writtenFiles, fetchLocal),
		/读取 public\/share\/list\.json 备份失败/
	)

	assert.deepEqual(writtenFiles, [])
	assert.deepEqual(calls.map(call => call.input), ['/share/list.json'])
})

test('local share logo backup read failure aborts before uploading file', async () => {
	const calls: FetchCall[] = []
	const uploadedFiles: LocalShareSaveUploadBackup[] = []
	const image = new File(['image'], 'logo.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/images/share/logo.png') {
			return textResponse('temporary failure', false, 500)
		}
		return textResponse('{"success":true}')
	}

	await assert.rejects(
		() => uploadLocalShareLogo({ file: image, path: 'public/images/share/logo.png', actionName: '上传分享图标', uploadedFiles }, fetchLocal),
		/读取 public\/images\/share\/logo\.png 备份失败/
	)

	assert.deepEqual(uploadedFiles, [])
	assert.deepEqual(calls.map(call => call.input), ['/images/share/logo.png'])
})

test('local share save rollback restores previous artifacts and deletes newly created logos', async () => {
	const calls: FetchCall[] = []
	const writtenFiles: LocalShareSaveFileBackup[] = [
		{ path: 'public/share/list.json', existed: true, content: '[{"name":"old"}]' },
		{ path: 'public/share/storage.json', existed: false, content: '' }
	]
	const uploadedFiles: LocalShareSaveUploadBackup[] = [{ path: 'public/images/share/new.png', existed: false }]
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		return textResponse('{"success":true}')
	}

	await rollbackLocalShareSave(writtenFiles, uploadedFiles, fetchLocal)

	assert.deepEqual(
		calls.map(call => [call.input, call.init?.body]),
		[
			['/api/delete-image', JSON.stringify({ path: 'public/share/storage.json' })],
			['/api/save-file', JSON.stringify({ path: 'public/share/list.json', content: '[{"name":"old"}]' })],
			['/api/delete-image', JSON.stringify({ path: 'public/images/share/new.png' })]
		]
	)
})

test('local share logo cleanup deletes unused saved logo through delete-image endpoint', async () => {
	const calls: FetchCall[] = []
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		return textResponse('{"success":true}')
	}

	await deleteLocalShareLogo('public/images/share/old.png', fetchLocal)

	assert.deepEqual(
		calls.map(call => [call.input, call.init?.body]),
		[['/api/delete-image', JSON.stringify({ path: 'public/images/share/old.png' })]]
	)
})

test('local share logo upload tracks newly created file paths for rollback', async () => {
	const calls: FetchCall[] = []
	const uploadedFiles: LocalShareSaveUploadBackup[] = []
	const image = new File(['image'], 'logo.png', { type: 'image/png' })
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		if (input === '/images/share/logo.png') {
			return textResponse('', false)
		}
		return textResponse('{"success":true}')
	}

	await uploadLocalShareLogo({ file: image, path: 'public/images/share/logo.png', actionName: '上传分享图标', uploadedFiles }, fetchLocal)

	assert.deepEqual(uploadedFiles, [{ path: 'public/images/share/logo.png', existed: false }])
	assert.equal(calls[0].input, '/images/share/logo.png')
	assert.equal(calls[1].input, '/api/upload-image')
	assert.equal(calls[1].init?.method, 'POST')
})
