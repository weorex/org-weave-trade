import { describe, it, expect } from 'vitest'
import { routeSchema, rateSchema, rateValidity, assetSchema, mayManageLogistics, portSchema } from '@/services/logistics-schemas'
import { assertOrganizationAccess } from '@/services/entity-schemas'
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', c = '33333333-3333-4333-8333-333333333333'
const route = { shipping_agent_entity_id: a, origin_port_id: b, destination_port_id: c, mode: 'FCL', container_type: '40HC', transit_min_days: 10, transit_max_days: 15 }
const rate = { shipping_route_id: a, amount: '1200', currency: 'USD', unit: 'container', min_quantity: 1, valid_from: '2026-10-01', valid_until: '2026-10-31' }
describe('Logistics rules', () => {
  it('supports FCL containers and LCL volume services', () => { expect(routeSchema.safeParse(route).success).toBe(true); expect(routeSchema.safeParse({ ...route, mode: 'LCL', container_type: '' }).success).toBe(true); expect(routeSchema.safeParse({ ...route, container_type: '' }).success).toBe(false) })
  it('rejects reversed transit estimates', () => expect(routeSchema.safeParse({ ...route, transit_max_days: 5 }).success).toBe(false))
  it('rejects reversed rate validity', () => expect(rateSchema.safeParse({ ...rate, valid_until: '2026-09-30' }).success).toBe(false))
  it('retains inclusive historical validity', () => { expect(rateValidity(rate, '2026-10-01')).toBe('Valid'); expect(rateValidity(rate, '2026-10-31')).toBe('Valid'); expect(rateValidity(rate, '2026-11-01')).toBe('Expired'); expect(rateValidity(rate, '2026-09-30')).toBe('Upcoming') })
  it('requires exactly one service for a rate', () => expect(rateSchema.safeParse({ ...rate, service_area_id: b }).success).toBe(false))
  it('supports transport rates linked to a vehicle', () => expect(rateSchema.safeParse({ ...rate, shipping_route_id: null, service_area_id: b, asset_id: c, currency: 'inr', unit: 'trip' }).success).toBe(true))
  it('rejects vehicles without positive capacity', () => expect(assetSchema.safeParse({ transporter_entity_id: a, registration: 'TN58AB1234', vehicle_type: 'truck', capacity_kg: 0, capacity_cbm: 20 }).success).toBe(false))
  it('normalizes port and country codes', () => expect(portSchema.parse({ code: 'inmaa', name: 'Chennai', country: 'in' }).code).toBe('INMAA'))
  it('denies member logistics writes', () => { expect(mayManageLogistics('member')).toBe(false); expect(mayManageLogistics('owner')).toBe(true) })
  it('denies cross-tenant membership', () => expect(() => assertOrganizationAccess(a, { organization_id: b, status: 'active' }, 'active')).toThrow('Organization access denied'))
})