'use client'

import { useTemplateStore } from '../stores/template-store'
import { useConfigStore } from '../stores/config-store'
import { COMPONENT_REGISTRY } from '@/config/component-registry'
import { Plus, Trash2, Download } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function TemplateManager() {
	const { templates, activeComponents, addTemplate, deleteTemplate, loadTemplate, addComponent, removeComponent } = useTemplateStore()
	const { cardStyles, setCardStyles } = useConfigStore()
	const [newTemplateName, setNewTemplateName] = useState('')

	const handleSaveAsTemplate = () => {
		if (!newTemplateName.trim()) {
			toast.error('请输入模板名称')
			return
		}
		addTemplate(newTemplateName, activeComponents, cardStyles)
		toast.success(`模板 "${newTemplateName}" 已保存`)
		setNewTemplateName('')
	}

	const handleLoadTemplate = (id: string) => {
		const styles = loadTemplate(id)
		if (styles) {
			setCardStyles(styles)
			toast.success('模板已加载')
		}
	}

	const handleDeleteTemplate = (id: string, name: string) => {
		if (confirm(`确定删除模板 "${name}"？`)) {
			deleteTemplate(id)
			toast.success('模板已删除')
		}
	}

	return (
		<div className='space-y-6'>
			<div>
				<h3 className='text-lg font-medium mb-3'>当前激活组件</h3>
				<div className='space-y-2'>
					{Object.values(COMPONENT_REGISTRY).map(meta => {
						const isActive = activeComponents.includes(meta.id)
						return (
							<label key={meta.id} className='flex items-center gap-2 p-2 hover:bg-gray-50 rounded'>
								<input
									type='checkbox'
									checked={isActive}
									onChange={e => e.target.checked ? addComponent(meta.id) : removeComponent(meta.id)}
								/>
								<span className='text-sm'>{meta.name}</span>
								{meta.desktopOnly && <span className='text-xs text-gray-400'>(仅桌面)</span>}
							</label>
						)
					})}
				</div>
			</div>

			<div>
				<h3 className='text-lg font-medium mb-3'>保存为模板</h3>
				<div className='flex gap-2'>
					<input
						type='text'
						value={newTemplateName}
						onChange={e => setNewTemplateName(e.target.value)}
						placeholder='输入模板名称'
						className='flex-1 px-3 py-2 border rounded-lg'
					/>
					<button onClick={handleSaveAsTemplate} className='px-4 py-2 bg-brand text-white rounded-lg hover:opacity-90'>
						<Plus className='w-4 h-4' />
					</button>
				</div>
			</div>

			<div>
				<h3 className='text-lg font-medium mb-3'>已保存模板</h3>
				<div className='space-y-2'>
					{templates.map(template => (
						<div key={template.id} className='flex items-center justify-between p-3 border rounded-lg'>
							<div>
								<div className='font-medium'>{template.name}</div>
								<div className='text-xs text-gray-500'>{template.components.length} 个组件</div>
							</div>
							<div className='flex gap-2'>
								<button onClick={() => handleLoadTemplate(template.id)} className='p-2 hover:bg-gray-100 rounded'>
									<Download className='w-4 h-4' />
								</button>
								<button onClick={() => handleDeleteTemplate(template.id, template.name)} className='p-2 hover:bg-red-50 text-red-500 rounded'>
									<Trash2 className='w-4 h-4' />
								</button>
							</div>
						</div>
					))}
					{templates.length === 0 && (
						<div className='text-center text-gray-400 py-8'>暂无保存的模板</div>
					)}
				</div>
			</div>
		</div>
	)
}
