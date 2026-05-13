import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'

const SRC_ROOT = new URL('../', import.meta.url)

async function findSourceFiles(dir: URL): Promise<URL[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true })
	const files = await Promise.all(
		entries.map(async entry => {
			const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
			if (entry.isDirectory()) return findSourceFiles(url)
			if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) return []
			return [url]
		})
	)
	return files.flat()
}

test('links opened in a new tab cannot control their opener', async () => {
	const files = await findSourceFiles(SRC_ROOT)
	const unsafeLinks: string[] = []

	for (const file of files) {
		const source = await fs.readFile(file, 'utf-8')
		const tags = source.match(/<(?:a|Link|motion\.a)\b[\s\S]*?>/g) ?? []

		for (const tag of tags) {
			if (!/target=['"]_blank['"]/.test(tag)) continue
			const rel = tag.match(/rel=['"]([^'"]*)['"]/)?.[1]
			if (!rel || !/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) {
				unsafeLinks.push(`${path.relative(SRC_ROOT.pathname, file.pathname)}: ${tag.replace(/\s+/g, ' ').trim()}`)
			}
		}
	}

	assert.deepEqual(unsafeLinks, [])
})
