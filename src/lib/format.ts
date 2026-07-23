// Small formatting / export helpers.

export function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  // strip trailing zeros but keep up to 2 dp
  return Number(n.toFixed(2)).toString()
}

export function signed(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n)
}

export function nowStamp(): string {
  return new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.floor((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

/** Turn an array of objects into a CSV string and trigger a browser download. */
export function downloadCSV(filename: string, rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) {
    rows = [{ info: 'no data' }]
  }
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set<string>()),
  )
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
