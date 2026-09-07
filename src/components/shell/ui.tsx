import type { ReactNode } from 'react'

/**
 * Shared primitives. Deliberately small — this is an instrument, not a kit.
 *
 * Panel titles are sentence case at a real reading size. An earlier pass had
 * every heading as tracked-out capitals in monospace, which is decoration
 * pretending to be structure: it makes six panels shout equally instead of
 * letting weight and space say which one matters. Monospace is now reserved
 * for machine output — callsigns, clocks, coordinates.
 */

export function Panel({
  title,
  meta,
  children,
  tone = 'quiet',
  grow = false,
  tour,
}: {
  title: string
  meta?: ReactNode
  children: ReactNode
  /** `alert` raises the rule and the count when the panel needs an answer. */
  tone?: 'quiet' | 'alert'
  /** The last panel in a rail absorbs the leftover height. */
  grow?: boolean
  /** Anchor name for the guided walkthrough spotlight. */
  tour?: string
}) {
  return (
    <section
      data-tour={tour}
      className={`flex min-h-0 flex-col bg-[#17140f] ${grow ? 'flex-1' : 'shrink-0'}`}
    >
      <header
        className="flex shrink-0 items-baseline justify-between gap-2 border-b px-3.5 pb-2 pt-2.5"
        style={{ borderColor: tone === 'alert' ? '#dc9a3f' : '#2b2620' }}
      >
        <h2 className="text-[13px] font-semibold text-[#f4efe7]">{title}</h2>
        {meta !== undefined && (
          <span
            className="tnum shrink-0 text-[12px]"
            style={{ color: tone === 'alert' ? '#dc9a3f' : '#9a8f80' }}
          >
            {meta}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

/** A quiet in-panel heading. Sentence case, carried by colour and size. */
export function Label({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-medium text-[#9a8f80]">{children}</p>
}

export function Meter({
  value,
  tone = 'neutral',
}: {
  value: number
  tone?: 'neutral' | 'warn' | 'bad'
}) {
  const color = tone === 'bad' ? '#e0565c' : tone === 'warn' ? '#dc9a3f' : '#7d7365'
  return (
    <div className="h-[3px] w-full overflow-hidden bg-[#2b2620]">
      <div
        className="h-full transition-[width] duration-300"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }}
      />
    </div>
  )
}

export function Tag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'warn' | 'bad' | 'good'
}) {
  const map = {
    neutral: 'border-[#3a342c] text-[#b9af9f]',
    warn: 'border-[#dc9a3f]/55 text-[#dc9a3f]',
    bad: 'border-[#e0565c]/55 text-[#e0565c]',
    good: 'border-[#62ab82]/55 text-[#62ab82]',
  }
  return (
    <span className={`inline-block border px-1.5 py-px text-[11px] leading-tight ${map[tone]}`}>
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  ...rest
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'ghost' | 'solid'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'px-2.5 py-1.5 text-[12.5px] transition-colors disabled:opacity-40'
  const style =
    variant === 'solid'
      ? 'bg-[#f4efe7] text-[#17140f] font-medium hover:bg-white'
      : 'border border-[#3a342c] text-[#e8e1d6] hover:border-[#554d43] hover:bg-[#201c17]'
  return (
    <button className={`${base} ${style}`} onClick={onClick} {...rest}>
      {children}
    </button>
  )
}

/** An empty screen is an invitation to act, not a shrug. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-3.5 py-4 text-[12.5px] leading-relaxed text-[#9a8f80]">{children}</p>
}
