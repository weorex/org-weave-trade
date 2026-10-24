import { z } from 'zod'
export const logisticsRequest = z.object({ organizationId: z.string().uuid() })
const text = z.string().trim().max(1000).default('')
const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Use a two-letter country code')
const day = z.number().int().min(0).max(3650)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}, 'Invalid date')
export const logisticsProfileSchema = z.object({ entity_id: z.string().uuid(), kind: z.enum(['shipping_agent', 'transporter', 'both']), legal_name: z.string().trim().min(1).max(160), country, address: text, phone: text, email: z.union([z.string().email(), z.literal('')]).default(''), license_number: text, notes: text })
export const portSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[A-Z0-9]{3}$/, 'Use a five-character UN/LOCODE'), name: z.string().trim().min(1).max(160), country, city: text }).refine(v => v.code.startsWith(v.country), { path: ['code'], message: 'Port code must start with its country code' })
export const containerTypes = ['20GP', '40GP', '40HC', '20RF', '40RF', '20OT', '40OT', 'FLAT_RACK'] as const
export const routeSchema = z.object({ shipping_agent_entity_id: z.string().uuid(), origin_port_id: z.string().uuid(), destination_port_id: z.string().uuid(), mode: z.enum(['FCL', 'LCL']), container_type: z.union([z.enum(containerTypes), z.literal('')]).default(''), transit_min_days: day, transit_max_days: day, frequency: text, notes: text }).superRefine((v, c) => {
  if (v.origin_port_id === v.destination_port_id) c.addIssue({ code: 'custom', path: ['destination_port_id'], message: 'Choose a different destination' })
  if (v.transit_max_days < v.transit_min_days) c.addIssue({ code: 'custom', path: ['transit_max_days'], message: 'Maximum transit must not be below minimum' })
  if ((v.mode === 'FCL' && !v.container_type) || (v.mode === 'LCL' && v.container_type)) c.addIssue({ code: 'custom', path: ['container_type'], message: 'FCL requires a container; LCL uses no container type' })
})
export const assetSchema = z.object({ transporter_entity_id: z.string().uuid(), registration: z.string().trim().min(1).max(80), vehicle_type: z.enum(['truck', 'van', 'trailer', 'reefer', 'container_truck']), capacity_kg: z.number().positive(), capacity_cbm: z.number().positive(), notes: text })
export const areaSchema = z.object({ transporter_entity_id: z.string().uuid(), name: z.string().trim().min(1).max(160), country, pickup_zone: z.string().trim().min(1).max(500), delivery_zone: z.string().trim().min(1).max(500), transit_min_days: day, transit_max_days: day, notes: text }).refine(v => v.transit_max_days >= v.transit_min_days, { path: ['transit_max_days'], message: 'Maximum transit must not be below minimum' })
export const rateSchema = z.object({ shipping_route_id: z.string().uuid().nullable().default(null), service_area_id: z.string().uuid().nullable().default(null), asset_id: z.preprocess(v => v === '' ? null : v, z.string().uuid().nullable()).default(null), amount: z.coerce.number().finite().min(0).max(999999999999), currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).refine(c => Intl.supportedValuesOf('currency').includes(c), 'Invalid currency'), unit: z.enum(['container', 'cbm', 'tonne', 'trip', 'km', 'kg']), min_quantity: z.number().positive(), valid_from: date, valid_until: date, notes: text }).superRefine((v, c) => {
  if (!!v.shipping_route_id === !!v.service_area_id) c.addIssue({ code: 'custom', message: 'Choose either a shipping route or service area' })
  if (v.asset_id && !v.service_area_id) c.addIssue({ code: 'custom', path: ['asset_id'], message: 'Vehicles apply to transport rates only' })
  if (v.valid_until < v.valid_from) c.addIssue({ code: 'custom', path: ['valid_until'], message: 'Validity ends before it starts' })
})
export function rateValidity(rate: { valid_from: string; valid_until: string }, asOf: string) {
  return asOf < rate.valid_from ? 'Upcoming' : asOf > rate.valid_until ? 'Expired' : 'Valid'
}
export function mayManageLogistics(role: string) { return role === 'owner' || role === 'admin' }
export const documentSchema = z.object({ entity_id: z.string().uuid(), name: z.string().min(1).max(200), object_path: z.string().min(1).max(1000) })