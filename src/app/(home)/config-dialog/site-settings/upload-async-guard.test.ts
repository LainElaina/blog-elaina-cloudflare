import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('site setting image uploads ignore stale async hash results', async () => {
	const faviconAvatarSource = (await fs.readFile(new URL('./favicon-avatar-upload.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const backgroundSource = (await fs.readFile(new URL('./background-images-section.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const artSource = (await fs.readFile(new URL('./art-images-section.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const socialSource = (await fs.readFile(new URL('./social-buttons-section.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	for (const source of [faviconAvatarSource, backgroundSource, artSource, socialSource]) {
		assert.match(source, /useEffect\(\(\) => \{\n\s*mountedRef\.current = true/)
	}

	assert.match(faviconAvatarSource, /const mountedRef = useRef\(true\)\n\s*const faviconSelectionRef = useRef\(0\)\n\s*const avatarSelectionRef = useRef\(0\)/)
	assert.match(faviconAvatarSource, /const selectionId = \(faviconSelectionRef\.current \+= 1\)\n\s*const hash = await hashFileSHA256\(file\)\n\s*if \(!mountedRef\.current \|\| selectionId !== faviconSelectionRef\.current\) return\n\s*const previewUrl = URL\.createObjectURL\(file\)/)
	assert.match(faviconAvatarSource, /const selectionId = \(avatarSelectionRef\.current \+= 1\)\n\s*const hash = await hashFileSHA256\(file\)\n\s*if \(!mountedRef\.current \|\| selectionId !== avatarSelectionRef\.current\) return\n\s*const previewUrl = URL\.createObjectURL\(file\)/)

	assert.match(backgroundSource, /const backgroundSelectionRef = useRef\(0\)\n\s*const mountedRef = useRef\(true\)/)
	assert.match(backgroundSource, /const selectionId = \(backgroundSelectionRef\.current \+= 1\)\n\s*const hash = await hashFileSHA256\(file\)\n\s*if \(!mountedRef\.current \|\| selectionId !== backgroundSelectionRef\.current\) return/)

	assert.match(artSource, /const artSelectionRef = useRef\(0\)\n\s*const mountedRef = useRef\(true\)/)
	assert.match(artSource, /const selectionId = \(artSelectionRef\.current \+= 1\)[\s\S]*?const hash = await hashFileSHA256\(file\)\n\s*if \(!mountedRef\.current \|\| selectionId !== artSelectionRef\.current\) return/)

	assert.match(socialSource, /const imageSelectionRefs = useRef<Record<string, number>>\(\{\}\)\n\s*const mountedRef = useRef\(true\)/)
	assert.match(socialSource, /const selectionId = \(imageSelectionRefs\.current\[buttonId\] \|\| 0\) \+ 1\n\s*imageSelectionRefs\.current\[buttonId\] = selectionId\n\s*const hash = await hashFileSHA256\(file\)\n\s*if \(!mountedRef\.current \|\| selectionId !== imageSelectionRefs\.current\[buttonId\]\) return/)
	assert.match(socialSource, /const handleRemoveButton = \(id: string\) => \{\n\s*imageSelectionRefs\.current\[id\] = \(imageSelectionRefs\.current\[id\] \|\| 0\) \+ 1/)
	assert.match(socialSource, /const handleRemoveImage = \(buttonId: string\) => \{\n\s*imageSelectionRefs\.current\[buttonId\] = \(imageSelectionRefs\.current\[buttonId\] \|\| 0\) \+ 1/)
})
