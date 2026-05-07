export type LocalBlogPublishFileBackup = {
	path: string
	existed: boolean
	content: string
}

export type LocalBlogPublishUploadBackup = {
	path: string
	existed: boolean
	file?: File
}

type LocalBlogPublishFetch = (input: string, init?: RequestInit) => Promise<Response>

type LocalBlogPublishSavePayload = {
	path: string
	content: string
}

function toPublicUrl(filePath: string) {
	if (!filePath.startsWith('public/')) {
		throw new Error('本地发布回滚只支持 public 目录文件')
	}
	return `/${filePath.slice('public/'.length)}`
}

async function assertLocalBlogPublishOk(response: Response, actionName: string) {
	if (response.ok) {
		return
	}

	const detail = await response.text().catch(() => '')
	throw new Error(detail ? `${actionName}失败：${detail}` : `${actionName}失败`)
}

async function assertLocalBlogBackupReadOk(response: Response, path: string) {
	if (response.ok || response.status === 404) {
		return
	}

	await assertLocalBlogPublishOk(response, `读取 ${path} 备份`)
}

export async function readLocalBlogPublishFileBackup(path: string, fetchLocal: LocalBlogPublishFetch = fetch): Promise<LocalBlogPublishFileBackup> {
	const response = await fetchLocal(toPublicUrl(path), { cache: 'no-store' })
	await assertLocalBlogBackupReadOk(response, path)
	if (response.status === 404) {
		return { path, existed: false, content: '' }
	}
	return { path, existed: true, content: await response.text() }
}

export async function readLocalBlogPublishUploadBackup(path: string, fetchLocal: LocalBlogPublishFetch = fetch): Promise<LocalBlogPublishUploadBackup> {
	const response = await fetchLocal(toPublicUrl(path), { cache: 'no-store' })
	await assertLocalBlogBackupReadOk(response, path)
	if (response.status === 404) {
		return { path, existed: false }
	}
	const blob = await response.blob()
	return { path, existed: true, file: new File([blob], path.split('/').at(-1) || 'image', { type: blob.type }) }
}

export async function saveLocalBlogPublishFile(
	payload: LocalBlogPublishSavePayload,
	actionName: string,
	writtenFiles: LocalBlogPublishFileBackup[],
	fetchLocal: LocalBlogPublishFetch = fetch
) {
	const backup = await readLocalBlogPublishFileBackup(payload.path, fetchLocal)
	await assertLocalBlogPublishOk(
		await fetchLocal('/api/save-file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}),
		actionName
	)
	writtenFiles.push(backup)
}

export async function uploadLocalBlogPublishImage(
	params: {
		file: File
		path: string
		actionName: string
		uploadedFiles: LocalBlogPublishUploadBackup[]
	},
	fetchLocal: LocalBlogPublishFetch = fetch
) {
	const backup = await readLocalBlogPublishUploadBackup(params.path, fetchLocal)
	const formData = new FormData()
	formData.append('file', params.file)
	formData.append('path', params.path)
	await assertLocalBlogPublishOk(await fetchLocal('/api/upload-image', { method: 'POST', body: formData }), params.actionName)
	params.uploadedFiles.push(backup)
}

async function restoreLocalBlogPublishFile(backup: LocalBlogPublishFileBackup, fetchLocal: LocalBlogPublishFetch) {
	const response = await fetchLocal('/api/save-file', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path: backup.path, content: backup.content })
	})
	if (!response.ok) {
		throw new Error(`恢复 ${backup.path} 失败`)
	}
}

async function restoreLocalBlogPublishImage(backup: LocalBlogPublishUploadBackup, fetchLocal: LocalBlogPublishFetch) {
	if (!backup.file) {
		throw new Error(`恢复 ${backup.path} 失败`)
	}
	const formData = new FormData()
	formData.append('file', backup.file)
	formData.append('path', backup.path)
	const response = await fetchLocal('/api/upload-image', { method: 'POST', body: formData })
	if (!response.ok) {
		throw new Error(`恢复 ${backup.path} 失败`)
	}
}

async function deleteLocalBlogPublishFile(path: string, fetchLocal: LocalBlogPublishFetch) {
	const response = await fetchLocal('/api/delete-file', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})
	if (!response.ok) {
		throw new Error(`删除 ${path} 失败`)
	}
}

async function deleteLocalBlogPublishImage(path: string, fetchLocal: LocalBlogPublishFetch) {
	const response = await fetchLocal('/api/delete-image', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})
	if (!response.ok) {
		throw new Error(`删除 ${path} 失败`)
	}
}

export async function rollbackLocalBlogPublish(
	writtenFiles: LocalBlogPublishFileBackup[],
	uploadedFiles: LocalBlogPublishUploadBackup[],
	fetchLocal: LocalBlogPublishFetch = fetch
) {
	const rollbackErrors: string[] = []

	for (const backup of [...writtenFiles].reverse()) {
		try {
			if (backup.existed) {
				await restoreLocalBlogPublishFile(backup, fetchLocal)
			} else {
				await deleteLocalBlogPublishFile(backup.path, fetchLocal)
			}
		} catch {
			rollbackErrors.push(backup.path)
		}
	}

	for (const backup of [...uploadedFiles].reverse()) {
		try {
			if (backup.existed) {
				await restoreLocalBlogPublishImage(backup, fetchLocal)
			} else {
				await deleteLocalBlogPublishImage(backup.path, fetchLocal)
			}
		} catch {
			rollbackErrors.push(backup.path)
		}
	}

	if (rollbackErrors.length > 0) {
		throw new Error(`回滚失败：${rollbackErrors.join(', ')}`)
	}
}
