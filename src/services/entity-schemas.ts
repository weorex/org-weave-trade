import { z } from 'zod'

export const fieldKinds = ['text','textarea','number','boolean','date','email','url','select','relationship'] as const
export const roles = ['owner','admin','member'] as const
const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).refine(k => !['constructor','prototype','__proto__'].includes(k), 'Reserved key')
export const fieldSchema = z.object({
  key, label:z.string().trim().min(1).max(100), type:z.enum(fieldKinds), required:z.boolean(),
  settings:z.object({min:z.number().optional(),max:z.number().optional(),minLength:z.number().int().min(0).max(10000).optional(),maxLength:z.number().int().min(1).max(10000).optional(),options:z.array(z.string().min(1).max(100)).max(100).optional(),targetTypeId:z.string().uuid().optional()}).strict(),
}).superRefine((f,c)=>{
  if(f.type==='select'&&!f.settings.options?.length)c.addIssue({code:'custom',path:['settings','options'],message:'Add at least one option'})
  if(f.type==='relationship'&&!f.settings.targetTypeId)c.addIssue({code:'custom',path:['settings','targetTypeId'],message:'Choose a related type'})
  if(f.settings.min!==undefined&&f.settings.max!==undefined&&f.settings.min>f.settings.max)c.addIssue({code:'custom',message:'Minimum exceeds maximum'})
  if(f.settings.minLength!==undefined&&f.settings.maxLength!==undefined&&f.settings.minLength>f.settings.maxLength)c.addIssue({code:'custom',message:'Minimum length exceeds maximum'})
})
export const layoutSchema = z.object({
  form:z.array(key).max(60),detail:z.array(key).max(60),columns:z.array(key).max(60),filters:z.array(key).max(60),
  tabs:z.array(z.object({label:z.string().trim().min(1).max(100),fields:z.array(key).max(60)})).max(20),
  permissions:z.object({read:z.array(z.enum(roles)),create:z.array(z.enum(roles)),update:z.array(z.enum(roles)),delete:z.array(z.enum(roles))}),
})
export const configurationSchema=z.object({name:z.string().trim().min(1).max(100),key,fields:z.array(fieldSchema).min(1).max(60),layout:layoutSchema}).superRefine((config,c)=>{
  const keys=new Set(config.fields.map(f=>f.key))
  if(keys.size!==config.fields.length)c.addIssue({code:'custom',path:['fields'],message:'Field keys must be unique'})
  for(const area of ['form','detail','columns','filters'] as const){
    if(config.layout[area].some(k=>!keys.has(k)))c.addIssue({code:'custom',path:['layout',area],message:'Unknown field'})
    if(new Set(config.layout[area]).size!==config.layout[area].length)c.addIssue({code:'custom',path:['layout',area],message:'Duplicate layout field'})
  }
  if(config.layout.tabs.some(t=>t.fields.some(k=>!keys.has(k))))c.addIssue({code:'custom',path:['layout','tabs'],message:'Unknown tab field'})
  if(config.fields.some(f=>f.required&&!config.layout.form.includes(f.key)))c.addIssue({code:'custom',path:['layout','form'],message:'All required fields must appear in the form'})
})
export type FieldDefinition=z.infer<typeof fieldSchema>
export type EntityConfiguration=z.infer<typeof configurationSchema>
export type EntityValue=string|number|boolean|null
export type EntityData=Record<string,EntityValue>
export type VersionedType={id:string;version:number;createdAt:string;config:EntityConfiguration}
export type EntityRecord={id:string;organization_id:string;entity_type_id:string;configuration_version:number;data:EntityData;revision:number;created_at:string;updated_at:string}
export const entityRequest=z.object({organizationId:z.string().uuid()})
export const publishRequest=entityRequest.extend({id:z.string().uuid().nullable(),expectedVersion:z.number().int().min(0),config:configurationSchema})
export const saveRecordRequest=entityRequest.extend({typeId:z.string().uuid(),id:z.string().uuid().nullable(),revision:z.number().int().min(1).optional(),values:z.record(z.union([z.string().max(10000),z.number().finite(),z.boolean(),z.null()]))})

export function buildRecordSchema(fields:FieldDefinition[]){
  const shape:Record<string,z.ZodTypeAny>={}
  for(const f of fields){
    let validator:z.ZodTypeAny
    if(f.type==='number'){
      let n=z.number().finite();if(f.settings.min!==undefined)n=n.min(f.settings.min);if(f.settings.max!==undefined)n=n.max(f.settings.max);validator=n
    }else if(f.type==='boolean')validator=z.boolean()
    else{
      let s=z.string().max(f.settings.maxLength??10000).min(f.settings.minLength??(f.required?1:0))
      if(f.type==='email')s=s.email()
      if(f.type==='url')s=s.url().refine(v=>/^https?:\/\//.test(v),'Use an HTTP or HTTPS URL') as unknown as z.ZodString
      validator=s
      if(f.type==='date')validator=s.regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v},'Invalid date')
      if(f.type==='select')validator=s.refine(v=>f.settings.options?.includes(v)??false,'Choose a valid option')
      if(f.type==='relationship')validator=s.uuid()
    }
    shape[f.key]=f.required?validator:z.preprocess(v=>v===''||v===null?undefined:v,validator.optional())
  }
  return z.object(shape).strip()
}
export function mergeRecordData(existing:EntityData,values:EntityData){return {...existing,...values}}
export function may(role:string,config:EntityConfiguration,action:'read'|'create'|'update'|'delete'){
  return role==='owner'||role==='admin'||config.layout.permissions[action].some(r=>r===role)
}
export function assertOrganizationAccess(organizationId:string,membership:{organization_id:string;status:string}|null,organizationStatus:string){
  if(!membership||membership.organization_id!==organizationId||membership.status!=='active'||organizationStatus!=='active')throw new Error('Organization access denied')
}
export function blankConfiguration():EntityConfiguration{return {name:'',key:'',fields:[{key:'name',label:'Name',type:'text',required:true,settings:{}}],layout:{form:['name'],detail:['name'],columns:['name'],filters:['name'],tabs:[],permissions:{read:[...roles],create:[...roles],update:[...roles],delete:['owner','admin']}}}}
export function displayValue(value:unknown){return value===undefined||value===null||value===''?'—':typeof value==='boolean'?(value?'Yes':'No'):String(value)}