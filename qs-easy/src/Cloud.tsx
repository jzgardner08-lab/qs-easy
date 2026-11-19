import { useState } from 'react'
import type { Project } from './types'
import { isPortfolio } from './storage'

const url=(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/,'')
const key=import.meta.env.VITE_SUPABASE_ANON_KEY
type Account={access_token:string;user:{id:string}}
type Row={id:string;owner_id:string;editors:string[];revision:number;project:Project}
export function Cloud({project,receive}:{project?:Project;receive:(p:Project)=>void}){
  const [account,setAccount]=useState<Account|null>(null)
  const [rows,setRows]=useState<Row[]>([])
  const [known,setKnown]=useState<Record<string,number>>({})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  async function request(path:string,method:string,body?:unknown,token=account?.access_token){
    const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined})
    const data=await r.json().catch(()=>null)
    if(!r.ok) throw Error(data?.message || data?.msg || 'Cloud request failed. Sign in again if your session expired.')
    return data
  }
  async function run(task:()=>Promise<void>){setBusy(true);setMessage('');try{await task()}catch(e){setMessage(e instanceof Error?e.message:'Request failed.')}finally{setBusy(false)}}
  const refresh=async(token?:string)=>setRows(await request('/rest/v1/qs_projects?select=*','GET',undefined,token))
  return <section className="panel"><h2>Cloud projects</h2>{!url||!key ? <p>The site owner can enable accounts and shared projects by connecting Supabase in the deployment settings.</p> : <fieldset disabled={busy}>
    {!account ? <form onSubmit={e=>{
      e.preventDefault();const v=new FormData(e.currentTarget);const signup=(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='signup'
      void run(async()=>{const a=await request(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password','POST',{email:v.get('email'),password:v.get('password')})
        if(!a.access_token){setMessage('Check your email to confirm your account, then sign in.');return}
        setAccount(a);await refresh(a.access_token)})
    }}><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button>Sign in</button> <button value="signup">Create account</button></form> : <>
    <button onClick={()=>void run(async()=>{await request('/auth/v1/logout','POST');setAccount(null);setRows([]);setKnown({})})}>Sign out</button> <button onClick={()=>void run(()=>refresh())}>Refresh list</button>
    {project && <button onClick={()=>void run(async()=>{
      const existing=rows.find(r=>r.id===project.id)
      if(existing && known[existing.id]===undefined) throw Error('Open the cloud copy before updating it. Export a local backup first if you need both versions.')
      const result:Row[]=existing ? await request('/rest/v1/qs_projects?id=eq.'+encodeURIComponent(project.id)+'&revision=eq.'+known[project.id],'PATCH',{project,revision:known[project.id]+1}) : await request('/rest/v1/qs_projects','POST',{id:project.id,owner_id:account.user.id,project})
      if(!result.length) throw Error('This project changed on another device. Back up your changes and open the latest copy.')
      setKnown({...known,[project.id]:result[0].revision});await refresh();setMessage('Saved to cloud.')
    })}>Save current project to cloud</button>}
    {rows.map(row=><article key={row.id}><h3>{row.project.name}</h3><button onClick={()=>{
      if(!isPortfolio({projects:[row.project],rates:[]})) {setMessage('Invalid cloud project.');return}
      if(confirm('Open this cloud version? It replaces any local copy of this project.')) {receive(row.project);setKnown({...known,[row.id]:row.revision})}
    }}>Open cloud copy</button>
    {row.owner_id===account.user.id && <form onSubmit={e=>{e.preventDefault();const editors=String(new FormData(e.currentTarget).get('editors')).split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
      void run(async()=>{const updated=await request('/rest/v1/qs_projects?id=eq.'+encodeURIComponent(row.id)+'&revision=eq.'+row.revision,'PATCH',{editors,revision:row.revision+1});if(!updated.length) throw Error('Refresh and review the latest sharing settings.');if(known[row.id]===row.revision)setKnown({...known,[row.id]:updated[0].revision});await refresh();setMessage('Sharing updated.')})
    }}><label>Editor emails, comma separated<input name="editors" key={row.editors.join(',')} defaultValue={row.editors.join(', ')}/></label><button>Update access</button></form>}</article>)}</>}
    </fieldset>}<p role="status">{message}</p></section>
}
