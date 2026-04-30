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
		/body: JSON\.stringify\(\{\n\s*\.\.\.\(config\.cardStyles \? \{ cardStyles: config\.cardStyles \} : \{\}\),\n\s*\.\.\.\(customComponents \? \{ customComponents \} : \{\}\)\n\s*\}\)/
	)
	assert.doesNotMatch(source, /cardStyles: config\.cardStyles,\n\s*customComponents: config\.customComponents/)
})

test('layout config import filters invalid cached item arrays', async () => {
	const source = await fs.readFile(new URL('./import-layout-button.tsx', import.meta.url), 'utf-8')

	assert.match(source, /function sanitizeCustomComponents\(value: unknown\): unknown\[\] \| null \{\n\s*if \(!Array\.isArray\(value\)\) return null\n\s*return value\.filter\(component => isObject\(component\) && typeof component\.id === 'string' && isComponentLike\(component\)\)/)
	assert.match(source, /function sanitizeComponentFavorites\(value: unknown\): unknown\[\] \| null \{\n\s*if \(!Array\.isArray\(value\)\) return null\n\s*return value\.filter\(favorite => isObject\(favorite\) && typeof favorite\.name === 'string' && isComponentLike\(favorite\.component\)\)/)
	assert.match(source, /function sanitizeTemplates\(value: unknown\): unknown\[\] \| null \{\n\s*if \(!Array\.isArray\(value\)\) return null\n\s*return value\.filter\(template => isObject\(template\) && typeof template\.id === 'string' && typeof template\.name === 'string' && isObject\(template\.styles\)\)/)
	assert.doesNotMatch(source, /JSON\.stringify\(config\.customComponents\)/)
	assert.doesNotMatch(source, /JSON\.stringify\(config\.componentFavorites\)/)
	assert.doesNotMatch(source, /JSON\.stringify\(config\.templates\)/)
})
