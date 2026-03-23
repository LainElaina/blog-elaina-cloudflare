'use client'

import { Store, X, Plus } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTemplateStore } from '../app/(home)/stores/template-store'
import { useCustomComponentStore } from '../app/(home)/stores/custom-component-store'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useCenterStore } from '@/hooks/use-center'
import { CARD_TEMPLATES } from '@/config/card-templates'
import { toast } from 'sonner'
import customComponentsDefault from '@/config/custom-components.json'
import DraggerSVG from '@/svgs/dragger.svg'

export function ComponentStore() {
	const [mounted, setMounted] = useState(false)
	const [showStore, setShowStore] = useState(false)
	const [showNewComponent, setShowNewComponent] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const { components: customComponents, addComponent: addCustomComponent, updateComponent, deleteComponent: deleteCustomComponent } = useCustomComponentStore()
	const { cardStyles } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()

	const styles = cardStyles.componentStoreButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : window.innerWidth - 24 - 48 - 72
	const y = styles?.offsetY !== null ? center.y + (styles?.offsetY || 0) : 24

	const dragStateRef = useRef({ dragging: false, startX: 0, startY: 0, initialOffsetX: 0, initialOffsetY: 0 })

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (!editing) return
		e.preventDefault()
		e.stopPropagation()
		dragStateRef.current = {
			dragging: true,
			startX: e.clientX,
			startY: e.clientY,
			initialOffsetX: styles?.offsetX ?? (x - center.x),
			initialOffsetY: styles?.offsetY ?? (y - center.y)
		}
	}, [editing, styles, x, y, center])

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!dragStateRef.current.dragging) return
			const dx = e.clientX - dragStateRef.current.startX
			const dy = e.clientY - dragStateRef.current.startY
			setOffset('componentStoreButton', dragStateRef.current.initialOffsetX + dx, dragStateRef.current.initialOffsetY + dy)
		}

		const handleMouseUp = () => {
			dragStateRef.current.dragging = false
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)
		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [setOffset])

	const [newComp, setNewComp] = useState({
		name: '',
		type: 'text' as const,
		templateId: 'medium-rect',
		content: { text: '', imageUrl: '', linkUrl: '', iframeUrl: '' }
	})

	useEffect(() => {
		setMounted(true)
		const savedTemplates = localStorage.getItem('templates')
		if (savedTemplates) {
			useTemplateStore.setState({ templates: JSON.parse(savedTemplates) })
		}

		const savedCustom = localStorage.getItem('custom-components')
		const customToLoad = savedCustom ? JSON.parse(savedCustom) : customComponentsDefault
		useCustomComponentStore.setState({ components: customToLoad })
	}, [])

	const handleCreateComponent = () => {
		if (!newComp.name.trim()) {
			toast.error('请输入组件名称')
			return
		}
		const template = CARD_TEMPLATES.find(t => t.id === newComp.templateId)
		if (!template) return

		const newComponent = {
			name: newComp.name,
			type: newComp.type,
			templateId: newComp.templateId,
			style: {
				...template.style,
				order: 99,
				offsetX: null,
				offsetY: null,
				enabled: true
			},
			content: newComp.content
		}

		addCustomComponent(newComponent)
		toast.success(`组件 "${newComp.name}" 已创建`)
		setNewComp({ name: '', type: 'text', templateId: 'medium-rect', content: { text: '', imageUrl: '', linkUrl: '', iframeUrl: '' } })
		setShowNewComponent(false)
	}

	const handleEditComponent = (comp: any) => {
		setEditingId(comp.id)
		setNewComp({
			name: comp.name,
			type: comp.type,
			templateId: comp.templateId,
			content: comp.content
		})
		setShowNewComponent(true)
	}

	const handleSaveEdit = () => {
		if (!editingId || !newComp.name.trim()) return
		updateComponent(editingId, {
			name: newComp.name,
			type: newComp.type,
			content: newComp.content
		})
		toast.success('组件已更新')
		setEditingId(null)
		setNewComp({ name: '', type: 'text', templateId: 'medium-rect', content: { text: '', imageUrl: '', linkUrl: '', iframeUrl: '' } })
		setShowNewComponent(false)
	}

	const handleCreateFromTemplate = (templateId: string) => {
		const template = CARD_TEMPLATES.find(t => t.id === templateId)
		if (!template) return

		const newComponent = {
			name: `${template.name}组件`,
			type: 'text' as const,
			templateId,
			style: {
				...template.style,
				order: 99,
				offsetX: null,
				offsetY: null,
				enabled: true
			},
			content: { text: '双击编辑内容' }
		}

		addCustomComponent(newComponent)
		toast.success(`已创建 ${template.name}，请拖动到合适位置`)

		// 自动进入编辑模式
		const { startEditing } = useLayoutEditStore.getState()
		startEditing()
	}

	if (!mounted) return null

	return (
		<>
			<div
				className='fixed z-[9998]'
				style={{ left: x, top: y }}
				onMouseDown={handleMouseDown}
			>
				{editing && (
					<div className='absolute -top-2 -right-2 cursor-move'>
						<DraggerSVG className='w-4 h-4' />
					</div>
				)}
				<button
					onClick={() => !editing && setShowStore(!showStore)}
					className='card squircle p-3 shadow-2xl hover:scale-105 transition-transform'
					title='组件商店'
				>
					<Store className='w-5 h-5 text-brand' />
				</button>
			</div>

			{showStore && (
				<div className='fixed top-20 right-24 z-[9999] card squircle p-6 shadow-2xl w-96 max-h-[600px] overflow-y-auto'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-lg font-medium'>组件商店</h3>
						<button onClick={() => setShowStore(false)} className='p-1 hover:bg-gray-100 rounded'>
							<X className='w-4 h-4' />
						</button>
					</div>

					<button
						onClick={() => setShowNewComponent(!showNewComponent)}
						className='w-full mb-4 px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2'
					>
						<Plus className='w-4 h-4' />
						创建新组件
					</button>

					{showNewComponent && (
						<div className='mb-4 p-4 border rounded-lg space-y-3'>
							<input
								type='text'
								placeholder='组件名称'
								value={newComp.name}
								onChange={e => setNewComp({ ...newComp, name: e.target.value })}
								className='w-full px-3 py-2 border rounded text-sm'
							/>
							<select
								value={newComp.type}
								onChange={e => setNewComp({ ...newComp, type: e.target.value as any })}
								className='w-full px-3 py-2 border rounded text-sm'
							>
								<option value='text'>文本</option>
								<option value='image'>图片</option>
								<option value='link'>链接</option>
								<option value='iframe'>嵌入页面</option>
							</select>
							<select
								value={newComp.templateId}
								onChange={e => setNewComp({ ...newComp, templateId: e.target.value })}
								className='w-full px-3 py-2 border rounded text-sm'
							>
								{CARD_TEMPLATES.map(t => (
									<option key={t.id} value={t.id}>{t.name} ({t.style.width}×{t.style.height})</option>
								))}
							</select>
							{newComp.type === 'text' && (
								<textarea
									placeholder='输入文本内容'
									value={newComp.content.text}
									onChange={e => setNewComp({ ...newComp, content: { ...newComp.content, text: e.target.value } })}
									className='w-full px-3 py-2 border rounded text-sm'
									rows={3}
								/>
							)}
							{newComp.type === 'image' && (
								<input
									type='text'
									placeholder='图片 URL'
									value={newComp.content.imageUrl}
									onChange={e => setNewComp({ ...newComp, content: { ...newComp.content, imageUrl: e.target.value } })}
									className='w-full px-3 py-2 border rounded text-sm'
								/>
							)}
							{newComp.type === 'link' && (
								<>
									<input
										type='text'
										placeholder='链接文本'
										value={newComp.content.text}
										onChange={e => setNewComp({ ...newComp, content: { ...newComp.content, text: e.target.value } })}
										className='w-full px-3 py-2 border rounded text-sm'
									/>
									<input
										type='text'
										placeholder='链接 URL'
										value={newComp.content.linkUrl}
										onChange={e => setNewComp({ ...newComp, content: { ...newComp.content, linkUrl: e.target.value } })}
										className='w-full px-3 py-2 border rounded text-sm'
									/>
								</>
							)}
							{newComp.type === 'iframe' && (
								<input
									type='text'
									placeholder='嵌入页面 URL'
									value={newComp.content.iframeUrl}
									onChange={e => setNewComp({ ...newComp, content: { ...newComp.content, iframeUrl: e.target.value } })}
									className='w-full px-3 py-2 border rounded text-sm'
								/>
							)}
							<button onClick={editingId ? handleSaveEdit : handleCreateComponent} className='w-full px-4 py-2 bg-green-500 text-white rounded text-sm'>
								{editingId ? '保存' : '创建'}
							</button>
						</div>
					)}

					{customComponents.length > 0 && (
						<div className='mb-4'>
							<h4 className='text-sm font-medium mb-2'>我的组件</h4>
							<div className='space-y-2'>
								{customComponents.map(comp => (
									<div key={comp.id} className='border rounded-lg p-3 bg-blue-50'>
										<div className='flex items-start justify-between'>
											<div className='flex-1'>
												<div className='font-medium text-sm'>{comp.name}</div>
												<div className='text-xs text-gray-500 mt-1'>
													{comp.style.width}×{comp.style.height} · {comp.type}
												</div>
											</div>
											<div className='flex gap-2'>
												<button
													onClick={() => handleEditComponent(comp)}
													className='px-3 py-1 text-xs rounded bg-blue-100 text-blue-600'
												>
													编辑
												</button>
												<button
													onClick={() => {
														if (confirm(`确定删除组件 "${comp.name}"？`)) {
															deleteCustomComponent(comp.id)
															toast.success(`已删除 ${comp.name}`)
														}
													}}
													className='px-3 py-1 text-xs rounded bg-red-100 text-red-600'
												>
													删除
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					<div className='pt-4 border-t'>
						<h4 className='text-sm font-medium mb-3'>样式模板</h4>
						<div className='text-xs text-gray-500 mb-2'>创建新组件时可选择以下模板尺寸</div>
						<div className='grid grid-cols-2 gap-2'>
							{CARD_TEMPLATES.map(template => (
								<div
									key={template.id}
									onClick={() => handleCreateFromTemplate(template.id)}
									className='border rounded p-2 text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors'
								>
									<div className='font-medium'>{template.name}</div>
									<div className='text-gray-500 text-[10px]'>{template.description}</div>
									<div className='text-gray-400 text-[10px] mt-1'>
										{template.style.width}×{template.style.height}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
