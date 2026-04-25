import { create } from 'zustand'
import { toast } from 'sonner'
import { hashFileSHA256 } from '@/lib/file-utils'
import { loadBlog } from '@/lib/load-blog'
import type { PublishForm, ImageItem } from '../types'
import type { WriteSafetySnapshot } from '../write-safety'

export const formatDateTimeLocal = (date: Date = new Date()): string => {
	const pad = (n: number) => String(n).padStart(2, '0')
	const year = date.getFullYear()
	const month = pad(date.getMonth() + 1)
	const day = pad(date.getDate())
	const hours = pad(date.getHours())
	const minutes = pad(date.getMinutes())
	return `${year}-${month}-${day}T${hours}:${minutes}`
}

type WriteStore = {
	mode: 'create' | 'edit'
	originalSlug: string | null
	setMode: (mode: 'create' | 'edit', originalSlug?: string) => void
	replaceWithSnapshot: (snapshot: WriteSafetySnapshot) => void
	form: PublishForm
	updateForm: (updates: Partial<PublishForm>) => void
	setForm: (form: PublishForm) => void
	images: ImageItem[]
	addUrlImage: (url: string) => void
	addFiles: (files: FileList | File[]) => Promise<ImageItem[]>
	deleteImage: (id: string) => void
	cover: ImageItem | null
	setCover: (cover: ImageItem | null) => void
	loading: boolean
	setLoading: (loading: boolean) => void
	invalidateBlogLoad: () => void
	loadBlogForEdit: (slug: string) => Promise<boolean>
	reset: () => void
}

const initialForm: PublishForm = {
	slug: '',
	title: '',
	md: '',
	tags: [],
	date: formatDateTimeLocal(),
	summary: '',
	hidden: false,
	category: '',
	folderPath: '',
	favorite: false
}

const cloneForm = (form: PublishForm): PublishForm => ({
	...form,
	tags: [...form.tags]
})

const cloneImage = (image: ImageItem): ImageItem => ({ ...image })

const cloneSnapshot = (snapshot: WriteSafetySnapshot): WriteSafetySnapshot => ({
	...snapshot,
	form: cloneForm(snapshot.form),
	cover: snapshot.cover ? cloneImage(snapshot.cover) : null,
	images: snapshot.images.map(cloneImage)
})

const revokePreviewUrls = (images: ImageItem[], cover: ImageItem | null) => {
	const previewUrls = new Set<string>()

	for (const image of images) {
		if (image.type === 'file') {
			previewUrls.add(image.previewUrl)
		}
	}

	if (cover?.type === 'file') {
		previewUrls.add(cover.previewUrl)
	}

	for (const previewUrl of previewUrls) {
		URL.revokeObjectURL(previewUrl)
	}
}

let latestLoadRequestToken = 0

