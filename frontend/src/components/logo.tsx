export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Workflow"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 11.5h6.5a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3H23"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 20.5h4"
        stroke="currentColor"
        className="text-primary-foreground/60"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="9"
        cy="11.5"
        r="2.25"
        className="fill-primary-foreground"
      />
    </svg>
  )
}
