export const BLOG_MIGRATION_PANEL_MODEL = {
  title: '博客账本工具',
  previewButtonLabel: '预检查',
  executeButtonLabel: '执行同步/重建',
  executeConfirmText: '执行前需要明确确认；该操作只会同步/重建正式产物，不会修改 Markdown 或图片。'
}

export function resolveBlogMigrationMessage(payload: { summary?: unknown }, fallback: string) {
  return typeof payload.summary === 'string' && payload.summary.trim().length > 0 ? payload.summary : fallback
}
