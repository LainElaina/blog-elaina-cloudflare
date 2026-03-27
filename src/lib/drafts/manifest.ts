export type DraftManifestType = 'blog' | 'share' | (string & {})

export type DraftManifestItem = {
	key: string
	type: DraftManifestType
	draftPath: string
	formalPath: string
	page: string
	label: string
	updatedAt: string
}

export type CreateDraftManifestItemInput = Omit<DraftManifestItem, 'updatedAt'> & {
	updatedAt?: string
}

export function createManifestItem(input: CreateDraftManifestItemInput): DraftManifestItem {
	return {
		...input,
		updatedAt: input.updatedAt ?? new Date().toISOString()
	}
}
