'use client'

import type { SiteContent } from '../../stores/config-store'
import type { ArtImageUploads, BackgroundImageUploads, FileItem, SocialButtonImageUploads } from './types'
import { FaviconAvatarUpload } from './favicon-avatar-upload'
import { SiteMetaForm } from './site-meta-form'
import { ArtImagesSection } from './art-images-section'
import { BackgroundImagesSection } from './background-images-section'
import { SocialButtonsSection } from './social-buttons-section'
import { HatSection } from './hat-section'
import { BeianForm } from './beian-form'
import { normalizeCardStylePreset } from '@/lib/card-style-preset'
import { normalizeHomeColorOverlayIntensity } from '@/lib/home-color-overlay-intensity'

export type { FileItem, ArtImageUploads, BackgroundImageUploads, SocialButtonImageUploads } from './types'

interface SiteSettingsProps {
	formData: SiteContent
	setFormData: React.Dispatch<React.SetStateAction<SiteContent>>
	faviconItem: FileItem | null
	setFaviconItem: React.Dispatch<React.SetStateAction<FileItem | null>>
	avatarItem: FileItem | null
	setAvatarItem: React.Dispatch<React.SetStateAction<FileItem | null>>
	artImageUploads: ArtImageUploads
	setArtImageUploads: React.Dispatch<React.SetStateAction<ArtImageUploads>>
	backgroundImageUploads: BackgroundImageUploads
	setBackgroundImageUploads: React.Dispatch<React.SetStateAction<BackgroundImageUploads>>
	socialButtonImageUploads: SocialButtonImageUploads
	setSocialButtonImageUploads: React.Dispatch<React.SetStateAction<SocialButtonImageUploads>>
}

