import fs from 'node:fs/promises'
import path from 'node:path'
import { isValidLayoutConfig } from './layout/layout-config-validation.ts'
import { withLocalContentMutationLock } from './local-content-mutation-lock.ts'

export type SiteConfigDraftPayload = {
	siteContent?: unknown
	cardStyles?: unknown
	customComponents?: unknown
	colorPresets?: unknown
}

export class SiteConfigLocalValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SiteConfigLocalValidationError'
	}
}

export class SiteConfigLocalWriteError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SiteConfigLocalWriteError'
	}
}

export function isSiteConfigLocalValidationError(error: unknown) {
	return error instanceof SiteConfigLocalValidationError
}

export function isSiteConfigLocalWriteError(error: unknown) {
	return error instanceof SiteConfigLocalWriteError
}

type LocalAssetReference = {
	label: string
	url: string
}

type SiteContentWithSocialButtons = {
	socialButtons?: unknown
}

export async function withSiteConfigLocalMutationLock<T>(baseDir: string, callback: () => Promise<T>): Promise<T> {
	return withLocalContentMutationLock(baseDir, 'site-config', callback)
}

function isPathInsideDirectory(baseDir: string, fullPath: string) {
	const relativePath = path.relative(path.resolve(baseDir), path.resolve(fullPath))
	return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

async function findExistingAncestorDirectory(dir: string): Promise<string> {
	try {
		await fs.realpath(dir)
		return dir
	} catch (error) {
		if (!isFileNotFoundError(error)) {
			throw error
		}
	}

	const parentDir = path.dirname(dir)
	if (parentDir === dir) {
		return dir
	}
	return findExistingAncestorDirectory(parentDir)
}

export async function assertSafeSiteConfigProjectPath(baseDir: string, fullPath: string) {
	const projectDir = path.resolve(baseDir)
	const targetPath = path.resolve(fullPath)
	if (!isPathInsideDirectory(projectDir, targetPath)) {
		throw new SiteConfigLocalValidationError('站点配置写入路径不合法')
	}

	const existingAncestor = await findExistingAncestorDirectory(path.dirname(targetPath))
	const existingAncestorPath = path.resolve(existingAncestor)
	const realProjectDir = await fs.realpath(projectDir)
	const realAncestor = await fs.realpath(existingAncestor)
	const relativeAncestor = path.relative(projectDir, existingAncestorPath)
	const expectedRealAncestor = path.resolve(realProjectDir, relativeAncestor)
	if (!isPathInsideDirectory(realProjectDir, realAncestor) || realAncestor !== expectedRealAncestor) {
		throw new SiteConfigLocalValidationError('站点配置写入路径不合法')
	}

	const targetStats = await fs.lstat(targetPath).catch(error => {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	})
	if (targetStats !== null && !targetStats.isFile()) {
		throw new SiteConfigLocalValidationError('站点配置写入路径不合法')
	}
}

function buildAtomicSiteConfigTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function writeSiteConfigFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicSiteConfigTempPath(fullPath)
	try {
		await fs.writeFile(tempPath, content, { flag: 'wx' })
		await fs.rename(tempPath, fullPath)
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

const DRAFT_FILE_RELATIVE_PATH = path.join('data', 'site-config.draft.json')
const SITE_CONFIG_DRAFT_KEYS = ['siteContent', 'cardStyles', 'customComponents', 'colorPresets'] as const
type SiteConfigDraftKey = typeof SITE_CONFIG_DRAFT_KEYS[number]
const SITE_CONFIG_DRAFT_VALUE_LABELS: Record<SiteConfigDraftKey, string> = {
	siteContent: '站点设置',
	cardStyles: '卡片布局',
	customComponents: '自定义组件',
	colorPresets: '色彩预设'
}
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

function isSiteConfigObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertSiteConfigDraftValueShape(key: SiteConfigDraftKey, value: unknown) {
	if (value === undefined || value === null) {
		return
	}

	const label = SITE_CONFIG_DRAFT_VALUE_LABELS[key]
	if (key === 'siteContent' && !isSiteConfigObject(value)) {
		throw new SiteConfigLocalValidationError(`${label}草稿格式错误`)
	}
	if (key === 'cardStyles' && !isValidLayoutConfig(value)) {
		throw new SiteConfigLocalValidationError(`${label}草稿格式错误`)
	}
	if ((key === 'customComponents' || key === 'colorPresets') && !Array.isArray(value)) {
		throw new SiteConfigLocalValidationError(`${label}草稿格式错误`)
	}
}

function pickSiteConfigDraftPayload(payload: SiteConfigDraftPayload | null | undefined): SiteConfigDraftPayload {
	const picked: SiteConfigDraftPayload = {}
	if (!payload || typeof payload !== 'object') {
		return picked
	}

	for (const key of SITE_CONFIG_DRAFT_KEYS) {
		if (Object.prototype.hasOwnProperty.call(payload, key)) {
			const value = payload[key]
			assertSiteConfigDraftValueShape(key, value)
			picked[key] = value
		}
	}
	return picked
}

function hasSiteConfigDraftPayload(payload: SiteConfigDraftPayload) {
	return SITE_CONFIG_DRAFT_KEYS.some(key => payload[key] !== undefined && payload[key] !== null)
}

function getSiteConfigDraftPayloadKeys(payload: SiteConfigDraftPayload) {
	return SITE_CONFIG_DRAFT_KEYS.filter(key => payload[key] !== undefined && payload[key] !== null)
}

function parseSiteConfigDraftRaw(raw: string): SiteConfigDraftPayload {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new SiteConfigLocalValidationError('站点配置草稿解析失败，请修复 data/site-config.draft.json 后重试')
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new SiteConfigLocalValidationError('站点配置草稿格式错误，请修复 data/site-config.draft.json 后重试')
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

async function writeSiteConfigDraftUnlocked(baseDir: string, payload: SiteConfigDraftPayload) {
	const draftPath = resolveSiteConfigDraftPath(baseDir)
	await assertSafeSiteConfigProjectPath(baseDir, draftPath)
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
		try {
			await fs.rm(draftPath, { force: true })
		} catch (error) {
			const details = error instanceof Error ? error.message : String(error)
			throw new SiteConfigLocalWriteError(`清除站点配置草稿失败：${details}`)
		}
		return merged
	}

	await writeSiteConfigFileAtomically(draftPath, JSON.stringify(merged, null, '\t'))

	return merged
}

export async function writeSiteConfigDraft(baseDir: string, payload: SiteConfigDraftPayload) {
	return withSiteConfigLocalMutationLock(baseDir, () => writeSiteConfigDraftUnlocked(baseDir, payload))
}

export async function readSiteConfigDraft(baseDir: string): Promise<SiteConfigDraftPayload | null> {
	const draftPath = resolveSiteConfigDraftPath(baseDir)
	await assertSafeSiteConfigProjectPath(baseDir, draftPath)
	try {
		const draft = parseSiteConfigDraftRaw(await fs.readFile(draftPath, 'utf-8'))
		return hasSiteConfigDraftPayload(draft) ? draft : null
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	}
}

export async function clearSiteConfigDraft(baseDir: string) {
	return withSiteConfigLocalMutationLock(baseDir, async () => {
		const draftPath = resolveSiteConfigDraftPath(baseDir)
		await assertSafeSiteConfigProjectPath(baseDir, draftPath)
		await fs.rm(draftPath, { force: true })
	})
}

async function clearPublishedSiteConfigDraftKeys(baseDir: string, publishedKeys: SiteConfigDraftKey[]) {
	if (publishedKeys.length === 0) {
		return
	}

	const draftPath = resolveSiteConfigDraftPath(baseDir)
	await assertSafeSiteConfigProjectPath(baseDir, draftPath)
	let current: SiteConfigDraftPayload
	try {
		current = parseSiteConfigDraftRaw(await fs.readFile(draftPath, 'utf-8'))
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return
		}
		throw error
	}

	for (const key of publishedKeys) {
		delete current[key]
	}

	if (!hasSiteConfigDraftPayload(current)) {
		await fs.rm(draftPath, { force: true })
		return
	}

	await writeSiteConfigFileAtomically(draftPath, JSON.stringify(current, null, '\t'))
}

export async function canPublishSiteConfigDraft(baseDir: string) {
	const draft = await readSiteConfigDraft(baseDir)
	return draft !== null && hasSiteConfigDraftPayload(draft)
}

export async function resolveSiteConfigPublishPayload(baseDir: string, payload: SiteConfigDraftPayload) {
	const requestKeys = Object.keys(payload as Record<string, unknown>)
	const unsupportedKey = requestKeys.find(key => !SITE_CONFIG_DRAFT_KEYS.includes(key as SiteConfigDraftKey))
	if (unsupportedKey) {
		throw new SiteConfigLocalValidationError(`站点配置发布请求包含不支持的字段：${unsupportedKey}`)
	}

	const pickedPayload = pickSiteConfigDraftPayload(payload)
	if (hasSiteConfigDraftPayload(pickedPayload)) {
		return pickedPayload
	}
	if (requestKeys.length > 0) {
		throw new SiteConfigLocalValidationError('没有可发布的草稿')
	}

	const draft = await readSiteConfigDraft(baseDir)
	if (!draft || !hasSiteConfigDraftPayload(draft)) {
		throw new SiteConfigLocalValidationError('没有可发布的草稿')
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

type SiteConfigPublishError = Error & {
	touchedFormalPartial?: string[]
	rollbackFailedFormal?: string[]
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
	return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
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
	const rollbackFailedFormal: string[] = []
	for (const backup of backups.reverse()) {
		try {
			if (backup.existed) {
				await writeSiteConfigFileAtomically(backup.filePath, backup.content)
			} else {
				await fs.rm(backup.filePath, { force: true })
			}
		} catch {
			rollbackFailedFormal.push(path.basename(backup.filePath))
		}
	}
	return rollbackFailedFormal
}

async function readFormalSiteContent(baseDir: string): Promise<SiteContentWithSocialButtons | null> {
	const siteContentPath = path.join(baseDir, 'src/config/site-content.json')
	await assertSafeSiteConfigProjectPath(baseDir, siteContentPath)
	try {
		const raw = await fs.readFile(siteContentPath, 'utf-8')
		return JSON.parse(raw) as SiteContentWithSocialButtons
	} catch (error) {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	}
}

function getSocialButtonImageDeleteFilename(imagePath: string): string | null {
	if (!imagePath.startsWith(SOCIAL_BUTTON_IMAGE_REPO_PREFIX)) {
		return null
	}
	const filename = imagePath.slice(SOCIAL_BUTTON_IMAGE_REPO_PREFIX.length)
	if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
		return null
	}
	return filename
}

function isDirectChildPath(parentDir: string, fullPath: string) {
	const relative = path.relative(parentDir, fullPath)
	return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative) && !relative.includes(path.sep)
}

async function resolveSafeSocialButtonImageDeletePath(baseDir: string, imagePath: string): Promise<string | null> {
	const filename = getSocialButtonImageDeleteFilename(imagePath)
	if (!filename) {
		return null
	}

	const baseRealPath = await fs.realpath(baseDir)
	const imageDir = path.resolve(baseRealPath, SOCIAL_BUTTON_IMAGE_REPO_PREFIX)
	const imageDirStats = await fs.lstat(imageDir).catch(error => {
		if (isFileNotFoundError(error)) {
			return null
		}
		throw error
	})
	if (imageDirStats === null) {
		return null
	}
	if (!imageDirStats.isDirectory()) {
		throw new Error('旧社交按钮图片目录不是普通目录')
	}
	if ((await fs.realpath(imageDir)) !== imageDir) {
		throw new Error('旧社交按钮图片目录不能通过符号链接清理')
	}

	const fullPath = path.resolve(imageDir, filename)
	return isDirectChildPath(imageDir, fullPath) ? fullPath : null
}

async function deleteSiteConfigSocialButtonImages(baseDir: string, paths: string[]) {
	for (const imagePath of paths) {
		try {
			const fullPath = await resolveSafeSocialButtonImageDeletePath(baseDir, imagePath)
			if (!fullPath) {
				continue
			}

			const fileStats = await fs.lstat(fullPath).catch(error => {
				if (isFileNotFoundError(error)) {
					return null
				}
				throw error
			})
			if (fileStats === null) {
				continue
			}
			if (!fileStats.isFile()) {
				throw new Error('旧社交按钮图片不是普通文件')
			}

			await fs.unlink(fullPath).catch(error => {
				if (!isFileNotFoundError(error)) {
					throw error
				}
			})
		} catch (error) {
			console.warn('删除旧社交按钮图片失败:', error)
		}
	}
}

async function publishSiteConfigDraftUnlocked(baseDir: string, draft: SiteConfigDraftPayload) {
	if (!draft || Object.keys(draft).length === 0) {
		throw new SiteConfigLocalValidationError('没有可发布的草稿')
	}

	const configDir = path.join(baseDir, 'src/config')
	const writes = buildSiteConfigFormalWrites(draft)
	const publishedKeys = getSiteConfigDraftPayloadKeys(draft)
	if (writes.length === 0) {
		throw new SiteConfigLocalValidationError('没有可发布的草稿')
	}
	for (const write of writes) {
		await assertSafeSiteConfigProjectPath(baseDir, path.join(configDir, write.fileName))
	}

	await assertSiteConfigDraftLocalAssetsExist(baseDir, draft)

	const originalSiteContent = draft.siteContent ? await readFormalSiteContent(baseDir) : null
	const removedSocialButtonImagePaths = buildRemovedSiteConfigSocialButtonImagePaths(
		originalSiteContent,
		draft.siteContent as SiteContentWithSocialButtons | null | undefined
	)
	const touchedFormal: string[] = []
	const backups: SiteConfigFormalBackup[] = []

	try {
		for (const write of writes) {
			const filePath = path.join(configDir, write.fileName)
			await assertSafeSiteConfigProjectPath(baseDir, filePath)
			backups.push(await readSiteConfigFormalBackup(filePath))
			await writeSiteConfigFileAtomically(filePath, write.content)
			touchedFormal.push(write.fileName)
		}

		await clearPublishedSiteConfigDraftKeys(baseDir, publishedKeys)
	} catch (error) {
		const rollbackFailedFormal = await rollbackSiteConfigFormalWrites(backups.slice(0, touchedFormal.length))
		if (error instanceof Error) {
			;(error as SiteConfigPublishError).touchedFormalPartial = [...touchedFormal]
			if (rollbackFailedFormal.length > 0) {
				;(error as SiteConfigPublishError).rollbackFailedFormal = rollbackFailedFormal
			}
		}
		throw error
	}

	await deleteSiteConfigSocialButtonImages(baseDir, removedSocialButtonImagePaths)
	return touchedFormal
}

export async function publishSiteConfigDraft(baseDir: string, draft: SiteConfigDraftPayload) {
	return withSiteConfigLocalMutationLock(baseDir, () => publishSiteConfigDraftUnlocked(baseDir, draft))
}

export async function publishResolvedSiteConfigDraft(baseDir: string, payload: SiteConfigDraftPayload) {
	return withSiteConfigLocalMutationLock(baseDir, async () => {
		const publishPayload = await resolveSiteConfigPublishPayload(baseDir, payload)
		return publishSiteConfigDraftUnlocked(baseDir, publishPayload)
	})
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

export async function assertSiteConfigDraftLocalAssetsExist(baseDir: string, draft: SiteConfigDraftPayload) {
	for (const asset of collectSiteConfigDraftLocalAssets(draft)) {
		const repoPath = projectLocalAssetRepoPath(asset.url)
		if (!repoPath) {
			if (hasProjectLocalAssetPrefix(asset.url)) {
				throw new SiteConfigLocalValidationError(`草稿引用的本地资源不存在：${asset.label} ${asset.url}`)
			}
			continue
		}

		const assetPath = path.join(baseDir, repoPath)
		const assetDir = path.dirname(assetPath)
		const [assetDirStats, assetStats] = await Promise.all([
			fs.lstat(assetDir).catch(error => {
				if (isFileNotFoundError(error)) {
					throw new SiteConfigLocalValidationError(`草稿引用的本地资源不存在：${asset.label} ${asset.url}`)
				}
				throw error
			}),
			fs.lstat(assetPath).catch(error => {
				if (isFileNotFoundError(error)) {
					throw new SiteConfigLocalValidationError(`草稿引用的本地资源不存在：${asset.label} ${asset.url}`)
				}
				throw error
			})
		])
		if (!assetDirStats.isDirectory() || (await fs.realpath(assetDir)) !== assetDir || !assetStats.isFile()) {
			throw new SiteConfigLocalValidationError(`草稿引用的本地资源不存在：${asset.label} ${asset.url}`)
		}
	}
}
