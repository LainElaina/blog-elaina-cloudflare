import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('layout config import preserves explicit empty arrays', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const customComponents = sanitizeCustomComponents\(config\.customComponents\)/)
	assert.match(source, /const componentFavorites = sanitizeComponentFavorites\(config\.componentFavorites\)/)
	assert.match(source, /const templates = sanitizeTemplates\(config\.templates\)/)
	assert.match(source, /if \(customComponents\) \{\n\s*localStorage\.setItem\('custom-components', JSON\.stringify\(customComponents\)\)/)
	assert.match(source, /if \(componentFavorites\) \{\n\s*localStorage\.setItem\('component-favorites', JSON\.stringify\(componentFavorites\)\)/)
	assert.match(source, /if \(templates\) \{\n\s*localStorage\.setItem\('templates', JSON\.stringify\(templates\)\)/)
	assert.doesNotMatch(source, /if \(config\.customComponents\) \{/)
	assert.doesNotMatch(source, /if \(config\.componentFavorites\) \{/)
	assert.doesNotMatch(source, /if \(config\.templates\) \{/)
})

test('layout config import does not erase project components when config omits them', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/body: JSON\.stringify\(\{\n\s*\.\.\.\(sanitizedCardStyles \? \{ cardStyles: sanitizedCardStyles \} : \{\}\),\n\s*\.\.\.\(customComponents \? \{ customComponents \} : \{\}\)\n\s*\}\)/
	)
	assert.doesNotMatch(source, /cardStyles: config\.cardStyles/)
	assert.doesNotMatch(source, /cardStyles: config\.cardStyles,\n\s*customComponents: config\.customComponents/)
})

test('layout config import sanitizes card styles before writing config', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function sanitizeCardStyles\(value: unknown, currentCardStyles: CardStyles\): CardStyles \| null \{/)
	assert.match(source, /for \(const key of Object\.keys\(currentCardStyles\) as Array<keyof CardStyles>\)/)
	assert.match(source, /if \(isCardStyleLike\(style\)\) \{[\s\S]*width: style\.width[\s\S]*enabled: style\.enabled[\s\S]*hasValidStyle = true/)
	assert.match(source, /const sanitizedCardStyles = sanitizeCardStyles\(config\.cardStyles, useConfigStore\.getState\(\)\.cardStyles\)/)
	assert.match(source, /if \(sanitizedCardStyles\) \{\n\s*useConfigStore\.getState\(\)\.setCardStyles\(sanitizedCardStyles\)/)
	assert.doesNotMatch(source, /setCardStyles\(config\.cardStyles\)/)
})

test('layout config import filters invalid cached item arrays', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function sanitizeCustomComponents\(value: unknown\): unknown\[\] \| null \{\n\s*if \(!Array\.isArray\(value\)\) return null\n\s*return value\.filter\(component => isObject\(component\) && typeof component\.id === 'string' && isComponentLike\(component\)\)/)
	assert.match(source, /function sanitizeComponentFavorites\(value: unknown\): unknown\[\] \| null \{\n\s*if \(!Array\.isArray\(value\)\) return null\n\s*return value\n\s*\.filter\(favorite => isObject\(favorite\) && typeof favorite\.name === 'string' && isComponentLike\(favorite\.component\)\)\n\s*\.map\(\(favorite, index\) => \(\{\n\s*id: typeof favorite\.id === 'string' \? favorite\.id : `fav-import-\$\{index\}`/)
	assert.match(source, /name: favorite\.name,\n\s*component: favorite\.component,\n\s*\.\.\.\(typeof favorite\.preview === 'string' \? \{ preview: favorite\.preview \} : \{\}\)/)
	assert.match(source, /function sanitizeTemplates\(value: unknown\): unknown\[\] \| null \{\n\s*if \(!Array\.isArray\(value\)\) return null\n\s*return value\.filter\(template => isObject\(template\) && typeof template\.id === 'string' && typeof template\.name === 'string' && isObject\(template\.styles\)\)/)
	assert.doesNotMatch(source, /JSON\.stringify\(config\.customComponents\)/)
	assert.doesNotMatch(source, /JSON\.stringify\(config\.componentFavorites\)/)
	assert.doesNotMatch(source, /JSON\.stringify\(config\.templates\)/)
})

test('layout config import rejects non-finite style numbers', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function isFiniteNumber\(value: unknown\): value is number \{\n\s*return typeof value === 'number' && Number\.isFinite\(value\)\n\}/)
	assert.match(source, /return isFiniteNumber\(value\.width\) &&\n\s*isFiniteNumber\(value\.height\) &&\n\s*isFiniteNumber\(value\.order\) &&\n\s*\(isFiniteNumber\(value\.offsetX\) \|\| value\.offsetX === null\) &&\n\s*\(isFiniteNumber\(value\.offsetY\) \|\| value\.offsetY === null\)/)
	assert.match(source, /isFiniteNumber\(style\.width\) &&\n\s*isFiniteNumber\(style\.height\) &&\n\s*isFiniteNumber\(style\.order\) &&\n\s*\(isFiniteNumber\(style\.offsetX\) \|\| style\.offsetX === null\) &&\n\s*\(isFiniteNumber\(style\.offsetY\) \|\| style\.offsetY === null\)/)
	assert.match(source, /'offset' in currentStyle && isFiniteNumber\(style\.offset\)/)
	assert.doesNotMatch(source, /typeof value\.width === 'number'/)
	assert.doesNotMatch(source, /typeof style\.width === 'number'/)
	assert.doesNotMatch(source, /typeof style\.offset === 'number'/)
})
