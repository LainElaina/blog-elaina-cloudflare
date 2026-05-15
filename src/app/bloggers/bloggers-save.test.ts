import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('bloggers local save rolls back uploaded avatars when list saving fails', async () => {
	const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

	assert.match(pageSource, /const uploadedFiles: LocalSiteAssetUploadBackup\[\] = \[\]/)
	assert.match(pageSource, /await uploadLocalSiteAsset\(avatarItem\.file, `public\$\{publicPath\}`, uploadedFiles\)/)
	assert.match(pageSource, /catch \(error\) \{\n\s*await rollbackLocalSiteAssetUploadsAfterFailure\(error, uploadedFiles\)\n\s*throw error\n\s*\}/)
	assert.match(pageSource, /'保存友链列表'/)
	assert.match(pageSource, /savedBloggers = updatedBloggers/)
})
