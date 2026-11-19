import { useState } from 'react'
import type { Category, Project, Rate } from './types'
import { csv, readRows, workbook } from './exchange'
import { download, gbp, today } from './storage'
import { num } from './fields'
import { Entry, Table } from './Forms'

type Props={view:string;p:Project;rates:Rate[];save:(p:Project)=>void;saveRates:(r:Rate[])=>void}
const categories:Category[]=['Preliminaries','Substructure','Superstructure','Finishes','Services','Other']
export function DataTools({view,p,rates,save,saveRates}:Props){
  const [message,setMessage]=useState(''),[kind,setKind]=useState('Bill')
  const [busy,setBusy]=useState(false)
  const id=()=>crypto.randomUUID()
  const items=p.items.map(i=>[i.id,i.description] as [string,string])
  const notes=p.notes||[],docs=p.documents||[]
  if(view==='Rate library')return <section className="panel"><h2>Reusable rate library</h2><p>Rates are available across your local projects. Applying a rate copies its current price into the bill.</p>
    <Entry fields={[{key:'description',label:'Description'},{key:'unit',label:'Unit'},num('amount','Rate (£ per unit)'),{key:'supplier',label:'Supplier or source'},{key:'region',label:'Region'},{key:'date',label:'Price date',type:'date',value:today()}]} action="Save rate" submit={v=>saveRates([...rates,{id:id(),description:v.description,unit:v.unit,amount:+v.amount,supplier:v.supplier,region:v.region,date:v.date}])}/>
    <Table head={['Description','Unit rate','Source','Region','Date','']} rows={rates.map(r=>[r.description,gbp(r.amount)+' / '+r.unit,r.supplier,r.region,r.date,<button onClick={()=>{try{save({...p,items:[...p.items,{id:id(),category:'Other',description:r.description,unit:r.unit,quantity:1,unitRate:r.amount,progress:0}]});setMessage('Added one unit to the bill. Edit its quantity in Bill of quantities.')}catch(e){setMessage(String(e))}}}>Use in bill</button>])}/><p role="status">{message}</p></section>
  if(view==='Site diary')return <section className="panel site-mode"><h2>Site measurement diary</h2>{!items.length?<p>Add a measured item using the take-off calculator to start your diary.</p>:<Entry fields={[{key:'item',label:'Bill item',choices:items},{key:'date',label:'Site visit',type:'date',value:today()},{...num('progress','Cumulative completion (%)'),max:100},{key:'note',label:'Measurement or site note'}]} action="Record site progress" submit={v=>save({...p,items:p.items.map(i=>i.id===v.item?{...i,progress:+v.progress}:i),notes:[...notes,{id:id(),date:v.date,itemId:v.item,progress:+v.progress,note:v.note}]})}/>}
    <Table head={['Visit','Bill item','Progress','Site note']} rows={notes.map(n=>[n.date,p.items.find(i=>i.id===n.itemId)?.description||'Removed bill item',n.progress+'%',n.note])}/></section>
  if(view==='Documents')return <section className="panel"><h2>Project documents</h2><form onSubmit={async e=>{
    e.preventDefault();const form=e.currentTarget, data=new FormData(form),file=data.get('file') as File
    if(file.size>1_500_000){setMessage('Choose a document smaller than 1.5 MB.');return}
    setBusy(true);try{
      const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('Unable to read file.'));reader.readAsDataURL(file)})
      save({...p,documents:[...docs,{id:id(),name:file.name,target:String(data.get('target')),date:today(),data:content}]});form.reset();setMessage('Document added.')
    }catch(e){setMessage(String(e))}finally{setBusy(false)}
  }}><label>Link to<select name="target"><option value="">Project</option>{[...p.items,...p.variations].map(i=><option key={i.id} value={i.id}>{i.description}</option>)}</select></label><label>Document or photograph<input type="file" name="file" required/></label><button disabled={busy}>Attach file</button></form><p role="status">{message}</p>
  <Table head={['File','Linked record','Added','']} rows={docs.map(d=>[<a href={d.data} download={d.name}>{d.name}</a>,[...p.items,...p.variations].find(i=>i.id===d.target)?.description||(d.target?'Removed record':'Project'),d.date,<button onClick={()=>save({...p,documents:docs.filter(x=>x.id!==d.id)})}>Remove</button>])}/></section>
  const billHeader=['Description','Category','Unit','Quantity','Unit rate','Progress']
  const ratesHeader=['Description','Unit','Rate','Supplier','Region','Date']
  const tenderHeader=['Contractor','Bill item ID','Description','Rate','Exclusions','Qualifications']
  const header=kind==='Bill'?billHeader:kind==='Rates'?ratesHeader:tenderHeader
  const rows:(string|number)[][]=kind==='Bill'?p.items.map(i=>[i.description,i.category,i.unit,i.quantity,i.unitRate,i.progress]):kind==='Rates'?rates.map(r=>[r.description,r.unit,r.amount,r.supplier,r.region,r.date]):p.items.flatMap(i=>{
    const quotes=(p.quotes||[]).filter(q=>q.itemId===i.id)
    return quotes.length?quotes.map(q=>[q.contractor,i.id,i.description,q.rate,q.exclusions,q.qualifications]):[['',i.id,i.description,'','','']]
  })
  async function importFile(file:File){
    setBusy(true);setMessage('')
    try{
      const parsed=await readRows(file),columns=parsed.shift()?.map(s=>s.trim().toLowerCase())||[]
      const positions=header.map(h=>columns.indexOf(h.toLowerCase()))
      if(positions.includes(-1))throw Error('Use the headers in the exported template.')
      const records=parsed.filter(r=>r.some(v=>v?.trim())).map(r=>positions.map(i=>String(r[i]||'').trim()))
      if(!records.length)throw Error('The file contains no data rows.')
      const numeric=(s:string,max=Infinity)=>{const n=Number(s);if(!s||!Number.isFinite(n)||n<0||n>max)throw Error('Check numeric values in the file.');return n}
      if(kind==='Bill'){const imported=records.map(([description,category,unit,qty,rate,progress])=>{
        if(!description||!unit||!categories.includes(category as Category))throw Error('Each bill row needs a description, unit and valid category.')
        return {id:id(),description,category:category as Category,unit,quantity:numeric(qty),unitRate:numeric(rate),progress:numeric(progress||'0',100)}
      });save({...p,items:[...p.items,...imported]})}
      else if(kind==='Rates'){saveRates([...rates,...records.map(([description,unit,amount,supplier,region,date])=>{
        if(!description||!unit)throw Error('Enter a description and unit on each rate.')
        return {id:id(),description,unit,amount:numeric(amount),supplier,region,date}
      })])}else{
        let quotes=[...(p.quotes||[])]
        for(const [contractor,itemId,,rate,exclusions,qualifications] of records){
          if(!contractor||!p.items.some(i=>i.id===itemId))throw Error('Enter a contractor and use bill item IDs from this project.')
          quotes=quotes.filter(q=>q.contractor!==contractor||q.itemId!==itemId)
          quotes.push({id:id(),contractor,itemId,rate:numeric(rate),exclusions,qualifications})
        }save({...p,quotes})
      }setMessage(records.length+' rows imported.')
    }catch(e){setMessage(e instanceof Error?e.message:'Import failed.')}finally{setBusy(false)}
  }
  return <section className="panel"><h2>Spreadsheet exchange</h2><p>Export a template or import the first worksheet with matching column headings. Bill items and rates append. Tender rates update by contractor and bill item.</p>
    <label>Data<select value={kind} onChange={e=>setKind(e.target.value)}>{['Bill','Rates','Tenders'].map(k=><option key={k}>{k}</option>)}</select></label>
    <button onClick={()=>download(kind+'.csv',csv([header,...rows]),'text/csv;charset=utf-8')}>Export CSV</button> <button onClick={()=>download(kind+'.xlsx',workbook([header,...rows]),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}>Export Excel</button>
    <label>Import CSV or Excel<input disabled={busy} type="file" accept=".csv,.xlsx" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importFile(f)}}/></label><p role="status">{message}</p></section>
}
