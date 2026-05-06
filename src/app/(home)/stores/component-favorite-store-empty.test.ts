import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('component favorite store filters invalid persisted entries', async () => {
	const source = await fs.readFile(new URL('./component-favorite-store.ts', import.meta.url), 'utf-8')

	assert.match(source, /import \{ type CustomComponent, isCustomComponentData \} from '\.\/custom-component-store'/)
	assert.match(source, /function isComponentFavorite\(value: unknown\): value is ComponentFavorite \{\n\s*return isObject\(value\) &&\n\s*typeof value\.id === 'string' &&\n\s*typeof value\.name === 'string' &&\n\s*isCustomComponentData\(value\.component\)/)
	assert.match(source, /export function normalizeComponentFavorites\(value: unknown\): ComponentFavorite\[\] \{\n\s*return Array\.isArray\(value\) \? value\.filter\(isComponentFavorite\) : \[\]/)
})

test('component favorite imports keep legacy entries without ids', async () => {
	const source = await fs.readFile(new URL('./component-favorite-store.ts', import.meta.url), 'utf-8')

	assert.match(source, /function isComponentFavoriteImport\(value: unknown\): value is Pick<ComponentFavorite, 'name' \| 'component'> \{\n\s*return isObject\(value\) &&\n\s*typeof value\.name === 'string' &&\n\s*isCustomComponentData\(value\.component\)/)
	assert.match(source, /export function normalizeComponentFavoriteImports\(value: unknown\): Pick<ComponentFavorite, 'name' \| 'component'>\[\] \{\n\s*return Array\.isArray\(value\) \? value\.filter\(isComponentFavoriteImport\) : \[\]/)
	assert.doesNotMatch(source, /function isComponentFavoriteImport[\s\S]*typeof value\.id === 'string'/)
})