export function SiteSettings({
	formData,
	setFormData,
	faviconItem,
	setFaviconItem,
	avatarItem,
	setAvatarItem,
	artImageUploads,
	setArtImageUploads,
	backgroundImageUploads,
	setBackgroundImageUploads,
	socialButtonImageUploads,
	setSocialButtonImageUploads
}: SiteSettingsProps) {
	const isDev = process.env.NODE_ENV === 'development'
	const theme = formData.theme ?? {}
	const cardStylePreset = normalizeCardStylePreset(theme.cardStylePreset)
	const enableHomeColorOverlay = theme.enableHomeColorOverlay ?? false
	const homeColorOverlayMode = theme.homeColorOverlayMode ?? 'atmosphere'
	const homeColorOverlayIntensity = normalizeHomeColorOverlayIntensity(theme.homeColorOverlayIntensity)
	const homeColorOverlayMotion = theme.homeColorOverlayMotion ?? 'dynamic'
	const enableSeasonalEffects = theme.enableSeasonalEffects ?? false
	const seasonalEffectTheme = theme.seasonalEffectTheme ?? 'spring'
	const seasonalEffectStyle = theme.seasonalEffectStyle ?? 'light'

	return (
		<div className='space-y-6'>
			<div className='flex items-start gap-2 text-sm'>
				<span className='text-secondary shrink-0 leading-6'>当前环境：</span>
				<div className='flex flex-col gap-1'>
					{isDev ? (
						<>
							<span className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800'>
								<span className='h-1.5 w-1.5 rounded-full bg-amber-500' />
								本地开发环境
							</span>
							<span className='text-secondary text-xs leading-relaxed'>
								保存时直接写入本地项目文件，图片通过 /api/upload-image 存到 public 目录，无需密钥认证
							</span>
						</>
					) : (
						<>
							<span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
								<span className='h-1.5 w-1.5 rounded-full bg-green-500' />
								线上部署环境
							</span>
							<span className='text-secondary text-xs leading-relaxed'>保存时通过 GitHub API 提交到仓库，需要导入私钥进行签名认证</span>
						</>
					)}
				</div>
			</div>

			<FaviconAvatarUpload faviconItem={faviconItem} setFaviconItem={setFaviconItem} avatarItem={avatarItem} setAvatarItem={setAvatarItem} />

			<SiteMetaForm formData={formData} setFormData={setFormData} />

			<BeianForm formData={formData} setFormData={setFormData} />

			<SocialButtonsSection
				formData={formData}
				setFormData={setFormData}
				socialButtonImageUploads={socialButtonImageUploads}
				setSocialButtonImageUploads={setSocialButtonImageUploads}
			/>

			<ArtImagesSection formData={formData} setFormData={setFormData} artImageUploads={artImageUploads} setArtImageUploads={setArtImageUploads} />

			<BackgroundImagesSection
				formData={formData}
				setFormData={setFormData}
				backgroundImageUploads={backgroundImageUploads}
				setBackgroundImageUploads={setBackgroundImageUploads}
			/>

			<div className='flex gap-3'>
				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.clockShowSeconds ?? false}
						onChange={e => setFormData({ ...formData, clockShowSeconds: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>时钟显示秒数</span>
				</label>

				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.summaryInContent ?? false}
						onChange={e => setFormData({ ...formData, summaryInContent: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>摘要放入内容</span>
				</label>

				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.hideEditButton ?? false}
						onChange={e => setFormData({ ...formData, hideEditButton: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>隐藏编辑按钮（编辑快捷键 ctrl/cmd + ,）</span>
				</label>
			</div>
			<div className='flex gap-3'>
				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.isCachePem ?? false}
						onChange={e => setFormData({ ...formData, isCachePem: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>缓存PEM(已加密，但存在风险)</span>
				</label>
				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.enableCategories ?? false}
						onChange={e => setFormData({ ...formData, enableCategories: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>启用文章分类</span>
				</label>
				<label className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={formData.enableChristmas ?? false}
						onChange={e => setFormData({ ...formData, enableChristmas: e.target.checked })}
						className='accent-brand h-4 w-4 rounded'
					/>
					<span className='text-sm font-medium'>开启圣诞节</span>
				</label>
			</div>

			<HatSection formData={formData} setFormData={setFormData} />

			<div className='space-y-6 border-t border-white/20 pt-6'>
				<div>
					<label className='mb-2 block text-sm font-medium'>卡片风格</label>
					<div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										cardStylePreset: 'original'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								cardStylePreset === 'original'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							原版
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										cardStylePreset: 'classic'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								cardStylePreset === 'classic'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							经典风格
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										cardStylePreset: 'refined'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								cardStylePreset === 'refined'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
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
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										enableHomeColorOverlay: false
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								!enableHomeColorOverlay ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							关闭
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										enableHomeColorOverlay: true
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								enableHomeColorOverlay ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							开启
						</button>
					</div>

					<div className={`grid grid-cols-2 gap-3 transition-opacity ${enableHomeColorOverlay ? '' : 'pointer-events-none opacity-50'}`}>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										homeColorOverlayMode: 'atmosphere'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								homeColorOverlayMode === 'atmosphere'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							氛围染色
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										homeColorOverlayMode: 'solid'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								homeColorOverlayMode === 'solid'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							纯色蒙版
						</button>
					</div>

					<div
						className={`grid grid-cols-2 gap-3 transition-opacity ${enableHomeColorOverlay && homeColorOverlayMode === 'atmosphere' ? '' : 'pointer-events-none opacity-50'}`}>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										homeColorOverlayIntensity: 'default'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								homeColorOverlayIntensity === 'default'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							默认
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										homeColorOverlayIntensity: 'light'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								homeColorOverlayIntensity === 'light'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							轻量
						</button>
					</div>

					<div
						className={`grid grid-cols-2 gap-3 transition-opacity ${enableHomeColorOverlay && homeColorOverlayMode === 'atmosphere' ? '' : 'pointer-events-none opacity-50'}`}>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										homeColorOverlayMotion: 'dynamic'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								homeColorOverlayMotion === 'dynamic'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							动态
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										homeColorOverlayMotion: 'static'
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								homeColorOverlayMotion === 'static'
									? 'border-brand bg-brand/10 text-primary font-medium'
									: 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							静态
						</button>
					</div>
				</div>

				<div className='space-y-3'>
					<label className='block text-sm font-medium'>四季动态效果</label>
					<div className='grid grid-cols-2 gap-3'>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										enableSeasonalEffects: false
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								!enableSeasonalEffects ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							关闭
						</button>
						<button
							type='button'
							onClick={() =>
								setFormData(prev => ({
									...prev,
									theme: {
										...prev.theme,
										enableSeasonalEffects: true
									}
								}))
							}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
								enableSeasonalEffects ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'
							}`}>
							开启
						</button>
					</div>

					<div className={`grid grid-cols-2 gap-3 transition-opacity ${enableSeasonalEffects ? '' : 'pointer-events-none opacity-50'}`}>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectTheme: 'spring' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'spring' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							春
						</button>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectTheme: 'summer' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'summer' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							夏
						</button>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectTheme: 'autumn' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'autumn' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							秋
						</button>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectTheme: 'winter' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectTheme === 'winter' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							冬
						</button>
					</div>

					<div className={`grid grid-cols-3 gap-3 transition-opacity ${enableSeasonalEffects ? '' : 'pointer-events-none opacity-50'}`}>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectStyle: 'light' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectStyle === 'light' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							轻量
						</button>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectStyle: 'vivid' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectStyle === 'vivid' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							明显
						</button>
						<button
							type='button'
							onClick={() => setFormData(prev => ({ ...prev, theme: { ...prev.theme, seasonalEffectStyle: 'mixed' } }))}
							className={`rounded-lg border px-3 py-2 text-sm transition-colors ${seasonalEffectStyle === 'mixed' ? 'border-brand bg-brand/10 text-primary font-medium' : 'border-border/60 text-secondary bg-white/60 hover:bg-white/80'}`}>
							混合
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
