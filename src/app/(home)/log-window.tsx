'use client'

import { useState } from 'react'
import { useLogStore } from '../stores/log-store'
import { toast } from 'sonner'

export function LogWindow() {
	const { logs, visible, setVisible, clearLogs, exportLogs } = useLogStore()
	const [position, setPosition] = useState({ x: 100, y: 100 })
	const [dragging, setDragging] = useState(false)
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

	if (!visible) return null

	const handleMouseDown = (e: React.MouseEvent) => {
		setDragging(true)
		setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
	}

	const handleMouseMove = (e: MouseEvent) => {
		if (!dragging) return
		setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
	}

	const handleMouseUp = () => {
		setDragging(false)
	}

	if (dragging) {
		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
	}

	const handleExport = () => {
		const data = exportLogs()
		const blob = new Blob([data], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `logs-${Date.now()}.json`
		a.click()
		URL.revokeObjectURL(url)
		toast.success('日志已导出')
	}

	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text)
		toast.success('已复制')
	}

	const getLevelColor = (level: string) => {
		switch (level) {
			case 'success': return 'text-green-600'
			case 'warning': return 'text-yellow-600'
			case 'error': return 'text-red-600'
			default: return 'text-blue-600'
		}
	}

	return (
		<div
			className='fixed z-[9999] card squircle shadow-2xl'
			style={{ left: position.x, top: position.y, width: 500, maxHeight: 400 }}
		>
			<div
				className='px-4 py-3 border-b cursor-move flex items-center justify-between'
				onMouseDown={handleMouseDown}
			>
				<span className='font-medium text-sm'>操作日志</span>
				<div className='flex gap-2'>
					<button onClick={handleExport} className='text-xs px-2 py-1 bg-blue-500 text-white rounded'>
						导出
					</button>
					<button onClick={clearLogs} className='text-xs px-2 py-1 bg-gray-500 text-white rounded'>
						清空
					</button>
					<button onClick={() => setVisible(false)} className='text-xs px-2 py-1 bg-red-500 text-white rounded'>
						关闭
					</button>
				</div>
			</div>
			<div className='p-3 overflow-y-auto' style={{ maxHeight: 320 }}>
				{logs.length === 0 ? (
					<p className='text-xs text-secondary'>暂无日志</p>
				) : (
					<div className='space-y-2'>
						{logs.map(log => (
							<div key={log.id} className='text-xs border-b pb-2'>
								<div className='flex items-center justify-between'>
									<span className={`font-medium ${getLevelColor(log.level)}`}>
										[{log.level.toUpperCase()}]
									</span>
									<span className='text-secondary'>
										{new Date(log.timestamp).toLocaleTimeString('zh-CN')}
									</span>
								</div>
								<div className='mt-1'>{log.action}</div>
								{log.details && (
									<div className='mt-1 p-2 bg-gray-50 rounded text-xs font-mono overflow-x-auto'>
										<button
											onClick={() => handleCopy(JSON.stringify(log.details, null, 2))}
											className='float-right text-blue-500 hover:underline'
										>
											复制
										</button>
										<pre>{JSON.stringify(log.details, null, 2)}</pre>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
