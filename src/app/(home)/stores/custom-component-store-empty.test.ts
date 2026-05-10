import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

const { normalizeCustomComponents } = await import('./custom-component-store.ts')

const baseComponent = {
	id: 'custom-1',
	name: '组件',
	type: 'link',
	templateId: 'medium-rect',
	style: {
		width: 200,
		height: 120,
		order: 1,
		offsetX: 0,
		offsetY: 0,
		enabled: true
	},
	content: { text: '链接', linkUrl: 'https://example.com' }
}

test('custom component store filters invalid persisted entries before hydration', async () => {
	const source = await fs.readFile(new URL('./custom-component-store.ts', import.meta.url), 'utf-8')

	assert.match(source, /export function normalizeCustomComponents\(value: unknown\): CustomComponent\[\] \{\n\s*return Array\.isArray\(value\) \? value\.filter\(isCustomComponent\) : \[\]/)
	assert.match(source, /if \(Array\.isArray\(parsed\)\) return normalizeCustomComponents\(parsed\)/)
	assert.match(source, /return normalizeCustomComponents\(customComponentsDefault\)/)
	assert.doesNotMatch(source, /if \(Array\.isArray\(parsed\)\) return parsed/)
})

test('custom component store filters persisted unsafe component URLs', () => {
	const components = normalizeCustomComponents([
		baseComponent,
		{ ...baseComponent, id: 'custom-2', content: { imageUrl: 'javascript:alert(1)' } },
		{ ...baseComponent, id: 'custom-3', content: { linkUrl: 'data:text/html,<script></script>' } },
		{ ...baseComponent, id: 'custom-4', content: { iframeUrl: '/local/embed' } },
		{ ...baseComponent, id: 'custom-5', content: { imageUrl: '/images/custom-components/a.png', linkUrl: 'mailto:test@example.com', iframeUrl: 'https://example.com/embed' } }
	])

	assert.deepEqual(components.map(component => component.id), ['custom-1', 'custom-5'])
})
