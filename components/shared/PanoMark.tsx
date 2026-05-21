interface Props {
  className?: string
  spin?: boolean
}

export function PanoMark({ className, spin }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`${className ?? ''}${spin ? ' animate-spin' : ''}`}
      style={spin ? { animationDuration: '2s' } : undefined}
    >
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="2" y="30.4" width="60" height="3.2" fill="#d97757" />
      <circle cx="32" cy="32" r="1.4" fill="currentColor" />
    </svg>
  )
}
