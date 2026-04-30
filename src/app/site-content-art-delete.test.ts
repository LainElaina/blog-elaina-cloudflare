import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

async function readSource(path: string) {
	return (await fs.readFile(new URL(path, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

test('site config art image deletion skips external urls', async () => {
	const remoteSource = await readSource('./(home)/services/push-site-content.ts')
	const localSource = await readSource('./(home)/services/push-site-content-local.ts')

	assert.match(
		remoteSource,
		/for \(const art of removedArtImages\) \{\n\s*if \(!art\.url\.startsWith\('\/images\/art\/'\)\) continue\n\n\s*const normalizedUrlPath = art\.url\.startsWith\('\/'\) \? art\.url : `\/\$\{art\.url\}`\n\s*const path = `public\$\{normalizedUrlPath\}`/
	)
	assert.match(
		localSource,
		/for \(const art of removedArtImages\) \{\n\s*if \(!art\.url\.startsWith\('\/images\/art\/'\)\) continue\n\n\s*const normalizedUrl = art\.url\.startsWith\('\/'\) \? art\.url : `\/\$\{art\.url\}`\n\s*uploadPromises\.push\(deleteFile\(`public\$\{normalizedUrl\}`\)\)/
	)
	assert.doesNotMatch(remoteSource, /const path = `publichttps?:\/\//)
	assert.doesNotMatch(localSource, /deleteFile\(`publichttps?:\/\//)
})
