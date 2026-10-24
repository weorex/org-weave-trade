import { z } from 'zod'
import Papa from 'papaparse'

export const tradeRequest = z.object({ organizationId: z.string().uuid() })
export const productSchema = z.object({
  sku: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(100).default(''), description: z.string().max(5000).default(''),
  unit: z.string().trim().min(1).max(40).default('piece'), status: z.enum(['active','archived']).default('active'),
})
export const profileSchema = z.object({
  kind: z.enum(['manufacturer','supplier','both']), legal_name: z.string().trim().min(1).max(160),
  country: z.string().trim().max(80).default(''), website: z.union([z.literal(''),z.string().url().refine(v=>/^https?:\/\//.test(v))]).default(''),
  address: z.string().max(1000).default(''), certifications: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  capacity: z.string().max(500).default(''), notes: z.string().max(5000).default(''),
})
export const supplierLinkSchema = z.object({entity_id:z.string().uuid(),product_id:z.string().uuid(),supplier_sku:z.string().max(80).default(''),moq:z.number().finite().positive(),capacity:z.string().max(500).default(''),packaging:z.string().max(1000).default(''),lead_time_days:z.number().int().min(0).max(3650).nullable().default(null)})
export const contactSchema = z.object({entity_id:z.string().uuid(),name:z.string().trim().min(1).max(160),email:z.union([z.literal(''),z.string().email()]).default(''),phone:z.string().max(80).default(''),position:z.string().max(100).default(''),notes:z.string().max(2000).default('')})
export const relationshipSchema = z.object({source_entity_id:z.string().uuid(),target_entity_id:z.string().uuid(),relationship_type:z.enum(['supplier','manufacturer','distributor','partner']),notes:z.string().max(2000).default('')}).refine(v=>v.source_entity_id!==v.target_entity_id,'Choose a different partner')
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v},'Invalid date')
export const priceSchema = z.object({entity_product_id:z.string().uuid(),amount:z.string().regex(/^\d{1,12}(\.\d{1,6})?$/,'Use a non-negative amount with up to six decimals'),currency:z.string().regex(/^[A-Z]{3}$/).refine(v=>{try{return Intl.supportedValuesOf('currency').includes(v)}catch{return false}},'Choose an ISO currency'),unit:z.string().trim().min(1).max(40),min_quantity:z.number().finite().positive(),effective_date:dateSchema,notes:z.string().max(2000).default('')})
export const catalogueRequest=tradeRequest.extend({search:z.string().trim().max(100).default(''),category:z.string().max(100).default(''),status:z.enum(['all','active','archived']).default('active'),supplierId:z.string().uuid().nullable().default(null),page:z.number().int().min(1).default(1),pageSize:z.number().int().min(1).max(100).default(25)})
export const importRowSchema=productSchema.extend({moq:z.number().positive().default(1),capacity:z.string().max(500).default(''),packaging:z.string().max(1000).default(''),amount:z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).optional(),currency:priceSchema.shape.currency.optional(),effective_date:dateSchema.optional()}).superRefine((v,c)=>{if(v.amount!==undefined&&(!v.currency||!v.effective_date))c.addIssue({code:'custom',message:'Price requires currency and effective_date'})})
export type ProductInput=z.infer<typeof productSchema>
export type TradeProfile=z.infer<typeof profileSchema>
export type ImportRow=z.infer<typeof importRowSchema>
export function canManageTrade(role:string){return role==='owner'||role==='admin'}
export function normalizeDuplicateKey(value:string){return value.trim().toLowerCase()}
export function duplicateRows(rows:ProductInput[]){const seen=new Set<string>();return rows.flatMap((r,i)=>{const key=normalizeDuplicateKey(r['sku']);if(seen.has(key))return [i+2];seen.add(key);return []})}
export function parseCatalogueCsv(text:string){
  const parsed=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim().toLowerCase()})
  if(parsed.errors.length)throw new Error(`CSV error: ${parsed.errors[0]?.message}`)
  if(!parsed.meta.fields?.includes('sku')||!parsed.meta.fields.includes('name'))throw new Error('CSV requires sku and name columns')
  if(parsed.data.length>500)throw new Error('Import at most 500 rows per file')
  const rows:ImportRow[]=[];const errors:{row:number;message:string}[]=[]
  parsed.data.forEach((r,i)=>{const result=importRowSchema.safeParse({sku:r['sku'],name:r['name'],category:r['category']||'',description:r['description']||'',unit:r['unit']||'piece',status:r['status']||'active',moq:r['moq']?Number(r['moq']):1,capacity:r['capacity']||'',packaging:r['packaging']||'',...(r['amount']?{amount:r['amount'],currency:r['currency'],effective_date:r['effective_date']}:{})});if(result.success)rows.push(result.data);else errors.push({row:i+2,message:result.error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('; ')})})
  duplicateRows(rows).forEach(row=>errors.push({row,message:'Duplicate SKU within file'}))
  return {rows,errors,total:parsed.data.length}
}
export function exportCsv(rows:Record<string,unknown>[]){return Papa.unparse(rows,{escapeFormulae:true})}
export function priceSeries<T extends {currency:string;unit:string;min_quantity:number;effective_date:string;created_at:string}>(rows:T[],currency:string,unit:string,quantity:number){return rows.filter(r=>r['currency']===currency&&r['unit']===unit&&r.min_quantity===quantity).sort((a,b)=>b.effective_date.localeCompare(a.effective_date)||b.created_at.localeCompare(a.created_at))}
export function formatMoney(amount:number|string,currency:string){return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:6}).format(Number(amount))}