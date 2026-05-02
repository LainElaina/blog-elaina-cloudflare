import type { ShareSaveFilePayload } from './share-artifacts'

export type LocalShareSaveFileBackup = {
	path: string
	existed: boolean
	content: string
}

export type LocalShareSaveUploadBackup = {
	path: string
	existed: boolean
}

type LocalShareSaveFetch = (input: string, init?: RequestInit) => Promise<Response>

function toPublicUrl(filePath: string) {
	if (!filePath.startsWith('public/')) {
		throw new Error('本地分享保存回滚只支持 public 目录文件')
	}
	return `/${filePath.slice('public/'.length)}`
}

async function assertLocalShareSaveOk(response: Response, actionName: string) {
	if (response.ok) {
		return
	}

	const detail = await response.text().catch(() => '')
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
}

export async function readLocalShareSaveFileBackup(path: string, fetchLocal: LocalShareSaveFetch = fetch): Promise<LocalShareSaveFileBackup> {
	const response = await fetchLocal(toPublicUrl(path), { cache: 'no-store' })
	if (!response.ok) {
		return { path, existed: false, content: '' }
	}
	return { path, existed: true, content: await response.text() }
}

export async function readLocalShareSaveUploadBackup(path: string, fetchLocal: LocalShareSaveFetch = fetch): Promise<LocalShareSaveUploadBackup> {
	const response = await fetchLocal(toPublicUrl(path), { cache: 'no-store' })
	return { path, existed: response.ok }
}

export async function saveLocalShareFile(
	payload: ShareSaveFilePayload,
	actionName: string,
	writtenFiles: LocalShareSaveFileBackup[],
	fetchLocal: LocalShareSaveFetch = fetch
) {
	const backup = await readLocalShareSaveFileBackup(payload.path, fetchLocal)
	await assertLocalShareSaveOk(
		await fetchLocal('/api/save-file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}),
		actionName
	)
	writtenFiles.push(backup)
}

export async function uploadLocalShareLogo(
	params: {
		file: File
		path: string
		actionName: string
		uploadedFiles: LocalShareSaveUploadBackup[]
	},
	fetchLocal: LocalShareSaveFetch = fetch
) {
	const backup = await readLocalShareSaveUploadBackup(params.path, fetchLocal)
	const formData = new FormData()
	formData.append('file', params.file)
	formData.append('path', params.path)
	await assertLocalShareSaveOk(await fetchLocal('/api/upload-image', { method: 'POST', body: formData }), params.actionName)
	params.uploadedFiles.push(backup)
}

async function restoreLocalShareFile(backup: LocalShareSaveFileBackup, fetchLocal: LocalShareSaveFetch) {
	await fetchLocal('/api/save-file', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path: backup.path, content: backup.content })
	})
}

async function deleteLocalShareFile(path: string, fetchLocal: LocalShareSaveFetch) {
	await fetchLocal('/api/delete-image', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})
}

export async function rollbackLocalShareSave(
	writtenFiles: LocalShareSaveFileBackup[],
	uploadedFiles: LocalShareSaveUploadBackup[],
	fetchLocal: LocalShareSaveFetch = fetch
) {
	for (const backup of [...writtenFiles].reverse()) {
		if (backup.existed) {
			await restoreLocalShareFile(backup, fetchLocal).catch(() => undefined)
		} else {
			await deleteLocalShareFile(backup.path, fetchLocal).catch(() => undefined)
		}
	}

	for (const backup of [...uploadedFiles].reverse()) {
		if (!backup.existed) {
			await deleteLocalShareFile(backup.path, fetchLocal).catch(() => undefined)
		}
	}
}
