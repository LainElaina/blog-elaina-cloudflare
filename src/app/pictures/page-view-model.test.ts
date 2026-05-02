import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs/promises'

import { applyPictureImagePathReplacements, buildPicturesPageDisplayModeState } from './page-view-model.ts'

describe('pictures page display mode wiring', () => {
	it('keeps page-level onDisplayModeChange connected to preferred display mode state', () => {
		const calls = []
		const initialState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'random',
			isEditMode: false,
			isMobile: false,
			onDisplayModeChange: mode => calls.push(mode)
		})

		initialState.onDisplayModeChange('masonry')
		const nextState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: false,
			onDisplayModeChange: mode => calls.push(mode)
		})

		assert.equal(initialState.effectiveDisplayMode, 'random')
		assert.equal(nextState.effectiveDisplayMode, 'masonry')
		assert.deepEqual(calls, ['masonry'])
	})

	it('forces the page-level effective display mode back to random on mobile', () => {
		const state = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: true,
			onDisplayModeChange: () => undefined
		})

		assert.equal(state.effectiveDisplayMode, 'random')
	})

	it('restores masonry after leaving edit mode', () => {
		const editState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: true,
			isMobile: false,
			onDisplayModeChange: () => undefined
		})
		const browseState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: false,
			onDisplayModeChange: () => undefined
		})

		assert.equal(editState.effectiveDisplayMode, 'random')
		assert.equal(browseState.effectiveDisplayMode, 'masonry')
	})

	it('restores masonry after returning from mobile to desktop', () => {
		const mobileState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: true,
			onDisplayModeChange: () => undefined
		})
		const desktopState = buildPicturesPageDisplayModeState({
			preferredDisplayMode: 'masonry',
			isEditMode: false,
			isMobile: false,
			onDisplayModeChange: () => undefined
		})

		assert.equal(mobileState.effectiveDisplayMode, 'random')
		assert.equal(desktopState.effectiveDisplayMode, 'masonry')
	})
})

describe('pictures save path replacement', () => {
	it('replaces newly uploaded file preview URLs by id/index keys before saving list.json', () => {
		const pictures = [
			{
				id: 'group-1',
				uploadedAt: '2026-04-28T00:00:00.000Z',
				images: ['blob:http://localhost/one', 'blob:http://localhost/two']
			}
		]
		const replacements = new Map([
			['group-1::0', '/images/pictures/one.webp'],
			['group-1::1', '/images/pictures/two.webp']
		])

		assert.deepEqual(applyPictureImagePathReplacements(pictures, replacements), [
			{
				id: 'group-1',
				uploadedAt: '2026-04-28T00:00:00.000Z',
				image: undefined,
				images: ['/images/pictures/one.webp', '/images/pictures/two.webp']
			}
		])
	})

	it('development save rolls back uploaded picture files when list saving fails', async () => {
		const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

		assert.match(pageSource, /const uploadedFiles: LocalSiteAssetUploadBackup\[\] = \[\]/)
		assert.match(pageSource, /await uploadLocalSiteAsset\(imageItem\.file, `public\$\{publicPath\}`, uploadedFiles\)/)
		assert.match(pageSource, /catch \(error\) \{\n\s*await rollbackLocalSiteAssetUploads\(uploadedFiles\)\n\s*throw error\n\s*\}/)
		assert.match(pageSource, /'保存图床列表'/)
		assert.match(pageSource, /savedPictures = updatedPictures/)
	})

	it('development save writes list.json before deleting orphaned picture files', async () => {
		const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')
		const saveListIndex = pageSource.indexOf("'保存图床列表'")
		const deleteImageIndex = pageSource.indexOf("'删除图床旧图片'")

		assert.notEqual(saveListIndex, -1)
		assert.notEqual(deleteImageIndex, -1)
		assert.ok(saveListIndex < deleteImageIndex)
	})

	it('development save reuses key-based replacements instead of treating imageItems keys as URLs', async () => {
		const pageSource = await fs.readFile(new URL('./page.tsx', import.meta.url), 'utf-8')

		assert.match(pageSource, /pathReplacements\.set\(key, publicPath\)/)
		assert.match(pageSource, /updatedPictures = applyPictureImagePathReplacements\(updatedPictures, pathReplacements\)/)
		assert.doesNotMatch(pageSource, /for \(const \[url, imageItem\] of imageItems\.entries\(\)\)/)
		assert.doesNotMatch(pageSource, /p\.image === url \? publicPath : p\.image/)
	})
})
