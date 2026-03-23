'use client'

import { useState, useEffect } from 'react'
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
		<div className='mt-4 space-y-3'>
			<div className='flex items-center justify-between'>
				<h3 className='text-sm font-medium'>布局历史记录</h3>
				<button
					onClick={handleSaveSnapshot}
					className='px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:opacity-90'
				>
					保存当前布局
				</button>
			</div>

			{snapshots.length === 0 ? (
				<p className='text-xs text-secondary'>暂无保存的布局</p>
			) : (
				<div className='space-y-2 max-h-64 overflow-y-auto'>
					{snapshots.map(snapshot => (
						<div key={snapshot.id} className='flex items-center gap-2 p-2 bg-card rounded-lg border'>
							{editingId === snapshot.id ? (
								<input
									value={editingName}
									onChange={e => setEditingName(e.target.value)}
									onBlur={() => handleSaveRename(snapshot.id)}
									onKeyDown={e => e.key === 'Enter' && handleSaveRename(snapshot.id)}
									className='flex-1 px-2 py-1 text-xs border rounded'
									autoFocus
								/>
							) : (
								<>
									<div className='flex-1'>
										<div className='text-xs font-medium'>{snapshot.name}</div>
										<div className='text-xs text-secondary'>
											{new Date(snapshot.timestamp).toLocaleString('zh-CN')}
										</div>
									</div>
									<button
										onClick={() => handleLoadSnapshot(snapshot)}
										className='px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600'
									>
										加载
									</button>
									<button
										onClick={() => handleRename(snapshot.id, snapshot.name)}
										className='px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600'
									>
										重命名
									</button>
									<button
										onClick={() => handleDelete(snapshot.id, snapshot.name)}
										className='px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600'
									>
										删除
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
