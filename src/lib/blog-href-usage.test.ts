import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('public blog entry links use encoded href helper', async () => {
	const blogPage = await fs.readFile(new URL('../app/blog/page.tsx', import.meta.url), 'utf-8')
	const articleCard = await fs.readFile(new URL('../app/(home)/aritcle-card.tsx', import.meta.url), 'utf-8')

	assert.match(blogPage, /import \{ getBlogHref \} from '@\/lib\/blog-href'/)
	assert.match(articleCard, /import \{ getBlogHref \} from '@\/lib\/blog-href'/)
	assert.match(blogPage, /href=\{getBlogHref\(it\.slug\)\}/)
	assert.match(articleCard, /href=\{getBlogHref\(blog\.slug\)\}/)
	assert.doesNotMatch(blogPage, /href=\{`\/blog\/\$\{it\.slug\}`\}/)
	assert.doesNotMatch(articleCard, /href=\{`\/blog\/\$\{blog\.slug\}`\}/)
})
