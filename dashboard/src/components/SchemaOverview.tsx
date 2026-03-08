import { useState, useEffect } from 'react'

// P1 - database schema overview
// combined the stat row and schema table into one card to reduce vertical footprint
// originally had them as separate cards but it took up too much space

interface TableInfo {
  name: string
  columns: string[]
  row_count: number
}

function Shimmer({ width, height }: { width: string | number; height: number }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 4,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--row-hover) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease infinite',
    }} />
  )
}

function ColChip({ name }: { name: string }) {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: "'DM Mono', monospace",
      fontSize: 10.5,
      color: 'var(--data-blue)',
      background: 'var(--data-blue-light)',
      padding: '1px 6px',
      borderRadius: 3,
      whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

export default function SchemaOverview() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/schema-info')
      .then(r => r.json())
      .then(data => {
        setTables(data.tables)
        setLoading(false)
      })
      .catch(() => setError('Failed to load schema'))
  }, [])

  if (error) {
    return (
      <div className="card" style={{ padding: '16px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
        {error}
      </div>
    )
  }

  // placeholder rows for the shimmer state - 3 rows matching the real table count
  const shimmerRows = [1, 2, 3]

  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* inline stat row */}
      <div className="schemaCards">
        {loading
          ? shimmerRows.map(i => (
              <div key={i} style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)',
              }}>
                <Shimmer width={50} height={10} />
                <Shimmer width={40} height={16} />
              </div>
            ))
          : tables.map(t => (
              <div key={t.name} style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--bg)',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--data-blue)',
                  whiteSpace: 'nowrap',
                }}>
                  {t.name}
                </span>
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                }}>
                  {t.row_count.toLocaleString()}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>rows</span>
              </div>
            ))
        }
      </div>

      {/* schema table */}
      <div className="schemaTableWrap" style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* tableLayout: fixed + colgroup so long column lists don't push the row count column off screen */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 120 }} />
            <col />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Table', 'Columns', 'Row Count'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Row Count' ? 'right' : 'left',
                  padding: '7px 14px',
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? shimmerRows.map((_, i) => (
                  <tr key={i} style={{ borderBottom: i < shimmerRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '9px 14px' }}><Shimmer width={70} height={11} /></td>
                    <td style={{ padding: '9px 14px' }}><Shimmer width="80%" height={11} /></td>
                    <td style={{ padding: '9px 14px' }}><Shimmer width={50} height={11} /></td>
                  </tr>
                ))
              : tables.map((t, i) => {
                  const isHovered = hoveredRow === t.name
                  return (
                    <tr
                      key={t.name}
                      onMouseEnter={() => setHoveredRow(t.name)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        borderBottom: i < tables.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isHovered ? 'var(--row-hover)' : 'transparent',
                        transition: 'background var(--transition)',
                      }}
                    >
                      <td style={{
                        padding: '9px 14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11.5,
                        whiteSpace: 'nowrap',
                      }}>
                        {t.name}
                      </td>
                      <td style={{
                        padding: '9px 14px',
                        // trunc by default with a gradient fade
                        // expands on hover to show all chips
                        // gradient mask approach chosen over text-overflow because chips are block elements
                        overflow: isHovered ? 'visible' : 'hidden',
                        whiteSpace: isHovered ? 'normal' : 'nowrap',
                        position: 'relative',
                      }}>
                        <div style={{
                          display: 'flex',
                          flexWrap: isHovered ? 'wrap' : 'nowrap',
                          gap: 4,
                          alignItems: 'center',
                          maskImage: isHovered ? 'none' : 'linear-gradient(to right, black 70%, transparent 100%)',
                          WebkitMaskImage: isHovered ? 'none' : 'linear-gradient(to right, black 70%, transparent 100%)',
                          transition: 'mask-image var(--transition)',
                        }}>
                          {t.columns.map(col => <ColChip key={col} name={col} />)}
                        </div>
                      </td>
                      <td style={{
                        padding: '9px 14px',
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        fontSize: 11.5,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}>
                        {t.row_count.toLocaleString()}
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
