import { resolvePicturesEffectiveDisplayMode, type PicturesDisplayMode } from './display-mode.ts'

export type PicturesRuntimeItem = {
	id: string
	uploadedAt: string
	description?: string
	image?: string
	images?: string[]
}

export function normalizePicturesRuntimeItems(items: unknown): PicturesRuntimeItem[] {
	if (!Array.isArray(items)) {
		return []
	}

	return items.flatMap(item => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return []
		}

		const picture = item as Record<string, unknown>
		const images = Array.isArray(picture.images)
			? picture.images.filter(image => typeof image === 'string')
			: undefined
		if (
			typeof picture.id !== 'string' ||
			typeof picture.uploadedAt !== 'string' ||
			(typeof picture.image !== 'string' && (!images || images.length === 0))
		) {
			return []
		}

		const { description, image, images: _images, ...pictureFields } = picture
		return [
			{
				...pictureFields,
				id: picture.id,
				uploadedAt: picture.uploadedAt,
				...(typeof description === 'string' ? { description } : {}),
				...(typeof image === 'string' ? { image } : {}),
				...(images && images.length > 0 ? { images } : {})
			} as PicturesRuntimeItem
		]
	})
}

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

export function isPictureImageReplacementKey(key: string): boolean {
	const [pictureId, imageIndex, ...rest] = key.split('::')
	return rest.length === 0 && pictureId.length > 0 && typeof imageIndex === 'string' && /^(0|[1-9]\d*)$/.test(imageIndex)
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
