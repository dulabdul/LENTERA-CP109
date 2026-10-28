import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer"><span className="footer-statement"><strong>LENTERA</strong><span>Informasi lingkungan untuk keputusan sehari-hari.</span></span><div><Link href="/sumber-data">Transparansi data</Link><Link href="/privasi">Privasi</Link></div><small>Deteksi panas memerlukan verifikasi. Nilai udara model tidak menggantikan pengamatan setempat.</small></footer>;
}
