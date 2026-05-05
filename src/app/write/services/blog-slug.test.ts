import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { assertSafeBlogSlug } from './blog-slug.ts'

test('assertSafeBlogSlug accepts only a single safe blog path segment', () => {
	for (const slug of ['hello', 'hello-world', 'post-123', 'a1-b2-c3']) {
		assert.doesNotThrow(() => assertSafeBlogSlug(slug), slug)
	}

	for (const slug of [
		'',
		' Hello',
		'hello ',
		'Hello',
		'hello_world',
		'hello/world',
		'hello\\world',
		'../post',
		'post..name',
		'post%2Fname',
		'-post',
		'post-',
		'post--name'
	]) {
		assert.throws(() => assertSafeBlogSlug(slug), /slug 只能使用/)
	}
})

test('blog publish and delete paths validate slug before composing repository paths', async () => {
	const publishSource = (await fs.readFile(new URL('./push-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const deleteSource = (await fs.readFile(new URL('./delete-blog.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const batchDeleteSource = (await fs.readFile(new URL('../../blog/services/batch-delete-blogs.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')
	const localPublishSource = (await fs.readFile(new URL('../hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(publishSource, /import \{ assertSafeBlogSlug \} from '\.\/blog-slug'/)
	assert.match(
		publishSource,
		/export function assertEditableSlug[\s\S]*assertSafeBlogSlug\(params\.form\.slug\)[\s\S]*assertSafeBlogSlug\(params\.originalSlug\)/
	)
	assert.match(publishSource, /assertEditableSlug\(\{ form, mode, originalSlug \}\)[\s\S]*const basePath = `public\/blogs\/\$\{form\.slug\}`/)

	assert.match(deleteSource, /import \{ assertSafeBlogSlug \} from '\.\/blog-slug'/)
	assert.match(deleteSource, /buildDeleteArtifactContents[\s\S]*assertSafeBlogSlug\(params\.slug\)/)
	assert.match(deleteSource, /if \(!slug\) throw new Error\('需要 slug'\)\n\s*assertSafeBlogSlug\(slug\)[\s\S]*const basePath = `public\/blogs\/\$\{slug\}`/)

	assert.match(batchDeleteSource, /import \{ assertSafeBlogSlug \} from '\.\.\/\.\.\/write\/services\/blog-slug'/)
	assert.match(batchDeleteSource, /for \(const slug of uniqueSlugs\) \{\n\s*assertSafeBlogSlug\(slug\)\n\s*\}[\s\S]*const basePath = `public\/blogs\/\$\{slug\}`/)

	assert.match(localPublishSource, /import \{ assertSafeBlogSlug \} from '\.\.\/services\/blog-slug'/)
	assert.match(
		localPublishSource,
		/if \(!form\?\.slug\) throw new Error\('需要 slug'\)\n\s*assertSafeBlogSlug\(form\.slug\)[\s\S]*const basePath = `public\/blogs\/\$\{form\.slug\}`/
	)
	assert.match(localPublishSource, /assertSafeBlogSlug\(targetSlug\)[\s\S]*body: JSON\.stringify\(\{ path: `public\/blogs\/\$\{targetSlug\}` \}\)/)
})

test('local blog publish rolls back written files and uploaded images after a later failure', async () => {
	const localPublishSource = (await fs.readFile(new URL('../hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(localPublishSource, /const writtenFiles: LocalBlogPublishFileBackup\[\] = \[\]/)
	assert.match(localPublishSource, /const uploadedFiles: LocalBlogPublishUploadBackup\[\] = \[\]/)
	assert.match(localPublishSource, /await uploadLocalBlogPublishImage\(\{ file: img\.file, path: filePath, actionName: '上传图片', uploadedFiles \}\)/)
	assert.match(localPublishSource, /await saveLocalBlogPublishFile\(\{ path: `\$\{basePath\}\/index\.md`, content: mdToUpload \}, '保存 Markdown', writtenFiles\)/)
	assert.match(localPublishSource, /for \(const payload of payloads\) \{\n\s*await saveLocalBlogPublishFile\(payload, '保存索引产物', writtenFiles\)/)
	assert.match(localPublishSource, /catch \(error\) \{\n\s*await rollbackLocalBlogPublish\(writtenFiles, uploadedFiles\)\n\s*throw error\n\s*\}/)
})

test('local blog delete rolls back index artifacts when artifact saving fails', async () => {
	const localPublishSource = (await fs.readFile(new URL('../hooks/use-publish.ts', import.meta.url), 'utf-8')).replace(/\r\n/g, '\n')

	assert.match(localPublishSource, /const writtenFiles: LocalBlogPublishFileBackup\[\] = \[\]/)
	assert.match(localPublishSource, /const uploadedFiles: LocalBlogPublishUploadBackup\[\] = \[\]/)
	assert.match(localPublishSource, /for \(const payload of payloads\) \{\n\s*await saveLocalBlogPublishFile\(payload, '保存删除索引产物', writtenFiles\)/)
	assert.match(localPublishSource, /catch \(error\) \{\n\s*await rollbackLocalBlogPublish\(writtenFiles, uploadedFiles\)\n\s*throw error\n\s*\}/)
})
