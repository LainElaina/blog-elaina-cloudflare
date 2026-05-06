import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('component store hydrates explicit empty cached lists', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const savedCustom = readCachedList\('custom-components'\)\n\s*if \(savedCustom\) \{\n\s*useCustomComponentStore\.setState\(\{ components: normalizeCustomComponents\(savedCustom\) \}\)/
	)
	assert.match(source, /import \{ normalizeCustomComponents, useCustomComponentStore \}/)
	assert.match(source, /import \{ normalizeTemplates, useTemplateStore \}/)
	assert.match(source, /import \{ normalizeComponentFavoriteImports, normalizeComponentFavorites, useComponentFavoriteStore \}/)
	assert.doesNotMatch(source, /Array\.isArray\(parsed\) && parsed\.length > 0/)
	assert.doesNotMatch(source, /useCustomComponentStore\.setState\(\{ components: savedCustom \}\)/)
})

test('component store ignores corrupted cached lists', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function readCachedList\(key: string\): unknown\[\] \| null \{\n\s*try \{\n\s*const saved = localStorage\.getItem\(key\)/)
	assert.match(source, /const parsed = JSON\.parse\(saved\)\n\s*return Array\.isArray\(parsed\) \? parsed : null\n\s*\} catch \{\n\s*return null/)
	assert.match(source, /const savedTemplates = readCachedList\('templates'\)\n\s*if \(savedTemplates\) \{\n\s*useTemplateStore\.setState\(\{ templates: normalizeTemplates\(savedTemplates\) \}\)/)
	assert.match(source, /const savedFavorites = readCachedList\('component-favorites'\)\n\s*if \(savedFavorites\) \{\n\s*useComponentFavoriteStore\.setState\(\{ favorites: normalizeComponentFavorites\(savedFavorites\) \}\)/)
	assert.doesNotMatch(source, /useTemplateStore\.setState\(\{ templates: JSON\.parse\(savedTemplates\) \}\)/)
	assert.doesNotMatch(source, /useTemplateStore\.setState\(\{ templates: savedTemplates \}\)/)
	assert.doesNotMatch(source, /useComponentFavoriteStore\.setState\(\{ favorites: JSON\.parse\(savedFavorites\) \}\)/)
})

test('component favorite import filters invalid favorite entries', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const validFavorites = normalizeComponentFavoriteImports\(imported\)\n\s*if \(validFavorites\.length === 0\) throw new Error\('格式错误'\)/)
	assert.match(source, /for \(const fav of validFavorites\) \{\n\s*addFavorite\(fav\.name\.trim\(\), fav\.component\)\n\s*\}/)
	assert.doesNotMatch(source, /function isFavoriteImport/)
	assert.doesNotMatch(source, /for \(const fav of imported\) \{\n\s*if \(fav\.name && fav\.component\) \{/)
})

test('component store revokes pending image preview urls', async () => {
	const source = await fs.readFile(new URL('./component-store.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const pendingImageFileRef = useRef<PendingImageFile \| null>\(null\)/)
	assert.match(source, /if \(previous && previous\.previewUrl !== next\?\.previewUrl\) \{\n\s*URL\.revokeObjectURL\(previous\.previewUrl\)/)
	assert.match(source, /return \(\) => \{\n\s*const pending = pendingImageFileRef\.current\n\s*if \(pending\) \{\n\s*URL\.revokeObjectURL\(pending\.previewUrl\)/)
	assert.doesNotMatch(source, /const \[pendingImageFile, setPendingImageFile\] = useState<\{ file: File; previewUrl: string; hash: string \} \| null>\(null\)/)
})
