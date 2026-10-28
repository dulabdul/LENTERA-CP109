import type { Metadata } from 'next';
import { HotspotMonitor } from '@/components/map/HotspotMonitor';
import 'maplibre-gl/dist/maplibre-gl.css';
export const metadata: Metadata = {
  title: 'Peta Interaktif Hotspot & Kualitas Udara',
  description:
    'Peta interaktif deteksi titik panas satelit NASA FIRMS VIIRS (24 jam, 48 jam, 7 hari), visualisasi heatmap sebaran kabut panas, dan model kualitas udara PM2.5 di seluruh Indonesia.',
  alternates: {
    canonical: '/peta',
  },
  openGraph: {
    title: 'Peta Interaktif Hotspot & Kualitas Udara | LENTERA',
    description:
      'Pantau sebaran titik panas satelit NASA VIIRS dan estimasi kualitas udara PM2.5 real-time di seluruh wilayah Indonesia.',
    url: '/peta',
  },
};
export default function MapPage() { return <main id="main" className="page-section monitor-page"><HotspotMonitor/></main>; }
