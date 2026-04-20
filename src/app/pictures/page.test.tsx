import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PicturesPageView } from './page-view'

const SAMPLE_PICTURES = [
	{
		id: 'picture-1',
		uploadedAt: '2026-04-20T00:00:00.000Z',
		description: 'sample',
		image: '/images/pictures/sample.webp'
	}
]

function getTextContent(node) {
	if (node === null || node === undefined || typeof node === 'boolean') {
		return ''
	}

	if (typeof node === 'string' || typeof node === 'number') {
		return String(node)
	}

	if (Array.isArray(node)) {
		return node.map(getTextContent).join('')
	}

	if (isValidElement(node)) {
		return getTextContent(node.props.children)
	}

	return ''
}

function findElement(node, predicate) {
	if (node === null || node === undefined || typeof node === 'boolean') {
		return null
	}

	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findElement(child, predicate)
			if (match) {
				return match
			}
		}
		return null
	}

	if (!isValidElement(node)) {
		return null
	}

	if (predicate(node)) {
		return node
	}

	return findElement(node.props.children, predicate)
}

function createProps(overrides = {}) {
	return {
		pictures: SAMPLE_PICTURES,
		isEditMode: false,
		isSaving: false,
		hideEditButton: false,
		buttonText: '保存',
		effectiveDisplayMode: 'random',
		onDisplayModeChange: () => undefined,
		onEnterEditMode: () => undefined,
		onCancelEdit: () => undefined,
		onOpenUploadDialog: () => undefined,
		onSave: () => undefined,
		onOpenImageToolbox: () => undefined,
		onDeleteSingle: () => undefined,
		onDeleteGroup: () => undefined,
		renderRandomLayout: () => createElement('div', { 'data-layout-kind': 'random' }, 'random-layout'),
		renderMasonryLayout: () => createElement('div', { 'data-layout-kind': 'masonry' }, 'masonry-layout'),
		...overrides
	}
}

function renderView(overrides = {}) {
	const props = createProps(overrides)
	return {
		markup: renderToStaticMarkup(createElement(PicturesPageView, props)),
		tree: PicturesPageView(props)
	}
}

function findElementByData(node, key, value) {
	const match = findElement(node, element => element.props[key] === value)
	assert.ok(match, `expected element with ${key}=${value}`)
	return match
}

function findDisplayModeToggle(node) {
	return findElementByData(node, 'data-display-mode-toggle', 'pictures-display-mode-toggle')
}

describe('pictures page view', () => {
	it('renders a single icon toggle in the top-right corner by default', () => {
		const { markup, tree } = renderView()
		const toggle = findDisplayModeToggle(tree)

		assert.match(markup, /data-display-mode-toggle="pictures-display-mode-toggle"/)
		assert.equal(toggle.props['data-current-display-mode'], 'random')
		assert.equal(toggle.props['data-target-display-mode'], 'masonry')
		assert.equal(toggle.props['aria-label'], '切换到瀑布模式')
		assert.match(markup, /<svg/)
		assert.doesNotMatch(markup, />相纸</)
		assert.doesNotMatch(markup, />瀑布</)
	})

	it('keeps the visitor icon toggle visible when hideEditButton is true', () => {
		const { markup, tree } = renderView({ hideEditButton: true })
		const toggle = findDisplayModeToggle(tree)

		assert.match(markup, /data-display-mode-toggle="pictures-display-mode-toggle"/)
		assert.equal(toggle.props['data-current-display-mode'], 'random')
		assert.doesNotMatch(markup, />编辑<\/button>/)
	})

	it('uses a neutral empty-state copy when the edit button is hidden', () => {
		const { markup } = renderView({ hideEditButton: true, pictures: [] })

		assert.match(markup, /还没有上传图片。/)
		assert.doesNotMatch(markup, /点击右上角「编辑」后即可开始上传/)
	})

	it('disables the icon toggle in edit mode and shows the lock copy', () => {
		const { markup, tree } = renderView({ isEditMode: true, effectiveDisplayMode: 'random' })
		const toggle = findDisplayModeToggle(tree)

		assert.match(markup, /编辑态固定使用相纸模式/)
		assert.equal(toggle.props.disabled, true)
		assert.equal(toggle.props['aria-label'], '编辑态固定使用相纸模式')
	})

	it('keeps the icon visible on mobile while edit actions stay desktop-only', () => {
		const { tree } = renderView()
		const topActions = findElementByData(tree, 'data-pictures-top-actions', 'pictures-top-actions')
		const editActions = findElementByData(tree, 'data-pictures-edit-actions', 'pictures-edit-actions')
		const toggleWrapper = findElementByData(tree, 'data-display-mode-toggle-wrapper', 'pictures-display-mode-toggle-wrapper')

		assert.doesNotMatch(topActions.props.className, /max-sm:hidden/)
		assert.match(editActions.props.className, /max-sm:hidden/)
		assert.equal(toggleWrapper.props['data-display-mode-toggle-wrapper'], 'pictures-display-mode-toggle-wrapper')
	})

	it('renders the correct layout branch for random and masonry modes', () => {
		const randomView = renderView({ effectiveDisplayMode: 'random' })
		const masonryView = renderView({ effectiveDisplayMode: 'masonry' })
		const randomToggle = findDisplayModeToggle(randomView.tree)
		const masonryToggle = findDisplayModeToggle(masonryView.tree)

		assert.match(randomView.markup, /data-layout-kind="random"/)
		assert.doesNotMatch(randomView.markup, /data-layout-kind="masonry"/)
		assert.equal(randomToggle.props['data-target-display-mode'], 'masonry')
		assert.match(masonryView.markup, /data-layout-kind="masonry"/)
		assert.doesNotMatch(masonryView.markup, /data-layout-kind="random"/)
		assert.equal(masonryToggle.props['data-target-display-mode'], 'random')
	})

	it('routes the icon toggle through the display-mode callback only', () => {
		const displayModeCalls = []
		let saveCalls = 0
		let uploadCalls = 0
		let deleteSingleCalls = 0
		let deleteGroupCalls = 0
		const { tree } = renderView({
			onDisplayModeChange: mode => displayModeCalls.push(mode),
			onSave: () => {
				saveCalls += 1
			},
			onOpenUploadDialog: () => {
				uploadCalls += 1
			},
			onDeleteSingle: () => {
				deleteSingleCalls += 1
			},
			onDeleteGroup: () => {
				deleteGroupCalls += 1
			}
		})
		const toggle = findDisplayModeToggle(tree)

		toggle.props.onClick()

		assert.deepEqual(displayModeCalls, ['masonry'])
		assert.equal(saveCalls, 0)
		assert.equal(uploadCalls, 0)
		assert.equal(deleteSingleCalls, 0)
		assert.equal(deleteGroupCalls, 0)
	})
})
