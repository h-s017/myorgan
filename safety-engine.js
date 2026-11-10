/* Finished-product IFRA screening. No supplier batch or mixture composition is inferred. */
(() => {
  const source = window.HFUGUE_SAFETY_DATA || {};
  const cw = new Map((source.rows || []).map(([id,cat4,cat9,cat10b,hazards,docs]) =>
    [String(id), {limits:{cat4,cat9,cat10b},hazards,docs}]));
  const molecules = new Map((source.singleMolecules || []).map(r => [r.cas,r]));
  // Old browser records can retain a previous ID. Resolve CW bases by their
  // original product identity, never by a similar/suggested scent name.
  const normalizeBaseName = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const baseIdsByName = new Map();
  Object.entries(source.materialNames || {}).forEach(([id, name]) => {
    const key = normalizeBaseName(name);
    if (!key) return;
    const ids = baseIdsByName.get(key) || [];
    ids.push(id);
    baseIdsByName.set(key, ids);
  });
  function resolve(material) {
    if (!material || material.identityReview) return null;
    const kind = material.kind || ((material.type || []).includes('香基') ? '香基' : '單體');
    if (kind === '單體') {
      const molecule = molecules.get(String(material.cas || '').trim());
      return molecule ? {key:'cas:'+molecule.cas, molecule, limits:molecule.limits} : null;
    }
    if (kind !== '香基') return null;
    const id = String(material.id);
    const name = normalizeBaseName(material.en);
    const expected = normalizeBaseName(source.materialNames?.[id]);
    // If an ID belongs to a different known CW base, reject it rather than
    // silently assigning that base's IFRA limits to the wrong formula item.
    if (cw.has(id) && expected === name) return {...cw.get(id),key:'cw:'+id};
    const candidates = baseIdsByName.get(name) || [];
    if (candidates.length !== 1) return null;
    const canonicalId = candidates[0];
    const data = cw.get(canonicalId);
    return data ? {...data,key:'cw:'+canonicalId} : null;
  }
  function validConcentration(value) {
    const input=String(value ?? '').trim();
    if(!/^\d+(?:\.\d+)?\s*%?$/.test(input))return false;
    const n=Number(input.replace('%','').trim());
    return n>0 && n<=100;
  }
  function concentrationRatio(value) {
    const input=String(value??'').trim();
    const n=Number(input.replace('%','').trim());
    return (!input.includes('%') && n>0 && n<=1 ? n*100 : n)/100;
  }
  function evaluateRows(rows, materials, category, fragrancePct, options={}) {
    const materialMap=new Map(materials.map(m=>[String(m.id),m]));
    const active=rows.filter(r=>Number(r.amount)>0);
    const measuredComplete=active.length>0&&active.every(r=>
      String(r.actualIngredientG??'').trim()!=='' &&
      Number.isFinite(Number(r.actualIngredientG)) && Number(r.actualIngredientG)>=0 &&
      validConcentration(r.concentration)
    );
    const totalMeasuredStockG=measuredComplete
      ? active.reduce((sum,r)=>sum+Number(r.actualIngredientG),0):0;
    const totalMeasuredEffectiveG=measuredComplete
      ? active.reduce((sum,r)=>sum+Number(r.actualIngredientG)*concentrationRatio(r.concentration),0):0;
    const useMeasured=options.calculationBasis !== 'target';
    const hasMeasured=useMeasured && measuredComplete && totalMeasuredEffectiveG>0;
    const actualBase=options.actualBaseG;
    const hasFinishedMass=hasMeasured && actualBase!=null &&
      Number.isFinite(Number(actualBase)) && Number(actualBase)>=0 &&
      totalMeasuredStockG+Number(actualBase)>0;
    const measuredBasis=hasMeasured
      ? (hasFinishedMass?'實際完成成品重量':'依目標香精濃度與實秤比例估算')
      : null;
    const measuredMass=totalMeasuredStockG+Number(actualBase||0);
    const measuredUsage=row => {
      const effective=Number(row.actualIngredientG)*concentrationRatio(row.concentration);
      return hasFinishedMass ? effective/measuredMass*100 :
        effective/totalMeasuredEffectiveG*fragrancePct;
    };
    const totals=new Map();
    rows.forEach(row=>{
      const data=resolve(materialMap.get(String(row.materialId)));
      const percent=hasMeasured ? measuredUsage(row) : row.rowPercentNumber*fragrancePct/100;
      if(data && Number(row.amount)>0 && Number.isFinite(percent) && percent>=0) {
        totals.set(data.key,(totals.get(data.key)||0)+percent);
      }
    });
    return rows.map(row=>{
      if (!(Number(row.amount)>0)) return {level:'review',blank:true,label:'—',detail:''};
      const material=materialMap.get(String(row.materialId));
      const result={level:'review',label:'⚪ 待人工複核',actual:null,limit:null,detail:''};
      if (!material) return {...result,detail:'尚未選擇原料'};
      if(useMeasured && !hasMeasured)
        return {...result,detail:'已選擇實際秤重：請完整輸入每項使用原料的實際加入香精 g（不可依滴數推算）'};
      if(!useMeasured && (options.mixed || options.drops))
        return {...result,detail:'目標配方模式下，滴數無法確認重量百分比；請改用 g 或選擇實際秤重模式'};
      if(!validConcentration(row.concentration) || (!hasFinishedMass && options.invalidConcentration) ||
        (!hasMeasured && !(row.rowPercentNumber>0)))
        return {...result,detail:'請確認原料濃度與目標成品香精濃度'};
      const actual=hasMeasured?measuredUsage(row):row.rowPercentNumber*fragrancePct/100;
      if(!category)return {...result,actual,label:'⚪ 請先選類別',detail:'尚未選擇產品／IFRA 類別'};
      if(material.identityReview)return {...result,actual,detail:material.identityReview};
      const data=resolve(material);
      if (!data) return material.ifraClass==='prohibition'
        ? {...result,actual,level:'prohibited',label:'🔴 禁止使用',limit:0,detail:'IFRA 分級為 Prohibition'}
        : {...result,actual,detail:'尚未建立此原料的查核資料'};
      const aggregateActual=totals.get(data.key);
      const base={...result,actual,aggregateActual,aggregateKey:data.key,limit:data.limits?.[category] ?? null,hazards:data.hazards,
        basis:measuredBasis||'目標配方比例',detail:(measuredBasis||'目標配方比例')+'；同一原料各列已加總，未包含其他複方未知成分的貢獻。'};
      if(data.molecule && base.limit==null)return {...base,label:'⚪ 待規格複核',detail:data.molecule.specification || '未查得獨立數值限量；仍須供應商文件與成品安全評估。'};
      if(!data.molecule && (data.docs!=='ready' || base.limit==null))return {...base,label:'⚪ 文件／數值待複核',detail:data.docs==='missing'?'供應商文件缺件':'此類別限量資料不足'};
      const usage=base.limit>0?aggregateActual/base.limit*100:Infinity;
      if(aggregateActual>base.limit+1e-10)return {...base,usage,level:'over',label:'🔴 同成分合計超量'};
      if(usage>=80)return {...base,usage,level:'near',label:'🟡 同成分接近上限'};
      if(data.molecule)return {...base,usage,label:'⚪ 數值未超量・待規格確認',numericWithinLimit:true,detail:(data.molecule.specification || data.molecule.supplierStatus)+' 同成分各列已加總；其他複方來源仍需核對。'};
      return {...base,usage,level:'ok',label:'🟢 未超量'};
    });
  }
  window.HFUGUE_FORMULA_SAFETY={resolve,evaluateRows,validConcentration};
})();
