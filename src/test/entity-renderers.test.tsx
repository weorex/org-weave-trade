import { cleanup,fireEvent,render,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { EntityForm } from '@/components/entities/entity-renderers'
import { blankConfiguration } from '@/services/entity-schemas'

afterEach(cleanup)
describe('Shared record form',()=>{
  it('submits a supplier using metadata',async()=>{
    const config=blankConfiguration();config.name='Suppliers';config.key='suppliers';config.fields.push({key:'email',label:'Email',type:'email',required:true,settings:{}});config.layout.form.push('email')
    const save=vi.fn();const {getByLabelText,getByRole}=render(<EntityForm config={config} records={[]} onSave={save}/>);
    fireEvent.change(getByLabelText('Name*'),{target:{value:'Acme'}})
    fireEvent.change(getByLabelText('Email*'),{target:{value:'trade@example.com'}})
    fireEvent.click(getByRole('button',{name:'Save record'}))
    await waitFor(()=>expect(save).toHaveBeenCalledWith({name:'Acme',email:'trade@example.com'}))
  })
  it('submits numeric shipment data through the same form',async()=>{
    const config=blankConfiguration();config.name='Shipments';config.key='shipments';config.fields=[{key:'weight',label:'Weight',type:'number',required:true,settings:{min:0}}];config.layout.form=['weight']
    const save=vi.fn();const {getByLabelText,getByRole}=render(<EntityForm config={config} records={[]} onSave={save}/>);
    fireEvent.change(getByLabelText('Weight*'),{target:{value:'125'}});fireEvent.click(getByRole('button',{name:'Save record'}))
    await waitFor(()=>expect(save).toHaveBeenCalledWith({weight:125}))
  })
  it('blocks invalid required values before saving',()=>{
    const config=blankConfiguration();const save=vi.fn();const {getByRole}=render(<EntityForm config={config} records={[]} onSave={save}/>);
    fireEvent.click(getByRole('button',{name:'Save record'}));expect(save).not.toHaveBeenCalled()
  })
  it('retains data not displayed by a historical form',async()=>{
    const config=blankConfiguration();const save=vi.fn();const {getByLabelText,getByRole}=render(<EntityForm config={config} initial={{name:'Old',retired_code:'ABC'}} records={[]} onSave={save}/>);
    fireEvent.change(getByLabelText('Name*'),{target:{value:'New'}});fireEvent.click(getByRole('button',{name:'Save record'}));await waitFor(()=>expect(save).toHaveBeenCalledWith({name:'New',retired_code:'ABC'}))
  })
})