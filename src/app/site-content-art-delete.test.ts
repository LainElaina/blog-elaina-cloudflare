import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const siteContentAssets = await import('./(home)/services/site-content-assets.ts')
const { buildArtImageUploadRepoPath, buildBackgroundImageUploadRepoPath, buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths, buildSocialButtonImageUploadRepoPath } = siteContentAssets.default ?? siteContentAssets

async function readSource(path: string) {
	return (await fs.readFile(new URL(path, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

test('site config upload repo paths normalize local image urls safely', async () => {
	assert.equal(buildArtImageUploadRepoPath('/images/art/old.png?version=1#hash'), 'public/images/art/old.png')
	assert.equal(buildArtImageUploadRepoPath('/images/art/../secret.png'), null)
	assert.equal(buildArtImageUploadRepoPath('/images/art/nested/old.png'), null)
	assert.equal(buildArtImageUploadRepoPath('https://cdn.example.com/remote.png'), null)
	assert.equal(buildBackgroundImageUploadRepoPath('/images/background/old.webp#hash'), 'public/images/background/old.webp')
	assert.equal(buildBackgroundImageUploadRepoPath('/images/background/..%2Fsecret.webp'), null)
	assert.equal(buildSocialButtonImageUploadRepoPath('/images/social-buttons/icon.svg?version=1#hash'), 'public/images/social-buttons/icon.svg')
	assert.equal(buildSocialButtonImageUploadRepoPath('/images/social-buttons/nested/icon.svg'), null)
})

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

	assert.match(remoteSource, /import \{[\s\S]*?buildArtImageUploadRepoPath,[\s\S]*?buildBackgroundImageUploadRepoPath,[\s\S]*?buildRemovedArtImageDeletePaths,[\s\S]*?buildRemovedBackgroundImageDeletePaths,[\s\S]*?buildRemovedSocialButtonImageDeletePaths,[\s\S]*?buildSocialButtonImageUploadRepoPath[\s\S]*?\} from '\.\/site-content-assets'/)
	assert.match(remoteSource, /const removedArtImagePaths = buildRemovedArtImageDeletePaths\(removedArtImages\)/)
	assert.match(remoteSource, /const removedBackgroundImagePaths = buildRemovedBackgroundImageDeletePaths\(removedBackgroundImages\)/)
	assert.match(remoteSource, /const path = buildArtImageUploadRepoPath\(artConfig\.url\)\n\s*if \(!path\) continue/)
	assert.match(remoteSource, /const path = buildBackgroundImageUploadRepoPath\(bgConfig\.url\)\n\s*if \(!path\) continue/)
	assert.match(remoteSource, /const path = buildSocialButtonImageUploadRepoPath\(button\.value\)\n\s*if \(!path\) continue/)
	assert.doesNotMatch(remoteSource, /const path = `public\$\{normalizedUrlPath\}`/)
	assert.match(localSource, /import \{ buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths, buildRemovedSocialButtonImageDeletePaths \} from '\.\/site-content-assets'/)
	assert.match(localSource, /for \(const path of buildRemovedArtImageDeletePaths\(removedArtImages\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.match(localSource, /for \(const path of buildRemovedBackgroundImageDeletePaths\(removedBackgroundImages\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.doesNotMatch(remoteSource, /const path = `publichttps?:\/\//)
	assert.doesNotMatch(localSource, /deleteFile\(`publichttps?:\/\//)
})

test('site config social button image deletion uses previous and current formal configs', async () => {
	const remoteSource = await readSource('./(home)/services/push-site-content.ts')
	const localSource = await readSource('./(home)/services/push-site-content-local.ts')

	assert.match(remoteSource, /import \{[\s\S]*?buildRemovedArtImageDeletePaths,[\s\S]*?buildRemovedBackgroundImageDeletePaths,[\s\S]*?buildRemovedSocialButtonImageDeletePaths[\s\S]*?\} from '\.\/site-content-assets'/)
	assert.match(remoteSource, /originalSiteContent: SiteContent/)
	assert.match(remoteSource, /const removedSocialButtonImagePaths = buildRemovedSocialButtonImageDeletePaths\(originalSiteContent, siteContent\)/)
	assert.match(remoteSource, /if \(removedSocialButtonImagePaths\.length > 0\) \{\n\s*const existingRepoFiles = new Set\(await listRepoFilesRecursive\(token, GITHUB_CONFIG\.OWNER, GITHUB_CONFIG\.REPO, 'public\/images\/social-buttons', latestCommitSha\)\)/)
	assert.match(remoteSource, /for \(const path of removedSocialButtonImagePaths\) \{\n\s*if \(!existingRepoFiles\.has\(path\)\) continue\n\s*treeItems\.push\(\{[\s\S]*?sha: null\n\s*\}\)/)
	assert.match(localSource, /for \(const path of buildRemovedSocialButtonImageDeletePaths\(originalSiteContent, siteContent\)\) \{\n\s*deleteTasks\.push\(\(\) => deleteFile\(path\)\)/)
	assert.match(localSource, /await cleanupLocalSiteAssets\(deleteTasks\)/)
})
