import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('config dialog advances saved baselines after successful remote save', async () => {
	const source = await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/await pushSiteContent\([\s\S]*?\)\n\s*setSiteContent\(formData\)\n\s*setCardStyles\(cardStylesData\)\n\s*setOriginalData\(formData\)\n\s*setOriginalCardStyles\(cardStylesData\)/
	)
})

test('config dialog advances saved baselines after successful local publish only', async () => {
	const source = await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/setSiteContent\(formData\)\n\s*setCardStyles\(cardStylesData\)\n\s*if \(action === 'publish'\) \{\n\s*setOriginalData\(formData\)\n\s*setOriginalCardStyles\(cardStylesData\)\n\s*\}/
	)
})

test('config dialog reloads after successful local draft reminder publish', async () => {
	const source = await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const handlePublishFromDraftReminder = async \(\) => \{[\s\S]*await pushSiteContentLocal\([\s\S]*true\n\s*\)\n\s*await syncDraftState\(\)\n\s*window\.location\.reload\(\)\n\s*\} catch/
	)
})
