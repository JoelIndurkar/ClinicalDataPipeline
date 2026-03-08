import { useState, useEffect } from 'react'

// Design choices:
// - hand-rolled SVG gives full control over layout and avoids the black-box rendering
// - p-val badge lives inside each PopChart
//   originally had them in a detached row below all charts but was visually unclear
// - grid uses auto-fit so charts reflow to mult rows on narrow screens instead of scrolling
// - fixed-col grid (like repeat(5, 1fr)) overflows at ~800px card width

interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

function calcStats(vals: number[]): BoxStats {
  const sorted = [...vals].sort((a, b) => a - b)
  const n = sorted.length
  return {
    min: sorted[0],
    q1: sorted[Math.floor(n * 0.25)],
    median: sorted[Math.floor(n * 0.5)],
    q3: sorted[Math.floor(n * 0.75)],
    max: sorted[n - 1],
  }
}

interface PopVals {
  responder: number[]
  non_responder: number[]
}

interface PopStat {
  pValue: number
  significant: boolean
}

const popLabels: Record<string, string> = {
  b_cell:    'B Cell',
  cd4_t_cell:'CD4 T Cell',
  cd8_t_cell:'CD8 T Cell',
  nk_cell:   'NK Cell',
  monocyte:  'Monocyte',
}

function sigAsterisks(p: number): string {
  if (p < 0.001) return '***'
  if (p < 0.01)  return '**'
  if (p < 0.05)  return '*'
  return 'ns'
}

const SVG_H = 170
const SVG_W = 130
const PAD = { top: 8, right: 6, bottom: 22, left: 26 }
const plotH = SVG_H - PAD.top - PAD.bottom
const plotW = SVG_W - PAD.left - PAD.right

// maps a data value to a y pixel coordinate
// SVG y=0 is at the top so invert: higher values = smaller y
function makeScale(domainMin: number, domainMax: number, height: number, padTop: number) {
  return (val: number) =>
    padTop + height - ((val - domainMin) / (domainMax - domainMin)) * height
}

interface SingleBoxProps {
  stats: BoxStats
  cx: number
  boxW: number
  scale: (v: number) => number
  color: string
}

function SingleBox({ stats, cx, boxW, scale, color }: SingleBoxProps) {
  const q1Y  = scale(stats.q1)
  const q3Y  = scale(stats.q3)
  const medY = scale(stats.median)
  const minY = scale(stats.min)
  const maxY = scale(stats.max)
  const half = boxW / 2
  const capW = boxW * 0.32

  return (
    <g>
      <line x1={cx} y1={q3Y} x2={cx} y2={maxY} stroke={color} strokeWidth={1.5} />
      <line x1={cx - capW} y1={maxY} x2={cx + capW} y2={maxY} stroke={color} strokeWidth={1.5} />
      <rect
        x={cx - half} y={q3Y}
        width={boxW} height={Math.max(1, q1Y - q3Y)}
        fill={color} fillOpacity={0.18}
        stroke={color} strokeWidth={1.5}
        rx={2}
      />
      <line x1={cx - half} y1={medY} x2={cx + half} y2={medY} stroke={color} strokeWidth={2.5} />
      <line x1={cx} y1={q1Y} x2={cx} y2={minY} stroke={color} strokeWidth={1.5} />
      <line x1={cx - capW} y1={minY} x2={cx + capW} y2={minY} stroke={color} strokeWidth={1.5} />
    </g>
  )
}

