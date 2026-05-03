import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('bloggers page revokes pending avatar previews on unmount', async () => {
	const source = (await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(source, /const \[avatarItems, setAvatarItems\] = useState<Map<string, AvatarItem>>\(new Map\(\)\)\n\s*const avatarItemsRef = useRef\(avatarItems\)/)
	assert.match(source, /useEffect\(\(\) => \{\n\s*avatarItemsRef\.current = avatarItems\n\s*\}, \[avatarItems\]\)/)
	assert.match(source, /useEffect\(\(\) => \{\n\s*return \(\) => \{\n\s*revokeFilePreviewUrls\(avatarItemsRef\.current\.values\(\)\)\n\s*\}\n\s*\}, \[\]\)/)
})
