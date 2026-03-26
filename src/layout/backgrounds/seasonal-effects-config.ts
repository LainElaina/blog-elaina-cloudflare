export type SeasonalTheme = 'spring' | 'summer' | 'autumn' | 'winter'
export type SeasonalStyle = 'light' | 'mixed' | 'vivid'
export type ParticleShape = 'circle' | 'petal' | 'leaf' | 'bubble' | 'softGlow' | 'maple'
export type ParticleMovement = 'float' | 'rise' | 'fall'

export interface LayerConfig {
	count: number
	opacity: number
	colors: string[]
	sizeRange: [number, number]
	durationRange: [number, number]
	driftRange: [number, number]
	rotate?: boolean
	shape: ParticleShape
	movement?: ParticleMovement
}

export type SeasonalLayerResult =
	| { kind: 'winter'; snowCount: number }
	| { kind: 'layers'; primary: LayerConfig; secondary: LayerConfig }

export const SEASONAL_STYLE_OPTIONS = [
	{ value: 'light', label: '轻量' },
	{ value: 'mixed', label: '中等' },
	{ value: 'vivid', label: '明显' }
] as const

const WINTER_SNOW_COUNTS: Record<SeasonalStyle, number> = {
	light: 22,
	mixed: 42,
	vivid: 64
}

const SPRING_LAYERS: Record<SeasonalStyle, SeasonalLayerResult> = {
	light: {
		kind: 'layers',
		primary: {
			count: 10,
			opacity: 0.28,
			colors: ['#ffb3c7', '#ffc2d1', '#ffd6de'],
			sizeRange: [8, 16],
			durationRange: [14, 24],
			driftRange: [-18, 18],
			rotate: true,
			shape: 'petal',
			movement: 'float'
		},
		secondary: {
			count: 6,
			opacity: 0.12,
			colors: ['#fff1f5', '#ffe4ec', '#fff7fb'],
			sizeRange: [10, 20],
			durationRange: [16, 26],
			driftRange: [-12, 12],
			shape: 'softGlow',
			movement: 'float'
		}
	},
	mixed: {
		kind: 'layers',
		primary: {
			count: 18,
			opacity: 0.4,
			colors: ['#ffadc6', '#ffc2d1', '#ffd6de'],
			sizeRange: [9, 18],
			durationRange: [14, 22],
			driftRange: [-24, 24],
			rotate: true,
			shape: 'petal',
			movement: 'float'
		},
		secondary: {
			count: 10,
			opacity: 0.2,
			colors: ['#fff1f5', '#ffe4ec', '#fff7fb'],
			sizeRange: [12, 24],
			durationRange: [16, 24],
			driftRange: [-16, 16],
			shape: 'softGlow',
			movement: 'float'
		}
	},
	vivid: {
		kind: 'layers',
		primary: {
			count: 28,
			opacity: 0.54,
			colors: ['#ff9fbd', '#ffb3c7', '#ffc2d1'],
			sizeRange: [10, 20],
			durationRange: [12, 20],
			driftRange: [-30, 30],
			rotate: true,
			shape: 'petal',
			movement: 'float'
		},
		secondary: {
			count: 16,
			opacity: 0.28,
			colors: ['#fff1f5', '#ffe4ec', '#fff7fb'],
			sizeRange: [14, 28],
			durationRange: [14, 22],
			driftRange: [-20, 20],
			shape: 'softGlow',
			movement: 'float'
		}
	}
}

