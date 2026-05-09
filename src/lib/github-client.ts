'use client'

import { useAuthStore } from '@/hooks/use-auth'
import { KJUR, KEYUTIL } from 'jsrsasign'
import { toast } from 'sonner'

export const GH_API = 'https://api.github.com'

function handle401Error(): void {
	if (typeof sessionStorage === 'undefined') return
	try {
		useAuthStore.getState().clearAuth()
	} catch (error) {
		console.error('Failed to clear auth cache:', error)
	}
}

function handle422Error(): void {
	toast.error('操作太快了，请操作慢一点')
}

function getResponseSha(data: unknown, actionName: string): string {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		throw new Error(`${actionName} failed: invalid response`)
	}

	const sha = (data as Record<string, unknown>).sha
	if (typeof sha !== 'string') {
		throw new Error(`${actionName} failed: invalid response`)
	}
	return sha
}

function encodeGitHubContentsPath(path: string): string {
	return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

async function readGitHubErrorMessage(response: Response): Promise<string | undefined> {
	try {
		const data = (await response.clone().json()) as { message?: unknown }
		if (typeof data.message === 'string') {
			return data.message
		}
	} catch {
		return undefined
	}
	return undefined
}

async function buildGitHubApiError(actionName: string, response: Response): Promise<Error> {
	const message = await readGitHubErrorMessage(response)
	return new Error(message ? `${actionName} failed: ${response.status} ${message}` : `${actionName} failed: ${response.status}`)
}

export function toBase64Utf8(input: string): string {
	return btoa(unescape(encodeURIComponent(input)))
}

export function signAppJwt(appId: string, privateKeyPem: string): string {
	const now = Math.floor(Date.now() / 1000)
	const header = { alg: 'RS256', typ: 'JWT' }
	const payload = { iat: now - 60, exp: now + 8 * 60, iss: appId }
	const prv = KEYUTIL.getKey(privateKeyPem) as unknown as string
	return KJUR.jws.JWS.sign('RS256', JSON.stringify(header), JSON.stringify(payload), prv)
}

export async function getInstallationId(jwt: string, owner: string, repo: string): Promise<number> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/installation`, {
		headers: {
			Authorization: `Bearer ${jwt}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw new Error(`installation lookup failed: ${res.status}`)
	const data = await res.json()
	return data.id
}

export interface InstallationToken {
	token: string
	expiresAt: string
}

export async function createInstallationToken(jwt: string, installationId: number): Promise<InstallationToken> {
	const res = await fetch(`${GH_API}/app/installations/${installationId}/access_tokens`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${jwt}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw new Error(`create token failed: ${res.status}`)
	const data = await res.json()
	if (typeof data?.token !== 'string' || typeof data?.expires_at !== 'string') {
		throw new Error('create token failed: invalid response')
	}
	return { token: data.token, expiresAt: data.expires_at }
}

export async function getFileSha(token: string, owner: string, repo: string, path: string, branch: string): Promise<string | undefined> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encodeGitHubContentsPath(path)}?ref=${encodeURIComponent(branch)}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (res.status === 404) return undefined
	if (!res.ok) throw await buildGitHubApiError('get file sha', res)
	const data = await res.json()
	return (data && data.sha) || undefined
}

export async function putFile(token: string, owner: string, repo: string, path: string, contentBase64: string, message: string, branch: string) {
	const sha = await getFileSha(token, owner, repo, path, branch)
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encodeGitHubContentsPath(path)}`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ message, content: contentBase64, branch, ...(sha ? { sha } : {}) })
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw await buildGitHubApiError('put file', res)
	return res.json()
}

// Batch commit APIs

export async function getRef(token: string, owner: string, repo: string, ref: string): Promise<{ sha: string }> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/git/ref/${encodeURIComponent(ref)}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw await buildGitHubApiError('get ref', res)
	const data = await res.json()
	if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.object?.sha !== 'string') {
		throw new Error('get ref failed: invalid response')
	}
	return { sha: data.object.sha }
}

export async function getCommit(token: string, owner: string, repo: string, commitSha: string): Promise<{ sha: string; treeSha: string }> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/git/commits/${encodeURIComponent(commitSha)}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw await buildGitHubApiError('get commit', res)
	const data = await res.json()
	if (typeof data?.sha !== 'string' || typeof data?.tree?.sha !== 'string') {
		throw new Error('get commit failed: invalid response')
	}
	return { sha: data.sha, treeSha: data.tree.sha }
}

export type TreeItem = {
	path: string
	mode: '100644' | '100755' | '040000' | '160000' | '120000'
	type: 'blob' | 'tree' | 'commit'
	content?: string
	sha?: string | null
}

export async function createTree(token: string, owner: string, repo: string, tree: TreeItem[], baseTreeCommitSha?: string): Promise<{ sha: string }> {
	const baseTree = baseTreeCommitSha ? (await getCommit(token, owner, repo, baseTreeCommitSha)).treeSha : undefined
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/git/trees`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ tree, base_tree: baseTree })
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw await buildGitHubApiError('create tree', res)
	const data = await res.json()
	return { sha: getResponseSha(data, 'create tree') }
}

