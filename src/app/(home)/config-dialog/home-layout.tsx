'use client'

import { motion } from 'motion/react'
import { useConfigStore, type CardStyles } from '../stores/config-store'
import { useLayoutEditStore } from '../stores/layout-edit-store'
import { useCustomComponentStore } from '../stores/custom-component-store'
import { useAuthStore } from '@/hooks/use-auth'
import { useLogStore } from '../stores/log-store'
import cardStylesDefault from '@/config/card-styles-default.json'
import { LayoutManager } from './layout-manager'
import { LayoutHistory } from './layout-history'
import { toast } from 'sonner'

// 这些按钮不允许禁用，否则用户会把自己锁在外面
const ALWAYS_ENABLED_KEYS = new Set([
	'logButton', 'componentStoreButton', 'editLayoutButton',
	'exportLayoutButton', 'importLayoutButton', 'layoutSettingsButton'
])

const CARD_LABELS: Record<string, string> = {
	artCard: '首图',
	hiCard: '中心',
	clockCard: '时钟',
	calendarCard: '日历',
	musicCard: '音乐',
	socialButtons: '联系',
	shareCard: '分享',
	articleCard: '文章',
	writeButtons: '写作',
	navCard: '导航',
	likePosition: '点赞',
	hatCard: '帽子',
	beianCard: '备案',
	logButton: '日志按钮',
	componentStoreButton: '组件商店',
	editLayoutButton: '编辑布局',
	exportLayoutButton: '导出配置',
	importLayoutButton: '导入配置',
	layoutSettingsButton: '布局设置'
}

interface HomeLayoutProps {
	cardStylesData: CardStyles
	setCardStylesData: React.Dispatch<React.SetStateAction<CardStyles>>
	onClose?: () => void
}

function NumberInput({ value, onChange, placeholder }: {
	value: number | null | undefined
	onChange: (v: number | null) => void
	placeholder?: string
}) {
	return (
		<input
			type='number'
			value={value ?? ''}
			placeholder={placeholder}
			onChange={e => {
				if (placeholder && e.target.value === '') {
					onChange(null)
				} else {
					onChange(parseInt(e.target.value) || 0)
				}
			}}
			className='w-full rounded-xl bg-white/10 px-2.5 py-1.5 text-xs border-none shadow-inner outline-none no-spinner placeholder:text-secondary/40'
		/>
	)
}

