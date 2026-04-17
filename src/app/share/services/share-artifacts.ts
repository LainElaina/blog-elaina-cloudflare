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

function createShareUrlConflictError(url: string): Error {
	return new Error(`URL 已存在: ${url}`)
}

function validatePublishedShareUrlConflicts(
	shares: ShareListItem[],
	storage: ReturnType<typeof parseShareStorageDB>,
	renamedUrls: Map<string, string>
) {
	const occupiedPublishedUrls = new Set(
		Object.values(storage.shares)
			.filter(record => record.status === 'published')
			.map(record => record.url)
	)
	const seenTargetUrls = new Set<string>()

	for (const share of shares) {
		if (seenTargetUrls.has(share.url)) {
			throw createShareUrlConflictError(share.url)
		}
		seenTargetUrls.add(share.url)
	}

	const renamedFromUrls = new Set(renamedUrls.values())
	for (const [currentUrl, oldUrl] of renamedUrls.entries()) {
		if (currentUrl === oldUrl) {
			continue
		}
		if (occupiedPublishedUrls.has(currentUrl)) {
			throw createShareUrlConflictError(currentUrl)
		}
	}

	for (const share of shares) {
		const isRenameTarget = renamedUrls.has(share.url)
		if (!isRenameTarget && renamedFromUrls.has(share.url)) {
			throw createShareUrlConflictError(share.url)
		}
	}
}

export function buildLocalShareSaveFilePayloads(
	shares: ShareListItem[],
	existingStorageRaw: string | null = null,
	renamedUrls: Map<string, string> = new Map(),
	deletedPublishedUrls: Set<string> = new Set()
): ShareSaveFilePayload[] {
	const now = new Date()
	let storage = existingStorageRaw ? parseShareStorageDB(existingStorageRaw) : createEmptyShareStorageDB(now)

	validatePublishedShareUrlConflicts(shares, storage, renamedUrls)

	const publishedUrls = new Set(shares.map(share => share.url))
	const renamedFromUrls = new Set(renamedUrls.values())
	for (const deletedUrl of deletedPublishedUrls) {
		if (publishedUrls.has(deletedUrl) && !renamedFromUrls.has(deletedUrl)) {
			throw createShareUrlConflictError(deletedUrl)
		}
	}
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
