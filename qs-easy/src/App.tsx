import type { Portfolio } from './types'
import { backupKey, workspaceKey, loadPortfolio, isPortfolio, download } from './storage'
import { Commercial } from './Commercial'
import { Cloud } from './Cloud'
import { DataTools } from './DataTools'
import { Review } from './Review'
import { Entry } from './Forms'
import React, { useState, useRef } from 'react';
import { SurveyTool } from './SurveyTool';
import type { Project, Category, Variation, BoQItem } from './types';

// Helper to calculate project totals for the Dashboard and Report
function calculateMetrics(project: Project) {
  const totalBaseCost = project.items.reduce((acc, item) => acc + (item.quantity * item.unitRate), 0);
  const totalVariations = project.variations.reduce((acc, v) => acc + (v.status === 'Approved' ? v.impactAmount : 0), 0);
  const totalContractValue = totalBaseCost + totalVariations;

  const totalProgressWeight = project.items.reduce((acc, item) => {
    const itemCost = item.quantity * item.unitRate;
    return acc + (itemCost * (item.progress / 100));
  }, 0);

  const totalProgressPercent = totalBaseCost > 0 
    ? (totalProgressWeight / totalBaseCost) * 100 
    : 0;

  const estimatedSpend = totalProgressWeight;
  const remainingBudget = totalContractValue - estimatedSpend;

  return {
    totalBaseCost,
    totalVariations,
    totalContractValue,
    totalProgressPercent,
    estimatedSpend,
    remainingBudget
  };
}

// --- Main Application Component ---

