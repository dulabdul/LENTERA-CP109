# LENTERA (Lentera Karhutla)

> **Platform Pemantauan Kebakaran Hutan, Lahan, dan Kualitas Udara Indonesia**

LENTERA adalah observatorium geospasial berbasis web yang menyajikan data real-time deteksi titik panas (*hotspots*), radiasi termal satelit, dan estimasi kualitas udara (PM2.5) di seluruh wilayah kepulauan Indonesia.

Platform ini dirancang untuk masyarakat umum, relawan, dan pemerhati lingkungan agar dapat memahami situasi anomali panas dan paparan kabut asap secara cepat, akurat, dan mudah diakses melalui perangkat desktop maupun ponsel cerdas.

---

## ⚡ Fitur Utama

### 1. Peta Titik Panas Interaktif (*Hotspot Map*)
- **Deteksi Satelit Real-time**: Mengintegrasikan data anomali termal dari konstelasi satelit NASA FIRMS (VIIRS Suomi-NPP, NOAA-20, dan NOAA-21) beresolusi tinggi.
- **Filter Rentang Waktu**: Pemantauan fleksibel untuk periode 24 jam terakhir, 48 jam, hingga 7 hari.
- **Visualisasi Panas Ganda**:
  - *Heatmap Gradasi Panas*: Peta kabut panas pada level zoom pulau/nasional untuk mengenali kluster densitas api secara instan.
  - *Kluster & Titik Presisi*: Transisi mulus ke lingkaran penanda saat zoom diperbesar ke level kabupaten/kecamatan.
- **Hotspot Insight Pill**: Kartu ringkasan cepat di bagian atas peta yang menampilkan total titik aktif 24 jam terakhir, wilayah terbanyak (provinsi), dan timestamp pembaruan satelit.
- **Metadata Lengkap per Titik**: Tingkat kepercayaan deteksi (*low*, *nominal*, *high*), Fire Radiative Power (FRP dalam MW), tanggal & jam lintasan satelit (*overpass* UTC & WIB), serta koordinat lintang/bujur.

### 2. Kualitas Udara & Konsentrasi PM2.5
- **Model Atmosfer Global**: Proyeksi polutan aerosol PM2.5 berbasis model Copernicus Atmosphere Monitoring Service (CAMS via Open-Meteo) per grid spasial 0,01°.
- **Estimasi US AQI 24 Jam**: Menghitung rata-rata bergerak konsentrasi PM2.5 sesuai standar US EPA 2024 untuk memetakan kategori kesehatan (Baik, Sedang, Tidak Sehat bagi Kelompok Sensitif, Tidak Sehat, Sangat Tidak Sehat, hingga Berbahaya).
- **Tren Riwayat & Prakiraan**: Grafik tren konsentrasi polutan selama 24 jam ke belakang dan proyeksi hingga 48 jam ke depan.

### 3. Rekomendasi Tindakan Adaptif
- **Panduan Aktivitas Terarah**: Rekomendasi perlindungan kesehatan berbasis aturan deterministik server-side sesuai panduan EPA AirNow.
- **Pemilih Audiens**:
  - *Masyarakat Umum*: Rekomendasi aktivitas harian dan ventilasi ruangan.
  - *Kelompok Sensitif*: Peringatan khusus bagi anak-anak, lansia, dan penderita asma/penyakit kardiovaskular.
  - *Pekerja Luar Ruang*: Anjuran penggunaan masker respirator (N95/KN95) dan pembatasan beban fisik lapangan.

