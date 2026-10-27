# M1-03-local-verified

Waktu: 2026-10-27T17:27:32.200Z
Fase: M1
Status: **local-verified-provider-gates-pending**

## Hasil

M1 lokal selesai: pipeline tiga VIIRS, batching UTC, parser ketat, deduplikasi/mask, snapshot gzip/checksum, pointer conditional/fallback, attempt metadata, retensi, CLI dan GET /api/hotspots. Workflow manual digate dan cron target nonaktif. Dokumen/keputusan diselaraskan. Source archive mencakup workflow dan laporan tersanitasi, mengecualikan .data/rahasia/dependency. Belum ada integrasi NASA/R2/cloud/browser nyata.

## Verifikasi

npm run verify -- M1 lulus: konfigurasi valid dengan provider pending, 134 unit test di 7 berkas, typecheck, build empat halaman dan route hotspot dinamis, serta CLI fixture tiga deteksi sintetis. Laporan docs/verification/M1-hotspots.json. Uji mencakup retry, nol sah, partial, korupsi/pemulihan, writer terputus, konflik writer, expiry, retensi, handler dan mock SDK R2. Bukan pengukuran akurasi ilmiah/browser.

## Selanjutnya

Mulai M2: MapLibre, daftar alternatif, pencarian lokal/koordinat, filter dan detail deteksi, status/cakupan/offline serta degradasi WebGL/basemap. API operasional tetap unavailable hingga snapshot nyata tersedia; jangan membaca folder fixture melalui route publik. Buat checkpoint M2-01 setelah subfase bermakna. Provider/biaya/runner tetap gate sebelum operasi publik.

[Manifest](./M1-03-local-verified.json) · [Source archive](./M1-03-local-verified.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
