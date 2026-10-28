import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LENTERA — Panas, Udara, dan Rekomendasi Karhutla',
    short_name: 'LENTERA',
    description: 'Platform pemantauan lingkungan karhutla Indonesia. Deteksi titik panas satelit NASA VIIRS, estimasi PM2.5, dan rekomendasi tindakan masyarakat.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#064e3b',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
