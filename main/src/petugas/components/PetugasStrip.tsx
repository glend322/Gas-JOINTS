import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { InitialsAvatar } from './InitialsAvatar';

const MAX_NAME = 24;

/**
 * Identitas petugas di pojok kanan atas kiosk + jalan kembali ke Dashboard
 * (Requirement 10).
 *
 * Ditempatkan pada barisnya sendiri di atas baris tombol header supaya posisi
 * "Panggil JBI" tidak bergeser sedikit pun — PRD mewajibkan tombol itu selalu
 * berada di tempat yang sama.
 */
export function PetugasStrip() {
  const { profile } = useAuth();
  if (!profile) return null;

  const full = profile.name?.trim() ?? '';
  const shown = full.length > MAX_NAME ? `${full.slice(0, MAX_NAME).trimEnd()}…` : full;

  return (
    <div className="flex h-9 items-center justify-end border-b border-line/70 px-4 md:px-6">
      <Link
        to="/dashboard"
        aria-label={`Petugas ${full || 'belum dikenali'}. Kembali ke Dashboard Petugas.`}
        className="group -mr-1.5 flex max-w-full items-center gap-2 rounded-full px-1.5 py-0.5 transition-colors hover:bg-brand-50"
      >
        <span className="truncate text-xs font-bold text-brand-800">{shown || 'Petugas'}</span>
        <InitialsAvatar name={profile.name} className="size-6 text-[0.5625rem]" />
        <ChevronRight className="size-4 shrink-0 text-brand-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