export default function App() {
  const [initial] = useState(() => {try{return {data:loadPortfolio(),error:''}}catch{return {data:{projects:[],rates:[]} as Portfolio,error:'Saved data could not be read. Restore a backup before making changes.'}}})
  const [portfolio,setPortfolio]=useState<Portfolio>(initial.data)
  const [active,setActive]=useState('')
  const [view,show]=useState('Overview')
  const [page,setPage]=useState('Projects')
  const [message,setMessage]=useState(initial.error)
  const [previous,setPrevious]=useState<Portfolio|null>(null)
  const latest=useRef(portfolio)
  const [savedVersion]=useState(()=>{try{return localStorage.getItem(workspaceKey)}catch{return null}})
  const stored=useRef(savedVersion)
  const project=portfolio.projects.find(p=>p.id===active && !p.archived)
  function commit(next:Portfolio,restore=false){
    try{
      if(initial.error && !restore && !stored.current)throw Error(initial.error)
      const persisted=localStorage.getItem(workspaceKey)
      if(persisted!==stored.current)throw Error('Another tab changed this workspace. Export your backup, then reload before editing.')
      if(initial.error && !restore && latest.current===initial.data)throw Error(initial.error)
      const raw=JSON.stringify(next)
      if(persisted) localStorage.setItem(backupKey,persisted)
      localStorage.setItem(workspaceKey,raw);stored.current=raw
      setPrevious(latest.current);latest.current=next;setPortfolio(next);setMessage('')
      return true
    }catch(e){setMessage(e instanceof DOMException?'Unable to save. Browser storage may be full or unavailable. Export a backup.':String(e));return false}
  }
  function open(p:Project){setActive(p.id);show('Overview');setPage('Project')}
  function save(p:Project){const data=latest.current
    if(data.projects.find(x=>x.id===p.id)!==portfolio.projects.find(x=>x.id===p.id)){setMessage('The project changed while this action was in progress. Try again.');return false}
    return commit({...data,projects:data.projects.map(old=>old.id===p.id?p:old)})}
  function setProject(change:React.SetStateAction<Project>){const current=latest.current.projects.find(p=>p.id===active);if(current)save(typeof change==='function'?change(current):change)}
  const navigate=(v:'boq'|'variations'|'takeoff'|'rate')=>show(({boq:'Bill of quantities',variations:'Variation ledger',takeoff:'Take-off calculator',rate:'Unit rate build-up'})[v])
  const views=['Overview','Bill of quantities','Take-off calculator','Unit rate build-up','Rate library','Variation ledger','Valuations','Cost forecast','Cash flow','Tender comparison','Risks','Site diary','Documents','Spreadsheets','QS review','Cost report']
  const cloud=<Cloud project={project} receive={p=>{const data=latest.current;if(commit({...data,projects:[...data.projects.filter(x=>x.id!==p.id),p]}))open(p)}}/>
  return <div className="workspace"><header className="mast no-print"><div className="mast-inner"><div className="brand"><i aria-hidden="true">QS</i> QS Easy</div><span>Commercial workspace</span></div></header>
  <div className="shell"><nav className="rail no-print" aria-label="Workspace"><button aria-current={page==='Projects'?'page':undefined} onClick={()=>setPage('Projects')}>My projects</button><button onClick={()=>setPage('Cloud')}>Cloud projects</button>
    {project && views.map(v=><button key={v} aria-current={page==='Project'&&v===view?'page':undefined} onClick={()=>{setPage('Project');show(v)}}>{v}</button>)}</nav>
  <main><div className="toolbar no-print">{previous && <button onClick={()=>{if(commit(previous!))setPrevious(null)}}>Undo last change</button>}</div>
  {message && <p role="alert">{message}</p>}
  <div hidden={page!=='Cloud'}>{cloud}</div>
  {page==='Cloud'?null:page==='Projects'||!project?<><header className="project"><div><h1>My projects</h1><p>{portfolio.projects.length?'Open a project or start a new one.':'Create your first project to start measuring and pricing work.'}</p></div></header>
  <section className="panel"><h2>Create a project</h2><Entry fields={[{key:'name',label:'Project name'},{key:'description',label:'Description',optional:true}]} action="Create blank project" submit={v=>{
    const p:Project={id:crypto.randomUUID(),name:v.name,description:v.description,items:[],variations:[]}
    if(commit({...latest.current,projects:[...latest.current.projects,p]}))open(p)
  }}/></section>
  {portfolio.projects.map(p=><section className="panel project-row" key={p.id}><h2>{p.name}</h2><p>{p.archived?'Archived':p.description}</p>
  {!p.archived && <button onClick={()=>open(p)}>Open project</button>} <button onClick={()=>save({...p,archived:!p.archived})}>{p.archived?'Restore project':'Archive project'}</button>
  <details><summary>Project details</summary><Entry fields={[{key:'name',label:'Project name',value:p.name},{key:'description',label:'Description',optional:true,value:p.description}]} action="Save details" submit={v=>{save({...p,name:v.name,description:v.description})}}/></details></section>)}
  <details className="panel"><summary>Backups and restore</summary><button onClick={()=>download('qs-easy-backup.json',JSON.stringify(portfolio),'application/json')}>Export workspace backup</button>
  <button onClick={()=>{try{const data=JSON.parse(localStorage.getItem(backupKey)||'null');if(!isPortfolio(data))throw Error('No automatic backup available.');if(confirm('Restore the previous saved workspace?'))commit(data,true)}catch(e){setMessage(String(e))}}}>Restore previous save</button>
  <label>Restore backup file<input type="file" accept=".json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const data=JSON.parse(await f.text());if(!isPortfolio(data))throw Error('Invalid backup.');if(confirm('Replace your workspace with this backup?'))commit(data,true)}catch(err){setMessage(String(err))}}}/></label></details></>:
  <div key={project.id}><header className="project no-print"><div><small>PROJECT</small><h1>{project.name}</h1><p>{project.description}</p></div></header>
  {view==='Overview' && <Dashboard project={project} open={navigate}/>}
  {view==='Bill of quantities' && <BoQ project={project} setProject={setProject}/>}
  {view==='Variation ledger' && <Variations project={project} setProject={setProject}/>}
  {['Take-off calculator','Unit rate build-up'].includes(view) && <SurveyTool key={view} mode={view==='Take-off calculator'?'takeoff':'rate'} onAdd={item=>setProject(p=>({...p,items:[...p.items,item]}))}/>}
  {['Valuations','Cost forecast','Cash flow','Risks','Tender comparison'].includes(view) && <Commercial key={view} view={view} p={project} save={save}/>}
  {['Rate library','Site diary','Documents','Spreadsheets'].includes(view) && <DataTools key={view} view={view} p={project} rates={portfolio.rates} save={p=>{if(!save(p))throw Error('Project update could not be saved.')}} saveRates={rates=>{if(!commit({...latest.current,rates}))throw Error('Rates could not be saved.')}}/>}
  {view==='QS review' && <Review p={project}/>}
  {view==='Cost report' && <><ReportSettings p={project} save={save}/><ReportView project={project}/></>}
  </div>}</main></div></div>
}
function ReportSettings({p,save}:{p:Project;save:(p:Project)=>void}){
  return <details className="panel no-print"><summary>Report details and branding</summary><Entry fields={Object.entries({company:'Company',client:'Client',reference:'Project number',period:'Reporting period',author:'Prepared by',comments:'Comments',approval:'Approval'}).map(([key,label])=>({key,label,optional:true,value:p.report?.[key as keyof NonNullable<Project['report']>]}))} action="Save report details" submit={v=>save({...p,report:{company:v.company,client:v.client,reference:v.reference,period:v.period,author:v.author,comments:v.comments,approval:v.approval}})}/></details>
}

