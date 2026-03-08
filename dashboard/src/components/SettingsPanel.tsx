// settings side panel slides in from right, overlays content
// backdrop click to close, gear icon in subnav triggers open
// dark mode uses CSS var overrides on document.documentElement

interface SettingsPanelProps {
  open: boolean
  darkMode: boolean
  onClose: () => void
  onToggleDark: () => void
}

export default function SettingsPanel({ open, darkMode, onClose, onToggleDark }: SettingsPanelProps) {
  return (
    <>
      {/* backdrop - semi-transparent, click closes panel */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      />

      {/* panel - 320px, slides from right */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 320,
          height: '100vh',
          background: 'var(--card-bg)',
          borderLeft: '1px solid var(--border)',
          zIndex: 201,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 250ms ease',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* panel header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}>
            Settings
          </span>
          {/* X close button */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 5,
              lineHeight: 1,
              fontSize: 14,
              fontWeight: 400,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
          >
            {/* X icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* panel body */}
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* dark mode toggle card */}
          <div
            onClick={onToggleDark}
            style={{
              background: 'var(--bg)',
              border: `1px solid ${darkMode ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'border-color 200ms ease',
              userSelect: 'none',
            }}
          >
            {/* moon icon */}
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: darkMode ? 'var(--accent-mid)' : 'var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 200ms ease',
              color: darkMode ? 'var(--accent)' : 'var(--text-secondary)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>

            {/* label */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                Dark Mode
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {darkMode ? 'On' : 'Off'}
              </div>
            </div>

            {/* iOS-style pill toggle */}
            <div
              style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                background: darkMode ? 'var(--accent)' : 'var(--border-strong)',
                position: 'relative',
                flexShrink: 0,
                transition: 'background 200ms ease',
              }}
            >
              {/* knob */}
              <div style={{
                position: 'absolute',
                top: 3,
                left: darkMode ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                transition: 'left 200ms ease',
              }} />
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
