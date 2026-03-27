import { toast } from 'sonner'
import type { SiteContent, CardStyles } from '../stores/config-store'
import type { FileItem, ArtImageUploads, SocialButtonImageUploads, BackgroundImageUploads } from '../config-dialog/site-settings'
import { buildLocalConfigPayload, requestLocalEndpoint, getLocalSiteConfigEndpoint } from './push-site-content-local-utils'

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
	socialButtonImageUploads?: SocialButtonImageUploads
): Promise<void> {
	toast.info(action === 'draft' ? '正在保存本地草稿...' : '正在正式保存到本地...')

	const uploadPromises: Promise<void>[] = []

	// Upload favicon
	if (faviconItem?.type === 'file') {
		uploadPromises.push(uploadFile(faviconItem.file, 'public/favicon.png'))
	}

	// Upload avatar
	if (avatarItem?.type === 'file') {
		uploadPromises.push(uploadFile(avatarItem.file, 'public/images/avatar.png'))
	}

	// Upload art images
	if (artImageUploads) {
		for (const [id, item] of Object.entries(artImageUploads)) {
			if (item.type === 'file') {
				const ext = item.file.name.split('.').pop() || 'png'
				uploadPromises.push(uploadFile(item.file, `public/images/art/${id}.${ext}`))
			}
		}
	}

	// Delete removed art images
	if (removedArtImages && removedArtImages.length > 0) {
		for (const art of removedArtImages) {
			const normalizedUrl = art.url.startsWith('/') ? art.url : `/${art.url}`
			uploadPromises.push(deleteFile(`public${normalizedUrl}`))
		}
	}

	// Upload background images
	if (backgroundImageUploads) {
		for (const [id, item] of Object.entries(backgroundImageUploads)) {
			if (item.type === 'file') {
				const ext = item.file.name.split('.').pop() || 'png'
				uploadPromises.push(uploadFile(item.file, `public/images/background/${id}.${ext}`))
			}
		}
	}

	// Delete removed background images
	if (removedBackgroundImages && removedBackgroundImages.length > 0) {
		for (const bg of removedBackgroundImages) {
			if (!bg.url.startsWith('/images/background/')) continue
			const normalizedUrl = bg.url.startsWith('/') ? bg.url : `/${bg.url}`
			uploadPromises.push(deleteFile(`public${normalizedUrl}`))
		}
	}

	// Upload social button images
	if (socialButtonImageUploads) {
		for (const [id, item] of Object.entries(socialButtonImageUploads)) {
			if (item.type === 'file') {
				const ext = item.file.name.split('.').pop() || 'png'
				uploadPromises.push(uploadFile(item.file, `public/images/misc/${id}.${ext}`))
			}
		}
	}

	await Promise.all(uploadPromises)

	const configPayload = buildLocalConfigPayload(siteContent, originalSiteContent, cardStyles, originalCardStyles)
	if (Object.keys(configPayload).length > 0) {
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

	toast.success(action === 'draft' ? '本地草稿已保存' : '已正式保存到本地文件')
}

async function uploadFile(file: File, path: string): Promise<void> {
	const formData = new FormData()
	formData.append('file', file)
	formData.append('path', path)

	const response = await fetch('/api/upload-image', {
		method: 'POST',
		body: formData
	})

	if (!response.ok) {
		throw new Error(`上传 ${path} 失败`)
	}
}

async function deleteFile(path: string): Promise<void> {
	const response = await fetch('/api/delete-image', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})

	if (!response.ok) {
		console.error(`删除 ${path} 失败`)
	}
}
