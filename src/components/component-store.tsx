'use client'

import { Store, X, Plus, Star, Copy, Save } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTemplateStore } from '../app/(home)/stores/template-store'
import { useCustomComponentStore } from '../app/(home)/stores/custom-component-store'
import { useComponentFavoriteStore } from '../app/(home)/stores/component-favorite-store'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLayoutEditStore } from '../app/(home)/stores/layout-edit-store'
import { useAuthStore } from '@/hooks/use-auth'
import { useLogStore } from '../app/(home)/stores/log-store'
import { useCenterStore } from '@/hooks/use-center'
import { CARD_TEMPLATES } from '@/config/card-templates'
import { COMPONENT_REGISTRY } from '@/config/component-registry'
import { toast } from 'sonner'
import customComponentsDefault from '@/config/custom-components.json'
import DraggerSVG from '@/svgs/dragger.svg'
import { hashFileSHA256 } from '@/lib/file-utils'
import { getFileExt } from '@/lib/utils'

export function ComponentStore() {
	const [mounted, setMounted] = useState(false)
	const [showStore, setShowStore] = useState(false)
	const [showNewComponent, setShowNewComponent] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [activeTab, setActiveTab] = useState<'templates' | 'favorites' | 'builtin'>('templates')
	const { components: customComponents, addComponent: addCustomComponent, updateComponent, deleteComponent: deleteCustomComponent } = useCustomComponentStore()
	const { favorites, addFavorite, deleteFavorite } = useComponentFavoriteStore()
	const { cardStyles, saveLayout } = useConfigStore()
	const { isAuth } = useAuthStore()
	const addLog = useLogStore(state => state.addLog)
	const editing = useLayoutEditStore(state => state.editing)
	const setOffset = useLayoutEditStore(state => state.setOffset)
	const center = useCenterStore()
	const [isSaving, setIsSaving] = useState(false)

	const styles = cardStyles.componentStoreButton
	const x = styles?.offsetX !== null ? center.x + (styles?.offsetX || 0) : (typeof window !== 'undefined' ? window.innerWidth - 24 - 48 - 72 : 0)
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
	const [pendingImageFile, setPendingImageFile] = useState<{ file: File; previewUrl: string; hash: string } | null>(null)

	useEffect(() => {
		setMounted(true)

		// 加载模板
		const savedTemplates = localStorage.getItem('templates')
		if (savedTemplates) {
			useTemplateStore.setState({ templates: JSON.parse(savedTemplates) })
		}

		// 加载自定义组件
		const savedCustom = localStorage.getItem('custom-components')
		const customToLoad = savedCustom ? JSON.parse(savedCustom) : customComponentsDefault
		useCustomComponentStore.setState({ components: customToLoad })

		// 加载收藏
		const savedFavorites = localStorage.getItem('component-favorites')
		if (savedFavorites) {
			useComponentFavoriteStore.setState({ favorites: JSON.parse(savedFavorites) })
		}
	}, [])

	// 共用的图片上传逻辑
	const uploadImageFile = async (imageUrl: string): Promise<boolean> => {
		if (!pendingImageFile) return true
		if (process.env.NODE_ENV === 'development') {
			try {
				const formData = new FormData()
				formData.append('file', pendingImageFile.file)
				formData.append('path', `public${imageUrl}`)
				const response = await fetch('/api/upload-image', { method: 'POST', body: formData })
				if (!response.ok) {
					const errData = await response.json().catch(() => ({}))
					throw new Error(errData.error || `上传失败 (${response.status})`)
				}
				toast.success('图片已保存')
				return true
			} catch (error) {
				toast.error('图片保存失败')
				console.error(error)
				return false
			}
		} else {
			try {
				const { fileToBase64NoPrefix } = await import('@/lib/file-utils')
				const { getAuthToken } = await import('@/lib/auth')
				const { createBlob, getRef, createTree, createCommit, updateRef } = await import('@/lib/github-client')
				const { GITHUB_CONFIG } = await import('@/consts')
				const token = await getAuthToken()
				const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
				const contentBase64 = await fileToBase64NoPrefix(pendingImageFile.file)
				const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
				const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, [{ path: `public${imageUrl}`, mode: '100644', type: 'blob', sha: blobData.sha }], refData.sha)
				const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `上传自定义组件图片`, treeData.sha, [refData.sha])
				await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)
				toast.success('图片上传成功')
				return true
			} catch (error) {
				toast.error('图片上传失败')
				console.error(error)
				return false
			}
		}
	}

	const handleCreateComponent = async () => {
		if (!newComp.name.trim()) {
			toast.error('请输入组件名称')
			return
		}
		const template = CARD_TEMPLATES.find(t => t.id === newComp.templateId)
		if (!template) return

		let finalImageUrl = newComp.content.imageUrl

		// 上传图片
		if (pendingImageFile && newComp.type === 'image') {
			const ok = await uploadImageFile(finalImageUrl)
			if (!ok) return
		}

		const newComponent = {
			name: newComp.name,
			type: newComp.type,
			templateId: newComp.templateId,
			style: {
				...template.style,
				order: 99,
				offsetX: 0,
				offsetY: 0,
				enabled: true
			},
			content: { ...newComp.content, imageUrl: finalImageUrl }
		}

		addCustomComponent(newComponent)
		toast.success(`组件 "${newComp.name}" 已创建`)
		setNewComp({ name: '', type: 'text', templateId: 'medium-rect', content: { text: '', imageUrl: '', linkUrl: '', iframeUrl: '' } })
		setPendingImageFile(null)
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

	const handleSaveEdit = async () => {
		if (!editingId || !newComp.name.trim()) return

		const template = CARD_TEMPLATES.find(t => t.id === newComp.templateId)
		if (!template) return

		const currentComp = customComponents.find(c => c.id === editingId)
		if (!currentComp) return

		let finalImageUrl = newComp.content.imageUrl

		// 编辑时也要处理图片上传
		if (pendingImageFile && newComp.type === 'image') {
			const ok = await uploadImageFile(finalImageUrl)
			if (!ok) return
		}

		updateComponent(editingId, {
			name: newComp.name,
			type: newComp.type,
			templateId: newComp.templateId,
			content: { ...newComp.content, imageUrl: finalImageUrl },
			style: {
				...template.style,
				order: currentComp.style.order,
				offsetX: currentComp.style.offsetX,
				offsetY: currentComp.style.offsetY,
				enabled: currentComp.style.enabled
			}
		})
		toast.success('组件已更新')
		setEditingId(null)
		setNewComp({ name: '', type: 'text', templateId: 'medium-rect', content: { text: '', imageUrl: '', linkUrl: '', iframeUrl: '' } })
		setPendingImageFile(null)
		setShowNewComponent(false)
	}

	const handleCancelEdit = () => {
		setEditingId(null)
		setNewComp({ name: '', type: 'text', templateId: 'medium-rect', content: { text: '', imageUrl: '', linkUrl: '', iframeUrl: '' } })
		setPendingImageFile(null)
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
				offsetX: 0,
				offsetY: 0,
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

	const handleSaveFavorite = (comp: any) => {
		const { id, ...componentData } = comp
		addFavorite(comp.name, componentData)
		toast.success(`已收藏 ${comp.name}`)
	}

	const handleCreateFromFavorite = (favId: string) => {
		const fav = favorites.find(f => f.id === favId)
		if (!fav) return
		addCustomComponent(fav.component)
		toast.success(`已创建 ${fav.name}`)
		useLayoutEditStore.getState().startEditing()
	}

	const handleCloneBuiltin = (builtinId: string) => {
		const meta = COMPONENT_REGISTRY[builtinId]
		const style = cardStyles[builtinId as keyof typeof cardStyles]
		if (!meta || !style) return

		const newComponent = {
			name: `${meta.name}副本`,
			type: 'custom' as const,
			templateId: 'medium-rect',
			style: {
				width: style.width || 200,
				height: style.height || 200,
				order: 99,
				offsetX: 0,
				offsetY: 0,
				enabled: true
			},
			content: { html: `<div>克隆自${meta.name}</div>` }
		}

		addCustomComponent(newComponent)
		toast.success(`已克隆 ${meta.name}`)
		useLayoutEditStore.getState().startEditing()
	}

	const handleSaveComponents = async () => {
		setIsSaving(true)
		try {
			const componentsJson = JSON.stringify(customComponents, null, '\t')
			if (process.env.NODE_ENV === 'development') {
				await fetch('/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ customComponents })
				})
				toast.success('自定义组件已保存到项目')
				addLog('success', 'component', '自定义组件已保存到本地项目')
			} else if (isAuth) {
				const { getAuthToken } = await import('@/lib/auth')
				const { getRef, createBlob, createTree, createCommit, updateRef, toBase64Utf8 } = await import('@/lib/github-client')
				const { GITHUB_CONFIG } = await import('@/consts')
				const token = await getAuthToken()
				const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
				const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(componentsJson), 'base64')
				const tree = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, [
					{ path: 'src/config/custom-components.json', mode: '100644', type: 'blob', sha: blob.sha }
				], ref.sha)
				const commit = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '保存自定义组件', tree.sha, [ref.sha])
				await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commit.sha)
				toast.success('自定义组件已推送到 GitHub')
				addLog('success', 'component', '自定义组件已推送到 GitHub')
			} else {
				toast.error('线上环境需要先导入密钥')
				addLog('error', 'component', '保存失败：未导入密钥')
			}
		} catch (error) {
			console.error('Save components error:', error)
			toast.error('保存失败')
			addLog('error', 'component', '保存自定义组件失败', error)
		} finally {
			setIsSaving(false)
		}
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
				<div className='fixed top-20 right-24 z-[9999] card squircle p-6 shadow-2xl w-96 max-h-[600px] overflow-y-auto scrollbar-none'>
					<div className='flex items-center justify-between mb-4'>
						<div>
							<h3 className='text-lg font-medium'>组件商店</h3>
							<p className='text-[10px] text-secondary/60 mt-0.5'>修改后请点击底部"保存到项目"按钮持久化</p>
						</div>
						<button onClick={() => setShowStore(false)} className='p-1 hover:bg-gray-100 rounded shrink-0'>
							<X className='w-4 h-4' />
						</button>
					</div>

					<div className='flex gap-2 mb-4 border-b'>
						<button onClick={() => setActiveTab('templates')} className={`px-3 py-2 text-sm ${activeTab === 'templates' ? 'border-b-2 border-brand text-brand' : 'text-gray-500'}`}>
							模板
						</button>
						<button onClick={() => setActiveTab('favorites')} className={`px-3 py-2 text-sm ${activeTab === 'favorites' ? 'border-b-2 border-brand text-brand' : 'text-gray-500'}`}>
							收藏
						</button>
						<button onClick={() => setActiveTab('builtin')} className={`px-3 py-2 text-sm ${activeTab === 'builtin' ? 'border-b-2 border-brand text-brand' : 'text-gray-500'}`}>
							内置
						</button>
					</div>

					<button
						onClick={() => setShowNewComponent(!showNewComponent)}
						className='w-full mb-4 px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2'
					>
						<Plus className='w-4 h-4' />
						创建新组件
					</button>

					{activeTab === 'templates' && (
						<>
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
								<>
									<label className='flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-secondary hover:border-brand hover:text-brand cursor-pointer transition-colors'>
										<Plus className='w-4 h-4' />
										选择图片文件
										<input
											type='file'
											accept='image/*'
											className='hidden'
											onChange={async e => {
												const file = e.target.files?.[0]
												if (!file) return
												const hash = await hashFileSHA256(file)
												const ext = getFileExt(file.name)
												const targetPath = `/images/custom-components/${hash}${ext}`
												const previewUrl = URL.createObjectURL(file)
												setPendingImageFile({ file, previewUrl, hash })
												setNewComp({ ...newComp, content: { ...newComp.content, imageUrl: targetPath } })
											}}
										/>
									</label>
									<input
										type='text'
										placeholder='或输入图片 URL'
										value={newComp.content.imageUrl}
										onChange={e => {
											setPendingImageFile(null)
											setNewComp({ ...newComp, content: { ...newComp.content, imageUrl: e.target.value } })
										}}
										className='w-full px-3 py-2 border rounded text-sm'
									/>
									{pendingImageFile && (
										<img src={pendingImageFile.previewUrl} alt='预览' className='w-full h-20 object-cover rounded border' />
									)}
									{!pendingImageFile && newComp.content.imageUrl && (
										<img src={newComp.content.imageUrl} alt='预览' className='w-full h-20 object-cover rounded border' />
									)}
								</>
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
							<div className='flex gap-2'>
								<button onClick={editingId ? handleSaveEdit : handleCreateComponent} className='flex-1 px-4 py-2 bg-green-500 text-white rounded text-sm'>
									{editingId ? '保存' : '创建'}
								</button>
								<button onClick={handleCancelEdit} className='flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm'>
									取消
								</button>
							</div>
						</div>
					)}

							{customComponents.length > 0 && (
								<div className='mb-4'>
									<h4 className='text-sm font-medium mb-2'>我的组件</h4>
									<div className='space-y-2'>
										{customComponents.map(comp => {
											const template = CARD_TEMPLATES.find(t => t.id === comp.templateId)
											const isCustomSize = template && (comp.style.width !== template.style.width || comp.style.height !== template.style.height)
											const sizeLabel = isCustomSize ? `自定义 ${comp.style.width}×${comp.style.height}` : `${comp.style.width}×${comp.style.height}`

											return (
											<div key={comp.id} className='border rounded-lg p-3 bg-blue-50'>
												<div className='flex items-start justify-between'>
													<div className='flex-1'>
														<div className='font-medium text-sm'>{comp.name}</div>
														<div className='text-xs text-gray-500 mt-1'>
															{sizeLabel} · {comp.type}
														</div>
													</div>
													<div className='flex gap-1'>
														<button onClick={() => handleSaveFavorite(comp)} className='px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-600' title='收藏'>
															<Star className='w-3 h-3' />
														</button>
														<button onClick={() => handleEditComponent(comp)} className='px-2 py-1 text-xs rounded bg-blue-100 text-blue-600'>
															编辑
														</button>
														<button
															onClick={() => {
																if (confirm(`确定删除组件 "${comp.name}"？`)) {
																	deleteCustomComponent(comp.id)
																	toast.success(`已删除 ${comp.name}`)
																}
															}}
															className='px-2 py-1 text-xs rounded bg-red-100 text-red-600'
														>
															删除
														</button>
													</div>
												</div>
											</div>
										)})}
									</div>
								</div>
							)}

							<div className='pt-4 border-t'>
								<h4 className='text-sm font-medium mb-3'>样式模板</h4>
								<div className='text-xs text-gray-500 mb-2'>点击快速创建</div>
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
						</>
					)}

					{activeTab === 'favorites' && (
						<div>
							<div className='flex flex-wrap gap-2 mb-3'>
								<button
									onClick={() => {
										const blob = new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json' })
										const url = URL.createObjectURL(blob)
										const a = document.createElement('a')
										a.href = url
										a.download = `component-favorites-${Date.now()}.json`
										a.click()
										URL.revokeObjectURL(url)
										toast.success('收藏已导出')
									}}
									disabled={favorites.length === 0}
									className='px-3 py-1.5 text-xs rounded-lg border bg-white/60 hover:bg-white/80 transition-colors disabled:opacity-40'
								>
									导出收藏
								</button>
								<label className='px-3 py-1.5 text-xs rounded-lg border bg-white/60 hover:bg-white/80 transition-colors cursor-pointer'>
									导入收藏
									<input
										type='file'
										accept='.json'
										className='hidden'
										onChange={async e => {
											const file = e.target.files?.[0]
											if (!file) return
											try {
												const text = await file.text()
												const imported = JSON.parse(text)
												if (!Array.isArray(imported)) throw new Error('格式错误')
												for (const fav of imported) {
													if (fav.name && fav.component) {
														addFavorite(fav.name, fav.component)
													}
												}
												toast.success(`已导入 ${imported.length} 个收藏`)
											} catch {
												toast.error('导入失败，请检查文件格式')
											}
											e.target.value = ''
										}}
									/>
								</label>
							</div>
							<p className='text-[10px] text-secondary/60 mb-3'>
								收藏仅存储在浏览器本地，清除缓存后将丢失，请及时导出备份。导出不包含已上传的图片文件，仅保留图片路径（网络链接可正常使用）。
							</p>
							{favorites.length === 0 ? (
								<div className='text-center text-gray-400 py-8 text-sm'>暂无收藏</div>
							) : (
								<div className='space-y-2'>
									{favorites.map(fav => (
										<div key={fav.id} className='border rounded-lg p-3 bg-yellow-50'>
											<div className='flex items-start justify-between'>
												<div className='flex-1'>
													<div className='font-medium text-sm'>{fav.name}</div>
													<div className='text-xs text-gray-500 mt-1'>
														{fav.component.style.width}×{fav.component.style.height} · {fav.component.type}
													</div>
												</div>
												<div className='flex gap-1'>
													<button onClick={() => handleCreateFromFavorite(fav.id)} className='px-2 py-1 text-xs rounded bg-green-100 text-green-600'>
														创建
													</button>
													<button
														onClick={() => {
															if (confirm(`确定删除收藏 "${fav.name}"？`)) {
																deleteFavorite(fav.id)
																toast.success('已删除收藏')
															}
														}}
														className='px-2 py-1 text-xs rounded bg-red-100 text-red-600'
													>
														删除
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{activeTab === 'builtin' && (
						<div>
							<div className='text-xs text-gray-500 mb-3'>克隆内置组件为自定义组件</div>
							<div className='space-y-2'>
								{Object.entries(COMPONENT_REGISTRY).map(([id, meta]) => (
									<div key={id} className='border rounded-lg p-3 hover:bg-gray-50'>
										<div className='flex items-center justify-between'>
											<div className='flex-1'>
												<div className='font-medium text-sm'>{meta.name}</div>
											</div>
											<button onClick={() => handleCloneBuiltin(id)} className='px-3 py-1 text-xs rounded bg-purple-100 text-purple-600 flex items-center gap-1'>
												<Copy className='w-3 h-3' />
												克隆
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* 保存按钮 */}
					<div className='mt-4 pt-3 border-t'>
						<button
							onClick={handleSaveComponents}
							disabled={isSaving}
							className='w-full px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50'
						>
							<Save className='w-4 h-4' />
							{isSaving ? '保存中...' : '保存到项目'}
						</button>
						<p className='text-[10px] text-secondary/60 mt-1.5 text-center'>
							点击保存后才会持久化到项目，否则仅存在于浏览器缓存中
						</p>
					</div>
				</div>
			)}
		</>
	)
}
