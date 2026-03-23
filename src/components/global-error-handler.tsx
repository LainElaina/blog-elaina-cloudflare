'use client'

import { useEffect } from 'react'
import { useLogStore } from '../app/(home)/stores/log-store'

export function GlobalErrorHandler() {
	useEffect(() => {
		const handleError = (event: ErrorEvent) => {
			useLogStore.getState().addLog('error', 'error', '未捕获的错误', {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				stack: event.error?.stack
			})
		}

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			useLogStore.getState().addLog('error', 'error', 'Promise 拒绝未处理', {
				reason: event.reason,
				promise: String(event.promise)
			})
		}

		window.addEventListener('error', handleError)
		window.addEventListener('unhandledrejection', handleUnhandledRejection)

		return () => {
			window.removeEventListener('error', handleError)
			window.removeEventListener('unhandledrejection', handleUnhandledRejection)
		}
	}, [])

	return null
}
