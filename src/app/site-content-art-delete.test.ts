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
		/for \(const art of removedArtImages\) \{\n\s*if \(!art\.url\.startsWith\('\/images\/art\/'\)\) continue\n\n\s*const normalizedUrl = art\.url\.startsWith\('\/'\) \? art\.url : `\/\$\{art\.url\}`\n\s*deleteTasks\.push\(\(\) => deleteFile\(`public\$\{normalizedUrl\}`\)\)/
	)
	assert.doesNotMatch(remoteSource, /const path = `publichttps?:\/\//)
	assert.doesNotMatch(localSource, /deleteFile\(`publichttps?:\/\//)
})

test('site config social button image deletion uses previous and current formal configs', async () => {
	const remoteSource = await readSource('./(home)/services/push-site-content.ts')
	const localSource = await readSource('./(home)/services/push-site-content-local.ts')

	assert.match(remoteSource, /import \{ buildRemovedSocialButtonImageDeletePaths \} from '\.\/site-content-assets'/)
	assert.match(remoteSource, /originalSiteContent: SiteContent/)
	assert.match(remoteSource, /const removedSocialButtonImagePaths = buildRemovedSocialButtonImageDeletePaths\(originalSiteContent, siteContent\)/)
	assert.match(remoteSource, /if \(removedSocialButtonImagePaths\.length > 0\) \{\n\s*const existingRepoFiles = new Set\(await listRepoFilesRecursive\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, 'public\/images\/social-buttons', latestCommitSha\)\)/)
	assert.match(remoteSource, /for \(const path of removedSocialButtonImagePaths\) \{\n\s*if \(!existingRepoFiles\.has\(path\)\) continue\n\s*treeItems\.push\(\{[\s\S]*?sha: null\n\s*\}\)/)
	assert.match(localSource, /for \(const path of buildRemovedSocialButtonImageDeletePaths\(originalSiteContent, siteContent\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.match(localSource, /await Promise\.all\(deleteTasks\.map\(deleteTask => deleteTask\(\)\)\)/)
})
