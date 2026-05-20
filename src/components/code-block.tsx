'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy } from 'lucide-react'

type CodeBlockProps = {
	children: React.ReactNode
	code: string
}

export function CodeBlock({ children, code }: CodeBlockProps) {
	const [copied, setCopied] = useState(false)
	const [wrapped, setWrapped] = useState(true)
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

	const wrapperClassName = ['code-block-wrapper', wrapped ? 'code-block-wrapper--wrapped' : ''].filter(Boolean).join(' ')
	const fullscreenWrapperClassName = ['code-block-wrapper', 'code-block-wrapper--fullscreen', wrapped ? 'code-block-wrapper--wrapped' : '']
		.filter(Boolean)
		.join(' ')

	const renderActions = (fullscreenActions: boolean) => (
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
				aria-label={fullscreenActions ? '关闭全屏查看代码' : '全屏查看代码'}
				aria-pressed={fullscreen}>
				{fullscreenActions ? '关闭全屏' : '全屏'}
			</button>
			<button type='button' onClick={handleCopy} className='code-block-action-btn' aria-label='复制代码'>
				{copied ? <Check size={16} /> : <Copy size={16} />}
			</button>
		</div>
	)

	return (
		<>
			<div className={wrapperClassName}>
				{renderActions(false)}
				{children}
			</div>
			{fullscreen && typeof document !== 'undefined'
				? createPortal(
						<div className='code-block-fullscreen-overlay' role='dialog' aria-modal='true'>
							<div className={fullscreenWrapperClassName}>
								{renderActions(true)}
								{children}
							</div>
						</div>,
						document.body
					)
				: null}
		</>
	)
}
