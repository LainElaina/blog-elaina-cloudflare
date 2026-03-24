'use client'

import { useLayoutEditStore } from './stores/layout-edit-store'
import { useConfigStore } from './stores/config-store'
import { useCustomComponentStore } from './stores/custom-component-store'
import { useAuthStore } from '@/hooks/use-auth'
import { useLogStore } from './stores/log-store'
import { toast } from 'sonner'

export function LayoutSavePanel() {
	const editing = useLayoutEditStore(state => state.editing)
	const stopEditing = useLayoutEditStore(state => state.stopEditing)
	const cancelEditing = useLayoutEditStore(state => state.cancelEditing)
	const { cardStyles, saveLayout } = useConfigStore()
	const { components: customComponents } = useCustomComponentStore()
	const { isAuth } = useAuthStore()
	const addLog = useLogStore(state => state.addLog)

	if (!editing) return null

	const handleSave = async () => {
		try {
			// 保存到历史记录（包含自定义组件）
			const snapshots = JSON.parse(localStorage.getItem('layout-snapshots') || '[]')
			const newSnapshot = {
				id: Date.now().toString(),
				name: `自动保存 ${new Date().toLocaleString('zh-CN')}`,
				timestamp: Date.now(),
				data: cardStyles,
				customComponents
			}
			localStorage.setItem('layout-snapshots', JSON.stringify([newSnapshot, ...snapshots]))

			if (process.env.NODE_ENV === 'development') {
				await saveLayout()
				// 同时保存自定义组件到本地
				localStorage.setItem('custom-components', JSON.stringify(customComponents))
				stopEditing()
				addLog('success', 'layout', '布局和自定义组件已保存到本地', { cardStyles, customComponents })
				toast.success('布局和自定义组件已保存')
			} else if (isAuth) {
				const { getAuthToken } = await import('@/lib/auth')
				const { getRef, createBlob, createTree, createCommit, updateRef, toBase64Utf8 } = await import('@/lib/github-client')
				const { GITHUB_CONFIG } = await import('@/consts')

				const token = await getAuthToken()
				const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)

				const cardStylesContent = JSON.stringify(cardStyles, null, '\t')
				const customComponentsContent = JSON.stringify(customComponents, null, '\t')

				const blob1 = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(cardStylesContent), 'base64')
				const blob2 = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(customComponentsContent), 'base64')

				const tree = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, [
					{ path: 'src/config/card-styles.json', mode: '100644', type: 'blob', sha: blob1.sha },
					{ path: 'src/config/custom-components.json', mode: '100644', type: 'blob', sha: blob2.sha }
				], ref.sha)

				const commit = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '保存布局和自定义组件', tree.sha, [ref.sha])
				await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commit.sha)

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
