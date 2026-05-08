import { commitRemoteTextFiles } from '@/lib/remote-text-commit'
import { toast } from 'sonner'

export type AboutData = {
	title: string
	description: string
	content: string
}

export async function pushAbout(data: AboutData): Promise<void> {
	toast.info('正在准备文件...')
	await commitRemoteTextFiles(
		[
			{
				path: 'src/app/about/list.json',
				content: JSON.stringify(data, null, '\t')
			}
		],
		'更新关于页面'
	)
}