export async function createCommit(token: string, owner: string, repo: string, message: string, tree: string, parents: string[]): Promise<{ sha: string }> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/git/commits`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ message, tree, parents })
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw await buildGitHubApiError('create commit', res)
	const data = await res.json()
	return { sha: getResponseSha(data, 'create commit') }
}

export class GitHubUpdateRefError extends Error {
	readonly status: number
	readonly responseMessage?: string

	constructor(status: number, responseMessage?: string) {
		super(responseMessage ? `update ref failed: ${status} ${responseMessage}` : `update ref failed: ${status}`)
		this.name = 'GitHubUpdateRefError'
		this.status = status
		this.responseMessage = responseMessage
	}
}

function isNonFastForwardUpdateRefMessage(message: string | undefined) {
	return !message || /reference update failed|fast[- ]?forward/i.test(message)
}

export function isGitHubUpdateRefConflictError(error: unknown) {
	return error instanceof GitHubUpdateRefError && error.status === 422 && isNonFastForwardUpdateRefMessage(error.responseMessage)
}

export const STALE_REMOTE_WRITE_ERROR_MESSAGE = '远端内容已更新，请刷新页面后重新保存，避免覆盖他人的更改'

export function throwStaleRemoteWriteConflictError(error: unknown): never {
	if (isGitHubUpdateRefConflictError(error)) {
		throw new Error(STALE_REMOTE_WRITE_ERROR_MESSAGE)
	}
	throw error
}

export async function updateRef(token: string, owner: string, repo: string, ref: string, sha: string, force = false): Promise<void> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/git/refs/${encodeURIComponent(ref)}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ sha, force })
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) {
		const error = new GitHubUpdateRefError(res.status, await readGitHubErrorMessage(res))
		if (!isGitHubUpdateRefConflictError(error)) {
			handle422Error()
		}
		throw error
	}
	if (!res.ok) throw new GitHubUpdateRefError(res.status, await readGitHubErrorMessage(res))
}

export async function readTextFileFromRepo(token: string, owner: string, repo: string, path: string, ref: string): Promise<string | null> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encodeGitHubContentsPath(path)}?ref=${encodeURIComponent(ref)}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		}
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (res.status === 404) return null
	if (!res.ok) throw await buildGitHubApiError('read file', res)
	const data: any = await res.json()
	if (Array.isArray(data)) {
		throw new Error('read file failed: expected file but received directory')
	}
	if (typeof data?.content !== 'string') {
		throw new Error('read file failed: invalid response')
	}
	try {
		return decodeURIComponent(escape(atob(data.content)))
	} catch {
		return atob(data.content)
	}
}

export async function listRepoFilesRecursive(token: string, owner: string, repo: string, path: string, ref: string): Promise<string[]> {
	async function fetchPath(targetPath: string): Promise<string[]> {
		const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encodeGitHubContentsPath(targetPath)}?ref=${encodeURIComponent(ref)}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28'
			}
		})
		if (res.status === 401) handle401Error()
		if (res.status === 422) handle422Error()
		if (res.status === 404) return []
		if (!res.ok) throw await buildGitHubApiError('read directory', res)
		const data: any = await res.json()
		if (Array.isArray(data)) {
			const files: string[] = []
			for (const item of data) {
				if (item.type === 'file') {
					if (typeof item.path !== 'string') {
						throw new Error('read directory failed: invalid response')
					}
					files.push(item.path)
				} else if (item.type === 'dir') {
					if (typeof item.path !== 'string') {
						throw new Error('read directory failed: invalid response')
					}
					const nested = await fetchPath(item.path)
					files.push(...nested)
				} else {
					throw new Error('read directory failed: invalid response')
				}
			}
			return files
		}
		if (data?.type === 'file' && typeof data.path === 'string') return [data.path]
		if (data?.type === 'dir' && typeof data.path === 'string') return fetchPath(data.path)
		throw new Error('read directory failed: invalid response')
	}

	return fetchPath(path)
}

export async function createBlob(
	token: string,
	owner: string,
	repo: string,
	content: string,
	encoding: 'utf-8' | 'base64' = 'base64'
): Promise<{ sha: string }> {
	const res = await fetch(`${GH_API}/repos/${owner}/${repo}/git/blobs`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ content, encoding })
	})
	if (res.status === 401) handle401Error()
	if (res.status === 422) handle422Error()
	if (!res.ok) throw await buildGitHubApiError('create blob', res)
	const data = await res.json()
	return { sha: getResponseSha(data, 'create blob') }
}
