import fs from 'node:fs/promises'
import path from 'node:path'

export type SiteConfigDraftPayload = {
	siteContent?: unknown
	cardStyles?: unknown
	customComponents?: unknown
	colorPresets?: unknown
}

type LocalAssetReference = {
	label: string
	url: string
}

const DRAFT_FILE_RELATIVE_PATH = path.join('data', 'site-config.draft.json')

export function resolveSiteConfigDraftPath(baseDir: string) {
	return path.join(baseDir, DRAFT_FILE_RELATIVE_PATH)
}

export function buildSiteConfigDraftItems(payload: SiteConfigDraftPayload) {
	const items: Array<{ key: string; label: string; page: string }> = []
	if (payload.siteContent) {
		items.push({ key: 'siteContent', label: '站点设置', page: '/?dialog=config' })
	}
	if (payload.cardStyles || payload.customComponents) {
		items.push({ key: 'homeLayout', label: '首页布局', page: '/?dialog=config&tab=color' })
	}
	if (payload.colorPresets) {
		items.push({ key: 'colorPresets', label: '色彩预设', page: '/?dialog=config&tab=color' })
	}
	return items
}

export async function writeSiteConfigDraft(baseDir: string, payload: SiteConfigDraftPayload) {
	const draftPath = resolveSiteConfigDraftPath(baseDir)
	await fs.mkdir(path.dirname(draftPath), { recursive: true })

	let current: SiteConfigDraftPayload = {}
	try {
		const raw = await fs.readFile(draftPath, 'utf-8')
		current = JSON.parse(raw)
	} catch {
		current = {}
	}

	const merged = { ...current, ...payload }
	await fs.writeFile(draftPath, JSON.stringify(merged, null, '\t'))

	return merged
}

export async function readSiteConfigDraft(baseDir: string): Promise<SiteConfigDraftPayload | null> {
	try {
		const raw = await fs.readFile(resolveSiteConfigDraftPath(baseDir), 'utf-8')
		return JSON.parse(raw)
	} catch {
		return null
	}
}

export async function clearSiteConfigDraft(baseDir: string) {
	await fs.rm(resolveSiteConfigDraftPath(baseDir), { force: true })
}

export async function canPublishSiteConfigDraft(baseDir: string) {
	const draft = await readSiteConfigDraft(baseDir)
	return draft !== null
}

export async function resolveSiteConfigPublishPayload(baseDir: string, payload: SiteConfigDraftPayload) {
	if (Object.keys(payload).length > 0) {
		return payload
	}

	const draft = await readSiteConfigDraft(baseDir)
	if (!draft) {
		throw new Error('没有可发布的草稿')
	}
	return draft
}

type SiteConfigFormalWrite = {
	fileName: string
	content: string
}

type SiteConfigFormalBackup = {
	filePath: string
	existed: boolean
	content: string
}

function isFileNotFoundError(error: unknown) {
	return Boolean(error) && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function buildSiteConfigFormalWrites(draft: SiteConfigDraftPayload): SiteConfigFormalWrite[] {
	const writes: SiteConfigFormalWrite[] = []
	if (draft.siteContent) {
		writes.push({ fileName: 'site-content.json', content: JSON.stringify(draft.siteContent, null, '\t') })
	}
	if (draft.cardStyles) {
		writes.push({ fileName: 'card-styles.json', content: JSON.stringify(draft.cardStyles, null, '\t') })
	}
	if (draft.customComponents) {
		writes.push({ fileName: 'custom-components.json', content: JSON.stringify(draft.customComponents, null, '\t') })
	}
	if (draft.colorPresets) {
		writes.push({ fileName: 'color-presets.json', content: JSON.stringify(draft.colorPresets, null, '\t') })
	}
	return writes
}

async function readSiteConfigFormalBackup(filePath: string): Promise<SiteConfigFormalBackup> {
	try {
		return {
			filePath,
			existed: true,
			content: await fs.readFile(filePath, 'utf-8')
		}
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return { filePath, existed: false, content: '' }
		}
		throw error
	}
}

async function rollbackSiteConfigFormalWrites(backups: SiteConfigFormalBackup[]) {
	for (const backup of backups.reverse()) {
		if (backup.existed) {
			await fs.writeFile(backup.filePath, backup.content).catch(() => undefined)
		} else {
			await fs.rm(backup.filePath, { force: true }).catch(() => undefined)
		}
	}
}

export async function publishSiteConfigDraft(baseDir: string, draft: SiteConfigDraftPayload) {
	if (!draft || Object.keys(draft).length === 0) {
		throw new Error('没有可发布的草稿')
	}

	await assertSiteConfigDraftLocalAssetsExist(baseDir, draft)

	const configDir = path.join(baseDir, 'src/config')
	const writes = buildSiteConfigFormalWrites(draft)
	const touchedFormal: string[] = []
	const backups: SiteConfigFormalBackup[] = []

	try {
		for (const write of writes) {
			const filePath = path.join(configDir, write.fileName)
			backups.push(await readSiteConfigFormalBackup(filePath))
			await fs.writeFile(filePath, write.content)
			touchedFormal.push(write.fileName)
		}

		await clearSiteConfigDraft(baseDir)
		return touchedFormal
	} catch (error) {
		await rollbackSiteConfigFormalWrites(backups)
		throw error
	}
}

function collectSiteConfigDraftLocalAssets(draft: SiteConfigDraftPayload): LocalAssetReference[] {
	const siteContent = draft.siteContent as {
		artImages?: Array<{ url?: unknown }>
		backgroundImages?: Array<{ url?: unknown }>
		socialButtons?: Array<{ value?: unknown }>
	} | null

	if (!siteContent || typeof siteContent !== 'object') {
		return []
	}

	const assets: LocalAssetReference[] = []
	for (const image of siteContent.artImages ?? []) {
		if (typeof image.url === 'string') {
			assets.push({ label: '首页图片', url: image.url })
		}
	}
	for (const image of siteContent.backgroundImages ?? []) {
		if (typeof image.url === 'string') {
			assets.push({ label: '背景图片', url: image.url })
		}
	}
	for (const button of siteContent.socialButtons ?? []) {
		if (typeof button.value === 'string') {
			assets.push({ label: '社交按钮图片', url: button.value })
		}
	}

	return assets
}

function isProjectLocalAssetUrl(url: string) {
	return url.startsWith('/images/art/') || url.startsWith('/images/background/') || url.startsWith('/images/social-buttons/')
}

async function assertSiteConfigDraftLocalAssetsExist(baseDir: string, draft: SiteConfigDraftPayload) {
	for (const asset of collectSiteConfigDraftLocalAssets(draft)) {
		if (!isProjectLocalAssetUrl(asset.url)) {
			continue
		}

		const assetPath = path.join(baseDir, 'public', asset.url)
		try {
			const stat = await fs.stat(assetPath)
			if (!stat.isFile()) {
				throw new Error('not a file')
			}
		} catch {
			throw new Error(`草稿引用的本地资源不存在：${asset.label} ${asset.url}`)
		}
	}
}
