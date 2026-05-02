import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { useWriteStore } from './write-store'

describe('useWriteStore.loadBlogForEdit', () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		useWriteStore.getState().reset()
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		useWriteStore.getState().reset()
	})

	it('将 folderPath 与 favorite 注入表单状态', async () => {
		const responses = new Map<string, Response>([
			[
				'/blogs/storage.json',
				new Response(
					JSON.stringify({
						version: 1,
						updatedAt: '2026-03-27T10:00:00.000Z',
						blogs: {
							'post-a': {
								slug: 'post-a',
								title: 'A',
								tags: ['x'],
								date: '2026-03-27T09:00:00.000Z',
								folderPath: '/写作/技术',
								favorite: true,
								status: 'published'
							}
						}
					}),
					{ status: 200 }
				)
			],
			['/blogs/post-a/index.md', new Response('# hello', { status: 200 })],
			['/blogs/post-a/config.json', new Response('{}', { status: 200 })]
		])

		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			return responses.get(key) ?? new Response(null, { status: 404 })
		}) as typeof fetch

		await useWriteStore.getState().loadBlogForEdit('post-a')

		const { form } = useWriteStore.getState()
		assert.equal(form.folderPath, '/写作/技术')
		assert.equal(form.favorite, true)
	})

	it('忽略过期的博客加载结果', async () => {
		const markdownResolvers = new Map<string, (response: Response) => void>()
		const requestedMarkdown = new Map<string, Promise<void>>()
		const markdownRequestResolvers = new Map<string, () => void>()

		for (const key of ['/blogs/post-a/index.md', '/blogs/post-b/index.md']) {
			requestedMarkdown.set(
				key,
				new Promise(resolve => {
					markdownRequestResolvers.set(key, resolve)
				})
			)
		}

		globalThis.fetch = ((input: RequestInfo | URL) => {
			const key = typeof input === 'string' ? input : input.toString()
			if (key === '/blogs/storage.json') {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							version: 1,
							updatedAt: '2026-03-27T10:00:00.000Z',
							blogs: {
								'post-a': { slug: 'post-a', title: 'A', status: 'published' },
								'post-b': { slug: 'post-b', title: 'B', status: 'published' }
							}
						}),
						{ status: 200 }
					)
				)
			}

			if (key === '/blogs/post-a/index.md' || key === '/blogs/post-b/index.md') {
				return new Promise<Response>(resolve => {
					markdownResolvers.set(key, resolve)
					markdownRequestResolvers.get(key)?.()
				})
			}

			return Promise.resolve(new Response(null, { status: 404 }))
		}) as typeof fetch

		const loadPostA = useWriteStore.getState().loadBlogForEdit('post-a')
		await requestedMarkdown.get('/blogs/post-a/index.md')
		const loadPostB = useWriteStore.getState().loadBlogForEdit('post-b')
		await requestedMarkdown.get('/blogs/post-b/index.md')

		markdownResolvers.get('/blogs/post-b/index.md')?.(new Response('# post-b', { status: 200 }))
		assert.equal(await loadPostB, true)

		markdownResolvers.get('/blogs/post-a/index.md')?.(new Response('# post-a', { status: 200 }))
		assert.equal(await loadPostA, false)

		const { form, originalSlug, loading } = useWriteStore.getState()
		assert.equal(originalSlug, 'post-b')
		assert.equal(form.slug, 'post-b')
		assert.equal(form.title, 'B')
		assert.equal(form.md, '# post-b')
		assert.equal(loading, false)
	})
})

describe('useWriteStore.disposeLocalFilePreviews', () => {
	const originalRevokeObjectURL = URL.revokeObjectURL

	beforeEach(() => {
		useWriteStore.getState().reset()
	})

	afterEach(() => {
		URL.revokeObjectURL = originalRevokeObjectURL
		useWriteStore.getState().reset()
	})

	it('释放并移除本地文件预览，同时保留 URL 资源', () => {
		const revokedUrls: string[] = []
		URL.revokeObjectURL = (url: string) => {
			revokedUrls.push(url)
		}

		const localFile = new File(['local'], 'local.png', { type: 'image/png' })
		const localImage = {
			id: 'local-image',
			type: 'file' as const,
			file: localFile,
			previewUrl: 'blob:local-image',
			filename: 'local.png'
		}
		const localCover = {
			id: 'local-cover',
			type: 'file' as const,
			file: localFile,
			previewUrl: 'blob:local-cover',
			filename: 'cover.png'
		}
		const urlImage = { id: 'url-image', type: 'url' as const, url: 'https://example.com/image.png' }

		useWriteStore.getState().replaceWithSnapshot({
			mode: 'create',
			originalSlug: null,
			form: {
				slug: '',
				title: '',
				md: '',
				tags: [],
				date: '2026-05-02T12:00',
				summary: '',
				hidden: false,
				category: '',
				folderPath: '',
				favorite: false
			},
			images: [localImage, urlImage],
			cover: localCover
		})

		useWriteStore.getState().disposeLocalFilePreviews()

		assert.deepEqual(revokedUrls.sort(), ['blob:local-cover', 'blob:local-image'])
		assert.deepEqual(useWriteStore.getState().images, [urlImage])
		assert.equal(useWriteStore.getState().cover, null)
	})
})
