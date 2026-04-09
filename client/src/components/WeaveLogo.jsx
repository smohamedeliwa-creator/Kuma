/* ── WeaveLogo — Weave brand mark + wordmark ─────────────────────────────── */

function WaveMark({ size = 44 }) {
  const scale = size / 44;
  return (
    <svg
      viewBox="0 0 44 36"
      width={44 * scale}
      height={36 * scale}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Arc 1 — bottom, largest, full opacity */}
      <path
        d="M 4 28 Q 22 8 40 28"
        stroke="#2EC4B6"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="1"
      />
      {/* Arc 2 — middle */}
      <path
        d="M 8 22 Q 22 8 36 22"
        stroke="#2EC4B6"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Arc 3 — top, smallest, faintest */}
      <path
        d="M 12 16 Q 22 6 32 16"
        stroke="#2EC4B6"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

/** Full logo: mark + "Weave" wordmark + "PROJECT MANAGEMENT" tagline */
export function WeaveLogo({ size = 36, className = '' }) {
  const markSize = size;
  const wordSize = Math.round(size * 0.72);
  const tagSize = 10;
  return (
    <div className={`flex items-center gap-2.5 ${className}`} style={{ userSelect: 'none' }}>
      <WaveMark size={markSize} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontSize: `${wordSize}px`,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--color-text-primary, #1A1A2E)',
          lineHeight: 1.1,
        }}>
          Weave
        </span>
        <span style={{
          fontSize: `${tagSize}px`,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#2EC4B6',
          lineHeight: 1.4,
          marginTop: '1px',
        }}>
          Project Management
        </span>
      </div>
    </div>
  );
}

/** Compact: mark + "Weave" only, no tagline */
export function WeaveLogoCompact({ size = 32, className = '' }) {
  const markSize = size;
  const wordSize = Math.round(size * 0.65);
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ userSelect: 'none' }}>
      <WaveMark size={markSize} />
      <span style={{
        fontSize: `${wordSize}px`,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--color-text-primary, #1A1A2E)',
        lineHeight: 1,
      }}>
        Weave
      </span>
    </div>
  );
}

/** Mark only */
export function WeaveLogoMark({ size = 32, className = '' }) {
  return (
    <div className={className}>
      <WaveMark size={size} />
    </div>
  );
}
