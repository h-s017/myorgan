/* Finished-product IFRA screening. No supplier batch or mixture composition is inferred. */
(() => {
  const source = window.HFUGUE_SAFETY_DATA || {};
  const cw = new Map((source.rows || []).map(([id,cat4,cat9,cat10b,hazards,docs]) =>
    [String(id), {limits:{cat4,cat9,cat10b},hazards,docs}]));
  const molecules = new Map((source.singleMolecules || []).map(r => [r.cas,r]));
  function resolve(material) {
    if (!material || material.identityReview) return null;
    const kind = material.kind || ((material.type || []).includes('香基') ? '香基' : '單體');
    if (kind === '單體') {
      const molecule = molecules.get(String(material.cas || '').trim());
      return molecule ? {key:'cas:'+molecule.cas, molecule, limits:molecule.limits} : null;
    }
    const data = cw.get(String(material.id));
    const expected = source.materialNames?.[String(material.id)];
    if (kind !== '香基' || !data || expected !== material.en) return null;
    return {...data,key:'cw:'+material.id};
  }
  function validConcentration(value) {
    const input=String(value ?? '').trim();
    if(!/^\d+(?:\.\d+)?\s*%?$/.test(input))return false;
    const n=Number(input.replace('%','').trim());
    return n>0 && n<=100;
  }
  function evaluateRows(rows, materials, category, fragrancePct, options={}) {
    const materialMap=new Map(materials.map(m=>[String(m.id),m]));
    const totals=new Map();
    rows.forEach(row=>{
      const data=resolve(materialMap.get(String(row.materialId)));
      if(data && Number.isFinite(row.rowPercentNumber) && row.rowPercentNumber>0) {
        totals.set(data.key,(totals.get(data.key)||0)+row.rowPercentNumber*fragrancePct/100);
      }
    });
    return rows.map(row=>{
      if (!(Number(row.amount)>0)) return {level:'review',blank:true,label:'—',detail:''};
      const material=materialMap.get(String(row.materialId));
      const result={level:'review',label:'⚪ 待人工複核',actual:null,limit:null,detail:''};
      if (!material) return {...result,detail:'尚未選擇原料'};
      if(options.mixed || options.drops) return {...result,detail:options.mixed?'請統一重量單位；g 與滴數不可合併':'滴數無法確認重量百分比；請秤重後檢核'};
      if(options.invalidConcentration || !validConcentration(row.concentration) || !(row.rowPercentNumber>0))return {...result,detail:'濃度須大於 0 且不超過 100%；請確認有效香料比例'};
      const actual=row.rowPercentNumber*fragrancePct/100;
      if(!category)return {...result,actual,label:'⚪ 請先選類別',detail:'尚未選擇產品／IFRA 類別'};
      if(material.identityReview)return {...result,actual,detail:material.identityReview};
      const data=resolve(material);
      if (!data) return material.ifraClass==='prohibition'
        ? {...result,actual,level:'prohibited',label:'🔴 禁止使用',limit:0,detail:'IFRA 分級為 Prohibition'}
        : {...result,actual,detail:'尚未建立此原料的查核資料'};
      const aggregateActual=totals.get(data.key);
      const base={...result,actual,aggregateActual,aggregateKey:data.key,limit:data.limits?.[category] ?? null,hazards:data.hazards,detail:'同成分各列已加總；未包含其他複方帶入的未知貢獻。'};
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
