// Catalogue of common society facilities, used to pre-fill the "Add facility" form.
// [name, emoji, slotHours (24 = full day), charge ₹, requiresApproval, opens, closes, capacity]
export const FACILITY_CATALOGUE = [
  ['Clubhouse', '🏛️', 2, 0, false, 9, 22, 30],
  ['Gym', '🏋️', 1, 0, false, 6, 22, 12],
  ['Swimming Pool', '🏊', 1, 0, false, 6, 21, 20],
  ['Community Hall', '🎉', 4, 3000, true, 9, 22, 150],
  ['Party Hall', '🥳', 3, 1500, true, 10, 23, 60],
  ['Badminton Court', '🏸', 1, 0, false, 6, 22, 4],
  ['Tennis Court', '🎾', 1, 0, false, 6, 21, 4],
  ['Table Tennis', '🏓', 1, 0, false, 8, 22, 4],
  ['Indoor Games Room', '🎱', 1, 0, false, 9, 22, 10],
  ['Kids Play Area', '🛝', 1, 0, false, 8, 20, 20],
  ['Yoga / Meditation Room', '🧘', 1, 0, false, 5, 21, 15],
  ['Mini Theatre', '🎬', 3, 500, true, 10, 23, 25],
  ['Guest Room', '🛏️', 24, 1500, true, 12, 12, 2],
  ['Rooftop / Terrace', '🌇', 2, 500, true, 9, 22, 40],
  ['Barbecue Area', '🍖', 3, 500, true, 11, 23, 20],
  ['Library / Reading Room', '📚', 2, 0, false, 8, 21, 15],
  ['Business Centre', '💼', 2, 0, false, 8, 21, 8],
  ['Cricket Practice Net', '🏏', 1, 0, false, 6, 21, 6]
].map(([name, emoji, slotHours, charge, requiresApproval, open, close, capacity]) => ({ name, emoji, slotHours, charge, requiresApproval, open, close, capacity }))

export const hourLabel = (h) => (h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`)
