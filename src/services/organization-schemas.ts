import { z } from 'zod'

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9-]+$/),
  default_currency: z.string().regex(/^[A-Z]{3}$/),
  default_country: z.string().regex(/^[A-Z]{2}$/).nullable(),
})
export const organizationRequest = z.object({ organizationId: z.string().uuid() })
export function resolveOrganization<T extends { id: string }>(organizations: T[], requested: string | null) {
  return organizations.find((org) => org.id === requested) ?? organizations[0] ?? null
}