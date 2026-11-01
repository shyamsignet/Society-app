import { useEffect, useMemo, useState } from 'react'
import { Field, Select } from './ui'
import { towerLabel, sortFlats, sortTowers } from '../lib/flats'

// Tower + flat chooser driven by the society's actual flats.
// With one building (or flats without a tower) only the flat list is shown.
export default function FlatPicker({ apartments, value, onChange, flatLabel = 'Flat', option = (a) => a.number, disabled = () => false }) {
  const towers = useMemo(() => [...new Set(apartments.map((a) => a.tower || ''))].filter(Boolean).sort(sortTowers), [apartments])
  const multi = towers.length > 1
  const current = apartments.find((a) => a.id === value)
  const [tower, setTower] = useState(current?.tower || towers[0] || '')
  useEffect(() => { if (multi && !towers.includes(tower)) setTower(current?.tower || towers[0]) }, [towers.join('|')])
  const flats = apartments.filter((a) => !multi || (a.tower || '') === tower).sort(sortFlats)
  const flatSelect = (
    <Field label={flatLabel}>
      <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {flats.map((a) => <option key={a.id} value={a.id} disabled={disabled(a)}>{option(a)}</option>)}
      </Select>
    </Field>
  )
  if (!multi) return flatSelect
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Tower">
        <Select value={tower} onChange={(e) => { setTower(e.target.value); onChange('') }}>
          {towers.map((t) => <option key={t} value={t}>{towerLabel(t)}</option>)}
        </Select>
      </Field>
      {flatSelect}
    </div>
  )
}
