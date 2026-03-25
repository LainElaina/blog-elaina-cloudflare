export const HOME_COLOR_OVERLAY_INTENSITIES = ['default', 'light'] as const

export type HomeColorOverlayIntensity = (typeof HOME_COLOR_OVERLAY_INTENSITIES)[number]

export function normalizeHomeColorOverlayIntensity(value: unknown): HomeColorOverlayIntensity {
	if (typeof value !== 'string') {
		return 'default'
	}

	if ((HOME_COLOR_OVERLAY_INTENSITIES as readonly string[]).includes(value)) {
		return value as HomeColorOverlayIntensity
	}

	return 'default'
}

interface StaticBubbleProfile {
	size: number
	opacity: number
	left?: string
	right?: string
	bottom: string
}

interface AtmosphereOverlayProfile {
	staticBlur: number
	staticBubbles: [StaticBubbleProfile, StaticBubbleProfile, StaticBubbleProfile]
	dynamicBubbleCount: number
	dynamicBottomBandStart: number
}

const DEFAULT_PROFILE: AtmosphereOverlayProfile = {
	staticBlur: 50,
	staticBubbles: [
		{ size: 34, left: '-4%', bottom: '-8%', opacity: 0.48 },
		{ size: 38, left: '28%', bottom: '-12%', opacity: 0.42 },
		{ size: 30, right: '-5%', bottom: '-6%', opacity: 0.4 }
	],
	dynamicBubbleCount: 6,
	dynamicBottomBandStart: 0.8
}

const LIGHT_PROFILE: AtmosphereOverlayProfile = {
	staticBlur: 40,
	staticBubbles: [
		{ size: 28, left: '0%', bottom: '-6%', opacity: 0.32 },
		{ size: 31, left: '30%', bottom: '-9%', opacity: 0.28 },
		{ size: 25, right: '-2%', bottom: '-4%', opacity: 0.26 }
	],
	dynamicBubbleCount: 4,
	dynamicBottomBandStart: 0.86
}

export function getAtmosphereOverlayProfile(intensity: HomeColorOverlayIntensity): AtmosphereOverlayProfile {
	return intensity === 'light' ? LIGHT_PROFILE : DEFAULT_PROFILE
}
