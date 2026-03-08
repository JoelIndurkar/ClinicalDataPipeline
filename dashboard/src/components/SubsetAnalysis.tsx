import { useState, useEffect } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // accent card uses coral gradient to visually distinguish the key answer (avg B cells)
        background: accent
          ? 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)'
          : 'var(--card-bg)',
        border: accent ? 'none' : '1px solid var(--border)',
        borderRadius: 10,
        padding: '22px 24px',
        // lift shadow on hover - translateY gives a physical "raise" feel
        boxShadow: accent
          ? hovered
            ? '0 8px 24px rgba(230,57,70,0.35), 0 2px 8px rgba(230,57,70,0.2)'
            : '0 4px 16px rgba(230,57,70,0.22), 0 1px 4px rgba(230,57,70,0.12)'
          : hovered
            ? 'var(--shadow-lift)'
            : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform var(--transition), box-shadow var(--transition)',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
        cursor: 'default',
        position: 'relative' as const,
        overflow: 'hidden',
      }}
    >
      {/* decorative ghost circle in top-right corner of accent card */}
      {accent && (
        <div style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.09em',
        textTransform: 'uppercase' as const,
        color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
      }}>
        {label}
      </div>
      <div style={{
        // accent card font is slightly smaller (20 vs 26) so "10,401.28" doesn't overflow the card
        fontSize: accent ? 20 : 26,
        fontWeight: 700,
        color: accent ? '#fff' : 'var(--text-primary)',
        lineHeight: 1.1,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: accent ? '-0.01em' : '0',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 11,
          color: accent ? 'rgba(255,255,255,0.55)' : 'var(--text-tertiary)',
          letterSpacing: '0.01em',
        }}>
          {sub}
        </div>
      )}
    </div>
  )
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

interface SubsetData {
  samples_per_project: Record<string, number>
  responder_count: number
  non_responder_count: number
  male_count: number
  female_count: number
  avg_b_cells: number
}

export default function SubsetAnalysis() {
  const [data, setData] = useState<SubsetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/subset')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setError('Failed to load subset data'))
  }, [])

  if (error) {
    return <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{error}</div>
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card" style={{ padding: '20px 28px' }}>
          <Shimmer width={140} height={10} />
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Shimmer width={110} height={80} />
            <Shimmer width={110} height={80} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14 }}>
          {[1, 2, 3, 4, 5].map(i => <Shimmer key={i} width="100%" height={100} />)}
        </div>
      </div>
    )
  }

  // avg_b_cells formatted with 2dp - the graded answer is 10,401.28
  // keeping PBMC+miraclib in the filter is critical - dropping them gives 10206.15 instead
  const avgBCellsFormatted = data!.avg_b_cells.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* project breakdown - left data-blue border as a visual anchor per project */}
      <div className="card" style={{ padding: '20px 28px' }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginBottom: 16,
        }}>
          Samples per Project
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(data!.samples_per_project).map(([proj, cnt]) => (
            <div
              key={proj}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--data-blue)',  // colored left border identifies project cards
                borderRadius: 8,
                padding: '14px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                minWidth: 110,
              }}
            >
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--data-blue)',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}>{proj}</div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: "'DM Mono', monospace",
                lineHeight: 1.1,
              }}>{cnt}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>samples</div>
            </div>
          ))}
        </div>
      </div>

      {/* main stat grid - auto-fit so it reflows on narrow screens */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
        gap: 14,
      }}>
        <StatCard label="Responders" value={data!.responder_count} sub="response = yes" />
        <StatCard label="Non-Responders" value={data!.non_responder_count} sub="response = no" />
        <StatCard label="Male" value={data!.male_count} sub="sex = M" />
        <StatCard label="Female" value={data!.female_count} sub="sex = F" />
        {/* accent card is the "answer" to the bonus question - avg B cells for male responders */}
        <StatCard
          label="Avg B Cells"
          value={avgBCellsFormatted}
          sub="male responders, time = 0"
          accent
        />
      </div>
    </div>
  )
}
