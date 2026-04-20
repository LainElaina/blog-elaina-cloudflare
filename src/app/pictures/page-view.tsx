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

function getDisplayModeButtonClass(isActive: boolean) {
	return isActive
		? 'rounded-xl border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white shadow-sm'
		: 'rounded-xl border bg-white/80 px-3 py-1.5 text-sm text-slate-700 backdrop-blur-sm transition-colors hover:bg-white'
}

function createDisplayModeButton(params: {
	label: string
	mode: PicturesPageDisplayMode
	isActive: boolean
	isEditMode: boolean
	onClick: () => void
}) {
	return createElement(
		motion.button,
		{
			whileHover: params.isEditMode ? undefined : { scale: 1.03 },
			whileTap: params.isEditMode ? undefined : { scale: 0.97 },
			type: 'button',
			onClick: params.onClick,
			disabled: params.isEditMode,
			'aria-pressed': params.isActive,
			className: getDisplayModeButtonClass(params.isActive)
		},
		params.label
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

	return createElement(Fragment, null,
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

	const handleDisplayModeChange = (mode: PicturesPageDisplayMode) => {
		if (props.isEditMode || mode === props.effectiveDisplayMode) {
			return
		}

		props.onDisplayModeChange(mode)
	}

	const visitorToggleCard = createElement(
		'div',
		{ className: 'rounded-2xl border bg-white/70 px-3 py-3 shadow-sm backdrop-blur-sm' },
		createElement('p', { className: 'text-secondary mb-2 text-right text-[11px] tracking-[0.24em] uppercase' }, '浏览模式'),
		createElement(
			'div',
			{ className: 'flex items-center gap-2' },
			createDisplayModeButton({
				label: '相纸',
				mode: 'random',
				isActive: props.effectiveDisplayMode === 'random',
				isEditMode: props.isEditMode,
				onClick: () => handleDisplayModeChange('random')
			}),
			createDisplayModeButton({
				label: '瀑布',
				mode: 'masonry',
				isActive: props.effectiveDisplayMode === 'masonry',
				isEditMode: props.isEditMode,
				onClick: () => handleDisplayModeChange('masonry')
			})
		),
		props.isEditMode
			? createElement('p', { className: 'text-secondary mt-2 text-right text-xs' }, '编辑态固定使用相纸模式')
			: null
	)

	const emptyState = props.pictures.length === 0
		? createElement(
			'div',
			{ className: 'text-secondary flex min-h-screen items-center justify-center text-center text-sm' },
			props.hideEditButton && !props.isEditMode ? '还没有上传图片。' : '还没有上传图片，点击右上角「编辑」后即可开始上传。'
		)
		: null

	return createElement(
		Fragment,
		null,
		renderedLayout,
		emptyState,
		createElement(
			'div',
			{ className: 'absolute top-4 right-6 flex items-start gap-3 max-sm:hidden' },
			visitorToggleCard,
			createEditActions(props)
		)
	)
}
