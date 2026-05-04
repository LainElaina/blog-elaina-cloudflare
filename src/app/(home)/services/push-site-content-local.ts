import { toast } from 'sonner'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, ArtImageUploads, SocialButtonImageUploads, BackgroundImageUploads } from '../config-dialog/site-settings'
import { buildRemovedArtImageDeletePaths, buildRemovedBackgroundImageDeletePaths, buildRemovedSocialButtonImageDeletePaths } from './site-content-assets'
import {
	buildLocalConfigPayload,
	buildLocalDraftConfigPayload,
	requestLocalEndpoint,
	getLocalSiteConfigEndpoint,
	shouldSyncFormalAssets,
	shouldRequestLocalConfigEndpoint,
	resolveLocalSocialButtonImageUploadPath,
	uploadLocalSiteAsset,
	rollbackLocalSiteAssetUploads,
	type LocalSiteAssetUploadBackup
} from './push-site-content-local-utils'

type ArtImageConfig = SiteContent['artImages'][number]
type BackgroundImageConfig = SiteContent['backgroundImages'][number]

export async function pushSiteContentLocal(
	action: 'draft' | 'publish',
	siteContent: SiteContent,
	originalSiteContent: SiteContent,
	cardStyles: CardStyles,
	originalCardStyles: CardStyles,
	faviconItem?: FileItem | null,
	avatarItem?: FileItem | null,
	artImageUploads?: ArtImageUploads,
	removedArtImages?: ArtImageConfig[],
	backgroundImageUploads?: BackgroundImageUploads,
	removedBackgroundImages?: BackgroundImageConfig[],
	socialButtonImageUploads?: SocialButtonImageUploads,
	publishExistingDraft = false
): Promise<void> {
	toast.info(action === 'draft' ? '正在保存本地草稿...' : '正在正式保存到本地...')

	const uploadTasks: Array<() => Promise<void>> = []
	const uploadedFiles: LocalSiteAssetUploadBackup[] = []
	const deleteTasks: Array<() => Promise<void>> = []
	const syncFormalAssets = shouldSyncFormalAssets(action)

	// Upload favicon
	if (syncFormalAssets && faviconItem?.type === 'file') {
		uploadTasks.push(() => uploadLocalSiteAsset(faviconItem.file, 'public/favicon.png', uploadedFiles))
	}

	// Upload avatar
	if (syncFormalAssets && avatarItem?.type === 'file') {
		uploadTasks.push(() => uploadLocalSiteAsset(avatarItem.file, 'public/images/avatar.png', uploadedFiles))
	}

	// Upload art images
	if (syncFormalAssets && artImageUploads) {
		for (const [id, item] of Object.entries(artImageUploads)) {
			if (item.type === 'file') {
				const ext = item.file.name.split('.').pop() || 'png'
				uploadTasks.push(() => uploadLocalSiteAsset(item.file, `public/images/art/${id}.${ext}`, uploadedFiles))
			}
		}
	}

	// Delete removed art images
	if (syncFormalAssets) {
		for (const path of buildRemovedArtImageDeletePaths(removedArtImages)) {
			deleteTasks.push(() => deleteFile(path))
		}
	}

	// Upload background images
	if (syncFormalAssets && backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type === 'file') {
				const ext = item.file.name.split('.').pop() || 'png'
				uploadTasks.push(() => uploadLocalSiteAsset(item.file, `public/images/background/${id}.${ext}`, uploadedFiles))
			}
		}
	}

	// Delete removed background images
	if (syncFormalAssets) {
		for (const path of buildRemovedBackgroundImageDeletePaths(removedBackgroundImages)) {
			deleteTasks.push(() => deleteFile(path))
		}
	}

	// Upload social button images
	if (syncFormalAssets && socialButtonImageUploads) {
		for (const [id, item] of Object.entries(socialButtonImageUploads)) {
			if (item.type !== 'file') continue
			const uploadPath = resolveLocalSocialButtonImageUploadPath(siteContent, id)
			if (!uploadPath) continue
			uploadTasks.push(() => uploadLocalSiteAsset(item.file, uploadPath, uploadedFiles))
		}
	}

	if (syncFormalAssets) {
		for (const path of buildRemovedSocialButtonImageDeletePaths(originalSiteContent, siteContent)) {
			deleteTasks.push(() => deleteFile(path))
		}
	}

	try {
		for (const uploadTask of uploadTasks) {
			await uploadTask()
		}

		const configPayload =
			action === 'draft'
				? buildLocalDraftConfigPayload(siteContent, originalSiteContent, cardStyles, originalCardStyles)
				: buildLocalConfigPayload(siteContent, originalSiteContent, cardStyles, originalCardStyles)
		if (shouldRequestLocalConfigEndpoint(action, configPayload, publishExistingDraft)) {
			await requestLocalEndpoint(
				fetch,
				getLocalSiteConfigEndpoint(action),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(configPayload)
				},
				10000
			)
		}
	} catch (error) {
		await rollbackLocalSiteAssetUploads(uploadedFiles)
		throw error
	}

	await cleanupLocalSiteAssets(deleteTasks)

	toast.success(action === 'draft' ? '本地草稿已保存' : '已正式保存到本地文件')
}

async function cleanupLocalSiteAssets(deleteTasks: Array<() => Promise<void>>) {
	for (const deleteTask of deleteTasks) {
		await deleteTask().catch(error => console.warn('删除未使用的站点资源失败:', error))
	}
}

async function deleteFile(path: string): Promise<void> {
	const response = await fetch('/api/delete-image', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})

	if (!response.ok) {
		throw new Error(`删除 ${path} 失败`)
	}
}
