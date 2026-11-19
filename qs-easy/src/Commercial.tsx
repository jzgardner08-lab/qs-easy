import type { Project, UpdateProject } from './types'
import { num } from './fields'
import { Entry, Table } from './Forms'
import { gbp, today } from './storage'

export function Commercial({view,p,save}:{view:string;p:Project;save:UpdateProject}) {
  const id=()=>crypto.randomUUID()
  const valuations=p.valuations || []
  const costs=p.costs || []
  const risks=p.risks || []
  const quotes=p.quotes || []
  const bill=p.items.reduce((s,i)=>s+i.quantity*i.unitRate,0)
  const approved=p.variations.reduce((s,v)=>s+(v.status==='Approved'?v.impactAmount:0),0)
  const measured=p.items.reduce((s,i)=>s+i.quantity*i.unitRate*i.progress/100,0)
  const latest=valuations.at(-1)
  if(view==='Valuations') return <section className="panel"><h2>Interim valuations</h2><p>Record cumulative assessed values excluding VAT. Previous certificates are deducted to calculate this period’s amount.</p>
    <Entry key={valuations.length} fields={[{key:'period',label:'Valuation date',type:'date',value:today()},num('work','Bill work completed (£)',+measured.toFixed(2)),num('materials','Materials on site (£)',latest?.materials || 0),{...num('changes','Agreed variation work completed (£)',latest?.changes || 0),min:undefined}, {...num('retention','Retention (%)',latest?.retention || 0),max:100},num('previous','Previously certified (£)',latest ? +(latest.previous+latest.due).toFixed(2) : 0)]} action="Record valuation" submit={v=>{
      if(latest && v.period<=latest.period) throw Error('Choose a date after the last recorded valuation.')
      const work=+v.work,materials=+v.materials,changes=+v.changes,retention=+v.retention,previous=+v.previous
      const due=+((work+materials+changes)*(1-retention/100)-previous).toFixed(2)
      save({...p,valuations:[...valuations,{id:id(),period:v.period,work,materials,changes,retention,previous,due}]})
    }}/><Table head={['Date','Bill work','Materials','Variations','Retention','Previously certified','This period']} rows={valuations.map(v=>[v.period,gbp(v.work),gbp(v.materials),gbp(v.changes),v.retention+'%',gbp(v.previous),gbp(v.due)])}/></section>
  if(view==='Cost forecast') return <section className="panel"><h2>Cost-value reconciliation</h2><p>Enter cumulative actual cost and the outstanding balance on orders. Forecast final cost includes both plus the remaining uncommitted work.</p>
    <Entry fields={[{key:'name',label:'Package'},num('budget','Package budget (£)'),num('committed','Outstanding commitments (£)'),num('actual','Actual cost (£)'),num('remaining','Uncommitted cost to complete (£)')]} action="Save package" submit={v=>{
      const old=costs.find(c=>c.name.toLowerCase()===v.name.toLowerCase())
      save({...p,costs:[...costs.filter(c=>c!==old),{id:old?.id||id(),name:v.name,budget:+v.budget,committed:+v.committed,actual:+v.actual,remaining:+v.remaining}]})
    }}/><Table head={['Package','Budget','Outstanding','Actual','Forecast final','Headroom','Status']} rows={costs.map(c=>{
      const forecast=c.committed+c.actual+c.remaining, headroom=c.budget-forecast
      return [c.name,gbp(c.budget),gbp(c.committed),gbp(c.actual),gbp(forecast),gbp(headroom),<b className={headroom<0?'red':headroom<=c.budget*.05?'amber':'green'}>{headroom<0?'Over budget':headroom<=c.budget*.05?'Within 5%':'On budget'}</b>]
    })}/><p>Measured bill value {gbp(measured)} · Actual package costs {gbp(costs.reduce((s,c)=>s+c.actual,0))}</p></section>
  if(view==='Risks') return <section className="panel"><h2>Risks and opportunities</h2><p>Net expected allowance {gbp(risks.reduce((s,r)=>s+(r.kind==='Opportunity'?-1:1)*r.impact*r.probability/100,0))}</p>
    <Entry fields={[{key:'name',label:'Description'},{key:'kind',label:'Type',choices:[['Risk','Risk'],['Opportunity','Opportunity']]},{...num('probability','Probability (%)'),max:100},num('impact','Potential impact (£)'),{key:'owner',label:'Owner'},{key:'mitigation',label:'Mitigation or action'}]} action="Add entry" submit={v=>save({...p,risks:[...risks,{id:id(),name:v.name,kind:v.kind,probability:+v.probability,impact:+v.impact,owner:v.owner,mitigation:v.mitigation}]})}/><Table head={['Description','Type','Probability','Impact','Owner','Action','']} rows={risks.map(r=>[r.name,r.kind,r.probability+'%',gbp(r.impact),r.owner,r.mitigation,<button onClick={()=>save({...p,risks:risks.filter(i=>i.id!==r.id)})}>Remove</button>])}/></section>
  if(view==='Tender comparison') {
    const bidders=[...new Set(quotes.map(q=>q.contractor))]
    return <section className="panel"><h2>Tender comparison</h2>{!p.items.length ? <p>Add bill items to compare tender returns against the same scope.</p> : <>
      <Entry fields={[{key:'contractor',label:'Contractor'},{key:'itemId',label:'Bill item',choices:p.items.map(i=>[i.id,i.description])},num('rate','Quoted rate (£/unit)'),{key:'exclusions',label:'Exclusions',optional:true},{key:'qualifications',label:'Qualifications',optional:true}]} action="Save quoted rate" submit={v=>{
        const contractor=bidders.find(b=>b.toLowerCase()===v.contractor.toLowerCase())||v.contractor
        save({...p,quotes:[...quotes.filter(q=>q.contractor!==contractor||q.itemId!==v.itemId),{id:id(),contractor,itemId:v.itemId,rate:+v.rate,exclusions:v.exclusions,qualifications:v.qualifications}]})
      }}/><Table head={['Bill item','Budget rate',...bidders]} rows={p.items.map(i=>[i.description,gbp(i.unitRate),...bidders.map(b=>{
        const q=quotes.find(q=>q.contractor===b&&q.itemId===i.id)
        return q ? <span>{gbp(q.rate)} / {i.unit}{i.unitRate>0 && Math.abs(q.rate/i.unitRate-1)>.2 && <small> · Over 20% from budget rate</small>}<br/>{[q.exclusions,q.qualifications].filter(Boolean).join(' · ')}</span> : 'Missing rate'
      })])}/><Table head={['Contractor','Priced items','Priced subtotal']} rows={bidders.map(b=>{
        const priced=quotes.filter(q=>q.contractor===b && p.items.some(i=>i.id===q.itemId))
        return [b,priced.length+' / '+p.items.length,gbp(priced.reduce((sum,q)=>sum+q.rate*(p.items.find(i=>i.id===q.itemId)?.quantity||0),0))]
      })}/></>}</section>
  }
  const programme=p.programme
  return <section className="panel"><h2>Cash-flow forecast</h2><p>Enter planned monthly percentages, or leave them blank for an even spread. Compare planned gross value with net certificates after retention.</p>
    <Entry fields={[{key:'start',label:'Start month',type:'month',value:programme?.start},{...num('months','Duration (months)',programme?.months),min:1,max:360,step:'1'},{key:'weights',label:'Planned monthly percentages, comma separated',optional:true,value:programme?.weights?.join(', ')}]} action="Save programme" submit={v=>{
      const months=+v.months, weights=v.weights?v.weights.split(',').map(s=>s.trim()===''?NaN:Number(s.trim())):undefined
      if(weights && (weights.length!==months || weights.some(n=>!Number.isFinite(n)||n<0) || Math.abs(weights.reduce((s,n)=>s+n,0)-100)>.000001))throw Error('Enter one percentage per month, totalling 100%.')
      save({...p,programme:{start:v.start,months,weights}})
    }}/>
    {programme && <Table head={['Month','Planned gross value','Cumulative planned','Certified this month']} rows={Array.from({length:programme.months},(_,i)=>{
      const date=new Date(programme.start+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+i)
      const month=date.toISOString().slice(0,7), total=bill+approved
      const plannedThrough=(n:number)=>+(total*(programme.weights?programme.weights.slice(0,n).reduce((s,w)=>s+w,0)/100:n/programme.months)).toFixed(2)
      const cumulative=plannedThrough(i+1)
      return [month,gbp(cumulative-plannedThrough(i)),gbp(cumulative),gbp(valuations.filter(v=>v.period.startsWith(month)).reduce((s,v)=>s+v.due,0))]
    })}/>}</section>
}
