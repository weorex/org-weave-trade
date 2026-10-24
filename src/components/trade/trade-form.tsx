import { useState } from 'react'
import type { ZodTypeAny } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Save } from 'lucide-react'

export type FormField={key:string;label:string;kind?:'number'|'date'|'email'|'textarea'|'select'|'list';required?:boolean;options?:{value:string;label:string}[];step?:string}
export function TradeForm({fields,initial={},schema,onSave,onCancel,label='Save'}:{fields:FormField[];initial?:Record<string,unknown>;schema:ZodTypeAny;onSave:(values:Record<string,unknown>)=>Promise<void>;onCancel?:()=>void;label?:string}){
  const [values,setValues]=useState<Record<string,unknown>>(initial);const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  return <form className="grid gap-5" onSubmit={async e=>{e.preventDefault();setError('');const raw={...values};for(const f of fields){if(f.kind==='number')raw[f.key]=values[f.key]===''||values[f.key]===undefined?null:Number(values[f.key]);if(f.kind==='list')raw[f.key]=String(values[f.key]??'').split(';').map(v=>v.trim()).filter(Boolean)}const r=schema.safeParse(raw);if(!r.success){setError(r.error.issues.map((i:{path:(string|number)[];message:string})=>`${i.path.join('.')}: ${i.message}`).join('; '));return}setBusy(true);try{await onSave(r.data)}catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}}>
    <div className="grid gap-5 sm:grid-cols-2">{fields.map(f=><label key={f.key} className={`field-label ${f.kind==='textarea'?'sm:col-span-2':''}`}>{f.label}{f.kind==='select'?<select className="native-select" aria-label={f.label} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}><option value="">Choose…</option>{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.kind==='textarea'?<Textarea aria-label={f.label} required={f.required} value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>:<Input aria-label={f.label} required={f.required} type={f.kind==='number'?'number':f.kind==='date'?'date':f.kind==='email'?'email':'text'} step={f.step??'any'} value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}/>}</label>)}</div>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-3"><Button disabled={busy} type="submit"><Save/>{busy?'Saving…':label}</Button>{onCancel&&<Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>}</div>
  </form>
}