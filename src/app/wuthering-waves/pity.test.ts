import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildPitySegments, parseCardRecords } from './pity.ts'

test('buildPitySegments does not count the next five-star into the previous pity segment', () => {
	const records = parseCardRecords(
		JSON.stringify([
			{ qualityLevel: 4, name: '四星 1', time: '2026-04-01 00:00:00' },
			{ qualityLevel: 4, name: '四星 2', time: '2026-04-02 00:00:00' },
			{ qualityLevel: 5, name: '五星 A', time: '2026-04-03 00:00:00' },
			{ qualityLevel: 4, name: '四星 3', time: '2026-04-04 00:00:00' },
			{ qualityLevel: 5, name: '五星 B', time: '2026-04-05 00:00:00' }
		])
	)

	assert.deepEqual(buildPitySegments(records), [
		{ pulls: 2, name: null, time: null },
		{ pulls: 2, name: '五星 A', time: '2026-04-03 00:00:00' },
		{ pulls: 1, name: '五星 B', time: '2026-04-05 00:00:00' }
	])
})