export function HomeLayout({ cardStylesData, setCardStylesData, onClose }: HomeLayoutProps) {
	const { setCardStyles } = useConfigStore()
	const startEditing = useLayoutEditStore(state => state.startEditing)
	const editing = useLayoutEditStore(state => state.editing)
	const { components: customComponents, updateComponent } = useCustomComponentStore()
	const { isAuth } = useAuthStore()
	const addLog = useLogStore(state => state.addLog)

	const handleStartManualLayout = () => {
		setCardStyles(cardStylesData)
		startEditing()
		onClose?.()
	}

	// 持久化保存 cardStyles 和 customComponents 到项目
	const persistToProject = async (newCardStyles: CardStyles, newComponents: any[]) => {
		if (process.env.NODE_ENV === 'development') {
			await fetch('/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cardStyles: newCardStyles, customComponents: newComponents })
			})
			addLog('success', 'layout', '重置已保存到本地项目')
		} else if (isAuth) {
			const { getAuthToken } = await import('@/lib/auth')
			const { getRef, createTree, createCommit, updateRef, createBlob } = await import('@/lib/github-client')
			const { GITHUB_CONFIG } = await import('@/consts')

			const token = await getAuthToken()
			const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)

			const cardStylesContent = btoa(unescape(encodeURIComponent(JSON.stringify(newCardStyles, null, '\t'))))
			const componentsContent = btoa(unescape(encodeURIComponent(JSON.stringify(newComponents, null, '\t'))))

			const blob1 = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, cardStylesContent, 'base64')
			const blob2 = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, componentsContent, 'base64')

			const tree = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, [
				{ path: 'src/config/card-styles.json', mode: '100644', type: 'blob', sha: blob1.sha },
				{ path: 'src/config/custom-components.json', mode: '100644', type: 'blob', sha: blob2.sha }
			], ref.sha)

			const commit = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '重置布局', tree.sha, [ref.sha])
			await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commit.sha)
			addLog('success', 'layout', '重置已推送到 GitHub')
		} else {
			toast.error('线上环境需要先导入密钥才能持久化保存')
			addLog('error', 'layout', '重置未能持久化：未导入密钥')
			return
		}
		toast.success('重置已保存到项目，即将刷新页面...')
		setTimeout(() => window.location.reload(), 1000)
	}

	const handleResetBuiltin = async () => {
		if (!confirm('确定重置所有内置组件的位置和大小为默认值？')) return
		const defaults = cardStylesDefault as CardStyles
		setCardStylesData(defaults)
		setCardStyles(defaults)
		try {
			await persistToProject(defaults, customComponents)
		} catch (error) {
			console.error(error)
			toast.error('保存失败')
		}
	}

	const handleResetAll = async () => {
		if (!confirm('确定重置全部？这将清空所有自定义组件，并将内置组件的位置、大小和显示状态全部恢复为默认值。')) return
		const defaults = cardStylesDefault as CardStyles
		setCardStylesData(defaults)
		setCardStyles(defaults)
		useCustomComponentStore.setState({ components: [] })
		if (typeof window !== 'undefined') {
			localStorage.setItem('custom-components', JSON.stringify([]))
		}
		try {
			await persistToProject(defaults, [])
		} catch (error) {
			console.error(error)
			toast.error('保存失败')
		}
	}

	const updateField = (key: string, field: string, value: any) => {
		setCardStylesData(prev => ({
			...prev,
			[key]: {
				...prev[key as keyof CardStyles],
				[field]: value
			}
		}))
	}

	return (
		<div className='space-y-5'>
			<LayoutManager />
			<LayoutHistory />

			{/* 操作栏 */}
			<div className='space-y-2'>
				<div className='flex items-center justify-between gap-3'>
					<span className='text-xs text-secondary shrink-0'>偏移 = 相对屏幕中心的像素偏移</span>
					<div className='flex items-center gap-2'>
						<motion.button
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							onClick={handleResetBuiltin}
							className='rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs hover:bg-white/35 transition-colors'
						>
							重置内置
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							onClick={handleResetAll}
							className='rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs hover:bg-red-500/15 text-red-600 transition-colors'
						>
							重置全部
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							onClick={handleStartManualLayout}
							disabled={editing}
							className='rounded-full bg-brand text-white px-4 py-1.5 text-xs hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed'
						>
							{editing ? '主页正在编辑中' : '进入主页拖拽布局'}
						</motion.button>
					</div>
				</div>
				<div className='text-[10px] text-secondary/60 space-y-0.5'>
					<p><span className='font-bold text-secondary/80'>重置内置</span>：仅恢复内置组件的位置和大小为默认值，不影响自定义组件。</p>
					<p><span className='font-bold text-secondary/80'>重置全部</span>：清空所有自定义组件，内置组件的位置、大小和显示状态全部恢复默认。</p>
					<p>重置操作会自动持久化保存到项目，完成后页面将自动刷新。{process.env.NODE_ENV !== 'development' && '线上环境需要先导入密钥。'}</p>
				</div>
			</div>

			{/* 组件卡片列表 - 普通卡片 2列 */}
			<div className='grid grid-cols-2 gap-2'>
				{Object.entries(cardStylesData)
					.filter(([key]) => !ALWAYS_ENABLED_KEYS.has(key))
					.map(([key, cardStyle]: [string, any]) => (
					<div
						key={key}
						className='rounded-2xl bg-white/10 backdrop-blur-sm p-3 transition-colors hover:bg-white/20'
					>
						<div className='flex items-center justify-between mb-2'>
							<span className='text-xs font-medium truncate max-w-[100px]' title={CARD_LABELS[key] ?? key}>
								{CARD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim()}
							</span>
							<label className='flex items-center gap-1.5 cursor-pointer'>
								<span className='text-[10px] text-secondary'>{(cardStyle.enabled ?? true) ? '启用' : '禁用'}</span>
								<input
									type='checkbox'
									checked={cardStyle.enabled ?? true}
									onChange={e => updateField(key, 'enabled', e.target.checked)}
									className='accent-brand h-3.5 w-3.5 rounded'
								/>
							</label>
						</div>
						<div className='grid grid-cols-5 gap-1.5'>
							{cardStyle.width !== undefined && (
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>宽</label>
									<NumberInput value={cardStyle.width} onChange={v => updateField(key, 'width', v ?? 0)} />
								</div>
							)}
							{cardStyle.height !== undefined && (
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>高</label>
									<NumberInput value={cardStyle.height} onChange={v => updateField(key, 'height', v ?? 0)} />
								</div>
							)}
							<div>
								<label className='text-[10px] text-secondary mb-0.5 block'>顺序</label>
								<NumberInput value={cardStyle.order} onChange={v => updateField(key, 'order', v ?? 0)} />
							</div>
							<div>
								<label className='text-[10px] text-secondary mb-0.5 block'>横偏移</label>
								<NumberInput value={cardStyle.offsetX} onChange={v => updateField(key, 'offsetX', v)} placeholder='auto' />
							</div>
							<div>
								<label className='text-[10px] text-secondary mb-0.5 block'>纵偏移</label>
								<NumberInput value={cardStyle.offsetY} onChange={v => updateField(key, 'offsetY', v)} placeholder='auto' />
							</div>
						</div>
					</div>
				))}
			</div>

			{/* 自定义组件 - 2列 */}
			{customComponents.length > 0 && (
				<div className='grid grid-cols-2 gap-2'>
					{customComponents.map(comp => (
						<div
							key={comp.id}
							className='rounded-2xl bg-white/10 backdrop-blur-sm p-3 transition-colors hover:bg-white/20 border border-blue-400/20'
						>
							<div className='flex items-center justify-between mb-2'>
								<div className='flex items-center gap-1.5 min-w-0'>
									<span className='text-xs font-medium truncate max-w-[80px]' title={comp.name}>
										{comp.name}
									</span>
									<span className='shrink-0 text-[10px] bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded-full'>
										自定义
									</span>
								</div>
								<label className='flex items-center gap-1.5 cursor-pointer'>
									<span className='text-[10px] text-secondary'>{(comp.style.enabled ?? true) ? '启用' : '禁用'}</span>
									<input
										type='checkbox'
										checked={comp.style.enabled ?? true}
										onChange={e => updateComponent(comp.id, { style: { ...comp.style, enabled: e.target.checked } })}
										className='accent-brand h-3.5 w-3.5 rounded'
									/>
								</label>
							</div>
							<div className='grid grid-cols-5 gap-1.5'>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>宽</label>
									<NumberInput value={comp.style.width} onChange={v => updateComponent(comp.id, { style: { ...comp.style, width: v ?? 0 } })} />
								</div>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>高</label>
									<NumberInput value={comp.style.height} onChange={v => updateComponent(comp.id, { style: { ...comp.style, height: v ?? 0 } })} />
								</div>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>顺序</label>
									<NumberInput value={comp.style.order} onChange={v => updateComponent(comp.id, { style: { ...comp.style, order: v ?? 0 } })} />
								</div>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>横偏移</label>
									<NumberInput value={comp.style.offsetX} onChange={v => updateComponent(comp.id, { style: { ...comp.style, offsetX: v } })} placeholder='auto' />
								</div>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>纵偏移</label>
									<NumberInput value={comp.style.offsetY} onChange={v => updateComponent(comp.id, { style: { ...comp.style, offsetY: v } })} placeholder='auto' />
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* 常驻工具按钮 - 底部 */}
			<div>
				<h4 className='text-xs text-secondary mb-2'>工具按钮（常驻）</h4>
				<div className='grid grid-cols-2 gap-2'>
					{Object.entries(cardStylesData)
						.filter(([key]) => ALWAYS_ENABLED_KEYS.has(key))
						.map(([key, cardStyle]: [string, any]) => (
						<div
							key={key}
							className='rounded-2xl bg-white/5 backdrop-blur-sm p-3 transition-colors hover:bg-white/15'
						>
							<div className='flex items-center justify-between mb-2'>
								<span className='text-xs font-medium truncate max-w-[100px]' title={CARD_LABELS[key] ?? key}>
									{CARD_LABELS[key] ?? key}
								</span>
								<span className='text-[10px] text-secondary/40'>常驻</span>
							</div>
							<div className='grid grid-cols-5 gap-1.5'>
								{cardStyle.width !== undefined && (
									<div>
										<label className='text-[10px] text-secondary mb-0.5 block'>宽</label>
										<NumberInput value={cardStyle.width} onChange={v => updateField(key, 'width', v ?? 0)} />
									</div>
								)}
								{cardStyle.height !== undefined && (
									<div>
										<label className='text-[10px] text-secondary mb-0.5 block'>高</label>
										<NumberInput value={cardStyle.height} onChange={v => updateField(key, 'height', v ?? 0)} />
									</div>
								)}
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>顺序</label>
									<NumberInput value={cardStyle.order} onChange={v => updateField(key, 'order', v ?? 0)} />
								</div>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>横偏移</label>
									<NumberInput value={cardStyle.offsetX} onChange={v => updateField(key, 'offsetX', v)} placeholder='auto' />
								</div>
								<div>
									<label className='text-[10px] text-secondary mb-0.5 block'>纵偏移</label>
									<NumberInput value={cardStyle.offsetY} onChange={v => updateField(key, 'offsetY', v)} placeholder='auto' />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
