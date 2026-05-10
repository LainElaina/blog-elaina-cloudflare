import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getBlogHref, getWriteHref } from './blog-href.ts'

test('blog route href helpers encode slugs', () => {
	assert.equal(getBlogHref('Blog-CF1'), '/blog/Blog-CF1')
	assert.equal(getBlogHref('CF-Stats-Dashboard'), '/blog/CF-Stats-Dashboard')
	assert.equal(getBlogHref('文章 / A'), '/blog/%E6%96%87%E7%AB%A0%20%2F%20A')
	assert.equal(getBlogHref('post?x=1#top'), '/blog/post%3Fx%3D1%23top')
	assert.equal(getWriteHref('post?x=1#top'), '/write/post%3Fx%3D1%23top')
})
