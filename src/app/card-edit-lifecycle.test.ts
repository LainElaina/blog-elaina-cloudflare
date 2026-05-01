import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'

async function readSource(path: string) {
	return (await fs.readFile(new URL(path, import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
}

test('project card only commits local edits when completed', async () => {
	const source = await readSource('./projects/components/project-card.tsx')

	assert.match(source, /import \{ useCallback, useEffect, useRef, useState \} from 'react'/)
	assert.match(source, /revokeFilePreviewUrls, revokeUnusedFilePreviewUrls/)
	assert.match(source, /const setDraftImageItem = useCallback\(\(nextImageItem: ImageItem \| null\) => \{\n\s*revokeUnusedFilePreviewUrls\(imageItemRef\.current \? \[imageItemRef\.current\] : \[\], nextImageItem \? \[nextImageItem\] : \[\]\)/)
	assert.match(source, /revokeFilePreviewUrls\(imageItemRef\.current \? \[imageItemRef\.current\] : \[\]\)/)
	assert.match(source, /const handleFieldChange = \(field: keyof Project, value: any\) => \{\n\s*setLocalProject\(current => \(\{ \.\.\.current, \[field\]: value \}\)\)\n\s*\}/)
	assert.match(source, /const handleImageSubmit = \(image: ImageItem\) => \{\n\s*setDraftImageItem\(image\)\n\s*const imageUrl = image\.type === 'url' \? image\.url : image\.previewUrl\n\s*setLocalProject\(current => \(\{ \.\.\.current, image: imageUrl \}\)\)\n\s*\}/)
	assert.match(source, /const handleCancel = \(\) => \{\n\s*setDraftImageItem\(null\)\n\s*setLocalProject\(project\)\n\s*setIsEditing\(false\)\n\s*\}/)
	assert.match(source, /const handleComplete = \(\) => \{\n\s*onUpdate\?\.\(localProject, project, imageItem \|\| undefined\)/)
	assert.match(source, /<button onClick=\{handleComplete\}/)
	assert.match(source, /if \(isEditMode\) return\n\s*setLocalProject\(project\)\n\s*setIsEditing\(false\)\n\s*setDraftImageItem\(null\)/)
	assert.doesNotMatch(source, /onUpdate\?\.\(updated, project, imageItem \|\| undefined\)/)
	assert.doesNotMatch(source, /onUpdate\?\.\(updated, project, image\)/)
})

test('blogger card only commits local edits when completed', async () => {
	const source = await readSource('./bloggers/components/blogger-card.tsx')

	assert.match(source, /import \{ useCallback, useEffect, useRef, useState \} from 'react'/)
	assert.match(source, /revokeFilePreviewUrls, revokeUnusedFilePreviewUrls/)
	assert.match(source, /const setDraftAvatarItem = useCallback\(\(nextAvatarItem: AvatarItem \| null\) => \{\n\s*revokeUnusedFilePreviewUrls\(avatarItemRef\.current \? \[avatarItemRef\.current\] : \[\], nextAvatarItem \? \[nextAvatarItem\] : \[\]\)/)
	assert.match(source, /revokeFilePreviewUrls\(avatarItemRef\.current \? \[avatarItemRef\.current\] : \[\]\)/)
	assert.match(source, /const handleFieldChange = \(field: keyof Blogger, value: any\) => \{\n\s*setLocalBlogger\(current => \(\{ \.\.\.current, \[field\]: value \}\)\)\n\s*\}/)
	assert.match(source, /const handleAvatarSubmit = \(avatar: AvatarItem\) => \{\n\s*setDraftAvatarItem\(avatar\)\n\s*const avatarUrl = avatar\.type === 'url' \? avatar\.url : avatar\.previewUrl\n\s*setLocalBlogger\(current => \(\{ \.\.\.current, avatar: avatarUrl \}\)\)\n\s*\}/)
	assert.match(source, /const handleCancel = \(\) => \{\n\s*setDraftAvatarItem\(null\)\n\s*setLocalBlogger\(blogger\)\n\s*setIsEditing\(false\)\n\s*\}/)
	assert.match(source, /const handleComplete = \(\) => \{\n\s*onUpdate\?\.\(localBlogger, blogger, avatarItem \|\| undefined\)/)
	assert.match(source, /<button onClick=\{handleComplete\}/)
	assert.match(source, /if \(isEditMode\) return\n\s*setLocalBlogger\(blogger\)\n\s*setIsEditing\(false\)\n\s*setDraftAvatarItem\(null\)/)
	assert.doesNotMatch(source, /onUpdate\?\.\(updated, blogger, avatarItem \|\| undefined\)/)
	assert.doesNotMatch(source, /onUpdate\?\.\(updated, blogger, avatar\)/)
})
