# M4-00-start

Waktu: 2026-10-27T18:05:23.279Z
Fase: M4
Status: **in-progress**

## Hasil

Memulai M4 sesuai checkpoint M3-06: API dan panel rekomendasi deterministik untuk tiga audience, memakai AirService dan limiter gabungan yang sudah tersedia. Kontrak, PRD, UI, keputusan dan kode aktual diperiksa; pedoman AirNow resmi dibaca untuk review katalog. M0-M3 dan gate produksi/browser tidak berubah.

## Verifikasi

Belum ada implementasi/verifikasi M4 baru. Baseline terakhir M3: 224 test, typecheck/build dan pemulihan arsip lulus. Source pedoman tersedia dan isi tabel diperiksa; belum merupakan review klinis atau bukti kondisi lokal.

## Selanjutnya

Subfase 1: validator respons tindakan, penguatan input/expiry/alasan dan GET /api/recommendations; uji kategori/audience/status/limiter. Subfase 2: panel/selector dan sinkronisasi dengan udara, termasuk pergantian lokasi/jam/versi/tab. Subfase 3: full verify, dokumentasi dan pemulihan checkpoint handoff.

[Manifest](./M4-00-start.json) · [Source archive](./M4-00-start.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
