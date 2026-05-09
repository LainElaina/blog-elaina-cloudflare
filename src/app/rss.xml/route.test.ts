import assert from 'node:assert/strict'
import { test } from 'node:test'

import { escapeXml, isRuntimeBlogSlug, normalizeBlogIndexForRss, sanitizeXmlText, wrapCdata } from './rss-utils.ts'

test('rss route shares runtime slug filtering rules', () => {
	const malformedUnicodeSlug = String.fromCharCode(0xd800)

	assert.equal(isRuntimeBlogSlug('valid-post'), true)
	assert.equal(isRuntimeBlogSlug('Blog-CF1'), true)
	assert.equal(isRuntimeBlogSlug('Blog CF1'), true)
	assert.equal(isRuntimeBlogSlug(''), false)
	assert.equal(isRuntimeBlogSlug(' nested '), false)
	assert.equal(isRuntimeBlogSlug('bad/slash'), false)
	assert.equal(isRuntimeBlogSlug('bad\\slash'), false)
	assert.equal(isRuntimeBlogSlug(malformedUnicodeSlug), false)
})

test('rss route removes characters that XML 1.0 forbids from text nodes', () => {
	const invalidCharacters = String.fromCharCode(0, 8, 11, 12, 14, 31, 0xd800)

	assert.equal(sanitizeXmlText(`ok${invalidCharacters} end`), 'ok end')
	assert.equal(sanitizeXmlText('line\nwith\ttabs\rand breaks'), 'line\nwith\ttabs\rand breaks')
	assert.equal(escapeXml(`A&B<bad>"${String.fromCharCode(0)}`), 'A&amp;B&lt;bad&gt;&quot;')
	assert.equal(wrapCdata(`before${String.fromCharCode(0)} ]]> after`), '<![CDATA[before ]]]]><![CDATA[> after]]>')
})

test('rss route normalizes dirty blog index data without throwing', () => {
	assert.deepEqual(normalizeBlogIndexForRss(null), [])
	assert.deepEqual(
		normalizeBlogIndexForRss([
			null,
			[],
			{ title: 'Missing slug', tags: ['skip'], date: '2026-01-01' },
			{ slug: '', title: 'Empty slug' },
			{ slug: 'Bad-Slug', title: 'Historical case slug' },
			{ slug: 'bad/slash', title: 'Bad slash slug' },
				{ slug: String.fromCharCode(0xd800), title: 'Malformed unicode slug' },
			{ slug: 'bad&slug', title: 'XML-safe slug' },
			{ slug: 'x'.repeat(121), title: 'Long legacy slug' },
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
				slug: 'Bad-Slug',
				title: 'Historical case slug',
				tags: [],
				date: ''
			},
			{
				slug: 'bad&slug',
				title: 'XML-safe slug',
				tags: [],
				date: ''
			},
			{
				slug: 'x'.repeat(121),
				title: 'Long legacy slug',
				tags: [],
				date: ''
			},
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
