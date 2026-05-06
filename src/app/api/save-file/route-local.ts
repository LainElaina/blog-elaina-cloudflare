import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, extname, relative, resolve } from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isAllowedSaveFilePath } from './local-save-file-path.ts'

const MAX_FILE_CONTENT_SIZE = 10 * 1024 * 1024
const MAX_REQUEST_BODY_SIZE = MAX_FILE_CONTENT_SIZE + 1024 * 1024

function getContentLength(request: NextRequest) {
	const value = request.headers?.get('content-length')
	if (!value) return null
	const length = Number(value)
	return Number.isFinite(length) && length >= 0 ? length : null
}

function buildAtomicSaveTempPath(fullPath: string) {
	return `${fullPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function writeFileAtomically(fullPath: string, content: string) {
	const tempPath = buildAtomicSaveTempPath(fullPath)
	try {
		await writeFile(tempPath, content, 'utf-8')
		await rename(tempPath, fullPath)
	} catch (error) {
		await rm(tempPath, { force: true }).catch(() => undefined)
		throw error
	}
}

type JsonFileContentValidationResult = 'valid' | 'invalid-json' | 'invalid-shape'

const BLOG_ARTIFACT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHARE_STORAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CONTENT_STATUS_VALUES = new Set(['published', 'draft', 'archived'])

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isStringArray(value: unknown) {
	return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isFiniteNumber(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value)
}

function hasOptionalStringFields(value: Record<string, unknown>, fields: string[]) {
	return fields.every(field => !(field in value) || typeof value[field] === 'string')
}

function hasOptionalBooleanFields(value: Record<string, unknown>, fields: string[]) {
	return fields.every(field => !(field in value) || typeof value[field] === 'boolean')
}

function isSafeBlogArtifactSlug(slug: string) {
	return BLOG_ARTIFACT_SLUG_PATTERN.test(slug)
}

function isSafeShareStorageSlug(slug: string) {
	return SHARE_STORAGE_SLUG_PATTERN.test(slug)
}

function isCategoryConfig(value: unknown) {
	return isObject(value) && isStringArray(value.categories)
}

function isFolderNode(value: unknown): value is { name: string; path: string; children: unknown[] } {
	return isObject(value) && typeof value.name === 'string' && typeof value.path === 'string' && Array.isArray(value.children)
}

function isFolderNodeArray(value: unknown): value is unknown[] {
	return Array.isArray(value) && value.every(node => isFolderNode(node) && isFolderNodeArray(node.children))
}

function isBlogListItem(value: unknown, seenSlugs: Set<string>) {
	if (
		!isObject(value) ||
		typeof value.slug !== 'string' ||
		!isSafeBlogArtifactSlug(value.slug) ||
		seenSlugs.has(value.slug) ||
		typeof value.title !== 'string' ||
		!isStringArray(value.tags) ||
		typeof value.date !== 'string' ||
		!hasOptionalStringFields(value, ['summary', 'cover', 'category', 'folder', 'folderPath']) ||
		!hasOptionalBooleanFields(value, ['hidden', 'favorite'])
	) {
		return false
	}

	seenSlugs.add(value.slug)
	return true
}

function isBlogIndexConfig(value: unknown) {
	if (!Array.isArray(value)) {
		return false
	}

	const seenSlugs = new Set<string>()
	return value.every(item => isBlogListItem(item, seenSlugs))
}

function isBlogStorageConfig(value: unknown) {
	if (!isObject(value) || value.version !== 1 || typeof value.updatedAt !== 'string' || !isObject(value.blogs)) {
		return false
	}

	return Object.entries(value.blogs).every(([slug, record]) => {
		return (
			isSafeBlogArtifactSlug(slug) &&
			isObject(record) &&
			record.slug === slug &&
			typeof record.title === 'string' &&
			isStringArray(record.tags) &&
			typeof record.date === 'string' &&
			typeof record.status === 'string' &&
			CONTENT_STATUS_VALUES.has(record.status) &&
			hasOptionalStringFields(record, ['summary', 'cover', 'category', 'folder', 'folderPath']) &&
			hasOptionalBooleanFields(record, ['hidden', 'favorite'])
		)
	})
}

function isBlogPostConfig(value: unknown) {
	return (
		isObject(value) &&
		typeof value.title === 'string' &&
		isStringArray(value.tags) &&
		typeof value.date === 'string' &&
		hasOptionalStringFields(value, ['summary', 'cover', 'category', 'folderPath']) &&
		hasOptionalBooleanFields(value, ['hidden', 'favorite'])
	)
}

function isShareListItem(value: unknown) {
	return (
		isObject(value) &&
		typeof value.name === 'string' &&
		typeof value.logo === 'string' &&
		typeof value.url === 'string' &&
		typeof value.description === 'string' &&
		isStringArray(value.tags) &&
		isFiniteNumber(value.stars) &&
		hasOptionalStringFields(value, ['category', 'folder', 'folderPath'])
	)
}

function isShareListConfig(value: unknown) {
	return Array.isArray(value) && value.every(isShareListItem)
}

function isShareStorageConfig(value: unknown) {
	if (!isObject(value) || value.version !== 1 || typeof value.updatedAt !== 'string' || !isObject(value.shares)) {
		return false
	}

	return Object.entries(value.shares).every(([slug, record]) => {
		return (
			isSafeShareStorageSlug(slug) &&
			isObject(record) &&
			record.slug === slug &&
			typeof record.status === 'string' &&
			CONTENT_STATUS_VALUES.has(record.status) &&
			isShareListItem(record)
		)
	})
}

function isAboutConfig(value: unknown) {
	return isObject(value) && typeof value.title === 'string' && typeof value.description === 'string' && typeof value.content === 'string'
}

function isBloggerListConfig(value: unknown) {
	return (
		Array.isArray(value) &&
		value.every(
			item =>
				isObject(item) &&
				typeof item.name === 'string' &&
				typeof item.avatar === 'string' &&
				typeof item.url === 'string' &&
				typeof item.description === 'string' &&
				isFiniteNumber(item.stars) &&
				hasOptionalStringFields(item, ['status'])
		)
	)
}

function isPictureListConfig(value: unknown) {
	return (
		Array.isArray(value) &&
		value.every(
			item =>
				isObject(item) &&
				typeof item.id === 'string' &&
				typeof item.uploadedAt === 'string' &&
				hasOptionalStringFields(item, ['description', 'image']) &&
				(!('images' in item) || isStringArray(item.images))
		)
	)
}

function isProjectListConfig(value: unknown) {
	return (
		Array.isArray(value) &&
		value.every(
			item =>
				isObject(item) &&
				typeof item.name === 'string' &&
				isFiniteNumber(item.year) &&
				typeof item.description === 'string' &&
				typeof item.image === 'string' &&
				typeof item.url === 'string' &&
				isStringArray(item.tags) &&
				hasOptionalStringFields(item, ['github', 'npm'])
		)
	)
}

function isJsonFileShapeValid(projectDir: string, fullPath: string, parsed: unknown) {
	const relativePath = relative(projectDir, fullPath).replace(/\\/g, '/')

	switch (relativePath) {
		case 'src/app/about/list.json':
			return isAboutConfig(parsed)
		case 'src/app/bloggers/list.json':
			return isBloggerListConfig(parsed)
		case 'src/app/pictures/list.json':
			return isPictureListConfig(parsed)
		case 'src/app/projects/list.json':
			return isProjectListConfig(parsed)
		case 'src/app/snippets/list.json':
			return isStringArray(parsed)
		case 'public/blogs/index.json':
			return isBlogIndexConfig(parsed)
		case 'public/blogs/categories.json':
		case 'public/share/categories.json':
			return isCategoryConfig(parsed)
		case 'public/blogs/folders.json':
		case 'public/share/folders.json':
			return isFolderNodeArray(parsed)
		case 'public/blogs/storage.json':
			return isBlogStorageConfig(parsed)
		case 'public/share/list.json':
			return isShareListConfig(parsed)
		case 'public/share/storage.json':
			return isShareStorageConfig(parsed)
		default:
			return /^public\/blogs\/[^/]+\/config\.json$/.test(relativePath) && isBlogPostConfig(parsed)
	}
}

function validateJsonFileContent(projectDir: string, fullPath: string, content: string): JsonFileContentValidationResult {
	if (extname(fullPath) !== '.json') {
		return 'valid'
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		return 'invalid-json'
	}

	return isJsonFileShapeValid(projectDir, fullPath, parsed) ? 'valid' : 'invalid-shape'
}

export async function handleSaveFile(request: NextRequest) {
	try {
		const contentLength = getContentLength(request)
		if (contentLength !== null && contentLength > MAX_REQUEST_BODY_SIZE) {
			return NextResponse.json({ error: '文件内容超过 10MB 限制' }, { status: 413 })
		}

		let body: unknown
		try {
			body = await request.json()
		} catch {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		const { path: filePath, content } = body as Record<string, unknown>

		if (!filePath || typeof filePath !== 'string' || typeof content !== 'string') {
			return NextResponse.json({ error: '缺少文件路径或内容' }, { status: 400 })
		}

		if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_CONTENT_SIZE) {
			return NextResponse.json({ error: '文件内容超过 10MB 限制' }, { status: 413 })
		}

		const projectDir = resolve(process.cwd())
		const fullPath = resolve(process.cwd(), filePath)

		if (!isAllowedSaveFilePath(projectDir, fullPath)) {
			return NextResponse.json({ error: '路径不合法' }, { status: 403 })
		}

		const jsonValidation = validateJsonFileContent(projectDir, fullPath, content)
		if (jsonValidation === 'invalid-json') {
			return NextResponse.json({ error: 'JSON 内容格式错误' }, { status: 400 })
		}
		if (jsonValidation === 'invalid-shape') {
			return NextResponse.json({ error: 'JSON 内容结构错误' }, { status: 400 })
		}

		const dir = dirname(fullPath)
		await mkdir(dir, { recursive: true })

		await writeFileAtomically(fullPath, content)
		return NextResponse.json({ success: true })
	} catch (error: any) {
		console.error('Save file error:', error)
		return NextResponse.json({ error: '保存失败' }, { status: 500 })
	}
}
