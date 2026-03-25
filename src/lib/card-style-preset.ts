export const CARD_STYLE_PRESETS = ['original', 'classic', 'refined'] as const

export type CardStylePreset = (typeof CARD_STYLE_PRESETS)[number]

export function normalizeCardStylePreset(value: unknown): CardStylePreset {
	if (typeof value !== 'string') {
		return 'original'
	}

	if ((CARD_STYLE_PRESETS as readonly string[]).includes(value)) {
		return value as CardStylePreset
	}

	return 'original'
}
