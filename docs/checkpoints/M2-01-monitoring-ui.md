# M2-01-monitoring-ui

Waktu: 2026-10-27T17:31:43.632Z
Fase: M2
Status: **in-progress**

## Hasil

Antarmuka monitoring tersedia: MapLibre lazy load, cluster/titik, basemap raster CARTO berkey dan fallback batas Natural Earth, pencarian 105 tempat/koordinat Indonesia, filter, daftar berhalaman, detail dan pemilihan lokasi eksplisit. Status offline/expiry dievaluasi ulang, partial/stale tidak dipromosikan, data lebih 24 jam disembunyikan. Atribusi dan daftar tetap tersedia saat peta gagal. PM2.5/tindakan masih placeholder menunggu M3/M4.

## Verifikasi

13 unit test presentasi lulus: validasi koordinat, filter viewport/waktu, degradasi status dan WIB. Typecheck versi UI awal lulus; full verify setelah perbaikan marker/fokus/atribusi masih harus dijalankan. M1 sebelumnya lulus 134 test/build/CLI. Belum ada uji interaksi browser/WebGL/CARTO/perangkat atau pengukuran FPS.

## Selanjutnya

Jalankan npm run verify -- M2, periksa hasil/build dan lakukan review kode lifecycle/fokus/expiry. Selaraskan status roadmap lalu checkpoint M2-02. Berikutnya M3 Open-Meteo/cache seri/panel dan M4 rekomendasi; tetap catat gate provider dan browser pending.

[Manifest](./M2-01-monitoring-ui.json) · [Source archive](./M2-01-monitoring-ui.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
