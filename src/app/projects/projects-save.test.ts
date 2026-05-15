import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('projects local save rolls back uploaded images when list saving fails', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /const uploadedFiles: LocalSiteAssetUploadBackup\[\] = \[\]/)
	assert.match(pageSource, /await uploadLocalSiteAsset\(imageItem\.file, `public\$\{publicPath\}`, uploadedFiles\)/)
	assert.match(pageSource, /catch \(error\) \{\n\s*await rollbackLocalSiteAssetUploadsAfterFailure\(error, uploadedFiles\)\n\s*throw error\n\s*\}/)
	assert.match(pageSource, /'保存项目列表'/)
	assert.match(pageSource, /savedProjects = updatedProjects/)
})
