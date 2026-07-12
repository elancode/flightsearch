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
