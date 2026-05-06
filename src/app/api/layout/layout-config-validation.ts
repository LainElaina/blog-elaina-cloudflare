const CARD_STYLE_KEYS = new Set([
	'artCard',
	'hiCard',
	'clockCard',
	'calendarCard',
	'musicCard',
	'socialButtons',
	'shareCard',
	'articleCard',
	'writeButtons',
	'navCard',
	'likePosition',
	'hatCard',
	'beianCard',
	'logButton',
	'componentStoreButton',
	'editLayoutButton',
	'layoutSettingsButton',
	'exportLayoutButton',
	'importLayoutButton'
])

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
	return value === null || isFiniteNumber(value)
}

function isLayoutCardStyle(value: unknown) {
	return isObject(value) &&
		isFiniteNumber(value.width) &&
		isFiniteNumber(value.height) &&
		isFiniteNumber(value.order) &&
		isNullableFiniteNumber(value.offsetX) &&
		isNullableFiniteNumber(value.offsetY) &&
		typeof value.enabled === 'boolean' &&
		(!('offset' in value) || isFiniteNumber(value.offset))
}

function isLayoutPayload(value: Record<string, unknown>) {
	const entries = Object.entries(value)
	return entries.length > 0 && entries.every(([key, cardStyle]) => CARD_STYLE_KEYS.has(key) && isLayoutCardStyle(cardStyle))
}

export function isValidLayoutConfig(value: unknown) {
	return isObject(value) && isLayoutPayload(value)
}
