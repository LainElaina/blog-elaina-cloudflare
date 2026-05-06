import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeTemplates } from './template-store.ts'

test('normalizeTemplates filters invalid cached templates', () => {
	assert.deepEqual(
		normalizeTemplates([
			{ id: 'ok', name: '可用模板', styles: { articleCard: { width: 1 } } },
			{ id: 1, name: 'bad', styles: {} },
			{ id: 'bad-name', name: null, styles: {} },
			{ id: 'bad-styles', name: 'Bad', styles: null },
			'bad'
		]),
		[{ id: 'ok', name: '可用模板', styles: { articleCard: { width: 1 } } }]
	)

	assert.deepEqual(normalizeTemplates({}), [])
})
