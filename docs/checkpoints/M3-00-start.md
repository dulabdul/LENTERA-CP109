# M3-00-start

Waktu: 2026-10-27T17:39:52.783Z
Fase: M3
Status: **in-progress**

## Hasil

Memulai M3 setelah membaca checkpoint M2-03, keputusan, source aktual, PRD dan kontrak/roadmap. M1/M2 tetap pada hasil lokal sebelumnya; tidak ada perubahan izin atau operasi cloud.

## Verifikasi

Dokumen resmi Open-Meteo Air Quality API diperiksa: domain cams_global, hourly pm2_5, unixtime UTC, past_days dan forecast_days, atribusi serta endpoint customer/apikey. Belum ada kode/hasil test M3.

## Selanjutnya

Subfase 1: parser/normalisasi Open-Meteo dan proyeksi jam kini/24 sampel/prakiraan; uji fixture. Subfase 2: cache persisten, fallback, rate limiter lintas instance dan API. Subfase 3: panel PM2.5/indeks/grafik lalu full verify dan handoff.

[Manifest](./M3-00-start.json) · [Source archive](./M3-00-start.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
