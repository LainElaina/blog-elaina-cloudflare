import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('local delete publish rolls back index artifacts when deleting article directory fails', async () => {
	const source = (await fs.readFile(new URL('./hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	const saveIndex = source.indexOf("await saveLocalBlogPublishFile(payload, '保存删除索引产物', writtenFiles)")
	const deleteIndex = source.indexOf("await fetch('/api/delete-dir'", saveIndex)
	const rollbackIndex = source.indexOf('await rollbackLocalBlogPublish(writtenFiles, uploadedFiles)', deleteIndex)
	const catchIndex = source.lastIndexOf('} catch (error) {', rollbackIndex)

	assert.ok(saveIndex !== -1)
	assert.ok(deleteIndex > saveIndex)
	assert.ok(catchIndex > deleteIndex)
	assert.ok(rollbackIndex > catchIndex)
	assert.match(source.slice(saveIndex, rollbackIndex), /body: JSON\.stringify\(\{ path: `public\/blogs\/\$\{targetSlug\}` \}\)/)
	assert.doesNotMatch(source.slice(saveIndex, deleteIndex), /catch \(error\)/)
})
