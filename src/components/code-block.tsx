'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CodeBlockProps = {
	children: React.ReactNode
	code: string
}

export function CodeBlock({ children, code }: CodeBlockProps) {
	const [copied, setCopied] = useState(false)
	const [wrapped, setWrapped] = useState(false)
	const [fullscreen, setFullscreen] = useState(false)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy code:', error)
		}
	}

	const wrapperClassName = ['code-block-wrapper', wrapped ? 'code-block-wrapper--wrapped' : '', fullscreen ? 'code-block-wrapper--fullscreen' : '']
		.filter(Boolean)
		.join(' ')

	return (
		<div className={wrapperClassName}>
			<div className='code-block-actions'>
				<button
					type='button'
					onClick={() => setWrapped(value => !value)}
					className='code-block-action-btn'
					aria-label={wrapped ? '关闭代码自动换行' : '开启代码自动换行'}
					aria-pressed={wrapped}>
					换行
				</button>
				<button
					type='button'
					onClick={() => setFullscreen(value => !value)}
					className='code-block-action-btn'
					aria-label={fullscreen ? '退出全屏查看代码' : '全屏查看代码'}
					aria-pressed={fullscreen}>
					{fullscreen ? '还原' : '全屏'}
				</button>
				<button type='button' onClick={handleCopy} className='code-block-action-btn' aria-label='复制代码'>
					{copied ? <Check size={16} /> : <Copy size={16} />}
				</button>
			</div>
			{children}
		</div>
	)
}
