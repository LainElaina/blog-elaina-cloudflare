import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('config dialog keeps preview state out of the saved cancel baseline', async () => {
	const source = await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')

	assert.match(source, /const savedSiteContentRef = useRef<SiteContent>\(normalizeSiteContentCardStyle\(siteContent\)\)/)
	assert.match(source, /const savedCardStylesRef = useRef<CardStyles>\(cardStyles\)/)
	assert.match(source, /const previewingUnsavedConfigRef = useRef\(false\)/)
	assert.match(source, /if \(!open && !previewingUnsavedConfigRef\.current\) \{\n\s*savedSiteContentRef\.current = normalizeSiteContentCardStyle\(\{ \.\.\.siteContent \}\)\n\s*savedCardStylesRef\.current = \{ \.\.\.cardStyles \}/)
	assert.match(source, /if \(open\) \{[\s\S]*setFormData\(current\)[\s\S]*setOriginalData\(savedSiteContentRef\.current\)[\s\S]*setOriginalCardStyles\(savedCardStylesRef\.current\)/)
	assert.match(source, /const handlePreview = \(\) => \{\n\s*previewingUnsavedConfigRef\.current = true\n\s*setSiteContent\(formData\)\n\s*setCardStyles\(cardStylesData\)[\s\S]*onClose\(\)\n\s*\}/)
	assert.doesNotMatch(source, /const handlePreview = \(\) => \{[\s\S]*savedSiteContentRef\.current = formData/)
	assert.match(source, /const handleCancel = \(\) => \{\n\s*clearPendingAssetUploads\(\)\n\s*const savedSiteContent = savedSiteContentRef\.current\n\s*const savedCardStyles = savedCardStylesRef\.current[\s\S]*setSiteContent\(savedSiteContent\)[\s\S]*setCardStyles\(savedCardStyles\)[\s\S]*previewingUnsavedConfigRef\.current = false/)
})


test('config dialog advances saved baselines after successful local publish only', async () => {
	const source = await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/setSiteContent\(formData\)\n\s*setCardStyles\(cardStylesData\)\n\s*if \(action === 'publish'\) \{\n\s*previewingUnsavedConfigRef\.current = false\n\s*savedSiteContentRef\.current = formData\n\s*savedCardStylesRef\.current = cardStylesData\n\s*setOriginalData\(formData\)\n\s*setOriginalCardStyles\(cardStylesData\)\n\s*\}/
	)
})

test('config dialog reloads after successful local draft reminder publish', async () => {
	const source = await fs.readFile(new URL('./index.tsx', import.meta.url), 'utf-8')

	assert.match(
		source,
		/const handlePublishFromDraftReminder = async \(\) => \{[\s\S]*await pushSiteContentLocal\([\s\S]*true\n\s*\)\n\s*await syncDraftState\(\)\n\s*window\.location\.reload\(\)\n\s*\} catch/
	)
})
