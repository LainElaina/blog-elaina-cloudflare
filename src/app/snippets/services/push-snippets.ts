import { commitRemoteTextFiles } from '@/lib/remote-text-commit'
import { toast } from 'sonner'

export type PushSnippetsParams = {
	snippets: string[]
}

export async function pushSnippets(params: PushSnippetsParams): Promise<void> {
	const { snippets } = params

	toast.info('正在准备文件...')
	await commitRemoteTextFiles(
		[
			{
				path: 'src/app/snippets/list.json',
				content: JSON.stringify(snippets, null, '\t')
			}
		],
		'更新句子列表'
	)
}

