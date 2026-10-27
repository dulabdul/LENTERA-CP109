# 03 — UI/UX dan Sistem Desain

**Dokumen aktif v1.0 · 27 Oktober 2026 · Mengimplementasikan FR-01–FR-08.**

## 1. Arah desain

Identitas Lentera berdiri sendiri: editorial lingkungan yang tenang, tipografi jelas, latar arang, dan penekanan pada lokasi serta waktu data. Peta, kondisi udara, dan tindakan harus mudah ditemukan pada satu alur. Animasi dekoratif dan hero panjang tidak menghalangi informasi utama. Dokumen ini tidak bergantung pada pemasangan skill desain eksternal.

Keputusan visual harus mendukung ketepatan data: warna merek tidak mengganti kategori indeks, label status dapat dibaca tanpa warna, dan angka model tidak diberi label sensor langsung.

## 2. Navigasi dan alur utama

Halaman MVP:

- `/`: penjelasan singkat tiga kemampuan, status sumber bila tersedia, dan CTA “Pantau lokasi”. Tidak menampilkan peringkat nasional yang belum dihitung.
- `/peta`: pencarian tempat/koordinat, peta hotspot, daftar deteksi, panel PM2.5 dan panel tindakan.
- `/sumber-data`: provider, atribusi, jenis data, waktu/metode, keterbatasan dan cara koreksi.
- `/privasi`: lokasi pilihan, cache teknis, pihak ketiga yang dihubungi dan kebijakan tanpa pelacak pemasaran.

Alur pengguna:

1. Cari tempat atau masukkan koordinat; alternatifnya pilih titik pada peta. Tidak ada dialog GPS otomatis.
2. Peta berpusat pada lokasi; panel menyatakan nama/koordinat dan cakupan informasi yang digunakan.
3. Periksa PM2.5 jam kini, estimasi indeks, sumber dan waktu pengambilan/berlaku.
4. Baca “Tindakan untuk lokasi ini”, pilih kelompok manual bila perlu, dan lihat alasan serta pedoman.
5. Jelajahi deteksi hotspot melalui filter 24h/48h/7d, confidence dan satelit; klik titik atau item daftar untuk detail.

Pemilihan hotspot historis tidak memindahkan lokasi udara tanpa tindakan pengguna “Gunakan lokasi ini”. Perubahan lokasi memuat ulang udara dan tindakan bersama, menghapus alasan dari lokasi sebelumnya selama loading.

## 3. Tata letak

Desktop: peta mengambil ruang utama; panel informasi di kanan memuat lokasi, udara dan tindakan. Bar filter hotspot dan cakupan tetap dekat peta. Daftar deteksi dapat dibuka sebagai alternatif peta. Header menyebut status per dataset, bukan satu lampu LIVE untuk semua sumber.

Mobile: pencarian di atas, peta di tengah, panel bawah yang dapat dibuka/tutup dengan tombol berlabel. Tab “Udara”, “Tindakan”, dan “Deteksi” memakai urutan fokus yang jelas. Ringkasan lokasi dan status tetap terlihat. Kontrol utama mempunyai area sentuh minimal 44 × 44 CSS px; drawer tidak menutupi atribusi atau tombol navigasi.

Wireframe ilustratif, **bukan data pengamatan**:

```text
LENTERA KARHUTLA                  Peta | Sumber data
[ Cari tempat atau koordinat ____________________ ]
Lokasi: Pekanbaru (pilihan pengguna)

HOTSPOT                     UDARA PADA LOKASI
[24h] [48h] [7d]             PM2.5 jam kini: 40 µg/m³
[Satelit] [Confidence]       Model CAMS · berlaku 20:00 WIB
                            Rerata model 24 jam: 22,0 µg/m³
Peta dan cluster            Estimasi US AQI PM2.5: 75 · Sedang
[Zoom] [Reset] [Daftar]      [Lihat metode dan waktu sumber]

Deteksi dalam tampilan      TINDAKAN UNTUK LOKASI INI
Periode dan cakupan         [Umum] [Kelompok sensitif] [Aktivitas luar]
[Status sumber hotspot]     Pesan dari rule versi aktif
                            Alasan · Pedoman · Berlaku sampai ...
© OpenStreetMap · © CARTO
```

