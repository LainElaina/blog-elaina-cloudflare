'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'

import GridView from './grid-view'
import CreateDialog from './components/create-dialog'
import { ShareMigrationPanel } from './components/share-migration-panel'
import { ShareFolderSelectFoldersContext } from './components/share-folder-select'
import { ShareCardEditCallbacksContext, type Share } from './components/share-card'
import type { LogoItem } from './components/logo-upload-dialog'
import {
	assertPendingShareUrlAvailable,
	buildShareRuntimeArtifactsFromList,
	collectShareFolderPaths,
	migratePendingShareLogoItems,
	updatePendingShareUrlMappings,
	type ShareEditSubmitPayload
} from './components/share-folder-select-view-model'
import { pushShares } from './services/push-shares'
import {
	LOCAL_SHARE_SAVE_PATHS,
	applyShareLogoPathUpdates,
	buildLocalShareSaveFilePayloads,
	type ShareSaveFilePayload
} from './services/share-artifacts'
import {
	createSharePageState,
	finishShareEditSession,
	mergeEditingSharesIntoVisibleItems,
	replaceSharePageArtifacts,
	resolveShareEditAnchorUrl,
	setSharePageCategory,
	setSharePageDirectory,
	setSharePageEditMode,
	setSharePageSearchTerm,
	setSharePageSelectedTag,
	startShareEditSession,
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
	nextArtifacts: SharePageArtifacts,
	options?: {
		preserveFilters?: boolean
	}
) {
	return replaceSharePageArtifacts(
		state,
		{
			listArtifact: nextArtifacts.list,
			categoriesArtifact: nextArtifacts.categories,
			foldersArtifact: nextArtifacts.folders
		},
		options
	)
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

function buildArtifactsFromList(list: Share[]): SharePageArtifacts {
	const derivedArtifacts = buildShareRuntimeArtifactsFromList(list)
	return {
		list,
		categories: derivedArtifacts.categories,
		folders: derivedArtifacts.folders
	}
}

function replaceShareByUrl(shares: Share[], oldUrl: string, updatedShare: Share) {
	return shares.map(share => (share.url === oldUrl ? updatedShare : share))
}

function removePendingRenamedUrl(next: Map<string, string>, currentUrl: string) {
	next.delete(currentUrl)
	return next
}

export default function Page() {
	const [pageState, setPageState] = useState(() => createInitialPageState())
	const [originalArtifacts, setOriginalArtifacts] = useState<SharePageArtifacts>(INITIAL_ARTIFACTS)
	const [editingShare, setEditingShare] = useState<Share | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [logoItems, setLogoItems] = useState<Map<string, LogoItem>>(new Map())
	const [renamedUrls, setRenamedUrls] = useState<Map<string, string>>(new Map())
	const [draftOnlyUrls, setDraftOnlyUrls] = useState<Set<string>>(new Set())
	const [draftStableKeys, setDraftStableKeys] = useState<Map<string, string>>(new Map())
	const [deletedPublishedUrls, setDeletedPublishedUrls] = useState<Set<string>>(new Set())
	const [editingAnchorUrls, setEditingAnchorUrls] = useState<string[]>([])
	const draftKeySequenceRef = useRef(0)
	const keyInputRef = useRef<HTMLInputElement>(null)

	const createDraftStableKey = () => {
		draftKeySequenceRef.current += 1
		return `draft-${draftKeySequenceRef.current}`
	}

	const moveDraftStableKey = (next: Map<string, string>, oldUrl: string, currentUrl: string) => {
		const stableKey = next.get(oldUrl)
		if (!stableKey) {
			return next
		}
		next.delete(oldUrl)
		next.set(currentUrl, stableKey)
		return next
	}

	const replaceEditingAnchorUrl = (next: string[], oldUrl: string, currentUrl: string) => next.map(url => (url === oldUrl ? currentUrl : url))

	const { isAuth, setPrivateKey } = useAuthStore()
	const { siteContent } = useConfigStore()
	const hideEditButton = siteContent.hideEditButton ?? false

	const visibleShares = useMemo(
		() =>
			mergeEditingSharesIntoVisibleItems({
				visibleItems: pageState.runtime.visibleItems,
				allItems: pageState.artifacts.list,
				editingAnchorUrls,
				renamedUrls
			}) as Share[],
		[pageState.artifacts.list, pageState.runtime.visibleItems, editingAnchorUrls, renamedUrls]
	)
	const folderOptions = useMemo(() => collectShareFolderPaths(pageState.artifacts.folders), [pageState.artifacts.folders])
	const getShareKey = (share: Share) => draftStableKeys.get(share.url) ?? resolveShareEditAnchorUrl(share.url, renamedUrls)
	const tagOptions = useMemo(
		() => collectTagOptions(pageState.artifacts.list, pageState.filters.selectedTag),
		[pageState.artifacts.list, pageState.filters.selectedTag]
	)
	const categoryOptions = useMemo(
		() => collectCategoryOptions(pageState.runtime.availableCategories, pageState.runtime.activeCategory),
		[pageState.runtime.availableCategories, pageState.runtime.activeCategory]
	)
	const shareMigrationDirtyState = useMemo(
		() => ({
			isEditMode: pageState.isEditMode,
			logoItemsCount: logoItems.size,
			renamedUrlsCount: renamedUrls.size,
			draftOnlyUrlsCount: draftOnlyUrls.size,
			deletedPublishedUrlsCount: deletedPublishedUrls.size,
			editingAnchorUrlsCount: editingAnchorUrls.length
		}),
		[pageState.isEditMode, logoItems.size, renamedUrls.size, draftOnlyUrls.size, deletedPublishedUrls.size, editingAnchorUrls.length]
	)
	const emptyMessage = getEmptyMessage(pageState.runtime.emptyState)

	const handleUpdate = (updatedShare: Share, oldShare: Share, logoItem?: LogoItem, oldUrl = oldShare.url, currentUrl = updatedShare.url) => {
		const isDraftOnly = draftOnlyUrls.has(oldUrl)
		assertPendingShareUrlAvailable({
			currentUrl,
			oldUrl,
			shares: pageState.artifacts.list,
			renamedUrls,
			deletedPublishedUrls,
			draftOnlyUrls
		})
		setPageState(current => {
			const nextList = replaceShareByUrl(current.artifacts.list, oldUrl, updatedShare)
			return replaceArtifactsInState(current, buildArtifactsFromList(nextList), { preserveFilters: true })
		})
		if (isDraftOnly) {
			setDraftOnlyUrls(prev => {
				const next = new Set(prev)
				next.delete(oldUrl)
				next.add(currentUrl)
				return next
			})
			setDraftStableKeys(prev => moveDraftStableKey(new Map(prev), oldUrl, currentUrl))
			setEditingAnchorUrls(prev => replaceEditingAnchorUrl(prev, oldUrl, currentUrl))
		} else {
			setRenamedUrls(prev =>
				updatePendingShareUrlMappings(new Map(prev), {
					oldUrl,
					currentUrl
				})
			)
		}
		setLogoItems(prev => {
			const next = migratePendingShareLogoItems(new Map(prev), {
				oldUrl,
				currentUrl,
				logoItem
			})
			if (logoItem && oldUrl && oldUrl !== currentUrl) {
				next.delete(oldUrl)
			}
			return next
		})
	}

	const handleEditSessionStart = (url: string) => {
		setEditingAnchorUrls(prev => startShareEditSession(prev, url, draftOnlyUrls.has(url) ? undefined : renamedUrls))
	}

	const handleEditSessionFinish = (url: string) => {
		setEditingAnchorUrls(prev => finishShareEditSession(prev, url, draftOnlyUrls.has(url) ? undefined : renamedUrls))
	}

	const handleAdd = () => {
		setEditingShare(null)
		setIsCreateDialogOpen(true)
	}

	const handleSaveShare = (payload: ShareEditSubmitPayload<Share, LogoItem>) => {
		const isDraftOnlyEdit = payload.oldUrl ? draftOnlyUrls.has(payload.oldUrl) : false
		assertPendingShareUrlAvailable({
			currentUrl: payload.currentUrl,
			oldUrl: payload.oldUrl,
			shares: pageState.artifacts.list,
			renamedUrls,
			deletedPublishedUrls,
			draftOnlyUrls
		})
		setPageState(current => {
			const nextList = payload.oldUrl
				? replaceShareByUrl(current.artifacts.list, payload.oldUrl, payload.share)
				: [...current.artifacts.list, payload.share]

			return replaceArtifactsInState(current, buildArtifactsFromList(nextList), { preserveFilters: true })
		})
		if (!payload.oldUrl) {
			setDraftOnlyUrls(prev => {
				const next = new Set(prev)
				next.add(payload.currentUrl)
				return next
			})
			setDraftStableKeys(prev => {
				const next = new Map(prev)
				next.set(payload.currentUrl, createDraftStableKey())
				return next
			})
		} else if (isDraftOnlyEdit) {
			setDraftOnlyUrls(prev => {
				const next = new Set(prev)
				next.delete(payload.oldUrl)
				next.add(payload.currentUrl)
				return next
			})
			setDraftStableKeys(prev => moveDraftStableKey(new Map(prev), payload.oldUrl, payload.currentUrl))
		} else {
			setRenamedUrls(prev =>
				updatePendingShareUrlMappings(new Map(prev), {
					oldUrl: payload.oldUrl,
					currentUrl: payload.currentUrl
				})
			)
		}
		if (payload.oldUrl) {
			handleEditSessionFinish(payload.oldUrl)
		}
		setLogoItems(prev =>
			migratePendingShareLogoItems(new Map(prev), {
				oldUrl: payload.oldUrl,
				currentUrl: payload.currentUrl,
				logoItem: payload.logoItem
			})
		)
		setEditingShare(null)
	}

	const resetEditingSessions = () => {
		setDraftOnlyUrls(new Set())
		setDraftStableKeys(new Map())
		setDeletedPublishedUrls(new Set())
		setEditingAnchorUrls([])
	}

	const handleCancelShareEdit = (params: {
		originalShare: Share
		draftShare: Share
		logoItem?: LogoItem
		initialLogoItem?: LogoItem
	}) => {
		setPageState(current => {
			const nextList = replaceShareByUrl(current.artifacts.list, params.draftShare.url, params.originalShare)
			return replaceArtifactsInState(current, buildArtifactsFromList(nextList))
		})
		const isDraftOnlyDraft = draftOnlyUrls.has(params.draftShare.url)
		setDraftOnlyUrls(prev => {
			if (!prev.has(params.draftShare.url)) {
				return prev
			}
			const next = new Set(prev)
			next.delete(params.draftShare.url)
			next.add(params.originalShare.url)
			return next
		})
		setDraftStableKeys(prev => moveDraftStableKey(new Map(prev), params.draftShare.url, params.originalShare.url))
		if (!isDraftOnlyDraft) {
			setRenamedUrls(prev =>
				updatePendingShareUrlMappings(new Map(prev), {
					oldUrl: params.draftShare.url,
					currentUrl: params.originalShare.url
				})
			)
		}
		setLogoItems(prev => {
			if (params.initialLogoItem !== undefined) {
				return migratePendingShareLogoItems(new Map(prev), {
					oldUrl: params.draftShare.url,
					currentUrl: params.originalShare.url,
					logoItem: params.initialLogoItem
				})
			}

			const next = new Map(prev)
			next.delete(params.draftShare.url)
			next.delete(params.originalShare.url)
			return next
		})
	}

	const handleDelete = (share: Share) => {
		if (!confirm(`确定要删除 ${share.name} 吗？`)) {
			return
		}

		const isDraftOnly = draftOnlyUrls.has(share.url)
		if (!isDraftOnly) {
			setDeletedPublishedUrls(prev => {
				const next = new Set(prev)
				next.add(resolveShareEditAnchorUrl(share.url, renamedUrls))
				return next
			})
		} else {
			setDraftOnlyUrls(prev => {
				const next = new Set(prev)
				next.delete(share.url)
				return next
			})
			setDraftStableKeys(prev => {
				const next = new Map(prev)
				next.delete(share.url)
				return next
			})
		}
		setPageState(current => {
			const nextList = current.artifacts.list.filter(item => item.url !== share.url)
			return replaceArtifactsInState(current, buildArtifactsFromList(nextList), { preserveFilters: true })
		})
		setLogoItems(prev => {
			const next = new Map(prev)
			next.delete(share.url)
			return next
		})
		setRenamedUrls(prev => removePendingRenamedUrl(new Map(prev), share.url))
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

		try {
			let nextArtifacts: SharePageArtifacts = buildArtifactsFromList(currentShares)

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
				const updatedShares = applyShareLogoPathUpdates(currentShares, nextLogoPaths)
				const payloads = buildLocalShareSaveFilePayloads(updatedShares, existingStorageRaw, renamedUrls, deletedPublishedUrls)
				for (const payload of payloads) {
					await fetch('/api/save-file', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ path: payload.path, content: payload.content })
					})
				}

				nextArtifacts = parseSavedArtifacts(payloads, buildArtifactsFromList(updatedShares))
			} else {
				const publishedArtifacts = await pushShares({
					shares: currentShares,
					logoItems,
					urlMappings: Array.from(renamedUrls.entries()).map(([currentUrl, oldUrl]) => ({
						oldUrl,
						currentUrl
					})),
					deletedPublishedUrls
				})
				nextArtifacts = publishedArtifacts
			}

			setPageState(current => setSharePageEditMode(replaceArtifactsInState(current, nextArtifacts), false))
			setOriginalArtifacts(nextArtifacts)
			setEditingShare(null)
			setIsCreateDialogOpen(false)
			setLogoItems(new Map())
			setRenamedUrls(new Map())
			resetEditingSessions()
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
		setEditingShare(null)
		setIsCreateDialogOpen(false)
		setLogoItems(new Map())
		setRenamedUrls(new Map())
		resetEditingSessions()
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
		<ShareFolderSelectFoldersContext.Provider value={folderOptions}>
			<ShareCardEditCallbacksContext.Provider
				value={{
					onCancelEdit: handleCancelShareEdit,
					getPendingLogoItem: url => logoItems.get(url),
					onEditSessionStart: handleEditSessionStart,
					onEditSessionFinish: handleEditSessionFinish
				}}>
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
								getShareKey={getShareKey}
								onUpdate={handleUpdate}
								onDelete={handleDelete}
							/>
						</div>
					</div>
				</div>

				<motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className='absolute top-4 right-6 flex flex-col items-end gap-3 max-sm:hidden'>
					<div className='flex gap-3'>
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
					</div>
					{isDev ? <ShareMigrationPanel dirtyState={shareMigrationDirtyState} /> : null}
				</motion.div>

				{isCreateDialogOpen && <CreateDialog share={editingShare} onClose={() => setIsCreateDialogOpen(false)} onSave={handleSaveShare} />}
			</ShareCardEditCallbacksContext.Provider>
		</ShareFolderSelectFoldersContext.Provider>
	)
}
