const Module = require('module')
const path = require('node:path')

const projectRoot = process.cwd()
const srcRoot = path.join(projectRoot, 'src')
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const nextRequest = path.join(srcRoot, request.slice(2))
    return originalResolveFilename.call(this, nextRequest, parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}
