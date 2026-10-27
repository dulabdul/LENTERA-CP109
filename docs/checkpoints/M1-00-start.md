# M1-00-start

Waktu: 2026-10-27T17:19:28.047Z
Fase: M1
Status: **in-progress**

## Hasil

Memulai M1 pipeline hotspot setelah memeriksa checkpoint M0-05, keputusan, source aktual serta kontrak 04 dan roadmap 05. Tidak ada perubahan hasil verifikasi M0 atau gate provider.

## Verifikasi

Dokumen resmi NASA Area API diperiksa: tiga source VIIRS, tanggal awal inklusif dan batch 1 sampai 5 hari. Belum ada integrasi live atau hasil uji implementasi M1.

## Selanjutnya

Implementasikan parser CSV ketat, ID deterministik, pembagian tanggal UTC, mask Indonesia dan metadata cakupan; uji fixture sebelum checkpoint M1-01. Lanjutkan repository snapshot, CLI dan API hotspot setelah subfase parser lulus.

[Manifest](./M1-00-start.json) · [Source archive](./M1-00-start.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
