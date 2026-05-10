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

test('home content configuration renders only sanitized media and备案 links', async () => {
	const layout = await fs.readFile(new URL('../layout/index.tsx', import.meta.url), 'utf-8')
	const artCard = await readSource('./(home)/art-card.tsx')
	const beianCard = await readSource('./(home)/beian-card.tsx')
	const articleCard = await readSource('./(home)/aritcle-card.tsx')
	const blogSidebar = await fs.readFile(new URL('../components/blog-sidebar.tsx', import.meta.url), 'utf-8')

	assert.match(layout, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(layout, /const currentBackgroundImageUrl = currentBackgroundImage && isSafeMarkdownImageUrl\(currentBackgroundImage\.url\) \? currentBackgroundImage\.url : null/)
	assert.match(layout, /backgroundImage: `url\(\$\{JSON\.stringify\(currentBackgroundImageUrl\)\}\)`/)
	assert.doesNotMatch(layout, /backgroundImage: `url\(\$\{currentBackgroundImage\.url\}\)`/)

	assert.match(artCard, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(artCard, /const artUrl = isSafeMarkdownImageUrl\(selectedArtUrl\) \? selectedArtUrl : '\/images\/art\/cat\.png'/)
	assert.match(artCard, /src=\{artUrl\}/)
	assert.doesNotMatch(artCard, /src=\{currentArt\.url\}/)

	assert.match(beianCard, /import \{ isSafeMarkdownLinkUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(beianCard, /const beianLink = isSafeMarkdownLinkUrl\(beian\.link\) \? beian\.link : null/)
	assert.match(beianCard, /href=\{beianLink\}/)
	assert.doesNotMatch(beianCard, /href=\{beian\.link\}/)

	assert.match(articleCard, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(articleCard, /const coverUrl = blog\?\.cover && isSafeMarkdownImageUrl\(blog\.cover\) \? blog\.cover : null/)
	assert.match(articleCard, /src=\{coverUrl\}/)
	assert.doesNotMatch(articleCard, /src=\{blog\.cover\}/)

	assert.match(blogSidebar, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(blogSidebar, /const coverUrl = isSafeMarkdownImageUrl\(cover\) \? cover : null/)
	assert.match(blogSidebar, /src=\{coverUrl\}/)
	assert.doesNotMatch(blogSidebar, /src=\{cover\}/)
})

test('write page image previews render only sanitized URL images', async () => {
	const imagesSection = await readSource('./write/components/sections/images-section.tsx')
	const coverSection = await readSource('./write/components/sections/cover-section.tsx')

	assert.match(imagesSection, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(imagesSection, /images\.filter\(item => item\.type !== 'url' \|\| isSafeMarkdownImageUrl\(item\.url\)\)\.map\(item => \{/)
	assert.doesNotMatch(imagesSection, /src=\{item\.url\}/)

	assert.match(coverSection, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(coverSection, /const coverPreviewUrl = cover \? \(cover\.type === 'url' && isSafeMarkdownImageUrl\(cover\.url\) \? cover\.url : cover\.type === 'file' \? cover\.previewUrl : null\) : null/)
	assert.match(coverSection, /src=\{coverPreviewUrl\}/)
	assert.doesNotMatch(coverSection, /src=\{cover\.url\}/)
})

test('picture layouts and lightbox render only sanitized image URLs', async () => {
	const masonryLayout = await readSource('./pictures/components/masonry-layout.tsx')
	const randomLayout = await readSource('./pictures/components/random-layout.tsx')
	const lightbox = await fs.readFile(new URL('../components/lightbox.tsx', import.meta.url), 'utf-8')

	assert.match(masonryLayout, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(masonryLayout, /picture\.image && isSafeMarkdownImageUrl\(picture\.image\)/)
	assert.match(masonryLayout, /picture\.images\.flatMap\(\(url, imageIndex\) =>\s+isSafeMarkdownImageUrl\(url\)/s)
	assert.doesNotMatch(masonryLayout, /picture\.images\.filter\(isSafeMarkdownImageUrl\)\.map/)

	assert.match(randomLayout, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(randomLayout, /const imageUrl = isSafeMarkdownImageUrl\(url\) \? url : null/)
	assert.match(randomLayout, /if \(!position \|\| !show \|\| !imageUrl\) return null/)
	assert.match(randomLayout, /src=\{imageUrl\}/)
	assert.doesNotMatch(randomLayout, /src=\{url\}/)

	assert.match(lightbox, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(lightbox, /const imageUrl = src && isSafeMarkdownImageUrl\(src\) \? src : null/)
	assert.match(lightbox, /if \(imageUrl\) \{/)
	assert.match(lightbox, /\}, \[imageUrl, handleKeyDown\]\)/)
	assert.match(lightbox, /src=\{imageUrl\}/)
	assert.doesNotMatch(lightbox, /src=\{src\}/)
})

test('site config dialog previews render only sanitized image URLs', async () => {
	const backgroundImagesSection = await readSource('./(home)/config-dialog/site-settings/background-images-section.tsx')
	const artImagesSection = await readSource('./(home)/config-dialog/site-settings/art-images-section.tsx')

	assert.match(backgroundImagesSection, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(backgroundImagesSection, /const src = uploadItem\?\.type === 'file' \? uploadItem\.previewUrl : isSafeMarkdownImageUrl\(item\.url\) \? item\.url : null/)
	assert.match(backgroundImagesSection, /\{src && <img src=\{src\} alt='background preview'/)
	assert.doesNotMatch(backgroundImagesSection, /<img src=\{item\.url\}/)

	assert.match(artImagesSection, /import \{ isSafeMarkdownImageUrl \} from '@\/lib\/markdown-url-safety'/)
	assert.match(artImagesSection, /const src = uploadItem\?\.type === 'file' \? uploadItem\.previewUrl : isSafeMarkdownImageUrl\(item\.url\) \? item\.url : null/)
	assert.match(artImagesSection, /\{src && <img src=\{src\} alt='art preview'/)
	assert.doesNotMatch(artImagesSection, /<img src=\{item\.url\}/)
})
