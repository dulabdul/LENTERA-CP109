import cartography from "./hero-map-points.json";

export function HeroMapIllustration() {
  return (
    <figure className="hero-map" aria-label="Ilustrasi kepulauan Indonesia dengan titik panas dekoratif, bukan data terkini">
      <div className="hero-map-heading" aria-hidden="true">
        <span>INDONESIA</span>

      </div>
      <div className="hero-map-art">
        <img
          className="hero-map-dark"
          src="/images/hero/indonesia-cartography.svg"
          width={cartography.width}
          height={cartography.height}
          alt="Peta kartografis kepulauan Indonesia dari Natural Earth; batas indikatif. Titik merah dekoratif bukan data kebakaran terkini."
          fetchPriority="high"
          decoding="async"
        />
        <img
          className="hero-map-light"
          src="/images/hero/indonesia-cartography-light.svg"
          width={cartography.width}
          height={cartography.height}
          alt="Peta kartografis kepulauan Indonesia dari Natural Earth; batas indikatif. Titik merah dekoratif bukan data kebakaran terkini."
          loading="lazy"
          decoding="async"
        />
        <svg className="hero-map-points" viewBox={cartography.viewBox} aria-hidden="true" focusable="false">
          {cartography.points.map(([x, y], index) => (
            <g key={`${x}-${y}`} className="hero-heat-point" style={{ animationDelay: `${-(index % 7) * 0.6}s` }}>
              <circle cx={x} cy={y} r="14" className="hero-heat-halo" />
              <circle cx={x} cy={y} r="7" className="hero-heat-ring" />
              <circle cx={x} cy={y} r="3" className="hero-heat-core" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
