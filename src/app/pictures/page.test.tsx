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

function findElementByText(node, text) {
	const match = findElement(node, element => getTextContent(element.props.children).trim() === text)
	assert.ok(match, `expected element with text ${text}`)
	return match
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

describe('pictures page view', () => {
	it('renders the visitor toggle group with 相纸 active by default', () => {
		const { markup, tree } = renderView()
		const randomButton = findElementByText(tree, '相纸')
		const masonryButton = findElementByText(tree, '瀑布')

		assert.match(markup, /相纸/)
		assert.match(markup, /瀑布/)
		assert.equal(randomButton.props['aria-pressed'], true)
		assert.equal(masonryButton.props['aria-pressed'], false)
	})

	it('keeps the visitor toggle visible when hideEditButton is true', () => {
		const { markup } = renderView({ hideEditButton: true })

		assert.match(markup, /相纸/)
		assert.match(markup, /瀑布/)
		assert.doesNotMatch(markup, />编辑<\/button>/)
	})

	it('uses a neutral empty-state copy when the edit button is hidden', () => {
		const { markup } = renderView({ hideEditButton: true, pictures: [] })

		assert.match(markup, /还没有上传图片。/)
		assert.doesNotMatch(markup, /点击右上角「编辑」后即可开始上传/)
	})

	it('disables the toggle in edit mode and shows the lock copy', () => {
		const { markup, tree } = renderView({ isEditMode: true })
		const randomButton = findElementByText(tree, '相纸')
		const masonryButton = findElementByText(tree, '瀑布')

		assert.match(markup, /编辑态固定使用相纸模式/)
		assert.equal(randomButton.props.disabled, true)
		assert.equal(masonryButton.props.disabled, true)
	})

	it('keeps the desktop-only visibility contract on the top-right controls', () => {
		const { markup } = renderView()

		assert.match(markup, /max-sm:hidden/)
	})

	it('renders the correct layout branch for random and masonry modes', () => {
		const randomView = renderView({ effectiveDisplayMode: 'random' })
		const masonryView = renderView({ effectiveDisplayMode: 'masonry' })

		assert.match(randomView.markup, /data-layout-kind="random"/)
		assert.doesNotMatch(randomView.markup, /data-layout-kind="masonry"/)
		assert.match(masonryView.markup, /data-layout-kind="masonry"/)
		assert.doesNotMatch(masonryView.markup, /data-layout-kind="random"/)
	})

	it('routes the 瀑布 toggle through the display-mode callback only', () => {
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
		const masonryButton = findElementByText(tree, '瀑布')

		masonryButton.props.onClick()

		assert.deepEqual(displayModeCalls, ['masonry'])
		assert.equal(saveCalls, 0)
		assert.equal(uploadCalls, 0)
		assert.equal(deleteSingleCalls, 0)
		assert.equal(deleteGroupCalls, 0)
	})
})
