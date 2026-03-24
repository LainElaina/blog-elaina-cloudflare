'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { ColorPicker } from '@/components/color-picker'
import { XIcon, Save, Trash2, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { SiteContent } from '../stores/config-store'
import { useAuthStore } from '@/hooks/use-auth'
import siteContent from '@/config/site-content.json'
import colorPresetsDefault from '@/config/color-presets.json'

interface ColorConfigProps {
	formData: SiteContent
	setFormData: React.Dispatch<React.SetStateAction<SiteContent>>
}

const DEFAULT_THEME_COLORS = siteContent.theme

type ColorPreset = {
	name: string
	theme: Partial<SiteContent['theme']>
	backgroundColors: string[]
}

const BUILTIN_PRESETS: ColorPreset[] = [
	{
		name: '春暖',
		theme: {
			colorBrand: '#35bfab',
			colorBrandSecondary: '#1fc9e7',
			colorPrimary: '#334f52',
			colorSecondary: '#7b888e',
			colorBg: '#eeeeee',
			colorBorder: '#ffffff',
			colorCard: '#ffffff66',
			colorArticle: '#ffffffcc'
		},
		backgroundColors: ['#EDDD62', '#9EE7D1', '#84D68A', '#EDDD62', '#88E6E5', '#a7f3d0']
	},
	{
		name: '秋实',
		theme: {
			colorPrimary: '#4E3F42',
			colorBrand: '#de4331',
			colorBrandSecondary: '#FCC841'
		},
		backgroundColors: ['#FCC841', '#DFEFFC', '#DEDE92', '#DE4331', '#FE9750', '#FCC841']
	},
	{
		name: '深夜',
		theme: {
			colorBrand: '#2a48f3',
			colorPrimary: '#e6e8e8',
			colorSecondary: '#acadae',
			colorBrandSecondary: '#51d0b9',
			colorBg: '#0a051f',
			colorBorder: '#8a8a8a5e',
			colorCard: '#ffffff0e',
			colorArticle: '#6f6f6f33'
		},
		backgroundColors: ['#16007b']
	}
]

// 加载自定义预设：优先 localStorage，否则用项目 JSON
const loadCustomPresets = (): ColorPreset[] => {
	if (typeof window === 'undefined') return colorPresetsDefault as ColorPreset[]
	try {
		const saved = localStorage.getItem('color-presets')
		if (saved) return JSON.parse(saved)
	} catch {}
	return colorPresetsDefault as ColorPreset[]
}

export function ColorConfig({ formData, setFormData }: ColorConfigProps) {
	const theme = formData.theme ?? {}
	const cardStylePreset = theme.cardStylePreset ?? 'classic'
	const enableHomeColorOverlay = theme.enableHomeColorOverlay ?? false
	const homeColorOverlayMode = theme.homeColorOverlayMode ?? 'atmosphere'
	const enableSeasonalEffects = theme.enableSeasonalEffects ?? false
	const seasonalEffectTheme = theme.seasonalEffectTheme ?? 'spring'
	const seasonalEffectStyle = theme.seasonalEffectStyle ?? 'light'
	const { isAuth } = useAuthStore()
	const [customPresets, setCustomPresets] = useState<ColorPreset[]>(loadCustomPresets)
	const [isSaving, setIsSaving] = useState(false)

	const saveCustomPresetsLocal = (presets: ColorPreset[]) => {
		setCustomPresets(presets)
		if (typeof window !== 'undefined') {
			localStorage.setItem('color-presets', JSON.stringify(presets))
		}
	}

	const handleThemeColorChange = (key: keyof typeof DEFAULT_THEME_COLORS, value: string) => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				[key]: value
			}
		}))
	}

	const handleBrandColorChange = (value: string) => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				colorBrand: value
			}
		}))
	}

	const handleCardStylePresetChange = (value: 'classic' | 'refined') => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				cardStylePreset: value
			}
		}))
	}

	const handleHomeColorOverlayToggle = (value: boolean) => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				enableHomeColorOverlay: value
			}
		}))
	}

	const handleHomeColorOverlayModeChange = (value: 'atmosphere' | 'solid') => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				homeColorOverlayMode: value
			}
		}))
	}

	const handleSeasonalEffectsToggle = (value: boolean) => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				enableSeasonalEffects: value
			}
		}))
	}

	const handleSeasonalEffectThemeChange = (value: 'spring' | 'summer' | 'autumn' | 'winter') => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				seasonalEffectTheme: value
			}
		}))
	}

	const handleSeasonalEffectStyleChange = (value: 'light' | 'vivid' | 'mixed') => {
		setFormData(prev => ({
			...prev,
			theme: {
				...prev.theme,
				seasonalEffectStyle: value
			}
		}))
	}

	const handleColorChange = (index: number, value: string) => {
		const newColors = [...formData.backgroundColors]
		newColors[index] = value
		setFormData({ ...formData, backgroundColors: newColors })
	}

	const generateRandomColor = () => {
		const randomChannel = () => Math.floor(Math.random() * 256)
		return `#${[randomChannel(), randomChannel(), randomChannel()]
			.map(channel => channel.toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase()}`
	}

	const handleRandomizeColors = () => {
		const count = Math.floor(Math.random() * 5) + 4
		const backgroundColors = Array.from({ length: count }, () => generateRandomColor())
		const colorBrand = generateRandomColor()

		setFormData(prev => ({
			...prev,
			backgroundColors,
			theme: {
				...prev.theme,
				colorBrand
			}
		}))
	}

	const handleAddColor = () => {
		setFormData({
			...formData,
			backgroundColors: [...formData.backgroundColors, '#EDDD62']
		})
	}

	const handleRemoveColor = (index: number) => {
		if (formData.backgroundColors.length > 1) {
			const newColors = formData.backgroundColors.filter((_, i) => i !== index)
			setFormData({ ...formData, backgroundColors: newColors })
		}
	}

	const handlePresetChange = (preset: ColorPreset) => {
		setFormData(prev => ({
			...prev,
			backgroundColors: [...preset.backgroundColors],
			theme: {
				...prev.theme,
				...preset.theme
			}
		}))
	}

	// 保存当前配色为预设
	const handleSaveAsPreset = () => {
		const name = prompt('输入预设名称：')
		if (!name?.trim()) return
		const newPreset: ColorPreset = {
			name: name.trim(),
			theme: { ...formData.theme },
			backgroundColors: [...formData.backgroundColors]
		}
		saveCustomPresetsLocal([...customPresets, newPreset])
		toast.success(`已保存预设"${name.trim()}"`)
	}

	// 删除自定义预设
	const handleDeletePreset = (index: number) => {
		const preset = customPresets[index]
		if (!confirm(`确定删除预设"${preset.name}"？`)) return
		const updated = customPresets.filter((_, i) => i !== index)
		saveCustomPresetsLocal(updated)
		toast.success('已删除预设')
	}

	// 导出配色为文件
	const handleExportColors = () => {
		const name = prompt('输入预设名称：')
		if (!name?.trim()) return
		const config: ColorPreset = {
			name: name.trim(),
			theme: formData.theme,
			backgroundColors: formData.backgroundColors
		}
		const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${name.trim()}.json`
		a.click()
		URL.revokeObjectURL(url)
		toast.success('配色已导出')
	}

	// 导入配色文件为自定义预设
	const handleImportColors = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = (event) => {
			try {
				const config = JSON.parse(event.target?.result as string)
				if (config.theme || config.backgroundColors) {
					const name = config.name || file.name.replace(/\.json$/, '')
					const newPreset: ColorPreset = {
						name,
						theme: config.theme || {},
						backgroundColors: config.backgroundColors || []
					}
					saveCustomPresetsLocal([...customPresets, newPreset])
					toast.success(`已导入预设"${name}"`)
				} else {
					toast.error('文件中未找到配色数据')
				}
			} catch {
				toast.error('导入失败，请检查文件格式')
			}
		}
		reader.readAsText(file)
		e.target.value = ''
	}

	// 持久化保存自定义预设到项目
	const handlePersistPresets = async () => {
		setIsSaving(true)
		try {
			if (process.env.NODE_ENV === 'development') {
				await fetch('/api/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ colorPresets: customPresets })
				})
				toast.success('色彩预设已保存到项目')
			} else if (isAuth) {
				const { getAuthToken } = await import('@/lib/auth')
				const { getRef, createTree, createCommit, updateRef, createBlob } = await import('@/lib/github-client')
				const { GITHUB_CONFIG } = await import('@/consts')
				const token = await getAuthToken()
				const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
				const content = btoa(unescape(encodeURIComponent(JSON.stringify(customPresets, null, '\t'))))
				const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, content, 'base64')
				const tree = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, [
					{ path: 'src/config/color-presets.json', mode: '100644', type: 'blob', sha: blob.sha }
				], ref.sha)
				const commit = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, '保存色彩预设', tree.sha, [ref.sha])
				await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commit.sha)
				toast.success('色彩预设已推送到 GitHub')
			} else {
				toast.error('线上环境需要先导入密钥')
			}
		} catch (error) {
			console.error(error)
			toast.error('保存失败')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div className='space-y-6'>
			<div>
				<div className='mb-2 flex items-center justify-between'>
					<label className='block text-sm font-medium'>基础颜色</label>
					<div className='flex gap-2'>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleExportColors}
							className='rounded-lg border bg-white/60 px-3 py-1 text-xs whitespace-nowrap'>
							<Download className='w-3 h-3 inline mr-1' />
							导出
						</motion.button>
						<label className='rounded-lg border bg-white/60 px-3 py-1 text-xs whitespace-nowrap cursor-pointer hover:bg-white/80 transition-colors inline-flex items-center'>
							<Upload className='w-3 h-3 mr-1' />
							导入为预设
							<input type='file' accept='.json' className='hidden' onChange={handleImportColors} />
						</label>
					</div>
				</div>
				<div className='grid grid-cols-2 gap-4'>
					<div className='flex items-center gap-3'>
						<ColorPicker value={formData.theme?.colorBrand ?? '#35bfab'} onChange={handleBrandColorChange} />
						<span className='text-xs'>主题色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker
							value={theme.colorBrandSecondary ?? DEFAULT_THEME_COLORS.colorBrandSecondary}
							onChange={value => handleThemeColorChange('colorBrandSecondary', value)}
						/>
						<span className='text-xs'>次级主题色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker value={theme.colorPrimary ?? DEFAULT_THEME_COLORS.colorPrimary} onChange={value => handleThemeColorChange('colorPrimary', value)} />
						<span className='text-xs'>主色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker
							value={theme.colorSecondary ?? DEFAULT_THEME_COLORS.colorSecondary}
							onChange={value => handleThemeColorChange('colorSecondary', value)}
						/>
						<span className='text-xs'>次色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker value={theme.colorBg ?? DEFAULT_THEME_COLORS.colorBg} onChange={value => handleThemeColorChange('colorBg', value)} />
						<span className='text-xs'>背景色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker value={theme.colorBorder ?? DEFAULT_THEME_COLORS.colorBorder} onChange={value => handleThemeColorChange('colorBorder', value)} />
						<span className='text-xs'>边框色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker value={theme.colorCard ?? DEFAULT_THEME_COLORS.colorCard} onChange={value => handleThemeColorChange('colorCard', value)} />
						<span className='text-xs'>卡片色</span>
					</div>
					<div className='flex items-center gap-3'>
						<ColorPicker value={theme.colorArticle ?? DEFAULT_THEME_COLORS.colorArticle} onChange={value => handleThemeColorChange('colorArticle', value)} />
						<span className='text-xs'>文章背景</span>
					</div>
				</div>
				<p className='text-[10px] text-secondary/60 mt-2'>
					修改颜色后，点击弹窗底部的"本地保存"或"保存"按钮可应用配色到博客。如需保留为可复用的预设，请在下方"保存当前配色为预设"后点击"保存自定义预设到项目"进行持久化。
				</p>
			</div>

			<div>
				<label className='mb-2 block text-sm font-medium'>卡片风格</label>
				<div className='grid grid-cols-2 gap-3'>
					<button
						type='button'
						onClick={() => handleCardStylePresetChange('classic')}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							cardStylePreset === 'classic'
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						经典风格
					</button>
					<button
						type='button'
						onClick={() => handleCardStylePresetChange('refined')}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							cardStylePreset === 'refined'
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						精致风格
					</button>
				</div>
			</div>

			<div className='space-y-3'>
				<label className='block text-sm font-medium'>首页配色蒙层</label>
				<div className='grid grid-cols-2 gap-3'>
					<button
						type='button'
						onClick={() => handleHomeColorOverlayToggle(false)}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							!enableHomeColorOverlay
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						关闭
					</button>
					<button
						type='button'
						onClick={() => handleHomeColorOverlayToggle(true)}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							enableHomeColorOverlay
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						开启
					</button>
				</div>

				<div className={`grid grid-cols-2 gap-3 transition-opacity ${enableHomeColorOverlay ? '' : 'pointer-events-none opacity-50'}`}>
					<button
						type='button'
						onClick={() => handleHomeColorOverlayModeChange('atmosphere')}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							homeColorOverlayMode === 'atmosphere'
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						氛围染色
					</button>
					<button
						type='button'
						onClick={() => handleHomeColorOverlayModeChange('solid')}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							homeColorOverlayMode === 'solid'
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						纯色蒙版
					</button>
				</div>
			</div>

			<div className='space-y-3'>
				<label className='block text-sm font-medium'>四季动态效果</label>
				<div className='grid grid-cols-2 gap-3'>
					<button
						type='button'
						onClick={() => handleSeasonalEffectsToggle(false)}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							!enableSeasonalEffects
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						关闭
					</button>
					<button
						type='button'
						onClick={() => handleSeasonalEffectsToggle(true)}
						className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
							enableSeasonalEffects
								? 'border-brand bg-brand/10 text-primary font-medium'
								: 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'
						}`}>
						开启
					</button>
				</div>

				<div className={`grid grid-cols-2 gap-3 transition-opacity ${enableSeasonalEffects ? '' : 'pointer-events-none opacity-50'}`}>
					<button type='button' onClick={() => handleSeasonalEffectThemeChange('spring')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'spring' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						春
					</button>
					<button type='button' onClick={() => handleSeasonalEffectThemeChange('summer')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'summer' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						夏
					</button>
					<button type='button' onClick={() => handleSeasonalEffectThemeChange('autumn')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'autumn' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						秋
					</button>
					<button type='button' onClick={() => handleSeasonalEffectThemeChange('winter')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'winter' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						冬
					</button>
				</div>

				<div className={`grid grid-cols-3 gap-3 transition-opacity ${enableSeasonalEffects ? '' : 'pointer-events-none opacity-50'}`}>
					<button type='button' onClick={() => handleSeasonalEffectStyleChange('light')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectStyle === 'light' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						轻量
					</button>
					<button type='button' onClick={() => handleSeasonalEffectStyleChange('vivid')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectStyle === 'vivid' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						明显
					</button>
					<button type='button' onClick={() => handleSeasonalEffectStyleChange('mixed')} className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectStyle === 'mixed' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 bg-white/60 text-secondary hover:bg-white/80'}`}>
						混合
					</button>
				</div>
			</div>

			<div>
				<div className='mb-2 flex items-center justify-between gap-3'>
					<label className='block text-sm font-medium'>背景颜色</label>
					<div className='flex gap-2'>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleRandomizeColors}
							className='rounded-lg border bg-white/60 px-3 py-1 text-xs whitespace-nowrap'>
							随机配色
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={handleAddColor}
							className='rounded-lg border bg-white/60 px-3 py-1 text-xs whitespace-nowrap'>
							+ 添加颜色
						</motion.button>
					</div>
				</div>
				<div className='flex gap-3'>
					{formData.backgroundColors.map((color, index) => (
						<div key={index} className='flex items-center gap-2'>
							<div className='group relative'>
								<ColorPicker value={color} onChange={value => handleColorChange(index, value)} />
								{formData.backgroundColors.length > 1 && (
									<button
										onClick={() => handleRemoveColor(index)}
										className='text-secondary absolute -top-1 -right-2 rounded-lg border bg-white/60 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100'>
										<XIcon className='size-3' />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* 预设区域 */}
			<div>
				<div className='mb-2 flex items-center justify-between'>
					<label className='block text-sm font-medium'>配色预设</label>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={handleSaveAsPreset}
						className='rounded-lg border bg-white/60 px-3 py-1 text-xs whitespace-nowrap inline-flex items-center gap-1'>
						<Save className='w-3 h-3' />
						保存当前配色为预设
					</motion.button>
				</div>

				{/* 内置预设 */}
				<div className='flex flex-col gap-3'>
					{BUILTIN_PRESETS.map(preset => (
						<button
							key={preset.name}
							onClick={() => handlePresetChange(preset)}
							className='flex items-center gap-3 rounded-lg border bg-white/60 p-3 transition-colors hover:bg-white/80'>
							<div className='flex items-center gap-2'>
								<div
									className='h-10 w-10 rounded-lg border-2 border-white/20 shadow-sm'
									style={{ backgroundColor: preset.theme.colorBrand ?? DEFAULT_THEME_COLORS.colorBrand }}
								/>
								{preset.backgroundColors.map((color, index) => (
									<div key={index} className='h-10 w-10 rounded-lg border-2 border-white/20 shadow-sm' style={{ backgroundColor: color }} />
								))}
							</div>
							<span className='text-sm font-medium whitespace-nowrap'>{preset.name}</span>
						</button>
					))}

					{/* 自定义预设 */}
					{customPresets.map((preset, index) => (
						<div
							key={`custom-${index}`}
							className='flex items-center gap-3 rounded-lg border border-blue-400/20 bg-white/60 p-3 transition-colors hover:bg-white/80'>
							<button
								onClick={() => handlePresetChange(preset)}
								className='flex items-center gap-2 flex-1 min-w-0'>
								<div
									className='h-10 w-10 shrink-0 rounded-lg border-2 border-white/20 shadow-sm'
									style={{ backgroundColor: preset.theme.colorBrand ?? DEFAULT_THEME_COLORS.colorBrand }}
								/>
								{preset.backgroundColors.slice(0, 5).map((color, ci) => (
									<div key={ci} className='h-10 w-10 shrink-0 rounded-lg border-2 border-white/20 shadow-sm' style={{ backgroundColor: color }} />
								))}
								{preset.backgroundColors.length > 5 && (
									<span className='text-[10px] text-secondary shrink-0'>+{preset.backgroundColors.length - 5}</span>
								)}
							</button>
							<span className='text-sm font-medium whitespace-nowrap'>{preset.name}</span>
							<span className='text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0'>自定义</span>
							<button
								onClick={() => handleDeletePreset(index)}
								title='删除预设'
								className='p-1 rounded-full hover:bg-red-500/15 transition-colors shrink-0'>
								<Trash2 className='w-3.5 h-3.5 text-secondary' />
							</button>
						</div>
					))}
				</div>

				{/* 持久化保存 */}
				{customPresets.length > 0 && (
					<div className='mt-3'>
						<motion.button
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							onClick={handlePersistPresets}
							disabled={isSaving}
							className='w-full rounded-lg border bg-white/60 px-4 py-2 text-xs hover:bg-white/80 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5'>
							<Save className='w-3.5 h-3.5' />
							{isSaving ? '保存中...' : '保存自定义预设到项目'}
						</motion.button>
						<p className='text-[10px] text-secondary/60 mt-1 text-center'>
							自定义预设暂存于浏览器，点击上方按钮持久化到项目文件。{process.env.NODE_ENV !== 'development' && '线上环境需先导入密钥。'}
						</p>
					</div>
				)}
			</div>
		</div>
	)
}
