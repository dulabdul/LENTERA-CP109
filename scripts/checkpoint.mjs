import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const id = args.get("--id"), phase = args.get("--phase") ?? "M0";
if (!id || !/^M[0-6]-\d{2}-[a-z0-9-]+$/.test(id) || !/^M[0-6]$/.test(phase)) throw new Error("Use --id M0-01-description --phase M0 --status in-progress --summary ... --next ...");
const root = process.cwd(), folder = join(root, "docs/checkpoints");
await mkdir(folder, { recursive: true });
const jsonPath = join(folder, `${id}.json`);
for (const existing of [jsonPath, join(folder, `${id}.md`), join(folder, `${id}.zip`)]) {
  try { await access(existing); throw new Error(`Checkpoint ${id} already exists; use a new ID.`); } catch (error) { if (error.code !== "ENOENT") throw error; }
}
const status = args.get("--status") ?? "in-progress";
const summary = args.get("--summary") ?? "Progress recorded";
const next = args.get("--next") ?? "Inspect the files and continue the current milestone.";
const validation = args.get("--validation") ?? "No new verification result recorded.";
const timestamp = new Date().toISOString();
const ledger = {};
for (const file of (await readdir(folder)).sort()) {
  if (!file.endsWith(".json")) continue;
  const record = JSON.parse(await readFile(join(folder, file), "utf8"));
  if (record.phase && record.status) ledger[record.phase] = record.status;
}
ledger[phase] = status;
const phases = ["M0", "M1", "M2", "M3", "M4", "M5", "M6"];
const rootText = `# Checkpoint kerja — Lentera Karhutla

Terakhir diperbarui: **${timestamp}**. Fase aktif: **${phase}**. Status: **${status}**.

## Baca ini jika berganti AI agent

Pengguna menginstruksikan implementasi dengan checkpoint setiap fase. Baca AGENTS.md, checkpoint immutable di bawah, docs/DECISIONS.md dan kontrak 04 sebelum bekerja. Periksa berkas aktual dan proses yang mungkin masih berjalan; jangan mengasumsikan pekerjaan setelah timestamp ini sudah selesai.

## Hasil fase ini

${summary}

## Verifikasi yang tercatat

${validation}

## Langkah berikutnya

${next}

## Milestone

| Fase | Status terakhir |
| --- | --- |
${phases.map(p => `| ${p} | ${ledger[p] ?? "not-started"} |`).join("\n")}

## Berkas handoff

- [Checkpoint immutable](docs/checkpoints/${id}.md)
- [Manifest dan checksum](docs/checkpoints/${id}.json)
- [Arsip source tanpa dependency/rahasia](docs/checkpoints/${id}.zip)
- [Keputusan implementasi](docs/DECISIONS.md)
- [Setup lokal](docs/SETUP.md)
- [Kontrak teknis](04-TECHNICAL-SPECIFICATION.md)

Perintah standar setelah dependency terpasang: npm test; npm run typecheck; npm run build. Perintah checkpoint: npm run checkpoint -- --id M0-02-nama --phase M0 --status in-progress --summary 'hasil' --next 'langkah berikutnya' --validation 'perintah dan hasil aktual'. Gunakan ID baru; jangan menimpa checkpoint lama.

Nilai API key tidak disimpan di checkpoint. Ketiadaan key/akses provider harus dicatat pending, tidak diganti data sintetis yang mengaku nyata. Tidak ada deployment atau aktivasi cloud yang tersirat dari checkpoint source lokal.
`;
await writeFile(join(root, "CHECKPOINT.md"), rootText);
const roots = ["src", "scripts", "tests", "fixtures", "public", "docs", ".github"];
const files = [];
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name), local = relative(root, full);
    if (local.startsWith("docs/checkpoints")) continue;
    if (entry.isDirectory()) await collect(full);
    else if (entry.isFile() && !entry.name.startsWith(".env")) files.push(local);
  }
}
for (const dir of roots) { try { await collect(join(root, dir)); } catch (e) { if (e.code !== "ENOENT") throw e; } }
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || entry.isSymbolicLink()) continue;
  const name = entry.name;
  if (/\.md$/.test(name) || ["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "vitest.config.ts", ".env.example", ".gitignore"].includes(name)) files.push(name);
}
files.sort();
const manifest = {};
for (const file of files) manifest[file] = createHash("sha256").update(await readFile(join(root, file))).digest("hex");
const record = { id, phase, status, timestamp, summary, validation, next, sourceFiles: manifest, excluded: ["node_modules", ".next", ".env", ".env.local", ".cache", ".data", "research", "checkpoint archives"], archive: `${id}.zip` };
await writeFile(jsonPath, JSON.stringify(record, null, 2) + "\n");
const md = `# ${id}\n\nWaktu: ${timestamp}\nFase: ${phase}\nStatus: **${status}**\n\n## Hasil\n\n${summary}\n\n## Verifikasi\n\n${validation}\n\n## Selanjutnya\n\n${next}\n\n[Manifest](./${id}.json) · [Source archive](./${id}.zip)\n\nCheckpoint ini immutable; baca ../../CHECKPOINT.md untuk keadaan terakhir. Arsip tidak berisi environment rahasia, dependency, hasil build, atau bukti research. Ketika memindahkan ke mesin baru, salin folder research terpisah jika diperlukan dan pasang dependency dari lockfile.\n`;
await writeFile(join(folder, `${id}.md`), md);
const archiveFiles = [...files, relative(root, jsonPath), `docs/checkpoints/${id}.md`];
const py = "import json,sys,zipfile,pathlib; x=json.load(sys.stdin); root=pathlib.Path(x['root']); z=zipfile.ZipFile(x['archive'],'w',zipfile.ZIP_DEFLATED); [z.write(root/f,f) for f in x['files']]; z.close()";
const archived = spawnSync("python3", ["-c", py], { input: JSON.stringify({ root, archive: join(folder, `${id}.zip`), files: archiveFiles }), encoding: "utf8" });
if (archived.status !== 0) throw new Error("Checkpoint source archive failed: " + archived.stderr);
console.log(JSON.stringify({ id, phase, status, sourceFileCount: files.length, checkpoint: "CHECKPOINT.md", archive: `docs/checkpoints/${id}.zip` }));
