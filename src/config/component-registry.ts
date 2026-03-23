import { ComponentType } from 'react'
import HiCard from '@/app/(home)/hi-card'
import ArtCard from '@/app/(home)/art-card'
import ClockCard from '@/app/(home)/clock-card'
import CalendarCard from '@/app/(home)/calendar-card'
import SocialButtons from '@/app/(home)/social-buttons'
import ShareCard from '@/app/(home)/share-card'
import AritcleCard from '@/app/(home)/aritcle-card'
import WriteButtons from '@/app/(home)/write-buttons'
import LikePosition from '@/app/(home)/like-position'
import HatCard from '@/app/(home)/hat-card'
import BeianCard from '@/app/(home)/beian-card'

export interface ComponentMeta {
	id: string
	name: string
	component: ComponentType
	defaultStyle: {
		width: number
		height: number
		order: number
		offsetX: number | null
		offsetY: number | null
		enabled: boolean
		offset?: number
	}
	mobileOnly?: boolean
	desktopOnly?: boolean
}

export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = {
	artCard: {
		id: 'artCard',
		name: '头像卡片',
		component: ArtCard,
		defaultStyle: { width: 360, height: 200, order: 3, offsetX: null, offsetY: null, enabled: true }
	},
	hiCard: {
		id: 'hiCard',
		name: '问候卡片',
		component: HiCard,
		defaultStyle: { width: 360, height: 288, order: 1, offsetX: null, offsetY: null, enabled: true }
	},
	clockCard: {
		id: 'clockCard',
		name: '时钟卡片',
		component: ClockCard,
		defaultStyle: { width: 232, height: 132, order: 4, offsetX: null, offsetY: null, offset: 92, enabled: true },
		desktopOnly: true
	},
	calendarCard: {
		id: 'calendarCard',
		name: '日历卡片',
		component: CalendarCard,
		defaultStyle: { width: 350, height: 286, order: 5, offsetX: null, offsetY: null, enabled: true },
		desktopOnly: true
	},
	socialButtons: {
		id: 'socialButtons',
		name: '社交按钮',
		component: SocialButtons,
		defaultStyle: { width: 315, height: 48, order: 6, offsetX: null, offsetY: null, enabled: true }
	},
	shareCard: {
		id: 'shareCard',
		name: '分享卡片',
		component: ShareCard,
		defaultStyle: { width: 200, height: 180, order: 7, offsetX: null, offsetY: null, enabled: true },
		desktopOnly: true
	},
	articleCard: {
		id: 'articleCard',
		name: '文章卡片',
		component: AritcleCard,
		defaultStyle: { width: 266, height: 160, order: 8, offsetX: null, offsetY: null, enabled: true }
	},
	writeButtons: {
		id: 'writeButtons',
		name: '写作按钮',
		component: WriteButtons,
		defaultStyle: { width: 180, height: 42, order: 8, offsetX: null, offsetY: null, enabled: true },
		desktopOnly: true
	},
	likePosition: {
		id: 'likePosition',
		name: '点赞位置',
		component: LikePosition,
		defaultStyle: { width: 54, height: 54, order: 8, offsetX: null, offsetY: null, enabled: true }
	},
	hatCard: {
		id: 'hatCard',
		name: '帽子卡片',
		component: HatCard,
		defaultStyle: { width: 99, height: 105, order: 10, offsetX: -48, offsetY: -168, enabled: false }
	},
	beianCard: {
		id: 'beianCard',
		name: '备案卡片',
		component: BeianCard,
		defaultStyle: { width: 200, height: 60, order: 11, offsetX: null, offsetY: null, enabled: false }
	}
}
