import React, { useState, useRef } from 'react';
import { SurveyTool } from './SurveyTool';
import type { Project, Category, Variation, BoQItem } from './types';

// --- Constants & Helpers ---
const STORAGE_KEY = 'qs_easy_project_data';

// This is the default data if no previous project is found in the browser
const initialProject: Project = {
  id: '1',
  name: 'New Commercial Building',
  description: 'Development of a 3-story retail space.',
  items: [
    { id: 'i1', description: 'Site Clearance', category: 'Preliminaries', unit: 'm2', quantity: 500, unitRate: 5, progress: 100 },
    { id: 'i2', description: 'Excavation', category: 'Substructure', unit: 'm3', quantity: 120, unitRate: 25, progress: 50 },
  ],
  variations: [
    { id: 'v1', description: 'Additional foundation depth', impactAmount: 5000, date: '2023-10-01', status: 'Approved' },
  ]
};

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
  const views = { dashboard: 'Overview', boq: 'Bill of quantities', variations: 'Variation ledger', takeoff: 'Take-off calculator', rate: 'Unit rate build-up', report: 'Cost report' } as const
  type View = keyof typeof views
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [project, updateProject] = useState<Project>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved && Array.isArray(saved.items) && Array.isArray(saved.variations)) return saved
    } catch { /* A fresh project is used when storage is unavailable. */ }
    return initialProject
  })
  const [saveError, setSaveError] = useState(false)
  const latestProject = useRef(project)
  function setProject(change: React.SetStateAction<Project>) {
    const next = typeof change === 'function' ? change(latestProject.current) : change
    latestProject.current = next
    updateProject(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaveError(false) }
    catch { setSaveError(true) }
  }
  return <div className="workspace">
    <header className="mast no-print"><div className="mast-inner"><div className="brand"><i aria-hidden="true">QS</i> QS Easy</div><span>Commercial workspace</span></div></header>
    <div className="shell"><nav className="rail no-print" aria-label="Workspace">
      {(Object.keys(views) as View[]).map(view => <button key={view} aria-current={currentView === view ? 'page' : undefined} onClick={() => setCurrentView(view)}>{views[view]}</button>)}
    </nav><main>
      <header className="project no-print"><div><small>PROJECT</small><h1>{project.name}</h1><p>{project.description}</p></div>
      <button className="reset" onClick={() => { if (confirm('Replace this project with the original example?')) setProject(initialProject) }}>Reset project</button></header>
      {saveError && <p role="alert">Browser storage is unavailable. Changes will last for this session only.</p>}
      {currentView === 'dashboard' && <Dashboard project={project} open={setCurrentView}/>}
      {currentView === 'boq' && <BoQ project={project} setProject={setProject}/>}
      {currentView === 'variations' && <Variations project={project} setProject={setProject}/>}
      {(currentView === 'takeoff' || currentView === 'rate') && <SurveyTool key={currentView} mode={currentView} onAdd={item => setProject(p => ({ ...p, items: [...p.items, item] }))}/>}
      {currentView === 'report' && <ReportView project={project}/>}
    </main></div></div>
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
    if (!newDesc) return;
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
                <td className="p-2 border"><input className="w-full bg-transparent" type="number" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })} /></td>
                <td className="p-2 border"><input className="w-full bg-transparent" type="number" value={item.unitRate} onChange={(e) => updateItem(item.id, { unitRate: Number(e.target.value) })} /></td>
                <td className="p-2 border font-bold">£{(item.quantity * item.unitRate).toLocaleString()}</td>
                <td className="p-2 border">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px]"><span className="text-slate-500">{item.progress}%</span><span className="text-slate-500">£{(item.quantity * item.unitRate * (item.progress / 100)).toLocaleString()}</span></div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                    </div>
                    <input className="w-full bg-transparent text-[10px]" type="number" value={item.progress} onChange={(e) => updateItem(item.id, { progress: Number(e.target.value) })} />
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
              <th className="p-3 border">Date</th>
              <th className="p-3 border">Description</th>
              <th className="p-3 border">Impact</th>
              <th className="p-3 border">Status</th>
              <th className="p-3 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {project.variations.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="p-2 border"><input className="w-full bg-transparent" value={v.date} onChange={(e) => updateVariation(v.id, { date: e.target.value })} /></td>
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