# M3-01-provider-projection

Waktu: 2026-10-27T17:41:14.949Z
Fase: M3
Status: **in-progress**

## Hasil

Adapter Open-Meteo CAMS global dan proyeksi seri tersedia: UTC/unit/grid tervalidasi, null/invalid tidak menjadi nol, cache bucket 0.01 derajat, perhitungan jam kini/23 riwayat/48 prakiraan dan indeks 24 sampel. Model run tetap null bila tidak diberikan provider. Destinasi endpoint/key dibatasi ke domain resmi.

## Verifikasi

27 unit test provider/proyeksi lulus, mencakup pergantian jam sebelum TTL, data hilang, batas 60 menit/6 jam, beyondScale, retry dan request budget callback. Typecheck lulus sebelum koreksi kecil JSON malformed; full verify masih menunggu subfase cache/API/UI. Fixture sintetis saja; tidak ada claim integrasi live.

## Selanjutnya

Implementasikan repository seri gzip/checksum dengan metadata attempt, cache/fallback/coalescing dan retensi; persistent rate limiter gabungan air/actions serta budget upstream. Uji dua instance/expiry/korupsi lalu buat checkpoint M3-02 sebelum menghubungkan UI.

[Manifest](./M3-01-provider-projection.json) · [Source archive](./M3-01-provider-projection.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
