// Scope-aware source guard. Keeps the immutable UI-only baseline/report intact.
const fs = require('node:fs'), crypto = require('node:crypto'), ts = require('typescript');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const baseline = JSON.parse(fs.readFileSync('docs/verification/ui-redesign/baseline.json'));
const syntax = JSON.parse(fs.readFileSync('docs/verification/ui-redesign/baseline-syntax.json'));
const printer = ts.createPrinter({ removeComments: true }), print = (n, s) => printer.printNode(ts.EmitHint.Unspecified, n, s);
const oldFiles = baseline.protectedFiles.filter(p => !['package.json','package-lock.json'].includes(p));
const report = { checkedAt: new Date().toISOString(), protectedOldModules: { total: oldFiles.length, changed: oldFiles.filter(p => hash(fs.readFileSync(p)) !== baseline.sourceHashes[p]) }, components: {} };
for (const name of ['HotspotMonitor','AirPanel','AirChart']) {
  const spec = syntax.components[name], source = ts.createSourceFile(spec.path, fs.readFileSync(spec.path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const body = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).body.statements;
  const logic = body.filter(n => !ts.isReturnStatement(n)).map(n => print(n, source)), handlers = [], bindings = [];
  function visit(n) {
    if (ts.isJsxAttribute(n)) {
      const key = n.name.getText(source);
      if (/^on[A-Z]/.test(key)) handlers.push(print(n, source));
      const newMapProp = name === 'HotspotMonitor' && ['hexData','dataState','periodLabel','selectedId'].includes(key) && n.parent.parent.tagName?.getText(source) === 'MapView';
      if (!newMapProp && n.initializer && ts.isJsxExpression(n.initializer) && !['className','style','fill','stroke','strokeWidth','opacity'].includes(key)) bindings.push(print(n, source));
    }
    ts.forEachChild(n, visit);
  }
  visit(source);
  report.components[name] = { preReturnLogicPreserved: hash(JSON.stringify(logic)) === spec.logicSha256, existingHandlersPreserved: hash(JSON.stringify(handlers.sort())) === spec.handlersSha256, existingDataBindingsPreserved: hash(JSON.stringify(bindings.sort())) === spec.bindingsSha256 };
}
const before = JSON.parse(fs.readFileSync('docs/verification/MAP-dependency-baseline.json'));
if (before.originalPackageSha256 !== baseline.sourceHashes['package.json'] || before.originalLockSha256 !== baseline.sourceHashes['package-lock.json']) throw Error('Dependency baseline identity differs');
const after = JSON.parse(fs.readFileSync('package.json')), lb = before.lockPackageHashes, la = JSON.parse(fs.readFileSync('package-lock.json')).packages;
report.dependencies = { oldDirectVersionsUnchanged: ['dependencies','devDependencies'].every(key => Object.entries(before[key]).every(([name,version]) => after[key][name] === version)), addedDirect: Object.keys(after.dependencies).filter(name => !(name in before.dependencies)), oldLockPackagesChanged: Object.keys(lb).filter(key => key && lb[key] !== hash(JSON.stringify(la[key] ?? null))), addedLockPackages: Object.keys(la).filter(key => key && !(key in lb)), h3Pinned: after.dependencies['h3-js'] === '4.5.0' && la['node_modules/h3-js'].resolved === 'https://registry.npmjs.org/h3-js/-/h3-js-4.5.0.tgz' };
const map = fs.readFileSync('src/components/map/MapView.tsx','utf8');
report.mapReview = { engineStillMapLibre: map.includes("instance=new lib.Map("), initializationDependencies: map.includes('},[apiKey,retry]);'), resizeObserverRetained: map.includes('new ResizeObserver('), clickPriorityClusterPointHexLocation: map.indexOf('const cluster=') < map.indexOf('const detection=') && map.indexOf('const detection=') < map.indexOf('const cell=') && map.indexOf('const cell=') < map.indexOf('latest.current.onLocation('), note: 'Map presentation/effects and hex click branch intentionally changed. These static checks do not establish runtime behavior.' };
report.passed = !report.protectedOldModules.changed.length && Object.values(report.components).every(v => Object.values(v).every(Boolean)) && report.dependencies.oldDirectVersionsUnchanged && report.dependencies.h3Pinned && !report.dependencies.oldLockPackagesChanged.length && JSON.stringify(report.dependencies.addedDirect) === '["h3-js"]' && JSON.stringify(report.dependencies.addedLockPackages) === '["node_modules/h3-js"]' && Object.entries(report.mapReview).filter(([key]) => key !== 'note').every(([,value]) => value);
report.limitations = 'Source/AST/dependency guard only; browser rendering, responsive geometry, clicks and FPS remain separate checks. New map/grid modules are within the explicit MAP scope, not the earlier UI-only scope.';
fs.writeFileSync('docs/verification/MAP-source-guard.json', JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2)); if (!report.passed) process.exitCode = 1;
