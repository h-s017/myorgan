window.HFUGUE_CONFIG = window.HFUGUE_CONFIG || {};
window.HFUGUE_CONFIG.APP_VERSION = '2026-05-20-material-export-formula-fix';

(function(){
  const fmtG = (v) => (Number(v || 0)).toFixed(3).replace(/\.?0+$/,'') + ' g';
  const fmtDrops = (v) => (Number(v || 0)).toFixed(1).replace(/\.0$/,'') + ' 滴';
  const fmtWeight = (v) => (Number(v || 0)).toFixed(2).replace(/\.00$/,'');

  function patchFormulaLabels(){
    const totalG = document.getElementById('totalG');
    if(totalG && totalG.previousElementSibling){
      totalG.previousElementSibling.textContent = '香料實秤總克數';
    }
    document.querySelectorAll('th').forEach(th => {
      if(th.textContent.trim() === '需要的原料 g') th.textContent = '實際需秤 g';
    });
  }

  function installFormulaFix(){
    if(typeof collectRowsFromDom !== 'function' || typeof parseConcentration !== 'function' || typeof num !== 'function'){
      return false;
    }

    recalc = function(){
      collectRowsFromDom();

      const gRows = rows.filter(r => r.unit === 'g' && num(r.amount) > 0);
      const dropRows = rows.filter(r => r.unit === '滴' && num(r.amount) > 0);
      const inputG = gRows.reduce((s,r) => s + num(r.amount), 0);
      const totalDrops = dropRows.reduce((s,r) => s + num(r.amount), 0);
      const gWeight = gRows.reduce((s,r) => s + parseConcentration(r.concentration) * num(r.amount), 0);
      const dropWeight = dropRows.reduce((s,r) => s + parseConcentration(r.concentration) * num(r.amount), 0);

      const cap = num(document.getElementById('perfumeCapacity')?.value);
      const fragrancePct = parseConcentration(document.getElementById('perfumeConcentration')?.value || '20%');
      const targetFragranceG = cap * fragrancePct / 100;
      const mixed = inputG > 0 && totalDrops > 0;
      let totalStockG = 0;

      const warn = document.getElementById('mixWarn');
      if(warn){
        warn.classList.toggle('show', mixed);
        if(mixed){
          warn.textContent = '提醒：同一張配方表請統一使用 g 或滴數。g 與滴數不能直接合併成同一個比例分母；系統暫停計算「佔比 %」與「實際需秤 g」。';
        }
      }

      [...document.querySelectorAll('#formulaRows tr')].forEach((tr,i) => {
        const r = rows[i];
        let pct = 0;
        let targetEffectiveG = 0;
        let requiredStockG = 0;
        const ingredientPct = parseConcentration(r.concentration);
        const ingredientRatio = ingredientPct / 100;

        if(!mixed){
          if(r.unit === 'g'){
            pct = gWeight ? (parseConcentration(r.concentration) * num(r.amount)) / gWeight * 100 : 0;
          }else{
            pct = dropWeight ? (parseConcentration(r.concentration) * num(r.amount)) / dropWeight * 100 : 0;
          }

          targetEffectiveG = pct && targetFragranceG ? targetFragranceG * pct / 100 : 0;
          requiredStockG = ingredientRatio > 0 ? targetEffectiveG / ingredientRatio : 0;
          totalStockG += requiredStockG;
        }

        tr.querySelector('.r-percent').textContent = mixed ? '請統一單位' : (pct ? pct.toFixed(2) + '%' : '—');
        tr.querySelector('.r-target').textContent = mixed ? '—' : (requiredStockG ? requiredStockG.toFixed(3) + ' g' : '—');

        r.rowPercent = (!mixed && pct) ? pct.toFixed(2) + '%' : '';
        r.rowPercentNumber = (!mixed && pct) ? pct : 0;
        r.targetEffectiveG = (!mixed && targetEffectiveG) ? +targetEffectiveG.toFixed(3) : 0;
        r.targetIngredientG = (!mixed && requiredStockG) ? +requiredStockG.toFixed(3) : 0;
      });

      const totalGEl = document.getElementById('totalG');
      const totalDropsEl = document.getElementById('totalDrops');
      const totalDropWeightEl = document.getElementById('totalDropWeight');
      const totalCapacityEl = document.getElementById('totalCapacity');
      const totalFragranceGEl = document.getElementById('totalFragranceG');

      if(totalGEl) totalGEl.textContent = fmtG(mixed ? 0 : totalStockG);
      if(totalDropsEl) totalDropsEl.textContent = fmtDrops(totalDrops);
      if(totalDropWeightEl) totalDropWeightEl.textContent = fmtWeight(gWeight || dropWeight);
      if(totalCapacityEl) totalCapacityEl.textContent = fmtG(cap);
      if(totalFragranceGEl) totalFragranceGEl.textContent = fmtG(targetFragranceG);

      if(typeof storeFormulaState === 'function') storeFormulaState();
    };

    buildPayload = function(){
      const materialMap = Object.fromEntries(db.map(m => [String(m.id), m]));
      const meta = collectMetaFromDom();
      const cap = num(meta.perfumeCapacity);
      const fragrancePct = parseConcentration(meta.perfumeConcentration || '20%');
      return {
        formulaId: activeFormulaId,
        studentName: meta.studentName,
        classSession: meta.classSession,
        workName: meta.workName,
        formulaDate: meta.formulaDate,
        weather: meta.weather,
        temperature: meta.temperature,
        quickNote: meta.quickNote,
        note: meta.designNote,
        perfumeCapacity: cap,
        perfumeConcentration: meta.perfumeConcentration || '',
        perfumeConcentrationPercent: fragrancePct,
        totals: {
          materialTotalG: num(document.getElementById('totalG')?.textContent),
          materialTotalDrops: num(document.getElementById('totalDrops')?.textContent),
          dropWeightTotal: num(document.getElementById('totalDropWeight')?.textContent),
          perfumeCapacityG: cap,
          targetFragranceG: num(document.getElementById('totalFragranceG')?.textContent)
        },
        formula: rows.map((r,i) => {
          const m = materialMap[String(r.materialId)] || {};
          return {
            index: i + 1,
            materialId: r.materialId,
            materialEn: m.en || '',
            materialCn: m.cn || '',
            kind: m.kind || '',
            types: m.type || [],
            concentration: r.concentration,
            concentrationPercent: parseConcentration(r.concentration),
            amount: num(r.amount),
            unit: r.unit,
            rowPercent: r.rowPercent,
            rowPercentNumber: r.rowPercentNumber,
            targetEffectiveG: r.targetEffectiveG || 0,
            targetIngredientG: r.targetIngredientG || 0,
            reason: r.reason
          };
        })
      };
    };

    patchFormulaLabels();
    recalc();
    return true;
  }

  function bootFormulaFix(){
    patchFormulaLabels();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if(installFormulaFix() || attempts > 20) clearInterval(timer);
    }, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootFormulaFix);
  }else{
    bootFormulaFix();
  }
})();