export const useWriteStore = create<WriteStore>((set, get) => ({
	mode: 'create',
	originalSlug: null,
	setMode: (mode, originalSlug) => set({ mode, originalSlug: originalSlug || null }),
	replaceWithSnapshot: snapshot => {
		const { images, cover } = get()
		revokePreviewUrls(images, cover)

		const nextSnapshot = cloneSnapshot(snapshot)
		set({
			mode: nextSnapshot.mode,
			originalSlug: nextSnapshot.originalSlug,
			form: nextSnapshot.form,
			images: nextSnapshot.images,
			cover: nextSnapshot.cover
		})
	},
	form: { ...initialForm },
	updateForm: updates => set(state => ({ form: { ...state.form, ...updates } })),
	setForm: form => set({ form }),
	images: [],
	addUrlImage: url => {
		const { images } = get()
		const exists = images.some(it => it.type === 'url' && it.url === url)
		if (exists) {
			toast.info('该图片已在列表中')
			return
		}
		const id = Math.random().toString(36).slice(2, 10)
		set(state => ({ images: [{ id, type: 'url', url }, ...state.images] }))
	},
	addFiles: async (files: FileList | File[]) => {
		const { images } = get()
		const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
		if (arr.length === 0) return []

		const existingHashes = new Map<string, ImageItem>(
			images
				.filter((it): it is Extract<ImageItem, { type: 'file'; hash?: string }> => it.type === 'file' && (it as any).hash)
				.map(it => [(it as any).hash as string, it])
		)

		const computed = await Promise.all(
			arr.map(async file => {
				const hash = await hashFileSHA256(file)
				return { file, hash }
			})
		)

		const seen = new Set<string>()
		const unique = computed.filter(({ hash }) => {
			if (existingHashes.has(hash)) return false
			if (seen.has(hash)) return false
			seen.add(hash)
			return true
		})

		const resultImages: ImageItem[] = []

		for (const { hash } of computed) {
			if (existingHashes.has(hash)) {
				resultImages.push(existingHashes.get(hash)!)
			}
		}

		if (unique.length > 0) {
			const newItems: ImageItem[] = unique.map(({ file, hash }) => {
				const id = Math.random().toString(36).slice(2, 10)
				const previewUrl = URL.createObjectURL(file)
				const filename = file.name
				return { id, type: 'file', file, previewUrl, filename, hash }
			})

			set(state => ({ images: [...newItems, ...state.images] }))
			resultImages.push(...newItems)
		} else if (resultImages.length === 0) {
			toast.info('图片已存在，不重复添加')
		}

		return resultImages
	},
	deleteImage: id =>
		set(state => {
			let nextCover = state.cover

			for (const image of state.images) {
				if (image.type === 'file' && image.id === id) {
					URL.revokeObjectURL(image.previewUrl)
				}
			}

			if (state.cover?.id === id) {
				nextCover = null
			}

			return {
				images: state.images.filter(image => image.id !== id),
				cover: nextCover
			}
		}),
	cover: null,
	setCover: cover => set({ cover }),
	loading: false,
	setLoading: loading => set({ loading }),
	invalidateBlogLoad: () => {
		latestLoadRequestToken += 1
		set({ loading: false })
	},
	loadBlogForEdit: async (slug: string) => {
		const requestToken = ++latestLoadRequestToken

		try {
			set({ loading: true })
			const blog = await loadBlog(slug)
			if (requestToken !== latestLoadRequestToken) {
				return false
			}

			const images: ImageItem[] = []
			const imageRegex = /!\[.*?\]\((.*?)\)/g
			let match
			while ((match = imageRegex.exec(blog.markdown)) !== null) {
				const url = match[1]
				if (url && url !== blog.cover && !url.startsWith('local-image:')) {
					if (!images.some(image => image.type === 'url' && image.url === url)) {
						const id = Math.random().toString(36).slice(2, 10)
						images.push({ id, type: 'url', url })
					}
				}
			}

			let cover: ImageItem | null = null
			if (blog.cover) {
				const coverId = Math.random().toString(36).slice(2, 10)
				cover = { id: coverId, type: 'url', url: blog.cover }
			}

			get().replaceWithSnapshot({
				mode: 'edit',
				originalSlug: slug,
				form: {
					slug,
					title: blog.config.title || '',
					md: blog.markdown,
					tags: blog.config.tags || [],
					date: blog.config.date ? formatDateTimeLocal(new Date(blog.config.date)) : formatDateTimeLocal(),
					summary: blog.config.summary || '',
					hidden: blog.config.hidden || false,
					category: blog.config.category || '',
					folderPath: blog.config.folderPath || '',
					favorite: blog.config.favorite || false
				},
				images,
				cover
			})
			set({ loading: false })
			toast.success('博客加载成功')
			return true
		} catch (err: any) {
			if (requestToken !== latestLoadRequestToken) {
				return false
			}

			console.error('Failed to load blog:', err)
			toast.error(err?.message || '加载博客失败')
			set({ loading: false })
			throw err
		}
	},
	reset: () => {
		get().replaceWithSnapshot({
			mode: 'create',
			originalSlug: null,
			form: { ...initialForm, date: formatDateTimeLocal() },
			images: [],
			cover: null
		})
	}
}))
