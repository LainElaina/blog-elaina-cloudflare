import assert from 'node:assert/strict'
import test from 'node:test'

const { buildLocalConfigPayload, requestLocalEndpoint } = await import(new URL('./push-site-content-local-utils.ts', import.meta.url).href)

test('buildLocalConfigPayload only includes changed site content', () => {
	const originalSiteContent = { meta: { title: 'A' }, theme: { colorBrand: '#000' } }
	const currentSiteContent = { meta: { title: 'B' }, theme: { colorBrand: '#000' } }
	const originalCardStyles = { musicCard: { width: 100 } }
	const currentCardStyles = { musicCard: { width: 100 } }

	assert.deepEqual(buildLocalConfigPayload(currentSiteContent, originalSiteContent, currentCardStyles, originalCardStyles), {
		siteContent: currentSiteContent
	})
})

test('buildLocalConfigPayload only includes changed card styles', () => {
	const originalSiteContent = { meta: { title: 'A' } }
	const currentSiteContent = { meta: { title: 'A' } }
	const originalCardStyles = { musicCard: { width: 100 } }
	const currentCardStyles = { musicCard: { width: 120 } }

	assert.deepEqual(buildLocalConfigPayload(currentSiteContent, originalSiteContent, currentCardStyles, originalCardStyles), {
		cardStyles: currentCardStyles
	})
})

test('requestLocalEndpoint throws server error message for non-ok response', async () => {
	await assert.rejects(
		requestLocalEndpoint(
			async () =>
				new Response(JSON.stringify({ error: '写入失败' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}),
			'/api/config'
		),
		/写入失败/
	)
})

test('requestLocalEndpoint aborts hung request with timeout message', async () => {
	await assert.rejects(
		requestLocalEndpoint(
			(input: RequestInfo | URL, init?: RequestInit) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
				}),
			'/api/config',
			undefined,
			5
		),
		/本地保存超时/
	)
})
