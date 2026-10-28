// Deterministic presentation asset only. Never modifies service geography or data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

const input = 'src/data/indonesia.json';
const bytes = await readFile(input);
const country = JSON.parse(bytes);
const geography = JSON.parse(await readFile('src/data/geography-manifest.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
if (hash(bytes) !== geography.country.outputSha256) throw Error('Geography checksum mismatch');
const width = 1280, height = 560, scale = (width - 64) / 48;
const mercator = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
const middle = (mercator(7) + mercator(-12)) / 2;
const project = ([lon, lat]) => [32 + (lon - 94) * scale, height / 2 + (middle - mercator(lat)) * scale];
const number = n => Number(n.toFixed(2));

function simplify(points, tolerance = .38) {
  if (points.length <= 3) return points;
  const a = points[0], b = points.at(-1), dx = b[0] - a[0], dy = b[1] - a[1];
  let distance = 0, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const t = dx || dy ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    const d = Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
    if (d > distance) { distance = d; split = i; }
  }
  return distance > tolerance ? [...simplify(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplify(points.slice(split), tolerance)] : [a, b];
}
let inputVertices = 0, outputVertices = 0;
const shapes = country.features.flatMap(feature => feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates);
const paths = shapes.map(rings => rings.map(ring => {
  inputVertices += ring.length;
  const points = simplify(ring.map(project));
  if (points.length < 4) return '';
  outputVertices += points.length;
  return 'M' + points.map(point => point.map(number).join(',')).join('L') + 'Z';
}).join('')).filter(Boolean);
const land = paths.join('');
const anchors = [
  [96.6, 4.2], [98.7, 2.4], [100.5, .8], [101.6, -.6], [103.8, -3.8],
  [110.2, -.6], [111.6, -1.7], [113.3, -1.3], [114.8, -2.5], [116.2, .6], [117.2, 1.3], [114, .5],
  [107.6, -6.9], [110.4, -7.3], [112.5, -7.8],
  [119.8, -1.2], [120.15, -2.6], [122, -4], [123, .6],
  [120.2, -9.7], [121, -8.6], [136.5, -3.8], [139.8, -5],
];
for (const point of anchors) if (!country.features.some(feature => booleanPointInPolygon(point, feature))) throw Error('Illustrative anchor outside Indonesia: ' + point);
const points = anchors.map(point => project(point).map(number));
const lines = [];
for (const lon of [95,100,105,110,115,120,125,130,135,140]) {
  const x = number(project([lon, 0])[0]); lines.push(`<path d="M${x} 24V536"/>`);
}
for (const lat of [5,0,-5,-10]) {
  const y = number(project([94, lat])[1]); lines.push(`<path d="M24 ${y}H1256"/>`);
}
const labels = [['SUMATRA',100.4,1.6],['JAWA',110.3,-6.3],['KALIMANTAN',113.7,-.3],['SULAWESI',122.5,-2.2],['PAPUA',137.8,-3.2]];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>Kepulauan Indonesia — Natural Earth, batas indikatif</title>
<desc>Peta vektor dekoratif, bukan pengamatan hotspot, tinggi tajuk atau relief medan.</desc>
<defs>
<linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#25473e"/><stop offset=".55" stop-color="#203932"/><stop offset="1" stop-color="#1b2e32"/></linearGradient>
<pattern id="land-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".65" fill="#78a997" opacity=".21"/></pattern>
<path id="coast" d="${land}"/>
<clipPath id="country"><use href="#coast" fill-rule="evenodd"/></clipPath>
</defs>
<g fill="none" stroke="#6a8d86" stroke-width=".5" opacity=".12">${lines.join('')}</g>
<use href="#coast" fill="url(#land)" fill-rule="evenodd" stroke="#669482" stroke-opacity=".65" stroke-width=".8" stroke-linejoin="round"/>
<use href="#coast" fill="url(#land-dots)" fill-rule="evenodd"/>
<g clip-path="url(#country)" fill="none" stroke="#73a18b" stroke-width=".55" opacity=".15">${lines.join('')}</g>
<g fill="#a4b6ad" opacity=".62" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" letter-spacing="2">${labels.map(([name,lon,lat])=>{const [x,y]=project([lon,lat]).map(number);return `<text x="${x}" y="${y}">${name}</text>`;}).join('')}</g>
</svg>`;
const output = 'public/images/hero/indonesia-cartography.svg';
await mkdir('public/images/hero', { recursive: true });
await writeFile(output, svg + '\n');
// Explicit light asset follows the manual app theme on every supported browser.
const lightPalette = { '#25473e':'#c9e2d2', '#203932':'#d9e8dd', '#1b2e32':'#e0ebe4', '#78a997':'#668a71', '#6a8d86':'#527360', '#669482':'#5c806a', '#73a18b':'#527360', '#a4b6ad':'#274e38' };
const lightSvg = svg.replace(/#[0-9a-f]{6}/g, color => lightPalette[color] ?? color);
const lightOutput = 'public/images/hero/indonesia-cartography-light.svg';
await writeFile(lightOutput, lightSvg + '\n');
await writeFile('src/components/public/hero-map-points.json', JSON.stringify({ viewBox: `0 0 ${width} ${height}`, width, height, points }, null, 2) + '\n');
const manifest = { source: input, sourceSha256: hash(bytes), provider: geography.provider, version: geography.country.version, license: geography.license, licenseUrl: geography.licenseUrl, output, outputSha256: hash(Buffer.from(svg + '\n')), outputBytes: Buffer.byteLength(svg + '\n'), inputVertices, outputVertices, retainedShapes: paths.length, projection: 'Spherical Mercator, identical uniform scale for both axes; presentation only', bounds: [94,-12,142,7], viewBox: `0 0 ${width} ${height}`, simplification: '0.38 SVG pixel tolerance; small collapsed rings omitted. Source geography unchanged.', markers: '23 fixed decorative land anchors, validated against unchanged country geometry; not observations', runtime: 'Local SVG plus CSS overlay, no tiles, API key, provider request, WebGL or new dependency' };
manifest.lightVariant = { output: lightOutput, outputSha256: hash(Buffer.from(lightSvg + '\n')), outputBytes: Buffer.byteLength(lightSvg + '\n'), sameGeometryAndViewBox: true };
await writeFile('docs/verification/hero-revamp/cartography-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
