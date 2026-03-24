'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Download, Upload, Undo2 } from 'lucide-react'
import { useConfigStore } from '../stores/config-store'
import { useLogStore } from '../stores/log-store'
import { toast } from 'sonner'

export function LayoutManager() {
	const { cardStyles, setCardStyles, saveLayout, undoLayout } = useConfigStore()
	const { addLog } = useLogStore()
	const [importText, setImportText] = useState('')
	const [showImport, setShowImport] = useState(false)
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
		toast.success(`布局已导出：${filename}`)
		addLog('success', 'layout', '导出布局', { filename })
	}

	const handleImport = () => {
		try {
			const layout = JSON.parse(importText)
			setCardStyles(layout)

			if (isDev) {
				saveLayout()
				toast.success('布局已导入并保存')
				addLog('success', 'layout', '导入布局（已保存到服务器）')
			} else {
				localStorage.setItem('custom-layout', importText)
				toast.success('布局已导入（仅本地生效）')
				addLog('success', 'layout', '导入布局（仅本地）')
			}

			setImportText('')
			setShowImport(false)
		} catch (error) {
			toast.error('JSON 格式错误')
			addLog('error', 'layout', '导入布局失败：JSON 格式错误')
		}
	}

	const handleUndo = async () => {
		try {
			await undoLayout()
			toast.success('已撤销到上一个版本')
			addLog('success', 'layout', '撤销布局')
		} catch (error) {
			toast.error('撤销失败')
			addLog('error', 'layout', '撤销布局失败')
		}
	}

	return (
		<div className='space-y-3'>
			<p className='text-[10px] text-secondary/60'>
				此处导出/导入仅包含卡片的位置、大小等布局参数，不包含自定义组件和图片。如需完整备份请使用右上角的导出配置按钮。
			</p>
			<div className='flex flex-wrap gap-2'>
				<motion.button
					whileHover={{ scale: 1.03 }}
					whileTap={{ scale: 0.97 }}
					onClick={handleExport}
					className='inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs hover:bg-white/35 transition-colors'
				>
					<Download className='w-3.5 h-3.5' />
					导出布局
				</motion.button>

				<motion.button
					whileHover={{ scale: 1.03 }}
					whileTap={{ scale: 0.97 }}
					onClick={() => setShowImport(!showImport)}
					className='inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs hover:bg-white/35 transition-colors'
				>
					<Upload className='w-3.5 h-3.5' />
					导入布局
				</motion.button>

				{isDev && (
					<motion.button
						whileHover={{ scale: 1.03 }}
						whileTap={{ scale: 0.97 }}
						onClick={handleUndo}
						className='inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs hover:bg-white/35 transition-colors'
					>
						<Undo2 className='w-3.5 h-3.5' />
						撤销上一步
					</motion.button>
				)}
			</div>

			{showImport && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: 'auto' }}
					exit={{ opacity: 0, height: 0 }}
					className='space-y-2'
				>
					<label className='block text-xs text-secondary'>粘贴布局 JSON：</label>
					<textarea
						value={importText}
						onChange={e => setImportText(e.target.value)}
						className='w-full h-28 rounded-2xl bg-white/10 backdrop-blur-sm p-3 text-xs font-mono border-none shadow-inner outline-none placeholder:text-secondary/50 resize-none'
						placeholder='粘贴 JSON 配置...'
					/>
					<div className='flex gap-2'>
						<motion.button
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							onClick={handleImport}
							className='rounded-full bg-brand text-white px-4 py-1.5 text-xs hover:opacity-90 transition-opacity'
						>
							确认导入
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							onClick={() => { setShowImport(false); setImportText('') }}
							className='rounded-full bg-white/20 px-4 py-1.5 text-xs hover:bg-white/35 transition-colors'
						>
							取消
						</motion.button>
					</div>
				</motion.div>
			)}
		</div>
	)
}
