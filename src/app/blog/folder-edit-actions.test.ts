import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BLOG_FOLDER_ALL } from './blog-filters.ts'
import { getAssignFolderActionState, getClearFolderActionState } from './folder-edit-actions.ts'

describe('folder-edit actions', () => {
	it('没有目录时分配目录返回显式提示', () => {
		assert.deepEqual(getAssignFolderActionState({
			selectedCount: 2,
			availableFolderPaths: []
		}), {
			allowed: false,
			message: '请先新建目录'
		})
	})

	it('没有选中文章时分配目录返回选择提示', () => {
		assert.deepEqual(getAssignFolderActionState({
			selectedCount: 0,
			availableFolderPaths: ['/写作']
		}), {
			allowed: false,
			message: '请选择要分配目录的文章'
		})
	})

	it('默认“选择目录”状态下分配目录会返回显式提示而不是允许清空', () => {
		assert.deepEqual(getAssignFolderActionState({
			selectedCount: 2,
			availableFolderPaths: ['/写作'],
			selectedFolderPath: BLOG_FOLDER_ALL
		} as never), {
			allowed: false,
			message: '请选择要分配的目录'
		})
	})

	it('满足条件且已选择真实目录时允许分配目录', () => {
		assert.deepEqual(getAssignFolderActionState({
			selectedCount: 2,
			availableFolderPaths: ['/写作'],
			selectedFolderPath: '/写作'
		} as never), {
			allowed: true,
			message: null
		})
	})

	it('清空目录动作使用独立按钮文案', () => {
		assert.deepEqual(getClearFolderActionState(3), {
			buttonLabel: '清空目录',
			confirmRequired: true,
			selectedCount: 3
		})
	})
})
