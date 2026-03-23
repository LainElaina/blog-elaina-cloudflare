'use client'

import { useState } from 'react'
import { useConfigStore } from '../stores/config-store'
import { useLogStore } from '../stores/log-store'
import { toast } from 'sonner'

export function LayoutManager() {
	const { cardStyles, setCardStyles, saveLayout, undoLayout } = useConfigStore()
	const { addLog } = useLogStore()
	const [importText, setImportText] = useState('')
	const isDev = process.env.NODE_ENV === 'development'

	const handleExport = () => {
		const json = JSON.stringify(cardStyles, null, 2)
		const blob = new Blob([json], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const filename = `layout-${Date.now()}.json`
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
		toast.success(`布局已导出：${filename}（保存在浏览器下载目录）`)
		addLog('success', '导出布局', { filename })
	}

	const handleImport = () => {
		try {
			const layout = JSON.parse(importText)
			setCardStyles(layout)

			if (isDev) {
				saveLayout()
				toast.success('布局已导入并保存')
				addLog('success', '导入布局（已保存到服务器）')
			} else {
				localStorage.setItem('custom-layout', importText)
				toast.success('布局已导入（仅本地生效）')
				addLog('success', '导入布局（仅本地）')
			}

			setImportText('')
		} catch (error) {
			toast.error('JSON 格式错误')
			addLog('error', '导入布局失败：JSON 格式错误')
		}
	}

	const handleUndo = async () => {
		try {
			await undoLayout()
			toast.success('已撤销到上一个版本')
			addLog('success', '撤销布局')
		} catch (error) {
			toast.error('撤销失败')
			addLog('error', '撤销布局失败')
		}
	}

	return (
		<div className='space-y-4'>
			<div className='flex gap-2'>
				<button onClick={handleExport} className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>
					导出布局
				</button>

				{isDev && (
					<button onClick={handleUndo} className='px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600'>
						撤销上一步
					</button>
				)}
			</div>

			<div>
				<label className='block text-sm mb-2'>导入布局 JSON：</label>
				<textarea
					value={importText}
					onChange={e => setImportText(e.target.value)}
					className='w-full h-32 p-2 border rounded font-mono text-sm'
					placeholder='粘贴 JSON 配置...'
				/>
				<button onClick={handleImport} className='mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'>
					导入
				</button>
			</div>
		</div>
	)
}
