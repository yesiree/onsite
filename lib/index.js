import { Basin } from '@yesiree/basin'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkExtractFrontmatter from 'remark-extract-frontmatter'
import yaml from 'yaml'
import remarkRehype from 'remark-rehype'
import rehypeDocument from 'rehype-document'
import rehypeFormat from 'rehype-format'
import rehypeStringify from 'rehype-stringify'

const parseMarkdown = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkExtractFrontmatter, { yaml: yaml.parse })
  .use(remarkRehype)
  .use(rehypeDocument, {title: 'Neptune'})
  .use(rehypeFormat)
  .use(rehypeStringify)
  .process

const compileHtml = () => {}


class MatterRetriever {
  static #cache = {}

  static reset() {
    MatterRetriever.#cache = {}
  }

  static async #getFromFile(filename) {
    if (!MatterRetriever.#cache[filename]) {
      try {
        const content = await fs.readFile(filename)
        MatterRetriever.#cache[filename] = yaml.parse(content.toString())
      } catch (e) {
        MatterRetriever.#cache[filename] = {}
      }
    }
    return MatterRetriever.#cache[filename]
  }

  static async get(siblingFile, rootDir) {
    const matterFiles = []
    let dir = path.dirname(siblingFile)
    while (dir !== rootDir) {
      matterFiles.push(path.join(dir, 'matter.yaml'))
      dir = path.dirname(dir)
    }
    const matters = matterFiles.map(file => MatterRetriever.#getFromFile(file))
    return (await Promise.all(matters)).reduce((acc, curr) => ({ ...acc, ...curr }), {})
  }
}

export const build = async ({
  root = 'example/',
  watch = false,
} = {}) => {

  const basin = new Basin({
    root,
    emitFileData: true,
    sources: {
      markdown: '**/*.md',
      html: '**/*.html',
      matter: '**/matter.yaml',
    }
  }).on('markdown', async ({ type, path, absolutePath, data }) => {
    if (type === Basin.DELETE) return this.emit('html', { type, path, data })
    const { data: matter, value } = await parseMarkdown(data)
    const file = { type, path, absolutePath, data: value, matter }
    basin.emit('html', file)
  }).on('html', async ({ type, path, data }) => {
    if (type === Basin.DEL) return basin.purge('html', path)
    const content = data.toString()
    basin.cache('html', { path, content })
    if (!basin.ready) return
    // get context/matter
    await basin.emit('write', {
      dest: path.replace(/\.md$/, '.html'), // TODO replace src prefix with dest prefix
      content: await compileHtml({ path, content })
    })
  }).on('matter', async ({ type, path, data }) => {
    if (type === Basin.DEL) return basin.purge('matter', path)
    basin.cache('matter', path, yaml.parse(data.toString()))
  }).on('write', async ({ dest, content }) => {
    await basin.write(dest, content)
  })
  await basin.run()

}

build()
