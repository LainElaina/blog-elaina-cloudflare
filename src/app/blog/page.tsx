'use client'

import Link from 'next/link'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { motion } from 'motion/react'

dayjs.extend(weekOfYear)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ANIMATION_DELAY, INIT_DELAY } from '@/consts'
import ShortLineSVG from '@/svgs/short-line.svg'
import { useBlogIndex, type BlogIndexItem } from '@/hooks/use-blog-index'
import { useCategories } from '@/hooks/use-categories'
import { useBlogFolders } from '@/hooks/use-blog-folders'
import { useReadArticles } from '@/hooks/use-read-articles'
import GitHubSVG from '@/svgs/github.svg'
import { useAuthStore } from '@/hooks/use-auth'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { readFileAsText } from '@/lib/file-utils'
import { cn } from '@/lib/utils'
import { buildLocalSaveFilePayloads, saveBlogEdits } from './services/save-blog-edits'
import { Check } from 'lucide-react'
import { CategoryModal } from './components/category-modal'
import { hasBlogSaveChanges, normalizeCategoryList } from './save-change-detection'
import { assignFolderPath, BLOG_FOLDER_ALL, BLOG_FOLDER_UNFILED, buildFolderGroups, collectFolderPaths, formatFolderOptionLabel, getFilteredDisplayItems, retainSelectionInView } from './blog-filters'
import { getAssignFolderActionState, getClearFolderActionState } from './folder-edit-actions'
import { buildClearFolderDialogCopy } from './folder-interactions'

type DisplayMode = 'day' | 'week' | 'month' | 'year' | 'category' | 'folder'

