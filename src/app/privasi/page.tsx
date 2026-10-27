import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan privasi",
  description: "Kebijakan privasi Lentera Karhutla: tanpa pelacak pemasaran, tanpa geolokasi otomatis, dan tanpa profil kesehatan pengguna.",
};

export default function PrivacyPage() {
  return (
    <main id="main" className="page-section prose">
      <p className="eyebrow">PRIVASI & PERLINDUNGAN DATA</p>
      <h1 className="page-title">
        Informasi publik.<br />
        <em>Lokasi pilihan Anda.</em>
      </h1>
      <p className="lead-paragraph">
        Lentera Karhutla dirancang dengan prinsip minimasi data: kami menyajikan informasi lingkungan publik yang relevan bagi masyarakat tanpa mengorbankan privasi pribadi pengguna. Tidak ada akun pengguna, tidak ada pelacak pihak ketiga, dan tidak ada pengumpulan riwayat individu.
      </p>

      <section>
        <h2>1. Tanpa pelacak pemasaran dan tanpa cookie pihak ketiga</h2>
        <p>
          Aplikasi ini <strong>tidak menggunakan pelacak iklan, Google Analytics, pixel pemasaran, atau skrip pelacakan perilaku</strong>. Kami tidak menjual, menyewakan, atau membagikan data interaksi pengguna kepada jaringan periklanan mana pun.
        </p>
      </section>

      <section>
        <h2>2. Pemilihan lokasi dan koordinat teknis</h2>
        <ul>
          <li><strong>Tanpa GPS otomatis:</strong> Aplikasi tidak pernah meminta izin geolokasi GPS peramban secara otomatis tanpa persetujuan Anda. Seluruh lokasi ditentukan secara sadar oleh pengguna melalui pencarian nama tempat, entri koordinat lintang/bujur, atau klik pada peta.</li>
          <li><strong>Pembulatan bucket teknis (0,01°):</strong> Ketika Anda memilih suatu lokasi, koordinat dikirimkan ke endpoint API internal (<code>/api/air</code> dan <code>/api/recommendations</code>) untuk mengambil proyeksi model. Di sisi server, koordinat ini dinormalisasi ke grid teknis 0,01° (sekitar 1,1 km) guna efisiensi cache dan mencegah perekaman posisi presisi setingkat rumah tinggal.</li>
        </ul>
      </section>

      <section>
        <h2>3. Pilihan kelompok audiens</h2>
        <p>
          Fitur pemilih audiens (<em>Masyarakat umum</em>, <em>Kelompok sensitif</em>, atau <em>Aktivitas luar ruang</em>) bekerja murni sebagai parameter penentu aturan tindakan pada sesi tampilan saat ini.
        </p>
        <p>
          Pilihan ini <strong>tidak pernah disimpan sebagai profil medis atau riwayat kesehatan individual</strong> di server. Ketika Anda menutup tab atau memuat ulang halaman, status dikembalikan ke pengaturan bawaan (umum).
        </p>
      </section>

      <section>
        <h2>4. Permintaan pihak ketiga dari peramban</h2>
        <p>
          Untuk menyajikan peta dan data spasial, peramban Anda dapat terhubung ke penyedia infrastruktur berikut:
        </p>
        <ul>
          <li><strong>CARTO / OpenStreetMap:</strong> Mengambil potongan gambar peta (raster tiles). Permintaan ini hanya membawa koordinat tile peta (z/x/y) dan kunci akses domain publik, tanpa identitas personal.</li>
          <li><strong>Open-Meteo:</strong> Endpoint server kami mengambil data CAMS secara terisolasi. Dalam mode development atau deployment tertentu, peramban dapat memanggil endpoint proksi internal yang melindungi kredensial.</li>
          <li><strong>NASA FIRMS:</strong> Hanya diakses oleh pipeline server internal. Peramban pengguna tidak pernah terhubung langsung ke server NASA dan tidak mengekspos token apa pun.</li>
        </ul>
      </section>

      <section>
        <h2>5. Pembatas permintaan dan keamanan teknis (Rate Limiting)</h2>
        <p>
          Untuk mencegah penyalahgunaan sumber daya dan serangan Denial of Service (DoS):
        </p>
        <ul>
          <li>Sistem menerapkan pembatas laju (sliding-window 20 permintaan per 60 detik).</li>
          <li>Identitas permintaan produksi dihitung melalui <strong>hash kriptografis satu arah (HMAC SHA-256)</strong> dengan kunci rahasia server (salt). Alamat IP mentah Anda <em>tidak pernah disimpan dalam database persisten atau log analitik</em>.</li>
          <li>Data penghitung teknis ini memiliki masa retensi maksimal 24 jam dan dibersihkan secara berkala.</li>
        </ul>
      </section>

      <section>
        <h2>6. Penyimpanan cache dan retensi data</h2>
        <p>
          Cache seri kualitas udara disimpan secara internal selama 24 jam untuk membatasi beban ke upstream provider dan memastikan ketersediaan data saat terjadi lonjakan trafik. Data yang berumur lebih dari 6 jam tidak lagi disajikan sebagai kondisi kini.
        </p>
      </section>

      <section>
        <h2>7. Kontak pertanyaan privasi</h2>
        <p>
          Jika Anda memiliki pertanyaan mengenai tata kelola data atau kebijakan privasi aplikasi ini, silakan hubungi tim pemelihara melalui email: <a href="mailto:dul.abdoel21@gmail.com">dul.abdoel21@gmail.com</a>.
        </p>
      </section>

      <nav className="page-navigation-links" aria-label="Navigasi halaman terkait">
        <Link href="/peta" className="primary-link">Buka peta monitoring ↗</Link>
        <Link href="/sumber-data">Baca sumber dan metode ↗</Link>
      </nav>
    </main>
  );
}
