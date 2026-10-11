import type { DesignFile } from '../../core/designer'

const FILE_NAME = 'ship-design.json'

/** Downloads a design file. The anchor has to be in the document or Firefox drops the click. */
export function downloadDesign(file: DesignFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = FILE_NAME
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
