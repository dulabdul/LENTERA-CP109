# M1-01-parser-verified

Waktu: 2026-10-27T17:21:18.683Z
Fase: M1
Status: **in-progress**

## Hasil

Subfase parser/pengumpulan hotspot tersedia: server-only NASA adapter, CSV ketat, UTC HHMM, ID deterministik, enam batch tiga VIIRS, deduplikasi, mask Indonesia dan provenance per batch. Nol sah terpisah dari kegagalan; semua batch gagal tidak membuat snapshot pengganti. Retry maksimal dua percobaan dan Retry-After dihormati. API dan storage belum dibuat.

## Verifikasi

npm test -- tests/hotspot-ingest.test.ts: 29 test lulus memakai fixture sintetis dan HTTP mock. npm run typecheck lulus. Dokumen upstream: https://firms.modaps.eosdis.nasa.gov/api/area dan tutorial resmi NASA; belum memakai key atau memanggil Area API nyata.

## Selanjutnya

Implementasikan object store lokal/R2, snapshot gzip immutable/checksum, pointer/fallback/attempt metadata, retensi serta API filter dan CLI. Uji restart/pembatalan/korupsi sebelum checkpoint M1-02; gate provider dan browser tetap pending.

[Manifest](./M1-01-parser-verified.json) · [Source archive](./M1-01-parser-verified.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
