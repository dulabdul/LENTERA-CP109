import type { Metadata } from 'next';
import { HotspotMonitor } from '@/components/map/HotspotMonitor';
import 'maplibre-gl/dist/maplibre-gl.css';
export const metadata: Metadata = { title: 'Pantau lokasi' };
export default function MapPage() { return <main id="main" className="page-section"><HotspotMonitor/></main>; }
