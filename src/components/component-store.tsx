'use client'

import { Store, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTemplateStore } from '../app/(home)/stores/template-store'
import { COMPONENT_REGISTRY } from '@/config/component-registry'
import { CARD_TEMPLATES } from '@/config/card-templates'
import { toast } from 'sonner'

export function ComponentStore() {
	const [mounted, setMounted] = useState(false)
	const [showStore, setShowStore] = useState(false)
	const { activeComponents, addComponent, removeComponent, setActiveComponents } = useTemplateStore()

	useEffect(() => {
		setMounted(true)
		const saved = localStorage.getItem('active-components')
		if (saved) {
			setActiveComponents(JSON.parse(saved))
		}
		const savedTemplates = localStorage.getItem('templates')
		if (savedTemplates) {
			useTemplateStore.setState({ templates: JSON.parse(savedTemplates) })
		}
	}, [])

	if (!mounted) return null

	return (
		<>
			<button
				onClick={() => setShowStore(!showStore)}
				className='fixed top-6 right-24 z-[9998] card squircle p-3 shadow-2xl hover:scale-105 transition-transform'
				title='组件商店'
			>
				<Store className='w-5 h-5 text-brand' />
			</button>

			{showStore && (
				<div className='fixed top-20 right-24 z-[9999] card squircle p-6 shadow-2xl w-96 max-h-[600px] overflow-y-auto'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-lg font-medium'>组件商店</h3>
						<button onClick={() => setShowStore(false)} className='p-1 hover:bg-gray-100 rounded'>
							<X className='w-4 h-4' />
						</button>
					</div>

					<div className='space-y-3'>
						{Object.values(COMPONENT_REGISTRY).map(meta => {
							const isActive = activeComponents.includes(meta.id)
							return (
								<div key={meta.id} className='border rounded-lg p-3 hover:bg-gray-50'>
									<div className='flex items-start justify-between'>
										<div className='flex-1'>
											<div className='font-medium text-sm'>{meta.name}</div>
											<div className='text-xs text-gray-500 mt-1'>
												{meta.defaultStyle.width}×{meta.defaultStyle.height}
												{meta.desktopOnly && ' · 仅桌面'}
											</div>
										</div>
										<button
											onClick={() => {
												if (isActive) {
													removeComponent(meta.id)
													toast.success(`已移除 ${meta.name}`)
												} else {
													addComponent(meta.id)
													toast.success(`已添加 ${meta.name}`)
												}
											}}
											className={`px-3 py-1 text-xs rounded ${
												isActive ? 'bg-red-100 text-red-600' : 'bg-brand text-white'
											}`}
										>
											{isActive ? '移除' : '添加'}
										</button>
									</div>
								</div>
							)
						})}
					</div>

					<div className='mt-6 pt-4 border-t'>
						<h4 className='text-sm font-medium mb-3'>样式模板</h4>
						<div className='grid grid-cols-2 gap-2'>
							{CARD_TEMPLATES.map(template => (
								<div key={template.id} className='border rounded p-2 text-xs'>
									<div className='font-medium'>{template.name}</div>
									<div className='text-gray-500 text-[10px]'>{template.description}</div>
									<div className='text-gray-400 text-[10px] mt-1'>
										{template.style.width}×{template.style.height}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
