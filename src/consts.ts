export const INIT_DELAY = 0.3
export const ANIMATION_DELAY = 0.1
export const CARD_SPACING = 36
export const CARD_SPACING_SM = 24
export const BLOG_SLUG_KEY = process.env.BLOG_SLUG_KEY || ''

const REQUIRED_GITHUB_WRITE_ENV = {
	OWNER: 'NEXT_PUBLIC_GITHUB_OWNER',
	REPO: 'NEXT_PUBLIC_GITHUB_REPO',
	BRANCH: 'NEXT_PUBLIC_GITHUB_BRANCH',
	APP_ID: 'NEXT_PUBLIC_GITHUB_APP_ID'
} as const

/**
 * GitHub 仓库配置
 */
export const GITHUB_CONFIG = {
	OWNER: process.env.NEXT_PUBLIC_GITHUB_OWNER?.trim() ?? '',
	REPO: process.env.NEXT_PUBLIC_GITHUB_REPO?.trim() ?? '',
	BRANCH: process.env.NEXT_PUBLIC_GITHUB_BRANCH?.trim() ?? '',
	APP_ID: process.env.NEXT_PUBLIC_GITHUB_APP_ID?.trim() ?? '',
	ENCRYPT_KEY: process.env.NEXT_PUBLIC_GITHUB_ENCRYPT_KEY?.trim() ?? ''
} as const

export function assertGitHubWriteConfigAvailable() {
	const missing = Object.entries(REQUIRED_GITHUB_WRITE_ENV).flatMap(([key, envName]) => {
		const value = GITHUB_CONFIG[key as keyof typeof REQUIRED_GITHUB_WRITE_ENV]
		return value && value !== '-' ? [] : [envName]
	})

	if (missing.length > 0) {
		throw new Error(`缺少 GitHub 写入配置：${missing.join(', ')}`)
	}
}
