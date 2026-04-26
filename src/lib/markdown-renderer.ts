import { marked } from 'marked'
import type { Tokens } from 'marked'

export type TocItem = { id: string; text: string; level: number }

export interface MarkdownRenderResult {
	html: string
	toc: TocItem[]
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
}

const SHIKI_THEME = 'one-light'

const SHIKI_LANGUAGES: Record<string, string> = {
	bash: 'bash',
	cjs: 'javascript',
	css: 'css',
	html: 'html',
	javascript: 'javascript',
	js: 'javascript',
	jsx: 'jsx',
	json: 'json',
	markdown: 'markdown',
	md: 'markdown',
	mjs: 'javascript',
	shell: 'bash',
	sh: 'bash',
	ts: 'typescript',
	tsx: 'tsx',
	typescript: 'typescript',
	yaml: 'yaml',
	yml: 'yaml',
	zsh: 'bash'
}

type ShikiHighlighter = {
	codeToHtml(code: string, options: { lang: string; theme: string }): string | Promise<string>
}

let shikiHighlighterPromise: Promise<ShikiHighlighter | null> | null = null

async function createShikiHighlighter(): Promise<ShikiHighlighter> {
	const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, javascript, typescript, tsx, jsx, json, css, html, markdown, bash, yaml, oneLight] =
		await Promise.all([
			import('shiki/core'),
			import('shiki/engine/javascript'),
			import('@shikijs/langs/javascript'),
			import('@shikijs/langs/typescript'),
			import('@shikijs/langs/tsx'),
			import('@shikijs/langs/jsx'),
			import('@shikijs/langs/json'),
			import('@shikijs/langs/css'),
			import('@shikijs/langs/html'),
			import('@shikijs/langs/markdown'),
			import('@shikijs/langs/bash'),
			import('@shikijs/langs/yaml'),
			import('@shikijs/themes/one-light')
		])

	return createHighlighterCore({
		engine: createJavaScriptRegexEngine(),
		langs: [
			javascript.default,
			typescript.default,
			tsx.default,
			jsx.default,
			json.default,
			css.default,
			html.default,
			markdown.default,
			bash.default,
			yaml.default
		],
		themes: [oneLight.default]
	})
}

async function loadShikiHighlighter(): Promise<ShikiHighlighter | null> {
	if (!shikiHighlighterPromise) {
		shikiHighlighterPromise = createShikiHighlighter().catch(error => {
			console.warn('Failed to load shiki highlighter:', error)
			return null
		})
	}

	return shikiHighlighterPromise
}

