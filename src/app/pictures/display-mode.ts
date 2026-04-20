export type PicturesDisplayMode = 'random' | 'masonry'

export const PICTURES_DISPLAY_MODE_PERSISTENCE = 'sessionStorage' as const
export const PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY = 'pictures-display-mode'

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function normalizePicturesDisplayMode(value: unknown): PicturesDisplayMode {
	return value === 'masonry' ? 'masonry' : 'random'
}

export function resolvePicturesEffectiveDisplayMode(params: {
	preferredDisplayMode: PicturesDisplayMode
	isEditMode: boolean
	isMobile: boolean
}): PicturesDisplayMode {
	if (params.isEditMode || params.isMobile) {
		return 'random'
	}

	return params.preferredDisplayMode
}

export function readPicturesDisplayModeFromSessionStorage(storage?: SessionStorageLike | null): PicturesDisplayMode {
	if (!storage) {
		return 'random'
	}

	try {
		return normalizePicturesDisplayMode(storage.getItem(PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY))
	} catch {
		return 'random'
	}
}

export function writePicturesDisplayModeToSessionStorage(mode: PicturesDisplayMode, storage?: SessionStorageLike | null): void {
	if (!storage) {
		return
	}

	try {
		storage.setItem(PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY, mode)
	} catch {
		// Ignore sessionStorage write failures so browsing still works.
	}
}
