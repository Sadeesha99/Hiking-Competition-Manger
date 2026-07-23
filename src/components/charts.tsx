// Reusable Recharts components shared by the public board and admin dashboard.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Team } from '../types'
import { teamColor } from '../lib/constants'

const AXIS = { fontSize: 11, fill: '#64748b' }

/**
 * Progression line chart — cumulative main-board total per team across events
 * in order. One line per team, labelled by team name (spec §2.3).
 */
export function ProgressionChart({
  data,
  teams,
  height = 300,
}: {
  data: Array<Record<string, number | string>>
  teams: Team[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="event" tick={AXIS} interval="preserveStartEnd" angle={-20} textAnchor="end" height={54} />
        <YAxis tick={AXIS} width={44} allowDecimals />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {teams.map((t, i) => (
          <Line
            key={t.id}
            type="monotone"
            dataKey={t.name}
            stroke={teamColor(i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Horizontal-ish bar chart of teams' totals, coloured per team. */
export function StandingsBar({
  data,
  height = 320,
}: {
  data: Array<{ name: string; total: number; index: number }>
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" tick={AXIS} />
        <YAxis type="category" dataKey="name" tick={AXIS} width={110} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={teamColor(d.index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Simple single-series bar chart (per-event breakdown, top players, etc.). */
export function SimpleBar({
  data,
  color = '#16a34a',
  height = 300,
  vertical,
}: {
  data: Array<{ name: string; value: number }>
  color?: string
  height?: number
  vertical?: boolean
}) {
  if (vertical) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={AXIS} />
          <YAxis type="category" dataKey="name" tick={AXIS} width={120} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={AXIS} angle={-20} textAnchor="end" height={54} interval={0} />
        <YAxis tick={AXIS} width={44} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
