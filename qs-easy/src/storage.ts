import type { Portfolio, Project } from './types'

export const workspaceKey = 'qs_easy_portfolio_v1'
export const backupKey = workspaceKey + '_previous'
const originalExample: Project = {
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
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,v]) => [key,sorted(v)]))
  return value
}
type RecordData = Record<string,unknown>
const record = (v:unknown):v is RecordData => Boolean(v && typeof v==='object' && !Array.isArray(v))
const string = (v:unknown) => typeof v==='string'
const number = (v:unknown) => typeof v==='number' && Number.isFinite(v)
function fields(value:unknown,text:string[],numbers:string[]=[]){
  return record(value) && text.every(k=>string(value[k])) && numbers.every(k=>number(value[k]))
}
function list(v:unknown,test:(v:RecordData)=>boolean){
  return Array.isArray(v) && v.every(row=>record(row) && test(row))
}
function validProject(p:RecordData){
  if(!fields(p,['id','name','description']) || !list(p.items,i=>fields(i,['id','description','category','unit'],['quantity','unitRate','progress'])) ||
    !list(p.variations,v=>fields(v,['id','description','date','status'],['impactAmount']) && ['Approved','Pending','Rejected'].includes(String(v.status))))return false
  const schemas:[string,string[],string[]][]=[
    ['valuations',['id','period'],['work','materials','changes','retention','previous','due']],
    ['costs',['id','name'],['budget','committed','actual','remaining']],
    ['risks',['id','name','kind','owner','mitigation'],['impact','probability']],
    ['quotes',['id','contractor','itemId','exclusions','qualifications'],['rate']],
    ['notes',['id','date','itemId','note'],['progress']]
  ]
  if(schemas.some(([key,text,numbers])=>p[key]!==undefined && !list(p[key],v=>fields(v,text,numbers))))return false
  if(p.documents!==undefined && !list(p.documents,d=>fields(d,['id','name','data','date','target']) && /^data:[^,]*;base64,/.test(String(d.data))))return false
  if(p.programme!==undefined && !(record(p.programme) && /^\d{4}-(0[1-9]|1[0-2])$/.test(String(p.programme.start)) && Number.isInteger(p.programme.months) && Number(p.programme.months)>=1 && Number(p.programme.months)<=360))return false
  if(record(p.programme) && p.programme.weights!==undefined){
    const weights=p.programme.weights
    if(!Array.isArray(weights)||weights.length!==p.programme.months||weights.some(w=>!number(w)||w<0)||Math.abs(weights.reduce((s,n)=>s+n,0)-100)>0.000001)return false
  }
  if(p.report!==undefined && !(record(p.report) && Object.values(p.report).every(string)))return false
  return true
}
export function isPortfolio(value:unknown):value is Portfolio {
  return record(value) && list(value.projects,validProject) && list(value.rates,r=>fields(r,['id','description','unit','supplier','region','date'],['amount']))
}
export function loadPortfolio(): Portfolio {
  const current = localStorage.getItem(workspaceKey)
  if (current) {
    const data: unknown = JSON.parse(current)
    if (!isPortfolio(data)) throw Error('Saved workspace could not be read.')
    return data
  }
  const old = JSON.parse(localStorage.getItem('qs_easy_project_data') || 'null')
  const projects = old && JSON.stringify(sorted(old)) !== JSON.stringify(sorted(originalExample)) ? [old] : []
  const migrated = { projects, rates: [] }
  if (!isPortfolio(migrated)) throw Error('Saved project could not be read.')
  return migrated
}
export function download(name:string, data:BlobPart, type:string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export const gbp = (n:number) => n.toLocaleString('en-GB',{style:'currency',currency:'GBP'})
export const today = () => new Date().toLocaleDateString('en-CA')
