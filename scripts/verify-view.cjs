// Scope-specific, self-contained regression guard; earlier guards remain historical.
const fs=require('node:fs'),crypto=require('node:crypto'),ts=require('typescript');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),printer=ts.createPrinter({removeComments:true}),print=(n,s)=>printer.printNode(ts.EmitHint.Unspecified,n,s);
function syntax(text,name){
 const s=ts.createSourceFile(name+'.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),body=s.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).body.statements;
 const logic=body.filter(n=>!ts.isReturnStatement(n)).map(n=>print(n,s).replace(/(\[showPanel,\s*setShowPanel\]\s*=\s*useState\()false(\))/g,'$1true$2'));
 const handlers=[],bindings=[],effects=[],clicks=[];
 function visit(n){
  if(ts.isJsxAttribute(n)){const key=n.name.getText(s),parent=n.parent.parent.tagName?.getText(s);if(/^on[A-Z]/.test(key)&&parent!=='MapDetectionPanel')handlers.push(print(n,s));
   const newPresentation=(parent==='MapView'&&['searchControls','filterControls','sourceStatus'].includes(key))||parent==='MapDetectionPanel';
   if(!newPresentation&&n.initializer&&ts.isJsxExpression(n.initializer)&&!['className','style','fill','stroke','strokeWidth','opacity'].includes(key))bindings.push(print(n,s));
  }
  if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='useEffect') {const t=n.getText(s);if(t.includes("getSource('hotspots')")&&!t.includes('new lib.Map')||t.includes('const location=props.location,current=map.current')||t.includes('new ResizeObserver'))effects.push(print(n,s));}
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='on'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text==='click')clicks.push(print(n,s));
  ts.forEachChild(n,visit);
 }
 visit(s);return {logic:hash(JSON.stringify(logic)),handlers:hash(JSON.stringify(handlers.sort())),bindings:hash(JSON.stringify(bindings.sort())),effects:hash(JSON.stringify(effects)),clicks:hash(JSON.stringify(clicks)),handlerCount:handlers.length};
}
if(process.argv.includes('--seed')){
 const baseline=JSON.parse(fs.readFileSync('docs/checkpoints/MAP-F-01-validation-handoff.json'));
 const files=Object.fromEntries(Object.entries(baseline.sourceFiles).filter(([p])=>p.startsWith('src/lib/')||p.startsWith('src/app/api/')||['src/components/air/LocationPanels.tsx','src/components/air/useAirData.ts','src/data/geography-manifest.json','src/data/indonesia.json','src/data/places.json','package.json','package-lock.json','next.config.ts','tsconfig.json','.env.example'].includes(p)));
 const components=Object.fromEntries(['HotspotMonitor','MapView'].map(name=>[name,syntax(fs.readFileSync('/tmp/lentera-view-baseline-'+name+'.tsx','utf8'),name)]));
 fs.writeFileSync('docs/verification/view-workspace/baseline.json',JSON.stringify({baseline:baseline.id,files,components,allowedNormalization:'Only initial showPanel false -> true for baseline comparison; visibility default changed intentionally. New JSX presentation slots excluded from binding fingerprints.'},null,2)+'\n');
}
const baseline=JSON.parse(fs.readFileSync('docs/verification/view-workspace/baseline.json'));
const current=Object.fromEntries(['HotspotMonitor','MapView'].map(name=>[name,syntax(fs.readFileSync('src/components/map/'+name+'.tsx','utf8'),name)]));
const b=baseline.components,report={checkedAt:new Date().toISOString(),protectedFiles:Object.keys(baseline.files).length,changedProtectedFiles:Object.keys(baseline.files).filter(p=>hash(fs.readFileSync(p))!==baseline.files[p]),hotspot:{logicPreservedExceptVisibility:current.HotspotMonitor.logic===b.HotspotMonitor.logic,handlersPreserved:current.HotspotMonitor.handlers===b.HotspotMonitor.handlers,oldBindingsPreserved:current.HotspotMonitor.bindings===b.HotspotMonitor.bindings,handlerCount:current.HotspotMonitor.handlerCount},map:{clickHandlerPreserved:current.MapView.clicks===b.MapView.clicks,dataLocationAndResizeEffectsPreserved:current.MapView.effects===b.MapView.effects,engineNotReplaced:fs.readFileSync('src/components/map/MapView.tsx','utf8').includes('instance=new lib.Map('),styleNotReplaced:!fs.readFileSync('src/components/map/MapView.tsx','utf8').includes('.setStyle(')},limitations:'Static source/AST check; not browser interaction, visible-area accuracy, tile rendering or FPS proof. New scene provider and viewport adapter/presentation changes intentionally within VIEW scope.'};
report.passed=!report.changedProtectedFiles.length&&Object.entries(report.hotspot).filter(([k])=>k!=='handlerCount').every(([,v])=>v)&&Object.values(report.map).every(Boolean);
fs.writeFileSync('docs/verification/view-workspace/source-guard.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
