import { z } from 'zod'
import { productSchema } from './trade-schemas'

export function cleanSourceUrl(input: string) {
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web pages can be captured')
  url.username = ''; url.password = ''; url.search = ''; url.hash = ''
  return url.href
}
export const captureRequest = z.object({
  organizationId: z.string().uuid(), typeId: z.string().uuid(), version: z.number().int().positive(),
  requestId: z.string().uuid(), sourceUrl: z.string().max(2048).transform(cleanSourceUrl),
  values: z.record(z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.null()])).refine(v => Object.keys(v).length <= 60),
  products: z.array(productSchema).max(200).default([]),
  contacts: z.array(z.object({ name: z.string().trim().min(1).max(160), email: z.union([z.literal(''), z.string().email()]).default(''), phone: z.string().max(80).default(''), position: z.string().max(100).default(''), notes: z.string().max(2000).default('') })).max(50).default([]),
}).strict()
export function extensionRedirect(value: string | null) {
  if (!value || !/^https:\/\/[a-p]{32}\.chromiumapp\.org\/$/.test(value)) return null
  return value
}
export function mapProductRows(rows: string[][], mapping: Record<string, number>, selected: number[]) {
  return selected.map(index => {
    const row = rows[index]
    if (!row) throw new Error('Selected row is unavailable')
    const value = (key: string) => row[mapping[key] ?? -1]?.trim() ?? ''
    return productSchema.parse({ sku: value('sku'), name: value('name'), category: value('category'), description: value('description'), unit: value('unit') || 'piece' })
  })
}