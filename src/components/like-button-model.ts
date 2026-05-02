export const LIKE_ENDPOINT = 'https://blog-liker.yysuni1001.workers.dev/api/like'

type LikeFetch = (input: string, init: { method: 'POST' }) => Promise<Pick<Response, 'ok' | 'json'>>

export type LikePostResult =
	| {
			ok: true
			count: number
		}
	| {
			ok: false
			reason?: 'rate_limited'
		}

export async function postLike(slug: string, fetchLike: LikeFetch = fetch): Promise<LikePostResult> {
	const url = `${LIKE_ENDPOINT}?slug=${encodeURIComponent(slug)}`
	const res = await fetchLike(url, { method: 'POST' })
	const data = await res.json().catch(() => ({}))
	const isRateLimited = data?.reason === 'rate_limited'

	if (!res.ok || isRateLimited) {
		return isRateLimited ? { ok: false, reason: 'rate_limited' } : { ok: false }
	}

	return typeof data?.count === 'number' ? { ok: true, count: data.count } : { ok: false }
}
