import { useState } from 'react'
import type { Field } from './fields'
export type Values = Record<string,string>
export function Entry({fields,action,submit}:{fields:Field[];action:string;submit:(v:Values)=>void}) {
  const [error,setError] = useState('')
  return <form className="entry no-print" onSubmit={e=>{
    e.preventDefault()
    const form=e.currentTarget
    const values=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]))
    try {
      if(fields.some(f=>!f.optional && !values[f.key])) throw Error('Complete the required fields.')
      submit(values); setError(''); form.reset()
    } catch(err){setError(err instanceof Error ? err.message : 'Check the values and try again.')}
  }}><div className="fields">{fields.map(f=><label key={f.key}>{f.label}{f.choices ?
    <select name={f.key} defaultValue={f.value} required={!f.optional}>{f.choices.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select> :
    <input name={f.key} type={f.type || 'text'} defaultValue={f.value} required={!f.optional} min={f.min} max={f.max} step={f.step || 'any'} />}</label>)}</div>
    <button className="primary">{action}</button>{error && <p role="alert">{error}</p>}</form>
}

export function Table({head,rows}:{head:string[];rows:React.ReactNode[][]}){
  return rows.length ? <div className="overflow-x-auto"><table><thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div> : <p className="empty">No entries yet.</p>
}
