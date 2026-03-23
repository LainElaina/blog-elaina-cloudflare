import { create } from 'zustand'

export interface LogEntry {
	id: string
	timestamp: number
	level: 'info' | 'success' | 'warning' | 'error'
	action: string
	details?: any
}

interface LogStore {
	logs: LogEntry[]
	enabled: boolean
	visible: boolean
	addLog: (level: LogEntry['level'], action: string, details?: any) => void
	clearLogs: () => void
	setEnabled: (enabled: boolean) => void
	setVisible: (visible: boolean) => void
	exportLogs: () => string
}

export const useLogStore = create<LogStore>((set, get) => ({
	logs: [],
	enabled: false,
	visible: false,
	addLog: (level, action, details) => {
		const { enabled } = get()
		if (!enabled) return

		const log: LogEntry = {
			id: Date.now().toString(),
			timestamp: Date.now(),
			level,
			action,
			details
		}

		set(state => ({
			logs: [log, ...state.logs].slice(0, 100) // 保留最近100条
		}))
	},
	clearLogs: () => set({ logs: [] }),
	setEnabled: (enabled) => set({ enabled }),
	setVisible: (visible) => set({ visible }),
	exportLogs: () => {
		const { logs } = get()
		return JSON.stringify(logs, null, 2)
	}
}))
