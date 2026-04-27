export function buildLocalConfigPayload<TSiteContent, TCardStyles>(
	siteContent: TSiteContent,
	originalSiteContent: TSiteContent,
	cardStyles: TCardStyles,
	originalCardStyles: TCardStyles
) {
	const payload: { siteContent?: TSiteContent; cardStyles?: TCardStyles } = {}

	if (JSON.stringify(siteContent) !== JSON.stringify(originalSiteContent)) {
		payload.siteContent = siteContent
	}

	if (JSON.stringify(cardStyles) !== JSON.stringify(originalCardStyles)) {
		payload.cardStyles = cardStyles
	}

	return payload
}

export function getLocalSiteConfigEndpoint(action: 'draft' | 'publish') {
	return action === 'draft' ? '/api/drafts/site-config' : '/api/publish/site-config'
}

export function shouldSyncFormalAssets(action: 'draft' | 'publish') {
	return action === 'publish'
}


export function shouldRequestLocalConfigEndpoint(action: 'draft' | 'publish', payload: object, publishExistingDraft: boolean) {
	return Object.keys(payload).length > 0 || (action === 'publish' && publishExistingDraft)
}

export function shouldClearLocalPendingAssetUploads(action: 'draft' | 'publish') {
	return action === 'publish'
}

type SiteContentWithSocialButtons = {
	socialButtons?: Array<{ id: string; value: string }> | null
}

export function resolveLocalSocialButtonImageUploadPath(siteContent: SiteContentWithSocialButtons, buttonId: string) {
	const value = siteContent.socialButtons?.find(button => button.id === buttonId)?.value
	if (!value?.startsWith('/images/social-buttons/')) {
		return null
	}
	return `public${value}`
}

export async function requestLocalEndpoint(
	fetchImpl: typeof fetch,
	input: string,
	init?: RequestInit,
	timeoutMs = 10000
) {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)

	try {
		const response = await fetchImpl(input, { ...init, signal: controller.signal })

		if (!response.ok) {
			let message = `请求失败: ${input}`
			try {
				const data = await response.json()
				message = data?.error || message
			} catch {
				// ignore json parse failure
			}
			throw new Error(message)
		}

		return response
	} catch (error: any) {
		if (error?.name === 'AbortError') {
			throw new Error(`本地保存超时: ${input}`)
		}
		throw error
	} finally {
		clearTimeout(timer)
	}
}
