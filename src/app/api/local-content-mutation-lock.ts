import { resolve } from 'path'

export type LocalContentMutationScope = 'blog' | 'share'

const localContentMutationLocks = new Map<string, Promise<void>>()

export async function withLocalContentMutationLock<T>(baseDir: string, scope: LocalContentMutationScope, callback: () => Promise<T>): Promise<T> {
	const lockKey = `${resolve(baseDir)}:${scope}`
	const previousLock = localContentMutationLocks.get(lockKey) ?? Promise.resolve()
	let releaseLock!: () => void
	const currentLock = new Promise<void>(resolve => {
		releaseLock = resolve
	})
	const nextLock = previousLock.catch(() => undefined).then(() => currentLock)
	localContentMutationLocks.set(lockKey, nextLock)

	await previousLock.catch(() => undefined)
	try {
		return await callback()
	} finally {
		releaseLock()
		if (localContentMutationLocks.get(lockKey) === nextLock) {
			localContentMutationLocks.delete(lockKey)
		}
	}
}
