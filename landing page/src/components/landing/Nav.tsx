import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';

const LINKS = [
  { href: '#dua-arah', label: 'Dua arah' },
  { href: '#cara-kerja', label: 'Cara kerja' },
  { href: '#jbi', label: 'JBI' },
  { href: '#kosakata', label: 'Kosakata' },
];

export function Nav() {
  return (
    <header className="fixed left-1/2 top-3 z-50 w-[min(1160px,calc(100%-24px))] -translate-x-1/2">
      <div className="flex h-14 items-center justify-between rounded-2xl border border-line/90 bg-white/80 pl-4 pr-2 backdrop-blur-xl">
        <a href="#top" aria-label="ISYARA, kembali ke atas">
          <Logo />
        </a>
        <nav aria-label="Navigasi utama" className="hidden gap-7 text-[13px] font-semibold text-brand-600 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-brand-900">
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href="#mulai"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-900 px-3.5 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-brand-800"
        >
          Lihat demo
          <Icon name="arrowUpRight" className="size-3.5" />
        </a>
      </div>
    </header>
  );
}
