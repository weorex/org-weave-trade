import { describe,expect,it } from 'vitest'
import { assertOrganizationAccess,blankConfiguration,buildRecordSchema,configurationSchema,may,mergeRecordData,type FieldDefinition } from '@/services/entity-schemas'

describe('Metadata-driven types',()=>{
  const supplier:FieldDefinition[]=[{key:'name',label:'Name',type:'text',required:true,settings:{}},{key:'email',label:'Email',type:'email',required:true,settings:{}}]
  const shipment:FieldDefinition[]=[{key:'weight',label:'Weight',type:'number',required:true,settings:{min:0,max:500}},{key:'status',label:'Status',type:'select',required:true,settings:{options:['pending','shipped']}}]
  it('validates two distinct entity types with the same engine',()=>{
    expect(buildRecordSchema(supplier).safeParse({name:'Acme',email:'trade@example.com'}).success).toBe(true)
    expect(buildRecordSchema(shipment).safeParse({weight:120,status:'shipped'}).success).toBe(true)
    expect(buildRecordSchema(supplier).safeParse({weight:120,status:'shipped'}).success).toBe(false)
  })
  it('enforces required custom fields',()=>expect(buildRecordSchema(supplier).safeParse({name:'Acme'}).success).toBe(false))
  it('rejects invalid email fields',()=>expect(buildRecordSchema(supplier).safeParse({name:'Acme',email:'bad'}).success).toBe(false))
  it('enforces numeric ranges',()=>expect(buildRecordSchema(shipment).safeParse({weight:501,status:'pending'}).success).toBe(false))
  it('enforces custom options',()=>expect(buildRecordSchema(shipment).safeParse({weight:120,status:'delivered'}).success).toBe(false))
  it('validates real calendar dates',()=>expect(buildRecordSchema([{key:'date',label:'Date',type:'date',required:true,settings:{}}]).safeParse({date:'2026-02-30'}).success).toBe(false))
  it('rejects duplicate field keys',()=>{const c=blankConfiguration();c.name='Suppliers';c.key='suppliers';c.fields.push({...c.fields[0],key:'name',label:'Other',type:'text',required:true,settings:{}});expect(configurationSchema.safeParse(c).success).toBe(false)})
  it('requires mandatory fields in forms',()=>{const c=blankConfiguration();c.name='Supplier';c.key='supplier';c.layout.form=[];expect(configurationSchema.safeParse(c).success).toBe(false)})
  it('preserves removed field data on edit',()=>expect(mergeRecordData({name:'Old',retired_code:'ABC',credit:25},{name:'New'})).toEqual({name:'New',retired_code:'ABC',credit:25}))
  it('keeps old schema validation independent from new required fields',()=>{const old=buildRecordSchema(supplier);const next=buildRecordSchema([...supplier,{key:'country',label:'Country',type:'text',required:true,settings:{}}]);const values={name:'Acme',email:'trade@example.com'};expect(old.safeParse(values).success).toBe(true);expect(next.safeParse(values).success).toBe(false)})
  it('requires a valid relationship type',()=>{const c=blankConfiguration();c.name='Supplier';c.key='supplier';c.fields.push({key:'parent',label:'Parent',type:'relationship',required:false,settings:{}});expect(configurationSchema.safeParse(c).success).toBe(false)})
  it('denies unknown layout fields',()=>{const c=blankConfiguration();c.name='Supplier';c.key='supplier';c.layout.columns=['foreign'];expect(configurationSchema.safeParse(c).success).toBe(false)})
})
describe('Organization and record permissions',()=>{
  it('denies another organization even with active membership',()=>expect(()=>assertOrganizationAccess('org-b',{organization_id:'org-a',status:'active'},'active')).toThrow('Organization access denied'))
  it('denies inactive memberships',()=>expect(()=>assertOrganizationAccess('org-a',{organization_id:'org-a',status:'suspended'},'active')).toThrow())
  it('denies suspended organizations',()=>expect(()=>assertOrganizationAccess('org-a',{organization_id:'org-a',status:'active'},'suspended')).toThrow())
  it('denies missing memberships',()=>expect(()=>assertOrganizationAccess('org-a',null,'active')).toThrow())
  it('allows the active organization membership',()=>expect(()=>assertOrganizationAccess('org-a',{organization_id:'org-a',status:'active'},'active')).not.toThrow())
  it('enforces type-specific member delete permissions',()=>{const c=blankConfiguration();expect(may('member',c,'delete')).toBe(false);c.layout.permissions.delete.push('member');expect(may('member',c,'delete')).toBe(true)})
  it('does not allow unknown roles to read records',()=>expect(may('outsider',blankConfiguration(),'read')).toBe(false))
})