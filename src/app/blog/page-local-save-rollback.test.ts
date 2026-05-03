import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('blog local save rolls back written artifacts when deleting removed article directories fails', async () => {
	const source = (await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	const saveIndex = source.indexOf("await saveLocalBlogPublishFile(payload, '保存博客产物', writtenFiles)")
	const deleteIndex = source.indexOf("await fetch('/api/delete-dir'")
	const rollbackIndex = source.indexOf('await rollbackLocalBlogPublish(writtenFiles, uploadedFiles)', deleteIndex)
	const catchIndex = source.lastIndexOf('} catch (error) {', rollbackIndex)

	assert.ok(saveIndex !== -1)
	assert.ok(deleteIndex > saveIndex)
	assert.ok(catchIndex > deleteIndex)
	assert.ok(rollbackIndex > catchIndex)
	assert.match(source.slice(saveIndex, rollbackIndex), /for \(const slug of uniqueRemoved\) \{[\s\S]*?path: `public\/blogs\/\$\{slug\}`/)
	assert.doesNotMatch(source.slice(saveIndex, deleteIndex), /catch \(error\)/)
})
