import type { FieldGrid, FieldFrame } from './contracts';
export const PM25_SCALE = [
  { value: 0, rgb: [35, 52, 120] }, { value: 10, rgb: [2, 132, 199] }, { value: 25, rgb: [20, 184, 166] },
  { value: 50, rgb: [250, 204, 21] }, { value: 100, rgb: [249, 115, 22] }, { value: 150, rgb: [220, 38, 38] },
] as const;
export function pm25Color(value: number): [number, number, number] {
  if (!Number.isFinite(value) || value < 0) throw Error('Invalid concentration');
  for (let i = 1; i < PM25_SCALE.length; i++) {
    const lo = PM25_SCALE[i - 1]!, hi = PM25_SCALE[i]!;
    if (value <= hi.value) { const f = Math.max(0, (value - lo.value) / (hi.value - lo.value)); return [0, 1, 2].map(c => Math.round(lo.rgb[c]! + f * (hi.rgb[c]! - lo.rgb[c]!))) as [number, number, number]; }
  }
  return [...PM25_SCALE.at(-1)!.rgb];
}
export function sampleField(grid: FieldGrid, values: (number | null)[], lon: number, lat: number): number | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < grid.west || lon > grid.east || lat < grid.south || lat > grid.north || values.length !== grid.nx * grid.ny) return null;
  const fx = (lon - grid.west) / grid.step, fy = (lat - grid.south) / grid.step;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, grid.nx - 1), y1 = Math.min(y0 + 1, grid.ny - 1), dx = fx - x0, dy = fy - y0;
  const nodes = [[x0, y0, (1 - dx) * (1 - dy)], [x1, y0, dx * (1 - dy)], [x0, y1, (1 - dx) * dy], [x1, y1, dx * dy]];
  let total = 0;
  for (const [x, y, weight] of nodes) {
    if (weight! <= 1e-10) continue;
    const value = values[y! * grid.nx + x!]; if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
    total += value * weight!;
  }
  return total;
}
const mercator = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
export function rasterField(grid: FieldGrid, frame: FieldFrame, width = 768) {
  if (!Number.isInteger(width) || width < 2 || width > 1024 || frame.values.length !== grid.nx * grid.ny) throw Error('Invalid raster dimensions');
  const top = mercator(grid.north), bottom = mercator(grid.south), height = Math.max(2, Math.round(width * (top - bottom) / ((grid.east - grid.west) * Math.PI / 180)));
  if (height > 1024) throw Error('Raster aspect ratio exceeds budget');
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = (2 * Math.atan(Math.exp(top + (bottom - top) * y / (height - 1))) - Math.PI / 2) * 180 / Math.PI;
    for (let x = 0; x < width; x++) {
      const lon = grid.west + (grid.east - grid.west) * x / (width - 1), value = sampleField(grid, frame.values, lon, Math.min(grid.north, Math.max(grid.south, lat)));
      if (value === null) continue;
      const color = pm25Color(value), offset = (y * width + x) * 4; pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 235;
    }
  }
  return { width, height, pixels };
}
