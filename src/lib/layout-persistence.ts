/**
 * 布局持久化工具 - 双环境支持
 */

export const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * 保存布局到服务端（仅开发模式）
 */
export async function saveLayoutToServer(layout: any) {
	if (!isDevelopment) {
		throw new Error('Server save only available in development mode')
	}

	const response = await fetch('/api/layout', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(layout)
	})

	if (!response.ok) {
		throw new Error('Failed to save layout')
	}

	return response.json()
}

/**
 * 从服务端加载布局（仅开发模式）
 */
export async function loadLayoutFromServer() {
	if (!isDevelopment) {
		return null
	}

	const response = await fetch('/api/layout')
	if (!response.ok) return null

	return response.json()
}

/**
 * 回滚到上一个版本（仅开发模式）
 */
export async function undoLayout() {
	if (!isDevelopment) {
		throw new Error('Undo only available in development mode')
	}

	const response = await fetch('/api/layout/undo', { method: 'POST' })
	if (!response.ok) {
		throw new Error('Failed to undo layout')
	}

	return response.json()
}
