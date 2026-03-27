import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildBlogStorageFromIndex,
	exportStaticBlogArtifacts,
	upsertBlogRecord,
	createEmptyBlogStorageDB
} from '@/lib/content-db/blog-storage'
import { prepareBlogStaticArtifacts } from '@/lib/blog-index'

import type { BlogIndexItem } from '@/app/blog/types'

describe('blog storage model', () => {
	it('仅将元数据写入数据库，不包含 Markdown 正文', () => {
		const item: BlogIndexItem = {
			slug: 'post-1',
			title: '标题',
			tags: ['t1'],
			date: '2026-03-27T10:00:00.000Z',
			summary: '摘要',
			category: '分类A'
		}
		const db = upsertBlogRecord(createEmptyBlogStorageDB(new Date('2026-03-27T10:00:00.000Z')), item, {
			folder: 'default',
			status: 'published',
			now: new Date('2026-03-27T10:00:00.000Z')
		})

		const record = db.blogs['post-1'] as Record<string, unknown>
		assert.equal(record.slug, 'post-1')
		assert.equal(record.folder, 'default')
		assert.equal(record.status, 'published')
		assert.ok(!Object.prototype.hasOwnProperty.call(record, 'markdown'))
		assert.ok(!Object.prototype.hasOwnProperty.call(record, 'md'))
	})

	it('可从数据库导出静态 index 与 categories 产物', () => {
		const input: BlogIndexItem[] = [
			{ slug: 'a', title: 'A', tags: [], date: '2026-01-01T00:00:00.000Z', category: 'Y' },
			{ slug: 'b', title: 'B', tags: [], date: '2026-02-01T00:00:00.000Z', category: 'X' }
		]
		const db = buildBlogStorageFromIndex(input, new Date('2026-03-27T00:00:00.000Z'))
		const artifacts = exportStaticBlogArtifacts(db)

		assert.deepEqual(
			artifacts.index.map(item => item.slug),
			['b', 'a']
		)
		assert.deepEqual(artifacts.categories, ['X', 'Y'])
	})

	it('blog-index 层可生成正式静态产物并包含 db 快照', async () => {
		const item: BlogIndexItem = {
			slug: 'storage-ready',
			title: 'Storage Ready',
			tags: ['infra'],
			date: '2026-03-27T09:00:00.000Z',
			category: 'Infra'
		}
		const artifacts = await prepareBlogStaticArtifacts({
			readStorageRaw: async () => null,
			fallbackReadIndexRaw: async () => '[]',
			upsertItem: item,
			now: new Date('2026-03-27T09:00:00.000Z')
		})

		assert.equal(artifacts.index.length, 1)
		assert.equal(artifacts.index[0]?.slug, 'storage-ready')
		assert.equal(artifacts.db.version, 1)
		assert.ok(artifacts.db.blogs['storage-ready'])
	})
})
