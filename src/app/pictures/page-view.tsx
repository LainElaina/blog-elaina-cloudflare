'use client'

import { createElement, Fragment } from 'react'
import { motion } from 'motion/react'

export interface PicturesPagePicture {
	id: string
	uploadedAt: string
	description?: string
	image?: string
	images?: string[]
}

export interface PicturesLayoutProps {
	pictures: PicturesPagePicture[]
	isEditMode: boolean
	onDeleteSingle: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup: (picture: PicturesPagePicture) => void
}

export type PicturesPageDisplayMode = 'random' | 'masonry'

export interface PicturesPageViewProps {
	pictures: PicturesPagePicture[]
	isEditMode: boolean
	isSaving: boolean
	hideEditButton: boolean
	buttonText: string
	effectiveDisplayMode: PicturesPageDisplayMode
	onDisplayModeChange: (mode: PicturesPageDisplayMode) => void
	onEnterEditMode: () => void
	onCancelEdit: () => void
	onOpenUploadDialog: () => void
	onSave: () => void
	onOpenImageToolbox: () => void
	onDeleteSingle: (pictureId: string, imageIndex: number | 'single') => void
	onDeleteGroup: (picture: PicturesPagePicture) => void
	renderRandomLayout: (props: PicturesLayoutProps) => React.ReactNode
	renderMasonryLayout: (props: PicturesLayoutProps) => React.ReactNode
}

function getDisplayModeToggleButtonClass(params: {
	currentMode: PicturesPageDisplayMode
	isEditMode: boolean
}) {
	if (params.isEditMode) {
		return 'rounded-full border bg-white/70 p-3 text-slate-400 shadow-sm backdrop-blur-sm opacity-70'
	}

	return params.currentMode === 'masonry'
		? 'rounded-full border border-slate-900 bg-slate-900 p-3 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-800'
		: 'rounded-full border bg-white/70 p-3 text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white'
}

function createDisplayModeToggleIcon(mode: PicturesPageDisplayMode) {
	if (mode === 'masonry') {
		return createElement(
			'svg',
			{
				viewBox: '0 0 24 24',
				width: 18,
				height: 18,
				fill: 'none',
				stroke: 'currentColor',
				strokeWidth: 1.8,
				strokeLinecap: 'round',
				strokeLinejoin: 'round',
				'aria-hidden': true
			},
			createElement('rect', { x: 4, y: 4, width: 6, height: 7, rx: 1.5 }),
			createElement('rect', { x: 14, y: 4, width: 6, height: 4, rx: 1.5 }),
			createElement('rect', { x: 14, y: 10, width: 6, height: 10, rx: 1.5 }),
			createElement('rect', { x: 4, y: 13, width: 6, height: 7, rx: 1.5 })
		)
	}

	return createElement(
		'svg',
		{
			viewBox: '0 0 24 24',
			width: 18,
			height: 18,
			fill: 'none',
			stroke: 'currentColor',
			strokeWidth: 1.8,
			strokeLinecap: 'round',
			strokeLinejoin: 'round',
			'aria-hidden': true
		},
		createElement('rect', { x: 5, y: 9, width: 10, height: 10, rx: 2 }),
		createElement('rect', { x: 9, y: 5, width: 10, height: 10, rx: 2 })
	)
}

function createDisplayModeToggleButton(props: PicturesPageViewProps, onClick: () => void) {
	const targetDisplayMode = props.effectiveDisplayMode === 'masonry' ? 'random' : 'masonry'
	const title = props.isEditMode
		? '编辑态固定使用相纸模式'
		: targetDisplayMode === 'masonry'
			? '切换到瀑布模式'
			: '切换到相纸模式'

	return createElement(
		motion.button,
		{
			whileHover: props.isEditMode ? undefined : { scale: 1.05 },
			whileTap: props.isEditMode ? undefined : { scale: 0.95 },
			type: 'button',
			onClick,
			disabled: props.isEditMode,
			title,
			'aria-label': title,
			'data-display-mode-toggle': 'pictures-display-mode-toggle',
			'data-current-display-mode': props.effectiveDisplayMode,
			'data-target-display-mode': targetDisplayMode,
			className: getDisplayModeToggleButtonClass({
				currentMode: props.effectiveDisplayMode,
				isEditMode: props.isEditMode
			})
		},
		createDisplayModeToggleIcon(targetDisplayMode)
	)
}

