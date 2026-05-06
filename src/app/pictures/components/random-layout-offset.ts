export type PictureOffset = {
	x: number
	y: number
}

const DEFAULT_PICTURE_OFFSET: PictureOffset = { x: 0, y: 0 }

export function normalizeSavedPictureOffset(input: unknown): PictureOffset {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return DEFAULT_PICTURE_OFFSET
	}

	const offset = input as Record<string, unknown>
	return {
		x: typeof offset.x === 'number' && Number.isFinite(offset.x) ? offset.x : 0,
		y: typeof offset.y === 'number' && Number.isFinite(offset.y) ? offset.y : 0
	}
}
