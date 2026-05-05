const ART_IMAGE_PUBLIC_PREFIX = '/images/art/'
const ART_IMAGE_REPO_PREFIX = 'public/images/art/'
const BACKGROUND_IMAGE_PUBLIC_PREFIX = '/images/background/'
const BACKGROUND_IMAGE_REPO_PREFIX = 'public/images/background/'
const SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX = '/images/social-buttons/'
const SOCIAL_BUTTON_IMAGE_REPO_PREFIX = 'public/images/social-buttons/'

type SiteContentWithSocialButtons = {
	socialButtons?: Array<{ value?: string | null }> | null
}

type SiteContentImageConfig = {
	url?: string | null
}

function publicAssetRepoPath(publicPath: string, publicPrefix: string, repoPrefix: string): string | null {
	if (!publicPath.startsWith(publicPrefix)) {
		return null
	}
	const pathOnly = publicPath.split(/[?#]/, 1)[0]
	const filename = pathOnly.slice(publicPrefix.length)
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		return null
	}
	return `${repoPrefix}${filename}`
}

function artImageRepoPath(publicPath: string): string | null {
	return publicAssetRepoPath(publicPath, ART_IMAGE_PUBLIC_PREFIX, ART_IMAGE_REPO_PREFIX)
}

function backgroundImageRepoPath(publicPath: string): string | null {
	return publicAssetRepoPath(publicPath, BACKGROUND_IMAGE_PUBLIC_PREFIX, BACKGROUND_IMAGE_REPO_PREFIX)
}

function socialButtonImageRepoPath(publicPath: string): string | null {
	return publicAssetRepoPath(publicPath, SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX, SOCIAL_BUTTON_IMAGE_REPO_PREFIX)
}

export function buildArtImageUploadRepoPath(publicPath: string | null | undefined): string | null {
	return typeof publicPath === 'string' ? artImageRepoPath(publicPath) : null
}

export function buildBackgroundImageUploadRepoPath(publicPath: string | null | undefined): string | null {
	return typeof publicPath === 'string' ? backgroundImageRepoPath(publicPath) : null
}

export function buildSocialButtonImageUploadRepoPath(publicPath: string | null | undefined): string | null {
	return typeof publicPath === 'string' ? socialButtonImageRepoPath(publicPath) : null
}

function buildRemovedImageDeletePaths(images: SiteContentImageConfig[] | null | undefined, toRepoPath: (publicPath: string) => string | null): string[] {
	const paths: string[] = []
	for (const image of images ?? []) {
		if (typeof image.url !== 'string') {
			continue
		}
		const path = toRepoPath(image.url)
		if (path) {
			paths.push(path)
		}
	}
	return paths
}

function collectSocialButtonImageRepoPaths(siteContent: SiteContentWithSocialButtons): Set<string> {
	const paths = new Set<string>()
	for (const button of siteContent.socialButtons ?? []) {
		if (typeof button.value !== 'string') {
			continue
		}
		const path = socialButtonImageRepoPath(button.value)
		if (path) {
			paths.add(path)
		}
	}
	return paths
}

export function buildRemovedArtImageDeletePaths(removedArtImages: SiteContentImageConfig[] | null | undefined): string[] {
	return buildRemovedImageDeletePaths(removedArtImages, artImageRepoPath)
}

export function buildRemovedBackgroundImageDeletePaths(removedBackgroundImages: SiteContentImageConfig[] | null | undefined): string[] {
	return buildRemovedImageDeletePaths(removedBackgroundImages, backgroundImageRepoPath)
}

export function buildRemovedSocialButtonImageDeletePaths(originalSiteContent: SiteContentWithSocialButtons, currentSiteContent: SiteContentWithSocialButtons): string[] {
	const currentPaths = collectSocialButtonImageRepoPaths(currentSiteContent)
	const paths: string[] = []

	for (const originalPath of collectSocialButtonImageRepoPaths(originalSiteContent)) {
		if (!currentPaths.has(originalPath)) {
			paths.push(originalPath)
		}
	}

	return paths
}
