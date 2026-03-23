'use client'

import { useLayoutEditStore } from './stores/layout-edit-store'
import { useConfigStore } from './stores/config-store'
import { useAuthStore } from '@/hooks/use-auth'
import { useLogStore } from './stores/log-store'
import { toast } from 'sonner'
import { githubClient } from '@/lib/github-client'

export function LayoutSavePanel() {
	const editing = useLayoutEditStore(state => state.editing)
	const stopEditing = useLayoutEditStore(state => state.stopEditing)
	const { cardStyles, saveLayout, resetCardStyles } = useConfigStore()
	const { isAuth } = useAuthStore()
	const addLog = useLogStore(state => state.addLog)

	if (!editing) return null

	const handleSave = async () => {
		try {
			if (process.env.NODE_ENV === 'development') {
				await saveLayout()
				stopEditing()
				addLog('success', '布局已保存到本地', cardStyles)
				toast.success('布局已保存到本地')
			} else if (isAuth) {
				const content = JSON.stringify(cardStyles, null, '\t')
				await githubClient.updateFile('src/config/card-styles.json', content, '修改主页拖拽布局')
				stopEditing()
				addLog('success', '布局已推送到 GitHub', cardStyles)
				toast.success('布局已推送到 GitHub')
			} else {
				addLog('error', '生产环境需要导入密钥才能保存')
				toast.error('生产环境需要导入密钥才能保存')
			}
		} catch (error) {
			console.error('Save error:', error)
			addLog('error', '保存失败', error)
			toast.error('保存失败')
		}
	}

	const handleCancel = () => {
		resetCardStyles()
		stopEditing()
		addLog('warning', '取消布局修改')
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
