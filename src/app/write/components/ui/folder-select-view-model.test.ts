import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildFolderSelectViewModel } from './folder-select-view-model'

describe('folder-select view model', () => {
	it('没有目录时显示空提示与新建按钮文案', () => {
		const view = buildFolderSelectViewModel({ folders: [], value: '' })
		assert.equal(view.emptyMessage, '暂无目录，请先新建目录')
		assert.equal(view.createButtonLabel, '新建目录')
		assert.deepEqual(view.options, [{ value: '', label: '默认目录' }])
	})

	it('新建目录后会把目录加入选项并自动选中', () => {
		const view = buildFolderSelectViewModel({ folders: ['/生活'], value: '', createdFolderInput: '写作/技术' })
		assert.deepEqual(
			view.options.map(item => item.value),
			['', '/写作/技术', '/生活']
		)
		assert.equal(view.nextValueAfterCreate, '/写作/技术')
	})

	it('创建完成且输入已清空后，未刷新的目录列表里仍保留当前选中目录', () => {
		const creatingView = buildFolderSelectViewModel({ folders: ['/生活'], value: '', createdFolderInput: '写作/技术' })
		const selectedValue = creatingView.nextValueAfterCreate ?? ''

		const createdView = buildFolderSelectViewModel({ folders: ['/生活'], value: selectedValue })
		assert.deepEqual(
			createdView.options.map(item => item.value),
			['', '/写作/技术', '/生活']
		)
	})
})
