/** URL aplikasi kiosk (folder `main`). Atur lewat VITE_KIOSK_URL di .env saat deploy. */
export const KIOSK_URL: string = import.meta.env.VITE_KIOSK_URL || 'http://localhost:5174/';
