import {
	exportStaticShareArtifacts,
	createEmptyShareStorageDB,
	parseShareStorageDB,
	upsertShareRecord,
	type ShareListItem
} from '../../../lib/content-db/share-storage.ts'

export type ShareSaveFilePayload = {
	path: string
	content: string
}

export const LOCAL_SHARE_SAVE_PATHS = {
	list: 'public/share/list.json',
	categories: 'public/share/categories.json',
	folders: 'public/share/folders.json',
	storage: 'public/share/storage.json'
} as const

export function serializeShareCategories(categories: string[]): string {
	return JSON.stringify({ categories }, null, 2)
}

export function applyShareLogoPathUpdates(shares: ShareListItem[], nextLogoPaths: Map<string, string>): ShareListItem[] {
	return shares.map(share => {
		const nextLogoPath = nextLogoPaths.get(share.url)
		return nextLogoPath ? { ...share, logo: nextLogoPath } : share
	})
}

export function buildLocalShareSaveFilePayloads(
	shares: ShareListItem[],
	existingStorageRaw: string | null = null,
	renamedUrls: Map<string, string> = new Map()
): ShareSaveFilePayload[] {
	const now = new Date()
	let storage = existingStorageRaw ? parseShareStorageDB(existingStorageRaw) : createEmptyShareStorageDB(now)
	const publishedUrls = new Set(shares.map(share => share.url))
	const renamedFromUrls = new Set(renamedUrls.values())
	const nextShares = Object.fromEntries(
		Object.entries(storage.shares).filter(([, record]) => record.status !== 'published' || publishedUrls.has(record.url) || renamedFromUrls.has(record.url))
	)
	storage = {
		...storage,
		updatedAt: now.toISOString(),
		shares: nextShares
	}
	for (const share of shares) {
		storage = upsertShareRecord(storage, share, { now, currentUrl: renamedUrls.get(share.url) })
	}
	const artifacts = exportStaticShareArtifacts(storage)
	return [
		{ path: LOCAL_SHARE_SAVE_PATHS.list, content: JSON.stringify(artifacts.list, null, 2) },
		{ path: LOCAL_SHARE_SAVE_PATHS.categories, content: serializeShareCategories(artifacts.categories) },
		{ path: LOCAL_SHARE_SAVE_PATHS.folders, content: JSON.stringify(artifacts.folders, null, 2) },
		{ path: LOCAL_SHARE_SAVE_PATHS.storage, content: JSON.stringify(artifacts.db, null, 2) }
	]
}
