import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

import { normalizeReadArticles } from './use-read-articles.ts'

test('normalizeReadArticles keeps only true read slugs', () => {
	assert.deepEqual(
		normalizeReadArticles({
			'post-a': true,
			'post-b': false,
			'post-c': 'true',
			'': true,
			'   ': true
		}),
		{ 'post-a': true }
	)

	assert.deepEqual(normalizeReadArticles(null), {})
	assert.deepEqual(normalizeReadArticles([]), {})
})

test('read article store normalizes persisted cache during merge', async () => {
	const source = await fs.readFile(new URL('./use-read-articles.ts', import.meta.url), 'utf-8')

	assert.match(source, /merge: \(persistedState, currentState\) => \{\n\s*const readArticles = isObject\(persistedState\) \? normalizeReadArticles\(persistedState\.readArticles\) : \{\}\n\s*return \{ \.\.\.currentState, readArticles \}\n\s*\}/)
})
