import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const globals = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8')

const sourceFiles = {
	blog: readFileSync(new URL('./blog/page.tsx', import.meta.url), 'utf8'),
	shareGrid: readFileSync(new URL('./share/grid-view.tsx', import.meta.url), 'utf8'),
	picturesMasonry: readFileSync(new URL('./pictures/components/masonry-layout.tsx', import.meta.url), 'utf8'),
	projects: readFileSync(new URL('./projects/page.tsx', import.meta.url), 'utf8'),
	svgs: readFileSync(new URL('./svgs/page.tsx', import.meta.url), 'utf8'),
	imageToolbox: readFileSync(new URL('./image-toolbox/page.tsx', import.meta.url), 'utf8'),
	snippets: readFileSync(new URL('./snippets/page.tsx', import.meta.url), 'utf8'),
	randomPictures: readFileSync(new URL('./pictures/components/random-layout.tsx', import.meta.url), 'utf8')
}

describe('virtual scroll usage', () => {
	it('provides a browser-native virtual rendering utility for long lists', () => {
		assert.match(globals, /@utility\s+virtual-scroll-item/)
		assert.match(globals, /content-visibility:\s*auto/)
		assert.match(globals, /contain-intrinsic-size:/)
	})

	it('applies virtual rendering only to linear long-list candidates', () => {
		for (const [name, source] of Object.entries({
			blog: sourceFiles.blog,
			shareGrid: sourceFiles.shareGrid,
			picturesMasonry: sourceFiles.picturesMasonry,
			projects: sourceFiles.projects,
			svgs: sourceFiles.svgs,
			imageToolbox: sourceFiles.imageToolbox,
			snippets: sourceFiles.snippets
		})) {
			assert.match(source, /virtual-scroll-item/, `${name} should opt long list items into native virtual rendering`)
		}

		assert.doesNotMatch(sourceFiles.randomPictures, /virtual-scroll-item/)
	})
})
