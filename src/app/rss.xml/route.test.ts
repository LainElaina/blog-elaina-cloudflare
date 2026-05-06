import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeBlogIndexForRss, wrapCdata } from './route.ts'

test('rss route wraps CDATA values without allowing embedded terminators', () => {
	assert.equal(wrapCdata('safe summary'), '<![CDATA[safe summary]]>')
	assert.equal(wrapCdata('before ]]> after'), '<![CDATA[before ]]]]><![CDATA[> after]]>')
})

test('rss route normalizes dirty blog index data without throwing', () => {
	assert.deepEqual(normalizeBlogIndexForRss(null), [])
	assert.deepEqual(
		normalizeBlogIndexForRss([
			null,
			[],
			{ title: 'Missing slug', tags: ['skip'], date: '2026-01-01' },
			{ slug: 'Bad-Slug', title: 'Bad case slug' },
			{ slug: 'bad/slash', title: 'Bad slash slug' },
			{ slug: 'bad&slug', title: 'Bad XML slug' },
			{ slug: 'x'.repeat(121), title: 'Too long slug' },
			{
				slug: 'valid-post',
				title: '',
				tags: ['tech', 123, '', 'life'],
				date: 123,
				summary: 456,
				hidden: 'no'
			},
			{
				slug: 'hidden-post',
				title: 'Hidden',
				tags: 'bad',
				date: '2026-01-02',
				summary: 'hidden summary',
				hidden: true
			}
		]),
		[
			{
				slug: 'valid-post',
				title: 'valid-post',
				tags: ['tech', '', 'life'],
				date: ''
			},
			{
				slug: 'hidden-post',
				title: 'Hidden',
				tags: [],
				date: '2026-01-02',
				summary: 'hidden summary',
				hidden: true
			}
		]
	)
})
