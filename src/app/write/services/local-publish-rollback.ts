export type LocalBlogPublishFileBackup = {
	path: string
	existed: boolean
	content: string
}

export type LocalBlogPublishUploadBackup = {
	path: string
	existed: boolean
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
	return { path, existed: response.ok }
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
	await fetchLocal('/api/save-file', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path: backup.path, content: backup.content })
	})
}

async function deleteLocalBlogPublishFile(path: string, fetchLocal: LocalBlogPublishFetch) {
	await fetchLocal('/api/delete-image', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ path })
	})
}

export async function rollbackLocalBlogPublish(
	writtenFiles: LocalBlogPublishFileBackup[],
	uploadedFiles: LocalBlogPublishUploadBackup[],
	fetchLocal: LocalBlogPublishFetch = fetch
) {
	for (const backup of [...writtenFiles].reverse()) {
		if (backup.existed) {
			await restoreLocalBlogPublishFile(backup, fetchLocal).catch(() => undefined)
		} else {
			await deleteLocalBlogPublishFile(backup.path, fetchLocal).catch(() => undefined)
		}
	}

	for (const backup of [...uploadedFiles].reverse()) {
		if (!backup.existed) {
			await deleteLocalBlogPublishFile(backup.path, fetchLocal).catch(() => undefined)
		}
	}
}