export default function BlogPage() {
	const { items, loading } = useBlogIndex()
	const { categories: categoriesFromServer } = useCategories()
	const { folders } = useBlogFolders()
	const { isRead } = useReadArticles()
	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false
	const enableCategories = siteContent.enableCategories ?? false

	const keyInputRef = useRef<HTMLInputElement>(null)
	const [editMode, setEditMode] = useState(false)
	const [editableItems, setEditableItems] = useState<BlogIndexItem[]>([])
	const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())
	const [saving, setSaving] = useState(false)
	const [displayMode, setDisplayMode] = useState<DisplayMode>('year')
	const [categoryModalOpen, setCategoryModalOpen] = useState(false)
	const [categoryList, setCategoryList] = useState<string[]>([])
	const [newCategory, setNewCategory] = useState('')
	const [favoritesOnly, setFavoritesOnly] = useState(false)
	const [activeFolderPath, setActiveFolderPath] = useState<string>(BLOG_FOLDER_ALL)
	const [assignFolderPathValue, setAssignFolderPathValue] = useState<string>(BLOG_FOLDER_ALL)

	useEffect(() => {
		if (!editMode) {
			setEditableItems(items)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editMode])

	useEffect(() => {
		setCategoryList(prev => {
			if (prev.length === categoriesFromServer.length && prev.every((item, index) => item === categoriesFromServer[index])) {
				return prev
			}
			return categoriesFromServer
		})
	}, [categoriesFromServer])

	const displayItems = editMode ? editableItems : items
	const availableFolderPaths = useMemo(() => collectFolderPaths(displayItems, folders), [displayItems, folders])
	const filteredDisplayItems = useMemo(
		() =>
			getFilteredDisplayItems(displayItems, {
				favoritesOnly,
				activeFolderPath,
				displayMode
			}),
		[displayItems, favoritesOnly, activeFolderPath, displayMode]
	)

	const { groupedItems, groupKeys, getGroupLabel } = useMemo(() => {
		if (displayMode === 'folder') {
			return buildFolderGroups(filteredDisplayItems)
		}

		const sorted = [...filteredDisplayItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

		const grouped = sorted.reduce(
			(acc, item) => {
				let key: string
				let label: string
				const date = dayjs(item.date)

				switch (displayMode) {
					case 'category':
						key = item.category || '未分类'
						label = key
						break
					case 'day':
						key = date.format('YYYY-MM-DD')
						label = date.format('YYYY年MM月DD日')
						break
					case 'week': {
						const week = date.week()
						key = `${date.format('YYYY')}-W${week.toString().padStart(2, '0')}`
						label = `${date.format('YYYY')}年第${week}周`
						break
					}
					case 'month':
						key = date.format('YYYY-MM')
						label = date.format('YYYY年MM月')
						break
					case 'year':
					default:
						key = date.format('YYYY')
						label = date.format('YYYY年')
						break
				}

				if (!acc[key]) {
					acc[key] = { items: [], label }
				}
				acc[key].items.push(item)
				return acc
			},
			{} as Record<string, { items: BlogIndexItem[]; label: string }>
		)

		const keys = Object.keys(grouped).sort((a, b) => {
			if (displayMode === 'category') {
				const categoryOrder = new Map(categoryList.map((c, index) => [c, index]))
				const aOrder = categoryOrder.has(a) ? categoryOrder.get(a)! : Number.MAX_SAFE_INTEGER
				const bOrder = categoryOrder.has(b) ? categoryOrder.get(b)! : Number.MAX_SAFE_INTEGER
				if (aOrder !== bOrder) return aOrder - bOrder
				return a.localeCompare(b)
			}
			if (displayMode === 'week') {
				const [yearA, weekA] = a.split('-W').map(Number)
				const [yearB, weekB] = b.split('-W').map(Number)
				if (yearA !== yearB) return yearB - yearA
				return weekB - weekA
			}
			return b.localeCompare(a)
		})

		return {
			groupedItems: grouped,
			groupKeys: keys,
			getGroupLabel: (key: string) => grouped[key]?.label || key
		}
	}, [filteredDisplayItems, displayMode, categoryList])

	useEffect(() => {
		setSelectedSlugs(prev => retainSelectionInView(prev, filteredDisplayItems))
	}, [filteredDisplayItems])

	const selectedCount = selectedSlugs.size
	const isDev = process.env.NODE_ENV === 'development'
	const buttonText = isDev || isAuth ? '保存' : '导入密钥'

	const toggleEditMode = useCallback(() => {
		if (editMode) {
			setEditMode(false)
			setEditableItems(items)
			setSelectedSlugs(new Set())
			setAssignFolderPathValue(BLOG_FOLDER_ALL)
		} else {
			setEditableItems(items)
			setEditMode(true)
		}
	}, [editMode, items])

	const toggleSelect = useCallback((slug: string) => {
		setSelectedSlugs(prev => {
			const next = new Set(prev)
			if (next.has(slug)) {
				next.delete(slug)
			} else {
				next.add(slug)
			}
			return next
		})
	}, [])

	const handleSelectAll = useCallback(() => {
		setSelectedSlugs(new Set(filteredDisplayItems.map(item => item.slug)))
	}, [filteredDisplayItems])

	const handleSelectGroup = useCallback(
		(groupKey: string) => {
			const group = groupedItems[groupKey]
			if (!group) return

			const groupAllSelected = group.items.every(item => selectedSlugs.has(item.slug))

			setSelectedSlugs(prev => {
				const next = new Set(prev)
				if (groupAllSelected) {
					group.items.forEach(item => {
						next.delete(item.slug)
					})
				} else {
					group.items.forEach(item => {
						next.add(item.slug)
					})
				}
				return next
			})
		},
		[groupedItems, selectedSlugs]
	)

	const handleDeselectAll = useCallback(() => {
		setSelectedSlugs(new Set())
	}, [])

	const handleItemClick = useCallback(
		(event: React.MouseEvent, slug: string) => {
			if (!editMode) return
			event.preventDefault()
			event.stopPropagation()
			toggleSelect(slug)
		},
		[editMode, toggleSelect]
	)

	const handleDeleteSelected = useCallback(() => {
		if (selectedCount === 0) {
			toast.info('请选择要删除的文章')
			return
		}
		setEditableItems(prev => prev.filter(item => !selectedSlugs.has(item.slug)))
		setSelectedSlugs(new Set())
	}, [selectedCount, selectedSlugs])

	const handleAssignCategory = useCallback((slug: string, category?: string) => {
		setEditableItems(prev =>
			prev.map(item => {
				if (item.slug !== slug) return item
				const nextCategory = category?.trim()
				if (!nextCategory) return { ...item, category: undefined }
				return { ...item, category: nextCategory }
			})
		)
	}, [])

	const handleAssignFolderPathForSelected = useCallback(() => {
		const actionState = getAssignFolderActionState({
			selectedCount,
			availableFolderPaths,
			selectedFolderPath: assignFolderPathValue
		})
		if (!actionState.allowed) {
			if (actionState.message) {
				toast.info(actionState.message)
			}
			return
		}
		const nextPath = assignFolderPathValue === BLOG_FOLDER_ALL ? undefined : assignFolderPathValue
		setEditableItems(prev => assignFolderPath(prev, selectedSlugs, nextPath))
	}, [selectedCount, availableFolderPaths, assignFolderPathValue, selectedSlugs])

	const handleClearFolderForSelected = useCallback(() => {
		if (selectedCount === 0) {
			toast.info('请选择要清空目录的文章')
			return
		}
		const actionState = getClearFolderActionState(selectedCount)
		const dialogCopy = buildClearFolderDialogCopy(actionState.selectedCount)
		const confirmed = window.confirm(`${dialogCopy.title}\n\n${dialogCopy.description}`)
		if (!confirmed) return
		setEditableItems(prev => assignFolderPath(prev, selectedSlugs, undefined))
	}, [selectedCount, selectedSlugs])

	const handleAddCategory = useCallback(() => {
		const value = newCategory.trim()
		if (!value) {
			toast.info('请输入分类名称')
			return
		}
		setCategoryList(prev => (prev.includes(value) ? prev : [...prev, value]))
		setNewCategory('')
	}, [newCategory])

	const handleRemoveCategory = useCallback((category: string) => {
		setCategoryList(prev => prev.filter(item => item !== category))
		setEditableItems(prev => prev.map(item => (item.category === category ? { ...item, category: undefined } : item)))
	}, [])

	const handleReorderCategories = useCallback((nextList: string[]) => {
		setCategoryList(nextList)
	}, [])

	const handleCancel = useCallback(() => {
		setEditableItems(items)
		setSelectedSlugs(new Set())
		setAssignFolderPathValue(BLOG_FOLDER_ALL)
		setEditMode(false)
	}, [items])

	const handleSave = useCallback(async () => {
		const removedSlugs = items.filter(item => !editableItems.some(editItem => editItem.slug === item.slug)).map(item => item.slug)
		const normalizedCategoryList = normalizeCategoryList(categoryList)
		const hasChanges = hasBlogSaveChanges({
			items,
			editableItems,
			categoryList,
			categoriesFromServer
		})

		if (!hasChanges) {
			toast.info('没有需要保存的改动')
			return
		}

		try {
			setSaving(true)
			if (process.env.NODE_ENV === 'development') {
				const uniqueRemoved = Array.from(new Set(removedSlugs.filter(Boolean)))
				for (const slug of uniqueRemoved) {
					await fetch('/api/delete-dir', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ path: `public/blogs/${slug}` })
					})
				}

				let existingStorageRaw: string | null = null
				try {
					const response = await fetch('/blogs/storage.json', { cache: 'no-store' })
					if (response.ok) {
						existingStorageRaw = await response.text()
					}
				} catch {
					existingStorageRaw = null
				}

				const payloads = buildLocalSaveFilePayloads({
					originalItems: items,
					nextItems: editableItems,
					categories: normalizedCategoryList,
					existingStorageRaw
				})
				for (const payload of payloads) {
					await fetch('/api/save-file', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
				}
				toast.success('保存成功！')
			} else {
				await saveBlogEdits(items, editableItems, normalizedCategoryList)
			}
			setEditMode(false)
			setSelectedSlugs(new Set())
			setCategoryModalOpen(false)
			setAssignFolderPathValue(BLOG_FOLDER_ALL)
		} catch (error: any) {
			console.error(error)
			toast.error(error?.message || '保存失败')
		} finally {
			setSaving(false)
		}
	}, [items, editableItems, categoryList, categoriesFromServer])

	const handleSaveClick = useCallback(() => {
		if (process.env.NODE_ENV === 'development') {
			void handleSave()
			return
		}
		if (!isAuth) {
			keyInputRef.current?.click()
			return
		}
		void handleSave()
	}, [handleSave, isAuth])

	const handlePrivateKeySelection = useCallback(
		async (file: File) => {
			try {
				const pem = await readFileAsText(file)
				setPrivateKey(pem)
				toast.success('密钥导入成功，请再次点击保存')
			} catch (error) {
				console.error(error)
				toast.error('读取密钥失败')
			}
		},
		[setPrivateKey]
	)

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!editMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				toggleEditMode()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [editMode, toggleEditMode])

	return (
		<>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (f) await handlePrivateKeySelection(f)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

			<div className='flex flex-col items-center justify-center gap-6 px-6 pt-24 max-sm:pt-24'>
				{items.length > 0 && (
					<>
						<motion.div
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							className='card btn-rounded relative mx-auto flex flex-wrap items-center justify-center gap-2 p-1 max-sm:hidden'>
							{[
								{ value: 'day', label: '日' },
								{ value: 'week', label: '周' },
								{ value: 'month', label: '月' },
								{ value: 'year', label: '年' },
								...(enableCategories ? ([{ value: 'category', label: '分类' }] as const) : []),
								{ value: 'folder', label: '目录' }
							].map(option => (
								<motion.button
									key={option.value}
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setDisplayMode(option.value as DisplayMode)}
									className={cn(
										'btn-rounded px-3 py-1.5 text-xs font-medium transition-all',
										displayMode === option.value ? 'bg-brand text-white shadow-sm' : 'text-secondary hover:text-brand hover:bg-white/60'
									)}>
									{option.label}
								</motion.button>
							))}
							<div className='mx-1 h-4 w-px bg-gray-200'></div>
							<label className='text-secondary flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium'>
								<input type='checkbox' checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} />
								仅看精选
							</label>
							{displayMode === 'folder' && (
								<select
									value={activeFolderPath}
									onChange={event => setActiveFolderPath(event.target.value)}
									className='rounded-full border bg-white/80 px-3 py-1.5 text-xs'>
									<option value={BLOG_FOLDER_ALL}>全部目录</option>
									<option value={BLOG_FOLDER_UNFILED}>未归档</option>
									{availableFolderPaths.map(path => (
										<option key={path} value={path}>
											{formatFolderOptionLabel(path)}
										</option>
									))}
								</select>
							)}
						</motion.div>
					</>
				)}

				{groupKeys.map(groupKey => {
					const group = groupedItems[groupKey]
					if (!group) return null

					return (
						<motion.div
							key={groupKey}
							initial={{ opacity: 0, scale: 0.95 }}
							whileInView={{ opacity: 1, scale: 1 }}
							transition={{ delay: INIT_DELAY / 2 }}
							className='card relative w-full max-w-[840px] space-y-6'>
							<div className='mb-3 flex items-center justify-between gap-3 text-base'>
								<div className='flex items-center gap-3'>
									<div className='font-medium'>{getGroupLabel(groupKey)}</div>
									<div className='h-2 w-2 rounded-full bg-[#D9D9D9]'></div>
									<div className='text-secondary text-sm'>{group.items.length} 篇文章</div>
								</div>
								{editMode &&
									(() => {
										const groupAllSelected = group.items.every(item => selectedSlugs.has(item.slug))
										return (
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={() => handleSelectGroup(groupKey)}
												className={cn(
													'rounded-lg border px-3 py-1 text-xs transition-colors',
													groupAllSelected
														? 'border-brand/40 bg-brand/10 text-brand hover:bg-brand/20'
														: 'text-secondary hover:border-brand/40 hover:text-brand border-transparent bg-white/60 hover:bg-white/80'
												)}>
												{groupAllSelected ? '取消全选' : '全选该分组'}
											</motion.button>
										)
									})()}
							</div>
							<div>
								{group.items.map(it => {
									const hasRead = isRead(it.slug)
									const isSelected = selectedSlugs.has(it.slug)
									return (
										<Link
											href={`/blog/${it.slug}`}
											key={it.slug}
											onClick={event => handleItemClick(event, it.slug)}
											className={cn(
												'group flex min-h-10 items-center gap-3 py-3 transition-all',
												editMode
													? cn('rounded-lg border px-3', isSelected ? 'border-brand/60 bg-brand/5' : 'hover:border-brand/40 border-transparent hover:bg-white/60')
													: 'cursor-pointer'
											)}>
											{editMode && (
												<span
													className={cn(
														'flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold',
														isSelected ? 'border-brand bg-brand text-white' : 'border-[#D9D9D9] text-transparent'
													)}>
													<Check />
												</span>
											)}
											<span className='text-secondary w-[44px] shrink-0 text-sm font-medium'>{dayjs(it.date).format('MM-DD')}</span>
											<div className='relative flex h-2 w-2 items-center justify-center'>
												<div className='bg-secondary group-hover:bg-brand h-[5px] w-[5px] rounded-full transition-all group-hover:h-4'></div>
												<ShortLineSVG className='absolute bottom-4' />
											</div>
											<div className={cn('flex-1 truncate text-sm font-medium transition-all', editMode ? null : 'group-hover:text-brand group-hover:translate-x-2')}>
												{it.title || it.slug}
												{hasRead && <span className='text-secondary ml-2 text-xs'>[已阅读]</span>}
											</div>
											<div className='flex flex-wrap items-center gap-2 max-sm:hidden'>
												{(it.tags || []).map(t => (
													<span key={t} className='text-secondary text-sm'>
														#{t}
													</span>
												))}
											</div>
										</Link>
									)
								})}
							</div>
						</motion.div>
					)
				})}
				{items.length > 0 && (
					<div className='text-center'>
						<motion.a
							initial={{ opacity: 0, scale: 0.6 }}
							animate={{ opacity: 1, scale: 1 }}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							href='https://github.com/LainElaina'
							target='_blank'
							rel='noreferrer'
							className='card text-secondary static inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs'>
							<GitHubSVG className='h-4 w-4' />
							更多
						</motion.a>
					</div>
				)}
			</div>

			<div className='pt-12'>
				{!loading && displayMode === 'folder' && availableFolderPaths.length === 0 && <div className='text-secondary py-6 text-center text-sm'>暂无目录，请先为文章设置目录</div>}
				{!loading && displayMode === 'folder' && availableFolderPaths.length > 0 && filteredDisplayItems.length === 0 && <div className='text-secondary py-6 text-center text-sm'>当前筛选条件下暂无文章</div>}
				{!loading && displayMode !== 'folder' && filteredDisplayItems.length === 0 && <div className='text-secondary py-6 text-center text-sm'>暂无文章</div>}
				{loading && <div className='text-secondary py-6 text-center text-sm'>加载中...</div>}
			</div>

			<motion.div
				initial={{ opacity: 0, scale: 0.6 }}
				animate={{ opacity: 1, scale: 1 }}
				className='absolute top-4 right-6 flex items-center gap-3 max-sm:hidden'>
				{editMode ? (
					<>
						{enableCategories && (
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setCategoryModalOpen(true)}
								disabled={saving}
								className='rounded-xl border bg-white/60 px-4 py-2 text-sm transition-colors hover:bg-white/80'>
								分类
							</motion.button>
						)}
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={saving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							取消
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={selectedCount === filteredDisplayItems.length && filteredDisplayItems.length > 0 ? handleDeselectAll : handleSelectAll}
							className='rounded-xl border bg-white/60 px-4 py-2 text-sm transition-colors hover:bg-white/80'>
							{selectedCount === filteredDisplayItems.length && filteredDisplayItems.length > 0 ? '取消全选' : '全选'}
						</motion.button>
						<select
							value={assignFolderPathValue}
							onChange={event => setAssignFolderPathValue(event.target.value)}
							className='rounded-xl border bg-white/60 px-3 py-2 text-sm'>
							<option value={BLOG_FOLDER_ALL}>选择目录</option>
							{availableFolderPaths.map(path => (
								<option key={path} value={path}>
									{formatFolderOptionLabel(path)}
								</option>
							))}
						</select>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleAssignFolderPathForSelected}
							disabled={selectedCount === 0}
							className='rounded-xl border bg-white/60 px-4 py-2 text-sm transition-colors disabled:opacity-60'>
							分配目录
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleClearFolderForSelected}
							disabled={selectedCount === 0}
							className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 transition-colors disabled:opacity-60'>
							清空目录
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleDeleteSelected}
							disabled={selectedCount === 0}
							className='rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 transition-colors disabled:opacity-60'>
							删除(已选:{selectedCount}篇)
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSaveClick} disabled={saving} className='brand-btn px-6'>
							{saving ? '保存中...' : buttonText}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={toggleEditMode}
							className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			<CategoryModal
				open={categoryModalOpen}
				onClose={() => setCategoryModalOpen(false)}
				categoryList={categoryList}
				newCategory={newCategory}
				onNewCategoryChange={setNewCategory}
				onAddCategory={handleAddCategory}
				onRemoveCategory={handleRemoveCategory}
				onReorderCategories={handleReorderCategories}
				editableItems={editableItems}
				onAssignCategory={handleAssignCategory}
			/>
		</>
	)
}
