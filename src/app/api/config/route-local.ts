import fs from 'fs/promises'
import path from 'path'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getLimitedJsonRequestErrorStatus, isJsonRequestBodyTooLargeError, readLimitedJsonRequest } from '../limited-json-request.ts'
import { isValidLayoutConfig } from '../layout/layout-config-validation.ts'
import { assertSafeSiteConfigProjectPath, assertSiteConfigDraftLocalAssetsExist, isSiteConfigLocalValidationError, withSiteConfigLocalMutationLock, writeSiteConfigFileAtomically } from '../site-config-local-shared.ts'

const SITE_CONFIG_REQUEST_MAX_BYTES = 1024 * 1024

const CARD_STYLES_FILE_NAME = 'card-styles.json'
function resolveLayoutBackupPath() {
	return path.join(process.cwd(), 'data/layout.bak.json')
}
const CONFIG_WRITE_KEYS = new Set(['siteContent', 'cardStyles', 'customComponents', 'colorPresets'])

type ConfigWrite = {
	fileName: string
	content: string
}

type ConfigBackup = {
	filePath: string
	existed: boolean
	content: string
}

type ConfigWriteError = Error & {
	touchedConfigPartial?: string[]
	rollbackFailedConfig?: string[]
}

function isFileNotFoundError(error: unknown) {
	return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

async function readConfigBackup(filePath: string): Promise<ConfigBackup> {
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

async function rollbackConfigWrites(backups: ConfigBackup[]) {
	const rollbackFailedConfig: string[] = []

	for (const backup of backups.reverse()) {
		try {
			if (backup.existed) {
				await writeSiteConfigFileAtomically(backup.filePath, backup.content)
			} else {
				await fs.rm(backup.filePath, { force: true })
			}
		} catch {
			rollbackFailedConfig.push(path.basename(backup.filePath))
		}
	}

	return rollbackFailedConfig
}

function hasOnlyConfigWriteKeys(payload: Record<string, unknown>) {
	return Object.keys(payload).every(key => CONFIG_WRITE_KEYS.has(key))
}

type ConfigWritePayload = {
	siteContent?: unknown
	cardStyles?: unknown
	customComponents?: unknown
	colorPresets?: unknown
}

function isConfigObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function assertConfigPayloadShape(payload: ConfigWritePayload) {
	if (payload.siteContent !== undefined && !isConfigObject(payload.siteContent)) {
		return NextResponse.json({ error: '站点设置配置格式错误' }, { status: 400 })
	}
	if (payload.cardStyles !== undefined && !isValidLayoutConfig(payload.cardStyles)) {
		return NextResponse.json({ error: '卡片布局配置格式错误' }, { status: 400 })
	}
	if (payload.customComponents !== undefined && !Array.isArray(payload.customComponents)) {
		return NextResponse.json({ error: '自定义组件配置格式错误' }, { status: 400 })
	}
	if (payload.colorPresets !== undefined && !Array.isArray(payload.colorPresets)) {
		return NextResponse.json({ error: '色彩预设配置格式错误' }, { status: 400 })
	}
	return null
}

function buildConfigWrites(payload: ConfigWritePayload): ConfigWrite[] {
	const writes: ConfigWrite[] = []
	if (payload.siteContent) {
		writes.push({ fileName: 'site-content.json', content: JSON.stringify(payload.siteContent, null, '\t') })
	}
	if (payload.cardStyles) {
		writes.push({ fileName: CARD_STYLES_FILE_NAME, content: JSON.stringify(payload.cardStyles, null, '\t') })
	}
	if (payload.customComponents !== undefined) {
		writes.push({ fileName: 'custom-components.json', content: JSON.stringify(payload.customComponents, null, '\t') })
	}
	if (payload.colorPresets !== undefined) {
		writes.push({ fileName: 'color-presets.json', content: JSON.stringify(payload.colorPresets, null, '\t') })
	}
	return writes
}

function getConfigWriteErrorDetails(error: unknown) {
	const touchedConfigPartial = error && typeof error === 'object' && 'touchedConfigPartial' in error && Array.isArray(error.touchedConfigPartial)
		? error.touchedConfigPartial.filter(fileName => typeof fileName === 'string')
		: []
	const rollbackFailedConfig = error && typeof error === 'object' && 'rollbackFailedConfig' in error && Array.isArray(error.rollbackFailedConfig)
		? error.rollbackFailedConfig.filter(fileName => typeof fileName === 'string')
		: []

	return {
		touchedConfigPartial,
		rollbackFailedConfig
	}
}

function buildConfigWriteFailureBody(error: unknown) {
	const { touchedConfigPartial, rollbackFailedConfig } = getConfigWriteErrorDetails(error)
	return {
		error: '保存站点配置失败',
		...(touchedConfigPartial.length > 0 ? { touchedConfigPartial } : {}),
		...(rollbackFailedConfig.length > 0
			? {
				details: {
					rollbackFailedConfig
				}
			}
			: {})
	}
}

async function writeLayoutBackupIfNeeded(writes: ConfigWrite[], backups: ConfigBackup[]) {
	const cardStylesBackup = backups.find(backup => path.basename(backup.filePath) === CARD_STYLES_FILE_NAME)
	if (!cardStylesBackup || !cardStylesBackup.existed || !writes.some(write => write.fileName === CARD_STYLES_FILE_NAME)) {
		return
	}

	const layoutBackupPath = resolveLayoutBackupPath()
	await assertSafeSiteConfigProjectPath(process.cwd(), layoutBackupPath)
	await fs.mkdir(path.dirname(layoutBackupPath), { recursive: true })
	await writeSiteConfigFileAtomically(layoutBackupPath, cardStylesBackup.content)
}

export async function handleConfigPost(request: NextRequest) {
	try {
		let payload: unknown
		try {
			payload = await readLimitedJsonRequest(request, SITE_CONFIG_REQUEST_MAX_BYTES)
		} catch (error) {
			return NextResponse.json(
				{ error: isJsonRequestBodyTooLargeError(error) ? '请求体过大' : '请求体格式错误' },
				{ status: getLimitedJsonRequestErrorStatus(error) }
			)
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
		}

		if (!hasOnlyConfigWriteKeys(payload as Record<string, unknown>)) {
			return NextResponse.json({ error: '请求体包含未知配置项' }, { status: 400 })
		}

		const configPayload = payload as ConfigWritePayload
		const shapeErrorResponse = assertConfigPayloadShape(configPayload)
		if (shapeErrorResponse) {
			return shapeErrorResponse
		}

		if (configPayload.siteContent !== undefined) {
			await assertSiteConfigDraftLocalAssetsExist(process.cwd(), { siteContent: configPayload.siteContent })
		}

		const configDir = path.join(process.cwd(), 'src/config')
		const writes = buildConfigWrites(configPayload)
		if (writes.length === 0) {
			return NextResponse.json({ error: '缺少可写配置项' }, { status: 400 })
		}
		const backups: ConfigBackup[] = []
		const touchedConfig: string[] = []

		await withSiteConfigLocalMutationLock(process.cwd(), async () => {
			try {
				for (const write of writes) {
					const filePath = path.join(configDir, write.fileName)
					await assertSafeSiteConfigProjectPath(process.cwd(), filePath)
					backups.push(await readConfigBackup(filePath))
					await writeSiteConfigFileAtomically(filePath, write.content)
					touchedConfig.push(write.fileName)
				}
				await writeLayoutBackupIfNeeded(writes, backups)
			} catch (error) {
				const rollbackFailedConfig = await rollbackConfigWrites(backups.slice(0, touchedConfig.length))
				if (error instanceof Error) {
					const configWriteError = error as ConfigWriteError
					configWriteError.touchedConfigPartial = [...touchedConfig]
					if (rollbackFailedConfig.length > 0) {
						configWriteError.rollbackFailedConfig = rollbackFailedConfig
					}
				}
				throw error
			}
		})

		return NextResponse.json({ success: true })
	} catch (error: unknown) {
		return NextResponse.json(
			isSiteConfigLocalValidationError(error) ? { error: error.message } : buildConfigWriteFailureBody(error),
			{ status: isSiteConfigLocalValidationError(error) ? 400 : 500 }
		)
	}
}
