import { useState } from 'react'
import type { BoQItem, Category } from './types'

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const categories: Category[] = ['Preliminaries','Substructure','Superstructure','Finishes','Services','Other']

function Field({ label, value, change, min = 0, step = 'any' }: {
  label: string, value: string, change: (value: string) => void, min?: number, step?: string
}) {
  return <label>{label}<input required type="number" min={min} step={step} value={value} onChange={e => change(e.target.value)} /></label>
}

export function SurveyTool({ mode, onAdd }: { mode: 'takeoff' | 'rate', onAdd: (item: BoQItem) => void }) {
  const measuring = mode === 'takeoff'
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('Substructure')
  const [dimension, setDimension] = useState('Area')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [depth, setDepth] = useState('')
  const [count, setCount] = useState('1')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('m²')
  const [rate, setRate] = useState('0')
  const [labour, setLabour] = useState('0')
  const [materials, setMaterials] = useState('0')
  const [plant, setPlant] = useState('0')
  const [markup, setMarkup] = useState('0')
  const [message, setMessage] = useState('')
  const measuredUnit = dimension === 'Length' ? 'm' : dimension === 'Area' ? 'm²' : 'm³'
  const itemUnit = measuring ? measuredUnit : unit.trim()
  const quantity = measuring ? Number(count) * Number(length) * (dimension === 'Length' ? 1 : Number(width)) * (dimension === 'Volume' ? Number(depth) : 1) : Number(qty)
  const directCost = Number(labour) + Number(materials) + Number(plant)
  const unitRate = measuring ? Number(rate) : Math.round((directCost * (1 + Number(markup) / 100) + Number.EPSILON) * 100) / 100
  const total = quantity * unitRate
  return <section className="tool panel">
    <h2>{measuring ? 'Take-off calculator' : 'Unit rate build-up'}</h2>
    <p>{measuring ? 'Measure repeated lengths, areas or volumes and add the result to your bill.' : 'Build a rate from costs per unit, then price the measured quantity.'}</p>
    <form onChange={() => setMessage('')} onSubmit={e => {
      e.preventDefault()
      if (!description.trim() || !itemUnit || quantity <= 0 || !Number.isFinite(total)) {
        setMessage('Enter a description, unit and positive quantity to add this item.')
        return
      }
      onAdd({ id: crypto.randomUUID(), description: description.trim(), category, unit: itemUnit, quantity, unitRate, progress: 0 })
      setMessage(description.trim() + ' added to the bill of quantities.')
      setDescription('')
    }}>
      <div className="fields"><label>Description<input required value={description} placeholder={measuring ? 'e.g. Ground floor slab' : 'e.g. Blockwork partition'} onChange={e => setDescription(e.target.value)} /></label>
      <label>Work category<select value={category} onChange={e => setCategory(e.target.value as Category)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div>
      <div className="fields">{measuring ? <>
        <label>Measurement<select value={dimension} onChange={e => setDimension(e.target.value)}>{['Length','Area','Volume'].map(d => <option key={d}>{d}</option>)}</select></label>
        <Field label="Repetitions" min={1} step="1" value={count} change={setCount}/>
        <Field label="Length (m)" value={length} change={setLength}/>
        {dimension !== 'Length' && <Field label="Width (m)" value={width} change={setWidth}/>}
        {dimension === 'Volume' && <Field label="Depth or height (m)" value={depth} change={setDepth}/>}
        <Field label="Unit rate (£)" value={rate} change={setRate}/>
      </> : <>
        <label>Unit<input required value={unit} onChange={e => setUnit(e.target.value)} /></label>
        <Field label="Quantity" value={qty} change={setQty}/>
        <Field label="Materials (£/unit)" value={materials} change={setMaterials}/>
        <Field label="Labour (£/unit)" value={labour} change={setLabour}/>
        <Field label="Plant (£/unit)" value={plant} change={setPlant}/>
        <Field label="Overheads and profit mark-up (%)" value={markup} change={setMarkup}/>
      </>}</div>
      <div className="result"><span>{measuring ? 'Measured quantity' : 'Built-up unit rate'}<strong>{measuring ? quantity.toLocaleString('en-GB', {maximumFractionDigits:6}) + ' ' + itemUnit : money.format(unitRate) + ' / ' + itemUnit}</strong></span>
      <span>Item total<strong>{money.format(total)}</strong></span></div>
      <button className="primary">Add to bill of quantities</button><p role="status">{message}</p>
    </form>
  </section>
}
