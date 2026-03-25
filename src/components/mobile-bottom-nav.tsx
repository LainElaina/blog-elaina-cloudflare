'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { HomeIcon, BookOpenIcon, FolderIcon, UserIcon, ShareIcon } from 'lucide-react'

const navItems = [
	{ icon: HomeIcon, label: '首页', href: '/' },
	{ icon: BookOpenIcon, label: '博客', href: '/blog' },
	{ icon: FolderIcon, label: '项目', href: '/projects' },
	{ icon: ShareIcon, label: '分享', href: '/share' },
	{ icon: UserIcon, label: '关于', href: '/about' }
]

export default function MobileBottomNav() {
	const pathname = usePathname()

	return (
		<motion.nav
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: 0.5 }}
			className='fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl px-2 py-2 sm:hidden'
			style={{
				width: 'min(380px, calc(100% - 2rem))',
				background: 'rgba(255, 255, 255, 0.6)',
				border: '1px solid rgba(255, 255, 255, 0.2)',
				backdropFilter: 'blur(16px)',
				boxShadow: '0 8px 32px -8px rgba(15, 23, 42, 0.12)'
			}}
			aria-label='主导航'>
			{navItems.map(item => {
				const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
				const Icon = item.icon

				return (
					<Link
						key={item.href}
						href={item.href}
						className='relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors'
						aria-label={item.label}
						aria-current={isActive ? 'page' : undefined}>
						{isActive && (
							<motion.div
								layoutId='mobile-nav-indicator'
								className='bg-brand/10 absolute inset-0 rounded-xl'
								transition={{ type: 'spring', stiffness: 400, damping: 30 }}
							/>
						)}
						<Icon className={`relative z-10 size-5 ${isActive ? 'text-brand' : 'text-secondary'}`} strokeWidth={isActive ? 2.2 : 1.8} />
						<span className={`relative z-10 text-[10px] ${isActive ? 'text-brand font-medium' : 'text-secondary'}`}>{item.label}</span>
					</Link>
				)
			})}
		</motion.nav>
	)
}
