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

type SiteContentWithSocialButtons = {
	socialButtons?: unknown
}

function buildAtomicSiteConfigTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function writeSiteConfigFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicSiteConfigTempPath(fullPath)
	try {
		await fs.writeFile(tempPath, content)
		await fs.rename(tempPath, fullPath)
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

const DRAFT_FILE_RELATIVE_PATH = path.join('data', 'site-config.draft.json')
const SITE_CONFIG_DRAFT_KEYS = ['siteContent', 'cardStyles', 'customComponents', 'colorPresets'] as const
const ART_IMAGE_PUBLIC_PREFIX = '/images/art/'
const ART_IMAGE_REPO_PREFIX = 'public/images/art/'
const BACKGROUND_IMAGE_PUBLIC_PREFIX = '/images/background/'
const BACKGROUND_IMAGE_REPO_PREFIX = 'public/images/background/'
const SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX = '/images/social-buttons/'
const SOCIAL_BUTTON_IMAGE_REPO_PREFIX = 'public/images/social-buttons/'
const SITE_CONFIG_LOCAL_ASSET_PREFIXES = [
	{ publicPrefix: ART_IMAGE_PUBLIC_PREFIX, repoPrefix: ART_IMAGE_REPO_PREFIX },
	{ publicPrefix: BACKGROUND_IMAGE_PUBLIC_PREFIX, repoPrefix: BACKGROUND_IMAGE_REPO_PREFIX },
	{ publicPrefix: SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX, repoPrefix: SOCIAL_BUTTON_IMAGE_REPO_PREFIX }
] as const

export function resolveSiteConfigDraftPath(baseDir: string) {
	return path.join(baseDir, DRAFT_FILE_RELATIVE_PATH)
}

function pickSiteConfigDraftPayload(payload: SiteConfigDraftPayload | null | undefined): SiteConfigDraftPayload {
	const picked: SiteConfigDraftPayload = {}
	if (!payload || typeof payload !== 'object') {
		return picked
	}

	for (const key of SITE_CONFIG_DRAFT_KEYS) {
		if (Object.prototype.hasOwnProperty.call(payload, key)) {
			picked[key] = payload[key]
		}
	}
	return picked
}

function hasSiteConfigDraftPayload(payload: SiteConfigDraftPayload) {
	return SITE_CONFIG_DRAFT_KEYS.some(key => payload[key] !== undefined && payload[key] !== null)
}

function parseSiteConfigDraftRaw(raw: string): SiteConfigDraftPayload {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new Error('站点配置草稿解析失败，请修复 data/site-config.draft.json 后重试')
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('站点配置草稿格式错误，请修复 data/site-config.draft.json 后重试')
	}

	return pickSiteConfigDraftPayload(parsed as SiteConfigDraftPayload)
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
		current = parseSiteConfigDraftRaw(await fs.readFile(draftPath, 'utf-8'))
	} catch (error) {
		if (!isFileNotFoundError(error)) {
			throw error
		}
	}

	const merged: SiteConfigDraftPayload = { ...current, ...pickSiteConfigDraftPayload(payload) }
	for (const key of SITE_CONFIG_DRAFT_KEYS) {
		if (merged[key] === null) {
			delete merged[key]
		}
	}

	if (!hasSiteConfigDraftPayload(merged)) {
		await fs.rm(draftPath, { force: true })
		return merged
	}

	await writeSiteConfigFileAtomically(draftPath, JSON.stringify(merged, null, '\t'))

	return merged
}

export async function readSiteConfigDraft(baseDir: string): Promise<SiteConfigDraftPayload | null> {
	try {
		const draft = parseSiteConfigDraftRaw(await fs.readFile(resolveSiteConfigDraftPath(baseDir), 'utf-8'))
		return hasSiteConfigDraftPayload(draft) ? draft : null
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	}
}

export async function clearSiteConfigDraft(baseDir: string) {
	await fs.rm(resolveSiteConfigDraftPath(baseDir), { force: true })
}

export async function canPublishSiteConfigDraft(baseDir: string) {
	const draft = await readSiteConfigDraft(baseDir)
	return draft !== null && hasSiteConfigDraftPayload(draft)
}

