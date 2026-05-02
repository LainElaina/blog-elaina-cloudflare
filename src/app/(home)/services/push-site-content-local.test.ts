import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('local site config publish deletes removed assets only after writing config', async () => {
	const source = await fs.readFile(new URL('./push-site-content-local.ts', import.meta.url), 'utf-8')
	const configWriteIndex = source.indexOf('await requestLocalEndpoint(\n\t\t\tfetch,\n\t\t\tgetLocalSiteConfigEndpoint(action)')
	const deleteAssetsIndex = source.indexOf('await Promise.all(deleteTasks.map(deleteTask => deleteTask()))')

	assert.notEqual(configWriteIndex, -1)
	assert.notEqual(deleteAssetsIndex, -1)
	assert.ok(configWriteIndex < deleteAssetsIndex)
	assert.match(source, /const deleteTasks: Array<\(\) => Promise<void>> = \[\]/)
	assert.match(source, /deleteTasks\.push\(\(\) => deleteFile\(`public\$\{normalizedUrl\}`\)\)/)
	assert.doesNotMatch(source, /uploadPromises\.push\(deleteFile/)
})
