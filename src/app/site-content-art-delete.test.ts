import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const siteContentAssets = await import('./(home)/services/site-content-assets.ts')
const { buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths } = siteContentAssets.default ?? siteContentAssets

async function readSource(path: string) {
	return (await fs.readFile(new URL(path, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

test('site config art and background image deletion normalizes local paths safely', async () => {
	assert.deepEqual(
		buildRemovedArtImageDeletePaths([
			{ url: '/images/art/old.png?version=1#hash' },
			{ url: 'https://cdn.example.com/remote.png' },
			{ url: '/images/art/../secret.png' },
			{ url: '/images/art/nested/old.png' }
		]),
		['public/images/art/old.png']
	)
	assert.deepEqual(
		buildRemovedBackgroundImageDeletePaths([
			{ url: '/images/background/old.webp#hash' },
			{ url: '/images/background/..%2Fsecret.webp' },
			{ url: '/images/background/nested/old.webp' }
		]),
		['public/images/background/old.webp']
	)
})

test('site config art image deletion skips external urls', async () => {
	const remoteSource = await readSource('./(home)/services/push-site-content.ts')
	const localSource = await readSource('./(home)/services/push-site-content-local.ts')

	assert.match(remoteSource, /import \{ buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths, buildRemovedSocialButtonImageDeletePaths \} from '\.\/site-content-assets'/)
	assert.match(remoteSource, /const removedArtImagePaths = buildRemovedArtImageDeletePaths\(removedArtImages\)/)
	assert.match(remoteSource, /const removedBackgroundImagePaths = buildRemovedBackgroundImageDeletePaths\(removedBackgroundImages\)/)
	assert.match(localSource, /import \{ buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths, buildRemovedSocialButtonImageDeletePaths \} from '\.\/site-content-assets'/)
	assert.match(localSource, /for \(const path of buildRemovedArtImageDeletePaths\(removedArtImages\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.match(localSource, /for \(const path of buildRemovedBackgroundImageDeletePaths\(removedBackgroundImages\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.doesNotMatch(remoteSource, /const path = `publichttps?:\/\//)
	assert.doesNotMatch(localSource, /deleteFile\(`publichttps?:\/\//)
})

test('site config social button image deletion uses previous and current formal configs', async () => {
	const remoteSource = await readSource('./(home)/services/push-site-content.ts')
	const localSource = await readSource('./(home)/services/push-site-content-local.ts')

	assert.match(remoteSource, /import \{ buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths, buildRemovedSocialButtonImageDeletePaths \} from '\.\/site-content-assets'/)
	assert.match(remoteSource, /originalSiteContent: SiteContent/)
	assert.match(remoteSource, /const removedSocialButtonImagePaths = buildRemovedSocialButtonImageDeletePaths\(originalSiteContent, siteContent\)/)
	assert.match(remoteSource, /if \(removedSocialButtonImagePaths\.length > 0\) \{\n\s*const existingRepoFiles = new Set\(await listRepoFilesRecursive\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, 'public\/images\/social-buttons', latestCommitSha\)\)/)
	assert.match(remoteSource, /for \(const path of removedSocialButtonImagePaths\) \{\n\s*if \(!existingRepoFiles\.has\(path\)\) continue\n\s*treeItems\.push\(\{[\s\S]*?sha: null\n\s*\}\)/)
	assert.match(localSource, /for \(const path of buildRemovedSocialButtonImageDeletePaths\(originalSiteContent, siteContent\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.match(localSource, /await cleanupLocalSiteAssets\(deleteTasks\)/)
})
