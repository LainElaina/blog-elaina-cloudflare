import { GITHUB_CONFIG } from '@/consts'
import { getAuthToken } from '@/lib/auth'
import { createBlob, createCommit, createTree, getRef, isGitHubUpdateRefConflictError, toBase64Utf8, updateRef, type TreeItem } from '@/lib/github-client'

export type RemoteTextFile = {
	path: string
	content: string
}

export type RemoteBinaryFile = {
	path: string
	file: File
}

type RemoteBase64File = {
	path: string
	contentBase64: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	const chunkSize = 0x8000
	let binary = ''

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
	}

	return btoa(binary)
}

async function commitRemoteBase64Files(files: RemoteBase64File[], message: string): Promise<void> {
	async function attemptCommit(): Promise<void> {
		const token = await getAuthToken()
		const ref = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
		const treeItems: TreeItem[] = []

		for (const file of files) {
			const blob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, file.contentBase64, 'base64')
			treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
		}

		const tree = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, ref.sha)
		const commit = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, message, tree.sha, [ref.sha])
		await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commit.sha)
	}

	try {
		await attemptCommit()
	} catch (error) {
		if (isGitHubUpdateRefConflictError(error)) {
			await attemptCommit()
			return
		}
		throw error
	}
}

export async function commitRemoteTextFiles(files: RemoteTextFile[], message: string): Promise<void> {
	await commitRemoteBase64Files(
		files.map(file => ({ path: file.path, contentBase64: toBase64Utf8(file.content) })),
		message
	)
}

export async function commitRemoteBinaryFile(file: RemoteBinaryFile, message: string): Promise<void> {
	await commitRemoteBase64Files([{ path: file.path, contentBase64: arrayBufferToBase64(await file.file.arrayBuffer()) }], message)
}
