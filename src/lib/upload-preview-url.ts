export type PreviewItem = { type: string; previewUrl?: string }

function collectFilePreviewUrls(items: Iterable<PreviewItem>) {
	const previewUrls = new Set<string>()
	for (const item of items) {
		if (item.type === 'file' && item.previewUrl) {
			previewUrls.add(item.previewUrl)
		}
	}
	return previewUrls
}

export function revokeUnusedFilePreviewUrls(previousItems: Iterable<PreviewItem>, nextItems: Iterable<PreviewItem>) {
	const retainedPreviewUrls = collectFilePreviewUrls(nextItems)
	const revokedPreviewUrls = new Set<string>()

	for (const item of previousItems) {
		if (item.type === 'file' && item.previewUrl && !retainedPreviewUrls.has(item.previewUrl) && !revokedPreviewUrls.has(item.previewUrl)) {
			URL.revokeObjectURL(item.previewUrl)
			revokedPreviewUrls.add(item.previewUrl)
		}
	}
}

export function revokeFilePreviewUrls(items: Iterable<PreviewItem>) {
	revokeUnusedFilePreviewUrls(items, [])
}
