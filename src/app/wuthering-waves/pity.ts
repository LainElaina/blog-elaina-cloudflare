export interface CardRecord {
	cardPoolType: string
	resourceId: number
	qualityLevel: number
	resourceType: string
	name: string
	count: number
	time: string
}

export type PitySegment = {
	pulls: number
	name: string | null
	time: string | null
}

export function parseCardRecords(raw: string): CardRecord[] {
	const data = JSON.parse(raw) as unknown
	if (!Array.isArray(data)) {
		throw new Error('根节点必须是数组')
	}
	return data.map((item, i) => {
		if (typeof item !== 'object' || item === null) {
			throw new Error(`第 ${i + 1} 项不是对象`)
		}
		const r = item as Record<string, unknown>
		const qualityLevel = Number(r.qualityLevel)
		if (!Number.isFinite(qualityLevel)) {
			throw new Error(`第 ${i + 1} 项缺少有效的 qualityLevel`)
		}
		return {
			cardPoolType: String(r.cardPoolType ?? ''),
			resourceId: Number(r.resourceId ?? 0),
			qualityLevel,
			resourceType: String(r.resourceType ?? ''),
			name: String(r.name ?? ''),
			count: Number(r.count ?? 1),
			time: String(r.time ?? '')
		}
	})
}

/** 按数组顺序累计；遇到 5 星则结束上一段，并从该 5 星开始新段。未完成段无 name。 */
export function buildPitySegments(records: CardRecord[]): PitySegment[] {
	const segments: PitySegment[] = []
	let pulls = 0
	let name: string | null = null
	let time: string | null = null

	for (const rec of records) {
		if (rec.qualityLevel === 5) {
			if (pulls > 0 || name !== null) {
				segments.push({ pulls, name, time })
			}
			pulls = 1
			name = rec.name
			time = rec.time
		} else {
			pulls++
		}
	}

	if (pulls > 0 || name !== null) {
		segments.push({ pulls, name, time })
	}

	return segments
}
