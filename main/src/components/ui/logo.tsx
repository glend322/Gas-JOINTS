import { cn } from '@/lib/utils';

/** Tanda ISYARA (sama dengan landing page). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" className="fill-brand-50" />
      <g className="fill-brand-600">
        <rect x="7" y="15" width="3" height="9" rx="1.5" />
        <rect x="11.5" y="10" width="3" height="14" rx="1.5" />
        <rect x="16" y="7" width="3" height="17" rx="1.5" />
        <rect x="20.5" y="10.5" width="3" height="13.5" rx="1.5" />
      </g>
      <circle cx="26" cy="15" r="1.8" className="fill-brand-400" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-8" />
      <span className="text-[0.9375rem] font-extrabold tracking-[0.14em] text-brand-900">ISYARA</span>
    </span>
  );
}
