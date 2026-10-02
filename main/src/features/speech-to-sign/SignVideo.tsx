import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP } from '@/config/app.config';
import { getSkeletonClip, SkeletonPlayer } from '@/features/skeleton-animation';
import { KaraokeText, SignAvatar } from './SpeechAnimations';

/**
 * Pemutar isyarat untuk pasien (PRD-FE §5). Teks frasa SELALU tampil berdampingan.
 * Urutan sumber: 1) video asli (videoUrl)  2) animasi kerangka asli (folder skeleton-animation)
 *                3) placeholder avatar (gerakan ilustrasi, bukan isyarat yang benar)
 */
type Props = { phraseId: string | null; text: string; videoUrl: string | null | undefined; onDone: () => void };

export function SignVideo({ phraseId, text, videoUrl, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const skeleton = videoUrl ? null : getSkeletonClip(phraseId);
  const mode = videoUrl ? 'video' : skeleton ? 'skeleton' : 'placeholder';

  // Placeholder: progres buatan.
  useEffect(() => {
    if (mode !== 'placeholder') return;
    setProgress(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / APP.placeholderVideoMs);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else doneRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, run, text]);

  const replay = () => {
    if (videoUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
    }
    setProgress(0);
    setRun((r) => r + 1);
  };

  const badge = mode === 'skeleton' ? 'Animasi isyarat · rekaman WL-BISINDO' : mode === 'placeholder' ? 'Video BISINDO · placeholder' : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-4 rounded-3xl bg-brand-900 p-3 text-white sm:grid-cols-[1.2fr_1fr] sm:items-center sm:p-4"
      data-result="playing"
      data-sign-source={mode}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-800">
        {mode === 'video' && (
          <video
            ref={videoRef}
            src={videoUrl!}
            autoPlay
            muted
            playsInline
            className="size-full object-cover"
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
            onEnded={() => doneRef.current()}
            aria-label={`Video isyarat BISINDO: ${text}`}
          />
        )}
        {mode === 'skeleton' && (
          <SkeletonPlayer clip={skeleton!} run={run} onProgress={setProgress} onDone={() => doneRef.current()} className="absolute inset-0 size-full p-3" />
        )}
        {mode === 'placeholder' && (
          <div className="relative size-full" role="img" aria-label={`Placeholder video isyarat: ${text}`}>
            <SignAvatar text={text} durationMs={APP.placeholderVideoMs} run={run} />
          </div>
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-100">{badge}</span>
        )}
        <span className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand-200" style={{ width: `${progress * 100}%` }} />
        </span>
      </div>

      <div className="px-2 pb-2 sm:px-0 sm:pb-0">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-200">Petugas menyampaikan</p>
        <KaraokeText text={text} progress={progress} />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4">
          <Button variant="soft" onClick={replay} className="bg-white/10 text-white hover:bg-white/20">
            <RotateCcw /> Ulangi {mode === 'video' ? 'video' : 'isyarat'}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
