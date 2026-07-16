// Small shared display primitives used across the results directions.

export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flex: 'none',
      }}
    />
  )
}

/** A colored dot + mono cabin abbreviation, the encoding used everywhere. */
export function CabinTag({
  abbr,
  dot,
  size = 11.5,
}: {
  abbr: string
  dot: string
  size?: number
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--mono)',
        fontSize: size,
        fontWeight: 500,
      }}
    >
      <Dot color={dot} />
      {abbr}
    </span>
  )
}

/** A small "mixed cabins across the stopover" marker. */
export function MixTag() {
  return (
    <span
      title="mixed cabins across the stopover (premium on the long segment, economy on the hop)"
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--warn)',
        background: 'var(--warn-tint)',
        border: '1px solid var(--warn)',
        borderRadius: 4,
        padding: '0 4px',
        letterSpacing: '0.04em',
      }}
    >
      MIX
    </span>
  )
}

/** Per-leg cabin sequence for any number of legs, e.g. BUS → ECO → PRM.
 *  A leg whose segments span >1 cabin (mixed across a stopover) gets a MIX tag. */
export function CabinSeq({
  flow,
}: {
  flow: { abbr: string; dot: string; mixed?: boolean }[]
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {flow.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && (
            <span style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>→</span>
          )}
          <CabinTag abbr={c.abbr} dot={c.dot} />
          {c.mixed && <MixTag />}
        </span>
      ))}
    </span>
  )
}

/** cabin → cabin flow, e.g. BUS → ECO. */
export function CabinFlow({
  c1abbr,
  c1dot,
  c2abbr,
  c2dot,
}: {
  c1abbr: string
  c1dot: string
  c2abbr: string
  c2dot: string
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <CabinTag abbr={c1abbr} dot={c1dot} />
      <span style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>→</span>
      <CabinTag abbr={c2abbr} dot={c2dot} />
    </span>
  )
}

/** The green "LIVE · duffel" status used in the results app bars. */
export function LiveStatus({ label = 'LIVE · duffel' }: { label?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--mono)',
        fontSize: 11.5,
        color: 'var(--pos)',
      }}
    >
      <Dot color="var(--pos)" />
      {label}
    </span>
  )
}

/** Results app-bar status: distinguishes the demo, a mock run, and live Duffel. */
export function StatusBadge({ kind }: { kind: 'sample' | 'mock' | 'live' }) {
  if (kind === 'live') return <LiveStatus />
  const label = kind === 'mock' ? 'mock prices' : 'sample data'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--mono)',
        fontSize: 11.5,
        color: 'var(--faint)',
      }}
    >
      <Dot color="var(--faint)" />
      {label}
    </span>
  )
}
