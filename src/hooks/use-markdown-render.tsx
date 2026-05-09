import { useEffect, useState, type ReactElement, Fragment } from 'react'
import parse, { type HTMLReactParserOptions, Element, type DOMNode } from 'html-react-parser'
import type { TocItem } from '@/lib/markdown-renderer'
import { MarkdownImage } from '@/components/markdown-image'
import { CodeBlock } from '@/components/code-block'
import { extractMarkdownCodeBlocks } from './markdown-code-block-extraction'

type MarkdownRenderResult = {
	content: ReactElement | null
	toc: TocItem[]
	loading: boolean
}

export function useMarkdownRender(markdown: string): MarkdownRenderResult {
	const [content, setContent] = useState<ReactElement | null>(null)
	const [toc, setToc] = useState<TocItem[]>([])
	const [loading, setLoading] = useState<boolean>(true)

	useEffect(() => {
		let cancelled = false

		async function render() {
			setLoading(true)
			try {
				const { renderMarkdown } = await import('@/lib/markdown-renderer')
				const { html, toc } = await renderMarkdown(markdown)
				if (!cancelled) {
					const { processedHtml, codeBlocks } = extractMarkdownCodeBlocks(html)

					const options: HTMLReactParserOptions = {
						replace(domNode: DOMNode) {
							if (domNode instanceof Element && domNode.name === 'img') {
								const { src, alt, title } = domNode.attribs
								return <MarkdownImage src={src} alt={alt} title={title} />
							}
							if (domNode.type === 'text' && domNode.data && domNode.data.includes('__CODE_BLOCK_')) {
								const text = domNode.data
								const result = text.split(/(__CODE_BLOCK_\d+__)/).filter(Boolean)

								return (
									<>
										{result.map((item, index) => {
											if (item.startsWith('__CODE_BLOCK_')) {
												const block = codeBlocks.find(b => b.placeholder === item)
												if (block) {
													const preElement = parse(block.preHtml) as ReactElement
													return (
														<CodeBlock key={block.placeholder} code={block.code}>
															{preElement}
														</CodeBlock>
													)
												}
											} else {
												return item ? <Fragment key={index}>{item}</Fragment> : null
											}
										})}
									</>
								)
							}
						}
					}
					const reactContent = parse(processedHtml, options) as ReactElement
					setContent(reactContent)
					setToc(toc)
				}
			} catch (error) {
				console.error('Markdown render error:', error)
				if (!cancelled) {
					setContent(null)
					setToc([])
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		render()

		return () => {
			cancelled = true
		}
	}, [markdown])

	return { content, toc, loading }
}
