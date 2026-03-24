'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { RotateCcw, Pencil, Trash2, Save } from 'lucide-react'
import { useConfigStore } from '../stores/config-store'
import { useLogStore } from '../stores/log-store'
import { toast } from 'sonner'

interface LayoutSnapshot {
	id: string
	name: string
	timestamp: number
	data: any
}

export function LayoutHistory() {
	const [snapshots, setSnapshots] = useState<LayoutSnapshot[]>([])
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')
	const { cardStyles, setCardStyles } = useConfigStore()
	const { addLog } = useLogStore()

	useEffect(() => {
		loadSnapshots()
	}, [])

	const loadSnapshots = () => {
		const saved = localStorage.getItem('layout-snapshots')
		if (saved) {
			setSnapshots(JSON.parse(saved))
		}
	}

	const saveSnapshots = (newSnapshots: LayoutSnapshot[]) => {
		localStorage.setItem('layout-snapshots', JSON.stringify(newSnapshots))
		setSnapshots(newSnapshots)
	}

	const handleSaveSnapshot = () => {
		const name = prompt('输入布局名称：')
		if (!name) return

		const newSnapshot: LayoutSnapshot = {
			id: Date.now().toString(),
			name,
			timestamp: Date.now(),
			data: cardStyles
		}

		saveSnapshots([newSnapshot, ...snapshots])
		toast.success('布局已保存到历史记录')
		addLog('success', 'history', '保存布局快照', { name })
	}

	const handleLoadSnapshot = (snapshot: LayoutSnapshot) => {
		if (confirm(`确定要加载布局"${snapshot.name}"吗？`)) {
			setCardStyles(snapshot.data)
			toast.success('布局已加载')
			addLog('success', 'history', '加载历史布局', { name: snapshot.name })
		}
	}

	const handleRename = (id: string, currentName: string) => {
		setEditingId(id)
		setEditingName(currentName)
	}

	const handleSaveRename = (id: string) => {
		if (!editingName.trim()) return

		const oldName = snapshots.find(s => s.id === id)?.name
		const updated = snapshots.map(s =>
			s.id === id ? { ...s, name: editingName } : s
		)
		saveSnapshots(updated)
		setEditingId(null)
		toast.success('已重命名')
		addLog('info', 'history', '重命名历史布局', { oldName, newName: editingName })
	}

	const handleDelete = (id: string, name: string) => {
		if (confirm(`确定要删除布局"${name}"吗？`)) {
			saveSnapshots(snapshots.filter(s => s.id !== id))
			toast.success('已删除')
			addLog('warning', 'history', '删除历史布局', { name })
		}
	}

	return (
		<div className='mt-5 space-y-3'>
			<div className='flex items-center justify-between'>
				<div>
					<h3 className='text-sm font-medium'>布局历史记录</h3>
					<p className='text-[10px] text-secondary/60 mt-0.5'>存储在浏览器本地，清除缓存后将丢失，请及时导出备份</p>
				</div>
				<motion.button
					whileHover={{ scale: 1.03 }}
					whileTap={{ scale: 0.97 }}
					onClick={handleSaveSnapshot}
					className='inline-flex items-center gap-1.5 rounded-full bg-brand text-white px-4 py-1.5 text-xs hover:opacity-90 transition-opacity shrink-0'
				>
					<Save className='w-3.5 h-3.5' />
					保存当前布局
				</motion.button>
			</div>

			{snapshots.length === 0 ? (
				<p className='text-xs text-secondary py-2'>暂无保存的布局</p>
			) : (
				<div className='space-y-2 max-h-64 overflow-y-auto scrollbar-none'>
					{snapshots.map(snapshot => (
						<div
							key={snapshot.id}
							className='flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm p-3 transition-colors hover:bg-white/20'
						>
							{editingId === snapshot.id ? (
								<input
									value={editingName}
									onChange={e => setEditingName(e.target.value)}
									onBlur={() => handleSaveRename(snapshot.id)}
									onKeyDown={e => e.key === 'Enter' && handleSaveRename(snapshot.id)}
									className='flex-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs border-none shadow-inner outline-none'
									autoFocus
								/>
							) : (
								<>
									<div className='flex-1 min-w-0'>
										<div className='text-xs font-medium truncate'>{snapshot.name}</div>
										<div className='text-[10px] text-secondary'>
											{new Date(snapshot.timestamp).toLocaleString('zh-CN')}
										</div>
									</div>
									<button
										onClick={() => handleLoadSnapshot(snapshot)}
										title='加载'
										className='p-1.5 rounded-full hover:bg-white/25 transition-colors'
									>
										<RotateCcw className='w-3.5 h-3.5 text-secondary' />
									</button>
									<button
										onClick={() => handleRename(snapshot.id, snapshot.name)}
										title='重命名'
										className='p-1.5 rounded-full hover:bg-white/25 transition-colors'
									>
										<Pencil className='w-3.5 h-3.5 text-secondary' />
									</button>
									<button
										onClick={() => handleDelete(snapshot.id, snapshot.name)}
										title='删除'
										className='p-1.5 rounded-full hover:bg-red-500/15 transition-colors'
									>
										<Trash2 className='w-3.5 h-3.5 text-secondary' />
									</button>
								</>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