function normalizeShikiLanguage(language?: string): string | null {
	const normalized = language?.trim().toLowerCase().split(/\s+/)[0]
	if (!normalized || normalized === 'text' || normalized === 'txt' || normalized === 'plain' || normalized === 'plaintext') {
		return null
	}

	return SHIKI_LANGUAGES[normalized] ?? null
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

let katexModule: typeof import('katex') | null = null
let katexLoadAttempted = false

async function loadKatex() {
	if (katexModule) return katexModule
	if (katexLoadAttempted) return null
	katexLoadAttempted = true

	try {
		const mod: any = await import('katex')
		katexModule = (mod?.default ?? mod) as any
		return katexModule
	} catch (error) {
		console.warn('Failed to load katex module:', error)
		return null
	}
}

export async function renderMarkdown(markdown: string): Promise<MarkdownRenderResult> {
	const codeBlockMap = new Map<string, { html: string; original: string }>()
	const [shiki, katex] = await Promise.all([loadShikiHighlighter(), loadKatex()])

	const renderer = new marked.Renderer()

	renderer.heading = (token: Tokens.Heading) => {
		const id = slugify(token.text || '')
		return `<h${token.depth} id="${id}">${token.text}</h${token.depth}>`
	}

	renderer.code = (token: Tokens.Code) => {
		const codeData = codeBlockMap.get(token.text)
		if (codeData) {
			const escapedCode = escapeHtml(codeData.original)
			const langAttr = token.lang ? ` data-lang="${escapeHtml(token.lang)}"` : ''
			if (codeData.html) {
				return `<pre data-code="${escapedCode}"${langAttr}>${codeData.html}</pre>`
			}

			return `<pre data-code="${escapedCode}"${langAttr}><code>${escapeHtml(codeData.original)}</code></pre>`
		}

		return `<code>${escapeHtml(token.text)}</code>`
	}

	renderer.listitem = (token: Tokens.ListItem) => {
		let inner = token.text
		let tokens = token.tokens

		if (token.task) tokens = tokens.slice(1)
		inner = marked.parser(tokens) as string

		if (token.task) {
			const checkbox = token.checked ? '<input type="checkbox" checked disabled />' : '<input type="checkbox" disabled />'
			return `<li class="task-list-item">${checkbox} ${inner}</li>\n`
		}

		return `<li>${inner}</li>\n`
	}

	const renderMath = (content: string, displayMode: boolean) => {
		if (!katex) {
			return displayMode ? `$$${content}$$` : `$${content}$`
		}

		try {
			return katex.renderToString(content, {
				displayMode,
				throwOnError: false,
				output: 'html',
				strict: 'ignore'
			})
		} catch {
			return displayMode ? `$$${content}$$` : `$${content}$`
		}
	}

	marked.use({
		renderer,
		extensions: [
			{
				name: 'mathBlock',
				level: 'block',
				start(src: string) {
					return src.indexOf('$$')
				},
				tokenizer(src: string) {
					const match = src.match(/^\$\$([\s\S]+?)\$\$(?:\n+|$)/)
					if (!match) return
					return {
						type: 'mathBlock',
						raw: match[0],
						text: match[1].trim()
					} as any
				},
				renderer(token: any) {
					return `${renderMath(token.text || '', true)}\n`
				}
			},
			{
				name: 'mathInline',
				level: 'inline',
				start(src: string) {
					const idx = src.indexOf('$')
					return idx === -1 ? undefined : idx
				},
				tokenizer(src: string) {
					if (src.startsWith('$$')) return
					if (src.startsWith('\\$')) return

					const match = src.match(/^\$([^\n$]+?)\$/)
					if (!match) return

					const inner = match[1]
					if (!inner || !inner.trim()) return

					return {
						type: 'mathInline',
						raw: match[0],
						text: inner.trim()
					} as any
				},
				renderer(token: any) {
					return renderMath(token.text || '', false)
				}
			}
		]
	})

	const tokens = marked.lexer(markdown)

	const toc: TocItem[] = []
	function extractHeadings(tokenList: typeof tokens) {
		for (const token of tokenList) {
			if (token.type === 'heading' && token.depth <= 3) {
				const text = token.text
				const id = slugify(text)
				toc.push({ id, text, level: token.depth })
			}
			if ('tokens' in token && token.tokens) {
				extractHeadings(token.tokens as typeof tokens)
			}
		}
	}
	extractHeadings(tokens)

	for (const token of tokens) {
		if (token.type === 'code') {
			const codeToken = token as Tokens.Code
			const originalCode = codeToken.text
			const key = `__SHIKI_CODE_${codeBlockMap.size}__`
			const shikiLang = normalizeShikiLanguage(codeToken.lang)

			if (shiki && shikiLang) {
				try {
					const html = await shiki.codeToHtml(originalCode, {
						lang: shikiLang,
						theme: SHIKI_THEME
					})
					codeBlockMap.set(key, { html, original: originalCode })
					codeToken.text = key
				} catch {
					codeBlockMap.set(key, { html: '', original: originalCode })
					codeToken.text = key
				}
			} else {
				codeBlockMap.set(key, { html: '', original: originalCode })
				codeToken.text = key
			}
		}
	}
	const html = (marked.parser(tokens) as string) || ''

	return { html, toc }
}