const SUMMER_LAYERS: Record<SeasonalStyle, SeasonalLayerResult> = {
	light: {
		kind: 'layers',
		primary: {
			count: 12,
			opacity: 0.22,
			colors: ['#ffd166', '#ffbf69', '#f4a261'],
			sizeRange: [8, 16],
			durationRange: [10, 18],
			driftRange: [-10, 16],
			shape: 'bubble',
			movement: 'rise'
		},
		secondary: {
			count: 5,
			opacity: 0.14,
			colors: ['#fff4a3', '#ffe066', '#fff1b8'],
			sizeRange: [18, 34],
			durationRange: [16, 26],
			driftRange: [-8, 8],
			shape: 'softGlow',
			movement: 'float'
		}
	},
	mixed: {
		kind: 'layers',
		primary: {
			count: 20,
			opacity: 0.32,
			colors: ['#ffd166', '#ffbf69', '#f4a261'],
			sizeRange: [9, 18],
			durationRange: [9, 16],
			driftRange: [-12, 18],
			shape: 'bubble',
			movement: 'rise'
		},
		secondary: {
			count: 8,
			opacity: 0.2,
			colors: ['#fff4a3', '#ffe066', '#fff1b8'],
			sizeRange: [22, 40],
			durationRange: [14, 22],
			driftRange: [-10, 10],
			shape: 'softGlow',
			movement: 'float'
		}
	},
	vivid: {
		kind: 'layers',
		primary: {
			count: 30,
			opacity: 0.44,
			colors: ['#ffd166', '#ffbf69', '#f4a261'],
			sizeRange: [10, 20],
			durationRange: [8, 14],
			driftRange: [-14, 20],
			shape: 'bubble',
			movement: 'rise'
		},
		secondary: {
			count: 12,
			opacity: 0.26,
			colors: ['#fff4a3', '#ffe066', '#fff1b8'],
			sizeRange: [24, 46],
			durationRange: [12, 20],
			driftRange: [-12, 12],
			shape: 'softGlow',
			movement: 'float'
		}
	}
}

const AUTUMN_LAYERS: Record<SeasonalStyle, SeasonalLayerResult> = {
	light: {
		kind: 'layers',
		primary: {
			count: 10,
			opacity: 0.28,
			colors: ['#f4a261', '#e76f51', '#e9c46a'],
			sizeRange: [10, 18],
			durationRange: [12, 20],
			driftRange: [-18, 18],
			rotate: true,
			shape: 'maple',
			movement: 'fall'
		},
		secondary: {
			count: 5,
			opacity: 0.12,
			colors: ['#f6bd60', '#f7ede2', '#dda15e'],
			sizeRange: [8, 16],
			durationRange: [14, 22],
			driftRange: [-10, 10],
			shape: 'softGlow',
			movement: 'float'
		}
	},
	mixed: {
		kind: 'layers',
		primary: {
			count: 18,
			opacity: 0.4,
			colors: ['#f4a261', '#e76f51', '#e9c46a', '#c97b63'],
			sizeRange: [11, 20],
			durationRange: [11, 18],
			driftRange: [-20, 20],
			rotate: true,
			shape: 'maple',
			movement: 'fall'
		},
		secondary: {
			count: 8,
			opacity: 0.18,
			colors: ['#f6bd60', '#f7ede2', '#dda15e'],
			sizeRange: [10, 18],
			durationRange: [12, 20],
			driftRange: [-12, 12],
			shape: 'softGlow',
			movement: 'float'
		}
	},
	vivid: {
		kind: 'layers',
		primary: {
			count: 28,
			opacity: 0.52,
			colors: ['#f4a261', '#e76f51', '#e9c46a', '#c97b63'],
			sizeRange: [12, 22],
			durationRange: [10, 16],
			driftRange: [-24, 24],
			rotate: true,
			shape: 'maple',
			movement: 'fall'
		},
		secondary: {
			count: 12,
			opacity: 0.24,
			colors: ['#f6bd60', '#f7ede2', '#dda15e'],
			sizeRange: [12, 22],
			durationRange: [12, 18],
			driftRange: [-14, 14],
			shape: 'softGlow',
			movement: 'float'
		}
	}
}

export function getSeasonalLayers(season: SeasonalTheme, style: SeasonalStyle): SeasonalLayerResult {
	if (season === 'winter') {
		return { kind: 'winter', snowCount: WINTER_SNOW_COUNTS[style] }
	}

	if (season === 'spring') {
		return SPRING_LAYERS[style]
	}

	if (season === 'summer') {
		return SUMMER_LAYERS[style]
	}

	return AUTUMN_LAYERS[style]
}
