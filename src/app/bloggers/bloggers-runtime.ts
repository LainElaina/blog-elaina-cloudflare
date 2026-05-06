import type { Blogger, BloggerStatus } from './grid-view'

const BLOGGER_STATUSES = new Set<BloggerStatus>(['recent', 'disconnected'])

export function normalizeBloggersRuntimeItems(items: unknown): Blogger[] {
	if (!Array.isArray(items)) {
		return []
	}

	return items.flatMap(item => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return []
		}

		const blogger = item as Record<string, unknown>
		if (
			typeof blogger.name !== 'string' ||
			typeof blogger.avatar !== 'string' ||
			typeof blogger.url !== 'string' ||
			typeof blogger.description !== 'string'
		) {
			return []
		}

		const { status, stars, ...bloggerFields } = blogger
		return [
			{
				...bloggerFields,
				name: blogger.name,
				avatar: blogger.avatar,
				url: blogger.url,
				description: blogger.description,
				stars: typeof stars === 'number' && Number.isFinite(stars) ? stars : 0,
				...(typeof status === 'string' && BLOGGER_STATUSES.has(status as BloggerStatus) ? { status: status as BloggerStatus } : {})
			} as Blogger
		]
	})
}
