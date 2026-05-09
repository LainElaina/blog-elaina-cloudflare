const LOCAL_LAYOUT_API_UNAVAILABLE_ERROR = '布局服务端持久化仅在本地开发环境可用'

function assertLocalLayoutPersistenceAvailable() {
	if (process.env.NODE_ENV !== 'development') {
		throw new Error(LOCAL_LAYOUT_API_UNAVAILABLE_ERROR)
	}
}

/**
 * 保存布局到服务端（仅开发模式）
 */
export async function saveLayoutToServer(layout: any) {
	assertLocalLayoutPersistenceAvailable()

	const response = await fetch('/api/layout', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(layout)
	})

	if (!response.ok) {
		const error = await response.json()
		throw new Error(error.error || 'Failed to save layout')
	}

	return response.json()
}

/**
 * 从服务端加载布局（仅开发模式）
 */
export async function loadLayoutFromServer() {
	assertLocalLayoutPersistenceAvailable()

	const response = await fetch('/api/layout')
	if (!response.ok) return null

	return response.json()
}

/**
 * 回滚到上一个版本（仅开发模式）
 */
export async function undoLayout() {
	assertLocalLayoutPersistenceAvailable()

	const response = await fetch('/api/layout/undo', { method: 'POST' })
	if (!response.ok) {
		throw new Error('Failed to undo layout')
	}

	return response.json()
}
