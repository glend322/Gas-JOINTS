type Props = { className?: string; tone?: 'light' | 'dark'; size?: 'sm' | 'md' };

/**
 * Tanda ISYARA: empat batang yang terbaca sebagai jari tangan terbuka
 * sekaligus gelombang suara, plus satu titik (landmark / sinyal).
 */
export function LogoMark({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const bg = tone === 'light' ? 'fill-brand-50' : 'fill-white/10';
  const fg = tone === 'light' ? 'fill-brand-600' : 'fill-white';
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" className={bg} />
      <g className={fg}>
        <rect x="7" y="15" width="3" height="9" rx="1.5" />
        <rect x="11.5" y="10" width="3" height="14" rx="1.5" />
        <rect x="16" y="7" width="3" height="17" rx="1.5" />
        <rect x="20.5" y="10.5" width="3" height="13.5" rx="1.5" />
      </g>
      <circle cx="26" cy="15" r="1.8" className="fill-brand-400" />
    </svg>
  );
}

export function Logo({ className = '', tone = 'light', size = 'md' }: Props) {
  const text = tone === 'light' ? 'text-brand-900' : 'text-white';
  const box = size === 'sm' ? 'size-6' : 'size-8';
  const type = size === 'sm' ? 'text-[13px]' : 'text-[15px]';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={box} tone={tone} />
      <span className={`font-extrabold tracking-[0.14em] ${type} ${text}`}>ISYARA</span>
    </span>
  );
}
