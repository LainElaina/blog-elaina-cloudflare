import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

test('project and picture pages revoke pending image previews on unmount', async () => {
	const projectSource = (await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const picturesSource = (await fs.readFile(new URL('../pictures/page.tsx', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	for (const source of [projectSource, picturesSource]) {
		assert.match(source, /const \[imageItems, setImageItems\] = useState<Map<string, ImageItem>>\(new Map\(\)\)\n\s*const imageItemsRef = useRef\(imageItems\)/)
		assert.match(source, /useEffect\(\(\) => \{\n\s*imageItemsRef\.current = imageItems\n\s*\}, \[imageItems\]\)/)
		assert.match(source, /useEffect\(\(\) => \{\n\s*return \(\) => \{\n\s*revokeFilePreviewUrls\(imageItemsRef\.current\.values\(\)\)\n\s*\}\n\s*\}, \[\]\)/)
	}
})
