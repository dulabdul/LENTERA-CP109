# M4-01-api-rules

Waktu: 2026-10-27T18:10:50.699Z
Fase: M4
Status: **in-progress**

## Hasil

Kontrak tindakan dan GET /api/recommendations tersedia, memakai AirService/limiter yang sama dengan API udara. Basis indeks/versi/periode tercatat, aturan dibatasi server-only, limited menjelaskan keterbatasan tanpa kategori lama. Expiry dibatasi kesegaran/jam berikutnya; kasus pergantian jam selama IO membaca ulang sumber maksimal sekali.

## Verifikasi

76 test pada kontrak/rule/handler (termasuk baseline rule) lulus: tujuh konsentrasi/beyondScale × tiga audience, query palsu/duplikat, 400/429/503, partial/stale/unavailable, shared limit gabungan 20 request dan cache/version sama. Typecheck lulus sebelum penambahan uji boundary terakhir; full verify menunggu UI. Pedoman AirNow resmi dibandingkan dengan katalog; browser/produksi belum diuji.

## Selanjutnya

Subfase UI: satukan pengambilan udara/tindakan dalam panel lokasi, tambah AudienceSelector/ActionPanel dan guard lokasi/versi/periode/expiry. Batalkan respons lama, retry sinkronisasi maksimal sekali, dan uji perubahan jam/lokasi/audience/offline/tab. Simpan checkpoint M4-02 setelah UI dan pengujian bermakna.

[Manifest](./M4-01-api-rules.json) · [Source archive](./M4-01-api-rules.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
