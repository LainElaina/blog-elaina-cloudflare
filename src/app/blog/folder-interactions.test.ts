import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildClearFolderDialogCopy,
	buildFolderSelectionState,
	createFolderOptionList,
	normalizeCreatedFolderPath
} from './folder-interactions.ts'

describe('folder-interactions', () => {
	it('normalizeCreatedFolderPath 会把用户输入整理成标准目录路径', () => {
		assert.equal(normalizeCreatedFolderPath(' 写作/技术 '), '/写作/技术')
		assert.equal(normalizeCreatedFolderPath('/写作//技术/'), '/写作/技术')
	})

	it('createFolderOptionList 会把新建目录并入现有目录列表且去重排序', () => {
		assert.deepEqual(createFolderOptionList(['/生活', '/写作'], '/写作/技术'), ['/写作', '/写作/技术', '/生活'])
	})

	it('buildFolderSelectionState 在没有目录时给出显式提示', () => {
		assert.deepEqual(buildFolderSelectionState([], ''), {
			hasFolders: false,
			emptyMessage: '暂无目录，请先新建目录',
			options: [{ value: '', label: '默认目录' }]
		})
	})

	it('buildClearFolderDialogCopy 明确说明只会清除文章目录归属', () => {
		const copy = buildClearFolderDialogCopy(3)
		assert.match(copy.title, /清空目录/)
		assert.match(copy.description, /不会删除文章内容/)
		assert.match(copy.description, /不会删除目录本身/)
		assert.match(copy.description, /3 篇文章/)
	})
})
