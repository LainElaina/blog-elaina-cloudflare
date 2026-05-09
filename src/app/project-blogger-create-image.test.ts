import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

async function readSource(path: string) {
	return (await fs.readFile(new URL(path, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

test('new project dialog forwards selected local image into publish queue', async () => {
	const dialogSource = await readSource('./projects/components/create-dialog.tsx')
	const pageSource = await readSource('./projects/page.tsx')

	assert.match(dialogSource, /const \[pendingImageItem, setPendingImageItem\] = useState<ImageItem \| undefined>\(\)/)
	assert.match(dialogSource, /setPendingImageItem\(current => \{\n\s*revokeFilePreviewUrls\(current \? \[current\] : \[\]\)\n\s*return image\n\s*\}\)\n\s*setFormData\(\{ \.\.\.formData, image: imageUrl \}\)/)
	assert.match(dialogSource, /onSave\(formData, pendingImageItem\)/)
	assert.match(pageSource, /const handleSaveProject = \(updatedProject: Project, imageItem\?: ImageItem\) => \{/)
	assert.match(pageSource, /newMap\.set\(updatedProject\.url, imageItem\)/)
})

test('new blogger dialog forwards selected local avatar into publish queue', async () => {
	const dialogSource = await readSource('./bloggers/components/create-dialog.tsx')
	const pageSource = await readSource('./bloggers/page.tsx')

	assert.match(dialogSource, /const \[pendingAvatarItem, setPendingAvatarItem\] = useState<AvatarItem \| undefined>\(\)/)
	assert.match(dialogSource, /setPendingAvatarItem\(current => \{\n\s*revokeFilePreviewUrls\(current \? \[current\] : \[\]\)\n\s*return avatar\n\s*\}\)\n\s*setFormData\(\{ \.\.\.formData, avatar: avatarUrl \}\)/)
	assert.match(dialogSource, /onSave\(formData, pendingAvatarItem\)/)
	assert.match(pageSource, /const handleSaveBlogger = \(updatedBlogger: Blogger, avatarItem\?: AvatarItem\) => \{/)
	assert.match(pageSource, /newMap\.set\(updatedBlogger\.url, avatarItem\)/)
})
