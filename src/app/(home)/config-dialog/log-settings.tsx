'use client'

import { useLogStore, LOG_CATEGORY_LABELS, type LogCategory } from '../stores/log-store'

export function LogSettings() {
	const { enabled, setEnabled, setVisible, enabledCategories, toggleCategory } = useLogStore()

	const handleToggleLog = (checked: boolean) => {
		setEnabled(checked)
		if (checked) setVisible(true)
	}

	return (
		<div className='space-y-3'>
			<div className='flex items-center gap-2'>
				<input
					type='checkbox'
					id='log-enabled'
					checked={enabled}
					onChange={e => handleToggleLog(e.target.checked)}
				/>
				<label htmlFor='log-enabled' className='text-sm font-medium'>启用操作日志</label>
			</div>

			{enabled && (
				<div className='ml-6 space-y-2'>
					<div className='text-xs text-secondary mb-2'>选择要追踪的操作类型：</div>
					{(Object.keys(LOG_CATEGORY_LABELS) as LogCategory[]).map(category => (
						<label key={category} className='flex items-center gap-2 text-xs'>
							<input
								type='checkbox'
								checked={enabledCategories.has(category)}
								onChange={() => toggleCategory(category)}
							/>
							<span>{LOG_CATEGORY_LABELS[category]}</span>
						</label>
					))}
				</div>
			)}
		</div>
	)
}
