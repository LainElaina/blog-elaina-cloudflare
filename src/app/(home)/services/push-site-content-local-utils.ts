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

export function buildLocalDraftConfigPayload<TSiteContent, TCardStyles>(
	siteContent: TSiteContent,
	originalSiteContent: TSiteContent,
	cardStyles: TCardStyles,
	originalCardStyles: TCardStyles
) {
	const payload: { siteContent?: TSiteContent | null; cardStyles?: TCardStyles | null } = buildLocalConfigPayload(
		siteContent,
		originalSiteContent,
		cardStyles,
		originalCardStyles
	)

	if (!('siteContent' in payload)) {
		payload.siteContent = null
	}
	if (!('cardStyles' in payload)) {
		payload.cardStyles = null
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

type PendingFileAssetItem = { type?: string } | null | undefined

type PendingLocalAssetUploads = {
	faviconItem?: PendingFileAssetItem
	avatarItem?: PendingFileAssetItem
	artImageUploads?: Record<string, PendingFileAssetItem> | null
	backgroundImageUploads?: Record<string, PendingFileAssetItem> | null
	socialButtonImageUploads?: Record<string, PendingFileAssetItem> | null
}

function isPendingFileAssetUpload(item: PendingFileAssetItem) {
	return item?.type === 'file'
}

export function hasPendingLocalFileAssetUploads(uploads: PendingLocalAssetUploads) {
	return (
		isPendingFileAssetUpload(uploads.faviconItem) ||
		isPendingFileAssetUpload(uploads.avatarItem) ||
		Object.values(uploads.artImageUploads ?? {}).some(isPendingFileAssetUpload) ||
		Object.values(uploads.backgroundImageUploads ?? {}).some(isPendingFileAssetUpload) ||
		Object.values(uploads.socialButtonImageUploads ?? {}).some(isPendingFileAssetUpload)
	)
}

export function assertCanSaveLocalSiteConfigDraft(action: 'draft' | 'publish', uploads: PendingLocalAssetUploads) {
	if (action === 'draft' && hasPendingLocalFileAssetUploads(uploads)) {
		throw new Error('本地草稿不能包含尚未写入项目的图片文件，请使用“正式保存”写入本地资源')
	}
}

type SiteContentWithSocialButtons = {
	socialButtons?: Array<{ id: string; value: string }> | null
}

type LocalSiteAssetFetch = (input: string, init?: RequestInit) => Promise<Response>

export type LocalSiteAssetUploadBackup = {
	path: string
	existed: boolean
	file?: File
}

const LOCAL_SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX = '/images/social-buttons/'
const LOCAL_SOCIAL_BUTTON_IMAGE_REPO_PREFIX = 'public/images/social-buttons/'

function resolveLocalSingleFileAssetRepoPath(publicPath: string, publicPrefix: string, repoPrefix: string) {
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

export function resolveLocalSocialButtonImageUploadPath(siteContent: SiteContentWithSocialButtons, buttonId: string) {
	const value = siteContent.socialButtons?.find(button => button.id === buttonId)?.value
	if (!value) {
		return null
	}
	return resolveLocalSingleFileAssetRepoPath(value, LOCAL_SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX, LOCAL_SOCIAL_BUTTON_IMAGE_REPO_PREFIX)
}

function toPublicAssetUrl(filePath: string) {
	if (!filePath.startsWith('public/')) {
		throw new Error('本地站点资源回滚只支持 public 目录文件')
	}
	return `/${filePath.slice('public/'.length)}`
}

function getLocalSiteAssetFileName(filePath: string) {
	return filePath.split('/').pop() || 'asset'
}

async function assertLocalSiteAssetOk(response: Response, actionName: string) {
	if (response.ok) {
		return
	}

	const detail = await response.text().catch(() => '')
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
}

async function assertLocalSiteAssetBackupReadOk(response: Response, path: string) {
	if (response.ok || response.status === 404) {
		return
	}

	await assertLocalSiteAssetOk(response, `读取 ${path} 备份`)
}

export async function readLocalSiteAssetUploadBackup(path: string, fetchLocal: LocalSiteAssetFetch = fetch): Promise<LocalSiteAssetUploadBackup> {
	const response = await fetchLocal(toPublicAssetUrl(path), { cache: 'no-store' })
	await assertLocalSiteAssetBackupReadOk(response, path)
	if (response.status === 404) {
		return { path, existed: false }
	}

	const blob = await response.blob()
	return {
		path,
		existed: true,
		file: new File([blob], getLocalSiteAssetFileName(path), { type: blob.type || 'application/octet-stream' })
	}
}

async function writeLocalSiteAsset(file: File, path: string, actionName: string, fetchLocal: LocalSiteAssetFetch) {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('path', path)
	await assertLocalSiteAssetOk(await fetchLocal('/api/upload-image', { method: 'POST', body: formData }), actionName)
}

async function deleteLocalSiteAsset(path: string, fetchLocal: LocalSiteAssetFetch) {
	await assertLocalSiteAssetOk(
		await fetchLocal('/api/delete-image', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path })
		}),
		`删除 ${path}`
	)
}

export async function uploadLocalSiteAsset(
	file: File,
	path: string,
	uploadedFiles: LocalSiteAssetUploadBackup[],
	fetchLocal: LocalSiteAssetFetch = fetch
) {
	const backup = await readLocalSiteAssetUploadBackup(path, fetchLocal)
	uploadedFiles.push(backup)
	await writeLocalSiteAsset(file, path, `上传 ${path}`, fetchLocal)
}

export async function rollbackLocalSiteAssetUploads(uploadedFiles: LocalSiteAssetUploadBackup[], fetchLocal: LocalSiteAssetFetch = fetch) {
	const rollbackErrors: string[] = []

	for (const backup of [...uploadedFiles].reverse()) {
		try {
			if (backup.existed && backup.file) {
				await writeLocalSiteAsset(backup.file, backup.path, `恢复 ${backup.path}`, fetchLocal)
			} else if (!backup.existed) {
				await deleteLocalSiteAsset(backup.path, fetchLocal)
			}
		} catch {
			rollbackErrors.push(backup.path)
		}
	}

	if (rollbackErrors.length > 0) {
		throw new Error(`回滚失败：${rollbackErrors.join(', ')}`)
	}
}

export async function rollbackLocalSiteAssetUploadsAfterFailure(
	originalError: unknown,
	uploadedFiles: LocalSiteAssetUploadBackup[],
	fetchLocal: LocalSiteAssetFetch = fetch
) {
	try {
		await rollbackLocalSiteAssetUploads(uploadedFiles, fetchLocal)
	} catch (rollbackError) {
		const originalMessage = originalError instanceof Error ? originalError.message : String(originalError)
		const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
		throw new Error(`${originalMessage}；本地站点资源回滚失败：${rollbackMessage}`)
	}
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
