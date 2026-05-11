import { createHash } from 'crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

export type LocalContentMutationScope = 'blog' | 'share' | 'site-config' | 'content'

const LOCK_RETRY_MS = 25
const STALE_LOCK_MS = 5 * 60 * 1000
const LOCK_ROOT_DIR = join(tmpdir(), 'blog-elaina-content-locks')
const localContentMutationLocks = new Map<string, Promise<void>>()

type FileLockOwner = {
	pid?: unknown
	createdAt?: unknown
}

function getLockKey(baseDir: string, scope: LocalContentMutationScope) {
	return `${resolve(baseDir)}:${scope}`
}

function getFileLockDir(lockKey: string) {
	const lockId = createHash('sha256').update(lockKey).digest('hex')
	return join(LOCK_ROOT_DIR, lockId)
}

function waitForFileLockRetry() {
	return new Promise<void>(resolve => setTimeout(resolve, LOCK_RETRY_MS))
}

function hasErrorCode(error: unknown, code: string) {
	return (error as NodeJS.ErrnoException).code === code
}

function isProcessRunning(pid: unknown) {
	if (!Number.isInteger(pid) || (pid as number) <= 0) {
		return false
	}

	try {
		process.kill(pid as number, 0)
		return true
	} catch (error) {
		return hasErrorCode(error, 'EPERM')
	}
}

async function readFileLockOwner(lockDir: string): Promise<FileLockOwner | null> {
	try {
		const data = JSON.parse(await readFile(join(lockDir, 'owner.json'), 'utf-8'))
		return data && typeof data === 'object' ? data : null
	} catch (error) {
		if (hasErrorCode(error, 'ENOENT') || error instanceof SyntaxError) {
			return null
		}
		throw error
	}
}

async function isFileLockStale(lockDir: string) {
	const owner = await readFileLockOwner(lockDir)
	if (typeof owner?.createdAt === 'number' && Date.now() - owner.createdAt > STALE_LOCK_MS) {
		return true
	}
	if (owner?.pid !== undefined) {
		return !isProcessRunning(owner.pid)
	}

	try {
		const lockStat = await stat(lockDir)
		return Date.now() - lockStat.mtimeMs > STALE_LOCK_MS
	} catch (error) {
		if (hasErrorCode(error, 'ENOENT')) {
			return false
		}
		throw error
	}
}

async function removeStaleFileLock(lockDir: string) {
	if (await isFileLockStale(lockDir)) {
		await rm(lockDir, { recursive: true, force: true })
	}
}

async function acquireFileLock(lockKey: string) {
	await mkdir(LOCK_ROOT_DIR, { recursive: true })
	const lockDir = getFileLockDir(lockKey)

	while (true) {
		try {
			await mkdir(lockDir, { recursive: false })
			try {
				await writeFile(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: Date.now() }))
			} catch (error) {
				await rm(lockDir, { recursive: true, force: true })
				throw error
			}
			return async () => {
				await rm(lockDir, { recursive: true, force: true })
			}
		} catch (error) {
			if (!hasErrorCode(error, 'EEXIST')) {
				throw error
			}
			await removeStaleFileLock(lockDir)
			await waitForFileLockRetry()
		}
	}
}

export async function withLocalContentMutationLock<T>(baseDir: string, scope: LocalContentMutationScope, callback: () => Promise<T>): Promise<T> {
	const lockKey = getLockKey(baseDir, scope)
	const previousLock = localContentMutationLocks.get(lockKey) ?? Promise.resolve()
	let releaseLock!: () => void
	const currentLock = new Promise<void>(resolve => {
		releaseLock = resolve
	})
	const nextLock = previousLock.catch(() => undefined).then(() => currentLock)
	localContentMutationLocks.set(lockKey, nextLock)

	await previousLock.catch(() => undefined)
	let releaseFileLock: (() => Promise<void>) | null = null
	try {
		releaseFileLock = await acquireFileLock(lockKey)
		return await callback()
	} finally {
		try {
			if (releaseFileLock) {
				await releaseFileLock()
			}
		} finally {
			releaseLock()
			if (localContentMutationLocks.get(lockKey) === nextLock) {
				localContentMutationLocks.delete(lockKey)
			}
		}
	}
}
