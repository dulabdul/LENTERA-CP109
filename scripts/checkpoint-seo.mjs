// SEO handoff helper; documentation tooling only. Run from repository root.
// Args: ID phase status summary validation next (quote each prose argument).
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const [id, phase, status, summary, validation, next] = process.argv.slice(2);
if (!/^SEO-[A-C]-\d{2}-[a-z0-9-]+$/.test(id) || !/^SEO-[A-C]$/.test(phase) || !next) {
  throw Error('Provide a new SEO checkpoint ID (e.g. SEO-A-01-advanced-hero-og), phase (SEO-A), status, summary, validation and next.');
}

const root = process.cwd(), folder = join(root, 'docs/checkpoints');
await mkdir(folder, { recursive: true });

for (const ext of ['md', 'json', 'zip']) {
  try {
    await access(join(folder, id + '.' + ext));
    throw Error(`Checkpoint ${id}.${ext} already exists`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

const timestamp = new Date().toISOString();
const baseline = await readFile('CHECKPOINT.md', 'utf8');
const milestones = baseline.match(/## Baseline milestone aplikasi\n([\s\S]*?)\n## Berkas handoff/)?.[1]?.trim() ?? 'Baseline: M6-01-handoff-ready.';

await writeFile('CHECKPOINT.md', `# Checkpoint kerja — LENTERA Advanced SEO & Hero OpenGraph

Terakhir diperbarui: **${timestamp}**. Fase aktif: **${phase}**. Status: **${status}**.

## Mulai / lanjutkan

Baca AGENTS.md, checkpoint immutable di bawah, docs/DECISIONS.md (khususnya D038 dan D039). Pertahankan integritas metadata Next.js App Router, structured data Schema.org, OpenGraph aset visual Hero 1200x630, dynamic sitemap/robots, serta dekolisi header peta yang telah terverifikasi.

## Hasil fase ini

${summary}

## Verifikasi

${validation}

## Langkah berikutnya

${next}

## Baseline milestone aplikasi

${milestones}

## Berkas handoff

- [Checkpoint immutable](docs/checkpoints/${id}.md)
- [Manifest/checksum](docs/checkpoints/${id}.json)
- [Source archive](docs/checkpoints/${id}.zip)
- [Keputusan implementasi](docs/DECISIONS.md)
- [Baseline aplikasi terakhir](docs/checkpoints/M6-01-handoff-ready.md)

Perintah validasi: npm test; npm run typecheck; npm run build. ESLint belum dikonfigurasi. Checkpoint SEO memakai ID baru SEO-A/B/C; jangan menimpa checkpoint lama. Jangan memasukkan environment rahasia, runtime .data, node_modules atau .next ke arsip.
`);

const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name), r = relative(root, p);
    if (e.isSymbolicLink() || r.startsWith('docs/checkpoints') || e.name === '.DS_Store' || e.name.startsWith('.env')) continue;
    if (e.isDirectory()) await walk(p);
    else if (e.isFile()) files.push(r);
  }
}

for (const dir of ['src', 'scripts', 'tests', 'fixtures', 'public', 'docs', 'design-reference', '.github']) {
  try { await walk(join(root, dir)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

for (const e of await readdir(root, { withFileTypes: true })) {
  if (e.isFile() && !e.isSymbolicLink() && (/\.md$/.test(e.name) || ['package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts', 'vitest.config.ts', 'postcss.config.mjs', '.gitignore', '.env.example'].includes(e.name))) {
    files.push(e.name);
  }
}

files.sort();
const sourceFiles = {};
for (const p of files) {
  sourceFiles[p] = createHash('sha256').update(await readFile(p)).digest('hex');
}

const record = {
  id, phase, status, timestamp, summary, validation, next, sourceFiles,
  excluded: ['node_modules', '.next', '.env', '.env.local', '.cache', '.data', 'research', 'old checkpoint archives'],
  archive: id + '.zip'
};

await writeFile(join(folder, id + '.json'), JSON.stringify(record, null, 2) + '\n');
await writeFile(join(folder, id + '.md'), `# ${id}

Waktu: ${timestamp}
Fase: ${phase}
Status: **${status}**

## Hasil

${summary}

## Verifikasi

${validation}

## Selanjutnya

${next}

[Manifest](./${id}.json) · [Source archive](./${id}.zip)

Checkpoint immutable. Baca ../../CHECKPOINT.md untuk keadaan terbaru. Source archive mengecualikan dependency, build, environment rahasia, runtime data dan research.
`);

const result = spawnSync('python3', [
  '-c',
  "import json,sys,zipfile,pathlib;d=json.load(sys.stdin);r=pathlib.Path(d['root']);z=zipfile.ZipFile(d['archive'],'w',zipfile.ZIP_DEFLATED);[z.write(r/p,p) for p in d['files']];z.close()"
], {
  input: JSON.stringify({
    root,
    archive: join(folder, id + '.zip'),
    files: [...files, 'docs/checkpoints/' + id + '.md', 'docs/checkpoints/' + id + '.json']
  }),
  encoding: 'utf8'
});

if (result.status !== 0) throw Error('Archive creation failed');
console.log(JSON.stringify({ id, phase, status, sourceFiles: files.length, archive: 'docs/checkpoints/' + id + '.zip' }));
