import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

/**
 * Gerbang rute (Requirement 9). Dashboard dan Kiosk hanya boleh dibuka bila ada
 * sesi petugas yang valid. Rute yang diminta disimpan di state lokasi agar setelah
 * login berhasil petugas dikembalikan ke tujuan semula.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Sesi masih dipulihkan dari penyimpanan: jangan redirect dulu agar reload
  // halaman pada sesi yang valid tidak terlempar ke login.
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-tint" role="status" aria-live="polite">
        <span className="text-sm font-semibold text-muted">Memuat sesi…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Rute tujuan disimpan agar login berhasil mengembalikan petugas ke sini.
    // Alasan sesi berakhir tidak dikirim lewat sini: Login_Page membacanya dari
    // AuthContext supaya petugas yang memang belum login tidak melihat pesan
    // "sesi berakhir" yang menyesatkan.
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <>{children}</>;
}
