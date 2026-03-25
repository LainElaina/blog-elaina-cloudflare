'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import shareList from '@/app/share/list.json'
import Link from 'next/link'
import { useConfigStore } from './stores/config-store'

dayjs.locale('zh-cn')

/**
 * Mobile horizontal scroll area showing info cards that are desktop-only.
 * Displays: Clock, Calendar summary, Random share item.
 */
export default function MobileQuickInfo() {
	const [time, setTime] = useState(new Date())
	const { siteContent } = useConfigStore()
	const showSeconds = siteContent.clockShowSeconds ?? false

	useEffect(() => {
		const interval = showSeconds ? 1000 : 5000
		const timer = setInterval(() => setTime(new Date()), interval)
		return () => clearInterval(timer)
	}, [showSeconds])

	const [randomItem] = useState(() => {
		const idx = Math.floor(Math.random() * shareList.length)
		return shareList[idx]
	})

	const now = dayjs()
	const hours = time.getHours().toString().padStart(2, '0')
	const minutes = time.getMinutes().toString().padStart(2, '0')

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: 0.2 }}
			className='scrollbar-none -mx-2 flex w-full gap-3 overflow-x-auto px-2 pb-2'
			style={{ scrollSnapType: 'x mandatory' }}>
			{/* Clock + Date card */}
			<Link
				href='/clock'
				className='flex min-w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl p-4'
				style={{
					scrollSnapAlign: 'start',
					background: 'rgba(255,255,255,0.4)',
					border: '1px solid rgba(255,255,255,0.15)',
					backdropFilter: 'blur(12px)'
				}}>
				<span className='text-primary text-3xl font-bold tabular-nums'>
					{hours}:{minutes}
				</span>
				<span className='text-secondary text-xs'>
					{now.format('YYYY年M月D日 ddd')}
				</span>
			</Link>

			{/* Calendar mini card */}
			<div
				className='flex min-w-[200px] shrink-0 flex-col gap-2 rounded-2xl p-4'
				style={{
					scrollSnapAlign: 'start',
					background: 'rgba(255,255,255,0.4)',
					border: '1px solid rgba(255,255,255,0.15)',
					backdropFilter: 'blur(12px)'
				}}>
				<span className='text-secondary text-xs font-medium'>本月日历</span>
				<MiniCalendar />
			</div>

			{/* Share recommendation card */}
			{randomItem && (
				<Link
					href='/share'
					className='flex min-w-[220px] shrink-0 flex-col gap-2 rounded-2xl p-4'
					style={{
						scrollSnapAlign: 'start',
						background: 'rgba(255,255,255,0.4)',
						border: '1px solid rgba(255,255,255,0.15)',
						backdropFilter: 'blur(12px)'
					}}>
					<span className='text-secondary text-xs font-medium'>随机推荐</span>
					<div className='flex items-center gap-2'>
						<img src={randomItem.logo} alt={randomItem.name} className='size-8 shrink-0 rounded-lg object-contain' />
						<span className='text-sm font-medium'>{randomItem.name}</span>
					</div>
					<p className='text-secondary line-clamp-2 text-xs'>{randomItem.description}</p>
				</Link>
			)}
		</motion.div>
	)
}

function MiniCalendar() {
	const now = dayjs()
	const currentDate = now.date()
	const firstDayOfMonth = now.startOf('month')
	const firstDayWeekday = (firstDayOfMonth.day() + 6) % 7
	const daysInMonth = now.daysInMonth()
	const days = ['一', '二', '三', '四', '五', '六', '日']

	return (
		<div className='grid grid-cols-7 gap-0.5 text-center text-[10px]'>
			{days.map(d => (
				<span key={d} className='text-secondary font-medium'>
					{d}
				</span>
			))}
			{new Array(firstDayWeekday).fill(0).map((_, i) => (
				<span key={`e-${i}`} />
			))}
			{new Array(daysInMonth).fill(0).map((_, i) => {
				const day = i + 1
				const isToday = day === currentDate
				return (
					<span
						key={day}
						className={`rounded ${isToday ? 'bg-brand text-white font-bold' : 'text-primary'}`}>
						{day}
					</span>
				)
			})}
		</div>
	)
}
