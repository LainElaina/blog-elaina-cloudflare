import { Select } from '@/components/select'
import { useBlogFolders } from '@/hooks/use-blog-folders'

type FolderSelectProps = {
	value?: string
	onChange: (value: string) => void
	className?: string
}

export function FolderSelect({ value = '', onChange, className }: FolderSelectProps) {
	const { folders } = useBlogFolders()

	const options = [{ value: '', label: '默认目录' }, ...folders.map(folder => ({ value: folder, label: folder }))]

	return <Select className={className} value={value} onChange={onChange} options={options} />
}
