# M3-02-cache-api-limits

Waktu: 2026-10-27T17:48:08.618Z
Fase: M3
Status: **in-progress**

## Hasil

Cache seri persisten gzip/checksum, lease lintas instance, coalescing, retry cooldown dan fallback 6 jam tersedia. GET /api/air memvalidasi lokasi dan menghasilkan 400/429/503/200 yang aman. Limiter sliding 20/menit gabungan air/actions dan anggaran upstream harian memakai conditional writes. Produksi membutuhkan R2, secret, anggaran eksplisit dan identitas IP platform tepercaya. UI belum dihubungkan.

## Verifikasi

57 pengujian baru M3 pada provider/proyeksi, cache/service, limiter dan handler lulus dengan fixture/mock serta storage disk nyata. Typecheck sebelum test handler terakhir lulus; full verify setelah UI masih pending. Conditional delete R2 tidak diasumsikan didukung: pruning mutable R2 ditolak aman; lifecycle retention produksi menjadi gate konfigurasi. Tidak ada provider/limiter live yang diklaim terverifikasi.

## Selanjutnya

Hubungkan AirPanel/AqiBadge/grafik ke API, batalkan request lokasi lama, tampilkan lokasi request/query/grid dan run nullable. Uji expiry/jam/forecast/versi, lalu full verify M3. Lengkapi perintah pemeliharaan, dokumentasi konfigurasi/retensi dan laporan smoke nyata/replay bila akses tersedia.

[Manifest](./M3-02-cache-api-limits.json) · [Source archive](./M3-02-cache-api-limits.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
