import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initialsOf } from '../AuthContext';

/**
 * Avatar petugas berupa inisial dalam lingkaran (bukan foto).
 * Dipakai di Identity_Card dashboard dan di header kiosk.
 * Nama kosong → ikon netral, tanpa error render (Requirement 10).
 */
export function InitialsAvatar({ name, className, textClassName }: { name?: string | null; className?: string; textClassName?: string }) {
  const initials = initialsOf(name);

  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full bg-brand-100 font-extrabold text-brand-800', className)}
    >
      {initials ? <span className={textClassName}>{initials}</span> : <UserRound className="size-1/2 text-brand-600" />}
    </span>
  );
}
