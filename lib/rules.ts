import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DirectoryPage } from './types'

const DIRECTORY_DIR = path.join(process.cwd(), 'public', 'directory')

export const DIRECTORY_PAGE_SIZE = 16

export async function getDirectoryPage(page: number): Promise<DirectoryPage> {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('The requested directory page is invalid.')
  }

  const filePath = path.join(DIRECTORY_DIR, 'pages', `page-${page}.json`)
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as DirectoryPage
  } catch (error) {
    console.error(`[directory] Could not read static page ${page}:`, error)
    throw new Error('Static directory data is missing. Run the directory export before building.')
  }
}
