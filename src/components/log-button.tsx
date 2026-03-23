'use client'

import { useLogStore } from '../app/(home)/stores/log-store'
import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'

export function LogButton() {
	const { enabled, visible, setVisible } = useLogStore()
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	if (!mounted || !enabled) return null

	return (
		<button
			onClick={() => setVisible(!visible)}
			className='fixed top-6 right-6 z-[9998] card squircle p-3 shadow-2xl hover:scale-105 transition-transform'
			title={visible ? '关闭日志' : '打开日志'}
		>
			<FileText className='w-5 h-5 text-brand' />
			{!visible && (
				<span className='absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse' />
			)}
		</button>
	)
}
