const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { gzipSync } = require('node:zlib')

const DEFAULT_WORKER_PATHS = ['.open-next/worker.js', '.open-next/server-functions/default/handler.mjs']
const DEFAULT_MAX_GZIP_BYTES = 3 * 1024 * 1024
const OPERATION = 'verify-cloudflare-worker-size'
const DEFAULT_FORBIDDEN_MARKERS = [
  'route-local',
  'route-handlers',
  'site-config-local-shared',
  'local-content-mutation-lock',
  'blog-migration-route-helper',
  'share-migration-route-helper'
]

class VerifyArgumentError extends Error {
  failureCode = 'ARGUMENT_INVALID'

  constructor(message) {
    super(message)
    this.name = 'VerifyArgumentError'
  }
}

class WorkerMissingError extends Error {
  failureCode = 'WORKER_MISSING'

  constructor(workerPath) {
    super(`未找到 Cloudflare Worker 构建产物：${workerPath}`)
    this.name = 'WorkerMissingError'
    this.workerPath = workerPath
  }
}

class WorkerTooLargeError extends Error {
  failureCode = 'WORKER_TOO_LARGE'

  constructor(workerPath, rawBytes, gzipBytes, maxGzipBytes) {
    super(`Cloudflare Worker gzip 体积 ${gzipBytes} bytes 超过限制 ${maxGzipBytes} bytes：${workerPath}`)
    this.name = 'WorkerTooLargeError'
    this.workerPath = workerPath
    this.rawBytes = rawBytes
    this.gzipBytes = gzipBytes
    this.maxGzipBytes = maxGzipBytes
  }
}

class WorkerForbiddenMarkerError extends Error {
  failureCode = 'WORKER_FORBIDDEN_MARKER'

  constructor(workerPath, marker) {
    super(`Cloudflare Worker 产物包含本地专用模块标记 ${marker}：${workerPath}`)
    this.name = 'WorkerForbiddenMarkerError'
    this.workerPath = workerPath
    this.marker = marker
  }
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new VerifyArgumentError(`${flagName} 需要提供正整数`)
  }
  return parsed
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new VerifyArgumentError(`${flagName} 需要提供值`)
  }
  return value
}

function parseArgs(argv) {
  let workerPaths = DEFAULT_WORKER_PATHS
  let maxGzipBytes = DEFAULT_MAX_GZIP_BYTES
  let forbiddenMarkers = DEFAULT_FORBIDDEN_MARKERS

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index]

    if (entry.startsWith('--worker=')) {
      const value = entry.slice('--worker='.length)
      if (!value) throw new VerifyArgumentError('--worker 需要提供路径值')
      workerPaths = [value]
      continue
    }

    if (entry === '--worker') {
      workerPaths = [readFlagValue(argv, index, '--worker')]
      index += 1
      continue
    }

    if (entry.startsWith('--max-gzip-bytes=')) {
      maxGzipBytes = parsePositiveInteger(entry.slice('--max-gzip-bytes='.length), '--max-gzip-bytes')
      continue
    }

    if (entry === '--max-gzip-bytes') {
      maxGzipBytes = parsePositiveInteger(readFlagValue(argv, index, '--max-gzip-bytes'), '--max-gzip-bytes')
      index += 1
      continue
    }

    if (entry === '--no-forbidden-marker-check') {
      forbiddenMarkers = []
      continue
    }

    throw new VerifyArgumentError(`未知参数：${entry}`)
  }

  return { workerPaths, maxGzipBytes, forbiddenMarkers }
}

function measureWorkerArtifact(workerPath, maxGzipBytes, forbiddenMarkers) {
  const fullPath = resolve(workerPath)
  if (!existsSync(fullPath)) {
    throw new WorkerMissingError(workerPath)
  }

  const worker = readFileSync(fullPath)
  const source = worker.toString('utf8')
  const forbiddenMarker = forbiddenMarkers.find(marker => source.includes(marker))
  if (forbiddenMarker) {
    throw new WorkerForbiddenMarkerError(workerPath, forbiddenMarker)
  }

  const gzipBytes = gzipSync(worker, { level: 9 }).byteLength
  if (gzipBytes > maxGzipBytes) {
    throw new WorkerTooLargeError(workerPath, worker.byteLength, gzipBytes, maxGzipBytes)
  }

  return {
    workerPath,
    rawBytes: worker.byteLength,
    gzipBytes,
    maxGzipBytes
  }
}

function verifyCloudflareWorkerSize(args) {
  const artifacts = args.workerPaths.map(workerPath => measureWorkerArtifact(workerPath, args.maxGzipBytes, args.forbiddenMarkers))

  return {
    ok: true,
    operation: OPERATION,
    workerPath: artifacts.length === 1 ? artifacts[0].workerPath : undefined,
    rawBytes: artifacts.length === 1 ? artifacts[0].rawBytes : undefined,
    gzipBytes: artifacts.length === 1 ? artifacts[0].gzipBytes : undefined,
    maxGzipBytes: args.maxGzipBytes,
    artifacts,
    summary: `Cloudflare Worker 产物 gzip 体积均未超过限制 ${args.maxGzipBytes} bytes。`
  }
}

function buildFailureSummary(error) {
  if (error instanceof VerifyArgumentError) {
    return {
      ok: false,
      operation: OPERATION,
      code: error.failureCode,
      message: error.message
    }
  }

  if (error instanceof WorkerMissingError) {
    return {
      ok: false,
      operation: OPERATION,
      code: error.failureCode,
      message: error.message,
      workerPath: error.workerPath
    }
  }

  if (error instanceof WorkerForbiddenMarkerError) {
    return {
      ok: false,
      operation: OPERATION,
      code: error.failureCode,
      message: error.message,
      workerPath: error.workerPath,
      marker: error.marker
    }
  }

  if (error instanceof WorkerTooLargeError) {
    return {
      ok: false,
      operation: OPERATION,
      code: error.failureCode,
      message: error.message,
      workerPath: error.workerPath,
      rawBytes: error.rawBytes,
      gzipBytes: error.gzipBytes,
      maxGzipBytes: error.maxGzipBytes
    }
  }

  return {
    ok: false,
    operation: OPERATION,
    code: 'RUNTIME_FAILURE',
    message: error instanceof Error ? error.message : String(error)
  }
}

function writeJsonToStdout(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function writeHumanErrorToStderr(message) {
  process.stderr.write(`${message}\n`)
}

function main() {
  try {
    const summary = verifyCloudflareWorkerSize(parseArgs(process.argv.slice(2)))
    writeJsonToStdout(summary)
    process.exitCode = 0
  } catch (error) {
    const failure = buildFailureSummary(error)
    writeJsonToStdout(failure)
    writeHumanErrorToStderr(failure.message)
    process.exitCode = 2
  }
}

main()
