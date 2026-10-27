import type { Audience } from './contracts';
export const ACTION_SOURCE = 'https://www.airnow.gov/sites/default/files/2023-03/air-quality-guide-for-particle-pollution_0.pdf';
export const audienceLabels: Record<Audience, string> = {
  general: 'Masyarakat umum', sensitive: 'Kelompok sensitif', outdoor: 'Aktivitas luar ruang',
};
