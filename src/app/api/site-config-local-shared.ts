import fs from 'node:fs/promises'
import path from 'node:path'

export type SiteConfigDraftPayload = {
	siteContent?: unknown
	cardStyles?: unknown
	customComponents?: unknown
	colorPresets?: unknown
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

export async function publishSiteConfigDraft(baseDir: string, draft: SiteConfigDraftPayload) {
	const configDir = path.join(baseDir, 'src/config')
	const touchedFormal: string[] = []

	if (draft.siteContent) {
		await fs.writeFile(path.join(configDir, 'site-content.json'), JSON.stringify(draft.siteContent, null, '\t'))
		touchedFormal.push('site-content.json')
	}

	if (draft.cardStyles) {
		await fs.writeFile(path.join(configDir, 'card-styles.json'), JSON.stringify(draft.cardStyles, null, '\t'))
		touchedFormal.push('card-styles.json')
	}

	if (draft.customComponents) {
		await fs.writeFile(path.join(configDir, 'custom-components.json'), JSON.stringify(draft.customComponents, null, '\t'))
		touchedFormal.push('custom-components.json')
	}

	if (draft.colorPresets) {
		await fs.writeFile(path.join(configDir, 'color-presets.json'), JSON.stringify(draft.colorPresets, null, '\t'))
		touchedFormal.push('color-presets.json')
	}

	await clearSiteConfigDraft(baseDir)
	return touchedFormal
}
