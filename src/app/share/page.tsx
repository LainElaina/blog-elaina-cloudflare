'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'

import GridView from './grid-view'
import CreateDialog from './components/create-dialog'
import type { Share } from './components/share-card'
import type { LogoItem } from './components/logo-upload-dialog'
import { pushShares } from './services/push-shares'
import {
	LOCAL_SHARE_SAVE_PATHS,
	applyShareLogoPathUpdates,
	buildLocalShareSaveFilePayloads,
	type ShareSaveFilePayload
} from './services/share-artifacts'
import {
	createSharePageState,
	replaceSharePageArtifacts,
	setSharePageCategory,
	setSharePageDirectory,
	setSharePageEditMode,
	setSharePageSearchTerm,
	setSharePageSelectedTag,
	type ShareCategoriesArtifact
} from './share-page-state'
import {
	SHARE_CATEGORY_ALL,
	SHARE_DIRECTORY_ALL,
	type ShareFolderNode
} from './share-runtime'
import initialList from '@/../public/share/list.json'
import initialCategories from '@/../public/share/categories.json'
import initialFolders from '@/../public/share/folders.json'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { useAuthStore } from '@/hooks/use-auth'
import { hashFileSHA256 } from '@/lib/file-utils'
import { getFileExt } from '@/lib/utils'

type SharePageArtifacts = {
	list: Share[]
	categories: ShareCategoriesArtifact
	folders: ShareFolderNode[]
}

const INITIAL_ARTIFACTS: SharePageArtifacts = {
	list: initialList as Share[],
	categories: initialCategories as ShareCategoriesArtifact,
	folders: initialFolders as ShareFolderNode[]
}

function createInitialPageState() {
	return createSharePageState({
		listArtifact: INITIAL_ARTIFACTS.list,
		categoriesArtifact: INITIAL_ARTIFACTS.categories,
		foldersArtifact: INITIAL_ARTIFACTS.folders
	})
}

function replaceArtifactsInState<TState extends ReturnType<typeof createInitialPageState>>(
	state: TState,
	nextArtifacts: SharePageArtifacts
) {
	return replaceSharePageArtifacts(state, {
		listArtifact: nextArtifacts.list,
		categoriesArtifact: nextArtifacts.categories,
		foldersArtifact: nextArtifacts.folders
	})
}

function collectTagOptions(shares: Share[], selectedTag: string): string[] {
	const tags = Array.from(new Set(shares.flatMap(share => share.tags)))
	if (selectedTag !== SHARE_CATEGORY_ALL && !tags.includes(selectedTag)) {
		return [selectedTag, ...tags]
	}
	return tags
}

function collectCategoryOptions(availableCategories: string[], activeCategory: string): string[] {
	const scopedCategories = availableCategories.filter(category => category !== SHARE_CATEGORY_ALL)
	if (activeCategory !== SHARE_CATEGORY_ALL && !scopedCategories.includes(activeCategory)) {
		return [SHARE_CATEGORY_ALL, activeCategory, ...scopedCategories]
	}
	return [SHARE_CATEGORY_ALL, ...scopedCategories]
}

function getEmptyMessage(emptyState: ReturnType<typeof createInitialPageState>['runtime']['emptyState']): string {
	switch (emptyState) {
		case 'global-empty':
			return '暂无分享资源'
		case 'directory-empty':
			return '当前目录下暂无资源'
		case 'category-empty':
			return '当前目录下暂无该分类资源'
		case 'filter-empty':
		default:
			return '没有找到相关资源'
	}
}

function parseSavedArtifacts(payloads: ShareSaveFilePayload[], fallback: SharePageArtifacts): SharePageArtifacts {
	const listPayload = payloads.find(payload => payload.path === LOCAL_SHARE_SAVE_PATHS.list)
	const categoriesPayload = payloads.find(payload => payload.path === LOCAL_SHARE_SAVE_PATHS.categories)
	const foldersPayload = payloads.find(payload => payload.path === LOCAL_SHARE_SAVE_PATHS.folders)

	return {
		list: listPayload ? (JSON.parse(listPayload.content) as Share[]) : fallback.list,
		categories: categoriesPayload ? (JSON.parse(categoriesPayload.content) as ShareCategoriesArtifact) : fallback.categories,
		folders: foldersPayload ? (JSON.parse(foldersPayload.content) as ShareFolderNode[]) : fallback.folders
	}
}