Contoh indeks di atas berasal dari rerata model 24 jam, bukan angka sesaat 40. UI tidak menampilkan placeholder numerik seolah data asli sebelum respons tersedia.

## 4. Kontrak label dan waktu

| Elemen | Label yang digunakan |
| --- | --- |
| Jumlah hotspot | “Deteksi hotspot dalam tampilan” + rentang waktu dan cakupan sumber |
| Detail VIIRS | “Keyakinan deteksi: nominal/tinggi/rendah”; tanpa persentase yang tidak disediakan instrumen |
| Besaran termal | “Suhu kecerahan kanal satelit (K)” bila nilainya tersedia; bukan suhu api di permukaan |
| Udara | “PM2.5 model CAMS” + µg/m³ + jam berlaku |
| Indeks | “Estimasi US AQI PM2.5 — rerata model 24 jam” + kategori; metode bukan ISPU/NowCast |
| Lokasi grid | “Nilai mewakili sel model” dengan koordinat grid di detail; tidak mengklaim resolusi tingkat rumah |
| Waktu sumber | “Diambil”, “Deteksi terakhir” untuk hotspot; “Berlaku” dan “Run model” untuk udara jika diberikan |
| Tindakan | “Untuk jam kini” + `validUntil`, alasan, kelompok dan sumber pedoman |

Simpan UTC pada data; format default WIB diberi label eksplisit, dengan opsi melihat UTC pada detail. Hindari kata “aman”, “api aktif pasti”, “sensor langsung”, dan klaim sebab-akibat asap yang tidak didukung data.

Hotspot mempunyai filter historis tersendiri. Grafik udara mempunyai jam kini/riwayat/prakiraan tersendiri dengan batas cakupan nyata. Bila pengguna meninjau jam prakiraan, banner menjelaskan bahwa rekomendasi MVP tetap untuk jam kini. Jangan memakai satu slider yang diam-diam mencampur sejarah hotspot dengan masa depan model.

## 5. State data dan state tampilan

`loading` dan `offline` adalah state tampilan/koneksi, bukan nilai `DataState` API. Status sumber mengikuti prioritas dan ambang pada [04](04-TECHNICAL-SPECIFICATION.md).

| State | Perilaku UI |
| --- | --- |
| Loading pertama | Placeholder tekstual/skeleton tanpa angka contoh; panel tindakan menunggu data lokasi yang sama |
| `ok` | Nilai, sumber, waktu dan cakupan tampil; nol deteksi sah ditulis “Tidak ada deteksi tercatat pada cakupan ini” |
| `partial` | Data valid yang ada tetap terlihat dengan sumber/jam yang hilang; tidak menganggap cakupan lengkap; tindakan terarah tidak diterbitkan |
| `stale` | Banner “Data lama” dan waktu terakhir yang valid; tandai nilai terakhir, nonaktifkan tindakan terarah |
| `unavailable` | Tulis “Data belum tersedia” dengan alasan dan opsi coba lagi; jangan menampilkan nol sebagai nilai pengganti |
| Perangkat offline | Pertahankan data yang sudah dimuat, tampilkan banner dan hitung expiry lokal; tidak menjanjikan reload offline |
| Basemap/WebGL gagal | Tampilkan daftar deteksi, pencarian dan panel informasi; kontrol pemulihan tidak menghapus data yang valid |

Saat `validUntil` terlewati, data tidak tetap terlihat berstatus ok hanya karena tidak ada fetch baru. Evaluasi expiry setidaknya setiap 60 detik, pada pergantian jam, dan ketika tab kembali aktif. Tindakan terarah yang kedaluwarsa disembunyikan/diganti penjelasan, bukan dibiarkan sebagai saran kini.

