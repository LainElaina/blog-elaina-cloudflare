'use client'

import { useCallback, useState } from 'react'

import { buildPitySegments, parseCardRecords, type PitySegment } from './pity'

export default function Page() {
	const [input, setInput] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [segments, setSegments] = useState<PitySegment[]>([])

	const analyze = useCallback(() => {
		setError(null)
		const trimmed = input.trim()
		if (!trimmed) {
			setSegments([])
			return
		}
		try {
			const records = parseCardRecords(trimmed)
			setSegments(buildPitySegments(records))
		} catch (e) {
			setSegments([])
			setError(e instanceof Error ? e.message : '解析失败')
		}
	}, [input])

	return (
		<div className='mx-auto max-w-3xl space-y-4 px-4 py-24'>
			<h1 className='text-xl font-semibold tracking-tight'>鸣潮 · 抽卡记录分析</h1>
			<p className='text-sm'>
				<span>使用方法：</span>
			</p>
			<ul className='text-secondary list-inside list-disc text-sm'>
				<li>
					进入{' '}
					<a href='https://mc.kurogames.com/cloud/#/tools' target='_blank' rel='noopener noreferrer' className='text-brand hover:underline'>
						https://mc.kurogames.com/cloud/#/tools
					</a>
					，登录账号。
				</li>
				<li>
					点击 <span className='text-brand'>F12</span>，点击右侧 <span className='text-brand'>Network</span> 面板。左侧选择<span className='text-brand'>换取记录</span>
					，右侧观察出现最新的 <span className='text-brand'>query</span> 请求。
				</li>
				<li>
					点击 <span className='text-brand'>query</span> 请求，点击 <span className='text-brand'>Preview</span> 面板，右键 <span className='text-brand'>data</span> 值{' '}
					<span className='text-brand'>Copy Value</span>。
				</li>
				<li>最后粘贴到下方输入框 - 分析。</li>
			</ul>

			<textarea
				value={input}
				onChange={e => setInput(e.target.value)}
				rows={5}
				spellCheck={false}
				className='bg-card text-foreground focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none'
				style={{ maxHeight: '7.5rem' }}
				placeholder='[{"cardPoolType":"…","qualityLevel":4,"name":"…",...}, ...]'
			/>

			<button type='button' onClick={analyze} className='bg-brand rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90'>
				分析
			</button>

			{error ? (
				<p className='text-destructive text-sm' role='alert'>
					{error}
				</p>
			) : null}

			{segments.length > 0 ? (
				<ul className='space-y-2'>
					{segments.map((seg, i) => (
						<li key={i} className='group flex items-center gap-3'>
							<div
								className='bg-brand-secondary flex h-7 shrink-0 items-center overflow-hidden rounded-sm pl-2 text-xs leading-none font-bold text-white tabular-nums'
								style={{ width: seg.pulls * 4 + 16 }}
								title={`${seg.pulls} 抽`}>
								{seg.pulls}
							</div>
							<span className='text-foreground min-w-0 flex-1 truncate text-sm'>
								{seg.name ? (
									<span>
										{seg.name} <span className='text-secondary hidden text-xs group-hover:inline'>({seg.time?.slice(0, 10)})</span>
									</span>
								) : (
									<span className='text-secondary'>（未到 5 星）</span>
								)}
							</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	)
}