function createEditActions(props: PicturesPageViewProps) {
	if (!props.isEditMode) {
		if (props.hideEditButton) {
			return null
		}

		return createElement(
			motion.button,
			{
				whileHover: { scale: 1.05 },
				whileTap: { scale: 0.95 },
				type: 'button',
				onClick: props.onEnterEditMode,
				className: 'rounded-xl border bg-white/60 px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'
			},
			'编辑'
		)
	}

	return createElement(
		Fragment,
		null,
		createElement(
			motion.button,
			{
				whileHover: { scale: 1.05 },
				whileTap: { scale: 0.95 },
				type: 'button',
				onClick: props.onOpenImageToolbox,
				className: 'rounded-xl border bg-blue-50 px-4 py-2 text-sm text-blue-700'
			},
			'压缩工具'
		),
		createElement(
			motion.button,
			{
				whileHover: { scale: 1.05 },
				whileTap: { scale: 0.95 },
				type: 'button',
				onClick: props.onCancelEdit,
				disabled: props.isSaving,
				className: 'rounded-xl border bg-white/60 px-6 py-2 text-sm'
			},
			'取消'
		),
		createElement(
			motion.button,
			{
				whileHover: { scale: 1.05 },
				whileTap: { scale: 0.95 },
				type: 'button',
				onClick: props.onOpenUploadDialog,
				className: 'rounded-xl border bg-white/60 px-6 py-2 text-sm'
			},
			'上传'
		),
		createElement(
			motion.button,
			{
				whileHover: { scale: 1.05 },
				whileTap: { scale: 0.95 },
				type: 'button',
				onClick: props.onSave,
				disabled: props.isSaving,
				className: 'brand-btn px-6'
			},
			props.isSaving ? '保存中...' : props.buttonText
		)
	)
}

export function PicturesPageView(props: PicturesPageViewProps) {
	const layoutProps: PicturesLayoutProps = {
		pictures: props.pictures,
		isEditMode: props.isEditMode,
		onDeleteSingle: props.onDeleteSingle,
		onDeleteGroup: props.onDeleteGroup
	}

	const renderedLayout = props.effectiveDisplayMode === 'masonry'
		? props.renderMasonryLayout(layoutProps)
		: props.renderRandomLayout(layoutProps)

	const handleDisplayModeToggle = () => {
		const nextMode = props.effectiveDisplayMode === 'masonry' ? 'random' : 'masonry'
		if (props.isEditMode) {
			return
		}

		props.onDisplayModeChange(nextMode)
	}

	const emptyState = props.pictures.length === 0
		? createElement(
			'div',
			{ className: 'text-secondary flex min-h-screen items-center justify-center text-center text-sm' },
			props.hideEditButton && !props.isEditMode ? '还没有上传图片。' : '还没有上传图片，点击右上角「编辑」后即可开始上传。'
		)
		: null
	const editActions = createEditActions(props)

	return createElement(
		Fragment,
		null,
		renderedLayout,
		emptyState,
		createElement(
			'div',
			{ className: 'absolute top-4 right-6 flex items-start gap-3', 'data-pictures-top-actions': 'pictures-top-actions' },
			createElement(
				'div',
				{ 'data-display-mode-toggle-wrapper': 'pictures-display-mode-toggle-wrapper' },
				createDisplayModeToggleButton(props, handleDisplayModeToggle)
			),
			editActions
				? createElement(
					'div',
					{ className: 'max-sm:hidden', 'data-pictures-edit-actions': 'pictures-edit-actions' },
					editActions
				)
				: null
		)
	)
}
