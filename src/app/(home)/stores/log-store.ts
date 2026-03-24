import { create } from 'zustand'

export interface LogEntry {
	id: string
	timestamp: number
	level: 'info' | 'success' | 'warning' | 'error'
	category: LogCategory
	action: string
	details?: any
}

export type LogCategory =
	| 'layout'      // 布局编辑
	| 'history'     // 历史记录
	| 'music'       // 音乐播放
	| 'config'      // 配置修改
	| 'blog'        // 博客操作
	| 'image'       // 图片操作
	| 'network'     // 网络请求
	| 'error'       // 错误捕获

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
	layout: '布局编辑',
	history: '历史记录',
	music: '音乐播放',
	config: '配置修改',
	blog: '博客操作',
	image: '图片操作',
	network: '网络请求',
	error: '错误捕获'
}

interface LogStore {
	logs: LogEntry[]
	enabled: boolean
	visible: boolean
	enabledCategories: Set<LogCategory>
	logCounter: number
	hasUnreadError: boolean
	addLog: (level: LogEntry['level'], category: LogCategory, action: string, details?: any) => void
	clearLogs: () => void
	setEnabled: (enabled: boolean) => void
	setVisible: (visible: boolean) => void
	toggleCategory: (category: LogCategory) => void
	exportLogs: () => string
}

export const useLogStore = create<LogStore>((set, get) => ({
	logs: [],
	enabled: typeof window !== 'undefined' ? localStorage.getItem('log-enabled') === 'true' : false,
	visible: typeof window !== 'undefined' ? localStorage.getItem('log-visible') === 'true' : false,
	enabledCategories: new Set<LogCategory>(['layout', 'history', 'music', 'config', 'blog', 'image', 'network', 'error']),
	logCounter: 0,
	hasUnreadError: false,
	addLog: (level, category, action, details) => {
		const { enabled, enabledCategories, logCounter } = get()
		if (!enabled || !enabledCategories.has(category)) return

		const log: LogEntry = {
			id: `${Date.now()}-${logCounter}`,
			timestamp: Date.now(),
			level,
			category,
			action,
			details
		}

		set(state => ({
			logs: [log, ...state.logs].slice(0, 100),
			logCounter: state.logCounter + 1,
			hasUnreadError: level === 'error' ? true : state.hasUnreadError
		}))
	},
	clearLogs: () => set({ logs: [] }),
	setEnabled: (enabled) => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('log-enabled', String(enabled))
		}
		set({ enabled })
	},
	setVisible: (visible) => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('log-visible', String(visible))
		}
		set({ visible, ...(visible ? { hasUnreadError: false } : {}) })
	},
	toggleCategory: (category) => set(state => {
		const newCategories = new Set(state.enabledCategories)
		if (newCategories.has(category)) {
			newCategories.delete(category)
		} else {
			newCategories.add(category)
		}
		return { enabledCategories: newCategories }
	}),
	exportLogs: () => {
		const { logs } = get()
		return JSON.stringify(logs, null, 2)
	}
}))
