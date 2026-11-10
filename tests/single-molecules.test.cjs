const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},console});
for(const name of ['safety-data.js','material-catalog.js','safety-engine.js'])
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
const {HFUGUE_SAFETY_DATA:data,HFUGUE_CATALOG:catalog,HFUGUE_FORMULA_SAFETY:engine}=context.window;
assert.equal(data.singleMolecules.length,14);
assert.equal(new Set(data.singleMolecules.map(r=>r.cas)).size,14);
const materials=data.singleMolecules.map(r=>catalog.enrich({id:r.id,cas:r.cas,en:r.en,kind:'單體',personal:'my notes',advisors:[{name:'Hana',text:'keep'}]}));
for(const m of materials){assert.equal(m.personal,'my notes');assert.equal(m.advisors[0].text,'keep');assert.ok(m.reference.sources.length);}
const helional=materials.find(m=>m.cas==='1205-17-0');
const citronellol=materials.find(m=>m.cas==='106-22-9');
const cyclamen=materials.find(m=>m.cas==='103-95-7');
const row=(m,pct,extra={})=>({materialId:m.id,rowPercentNumber:pct,amount:1,unit:'g',concentration:'100%',...extra});
const check=(rows,cat='cat4',pct=15,opts={})=>engine.evaluateRows(rows,materials,cat,pct,opts);
// Different product categories have genuinely different restrictions.
assert.equal(check([row(cyclamen,3)])[0].numericWithinLimit,true);
assert.equal(check([row(cyclamen,3)],'cat9')[0].level,'over');
assert.equal(check([row(cyclamen,3)],'cat10b')[0].numericWithinLimit,true);
// One ingredient repeated in multiple rows must be aggregated.
const split=check([row(helional,8),row(helional,8)],'cat4',20);
assert.equal(split[0].level,'over');assert.equal(split[1].level,'over');assert.ok(Math.abs(split[0].aggregateActual-3.2)<1e-9);
const duplicate={...citronellol,id:2005};
assert.equal(engine.evaluateRows([row(citronellol,31),row(duplicate,31)],[...materials,duplicate],'cat4',20)[0].level,'over');
// Exact thresholds, not rounded display strings, determine the result.
assert.equal(check([row(helional,13)],'cat4',20)[0].level,'near');
assert.equal(check([row(helional,13.001)],'cat4',20)[0].level,'over');
for(const m of materials.filter(m=>!m.reference.limits)) {
  const result=check([row(m,10)])[0];assert.equal(result.level,'review');assert.equal(result.limit,null);
}
assert.equal(check([row(helional,1)],'cat4',20,{drops:true})[0].level,'review');
assert.equal(check([row(helional,1)],'cat4',20,{mixed:true})[0].actual,null);
assert.equal(check([row(helional,1,{concentration:'200%'})])[0].level,'review');
assert.equal(check([row(helional,1)],'',20)[0].level,'review');
assert.equal(check([{amount:1,concentration:'100%',rowPercentNumber:100}])[0].blank,undefined);
// A similarly named base, mismatched CW ID/name, or uncertain legacy record never receives pure-molecule limits.
assert.equal(engine.resolve({...helional,kind:'香基'}),null);
assert.equal(engine.resolve({id:1001,en:'Custom mix',kind:'香基'}),null);
assert.equal(engine.resolve(catalog.enrich({id:20,en:'Undercavertol',cas:'67694-66-6'})),null);
assert.equal(engine.resolve({id:1001,en:'Bitter Lemon',kind:'香基'}).limits.cat4,11.049);

const weighedBases=[
  {id:1001,en:'Bitter Lemon',kind:'香基'},
  {id:1062,en:'Musk',kind:'香基'}
];
const weighedRows=[
  {materialId:1001,amount:2,unit:'滴',concentration:'100%',actualIngredientG:'0.21',rowPercentNumber:50},
  {materialId:1062,amount:7,unit:'滴',concentration:'100%',actualIngredientG:'0.82',rowPercentNumber:50}
];
const targetMeasured=engine.evaluateRows(weighedRows,weighedBases,'cat4',20,{drops:true});
assert.notEqual(targetMeasured[0].level,'review');
assert.equal(targetMeasured[0].basis,'依目標香精濃度與實秤比例估算');
assert.ok(Math.abs(targetMeasured[0].actual-0.21/1.03*20)<1e-9);
const finishedMeasured=engine.evaluateRows(weighedRows,weighedBases,'cat4',20,{drops:true,actualBaseG:8.97});
assert.equal(finishedMeasured[0].basis,'實際完成成品重量');
const selectedActual=engine.evaluateRows(weighedRows,weighedBases,'cat4',20,{drops:true,calculationBasis:'actual',actualBaseG:8.97});
assert.ok(Math.abs(selectedActual[0].actual-2.1)<1e-9);
const selectedTargetDrop=engine.evaluateRows(weighedRows,weighedBases,'cat4',20,{drops:true,calculationBasis:'target'});
assert.equal(selectedTargetDrop[0].level,'review');
const selectedTargetGrams=engine.evaluateRows(weighedRows.map(r=>({...r,unit:'g'})),weighedBases,'cat4',20,{calculationBasis:'target'});
assert.notEqual(selectedTargetGrams[0].level,'review');
assert.ok(Math.abs(selectedTargetGrams[0].actual-10)<1e-9);
const selectedActualIncomplete=engine.evaluateRows(weighedRows.map((r,i)=>i?{...r,actualIngredientG:''}:r),weighedBases,'cat4',20,{calculationBasis:'actual'});
assert.equal(selectedActualIncomplete[0].level,'review');
const measuredOnly=[{materialId:1001,amount:'',unit:'滴',concentration:'100%',actualIngredientG:'0.78',rowPercentNumber:0}];
const measuredOnlyResult=engine.evaluateRows(measuredOnly,[{id:1001,en:'Bitter Lemon',kind:'香基'}],'cat4',20,{calculationBasis:'actual',actualBaseG:9.22});
assert.ok(Math.abs(measuredOnlyResult[0].actual-7.8)<1e-9);
assert.equal(measuredOnlyResult[0].basis,'實際完成成品重量');
const missingOne=engine.evaluateRows([weighedRows[0],{...weighedRows[1],actualIngredientG:''}],weighedBases,'cat4',20,{calculationBasis:'actual'});
assert.match(missingOne[0].detail,/1 項原料未填/);
assert.equal(engine.evaluateRows(measuredOnly,[{id:1001,en:'Bitter Lemon',kind:'香基'}],'cat4',20,{calculationBasis:'actual'})[0].basis,'依目標香精濃度與實秤比例估算');