(function(){
  function downloadJson(filename, data){
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function exportMaterials(){
    if(!Array.isArray(db)){
      alert('目前讀不到原料庫，請重新整理後再試。');
      return;
    }
    const data = {
      type: 'hfugue-organ-material-db',
      appVersion: window.HFUGUE_CONFIG?.APP_VERSION || '',
      exportedAt: new Date().toISOString(),
      materialCount: db.length,
      materials: db
    };
    downloadJson('hfugue-materials-179-backup.json', data);
  }

  function extractMaterialsFromJson(data){
    if(Array.isArray(data)) return data;
    if(data && Array.isArray(data.materials)) return data.materials;
    if(data && Array.isArray(data.db)) return data.db;
    return null;
  }

  function importMaterialsFromFile(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        const materials = extractMaterialsFromJson(data);
        if(!materials || !materials.length){
          alert('這不是有效的原料庫 JSON。請確認檔案內有 materials 陣列。');
          return;
        }
        const cleaned = materials.map((item, index) => {
          const next = {...item};
          if(next.id == null || next.id === '') next.id = index + 1;
          if(!Array.isArray(next.note)) next.note = next.note ? [next.note] : [];
          if(!Array.isArray(next.type)) next.type = next.type ? [next.type] : [];
          if(!Array.isArray(next.alias)) next.alias = next.alias ? [next.alias] : [];
          if(!Array.isArray(next.advisors)) next.advisors = [];
          if(typeof normalizeItem === 'function') return normalizeItem(next);
          return next;
        });
        db = cleaned;
        if(typeof saveDb === 'function') saveDb();
        if(typeof renderLibrary === 'function') renderLibrary();
        if(typeof renderFormula === 'function') renderFormula();
        alert(`已匯入 ${db.length} 種原料。`);
      }catch(err){
        console.error(err);
        alert('JSON 讀取失敗，請確認檔案格式。');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function injectMaterialDbButtons(){
    if(document.getElementById('materialExportBtn')) return;
    const topActions = document.querySelector('.top-actions');
    if(!topActions) return;

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn';
    exportBtn.id = 'materialExportBtn';
    exportBtn.textContent = '下載原料庫 JSON';
    exportBtn.addEventListener('click', exportMaterials);

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'btn';
    importBtn.id = 'materialImportBtn';
    importBtn.textContent = '上傳原料庫 JSON';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.id = 'materialJsonUpload';
    input.className = 'hidden-file';
    input.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      importMaterialsFromFile(file);
      event.target.value = '';
    });
    importBtn.addEventListener('click', () => input.click());

    const installBtn = document.getElementById('installAppBtn');
    if(installBtn){
      topActions.insertBefore(exportBtn, installBtn);
      topActions.insertBefore(importBtn, installBtn);
      topActions.insertBefore(input, installBtn);
    }else{
      topActions.appendChild(exportBtn);
      topActions.appendChild(importBtn);
      topActions.appendChild(input);
    }
  }

  function bootMaterialDbTools(){
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      injectMaterialDbButtons();
      if(document.getElementById('materialExportBtn') || attempts > 30) clearInterval(timer);
    }, 100);
  }

  window.HFUGUE_MATERIAL_DB_TOOLS = {
    exportMaterials,
    importMaterialsFromFile
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootMaterialDbTools);
  }else{
    bootMaterialDbTools();
  }
})();
