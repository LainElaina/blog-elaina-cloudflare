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

async function assertLocalShareBackupReadOk(response: Response, path: string) {
	if (response.ok || response.status === 404) {
		return
	}

	await assertLocalShareSaveOk(response, `读取 ${path} 备份`)
}

export async function readLocalShareSaveFileBackup(path: string, fetchLocal: LocalShareSaveFetch = fetch): Promise<LocalShareSaveFileBackup> {
	const response = await fetchLocal(toPublicUrl(path), { cache: 'no-store' })
	await assertLocalShareBackupReadOk(response, path)
	if (response.status === 404) {
		return { path, existed: false, content: '' }
	}
	return { path, existed: true, content: await response.text() }
}

export async function readLocalShareSaveUploadBackup(path: string, fetchLocal: LocalShareSaveFetch = fetch): Promise<LocalShareSaveUploadBackup> {
	const response = await fetchLocal(toPublicUrl(path), { cache: 'no-store' })
	await assertLocalShareBackupReadOk(response, path)
	return { path, existed: response.ok }
}

export async function readOptionalLocalShareStorageRaw(fetchLocal: LocalShareSaveFetch = fetch): Promise<string | null> {
	const response = await fetchLocal('/share/storage.json', { cache: 'no-store' })
	if (response.status === 404) {
		return null
	}
	await assertLocalShareSaveOk(response, '读取分享存储')
	return response.text()
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
	const response = await fetchLocal('/api/save-file', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path: backup.path, content: backup.content })
	})
	if (!response.ok) {
		throw new Error(`恢复 ${backup.path} 失败`)
	}
}

async function deleteLocalShareFile(path: string, fetchLocal: LocalShareSaveFetch) {
	const response = await fetchLocal('/api/delete-file', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})
	if (!response.ok) {
		throw new Error(`删除 ${path} 失败`)
	}
}

async function deleteLocalShareImage(path: string, fetchLocal: LocalShareSaveFetch) {
	return fetchLocal('/api/delete-image', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})
}

export async function deleteLocalShareLogo(path: string, fetchLocal: LocalShareSaveFetch = fetch) {
	await assertLocalShareSaveOk(await deleteLocalShareImage(path, fetchLocal), '删除旧分享图标')
}

export async function rollbackLocalShareSave(
	writtenFiles: LocalShareSaveFileBackup[],
	uploadedFiles: LocalShareSaveUploadBackup[],
	fetchLocal: LocalShareSaveFetch = fetch
) {
	const rollbackErrors: string[] = []

	for (const backup of [...writtenFiles].reverse()) {
		try {
			if (backup.existed) {
				await restoreLocalShareFile(backup, fetchLocal)
			} else {
				await deleteLocalShareFile(backup.path, fetchLocal)
			}
		} catch {
			rollbackErrors.push(backup.path)
		}
	}

	for (const backup of [...uploadedFiles].reverse()) {
		if (!backup.existed) {
			try {
				const response = await deleteLocalShareImage(backup.path, fetchLocal)
				if (!response.ok) {
					throw new Error(`删除 ${backup.path} 失败`)
				}
			} catch {
				rollbackErrors.push(backup.path)
			}
		}
	}

	if (rollbackErrors.length > 0) {
		throw new Error(`回滚失败：${rollbackErrors.join(', ')}`)
	}
}
