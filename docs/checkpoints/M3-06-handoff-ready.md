# M3-06-handoff-ready

Waktu: 2026-10-27T18:00:36.559Z
Fase: M3
Status: **local-verified-runtime-production-browser-gates-pending**

## Hasil

M3 diimplementasikan dan terverifikasi lokal: adapter CAMS global, cache seri persisten/checksum/bucket, lease/coalescing/cooldown/fallback, API udara, limiter sliding gabungan/budget, panel PM2.5/indeks/riwayat/prakiraan/grafik/tabel dan sumber. Pemulihan arsip M3-05 berhasil. Produksi/R2/lifecycle/identitas/paket, konektivitas fetch runtime aplikasi dan browser/FPS tetap pending; tidak ada deployment atau aktivasi workflow. M4 rekomendasi masih tahap berikutnya.

## Verifikasi

npm run verify -- M3 lulus: 224 test/14 berkas, check:env, typecheck, build 4 halaman + /api/hotspots dan /api/air, pemeriksaan HTML dan CLI fixture. npm run replay:air lulus pada bukti publik historis 120 sampel dan cache sementara; bukan integrasi runtime. Arsip M3-05 dipulihkan ke folder kosong tanpa .next/research/rahasia; 125 checksum/workflow/exclusion terverifikasi, typecheck dan seluruh test lulus menggunakan node_modules symlink (bukan clean install). Laporan M3-air.json, M3-open-meteo-replay.json, M3-handoff-recovery.json serta M3-build-assets.json pada docs/verification.

## Selanjutnya

Mulai M4 dengan checkpoint M4-00: GET /api/recommendations harus mengambil AirService server yang sama dan consume limiter namespace air/actions yang sama, bukan mempercayai AQI browser. Hubungkan ActionPanel/AudienceSelector untuk general/sensitive/outdoor; validasi lokasi/dataVersion/forTime/validUntil, mode limited saat stale/partial/unavailable/indeks hilang dan pergantian jam/tab/lokasi. Uji handler, semua kategori/audience dan konsistensi panel, lalu checkpoint subfase/full verify. Jangan menandai runtime/produksi/browser lulus tanpa bukti; setelah M4 lanjut M5/M6. Handoff: baca AGENTS.md dan CHECKPOINT.md; pasang dependency sesuai lockfile lalu npm run verify -- M3. Replay opsional memerlukan research terpisah.

[Manifest](./M3-06-handoff-ready.json) · [Source archive](./M3-06-handoff-ready.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