const pounds = (value: number) => value.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2, minimumFractionDigits: 0 })

function Dashboard({ project, open }: {project: Project, open: (view: 'boq' | 'variations' | 'takeoff' | 'rate') => void}) {
  const m = calculateMetrics(project)
  const breakdown = new Map<string, number>()
  for (const item of project.items) breakdown.set(item.category, (breakdown.get(item.category) || 0) + item.quantity * item.unitRate)
  const pending = project.variations.filter(v => v.status === 'Pending')
  return <div className="overview"><section className="hero"><div><small>ADJUSTED CONTRACT VALUE</small>
    <strong>{pounds(m.totalContractValue)}</strong><p>Base bill plus approved variations</p></div>
    <div className="progress"><span>Bill completion by value</span><b>{Math.round(m.totalProgressPercent)}%</b><progress max="100" value={m.totalProgressPercent}/></div></section>
    <div className="stats">{[['Base bill',m.totalBaseCost],['Approved variations',m.totalVariations],['Measured work to date',m.estimatedSpend]].map(([label,value]) => <section key={label} className="panel"><small>{label}</small><strong>{pounds(Number(value))}</strong></section>)}</div>
    <div className="details"><section className="panel"><h2>Cost by work category</h2>{breakdown.size === 0 && <p>Add a bill item to see the breakdown.</p>}
    {[...breakdown].sort((a,b) => b[1]-a[1]).map(([name,cost]) => <div className="cost-row" key={name}><span>{name}</span><b>{pounds(cost)}</b><progress max="100" value={m.totalBaseCost > 0 ? 100*cost/m.totalBaseCost : 0}/></div>)}
    <button className="link" onClick={() => open('boq')}>Open bill of quantities →</button></section>
    <section className="panel"><h2>Pending variations</h2><strong>{pounds(pending.reduce((sum,v) => sum+v.impactAmount,0))}</strong><p>{pending.length} awaiting approval</p>
    <button className="link" onClick={() => open('variations')}>Review ledger →</button></section></div>
    <h2>Measurement &amp; pricing</h2><div className="shortcuts"><button onClick={() => open('takeoff')}><b>Take-off calculator ↗</b><span>Measure lengths, areas and volumes</span></button><button onClick={() => open('rate')}><b>Unit rate build-up ↗</b><span>Price materials, labour and plant</span></button></div>
  </div>
}

