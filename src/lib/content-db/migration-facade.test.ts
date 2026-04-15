import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  rebuildBlogRuntimeArtifacts,
  syncBlogRuntimeArtifacts,
  verifyBlogRuntimeArtifacts
} from './migration.ts'

describe('migration facade', () => {
  it('exposes rebuild facade backed by runtime artifact contract', () => {
    const result = rebuildBlogRuntimeArtifacts(
      JSON.stringify({
        version: 1,
        updatedAt: '2026-04-13T08:00:00.000Z',
        blogs: {
          'post-a': {
            slug: 'post-a',
            title: 'A',
            tags: [],
            date: '2026-04-13T07:00:00.000Z',
            status: 'published'
          }
        }
      })
    )

    assert.equal(JSON.parse(result.artifacts.index)[0].slug, 'post-a')
    assert.equal(result.atomic, true)
  })

  it('exposes verify facade backed by runtime artifact contract', () => {
    const result = verifyBlogRuntimeArtifacts({
      storageRaw: JSON.stringify({
        version: 1,
        updatedAt: '2026-04-13T08:00:00.000Z',
        blogs: {
          'post-a': {
            slug: 'post-a',
            title: 'A',
            tags: [],
            date: '2026-04-13T07:00:00.000Z',
            category: '技术',
            status: 'published'
          }
        }
      }),
      runtimeArtifacts: {
        index: '[]',
        categories: JSON.stringify({ categories: [] }),
        folders: '[]',
        storage: JSON.stringify({ version: 1, updatedAt: '2026-04-13T08:00:00.000Z', blogs: {} })
      }
    })

    assert.deepEqual(result.artifactsToRebuild, [
      'public/blogs/index.json',
      'public/blogs/categories.json',
      'public/blogs/storage.json'
    ])
  })

  it('exposes sync facade backed by runtime artifact contract', () => {
    const result = syncBlogRuntimeArtifacts({
      indexRaw: JSON.stringify([
        {
          slug: 'post-a',
          title: 'A',
          tags: [],
          date: '2026-04-13T07:00:00.000Z'
        }
      ]),
      storageRaw: null
    })

    assert.equal(JSON.parse(result.storageRaw).blogs['post-a'].slug, 'post-a')
    assert.equal(result.atomic, true)
  })
})