assert.ok(Math.abs(finishedMeasured[0].actual-2.1)<1e-9);
assert.equal(engine.evaluateRows([{...weighedRows[0]}, {...weighedRows[1],actualIngredientG:''}],weighedBases,'cat4',20,{drops:true})[0].level,'review');
assert.equal(engine.evaluateRows(weighedRows,weighedBases,'cat4',20,{drops:true,actualBaseG:8.97})[0].aggregateKey,'cw:1001');


 // Legacy localStorage IDs may differ from the CW master database.
const historicalBase={id:9001,en:' Bitter   Lemon ',kind:'香基'};
assert.equal(engine.resolve(historicalBase).limits.cat4,11.049);
assert.equal(engine.resolve({id:9002,en:'BITTER LEMON',kind:'香基'}).key,'cw:1001');
assert.equal(engine.resolve({id:9003,en:'Bitter Lemon fragrance',kind:'香基'}),null);
assert.equal(engine.resolve({id:9004,en:'Bitter Lemon',kind:'單體'}),null);
assert.equal(engine.resolve({id:1001,en:'Not the supplier base',kind:'香基'}),null);
const legacyRows=[row(historicalBase,20),row({id:1001,en:'Bitter Lemon',kind:'香基'},20)];
const legacyResults=engine.evaluateRows(legacyRows,[historicalBase,{id:1001,en:'Bitter Lemon',kind:'香基'}],'cat4',30);
assert.equal(legacyResults[0].level,'over');
assert.equal(legacyResults[1].aggregateActual,12);

// Existing ID and personal notes survive a once-only reference correction.
const old=catalog.enrich({id:13,en:'Helional',cas:'1205-17-0',inci:'HELIONAL',ifra:'查無特定限制',ifraClass:'no_specific_standard',personal:'keep',advisors:[]});
assert.equal(old.id,13);assert.equal(old.inci,'METHYLENEDIOXYPHENYL METHYLPROPANAL');assert.equal(old.personal,'keep');
old.ifra='my later note';assert.equal(catalog.enrich(old).ifra,'my later note');
// Exercise the real app migration with saved browser data, including ID collision and reload idempotence.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=html.match(/<script>\s*const SUBMIT_FALLBACK[\s\S]*?<\/script>/)[0].replace(/^<script>/,'').replace(/<\/script>$/,'').replace('\ninit();','');
const storage=new Map();
context.HFUGUE_CATALOG=catalog;
context.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
vm.runInContext(app,context);
vm.runInContext(`localStorage.setItem(DB_KEY,JSON.stringify([
  {id:13,en:'Helional',cn:'新洋茉莉醛',cas:'1205-17-0',personal:'PRIVATE NOTE',advisors:[{name:'Me',text:'PRIVATE ADVICE'}]},
  {id:3001,en:'My custom material',cn:'自訂',cas:'custom',personal:'custom note'}
])); loadDb();`,context);
let migrated=vm.runInContext('JSON.parse(JSON.stringify(db))',context);
assert.equal(migrated.find(m=>m.id===13).personal,'PRIVATE NOTE');
assert.equal(migrated.find(m=>m.id===13).advisors[0].text,'PRIVATE ADVICE');
assert.equal(migrated.find(m=>m.id===3001).en,'My custom material');
assert.equal(new Set(migrated.map(m=>m.id)).size,migrated.length);
assert.equal(new Set(migrated.filter(m=>m.reference).map(m=>m.cas)).size,14);
const count=migrated.length;vm.runInContext('loadDb()',context);
assert.equal(vm.runInContext('db.length',context),count);
assert.equal(vm.runInContext("parseConcentration('1%')",context),1);
assert.equal(vm.runInContext("parseConcentration('0.5%')",context),.5);
assert.equal(vm.runInContext("parseConcentration('0.15')",context),15);
console.log('PASS: 14 identities, categories, aggregate limits, missing data, units, migration, notes, IDs, reloads, percentages');
