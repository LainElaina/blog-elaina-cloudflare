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
							<span className='text-xs text-secondary leading-relaxed'>
								保存时直接写入本地项目文件，图片通过 /api/upload-image 存到 public 目录，无需密钥认证
							</span>
						</>
					) : (
						<>
							<span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
								<span className='h-1.5 w-1.5 rounded-full bg-green-500' />
								线上部署环境
							</span>
							<span className='text-xs text-secondary leading-relaxed'>
								保存时通过 GitHub API 提交到仓库，需要导入私钥进行签名认证
							</span>
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
		</div>
	)
}
