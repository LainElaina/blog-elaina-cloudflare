import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { handleUploadImage } from './route-local.ts'

test('upload image local route writes uploaded image atomically', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /import \{ mkdir, rename, rm, writeFile \} from 'fs\/promises'/)
	assert.match(source, /function buildAtomicUploadTempPath\(fullPath: string\)/)
	assert.match(source, /async function writeImageAtomically\(fullPath: string, buffer: Buffer\)/)
	assert.match(source, /await writeFile\(tempPath, buffer\)\n\t\tawait rename\(tempPath, fullPath\)/)
	assert.match(source, /await rm\(tempPath, \{ force: true \}\)\.catch\(\(\) => undefined\)/)
	assert.match(source, /await writeImageAtomically\(fullPath, buffer\)/)
	assert.doesNotMatch(source, /await writeFile\(fullPath, buffer\)/)
})

test('upload image local route rejects malformed multipart fields before file operations', async () => {
	const source = await fs.readFile(new URL('./route-local.ts', import.meta.url), 'utf-8')

	assert.match(source, /const file = formData\.get\('file'\)/)
	assert.match(source, /const path = formData\.get\('path'\)/)
	assert.match(source, /!\(file instanceof File\) \|\| typeof path !== 'string' \|\| path\.length === 0/)
	assert.doesNotMatch(source, /formData\.get\('file'\) as File/)
	assert.doesNotMatch(source, /formData\.get\('path'\) as string/)
})

test('upload image local route returns 400 for non-file upload field', async () => {
	const formData = new FormData()
	formData.set('file', 'not-a-file')
	formData.set('path', 'public/images/test.png')

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: 'Missing file or path' })
})

test('upload image local route returns 400 for non-string path field', async () => {
	const formData = new FormData()
	formData.set('file', new File(['image'], 'test.png', { type: 'image/png' }))
	formData.set('path', new File(['path'], 'path.txt', { type: 'text/plain' }))

	const response = await handleUploadImage({ formData: async () => formData } as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: 'Missing file or path' })
})

test('upload image local route returns 400 when multipart body is malformed', async () => {
	const response = await handleUploadImage({
		formData: async () => {
			throw new TypeError('bad multipart')
		}
	} as any)

	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { error: '请求体格式错误' })
})
