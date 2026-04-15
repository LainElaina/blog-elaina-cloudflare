'use client'

import { useState } from 'react'
import {
  BLOG_MIGRATION_PANEL_MODEL,
  resolveBlogMigrationMessage
} from './blog-migration-panel-constants'

type BlogMigrationResponsePayload = {
  message?: unknown
  summary?: unknown
  artifactsToRebuild?: unknown
}

function resolveFailureMessage(message: unknown, fallback: string) {
  return typeof message === 'string' && message.trim().length > 0 ? message : fallback
}

export function BlogMigrationPanel() {
  const model = BLOG_MIGRATION_PANEL_MODEL
  const [message, setMessage] = useState<string | null>(null)

  const handlePreview = async () => {
    const response = await fetch('/api/blog-migration/preview')
    const data = await response.json().catch(() => ({}))
    const payload = (typeof data === 'object' && data ? data : {}) as BlogMigrationResponsePayload
    if (!response.ok) {
      setMessage(resolveFailureMessage(payload.message, '预检查失败'))
      return
    }
    const artifacts = Array.isArray(payload.artifactsToRebuild) ? payload.artifactsToRebuild.join('、') : '无'
    setMessage(resolveBlogMigrationMessage(payload, `待重建产物：${artifacts}`))
  }

  const handleExecute = async () => {
    const confirmed = window.confirm(model.executeConfirmText)
    if (!confirmed) return

    const response = await fetch('/api/blog-migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true })
    })
    const data = await response.json().catch(() => ({}))
    const payload = (typeof data === 'object' && data ? data : {}) as BlogMigrationResponsePayload
    if (!response.ok) {
      setMessage(resolveFailureMessage(payload.message, '执行失败'))
      return
    }
    setMessage(resolveBlogMigrationMessage(payload, '已执行同步/重建'))
  }

  return (
    <div className='mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4'>
      <div className='text-sm font-medium'>{model.title}</div>
      <div className='text-secondary mt-1 text-xs'>{model.executeConfirmText}</div>
      <div className='mt-3 flex flex-wrap gap-2'>
        <button type='button' onClick={handlePreview} className='rounded-lg border bg-white px-3 py-2 text-sm'>
          {model.previewButtonLabel}
        </button>
        <button type='button' onClick={handleExecute} className='rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm'>
          {model.executeButtonLabel}
        </button>
      </div>
      {message && <div className='text-secondary mt-3 text-xs'>{message}</div>}
    </div>
  )
}