export default function Page() {
	const [pageState, setPageState] = useState(() => createInitialPageState())
	const [originalArtifacts, setOriginalArtifacts] = useState<SharePageArtifacts>(INITIAL_ARTIFACTS)
	const [editingShare, setEditingShare] = useState<Share | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [logoItems, setLogoItems] = useState<Map<string, LogoItem>>(new Map())
	const keyInputRef = useRef<HTMLInputElement>(null)

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	const visibleShares = pageState.runtime.visibleItems as Share[]
	const tagOptions = useMemo(
		() => collectTagOptions(pageState.artifacts.list, pageState.filters.selectedTag),
		[pageState.artifacts.list, pageState.filters.selectedTag]
	)
	const categoryOptions = useMemo(
		() => collectCategoryOptions(pageState.runtime.availableCategories, pageState.runtime.activeCategory),
		[pageState.runtime.availableCategories, pageState.runtime.activeCategory]
	)
	const emptyMessage = getEmptyMessage(pageState.runtime.emptyState)

	const handleUpdate = (updatedShare: Share, oldShare: Share, logoItem?: LogoItem) => {
		setPageState(current =>
			replaceArtifactsInState(current, {
				list: current.artifacts.list.map(share => (share.url === oldShare.url ? updatedShare : share)),
				categories: current.artifacts.categories,
				folders: current.artifacts.folders
			})
		)

		if (oldShare.url !== updatedShare.url) {
			setLogoItems(prev => {
				const next = new Map(prev)
				const existingLogoItem = next.get(oldShare.url)
				next.delete(oldShare.url)
				if (existingLogoItem && !logoItem) {
					next.set(updatedShare.url, existingLogoItem)
				}
				return next
			})
		}

		if (logoItem) {
			setLogoItems(prev => {
				const next = new Map(prev)
				next.delete(oldShare.url)
				next.set(updatedShare.url, logoItem)
				return next
			})
		}
	}

	const handleAdd = () => {
		setEditingShare(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveShare = (updatedShare: Share) => {
		setPageState(current => {
			const nextList = editingShare
				? current.artifacts.list.map(share => (share.url === editingShare.url ? updatedShare : share))
				: [...current.artifacts.list, updatedShare]

			return replaceArtifactsInState(current, {
				list: nextList,
				categories: current.artifacts.categories,
				folders: current.artifacts.folders
			})
		})
	}

	const handleDelete = (share: Share) => {
		if (!confirm(`确定要删除 ${share.name} 吗？`)) {
			return
		}

		setPageState(current =>
			replaceArtifactsInState(current, {
				list: current.artifacts.list.filter(item => item.url !== share.url),
				categories: current.artifacts.categories,
				folders: current.artifacts.folders
			})
		)
		setLogoItems(prev => {
			const next = new Map(prev)
			next.delete(share.url)
			return next
		})
	}

	const handleChoosePrivateKey = async (file: File) => {
		try {
			const text = await file.text()
			setPrivateKey(text)
			await handleSave()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleSaveClick = () => {
		if (process.env.NODE_ENV === 'development') {
			handleSave()
		} else if (!isAuth) {
			keyInputRef.current?.click()
		} else {
			handleSave()
		}
	}

	const handleSave = async () => {
		setIsSaving(true)

		const currentShares = pageState.artifacts.list
		const currentCategories = pageState.artifacts.categories
		const currentFolders = pageState.artifacts.folders

		try {
			let nextArtifacts: SharePageArtifacts = {
				list: currentShares,
				categories: currentCategories,
				folders: currentFolders
			}

			if (process.env.NODE_ENV === 'development') {
				const nextLogoPaths = new Map<string, string>()
				for (const [url, logoItem] of logoItems.entries()) {
					if (logoItem.type === 'file') {
						const hash = logoItem.hash || (await hashFileSHA256(logoItem.file))
						const ext = getFileExt(logoItem.file.name)
						const filename = `${hash}${ext}`
						const publicPath = `/images/share/${filename}`
						const formData = new FormData()
						formData.append('file', logoItem.file)
						formData.append('path', `public${publicPath}`)
						await fetch('/api/upload-image', { method: 'POST', body: formData })
						nextLogoPaths.set(url, publicPath)
					}
				}

				const existingStorageResponse = await fetch('/share/storage.json', { cache: 'no-store' })
				const existingStorageRaw = existingStorageResponse.ok ? await existingStorageResponse.text() : null
				const renamedUrls = new Map<string, string>()
				for (const share of currentShares) {
					const previous = originalArtifacts.list.find(item => item.name === share.name)
					if (previous && previous.url !== share.url) {
						renamedUrls.set(share.url, previous.url)
					}
				}

				const updatedShares = applyShareLogoPathUpdates(currentShares, nextLogoPaths)
				const payloads = buildLocalShareSaveFilePayloads(updatedShares, existingStorageRaw, renamedUrls)
				for (const payload of payloads) {
					await fetch('/api/save-file', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ path: payload.path, content: payload.content })
					})
				}

				nextArtifacts = parseSavedArtifacts(payloads, {
					list: updatedShares,
					categories: currentCategories,
					folders: currentFolders
				})
			} else {
				const publishedShares = await pushShares({
					shares: currentShares,
					logoItems,
					originalShares: originalArtifacts.list
				})
				nextArtifacts = {
					list: publishedShares,
					categories: currentCategories,
					folders: currentFolders
				}
			}

			setPageState(current => setSharePageEditMode(replaceArtifactsInState(current, nextArtifacts), false))
			setOriginalArtifacts(nextArtifacts)
			setLogoItems(new Map())
			toast.success('保存成功！')
		} catch (error: any) {
			console.error('Failed to save:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancel = () => {
		setPageState(current => setSharePageEditMode(replaceArtifactsInState(current, originalArtifacts), false))
		setLogoItems(new Map())
	}

	const isDev = process.env.NODE_ENV === 'development'
	const buttonText = isDev || isAuth ? '保存' : '导入密钥'

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!pageState.isEditMode && (e.ctrlKey || e.metaKey) && e.key === ',') {
				e.preventDefault()
				setPageState(current => setSharePageEditMode(current, true))
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [pageState.isEditMode])

	const renderDirectoryNodes = (nodes: ShareFolderNode[], depth = 0): React.ReactNode => {
		return nodes.map(node => {
			const isActive = pageState.filters.activeDirectory === node.path
			return (
				<div key={node.path} className='space-y-1'>
					<button
						type='button'
						onClick={() => setPageState(current => setSharePageDirectory(current, node.path))}
						className={`block w-full rounded-xl py-2 pr-3 text-left text-sm transition-colors ${
							isActive ? 'bg-brand/10 text-brand font-medium' : 'text-gray-700 hover:bg-gray-100'
						}`}
						style={{ paddingLeft: depth * 16 + 12 }}>
						{node.name}
					</button>
					{node.children.length > 0 ? renderDirectoryNodes(node.children, depth + 1) : null}
				</div>
			)
		})
	}

	return (
		<>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem'
				className='hidden'
				onChange={async e => {
					const f = e.target.files?.[0]
					if (f) await handleChoosePrivateKey(f)
					if (e.currentTarget) e.currentTarget.value = ''
				}}
			/>

			<div className='mx-auto w-full max-w-7xl px-6 pt-24 pb-12'>
				<div className='flex gap-8 max-lg:flex-col'>
					<aside className='w-full shrink-0 lg:max-w-xs'>
						<div className='bg-card rounded-2xl border border-white/60 p-4 backdrop-blur-sm lg:sticky lg:top-24'>
							<p className='mb-3 text-sm font-semibold text-gray-900'>目录</p>
							<div className='space-y-1'>
								<button
									type='button'
									onClick={() => setPageState(current => setSharePageDirectory(current, SHARE_DIRECTORY_ALL))}
									className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
										pageState.filters.activeDirectory === SHARE_DIRECTORY_ALL
											? 'bg-brand/10 text-brand font-medium'
											: 'text-gray-700 hover:bg-gray-100'
									}`}>
									全部目录
								</button>
								{renderDirectoryNodes(pageState.runtime.directoryTree)}
							</div>
						</div>
					</aside>

					<div className='min-w-0 flex-1'>
						<div className='mb-6 flex flex-wrap gap-2'>
							{categoryOptions.map(category => (
								<button
									key={category}
									type='button'
									onClick={() => setPageState(current => setSharePageCategory(current, category))}
									className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
										pageState.runtime.activeCategory === category
											? 'bg-brand text-white'
											: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
									}`}>
									{category === SHARE_CATEGORY_ALL ? '全部' : category}
								</button>
							))}
						</div>

						<GridView
							shares={visibleShares}
							searchTerm={pageState.filters.searchTerm}
							onSearchTermChange={value => setPageState(current => setSharePageSearchTerm(current, value))}
							selectedTag={pageState.filters.selectedTag}
							tagOptions={tagOptions}
							onSelectTag={tag => setPageState(current => setSharePageSelectedTag(current, tag))}
							emptyMessage={emptyMessage}
							isEditMode={pageState.isEditMode}
							onUpdate={handleUpdate}
							onDelete={handleDelete}
						/>
					</div>
				</div>
			</div>

			<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex gap-3 max-sm:hidden'>
				{pageState.isEditMode ? (
					<>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleCancel}
							disabled={isSaving}
							className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							取消
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAdd} className='rounded-xl border bg-white/60 px-6 py-2 text-sm'>
							添加
						</motion.button>
						<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSaveClick} disabled={isSaving} className='brand-btn px-6'>
							{isSaving ? '保存中...' : buttonText}
						</motion.button>
					</>
				) : (
					!hideEditButton && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setPageState(current => setSharePageEditMode(current, true))}
							className='bg-card rounded-xl border px-6 py-2 text-sm backdrop-blur-sm transition-colors hover:bg-white/80'>
							编辑
						</motion.button>
					)
				)}
			</motion.div>

			{isCreateDialogOpen && <CreateDialog share={editingShare} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveShare} />}
		</>
	)
}
