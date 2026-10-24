import { createServerFn } from '@tanstack/react-start'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Database } from '@/integrations/supabase/types'
import { assertOrganizationAccess, buildRecordSchema, configurationSchema, entityRequest, may, mergeRecordData, publishRequest, saveRecordRequest, type EntityData, type EntityRecord, type VersionedType } from './entity-schemas'
import { z } from 'zod'

async function resolveMembership(client:SupabaseClient<Database>,userId:string,organizationId:string){
  const [m,o]=await Promise.all([
    client.from('organization_memberships').select('organization_id,role_key,status').eq('organization_id',organizationId).eq('user_id',userId).maybeSingle(),
    client.from('organizations').select('status,name').eq('id',organizationId).maybeSingle(),
  ])
  assertOrganizationAccess(organizationId,m.data,o.data?.status??'')
  if(m.error||o.error||!m.data||!o.data)throw new Error('Organization access denied')
  return {role:m.data.role_key,organizationName:o.data.name}
}
async function configurations(client:SupabaseClient<Database>,org:string):Promise<VersionedType[]>{
  const [types,fields,layouts]=await Promise.all([
    client.from('entity_types').select('*').eq('organization_id',org).order('version',{ascending:false}),
    client.from('entity_field_definitions').select('*').eq('organization_id',org).order('position'),
    client.from('entity_type_layouts').select('*').eq('organization_id',org),
  ])
  if(types.error||fields.error||layouts.error)throw new Error('Unable to load entity configurations')
  return types.data.map(t=>({id:t.id,version:t.version,createdAt:t.created_at,config:configurationSchema.parse({name:t.name,key:t.type_key,fields:fields.data.filter(f=>f.entity_type_id===t.id&&f.configuration_version===t.version).map(f=>({key:f.field_key,label:f.label,type:f.field_type,required:f.required,settings:f.settings})),layout:layouts.data.find(l=>l.entity_type_id===t.id&&l.configuration_version===t.version)?.layout})}))
}
export const getEntityWorkspace=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>entityRequest.parse(d)).handler(async({data,context})=>{
  const membership=await resolveMembership(context.supabase,context.userId,data.organizationId)
  const versions=await configurations(context.supabase,data.organizationId)
  // Page through the Data API rather than silently truncating records at its row limit.
  const records:EntityRecord[]=[]
  for(let offset=0;;offset+=500){
    const r=await context.supabase.from('entities').select('*').eq('organization_id',data.organizationId).order('created_at').order('id').range(offset,offset+499)
    if(r.error)throw new Error('Unable to load records')
    records.push(...r.data.map(e=>({...e,data:e.data as EntityData})))
    if(r.data.length<500)break
  }
  return {...membership,versions,records}
})
export const publishEntityType=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>publishRequest.parse(d)).handler(async({data,context})=>{
  const {role}=await resolveMembership(context.supabase,context.userId,data.organizationId)
  if(role!=='owner'&&role!=='admin')throw new Error('Only organization owners and administrators can publish configurations')
  const result=await context.supabase.rpc('publish_entity_configuration',{p_org:data.organizationId,p_id:data.id as string,p_expected:data.expectedVersion,p_config:data.config})
  if(result.error)throw new Error(result.error.message.includes('changed')?'This configuration changed. Reload before publishing.':result.error.message.includes('immutable')?'Existing keys and field types cannot be changed. Add a new field key instead.':'Unable to publish configuration. Check your fields and relationships.')
  return result.data
})
export const saveEntity=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>saveRecordRequest.parse(d)).handler(async({data,context})=>{
  const {role}=await resolveMembership(context.supabase,context.userId,data.organizationId)
  const versions=await configurations(context.supabase,data.organizationId)
  const latest=versions.find(t=>t.id===data.typeId)
  if(!latest||!may(role,latest.config,'read')||!may(role,latest.config,data.id?'update':'create'))throw new Error('Record access denied')
  let existing:EntityRecord|null=null
  if(data.id){
    const r=await context.supabase.from('entities').select('*').eq('organization_id',data.organizationId).eq('entity_type_id',data.typeId).eq('id',data.id).single()
    if(r.error)throw new Error('Record access denied')
    existing={...r.data,data:r.data.data as EntityData}
    if(existing.revision!==data.revision)throw new Error('This record changed. Reload before saving.')
  }
  const version=existing?versions.find(t=>t.id===data.typeId&&t.version===existing.configuration_version):latest
  if(!version)throw new Error('Configuration not found')
  const values=buildRecordSchema(version.config.fields).parse(data.values) as EntityData
  const clearable=Object.fromEntries(version.config.fields.filter(f=>!f.required&&data.values[f.key]===null).map(f=>[f.key,null]))
  const merged=mergeRecordData(existing?.data??{},{...values,...clearable})
  for(const field of version.config.fields.filter(f=>f.type==='relationship')){
    const id=merged[field.key];if(!id)continue
    const target=await context.supabase.from('entities').select('id').eq('organization_id',data.organizationId).eq('entity_type_id',field.settings.targetTypeId??'').eq('id',String(id)).maybeSingle()
    if(target.error||!target.data)throw new Error('Related record is unavailable in this organization')
  }
  const result=existing?await context.supabase.from('entities').update({data:merged}).eq('organization_id',data.organizationId).eq('id',existing.id).eq('revision',data.revision??0).select('*').single():await context.supabase.from('entities').insert({organization_id:data.organizationId,entity_type_id:data.typeId,configuration_version:version.version,data:merged,created_by:context.userId}).select('*').single()
  if(result.error)throw new Error('Unable to save record. Reload and check your values.')
  return {...result.data,data:result.data.data as EntityData}
})
export const deleteEntity=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>entityRequest.extend({id:z.string().uuid(),typeId:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
  const {role}=await resolveMembership(context.supabase,context.userId,data.organizationId)
  const current=(await configurations(context.supabase,data.organizationId)).find(t=>t.id===data.typeId)
  if(!current||!may(role,current.config,'delete')||!may(role,current.config,'read'))throw new Error('Record access denied')
  const result=await context.supabase.from('entities').delete().eq('organization_id',data.organizationId).eq('entity_type_id',data.typeId).eq('id',data.id).select('id').single()
  if(result.error)throw new Error('Unable to delete record')
  return {id:result.data.id}
})