// click on any PopChart to open modal -> show expanded SVG + quartile table + p-value
// reuses SingleBox so the rendering is identical between the small cards and the modal
function BoxplotModal({ popKey, vals, stat, onClose }: {
  popKey: string
  vals: PopVals
  stat: PopStat
  onClose: () => void
}) {
  const rVals  = vals.responder
  const nVals  = vals.non_responder
  const rStats = calcStats(rVals)
  const nStats = calcStats(nVals)
  const isSig  = stat.significant
  const asterisks = sigAsterisks(stat.pValue)

  const M_H = 300
  const M_W = 280
  const M_PAD = { top: 16, right: 16, bottom: 40, left: 44 }
  const mPlotH = M_H - M_PAD.top - M_PAD.bottom
  const mPlotW = M_W - M_PAD.left - M_PAD.right

  const allVals = [rStats.min, nStats.min, rStats.max, nStats.max]
  const domainMin = Math.floor(Math.min(...allVals) * 0.85)
  const domainMax = Math.ceil(Math.max(...allVals) * 1.15)
  const scale = makeScale(domainMin, domainMax, mPlotH, M_PAD.top)

  const tickCount = 5
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    domainMin + (i / (tickCount - 1)) * (domainMax - domainMin)
  )

  const boxW = mPlotW * 0.22
  const rCx  = M_PAD.left + mPlotW * 0.30
  const nCx  = M_PAD.left + mPlotW * 0.70

  // n row shows sample count per group - useful context for interpreting p-values
  // percentage rows formatted to 2dp, n row is integer
  const fmt = (label: string, val: number) => label === 'n' ? String(val) : val.toFixed(2)
  const statRows: { label: string; r: number; n: number }[] = [
    { label: 'Min',    r: rStats.min,    n: nStats.min },
    { label: 'Q1',     r: rStats.q1,     n: nStats.q1 },
    { label: 'Median', r: rStats.median, n: nStats.median },
    { label: 'Q3',     r: rStats.q3,     n: nStats.q3 },
    { label: 'Max',    r: rStats.max,    n: nStats.max },
    { label: 'n',      r: rVals.length,  n: nVals.length },
  ]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,20,30,0.52)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        animation: 'modalFadeIn 0.18s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)',
          padding: '28px 32px',
          maxWidth: 620,
          width: 'calc(100vw - 48px)',
          animation: 'modalSlideIn 0.2s ease',
          position: 'relative',
        }}
      >
        {/* close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 6, width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-tertiary)',
            fontSize: 14, lineHeight: 1,
            transition: 'all var(--transition)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--row-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)' }}
        >
          x
        </button>

        {/* header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            marginBottom: 4,
          }}>
            Cell Population
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {popLabels[popKey] ?? popKey}
          </div>
        </div>

        {/* main content: boxplot + table side by side */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* larger boxplot */}
          <div style={{ flex: '0 0 auto' }}>
            <svg width={M_W} height={M_H} viewBox={`0 0 ${M_W} ${M_H}`} style={{ display: 'block' }}>
              {ticks.map((t, i) => {
                const y = scale(t)
                return (
                  <g key={i}>
                    <line
                      x1={M_PAD.left} y1={y}
                      x2={M_PAD.left + mPlotW} y2={y}
                      stroke="var(--border)" strokeWidth={1}
                    />
                    <text x={M_PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
                      {t.toFixed(1)}
                    </text>
                  </g>
                )
              })}
              <text x={rCx} y={M_H - 10} textAnchor="middle" fontSize={11} fill="var(--data-blue)" fontWeight={700}>R</text>
              <text x={nCx} y={M_H - 10} textAnchor="middle" fontSize={11} fill="var(--not-significant)" fontWeight={700}>NR</text>
              <SingleBox stats={rStats} cx={rCx} boxW={boxW} scale={scale} color="var(--data-blue)" />
              <SingleBox stats={nStats} cx={nCx} boxW={boxW} scale={scale} color="var(--not-significant)" />
            </svg>
          </div>

          {/* right panel: p-value + quartile table */}
          <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* prominent p-value */}
            <div style={{
              padding: '14px 18px',
              borderRadius: 8,
              background: isSig ? 'var(--significant-light)' : 'var(--bg)',
              border: `1px solid ${isSig ? 'rgba(5,150,105,0.25)' : 'var(--border)'}`,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: isSig ? '#059669' : 'var(--text-tertiary)' }}>
                Mann-Whitney U
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  color: isSig ? '#059669' : 'var(--text-secondary)',
                }}>
                  p = {stat.pValue < 0.001 ? stat.pValue.toExponential(1) : stat.pValue.toFixed(4)}
                </span>
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isSig ? '#059669' : 'var(--text-tertiary)',
                }}>
                  {asterisks}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: isSig ? '#059669' : 'var(--text-tertiary)' }}>
                {isSig ? 'Statistically significant' : 'Not significant'}
              </div>
            </div>

            {/* quartile table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
                    Stat
                  </th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--data-blue)', borderBottom: '1px solid var(--border)' }}>
                    R
                  </th>
                  <th style={{ textAlign: 'right', padding: '5px 8px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--not-significant)', borderBottom: '1px solid var(--border)' }}>
                    NR
                  </th>
                </tr>
              </thead>
              <tbody>
                {statRows.map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < statRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: row.label === 'Median' ? 600 : 400 }}>
                      {row.label}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)', fontWeight: row.label === 'Median' ? 700 : 400 }}>
                      {fmt(row.label, row.r)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--text-primary)', fontWeight: row.label === 'Median' ? 700 : 400 }}>
                      {fmt(row.label, row.n)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function PopChart({ popKey, vals, stat, onClick }: {
  popKey: string
  vals: PopVals
  stat: PopStat
  onClick: () => void
}) {
  const rStats = calcStats(vals.responder)
  const nStats = calcStats(vals.non_responder)

  const allVals = [rStats.min, nStats.min, rStats.max, nStats.max]
  const domainMin = Math.floor(Math.min(...allVals) * 0.85)
  const domainMax = Math.ceil(Math.max(...allVals) * 1.15)
  const scale = makeScale(domainMin, domainMax, plotH, PAD.top)

  const tickCount = 4
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    domainMin + (i / (tickCount - 1)) * (domainMax - domainMin)
  )

  const boxW = plotW * 0.24
  const rCx = PAD.left + plotW * 0.30
  const nCx = PAD.left + plotW * 0.70

  const asterisks = sigAsterisks(stat.pValue)
  const isSig = stat.significant

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        cursor: 'pointer',
        borderRadius: 8,
        padding: '6px 4px',
        transition: 'transform 200ms ease',
        transform: 'scale(1)',
        // scale-up on hover signals clickability without needing a visible button
      }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)'}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'}
      title={`Click to expand ${popLabels[popKey] ?? popKey}`}
    >
      {/* population label */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {popLabels[popKey] ?? popKey}
      </div>

      {/* the box plot SVG */}
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: 'block' }}>
        {ticks.map((t, i) => {
          const y = scale(t)
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y}
                x2={PAD.left + plotW} y2={y}
                stroke="var(--border)" strokeWidth={1}
              />
              <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="var(--text-tertiary)">
                {t.toFixed(1)}
              </text>
            </g>
          )
        })}
        <text x={rCx} y={SVG_H - 5} textAnchor="middle" fontSize={8.5} fill="var(--data-blue)" fontWeight={600}>R</text>
        <text x={nCx} y={SVG_H - 5} textAnchor="middle" fontSize={8.5} fill="var(--not-significant)" fontWeight={600}>NR</text>
        <SingleBox stats={rStats} cx={rCx} boxW={boxW} scale={scale} color="var(--data-blue)" />
        <SingleBox stats={nStats} cx={nCx} boxW={boxW} scale={scale} color="var(--not-significant)" />
      </svg>

      {/* p-value badge directly under this chart so association is always clear */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 4,
        background: isSig ? 'var(--significant-light)' : 'var(--bg)',
        border: `1px solid ${isSig ? 'rgba(5,150,105,0.2)' : 'var(--border)'}`,
        fontSize: 11,
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10.5,
          color: isSig ? '#059669' : 'var(--text-tertiary)',
        }}>
          p = {stat.pValue < 0.001 ? stat.pValue.toExponential(1) : stat.pValue.toFixed(4)}
        </span>
        {/* asterisk notation is the standard convention in clinical publications */}
        <span style={{
          fontWeight: 700,
          fontSize: isSig ? 13 : 11,
          color: isSig ? '#059669' : 'var(--text-tertiary)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {asterisks}
        </span>
      </div>
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

export default function BoxplotSection() {
  const [boxplotData, setBoxplotData] = useState<Record<string, PopVals> | null>(null)
  const [statsData, setStatsData] = useState<Record<string, PopStat> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPop, setSelectedPop] = useState<string | null>(null)

  useEffect(() => {
    // fetch both endpoints in parallel, both req for basic render
    Promise.all([
      fetch('/api/boxplot-data').then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
    ])
      .then(([bpData, statsArr]) => {
        setBoxplotData(bpData)
        // convert array from /api/stats -> record keyed by pop for cache lookup
        const statsRecord: Record<string, PopStat> = {}
        for (const s of statsArr) {
          statsRecord[s.population] = { pValue: s.p_value, significant: s.significant }
        }
        setStatsData(statsRecord)
        setLoading(false)
      })
      .catch(() => setError('Failed to load boxplot data'))
  }, [])

  const pops = boxplotData ? Object.keys(boxplotData) : ['b_cell', 'cd4_t_cell', 'cd8_t_cell', 'nk_cell', 'monocyte']

  if (error) {
    return <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{error}</div>
  }

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <Shimmer width={200} height={14} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
          {pops.map(pop => (
            <div key={pop} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Shimmer width="60%" height={10} />
              <Shimmer width="100%" height={170} />
              <Shimmer width="80%" height={24} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* card header */}
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Cell Population Distribution
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
          Click any chart to expand details
        </div>
      </div>

      {/* auto-fit: charts reflow to 2-3 rows on narrow screens instead of scrolling */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 20,
        marginBottom: 20,
      }}>
        {pops.map(pop => (
          <PopChart
            key={pop}
            popKey={pop}
            vals={boxplotData![pop]}
            stat={statsData![pop]}
            onClick={() => setSelectedPop(pop)}
          />
        ))}
      </div>

      {/* legend */}
      <div style={{
        display: 'flex',
        gap: 20,
        justifyContent: 'center',
        paddingTop: 16,
        borderTop: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--data-blue)' }} />
          Responder (R)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--not-significant)' }} />
          Non-Responder (NR)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span style={{ fontWeight: 700, color: '#059669' }}>*</span>
          <span>p&lt;0.05</span>
          <span style={{ fontWeight: 700, color: '#059669', marginLeft: 6 }}>**</span>
          <span>p&lt;0.01</span>
          <span style={{ marginLeft: 4, color: 'var(--text-tertiary)' }}>ns = not significant</span>
        </div>
      </div>

      {/* modal - only rendered when a pop is selected */}
      {selectedPop && boxplotData && statsData && (
        <BoxplotModal
          popKey={selectedPop}
          vals={boxplotData[selectedPop]}
          stat={statsData[selectedPop]}
          onClose={() => setSelectedPop(null)}
        />
      )}
    </div>
  )
}
