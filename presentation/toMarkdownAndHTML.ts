import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import { remark } from 'remark'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

export async function toMarkdownAndHTML(baseReport: string) {
  // The table of contents' links in the baseReport work when converted to HTML, but do not work as Markdown
  // or PDF links, since the emojis in the header titles cause issues. We apply the remarkFixEmojiLinks plugin
  // to fix this, and use this updated version when generating the Markdown and PDF reports.
  const markdownReport = String(await remark().use(remarkFixEmojiLinks).process(baseReport))

  // Generate the HTML report string using the `baseReport`.
  const htmlReport = String(
    await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .use(rehypeSlug)
      .process(baseReport),
  )
  return { markdownReport, htmlReport }
}

/**
 * Intra-doc links are broken if the header has emojis, so we fix that here.
 * @dev This is a remark plugin, see the remark docs for more info on how it works.
 */
function remarkFixEmojiLinks() {
  return (tree: any) => {
    visit(tree, (node) => {
      if (node.type === 'link') {
        // @ts-ignore node.url does exist, the typings just aren't correct
        const url: string = node.url
        const isInternalLink = url.startsWith('#')
        if (isInternalLink && url.endsWith('--passed-with-warnings')) {
          // @ts-ignore node.url does exist, the typings just aren't correct
          node.url = node.url.replace('--passed-with-warnings', '-❗❗-passed-with-warnings')
        } else if (isInternalLink && url.endsWith('--passed')) {
          // @ts-ignore node.url does exist, the typings just aren't correct
          node.url = node.url.replace('--passed', '-✅-passed')
        } else if (isInternalLink && url.endsWith('--failed')) {
          // @ts-ignore node.url does exist, the typings just aren't correct
          node.url = node.url.replace('--failed', '-❌-failed')
        }
      }
    })
  }
}