function BoQ({ project, setProject }: { project: Project, setProject: React.Dispatch<React.SetStateAction<Project>> }) {
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('Preliminaries');
  const [newUnit, setNewUnit] = useState('m2');
  const [newQty, setNewQty] = useState<number>(0);
  const [newRate, setNewRate] = useState<number>(0);
  const [newProg, setNewProg] = useState<number>(0);

  const addItem = () => {
    if (!newDesc.trim() || newQty < 0 || newRate < 0 || newProg < 0 || newProg > 100 || !newUnit.trim()) {window.alert('Enter a description, unit, non-negative quantity and rate, and progress from 0 to 100%.');return}
    if(project.items.some(i=>i.description.trim().toLowerCase()===newDesc.trim().toLowerCase()) && !confirm('An item has this description. Add another?'))return;
    const newItem: BoQItem = {
      id: Math.random().toString(36).substring(2, 9),
      description: newDesc,
      category: newCategory,
      unit: newUnit,
      quantity: newQty,
      unitRate: newRate,
      progress: newProg,
    };
    setProject({ ...project, items: [...project.items, newItem] });
    setNewDesc(''); setNewQty(0); setNewRate(0); setNewProg(0);
  };

  const updateItem = (id: string, updates: Partial<BoQItem>) => {
    setProject({ ...project, items: project.items.map(i => i.id === id ? { ...i, ...updates } : i) });
  };

  const removeItem = (id: string) => {
    setProject({ ...project, items: project.items.filter(i => i.id !== id) });
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm">
      <h3 className="text-2xl font-bold mb-6">Bill of Quantities</h3>
      {project.items.some(i=>i.unitRate===0) && <p>Check pricing: one or more bill items have a zero rate.</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8 p-6 bg-slate-50 rounded-xl border">
        <label>Description<input className="col-span-2 md:col-span-3 p-2 border rounded" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></label>
        <label>Category<select className="p-2 border rounded" value={newCategory} onChange={(e) => setNewCategory(e.target.value as Category)}>
          <option value="Preliminaries">Preliminaries</option>
          <option value="Substructure">Substructure</option>
          <option value="Superstructure">Superstructure</option>
          <option value="Finishes">Finishes</option>
          <option value="Services">Services</option>
          <option value="Other">Other</option>
        </select></label>
        <label>Unit<input className="p-2 border rounded" placeholder="Unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} /></label>
        <label>Quantity<input className="p-2 border rounded" type="number" placeholder="Qty" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} /></label>
        <label>Rate (£)<input className="p-2 border rounded" type="number" placeholder="Rate" value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} /></label>
        <label>Progress (%)<input className="p-2 border rounded" type="number" placeholder="Prog" value={newProg} onChange={(e) => setNewProg(Number(e.target.value))} /></label>
        <button onClick={addItem} className="bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">Add Item</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 border">Description</th>
              <th className="p-3 border">Category</th>
              <th className="p-3 border">Unit</th>
              <th className="p-3 border">Qty</th>
              <th className="p-3 border">Rate</th>
              <th className="p-3 border">Total</th>
              <th className="p-3 border">Progress</th>
              <th className="p-3 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {project.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="p-2 border"><input className="w-full bg-transparent" value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} /></td>
                <td className="p-2 border">
                  <select className="w-full bg-transparent" value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value as Category })}>
                    <option value="Preliminaries">Preliminaries</option>
                    <option value="Substructure">Substructure</option>
                    <option value="Superstructure">Superstructure</option>
                    <option value="Finishes">Finishes</option>
                    <option value="Services">Services</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="p-2 border"><input className="w-full bg-transparent" value={item.unit} onChange={(e) => updateItem(item.id, { unit: e.target.value })} /></td>
                <td className="p-2 border"><input className="w-full bg-transparent" type="number" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(0,Number(e.target.value)) })} /></td>
                <td className="p-2 border"><input className="w-full bg-transparent" type="number" value={item.unitRate} onChange={(e) => updateItem(item.id, { unitRate: Math.max(0,Number(e.target.value)) })} /></td>
                <td className="p-2 border font-bold">£{(item.quantity * item.unitRate).toLocaleString()}</td>
                <td className="p-2 border">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px]"><span className="text-slate-500">{item.progress}%</span><span className="text-slate-500">£{(item.quantity * item.unitRate * (item.progress / 100)).toLocaleString()}</span></div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                    </div>
                    <input className="w-full bg-transparent text-[10px]" type="number" value={item.progress} onChange={(e) => updateItem(item.id, { progress: Math.max(0,Math.min(100,Number(e.target.value))) })} />
                  </div>
                </td>
                <td className="p-2 border text-center"><button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700">Delete</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              <td colSpan={5} className="p-3 border text-right">Grand Total:</td>
              <td className="p-3 border">£{project.items.reduce((acc, item) => acc + (item.quantity * item.unitRate), 0).toLocaleString()}</td>
              <td colSpan={2} className="p-3 border"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Variations({ project, setProject }: { project: Project, setProject: React.Dispatch<React.SetStateAction<Project>> }) {
  const [newDesc, setNewDesc] = useState('');
  const [newImpact, setNewImpact] = useState<number>(0);
  const [newStatus, setNewStatus] = useState<Variation['status']>('Pending');

  const addVariation = () => {
    if (!newDesc) return;
    setProject({ ...project, variations: [...project.variations, { id: Math.random().toString(36).substring(2, 9), description: newDesc, impactAmount: newImpact, date: new Date().toISOString().split('T')[0], status: newStatus }] });
    setNewDesc(''); setNewImpact(0);
  };

  const updateVariation = (id: string, updates: Partial<Variation>) => {
    setProject({ ...project, variations: project.variations.map(v => v.id === id ? { ...v, ...updates } : v) });
  };

  const removeVariation = (id: string) => {
    setProject({ ...project, variations: project.variations.filter(v => v.id !== id) });
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm">
      <h3 className="text-2xl font-bold mb-6">Variation Ledger</h3>
      <div className="stats">{(["Pending","Approved","Rejected"] as const).map(status=><div className="panel" key={status}><small>{status}</small><strong>{pounds(project.variations.filter(v=>v.status===status).reduce((sum,v)=>sum+v.impactAmount,0))}</strong></div>)}</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-xl border">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
          <input className="w-full p-2 border rounded" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Impact Amount (£)</label>
          <input className="w-full p-2 border rounded" type="number" value={newImpact} onChange={(e) => setNewImpact(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
          <select className="w-full p-2 border rounded" value={newStatus} onChange={(e) => setNewStatus(e.target.value as Variation['status'])}>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <button onClick={addVariation} className="md:col-span-4 bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700">Add Variation</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3 border">Submission and evidence</th>
              <th className="p-3 border">Description</th>
              <th className="p-3 border">Impact</th>
              <th className="p-3 border">Status</th>
              <th className="p-3 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {project.variations.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td><details><summary>{v.reference || v.date || 'Variation details'}</summary><label>Reference<input value={v.reference||''} onChange={e=>updateVariation(v.id,{reference:e.target.value})}/></label><label>Submitted<input type="date" value={v.date} onChange={e=>updateVariation(v.id,{date:e.target.value})}/></label><label>Contractor quotation (£)<input type="number" step="any" value={v.quotation??''} onChange={e=>updateVariation(v.id,{quotation:e.target.value===''?undefined:Number(e.target.value)})}/></label><label>Approval date<input type="date" value={v.approvedOn||''} onChange={e=>updateVariation(v.id,{approvedOn:e.target.value})}/></label><label>Supporting notes<textarea value={v.notes||''} onChange={e=>updateVariation(v.id,{notes:e.target.value})}/></label></details></td>
                <td className="p-2 border"><input className="w-full bg-transparent" value={v.description} onChange={(e) => updateVariation(v.id, { description: e.target.value })} /></td>
                <td className={`p-2 border font-bold ${v.impactAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {v.impactAmount >= 0 ? '+' : ''}£{v.impactAmount.toLocaleString()}
                  <input className="ml-2 w-16 bg-transparent text-right" type="number" value={v.impactAmount} onChange={(e) => updateVariation(v.id, { impactAmount: Number(e.target.value) })} />
                </td>
                <td className="p-2 border">
                  <select className={`w-full p-1 rounded border ${v.status === 'Approved' ? 'bg-green-50' : v.status === 'Rejected' ? 'bg-red-50' : 'bg-yellow-50'}`} value={v.status} onChange={(e) => updateVariation(v.id, { status: e.target.value as Variation['status'] })}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </td>
                <td className="p-2 border text-center"><button onClick={() => removeVariation(v.id)} className="text-red-500">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportView({ project }: { project: Project }) {
  const metrics = calculateMetrics(project);
  return (
    <div className="bg-white p-12 rounded-xl shadow-lg max-w-4xl mx-auto border">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-900">Project Cost Summary</h1>
        {project.report && <div>{Object.entries({Company:project.report.company,Client:project.report.client,Reference:project.report.reference,Period:project.report.period,"Prepared by":project.report.author,Comments:project.report.comments,Approval:project.report.approval}).filter(([,v])=>v).map(([k,v])=><p key={k}><b>{k}</b> · {v}</p>)}</div>}
        <p className="text-slate-500 mt-2">{project.name}</p>
        <p className="text-slate-400 italic">{project.description}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="p-4 bg-slate-50 rounded border">
          <p className="text-xs uppercase text-slate-400">Total Contract</p>
          <p className="text-xl font-bold">£{metrics.totalContractValue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded border">
          <p className="text-xs uppercase text-slate-400">Approved variations</p>
          <p className={`text-xl font-bold ${metrics.totalVariations >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.totalVariations >= 0 ? '+' : ''}£{metrics.totalVariations.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded border">
          <p className="text-xs uppercase text-slate-400">Measured work</p>
          <p className="text-xl font-bold text-green-600">£{metrics.estimatedSpend.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded border">
          <p className="text-xs uppercase text-slate-400">Balance to value</p>
          <p className="text-xl font-bold text-orange-600">£{metrics.remainingBudget.toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-10">
        <h3 className="text-xl font-bold mb-4 border-b pb-2">Bill of Quantities Summary</h3>
        <table className="w-full text-left">
          <thead className="text-sm text-slate-500">
            <tr>
              <th className="pb-2">Description</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Unit Rate</th>
              <th className="pb-2">Total</th>
              <th className="pb-2">Progress</th>
            </tr>
          </thead>
          <tbody>
            {project.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.quantity} {item.unit}</td>
                <td className="py-2">£{item.unitRate}</td>
                <td className="py-2 font-semibold">£{(item.quantity * item.unitRate).toLocaleString()}</td>
                <td className="py-2">{item.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-10">
        <h3 className="text-xl font-bold mb-4 border-b pb-2">Variation Ledger</h3>
        <table className="w-full text-left">
          <thead className="text-sm text-slate-500">
            <tr>
              <th className="pb-2">Description</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {project.variations.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="py-2">{v.description}</td>
                <td className={`py-2 font-bold ${v.impactAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {v.impactAmount >= 0 ? '+' : ''}£{v.impactAmount.toLocaleString()}
                </td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    v.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                    v.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {v.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-12 no-print">
        <button 
          onClick={() => window.print()} 
          className="bg-slate-800 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-slate-900 transition"
        >
          Print Report
        </button>
      </div>
    </div>
  );
}
