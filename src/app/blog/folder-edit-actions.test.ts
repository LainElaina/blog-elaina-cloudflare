import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

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

	it('满足条件时允许分配目录', () => {
		assert.deepEqual(getAssignFolderActionState({
			selectedCount: 2,
			availableFolderPaths: ['/写作']
		}), {
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
