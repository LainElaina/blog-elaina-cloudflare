import { resolvePicturesEffectiveDisplayMode, type PicturesDisplayMode } from './display-mode'

export function buildPicturesPageDisplayModeState(params: {
	preferredDisplayMode: PicturesDisplayMode
	isEditMode: boolean
	isMobile: boolean
	onDisplayModeChange: (mode: PicturesDisplayMode) => void
}) {
	return {
		effectiveDisplayMode: resolvePicturesEffectiveDisplayMode({
			preferredDisplayMode: params.preferredDisplayMode,
			isEditMode: params.isEditMode,
			isMobile: params.isMobile
		}),
		onDisplayModeChange: params.onDisplayModeChange
	}
}
