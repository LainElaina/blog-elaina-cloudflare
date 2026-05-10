import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('project card renders only sanitized project URLs', async () => {
	const source = await fs.readFile(new URL('./project-card.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeMarkdownImageUrl, isSafeMarkdownLinkUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /const imageUrl = isSafeMarkdownImageUrl\(localProject\.image\) \? localProject\.image : null/)
	assert.match(source, /const websiteUrl = isSafeMarkdownLinkUrl\(localProject\.url\) \? localProject\.url : null/)
	assert.match(source, /const githubUrl = isSafeMarkdownLinkUrl\(localProject\.github\) \? localProject\.github : null/)
	assert.match(source, /const npmUrl = isSafeMarkdownLinkUrl\(localProject\.npm\) \? localProject\.npm : null/)
	assert.match(source, /src=\{imageUrl\}/)
	assert.match(source, /href=\{websiteUrl\}/)
	assert.match(source, /href=\{githubUrl\}/)
	assert.match(source, /href=\{npmUrl\}/)
	assert.doesNotMatch(source, /src=\{localProject\.image\}/)
	assert.doesNotMatch(source, /href=\{localProject\.(?:url|github|npm)\}/)
})
