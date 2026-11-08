import React, { useState, useEffect } from 'react';
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
  const totalVariations = project.variations.reduce((acc, v) => acc + v.impactAmount, 0);
  const totalContractValue = totalBaseCost + totalVariations;

  const totalProgressWeight = project.items.reduce((acc, item) => {
    const itemCost = item.quantity * item.unitRate;
    return acc + (itemCost * (item.progress / 100));
  }, 0);

  const totalProgressPercent = project.items.length > 0 
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'boq' | 'variations' | 'report'>('dashboard');
  const [project, setProject] = useState<Project>(initialProject);

  // 1. Load data from LocalStorage when the app starts
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setProject(parsed);
      } catch (e) {
        console.error("Failed to parse saved project data", e);
      }
    }
  }, []);

  // 2. Save data to LocalStorage automatically every time the project state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }, [project]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-900 text-white p-6 flex flex-col shadow-xl no-print">
        <h1 className="text-2xl font-bold mb-8 tracking-tight">QS-Easy</h1>
        <nav className="space-y-2">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`block w-full text-left p-3 rounded transition ${currentView === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentView('boq')}
            className={`block w-full text-left p-3 rounded transition ${currentView === 'boq' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
          >
            Bill of Quantities
          </button>
          <button 
            onClick={() => setCurrentView('variations')}
            className={`block w-full text-left p-3 rounded transition ${currentView === 'variations' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
          >
            Variations
          </button>
          <button 
            onClick={() => setCurrentView('report')}
            className={`block w-full text-left p-3 rounded transition ${currentView === 'report' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
          >
            Print Report
          </button>
        </nav>
        <div className="mt-auto text-xs text-slate-500">
          v1.0 MVP
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-10">
        <header className="mb-8 flex justify-between items-center">
          <div className="no-print">
            <h2 className="text-3xl font-extrabold text-slate-800">{project.name}</h2>
            <p className="text-slate-500">{project.description}</p>
          </div>
          {currentView !== 'report' && (
             <button 
              onClick={() => {
                if(confirm("Are you sure? This will reset your current project data.")) {
                  setProject(initialProject);
                }
              }}
              className="text-xs bg-slate-200 px-3 py-1 rounded hover:bg-red-100 transition"
             >
              Reset Project
             </button>
          )}
        </header>

        <main>
          {currentView === 'dashboard' && <Dashboard project={project} />}
          {currentView === 'boq' && <BoQ project={project} setProject={setProject} />}
          {currentView === 'variations' && <Variations project={project} setProject={setProject} />}
          {currentView === 'report' && <ReportView project={project} />}
        </main>
      </div>
      
      {/* Print Styling */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .flex-1 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}

// --- Sub-components ---

function Dashboard({ project }: { project: Project }) {
  const metrics = calculateMetrics(project);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-blue-500">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Contract Value</h3>
          <p className="text-3xl font-bold text-slate-800">£{metrics.totalContractValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-red-500">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Variation Impact</h3>
          <p className="text-3xl font-bold text-red-600">{metrics.totalVariations >= 0 ? '+' : ''}£{metrics.totalVariations.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-green-500">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Estimated Spend</h3>
          <p className="text-3xl font-bold text-green-600">£{metrics.estimatedSpend.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-orange-500">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Remaining Budget</h3>
          <p className="text-3xl font-bold text-orange-600">£{metrics.remainingBudget.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-xl shadow-sm">
          <h3 className="text-xl font-bold mb-6">Project Progress Overview</h3>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <span className="text-xs font-bold text-blue-600">Completion Status</span>
              <span className="text-xs font-bold text-blue-600">{Math.round(metrics.totalProgressPercent)}%</span>
            </div>
            <div className="overflow-hidden h-6 mb-4 text-xs flex rounded bg-slate-100">
              <div 
                style={{ width: `${metrics.totalProgressPercent}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap justify-center bg-blue-600 text-white transition-all duration-1000"
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm">
          <h3 className="text-xl font-bold mb-6">Financial Breakdown</h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-600">Base Contract</span>
              <span className="font-bold">£{metrics.totalBaseCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-slate-600">Variations</span>
              <span className="font-bold text-red-600">{metrics.totalVariations >= 0 ? '+' : ''}£{metrics.totalVariations.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-xl font-bold">Grand Total</span>
              <span className="text-xl font-bold text-blue-600">£{metrics.totalContractValue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
        <input className="col-span-2 md:col-span-3 p-2 border rounded" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        <select className="p-2 border rounded" value={newCategory} onChange={(e) => setNewCategory(e.target.value as Category)}>
          <option value="Preliminaries">Preliminaries</option>
          <option value="Substructure">Substructure</option>
          <option value="Superstructure">Superstructure</option>
          <option value="Finishes">Finishes</option>
          <option value="Services">Services</option>
          <option value="Other">Other</option>
        </select>
        <input className="p-2 border rounded" placeholder="Unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
        <input className="p-2 border rounded" type="number" placeholder="Qty" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} />
        <input className="p-2 border rounded" type="number" placeholder="Rate" value={newRate} onChange={(e) => setNewRate(Number(e.target.value))} />
        <input className="p-2 border rounded" type="number" placeholder="Prog" value={newProg} onChange={(e) => setNewProg(Number(e.target.value))} />
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
          <p className="text-xs uppercase text-slate-400">Variations</p>
          <p className={`text-xl font-bold ${metrics.totalVariations >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.totalVariations >= 0 ? '+' : ''}£{metrics.totalVariations.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-slate-50 rounded border">
          <p className="text-xs uppercase text-slate-400">Est. Spend</p>
          <p className="text-xl font-bold text-green-600">£{metrics.estimatedSpend.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded border">
          <p className="text-xs uppercase text-slate-400">Remaining</p>
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