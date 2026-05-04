const SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX = '/images/social-buttons/'
const SOCIAL_BUTTON_IMAGE_REPO_PREFIX = 'public/images/social-buttons/'

type SiteContentWithSocialButtons = {
	socialButtons?: Array<{ value?: string | null }> | null
}

function socialButtonImageRepoPath(publicPath: string): string | null {
	if (!publicPath.startsWith(SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX)) {
		return null
	}
	const pathOnly = publicPath.split(/[?#]/, 1)[0]
	const filename = pathOnly.slice(SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX.length)
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		return null
	}
	return `${SOCIAL_BUTTON_IMAGE_REPO_PREFIX}${filename}`
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
