import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/integrations/supabase/types'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { assertOrganizationAccess } from './entity-schemas'
import { tradeRequest, catalogueRequest, productSchema, profileSchema, supplierLinkSchema, contactSchema, relationshipSchema, priceSchema, importRowSchema, canManageTrade } from './trade-schemas'

type Client=SupabaseClient<Database>
export type TradeEntity=Database['public']['Tables']['entities']['Row']
export type Product=Database['public']['Tables']['products']['Row']
export type SupplierLink=Database['public']['Tables']['entity_products']['Row']
export type Price=Database['public']['Tables']['product_prices']['Row']
async function membership(c:Client,userId:string,org:string,write=false){
  const [m,o]=await Promise.all([c.from('organization_memberships').select('organization_id,status,role_key').eq('organization_id',org).eq('user_id',userId).maybeSingle(),c.from('organizations').select('name,status,default_currency').eq('id',org).maybeSingle()])
  assertOrganizationAccess(org,m.data,o.data?.status??'')
  if(m.error||o.error||!m.data||!o.data)throw new Error('Organization access denied')
  if(write&&!canManageTrade(m.data.role_key))throw new Error('Only owners and administrators can manage trade data')
  return {role:m.data.role_key,organizationName:o.data.name,currency:o.data.default_currency}
}
function failure(error:{code?:string}|null,message:string){if(error)throw new Error(error.code==='23505'?'Duplicate record: this SKU, contact, relationship, or dated price already exists.':message)}
async function entityAccess(c:Client,org:string,id:string,write=false){const r=await c.rpc('can_trade_entity',{p_org:org,p_entity:id,p_write:write});if(r.error||!r.data)throw new Error('Related entity access denied')}
async function allEntities(c:Client,org:string){const rows:TradeEntity[]=[];for(let offset=0;;offset+=500){const r=await c.from('entities').select('*').eq('organization_id',org).order('id').range(offset,offset+499);failure(r.error,'Unable to load partners');rows.push(...r.data??[]);if((r.data?.length??0)<500)break}return rows}
export const getTradeDirectory=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.parse(d)).handler(async({data,context})=>{
  const access=await membership(context.supabase,context.userId,data.organizationId)
  return {...access,entities:await allEntities(context.supabase,data.organizationId)}
})
export const getCatalogue=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>catalogueRequest.parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId)
  const relationship=data.supplierId?'!inner':''
  let q=context.supabase.from('products').select(`*,entity_products${relationship}(*)`,{count:'exact'}).eq('organization_id',data.organizationId)
  if(data.status!=='all')q=q.eq('status',data.status)
  if(data.category)q=q.eq('category',data.category)
  const term=data.search.replace(/[%_\\,().]/g,' ').trim()
  if(term)q=q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if(data.supplierId){await entityAccess(context.supabase,data.organizationId,data.supplierId);q=q.eq('entity_products.entity_id',data.supplierId)}
  const r=await q.order('name').order('id').range((data.page-1)*data.pageSize,data.page*data.pageSize-1)
  failure(r.error,'Unable to load catalogue')
  return {products:(r.data??[]) as unknown as (Product&{entity_products:SupplierLink[]})[],total:r.count??0}
})
export const saveProduct=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({id:z.string().uuid().nullable(),product:productSchema}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true)
  const r=data.id?await context.supabase.from('products').update(data.product).eq('organization_id',data.organizationId).eq('id',data.id).select('*').single():await context.supabase.from('products').insert({...data.product,organization_id:data.organizationId,created_by:context.userId}).select('*').single()
  failure(r.error,'Unable to save product');return r.data
})
export const findProductDuplicates=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({sku:z.string().max(80),name:z.string().max(160)}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId)
  const sku=data.sku.replace(/[%_\\,().]/g,' ').trim();const name=data.name.replace(/[%_\\,().]/g,' ').trim()
  if(!sku&&!name)return []
  const terms=[sku?`sku.ilike.${sku}`:'',name?`name.ilike.${name}`:''].filter(Boolean).join(',')
  const r=await context.supabase.from('products').select('id,sku,name').eq('organization_id',data.organizationId).or(terms).limit(20);failure(r.error,'Unable to check duplicates');return r.data??[]
})
export const saveTradeProfile=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({entityId:z.string().uuid(),revision:z.number().int().positive(),profile:profileSchema}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true);await entityAccess(context.supabase,data.organizationId,data.entityId,true)
  const r=await context.supabase.from('entities').update({data:{trade_profile:data.profile}}).eq('organization_id',data.organizationId).eq('id',data.entityId).eq('revision',data.revision).select('*').single()
  failure(r.error,'This profile changed or could not be saved. Reload and try again.');return r.data
})
export const getTradeDetail=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({entityId:z.string().uuid().nullable(),productId:z.string().uuid().nullable()}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId)
  if(data.entityId)await entityAccess(context.supabase,data.organizationId,data.entityId)
  let links=context.supabase.from('entity_products').select('*,products(*)').eq('organization_id',data.organizationId)
  if(data.entityId)links=links.eq('entity_id',data.entityId)
  if(data.productId)links=links.eq('product_id',data.productId)
  const allLinks:(SupplierLink&{products:Product|null})[]=[]
  for(let offset=0;;offset+=500){const r=await links.order('id').range(offset,offset+499);failure(r.error,'Unable to load supplier products');allLinks.push(...r.data??[]);if((r.data?.length??0)<500)break}
  const prices:Price[]=[]
  for(let start=0;start<allLinks.length;start+=100){for(let offset=0;;offset+=500){const r=await context.supabase.from('product_prices').select('*').eq('organization_id',data.organizationId).in('entity_product_id',allLinks.slice(start,start+100).map(l=>l.id)).order('effective_date',{ascending:false}).order('id').range(offset,offset+499);failure(r.error,'Unable to load price history');prices.push(...r.data??[]);if((r.data?.length??0)<500)break}}
  const contacts:Database['public']['Tables']['contacts']['Row'][]=[];const relationships:Database['public']['Tables']['entity_relationships']['Row'][]=[]
  if(data.entityId){for(let offset=0;;offset+=500){const [c,r]=await Promise.all([context.supabase.from('contacts').select('*').eq('organization_id',data.organizationId).eq('entity_id',data.entityId).order('id').range(offset,offset+499),context.supabase.from('entity_relationships').select('*').eq('organization_id',data.organizationId).or(`source_entity_id.eq.${data.entityId},target_entity_id.eq.${data.entityId}`).order('id').range(offset,offset+499)]);failure(c.error,'Unable to load contacts');failure(r.error,'Unable to load relationships');contacts.push(...c.data??[]);relationships.push(...r.data??[]);if((c.data?.length??0)<500&&(r.data?.length??0)<500)break}}
  return {links:allLinks,prices,contacts,relationships}
})
export const saveSupplierLink=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({id:z.string().uuid().nullable(),link:supplierLinkSchema}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true);await entityAccess(context.supabase,data.organizationId,data.link.entity_id,true)
  const {entity_id,product_id,...values}=data.link
  const r=data.id?await context.supabase.from('entity_products').update(values).eq('organization_id',data.organizationId).eq('id',data.id).eq('entity_id',entity_id).eq('product_id',product_id).select('*').single():await context.supabase.from('entity_products').insert({...data.link,organization_id:data.organizationId}).select('*').single();failure(r.error,'Unable to link supplier and product');return r.data
})
export const addPrice=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({price:priceSchema}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true)
  const r=await context.supabase.from('product_prices').insert({...data.price,amount:Number(data.price.amount),organization_id:data.organizationId,created_by:context.userId}).select('*').single();failure(r.error,'Unable to add price');return r.data
})
export const saveContact=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({id:z.string().uuid().nullable(),contact:contactSchema}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true);await entityAccess(context.supabase,data.organizationId,data.contact.entity_id,true)
  const {entity_id,...values}=data.contact
  const r=data.id?await context.supabase.from('contacts').update(values).eq('organization_id',data.organizationId).eq('entity_id',entity_id).eq('id',data.id).select('*').single():await context.supabase.from('contacts').insert({...data.contact,organization_id:data.organizationId}).select('*').single();failure(r.error,'Unable to save contact');return r.data
})
export const addRelationship=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({relationship:relationshipSchema}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true)
  const r=await context.supabase.from('entity_relationships').insert({...data.relationship,organization_id:data.organizationId}).select('*').single();failure(r.error,'Unable to save relationship');return r.data
})
export const removeTradeItem=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({id:z.string().uuid(),kind:z.enum(['contacts','entity_relationships'])}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true)
  const r=await context.supabase.from(data.kind).delete().eq('organization_id',data.organizationId).eq('id',data.id).select('id').single();failure(r.error,'Unable to remove record');return {id:r.data?.id}
})
export const importCatalogue=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>tradeRequest.extend({supplierId:z.string().uuid().nullable(),rows:z.array(importRowSchema).min(1).max(500)}).parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId,true)
  const r=await context.supabase.rpc('import_trade_catalogue',{p_org:data.organizationId,p_supplier:data.supplierId as string,p_rows:data.rows as Json});failure(r.error,'Import failed. No rows were saved. Check supplier, duplicate prices, and values.');return r.data as {inserted:number;skipped:number}
})
export const exportCatalogue=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>catalogueRequest.parse(d)).handler(async({data,context})=>{
  await membership(context.supabase,context.userId,data.organizationId)
  if(data.supplierId)await entityAccess(context.supabase,data.organizationId,data.supplierId)
  const rows:Product[]=[]
  for(let offset=0;;offset+=500){let q=context.supabase.from('products').select(data.supplierId?'*,entity_products!inner(entity_id)':'*').eq('organization_id',data.organizationId);if(data.status!=='all')q=q.eq('status',data.status);if(data.category)q=q.eq('category',data.category);const term=data.search.replace(/[%_\\,().]/g,' ').trim();if(term)q=q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);if(data.supplierId)q=q.eq('entity_products.entity_id',data.supplierId);const r=await q.order('name').order('id').range(offset,offset+499);failure(r.error,'Unable to export catalogue');rows.push(...(r.data??[]) as unknown as Product[]);if((r.data?.length??0)<500)break}
  return rows.map(p=>({sku:p.sku,name:p.name,category:p.category,description:p.description,unit:p.unit,status:p.status}))
})