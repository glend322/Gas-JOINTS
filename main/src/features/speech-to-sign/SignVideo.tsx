import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Hand, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP } from '@/config/app.config';

/**
 * Pemutar video isyarat BISINDO (PRD-FE §5). Teks frasa SELALU tampil berdampingan dengan video.
 * videoUrl null → placeholder beranimasi dengan durasi APP.placeholderVideoMs (sampai video Supabase tersedia).
 */
export function SignVideo({ text, videoUrl, onDone }: { text: string; videoUrl: string | null | undefined; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Placeholder: progres buatan.
  useEffect(() => {
    if (videoUrl) return;
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
  }, [videoUrl, run, text]);

  const replay = () => {
    if (videoUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
    }
    setRun((r) => r + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="grid gap-4 rounded-3xl bg-brand-900 p-3 text-white sm:grid-cols-[1.2fr_1fr] sm:items-center sm:p-4"
      data-result="playing"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-800">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            muted
            playsInline
            className="size-full object-cover"
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
            onEnded={() => doneRef.current()}
            aria-label={`Video isyarat BISINDO: ${text}`}
          />
        ) : (
          <div className="grid size-full place-items-center" role="img" aria-label={`Placeholder video isyarat: ${text}`}>
            <div className="flex items-center gap-3 text-brand-200">
              <Hand className="size-10 -scale-x-100 anim-breathe" aria-hidden="true" />
              <Hand className="size-10 anim-breathe [animation-delay:0.4s]" aria-hidden="true" />
            </div>
            <span className="absolute left-3 top-3 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-100">
              Video BISINDO · placeholder
            </span>
          </div>
        )}
        <span className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand-200" style={{ width: `${progress * 100}%` }} />
        </span>
      </div>

      <div className="px-2 pb-2 sm:px-0 sm:pb-0">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-200">Petugas menyampaikan</p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-2 text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] md:text-[2.125rem]"
        >
          {text}
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-4">
          <Button variant="soft" onClick={replay} className="bg-white/10 text-white hover:bg-white/20">
            <RotateCcw /> Ulangi video
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
