// Team colour palette for charts — brand-neutral, high-contrast, colour-blind
// friendly ordering. Recharts lines/bars cycle through these.
export const TEAM_COLORS = [
  '#16a34a', // green
  '#2563eb', // blue
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#0d9488', // teal
  '#9333ea', // purple
  '#4f46e5', // indigo
  '#ca8a04', // gold
  '#e11d48', // rose
  '#0284c7', // sky
  '#059669', // emerald
  '#c026d3', // fuchsia
  '#84cc16', // green-lime
  '#f59e0b', // amber-bright
  '#14b8a6', // teal-bright
  '#8b5cf6', // violet-bright
  '#ef4444', // red-bright
]

export function teamColor(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length]
}

export const EVENT_TITLE = 'Hiking Team Challenge Poonagala - 2026'
