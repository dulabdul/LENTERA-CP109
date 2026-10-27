# M4-02-panels-synchronized

Waktu: 2026-10-27T18:16:23.525Z
Fase: M4
Status: **in-progress**

## Hasil

Panel lokasi kini mengoordinasikan udara/tindakan, AudienceSelector native untuk tiga kelompok, dan ActionPanel dengan alasan/basis/periode/rule/expiry. Respons lokasi/audience lama dibatalkan, perbedaan basis memicu satu retry udara, targeted ditahan saat loading/offline/fail/expiry/mismatch. Clock monotonik dan timer deadline mencegah tab/transport memperpanjang panduan. Riwayat/prakiraan tidak menjadi input tindakan.

## Verifikasi

76 pemeriksaan backend/rule/kontrak termasuk baseline lulus, serta 29 pengujian UI/render/koordinasi request/clock lulus. Typecheck setelah seluruh perubahan UI lulus. Pengujian handler dilakukan in-process dan UI via fungsi/render server, bukan interaksi browser. Full verify M4, review dokumentasi/konten dan handoff masih harus diselesaikan.

## Selanjutnya

Tambahkan M4 pada verifier, simpan review editorial pedoman AirNow dan keputusan basis/expiry/sinkronisasi. Jalankan npm run verify -- M4, perbaiki temuan, perbarui status dokumen kemudian checkpoint M4-03/M4-04. Uji pemulihan arsip source sebelum checkpoint handoff final; produksi/browser/FPS tetap pending.

[Manifest](./M4-02-panels-synchronized.json) · [Source archive](./M4-02-panels-synchronized.zip)

Checkpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.
