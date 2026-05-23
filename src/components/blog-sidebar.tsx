'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { ANIMATION_DELAY, INIT_DELAY } from '@/consts'
import LikeButton from '@/components/like-button'
import { BlogToc } from '@/components/blog-toc'
import { ScrollTopButton } from '@/components/scroll-top-button'
import { useConfigStore } from '@/app/(home)/stores/config-store'
import { isSafeMarkdownImageUrl } from '@/lib/markdown-url-safety'
import Lightbox from '@/components/lightbox'

type TocItem = {
	id: string
	text: string
	level: number
}

type BlogSidebarProps = {
	cover?: string
	summary?: string
	toc: TocItem[]
	slug?: string
}

export function BlogSidebar({ cover, summary, toc, slug }: BlogSidebarProps) {
	const { siteContent } = useConfigStore()
	const [previewCover, setPreviewCover] = useState<string | null>(null)
	const summaryInContent = siteContent.summaryInContent ?? false
	const coverUrl = isSafeMarkdownImageUrl(cover) ? cover : null

	return (
		<div className='sticky flex w-[200px] shrink-0 flex-col items-start gap-4 self-start max-sm:hidden' style={{ top: 24 }}>
			{coverUrl && (
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: INIT_DELAY + ANIMATION_DELAY * 1 }}
					className='bg-card w-full border p-3 backdrop-blur-md'
					style={{ borderRadius: 'var(--card-inner-radius)' }}>
					<img
						src={coverUrl}
						alt='cover'
						className='h-auto w-full cursor-pointer border object-cover transition-opacity hover:opacity-80'
						style={{ borderRadius: 'var(--card-inner-radius)' }}
						onClick={() => setPreviewCover(coverUrl)}
					/>
				</motion.div>
			)}

			{summary && !summaryInContent && (
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: INIT_DELAY + ANIMATION_DELAY * 2 }}
					className='bg-card w-full border p-3 text-sm'
					style={{ borderRadius: 'var(--card-inner-radius)' }}>
					<h2 className='text-secondary mb-2 font-medium'>摘要</h2>
					<div className='text-secondary scrollbar-none max-h-[240px] cursor-text overflow-auto'>{summary}</div>
				</motion.div>
			)}

			<BlogToc toc={toc} delay={INIT_DELAY + ANIMATION_DELAY * 3} />

			<LikeButton slug={slug} delay={(INIT_DELAY + ANIMATION_DELAY * 4) * 1000} />

			<ScrollTopButton delay={INIT_DELAY + ANIMATION_DELAY * 5} />

			<Lightbox src={previewCover} alt='cover' onClose={() => setPreviewCover(null)} />
		</div>
	)
}
