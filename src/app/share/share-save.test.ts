import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('share local save checks upload and save-file responses before applying saved artifacts', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /await uploadLocalShareLogo\(\{ file: logoItem\.file, path: `public\$\{publicPath\}`, actionName: '上传分享图标', uploadedFiles \}\)/)
	assert.match(pageSource, /for \(const payload of payloads\) \{\n\s*await saveLocalShareFile\(payload, '保存分享产物', writtenFiles\)/)
	assert.match(pageSource, /nextArtifacts = parseSavedArtifacts\(payloads, buildArtifactsFromList\(updatedShares\)\)/)
})

test('share local save falls back when saved artifact JSON is invalid', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /function parseJsonWithFallback<T>\(payload: ShareSaveFilePayload \| undefined, fallback: T\): T \{\n\s*if \(!payload\) return fallback\n\n\s*try \{\n\s*return JSON\.parse\(payload\.content\) as T\n\s*\} catch \{\n\s*return fallback/)
	assert.match(pageSource, /list: parseJsonWithFallback<Share\[\]>\(listPayload, fallback\.list\)/)
	assert.match(pageSource, /categories: parseJsonWithFallback<ShareCategoriesArtifact>\(categoriesPayload, fallback\.categories\)/)
	assert.match(pageSource, /folders: parseJsonWithFallback<ShareFolderNode\[\]>\(foldersPayload, fallback\.folders\)/)
	assert.doesNotMatch(pageSource, /listPayload \? \(JSON\.parse\(listPayload\.content\) as Share\[\]\) : fallback\.list/)
})

test('share local save rolls back written artifacts and uploaded logos after a later failure', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /const writtenFiles: LocalShareSaveFileBackup\[\] = \[\]/)
	assert.match(pageSource, /const uploadedFiles: LocalShareSaveUploadBackup\[\] = \[\]/)
	assert.match(pageSource, /await uploadLocalShareLogo\(\{ file: logoItem\.file, path: `public\$\{publicPath\}`, actionName: '上传分享图标', uploadedFiles \}\)/)
	assert.match(pageSource, /for \(const payload of payloads\) \{\n\s*await saveLocalShareFile\(payload, '保存分享产物', writtenFiles\)/)
	assert.match(pageSource, /catch \(error: any\) \{\n\s*await rollbackLocalShareSave\(writtenFiles, uploadedFiles\)/)
})
