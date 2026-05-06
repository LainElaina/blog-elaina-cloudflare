import type { Project } from './components/project-card'

export function normalizeProjectRuntimeItems(items: unknown): Project[] {
	if (!Array.isArray(items)) {
		return []
	}

	return items.flatMap(item => {
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			return []
		}

		const project = item as Record<string, unknown>
		if (
			typeof project.name !== 'string' ||
			typeof project.image !== 'string' ||
			typeof project.url !== 'string' ||
			typeof project.description !== 'string'
		) {
			return []
		}

		const { github, npm, tags, year, ...projectFields } = project
		return [
			{
				...projectFields,
				name: project.name,
				image: project.image,
				url: project.url,
				description: project.description,
				tags: Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string') : [],
				year: typeof year === 'number' && Number.isFinite(year) ? year : 0,
				...(typeof github === 'string' ? { github } : {}),
				...(typeof npm === 'string' ? { npm } : {})
			} as Project
		]
	})
}
