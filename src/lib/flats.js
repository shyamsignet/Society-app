// Flat numbering, flat ids and tower labels – shared by the setup wizard,
// the admin Flats screen and the spreadsheet import.

// Numbering styles offered in the setup wizard. `floor` is the storey number
// stored on the flat (ground floor = 0); `n` is the flat's position on that floor;
// `serial` counts flats within the tower, `global` across the whole society.
export const NUMBERING = [
  { value: 'tower-floor', label: 'A-101, A-102 … (floors start at 1)', sample: 'A-101' },
  { value: 'tower-ground', label: 'A-G01 … A-101 (ground floor = G)', sample: 'A-G01' },
  { value: 'floor', label: '101, 102 … (no tower in the number)', sample: '101' },
  { value: 'tower-serial', label: 'A-1, A-2, A-3 … (running number per tower)', sample: 'A-1' },
  { value: 'serial', label: '1, 2, 3 … (running number for the whole society)', sample: '1' }
]

const two = (n) => String(n).padStart(2, '0')

export function flatNumber(style, { tower, floor, n, serial, global }) {
  const t = tower ? `${tower}-` : ''
  switch (style) {
    case 'tower-ground': return `${t}${floor === 0 ? 'G' : floor}${two(n)}`
    case 'floor': return `${floor === 0 ? 'G' : floor}${two(n)}`
    case 'tower-serial': return `${t}${serial}`
    case 'serial': return String(global)
    default: return `${t}${floor}${two(n)}`
  }
}

// Lay out every flat for the towers entered in the wizard.
// tower = { code, floors, perFloor, type, area }
export function generateFlats(towers, style) {
  const out = []
  let global = 0
  for (const t of towers) {
    const code = cleanTower(t.code)
    const floors = Number(t.floors) || 0
    const perFloor = Number(t.perFloor) || 0
    const firstFloor = style === 'tower-ground' ? 0 : 1
    let serial = 0
    for (let i = 0; i < floors; i++) {
      const floor = firstFloor + i
      for (let n = 1; n <= perFloor; n++) {
        serial++; global++
        const number = flatNumber(style, { tower: code, floor, n, serial, global })
        out.push({ number, tower: code, floor, type: t.type, area: Number(t.area) || 0, occupancy: 'owner' })
      }
    }
  }
  return out
}

export const cleanTower = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 12)

// "A 101", "a-101 " → "A-101"; keeps any other format as typed (upper-cased).
export const normFlatNumber = (s) => String(s || '').trim().toUpperCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ')
export const flatKey = (s) => normFlatNumber(s).replace(/[\s-]+/g, '')

// Stable record id for a flat. Ids never change when a flat is renamed, so a
// new flat may not reuse an id that an older (renamed) flat still holds.
export function newFlatId(number, takenIds) {
  const base = 'apt_' + (normFlatNumber(number).replace(/[^A-Z0-9-]+/g, '_') || 'flat')
  let id = base
  for (let i = 2; takenIds.has(id); i++) id = `${base}_${i}`
  return id
}

// "A" → "Tower A"; longer names ("ROSE", "SHOPS", "WING 1") are shown as they are.
export const towerLabel = (code) => (!code ? '' : /^[A-Z0-9]{1,2}$/.test(code) ? `Tower ${code}` : code.charAt(0) + code.slice(1).toLowerCase())

export const sortFlats = (a, b) => String(a.tower || '').localeCompare(String(b.tower || ''), undefined, { numeric: true }) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
export const sortTowers = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })
