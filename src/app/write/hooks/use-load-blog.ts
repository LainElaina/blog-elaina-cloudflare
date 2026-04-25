import { useEffect, useState } from 'react'
import { useWriteStore } from '../stores/write-store'

export function useLoadBlog(slug?: string) {
	const { loadBlogForEdit, invalidateBlogLoad, loading } = useWriteStore()
	const [hasLoadedBlog, setHasLoadedBlog] = useState(false)
	const [loadFailed, setLoadFailed] = useState(false)

	useEffect(() => {
		let cancelled = false

		if (!slug) {
			invalidateBlogLoad()
			setHasLoadedBlog(false)
			setLoadFailed(false)
			return
		}

		setHasLoadedBlog(false)
		setLoadFailed(false)

		loadBlogForEdit(slug)
			.then(didLoad => {
				if (!cancelled && didLoad) {
					setHasLoadedBlog(true)
				}
			})
			.catch(() => {
				if (!cancelled) {
					setLoadFailed(true)
				}
			})

		return () => {
			cancelled = true
			invalidateBlogLoad()
		}
	}, [invalidateBlogLoad, loadBlogForEdit, slug])

	return { loading, hasLoadedBlog, loadFailed }
}