### 4. Navigasi & Workspace Geospasial
- **Multi-View Modes**: Pilihan proyeksi peta Flat 2D, Globe interaktif, dan 3D Terrain kontur daratan.
- **Gaya Peta (Basemap)**: CARTO Dark Matter kontras tinggi untuk pemantauan malam/api, serta Esri World Imagery untuk citra satelit permukaan tanah.
- **Kontrol Layar Penuh (Fullscreen)**: Mode fokus tanpa gangguan navbar peramban.
- **Desain Ramah Seluler**: Panel bottom-sheet terpadu, target sentuh ergonomis (≥ 44×44 px), dan dekolisi layout untuk mencegah tumpang-tindih visual di layar kecil.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions, Route Handlers)
- **Runtime & Bahasa**: Node.js 20+, [TypeScript](https://www.typescriptlang.org/)
- **Visualisasi Geospasial**: [MapLibre GL JS](https://maplibre.org/) v6, [H3-js](https://h3geo.org/) (agregasi heksagonal spasial)
- **Styling**: Vanilla CSS modern berbasis CSS Variables, Fluid Typography, dan Theme Tokens (mendukung Dark & Light theme native)
- **Aksesibilitas**: Memenuhi standar WCAG 2.2 Level AA (kontras warna teruji, navigable via keyboard, label screen-reader)
- **Pengujian**: [Vitest](https://vitest.dev/) (350+ unit dan integration test suites)

---

## 🌐 Sumber Data & Metodologi

Platform LENTERA mengedepankan transparansi ilmiah:

1. **Titik Panas (Hotspots)**: Data diperoleh dari sensor VIIRS pada satelit konstelasi Suomi-NPP dan JPSS via NASA FIRMS. *Catatan*: Hotspot mengindikasikan anomali suhu permukaan bumi (radiasi termal), bukan kebakaran lahan yang sudah diverifikasi tim darat.
2. **Kualitas Udara**: Data PM2.5 bersumber dari model atmosfer numerik CAMS ECMWF, bukan stasiun pemantau fisik darat (ISPU). Model ini memberikan estimasi sebaran polutan makro saat jaringan sensor darat tidak tersedia.
3. **Batas Geografis**: Batas administratif indikatif bersumber dari dataset terbuka Natural Earth.
4. **Privasi Zero-Tracking**: Tidak menggunakan cookie pelacak pihak ketiga, tidak meminta izin lokasi latar belakang otomatis, dan masukan koordinat dinormalisasi ke bucket geospasial 0,01°.

---

## 🚀 Memulai (Local Development)

### Prasyarat
- **Node.js**: Versi `20.x` atau lebih baru
- **npm**: Versi `10.x` atau lebih baru

### 1. Kloning Repositori
```bash
git clone git@github.com:dulabdul/LENTERA-CP109.git
cd LENTERA-CP109
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan
Salin berkas placeholder konfigurasi lingkungan:
```bash
cp .env.example .env.local
```
*Catatan*: Untuk menjalankan server pengembang lokal dengan fixture data teruji, aplikasi dapat langsung berjalan tanpa key berbayar.

### 4. Jalankan Development Server
```bash
npm run dev
```
Buka peramban pada alamat [http://localhost:3000](http://localhost:3000) (atau port yang ditunjuk terminal).

---

## 🧪 Pengujian & Pemeriksaan Kualitas

Jalankan seluruh rangkaian uji otomatis, validasi tipe TypeScript, dan verifikasi build produksi:

```bash
# Menjalankan unit & contract tests (Vitest)
npm test

# Pemeriksaan tipe TypeScript
npm run typecheck

# Pengujian build produksi Next.js
npm run build
```

---

## 📁 Struktur Direktori

```text
├── public/                # Aset statis, ikon web manifest, dan OpenGraph preview
├── src/
│   ├── app/               # Next.js App Router (halaman, layout, manifest, sitemap)
│   │   ├── api/           # Endpoint API (hotspots, air quality, recommendations)
│   │   ├── peta/          # Halaman observatorium pemantauan peta
│   │   ├── privasi/       # Kebijakan privasi & zero-tracking
│   │   └── sumber-data/   # Transparansi metodologi & atribusi data
│   ├── components/        # Komponen antarmuka (Map, AirPanel, ActionPanel, Header, Footer)
│   │   ├── map/           # Komponen MapLibre, heatmap, kamera, dan kontrol layer
│   │   ├── air/           # Komponen grafik PM2.5 dan indikator AQI
│   │   └── theme/         # Toggle tema dan tokens
│   ├── data/              # Manifest provinsi dan boundary geospasial
│   └── lib/               # Algoritma perhitungan AQI, adapter satelit, dan rate limiter
├── tests/                 # Rangkaian pengujian unit dan integrasi
└── docs/                  # Dokumentasi arsitektur, spesifikasi teknis, dan catatan teknis
```

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).
Seluruh hak cipta data satelit dan basemap tetap berada pada penyedia data masing-masing (NASA FIRMS, ECMWF CAMS, Open-Meteo, CARTO, dan OpenStreetMap contributors).