export async function resolveSiteConfigPublishPayload(baseDir: string, payload: SiteConfigDraftPayload) {
	const pickedPayload = pickSiteConfigDraftPayload(payload)
	if (hasSiteConfigDraftPayload(pickedPayload)) {
		return pickedPayload
	}

	const draft = await readSiteConfigDraft(baseDir)
	if (!draft || !hasSiteConfigDraftPayload(draft)) {
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

function singleFileAssetRepoPath(publicPath: string, publicPrefix: string, repoPrefix: string): string | null {
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

function hasProjectLocalAssetPrefix(publicPath: string) {
	return SITE_CONFIG_LOCAL_ASSET_PREFIXES.some(({ publicPrefix }) => publicPath.startsWith(publicPrefix))
}

function projectLocalAssetRepoPath(publicPath: string): string | null {
	for (const { publicPrefix, repoPrefix } of SITE_CONFIG_LOCAL_ASSET_PREFIXES) {
		const repoPath = singleFileAssetRepoPath(publicPath, publicPrefix, repoPrefix)
		if (repoPath) {
			return repoPath
		}
	}
	return null
}

function socialButtonImageRepoPath(publicPath: string): string | null {
	return singleFileAssetRepoPath(publicPath, SOCIAL_BUTTON_IMAGE_PUBLIC_PREFIX, SOCIAL_BUTTON_IMAGE_REPO_PREFIX)
}

function iterableSiteConfigCollection(value: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(value)) {
		return value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>>
	}
	if (value && typeof value === 'object') {
		return Object.values(value).filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Array<Record<string, unknown>>
	}
	return []
}

function collectSocialButtonImageRepoPaths(siteContent: SiteContentWithSocialButtons | null | undefined): Set<string> {
	const paths = new Set<string>()
	for (const button of iterableSiteConfigCollection(siteContent?.socialButtons)) {
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

export function buildRemovedSiteConfigSocialButtonImagePaths(originalSiteContent: SiteContentWithSocialButtons | null | undefined, currentSiteContent: SiteContentWithSocialButtons | null | undefined): string[] {
	const currentPaths = collectSocialButtonImageRepoPaths(currentSiteContent)
	const paths: string[] = []

	for (const originalPath of collectSocialButtonImageRepoPaths(originalSiteContent)) {
		if (!currentPaths.has(originalPath)) {
			paths.push(originalPath)
		}
	}

	return paths
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
			await writeSiteConfigFileAtomically(backup.filePath, backup.content).catch(() => undefined)
		} else {
			await fs.rm(backup.filePath, { force: true }).catch(() => undefined)
		}
	}
}

async function readFormalSiteContent(baseDir: string): Promise<SiteContentWithSocialButtons | null> {
	try {
		const raw = await fs.readFile(path.join(baseDir, 'src/config/site-content.json'), 'utf-8')
		return JSON.parse(raw) as SiteContentWithSocialButtons
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	}
}

async function deleteSiteConfigSocialButtonImages(baseDir: string, paths: string[]) {
	for (const imagePath of paths) {
		if (!imagePath.startsWith(SOCIAL_BUTTON_IMAGE_REPO_PREFIX)) {
			continue
		}
		await fs.rm(path.join(baseDir, imagePath), { force: true }).catch(error => {
			console.warn('删除旧社交按钮图片失败:', error)
		})
	}
}

export async function publishSiteConfigDraft(baseDir: string, draft: SiteConfigDraftPayload) {
	if (!draft || Object.keys(draft).length === 0) {
		throw new Error('没有可发布的草稿')
	}

	await assertSiteConfigDraftLocalAssetsExist(baseDir, draft)

	const originalSiteContent = draft.siteContent ? await readFormalSiteContent(baseDir) : null
	const removedSocialButtonImagePaths = buildRemovedSiteConfigSocialButtonImagePaths(
		originalSiteContent,
		draft.siteContent as SiteContentWithSocialButtons | null | undefined
	)
	const configDir = path.join(baseDir, 'src/config')
	const writes = buildSiteConfigFormalWrites(draft)
	if (writes.length === 0) {
		throw new Error('没有可发布的草稿')
	}
	const touchedFormal: string[] = []
	const backups: SiteConfigFormalBackup[] = []

	try {
		for (const write of writes) {
			const filePath = path.join(configDir, write.fileName)
			backups.push(await readSiteConfigFormalBackup(filePath))
			await writeSiteConfigFileAtomically(filePath, write.content)
			touchedFormal.push(write.fileName)
		}

		await clearSiteConfigDraft(baseDir)
	} catch (error) {
		await rollbackSiteConfigFormalWrites(backups)
		throw error
	}

	await deleteSiteConfigSocialButtonImages(baseDir, removedSocialButtonImagePaths)
	return touchedFormal
}

function collectSiteConfigDraftLocalAssets(draft: SiteConfigDraftPayload): LocalAssetReference[] {
	const siteContent = draft.siteContent as {
		artImages?: unknown
		backgroundImages?: unknown
		socialButtons?: unknown
	} | null

	if (!siteContent || typeof siteContent !== 'object') {
		return []
	}

	const assets: LocalAssetReference[] = []
	for (const image of iterableSiteConfigCollection(siteContent.artImages)) {
		if (typeof image.url === 'string') {
			assets.push({ label: '首页图片', url: image.url })
		}
	}
	for (const image of iterableSiteConfigCollection(siteContent.backgroundImages)) {
		if (typeof image.url === 'string') {
			assets.push({ label: '背景图片', url: image.url })
		}
	}
	for (const button of iterableSiteConfigCollection(siteContent.socialButtons)) {
		if (typeof button.value === 'string') {
			assets.push({ label: '社交按钮图片', url: button.value })
		}
	}

	return assets
}

async function assertSiteConfigDraftLocalAssetsExist(baseDir: string, draft: SiteConfigDraftPayload) {
	for (const asset of collectSiteConfigDraftLocalAssets(draft)) {
		const repoPath = projectLocalAssetRepoPath(asset.url)
		if (!repoPath) {
			if (hasProjectLocalAssetPrefix(asset.url)) {
				throw new Error(`草稿引用的本地资源不存在：${asset.label} ${asset.url}`)
			}
			continue
		}

		const assetPath = path.join(baseDir, repoPath)
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
