'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from '../app/(home)/stores/config-store'
import { useLogStore } from '../app/(home)/stores/log-store'
import { CARD_SPACING } from '@/consts'
import MusicSVG from '@/svgs/music.svg'
import PlaySVG from '@/svgs/play.svg'
import { HomeDraggableLayer } from '../app/(home)/home-draggable-layer'
import { Pause } from 'lucide-react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const MUSIC_LIST = [
	{ file: '/music/literature.mp3', title: 'リテラチュア' },
	{ file: '/music/literature-piano.mp3', title: 'リテラチュア (Piano ver.)' },
	{ file: '/music/haiiro-no-saga.mp3', title: '灰色のサーガ' }
]

export default function MusicCard() {
	const pathname = usePathname()
	const center = useCenterStore()
	const { cardStyles, siteContent } = useConfigStore()
	const styles = cardStyles.musicCard
	const hiCardStyles = cardStyles.hiCard
	const clockCardStyles = cardStyles.clockCard
	const calendarCardStyles = cardStyles.calendarCard

	const [isPlaying, setIsPlaying] = useState(false)
	const [currentIndex, setCurrentIndex] = useState(0)
	const [progress, setProgress] = useState(0)
	const [showPlaylist, setShowPlaylist] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const currentIndexRef = useRef(0)

	const isHomePage = pathname === '/'

	const position = useMemo(() => {
		const expandedHeight = showPlaylist ? styles.height + MUSIC_LIST.length * 44 + 24 : styles.height

		// If playlist is shown or not on home page, position at bottom-right corner
		if (showPlaylist || (!isHomePage && isPlaying)) {
			return {
				x: center.width - styles.width - 16,
				y: center.height - expandedHeight - 16
			}
		}

		// Default position on home page
		return {
			x: styles.offsetX !== null ? center.x + styles.offsetX : center.x + CARD_SPACING + hiCardStyles.width / 2 - styles.offset,
			y: styles.offsetY !== null ? center.y + styles.offsetY : center.y - clockCardStyles.offset + CARD_SPACING + calendarCardStyles.height + CARD_SPACING
		}
	}, [showPlaylist, isPlaying, isHomePage, center, styles, hiCardStyles, clockCardStyles, calendarCardStyles])

	const { x, y } = position

	// Initialize audio element
	useEffect(() => {
		if (!audioRef.current) {
			audioRef.current = new Audio()
		}

		const audio = audioRef.current

		const updateProgress = () => {
			if (audio.duration) {
				setProgress((audio.currentTime / audio.duration) * 100)
				setCurrentTime(audio.currentTime)
				setDuration(audio.duration)
			}
		}

		const handleEnded = () => {
			const nextIndex = (currentIndexRef.current + 1) % MUSIC_LIST.length
			currentIndexRef.current = nextIndex
			setCurrentIndex(nextIndex)
			setProgress(0)
		}

		const handleTimeUpdate = () => {
			updateProgress()
		}

		const handleLoadedMetadata = () => {
			updateProgress()
		}

		audio.addEventListener('timeupdate', handleTimeUpdate)
		audio.addEventListener('ended', handleEnded)
		audio.addEventListener('loadedmetadata', handleLoadedMetadata)

		return () => {
			audio.removeEventListener('timeupdate', handleTimeUpdate)
			audio.removeEventListener('ended', handleEnded)
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
		}
	}, [])

	// Handle currentIndex change - load new audio
	useEffect(() => {
		currentIndexRef.current = currentIndex
		if (audioRef.current) {
			const wasPlaying = !audioRef.current.paused
			audioRef.current.pause()
			audioRef.current.src = MUSIC_LIST[currentIndex].file
			audioRef.current.loop = false
			setProgress(0)

			if (wasPlaying) {
				audioRef.current.play().catch(console.error)
			}
		}
	}, [currentIndex])

	// Handle play/pause state change
	useEffect(() => {
		if (!audioRef.current) return

		if (isPlaying) {
			audioRef.current.play().catch(console.error)
		} else {
			audioRef.current.pause()
		}
	}, [isPlaying])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.src = ''
			}
		}
	}, [])

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	const togglePlayPause = () => {
		const next = !isPlaying
		setIsPlaying(next)
		useLogStore.getState().addLog('info', 'music', next ? '播放音乐' : '暂停音乐', { track: MUSIC_LIST[currentIndex].title })
	}

	const selectTrack = (index: number) => {
		setCurrentIndex(index)
		setIsPlaying(true)
		setShowPlaylist(false)
		useLogStore.getState().addLog('info', 'music', '切换歌曲', { track: MUSIC_LIST[index].title })
	}

	// Hide component if not on home page and not playing
	if (!isHomePage && !isPlaying) {
		return null
	}

	return (
		<HomeDraggableLayer cardKey='musicCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card
				order={styles.order}
				width={styles.width}
				height={showPlaylist ? styles.height + MUSIC_LIST.length * 44 + 24 : styles.height}
				x={x}
				y={y}
				className={clsx(!isHomePage && 'fixed')}
			>
				<div className={clsx('flex flex-col h-full', showPlaylist ? 'p-4 justify-start' : 'items-center justify-center')}>
					{siteContent.enableChristmas && (
						<>
							<img
								src='/images/christmas/snow-10.webp'
								alt='Christmas decoration'
								className='pointer-events-none absolute'
								style={{ width: 120, left: -8, top: -12, opacity: 0.8 }}
							/>
							<img
								src='/images/christmas/snow-11.webp'
								alt='Christmas decoration'
								className='pointer-events-none absolute'
								style={{ width: 80, right: -10, top: -12, opacity: 0.8 }}
							/>
						</>
					)}

					<div className='flex items-center gap-3 cursor-pointer w-full' onClick={() => setShowPlaylist(!showPlaylist)}>
						<MusicSVG className='h-8 w-8 flex-shrink-0' />

						<div className='flex-1 min-w-0'>
							<div className='text-secondary text-sm truncate'>{MUSIC_LIST[currentIndex].title}</div>

							<div className='mt-1 h-2 rounded-full bg-white/60'>
								<div className='bg-linear h-full rounded-full transition-all duration-300' style={{ width: `${progress}%` }} />
							</div>

							{duration > 0 && (
								<div className='text-xs text-secondary/70 mt-1'>
									{formatTime(currentTime)} / {formatTime(duration)}
								</div>
							)}
						</div>

						<button onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white transition-opacity hover:opacity-80'>
							{isPlaying ? <Pause className='text-brand h-4 w-4' /> : <PlaySVG className='text-brand ml-1 h-4 w-4' />}
						</button>
					</div>

					{showPlaylist && (
						<div className='mt-3 space-y-1 w-full'>
							{MUSIC_LIST.map((track, index) => (
								<div
									key={index}
									onClick={() => selectTrack(index)}
									className={clsx(
										'px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm',
										currentIndex === index ? 'bg-white/40 text-brand font-medium' : 'hover:bg-white/20 text-secondary'
									)}
								>
									{track.title}
								</div>
							))}
						</div>
					)}
				</div>
			</Card>
		</HomeDraggableLayer>
	)
}
