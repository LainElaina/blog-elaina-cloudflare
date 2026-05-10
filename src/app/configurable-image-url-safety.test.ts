import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

async function readSource(path: string) {
	return fs.readFile(new URL(path, import.meta.url), 'utf-8')
}

test('create dialogs render only sanitized image preview URLs', async () => {
	const shareDialog = await readSource('./share/components/create-dialog.tsx')
	const bloggerDialog = await readSource('./bloggers/components/create-dialog.tsx')
	const projectDialog = await readSource('./projects/components/create-dialog.tsx')

	assert.match(shareDialog, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(shareDialog, /const logoUrl = isSafeMarkdownImageUrl\(formData\.logo\) \? formData\.logo : null/)
	assert.match(shareDialog, /src=\{logoUrl\}/)
	assert.doesNotMatch(shareDialog, /src=\{formData\.logo\}/)

	assert.match(bloggerDialog, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(bloggerDialog, /const avatarUrl = isSafeMarkdownImageUrl\(formData\.avatar\) \? formData\.avatar : null/)
	assert.match(bloggerDialog, /src=\{avatarUrl\}/)
	assert.doesNotMatch(bloggerDialog, /src=\{formData\.avatar\}/)

	assert.match(projectDialog, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(projectDialog, /const imageUrl = isSafeMarkdownImageUrl\(formData\.image\) \? formData\.image : null/)
	assert.match(projectDialog, /src=\{imageUrl\}/)
	assert.doesNotMatch(projectDialog, /src=\{formData\.image\}/)
})

test('home summaries render only sanitized share logo URLs', async () => {
	const homeShareCard = await readSource('./(home)/share-card.tsx')
	const mobileQuickInfo = await readSource('./(home)/mobile-quick-info.tsx')

	assert.match(homeShareCard, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(homeShareCard, /const logoUrl = isSafeMarkdownImageUrl\(randomItem\.logo\) \? randomItem\.logo : null/)
	assert.match(homeShareCard, /src=\{logoUrl\}/)
	assert.doesNotMatch(homeShareCard, /src=\{randomItem\.logo\}/)

	assert.match(mobileQuickInfo, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(mobileQuickInfo, /const shareLogoUrl = randomItem && isSafeMarkdownImageUrl\(randomItem\.logo\) \? randomItem\.logo : null/)
	assert.match(mobileQuickInfo, /src=\{shareLogoUrl\}/)
	assert.doesNotMatch(mobileQuickInfo, /src=\{randomItem\.logo\}/)
})

test('component store image URL preview renders only sanitized source URLs', async () => {
	const source = await fs.readFile(new URL('../components/component-store.tsx', import.meta.url), 'utf-8')

	assert.match(source, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(source, /const safeImagePreviewUrl = isSafeMarkdownImageUrl\(newComp\.content\.imageUrl\) \? newComp\.content\.imageUrl : null/)
	assert.match(source, /src=\{safeImagePreviewUrl\}/)
	assert.doesNotMatch(source, /src=\{newComp\.content\.imageUrl\}/)
})
