'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLogStore, LOG_CATEGORY_LABELS } from './stores/log-store'
import { toast } from 'sonner'

export function LogWindow() {
	const { logs, visible, setVisible, clearLogs, exportLogs } = useLogStore()
	const [position, setPosition] = useState({ x: 100, y: 100 })
	const draggingRef = useRef(false)
	const dragStartRef = useRef({ x: 0, y: 0 })

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!draggingRef.current) return
		setPosition({
			x: e.clientX - dragStartRef.current.x,
			y: e.clientY - dragStartRef.current.y
		})
	}, [])

	const handleMouseUp = useCallback(() => {
		draggingRef.current = false
		window.removeEventListener('mousemove', handleMouseMove)
		window.removeEventListener('mouseup', handleMouseUp)
	}, [handleMouseMove])

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		draggingRef.current = true
		dragStartRef.current = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		}
		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
	}, [position, handleMouseMove, handleMouseUp])

	// 组件卸载时清理事件监听
	useEffect(() => {
		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}
	}, [handleMouseMove, handleMouseUp])

	if (!visible) return null

	const handleExport = () => {
		const data = exportLogs()
		const blob = new Blob([data], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const filename = `logs-${Date.now()}.json`
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
		toast.success(`日志已导出：${filename}`)
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
				className='px-4 py-3 border-b cursor-move flex items-center justify-between select-none'
				onMouseDown={handleMouseDown}
			>
				<span className='font-medium text-sm'>操作日志</span>
				<div className='flex gap-2'>
					<button onClick={handleExport} className='text-xs px-2 py-1 bg-brand text-white rounded-lg hover:opacity-90'>
						导出
					</button>
					<button onClick={clearLogs} className='text-xs px-2 py-1 bg-card border border-border rounded-lg'>
						清空
					</button>
					<button onClick={() => setVisible(false)} className='text-xs px-2 py-1 bg-card border border-border rounded-lg'>
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
									<div className='flex items-center gap-2'>
										<span className={`font-medium ${getLevelColor(log.level)}`}>
											[{log.level.toUpperCase()}]
										</span>
										<span className='px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs'>
											{LOG_CATEGORY_LABELS[log.category]}
										</span>
									</div>
									<span className='text-secondary'>
										{new Date(log.timestamp).toLocaleTimeString('zh-CN')}
									</span>
								</div>
								<div className='mt-1'>{log.action}</div>
								{log.details && (
									<div className='mt-1 p-2 bg-white/50 rounded text-xs font-mono overflow-x-auto'>
										<button
											onClick={() => handleCopy(JSON.stringify(log.details, null, 2))}
											className='float-right text-brand hover:underline'
										>
											复制
										</button>
										<pre className='whitespace-pre-wrap'>{JSON.stringify(log.details, null, 2)}</pre>
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
