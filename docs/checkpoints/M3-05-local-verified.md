# M3-05-local-verified

Waktu: 2026-10-27T17:59:39.337Z
Fase: M3
Status: **local-verified-runtime-production-browser-gates-pending**

## Hasil

M3 lokal selesai: Open-Meteo CAMS adapter, seri persisten gzip/checksum/bucket, lease/coalescing/cooldown/fallback, API udara, limiter gabungan/budget, panel PM2.5/indeks/riwayat/prakiraan serta grafik/tabel/sumber. Lokasi tepat/query/grid dan run nullable terpisah. Source/privasi/roadmap/setup/operasi diselaraskan. M4 rekomendasi belum terhubung. Produksi/R2/lifecycle/identitas/paket serta browser/FPS belum diverifikasi; tidak ada deployment atau workflow diaktifkan.

## Verifikasi

npm run verify -- M3 final lulus: 224 test di 14 berkas, check:env, typecheck, build 4 halaman + /api/hotspots dan /api/air, pemeriksaan HTML dan CLI fixture terisolasi. npm run replay:air lulus pada bukti publik historis 120 sampel dengan cache disk sementara dan versi dipakai ulang; bukan fetch runtime aplikasi. Laporan M3-air.json, M3-open-meteo-replay.json dan M3-build-assets.json di docs/verification. Selanjutnya arsip checkpoint ini harus diuji dipulihkan sebelum handoff final.

## Selanjutnya

Uji checksum/exclusion/workflow dan pemulihan arsip M3-05 ke folder kosong tanpa .next; gunakan dependency yang tersedia dengan status reuse eksplisit. Jalankan typecheck dan 224 test, simpan laporan recovery lalu checkpoint M3-06. Setelah itu M4: route/panel rekomendasi memakai AirService/limiter yang sama, lokasi/versi/expiry tersinkron dan mode limited pada data yang tidak memenuhi syarat.

[Manifest](./M3-05-local-verified.json) · [Source archive](./M3-05-local-verified.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