Jika `dataVersion` panel udara berbeda dari versi alasan tindakan, muat ulang dan tampilkan status pembaruan; jangan menggabungkan dua versi sebagai satu kesimpulan.

## 6. Token visual

| Token | Nilai | Pemakaian |
| --- | --- | --- |
| `bg-base` | `#090D12` | Latar aplikasi |
| `bg-panel` | `#111720` | Panel informasi |
| `divider` | `#344050` | Garis dekoratif dan pemisah struktur; bukan satu-satunya penanda kontrol |
| `border-control` | `#697889` | Batas kontrol pada latar panel; kontras sekitar 3,98:1 |
| `text-primary` | `#F2F5F8` | Teks utama |
| `text-muted` | `#A8B3BF` | Label, waktu dan unit |
| `brand-ember` | `#FF9E1B` | CTA dan penekanan merek |
| `fire-high` | `#FF3E24` | Simbol confidence tinggi; semantik terpisah dari AQI |
| `fire-nominal` | `#FF9E1B` | Simbol confidence nominal |
| `fire-low` | `#FFC83B` | Simbol confidence rendah |

Palet kategori indeks mengikuti kontrak enam kategori pada 04:

| Kategori | Latar badge | Teks badge |
| --- | --- | --- |
| Baik | `#00E400` | `#000000` |
| Sedang | `#FFFF00` | `#000000` |
| Tidak sehat bagi kelompok sensitif | `#FF7E00` | `#000000` |
| Tidak sehat | `#FF0000` | `#000000` |
| Sangat tidak sehat | `#8F3F97` | `#FFFFFF` |
| Berbahaya | `#7E0023` | `#FFFFFF` |

Tidak ada klaim bahwa palet merek adalah standar WHO. Status data dan confidence hotspot menggunakan label/ikon tersendiri sehingga tidak disalahartikan sebagai kategori indeks udara. Nilai di luar skala tampil “>500”, kategori Berbahaya, dan penjelasan batas skala sesuai 04. Garis kontrol harus memenuhi kontras nonteks minimal 3:1 terhadap latar yang berbatasan; garis dekoratif tidak dipakai sebagai pengganti indikator fokus atau penanda interaksi.

Target tipografi M5: Fraunces untuk judul editorial, Plus Jakarta Sans untuk UI/body, dan JetBrains Mono untuk angka tabular. Shell M0 memakai fallback font lokal sistem agar build tidak bergantung unduhan font; self-host font target beserta lisensi pada fase UX sesuai docs/DECISIONS.md. Body default 16 px, label penting minimal 14 px, dengan dukungan zoom 200% dan wrapping nama kategori panjang.

## 7. Aksesibilitas dan validasi desain

Target UI adalah [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/). Verifikasi kontras teks, fokus keyboard terlihat, label form, landmark, urutan tab, dan pengumuman perubahan status yang tidak berlebihan. Warna selalu didampingi teks; grafik mempunyai ringkasan dan daftar data. Peta tidak menjadi satu-satunya cara memilih tempat atau membaca deteksi.

Hormati `prefers-reduced-motion`, hentikan animasi saat tab tidak aktif, dan hindari pendar berulang pada MVP. Tombol drawer mempertahankan fokus, dapat ditutup lewat keyboard, dan tidak menjebak pembaca layar. Ukuran viewport/perangkat dan kriteria benchmark hanya ditetapkan di [05](05-IMPLEMENTATION-ROADMAP.md); tidak mengklaim hasil pengujian sebelum aplikasi tersedia.

Pemeriksaan desain mencakup seluruh FR-01–FR-08 dan semua state pada bagian 5. Konten rekomendasi berasal dari tabel rule kanonis pada [04](04-TECHNICAL-SPECIFICATION.md), bukan ditulis ulang secara independen oleh komponen UI.
