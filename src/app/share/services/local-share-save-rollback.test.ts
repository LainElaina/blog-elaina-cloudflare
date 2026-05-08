import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	deleteLocalShareLogo,
	readLocalShareSaveUploadBackup,
	readOptionalLocalShareStorageRaw,
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

test('local share storage read only treats 404 as missing before merging artifacts', async () => {
	const calls: FetchCall[] = []
	const fetchFailure = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		return textResponse('temporary failure', false, 500)
	}

	await assert.rejects(() => readOptionalLocalShareStorageRaw(fetchFailure), /读取分享存储失败/)
	assert.deepEqual(calls.map(call => call.input), ['/share/storage.json'])

	const missing = await readOptionalLocalShareStorageRaw(async () => textResponse('', false, 404))
	assert.equal(missing, null)

	const existing = await readOptionalLocalShareStorageRaw(async () => textResponse('{"version":1}'))
	assert.equal(existing, '{"version":1}')
})

test('local share logo backup stores existing file bytes for rollback', async () => {
	const calls: FetchCall[] = []
	const backup = await readLocalShareSaveUploadBackup('public/images/share/logo.png', async (input, init) => {
		calls.push({ input, init })
		return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
	})

	assert.equal(backup.path, 'public/images/share/logo.png')
	assert.equal(backup.existed, true)
	if (backup.existed) {
		assert.equal(backup.contentType, 'image/png')
		assert.deepEqual(Array.from(new Uint8Array(backup.content)), [1, 2, 3])
	}
	assert.deepEqual(calls.map(call => call.input), ['/images/share/logo.png'])
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
			['/api/delete-file', JSON.stringify({ path: 'public/share/storage.json' })],
			['/api/save-file', JSON.stringify({ path: 'public/share/list.json', content: '[{"name":"old"}]' })],
			['/api/delete-image', JSON.stringify({ path: 'public/images/share/new.png' })]
		]
	)
})

test('local share save rollback reports artifacts that failed to restore', async () => {
	const writtenFiles: LocalShareSaveFileBackup[] = [
		{ path: 'public/share/list.json', existed: true, content: '[{"name":"old"}]' },
		{ path: 'public/share/storage.json', existed: false, content: '' }
	]
	const uploadedFiles: LocalShareSaveUploadBackup[] = [{ path: 'public/images/share/new.png', existed: false }]
	const fetchLocal = async (input: string, init?: RequestInit) => {
		if (input === '/api/save-file') {
			return textResponse('restore failed', false, 500)
		}
		return textResponse('{"success":true}')
	}

	await assert.rejects(() => rollbackLocalShareSave(writtenFiles, uploadedFiles, fetchLocal), /回滚失败：public\/share\/list\.json/)
})

test('local share save rollback restores overwritten logos', async () => {
	const calls: FetchCall[] = []
	const oldLogo = new Uint8Array([1, 2, 3]).buffer
	const uploadedFiles: LocalShareSaveUploadBackup[] = [
		{ path: 'public/images/share/logo.png', existed: true, content: oldLogo, contentType: 'image/png' }
	]
	const fetchLocal = async (input: string, init?: RequestInit) => {
		calls.push({ input, init })
		return textResponse('{"success":true}')
	}

	await rollbackLocalShareSave([], uploadedFiles, fetchLocal)

	assert.equal(calls.length, 1)
	assert.equal(calls[0].input, '/api/upload-image')
	assert.equal(calls[0].init?.method, 'POST')
	const formData = calls[0].init?.body as FormData
	assert.equal(formData.get('path'), 'public/images/share/logo.png')
	const file = formData.get('file') as File
	assert.equal(file.type, 'image/png')
	assert.deepEqual(Array.from(new Uint8Array(await file.arrayBuffer())), [1, 2, 3])
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
