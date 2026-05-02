import { resolvePicturesEffectiveDisplayMode, type PicturesDisplayMode } from './display-mode.ts'

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

type PictureImagePathReplacementInput = {
	id: string
	image?: string
	images?: string[]
}

export function applyPictureImagePathReplacements<TPicture extends PictureImagePathReplacementInput>(
	pictures: TPicture[],
	replacements: Map<string, string>
): TPicture[] {
	return pictures.map(picture => {
		const currentImages = picture.images && picture.images.length > 0 ? picture.images : picture.image ? [picture.image] : []
		if (currentImages.length === 0) {
			return picture
		}

		const nextImages = currentImages.map((url, index) => replacements.get(`${picture.id}::${index}`) ?? url)
		if (nextImages.every((url, index) => url === currentImages[index])) {
			return picture
		}

		return {
			...picture,
			image: undefined,
			images: nextImages
		}
	})
}
