'use client'

import { useLayoutEditStore } from './stores/layout-edit-store'
import { useConfigStore } from './stores/config-store'
import { useCustomComponentStore } from './stores/custom-component-store'
import { useAuthStore } from '@/hooks/use-auth'
import { useLogStore } from './stores/log-store'
import { toast } from 'sonner'

type LayoutSnapshot = {
	id: string
	name: string
	timestamp: number
	data: unknown
	customComponents?: unknown[]
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLayoutSnapshots(value: unknown): LayoutSnapshot[] {
	if (!Array.isArray(value)) return []

	return value
		.filter(snapshot => isObject(snapshot) && typeof snapshot.id === 'string' && typeof snapshot.name === 'string' && Number.isFinite(snapshot.timestamp) && isObject(snapshot.data))
		.map(snapshot => ({
			id: snapshot.id,
			name: snapshot.name,
			timestamp: snapshot.timestamp,
			data: snapshot.data,
			...(Array.isArray(snapshot.customComponents) ? { customComponents: snapshot.customComponents } : {})
		}))
}

function readLayoutSnapshots(): LayoutSnapshot[] {
	try {
		const saved = localStorage.getItem('layout-snapshots')
		if (!saved) return []

		return normalizeLayoutSnapshots(JSON.parse(saved))
	} catch {
		return []
	}
}

export function LayoutSavePanel() {
	const editing = useLayoutEditStore(state => state.editing)
	const stopEditing = useLayoutEditStore(state => state.stopEditing)
	const cancelEditing = useLayoutEditStore(state => state.cancelEditing)
	const { cardStyles } = useConfigStore()
	const { components: customComponents } = useCustomComponentStore()
	const { isAuth } = useAuthStore()
	const addLog = useLogStore(state => state.addLog)

	if (!editing) return null

	const handleSave = async () => {
		try {
			// 保存到历史记录（包含自定义组件）
			const snapshots = readLayoutSnapshots()
			const newSnapshot = {
				id: Date.now().toString(),
				name: `自动保存 ${new Date().toLocaleString('zh-CN')}`,
				timestamp: Date.now(),
				data: cardStyles,
				customComponents
			}

			if (process.env.NODE_ENV === 'development') {
				const response = await fetch('/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cardStyles, customComponents })
				})
				if (!response.ok) {
					throw new Error('保存布局和自定义组件失败')
				}
				localStorage.setItem('layout-snapshots', JSON.stringify([newSnapshot, ...snapshots]))
				localStorage.setItem('custom-components', JSON.stringify(customComponents))
				stopEditing()
				addLog('success', 'layout', '布局和自定义组件已保存到本地', { cardStyles, customComponents })
				toast.success('布局和自定义组件已保存')
			} else if (isAuth) {
				const { commitRemoteTextFiles } = await import('@/lib/remote-text-commit')

				await commitRemoteTextFiles(
					[
						{
							path: 'src/config/card-styles.json',
							content: JSON.stringify(cardStyles, null, '\t')
						},
						{
							path: 'src/config/custom-components.json',
							content: JSON.stringify(customComponents, null, '\t')
						}
					],
					'保存布局和自定义组件'
				)

				localStorage.setItem('layout-snapshots', JSON.stringify([newSnapshot, ...snapshots]))
				stopEditing()
				addLog('success', 'layout', '布局和自定义组件已推送到 GitHub', { cardStyles, customComponents })
				toast.success('布局和自定义组件已推送到 GitHub')
			} else {
				addLog('error', 'layout', '生产环境需要导入密钥才能保存')
				toast.error('生产环境需要导入密钥才能保存')
			}
		} catch (error) {
			console.error('Save error:', error)
			addLog('error', 'layout', '保存失败', error)
			toast.error('保存失败')
		}
	}

	const handleCancel = () => {
		cancelEditing()
		addLog('warning', 'layout', '取消布局修改')
		toast.info('已取消修改')
	}

	return (
		<div className='fixed bottom-8 left-1/2 -translate-x-1/2 z-50 card squircle px-6 py-4 flex items-center gap-4 shadow-2xl backdrop-blur-xl'>
			<span className='text-sm text-secondary'>拖拽完成后保存布局</span>
			<button onClick={handleSave} className='px-5 py-2 bg-brand text-white rounded-xl hover:opacity-90 transition-all font-medium'>
				保存
			</button>
			<button onClick={handleCancel} className='px-5 py-2 bg-card border border-border rounded-xl hover:bg-gray-50 transition-all'>
				取消
			</button>
		</div>
	)
}
