import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const sidebarSource = readFileSync(new URL('./blog-sidebar.tsx', import.meta.url), 'utf8')
const tocSource = readFileSync(new URL('./blog-toc.tsx', import.meta.url), 'utf8')

test('blog sidebar cover opens in lightbox and uses stronger glass blur', () => {
	assert.match(sidebarSource, /import \{ useState \} from 'react'/)
	assert.match(sidebarSource, /import Lightbox from '@\/components\/lightbox'/)
	assert.match(sidebarSource, /useState<string \| null>\(null\)/)
	assert.match(sidebarSource, /setPreviewCover\(coverUrl\)/)
	assert.match(sidebarSource, /<Lightbox src=\{previewCover\} alt='cover' onClose=\{\(\) => setPreviewCover\(null\)\}/)
	assert.match(sidebarSource, /className='[^']*backdrop-blur-md[^']*'/)
})

test('blog table of contents uses stronger glass blur', () => {
	assert.match(tocSource, /className='[^']*backdrop-blur-lg[^']*'/)
})

test('blog table of contents improves title and item readability', () => {
	assert.match(tocSource, /className='[^']*bg-card\/95[^']*backdrop-blur-lg[^']*'/)
	assert.match(tocSource, /<h2 className='text-foreground mb-2 font-semibold'>目录<\/h2>/)
	assert.match(tocSource, /className=\{clsx\('text-foreground\/90 hover:text-brand relative block font-medium pl-3 transition-colors'/)
})
