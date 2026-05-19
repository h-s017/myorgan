window.HFUGUE_CONFIG = window.HFUGUE_CONFIG || {};
window.HFUGUE_CONFIG.APP_VERSION = '2026-05-20-cloud-sync-v1';
window.HFUGUE_CONFIG.CLOUD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyu8ckzH_X11ziS5J6Dz7lUNHpLMnRsLAUt1PCozG02N4mC34NSn072_wrf5_oFSJSH3w/exec';

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



// ================================
// H.FUGUE ORGAN｜Personal Cloud Sync v1
// Built-in material database: 181 materials
// Cloud endpoint: Google Apps Script
// ================================
(function(){
  const CLOUD_ENDPOINT = window.HFUGUE_CONFIG && window.HFUGUE_CONFIG.CLOUD_ENDPOINT;
  const APP_VERSION = window.HFUGUE_CONFIG && window.HFUGUE_CONFIG.APP_VERSION || 'cloud-sync-v1';
  const EMBEDDED_MATERIAL_DB = {"type":"hfugue-organ-material-db","appVersion":"2026-05-20-material-export-formula-fix","exportedAt":"2026-05-19T18:39:56.302Z","materialCount":181,"materials":[{"id":1,"en":"Methyl Benzoate","cn":"苯甲酸甲酯","note":["Top"],"type":["Floral"],"alias":[],"cas":"93-58-3","inci":"METHYL BENZOATE","ifra":"IFRA 第51版：無限制（Cat.4）。EU：最高0.5%，防腐劑管制V/1a。","personal":"① 剛聞到的刺鼻味，直接延伸到鼻腔深處。\n② 類似成熟的香蕉感，濃度高時會有厭氧感。\n③ 香蕉味和花香，持香度中等。","advisors":[{"name":"Re.","text":"呈現出杏仁、釋迦、厭氧感與沙龍巴斯的特徵。"}],"kind":"單體"},{"id":2,"en":"Ebanol","cn":"黑檀醇","note":["Base"],"type":["Woody"],"alias":["Matsunol","Muscosandrol"],"cas":"67801-20-1","inci":"SANDAL PENTENOL","ifra":"IFRA 第51版：Cat.4無特定限制。建議0.5–5%。Givaudan研發。","personal":"① 回甘、甜味的中藥材、八角味，圓潤感，使心情愉快。\n② 木質香料感，鼻腔中段。\n③ 檀木香氣非常持香。","advisors":[{"name":"Re.","text":"適合與白色花系（如茉莉花）進行搭配。"}],"kind":"單體"},{"id":3,"en":"Para-Cresyl Acetate","cn":"對甲酚乙酸酯","note":["Middle"],"type":["Floral"],"alias":["p-Cresyl Acetate","Narceol"],"cas":"140-39-6","inci":"P-CRESYL ACETATE","ifra":"IFRA 第51版：Cat.4最高1.25%。建議以10%稀釋液操作。","personal":"① 臭臭的、類似乾大便的味道，鼻腔前段。\n② 動物騷味、百花、草皮感。\n③ 持香度低。","advisors":[{"name":"Re.","text":"存在於茉莉花中；少量加入不喜歡的味道可以產生效果，若只加喜歡的味道則會顯得平庸。"}],"kind":"單體"},{"id":4,"en":"Eugenol","cn":"丁香酚","note":["Middle"],"type":["Spicy","Woody","Clove"],"alias":["4-Allylguaiacol"],"cas":"97-53-0","inci":"EUGENOL","ifra":"IFRA 第51版：Cat.4最高2.5%。EU 26種致敏原：leave-on≥0.01%須標示。","personal":"① 香料感、牙醫感，鼻腔前段。\n② 明顯涼感。\n③ 持香度中等。","advisors":[{"name":"Re.","text":"花朵中常用的Spicy元素（Rose, Jasmine, Muguet, Ylang Ylang），能增加花朵的鮮豔感。"},{"name":"CW","text":"牙醫診所味，丁香核"}],"kind":"單體"},{"id":5,"en":"Indolene / Indole","cn":"吲哚","note":["Base"],"type":["Floral","Animal"],"alias":["1H-Benzo[b]pyrrole"],"cas":"120-72-9","inci":"INDOLE","ifra":"IFRA 第51版：有限制，成品通常<0.1%。注意變色風險。","personal":"① 刺鼻。\n② 動物感、金屬感、水感，鼻腔中段。\n③ 白花香、乾淨、臭感。","advisors":[{"name":"Re.","text":"適合與Musk、Ambrox搭配，白花系的調配幾乎都會用到。"}],"kind":"單體"},{"id":6,"en":"Geranyl Acetate","cn":"乙酸香葉酯","note":["Middle"],"type":["Floral"],"alias":["Geranyl Ethanoate"],"cas":"105-87-3","inci":"GERANYL ACETATE","ifra":"IFRA 第51版：無限制。FEMA No.2509（GRAS）。","personal":"① 酵素、花香、酒香，鼻腔後段，感覺明亮。\n② 花香、空氣感。","advisors":[{"name":"Re.","text":"呈現出玫瑰中花萼的感覺，帶有草本特徵。"}],"kind":"單體"},{"id":7,"en":"Hexyl Salicylate","cn":"水楊酸己酯","note":["Middle"],"type":["Floral","Herbal"],"alias":["Hexyl 2-hydroxybenzoate"],"cas":"6259-76-3","inci":"HEXYL SALICYLATE","ifra":"IFRA 第51版：有限制（STD 042）。EU CLP：CMR Cat.2及致敏Cat.1。兒童<3歲最高0.1%。","personal":"① 酸、亮，鼻腔前段。\n② 綠葉、細微動物感（類瓦斯感）。","advisors":[{"name":"Re.","text":"具備Aesop風格的清新草本感。百花原料通常都帶有些許動物感。"}],"kind":"單體"},{"id":8,"en":"Tetrahydro Mugual","cn":"鈴蘭醇","note":["Middle"],"type":["Floral","Citrus"],"alias":[],"cas":"41723-66-4","inci":"TETRAHYDROMUGUOL","ifra":"IFRA 第51版：查無特定限制。建議向供應商取得合規聲明。","personal":"① 花香、暖感、柑橘味、果肉多汁。\n② 果肉多汁感。","advisors":[{"name":"Re.","text":"具備柑橘與花香，並帶有果皮細微的特徵香氣。"}],"kind":"單體"},{"id":9,"en":"Benzyl Acetate(NP)","cn":"乙酸苄酯","note":["Top"],"type":["Floral","Fruity"],"alias":[],"cas":"140-11-4","inci":"BENZYL ACETATE","ifra":"IFRA 第51版：純品無限制。EU 26種致敏原：leave-on≥0.01%須標示。FEMA 2135。","personal":"① 香蕉、百花、茉莉。\n② 微量動物感、甜，鼻腔中段。","advisors":[{"name":"Re.","text":"應用於Jasmine與Muguet；Fruity中的Apple, Banana, Strawberry分類。"}],"kind":"單體"},{"id":10,"en":"Hedione","cn":"二氫茉莉酮酸甲酯","note":["Middle"],"type":["Floral","White Floral","Transparent"],"alias":["Methyl Dihydrojasmonate","MDJ"],"cas":"24851-98-7","inci":"METHYL DIHYDROJASMONATE","ifra":"IFRA 第51版：無限制。FEMA 3408。典型用量2–15%（最高可達35%）。","personal":"① 透明感、清透水感。\n② 百花香，鼻腔中段。","advisors":[{"name":"Re.","text":"具備果香特徵且甜甜的百花感。"},{"name":"CW","text":"透明白花露水"}],"kind":"單體"},{"id":11,"en":"Ambrox Super","cn":"龍涎香","note":["Base"],"type":["Woody","Animal","Amber"],"alias":["Ambroxan","Ambroxide"],"cas":"6790-58-5","inci":"AMBROXIDE","ifra":"IFRA 第51版：無限制（Cat.4）。FEMA 3471。典型用量0.1–5%。","personal":"① 辛辣感（較Hedione明顯），鼻腔中段。\n② 木質調。","advisors":[{"name":"Re.","text":"呈現鹹感Amber（類獸內臟味）、海風感與鹹味。"}],"kind":"單體"},{"id":12,"en":"Calone 1951","cn":"西瓜酮","note":["Base"],"type":["Marine","Fruity"],"alias":["Oceanone"],"cas":"28940-11-6","inci":"CALONE","ifra":"IFRA 第51版：無禁止規定。極強效，成品通常0.01–0.1%。","personal":"① 明亮、甜水果、水感，鼻腔中段。\n② 西瓜、清涼、海風感。","advisors":[{"name":"Re.","text":"海洋水生調，帶有粉末狀質地與明亮感。"}],"kind":"單體"},{"id":13,"en":"Helional","cn":"新洋茉莉醛","note":["Middle"],"type":["Marine","Floral"],"alias":[],"cas":"1205-17-0","inci":"HELIONAL","ifra":"IFRA 第51版：查無特定限制。建議用量0.1–2%。","personal":"① 亮、水感、洗淨感，鼻腔後段。\n② 花香、明亮感，如向日葵下的氣味。","advisors":[],"kind":"單體"},{"id":14,"en":"Ethyl Linalool","cn":"乙基芳樟醇","note":["Top","Middle"],"type":["Floral"],"alias":[],"cas":"10339-55-6","inci":"ETHYL LINALOOL","ifra":"IFRA 第51版：本身無特定限制。注意：配方含Linalool為EU 26種致敏原。","personal":"① 強醇感（溶劑感）、花香、柑橘感，鼻腔前至中段。\n② 微量動物感、百花、微利（銳利邊緣）、枝幹感。","advisors":[{"name":"Re.","text":"包含花莖、花朵與泥土的混合味道。"}],"kind":"單體"},{"id":15,"en":"Habanolide","cn":"大環麝香","note":["Base"],"type":["Musky"],"alias":["Globalide"],"cas":"34902-57-3","inci":"HABANOLIDE","ifra":"IFRA 第51版：Cat.4最高48%。macrocyclic musk，生物降解性優。","personal":"① 麝香味，鼻腔中後段。\n② 白麝香、亮、乾、乾淨、亞麻感。","advisors":[{"name":"Re.","text":"屬於黃葵類，具備白的、軟綿綿感，持香時間極長。"}],"kind":"單體"},{"id":16,"en":"Iso E Super","cn":"龍涎酮","note":["Base"],"type":["Woody"],"alias":["OTNE"],"cas":"54464-57-2","inci":"TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES","ifra":"IFRA 第51版：Cat.4最高21.4%。IFF研發（1973），95%的香水配方使用。","personal":"① 空間感、礦物感、氣透力、透明感，鼻腔後段。\n② 木質、琥珀、細緻感。","advisors":[{"name":"Re.","text":"具備雪松與紙張感，極其通用，95%的香水配方均會使用。"}],"kind":"單體"},{"id":17,"en":"Galaxolide","cn":"佳樂麝香","note":["Base"],"type":["Musky","Clean"],"alias":["HHCB"],"cas":"1222-05-5","inci":"HEXAMETHYLINDANOPYRAN","ifra":"IFRA 第51版：Cat.4最高1.5%。水生毒性Aquatic Chronic 2；EPA列高優先TSCA物質。","personal":"① 乾淨的白麝香、甜感。\n② 蓬鬆感、粉質，鼻腔前段。","advisors":[{"name":"Re.","text":"調香師通常混合多種麝香；99.9%的香水會加入麝香以強化持香度。"},{"name":"CW","text":"透明潔淨感"}],"kind":"單體"},{"id":18,"en":"Rose Oxide","cn":"玫瑰氧化物","note":["Middle"],"type":["Floral","Fresh"],"alias":["Rose Oxyde"],"cas":"16726-11-7","inci":"ROSE OXIDE","ifra":"IFRA 第51版：有限制（皮膚致敏）。極強效，通常10%稀釋液，成品<0.1%。","personal":"① 綠葉感、微刺鼻，金屬感，鼻腔中段。\n② 強烈的新鮮感。","advisors":[{"name":"Re.","text":"核心屬性為花香 (Rose)。"}],"kind":"單體"},{"id":19,"en":"Phenyl Ethyl Phenyl Acetate","cn":"苯乙酸苯乙酯","note":["Middle"],"type":["Floral","Fruity"],"alias":["PEPA"],"cas":"102-20-5","inci":"PHENETHYL PHENYLACETATE","ifra":"IFRA 第51版：無特定限制。用量通常0.1–2%。","personal":"① (Top)香甜、蘋果、蜂蜜、荔枝。\n② (Middle)果酸、蘋果皮。\n③ (Base)蜂蜜、酸感。","advisors":[{"name":"Re.","text":"具備顯著的梨子香氣特徵。"}],"kind":"單體"},{"id":20,"en":"Undercavertol","cn":"甲基葵稀醇","note":["Top"],"type":["Fresh","Green"],"alias":[],"cas":"67694-66-6","inci":"UNDERCAVERTOL","ifra":"IFRA 第51版：Givaudan專利，查無公開限制。建議向供應商索取合規聲明。","personal":"① 青蘋果皮、綠葉、衝感，鼻腔後段。\n② 冷然、綠色調。\n③ 微量動物感，持香度低。","advisors":[],"kind":"單體"},{"id":21,"en":"Phenyl Ethyl Acetate","cn":"乙酸苯乙酯","note":["Middle","Base"],"type":["Floral"],"alias":["Phenethyl Acetate"],"cas":"103-45-7","inci":"PHENETHYL ACETATE","ifra":"IFRA 第51版：無特定限制。FEMA 2668。","personal":"① 蜂蜜感、甜潤感，鼻腔中段。\n② 水感、清脆感，如「蘋果脆脆地咬一口」。\n③ 木質、枝幹與花朵感。","advisors":[{"name":"Re.","text":"作為「毛茉莉花」中的輕要素使用。"}],"kind":"單體"},{"id":22,"en":"Citronellol","cn":"香茅醇","note":["Middle","Base"],"type":["Floral","Rose"],"alias":["3,7-Dimethyl-6-octenol"],"cas":"106-22-9","inci":"CITRONELLOL","ifra":"IFRA 第51版：有限制。Cat.4最高約7.4%。EU 26種致敏原：leave-on≥0.01%須標示。","personal":"① 花香、含鉛感、細緻質地，鼻腔前段。\n② 氣泡感。","advisors":[{"name":"Re.","text":"呈現Rose, Geranium屬性，具備玫瑰花瓣感。"},{"name":"CW","text":"玫瑰桃花香"}],"kind":"單體"},{"id":23,"en":"Dimethyl Benzyl Carbinyl Acetate","cn":"乙酸二甲基苄基原酯","note":["Middle"],"type":["Floral"],"alias":["DMBCA","DBCA"],"cas":"151-05-3","inci":"DIMETHYLBENZYL CARBINYL ACETATE","ifra":"IFRA 第51版：無特定限制。FEMA 2393。","personal":"① 銳利、水感、亞麻、亮、清、透明，鼻腔中段。\n② 微甜、果感、木質、冷感。","advisors":[{"name":"Re.","text":"勾勒出玫瑰中的「綠色線條感」。"}],"kind":"單體"},{"id":24,"en":"Peonile","cn":"牡丹腈","note":["Middle"],"type":["Floral","Green","Fresh"],"alias":[],"cas":"65405-84-7","inci":"PEONILE","ifra":"IFRA 第51版：有限制（IFRA STD），確切限量請查IFF供應商文件。","personal":"① 深沉、暗色調、融油劑感、輕微刺鼻，鼻腔中後段。\n② 深綠葉特徵。","advisors":[{"name":"Re.","text":"此原料市場接受度高，建議可以多加利用。"}],"kind":"單體"},{"id":25,"en":"Javanol","cn":"爪哇檀香","note":["Base"],"type":["Woody"],"alias":[],"cas":"155788-28-6","inci":"JAVANOL","ifra":"IFRA 第51版：Givaudan專利，Cat.4無公開限量。極強效，典型用量0.05–2%。","personal":"① 質地糯、味道淡，但持香時間極長。","advisors":[],"kind":"單體"},{"id":26,"en":"Sandalore","cn":"檀香醇","note":["Base"],"type":["Woody"],"alias":["Sandal Pentanol"],"cas":"65113-99-7","inci":"SANDALORE","ifra":"IFRA 第51版：Cat.4成品最高1.2%。Givaudan研發。","personal":"① 淡淡檀木、奶糖味、自然感，持香時間長。","advisors":[],"kind":"單體"},{"id":27,"en":"Polysantol","cn":"聚檀香醇","note":["Base"],"type":["Woody"],"alias":["Santol Pentenol"],"cas":"107898-54-4","inci":"TRIMETHYLCYCLOPENTENYL DIMETHYLISOPENTENOL","ifra":"IFRA 第51版：Cat.4成品最高1.1%。Firmenich研發，Samsara（Guerlain）中大量使用。\n由芬美意 (Firmenich) 開發的合成檀香香料，以其強烈的擴散性、奶油般的天然檀香氣味以及極高的持久度而聞名","personal":"① 木質明亮感、甜、回甘，類似玫瑰木。","advisors":[{"name":"Re.","text":"專用於高級檀香香調的調配。"}],"kind":"單體"},{"id":28,"en":"Beta Ionone","cn":"紫羅蘭酮","note":["Middle"],"type":["Woody","Floral"],"alias":["β-Ionone"],"cas":"14901-07-6","inci":"BETA-IONONE","ifra":"IFRA 第51版：有限制，Cat.4限量請查最新IFRA文件。α-Ionone與β-Ionone需區分。","personal":"① 乾燥木質感、松木、松子感。","advisors":[{"name":"Re.","text":"用於櫻花香調。注意：Ionone分為α與β，若使用不當（非高品質）會產生草臭味。"}],"kind":"單體"},{"id":1001,"en":"Bitter Lemon","cn":"苦檸檬","note":["Top"],"type":["香基","Citrus"],"alias":["香基 01"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1002,"en":"Citron Fruit","cn":"香櫞","note":["Top"],"type":["香基","Citrus"],"alias":["香基 02"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1003,"en":"Grapefruit","cn":"葡萄柚","note":["Top"],"type":["香基","Citrus"],"alias":["香基 03"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1004,"en":"Bergamot","cn":"香檸檬","note":["Top"],"type":["香基","Citrus"],"alias":["香基 04"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1005,"en":"Yuzu","cn":"柚子","note":["Top"],"type":["香基","Citrus"],"alias":["香基 05"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1006,"en":"Lime","cn":"萊姆","note":["Top"],"type":["香基","Citrus"],"alias":["香基 06"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1007,"en":"Tangerine","cn":"橘子","note":["Top"],"type":["香基","Citrus"],"alias":["香基 07"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1008,"en":"Orange","cn":"柳橙","note":["Top"],"type":["香基","Citrus"],"alias":["香基 08"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1009,"en":"Cucumber","cn":"小黃瓜","note":["Top"],"type":["香基","Fresh"],"alias":["香基 09"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1010,"en":"Fig","cn":"無花果","note":["Top"],"type":["香基","Fruity"],"alias":["香基 10"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1011,"en":"Green Tea","cn":"綠茶","note":["Top"],"type":["香基","Green"],"alias":["香基 11"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1012,"en":"Lily","cn":"百合","note":["Middle"],"type":["香基","Floral"],"alias":["香基 12"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1013,"en":"Muguet","cn":"鈴蘭","note":["Middle"],"type":["香基","Floral"],"alias":["香基 13"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1014,"en":"Jasmine","cn":"茉莉","note":["Middle"],"type":["香基","Floral"],"alias":["香基 14"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1015,"en":"Tuberose","cn":"晚香玉","note":["Middle"],"type":["香基","White Floral"],"alias":["香基 15"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1016,"en":"Rose","cn":"玫瑰","note":["Middle"],"type":["香基","Floral"],"alias":["香基 16"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1017,"en":"Rose de Mai","cn":"五月玫瑰","note":["Middle"],"type":["香基","Floral"],"alias":["香基 17"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1018,"en":"Ylang Ylang","cn":"依蘭","note":["Middle"],"type":["香基","Floral"],"alias":["香基 18"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1019,"en":"Gardenia","cn":"梔子花","note":["Middle"],"type":["香基","White Floral"],"alias":["香基 19"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1020,"en":"Geranium","cn":"天竺葵","note":["Middle"],"type":["香基","Floral"],"alias":["香基 20"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1021,"en":"Freesia","cn":"小蒼蘭","note":["Middle"],"type":["香基","Floral"],"alias":["香基 21"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1022,"en":"Violet","cn":"紫羅蘭","note":["Middle"],"type":["香基","Powdery"],"alias":["香基 22"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1023,"en":"Magnolia","cn":"木蘭","note":["Middle"],"type":["香基","Floral"],"alias":["香基 23"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1024,"en":"Lilac","cn":"丁香花","note":["Middle"],"type":["香基","Floral"],"alias":["香基 24"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1025,"en":"Linden Blossom","cn":"椴樹花","note":["Middle"],"type":["香基","Floral"],"alias":["香基 25"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1026,"en":"Orange Blossom","cn":"橙花","note":["Middle"],"type":["香基","Floral"],"alias":["香基 26"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1027,"en":"Carnation","cn":"康乃馨","note":["Middle"],"type":["香基","Floral"],"alias":["香基 27"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1028,"en":"Apple","cn":"蘋果","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 28"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1029,"en":"Raspberry","cn":"覆盆子","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 29"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1030,"en":"Cassis Fruit","cn":"黑醋栗果","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 30"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1031,"en":"Strawberry","cn":"草莓","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 31"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1032,"en":"Cherry","cn":"櫻桃","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 32"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1033,"en":"Riesling","cn":"麗絲玲葡萄酒感","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 33"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1034,"en":"Dewberry","cn":"黑莓類果實","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 34"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1035,"en":"Blackberry","cn":"黑莓","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 35"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1036,"en":"Lychee","cn":"荔枝","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 36"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1037,"en":"Apricot","cn":"杏桃","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 37"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1038,"en":"Pineapple","cn":"鳳梨","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 38"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1039,"en":"Mango","cn":"芒果","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 39"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1040,"en":"Peach","cn":"桃子","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 40"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1041,"en":"Pear","cn":"梨子","note":["Middle"],"type":["香基","Fruity"],"alias":["香基 41"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1042,"en":"Tomato Leaf","cn":"番茄葉","note":["Middle"],"type":["香基","Green"],"alias":["香基 42"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1043,"en":"Ivy","cn":"常春藤","note":["Middle"],"type":["香基","Green"],"alias":["香基 43"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1044,"en":"Herb","cn":"草本","note":["Middle"],"type":["香基","Herbal"],"alias":["香基 44"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1045,"en":"Rosemary","cn":"迷迭香","note":["Middle"],"type":["香基","Herbal"],"alias":["香基 45"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1046,"en":"Lavender","cn":"薰衣草","note":["Middle"],"type":["香基","Aromatic"],"alias":["香基 46"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1047,"en":"Green","cn":"綠葉調","note":["Middle"],"type":["香基","Green"],"alias":["香基 47"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1048,"en":"Marine","cn":"海洋調","note":["Middle"],"type":["香基","Marine"],"alias":["香基 48"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1049,"en":"Aldehyde","cn":"醛香","note":["Middle"],"type":["香基","Aldehydic"],"alias":["香基 49"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1050,"en":"Cinnamon","cn":"肉桂","note":["Middle"],"type":["香基","Spicy"],"alias":["香基 50"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1051,"en":"Ginger","cn":"薑","note":["Middle"],"type":["香基","Spicy"],"alias":["香基 51"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1052,"en":"Balsam","cn":"香脂","note":["Middle"],"type":["香基","Balsamic"],"alias":["香基 52"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1053,"en":"Spices","cn":"綜合辛香料","note":["Middle"],"type":["香基","Spicy"],"alias":["香基 53"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1054,"en":"Sandalwood","cn":"檀香","note":["Base"],"type":["香基","Woody"],"alias":["香基 54"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1055,"en":"Whitewood","cn":"白木質","note":["Base"],"type":["香基","Woody"],"alias":["香基 55"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1056,"en":"Cedarwood","cn":"雪松","note":["Base"],"type":["香基","Woody"],"alias":["香基 56"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1057,"en":"Rosewood","cn":"花梨木","note":["Base"],"type":["香基","Woody"],"alias":["香基 57"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1058,"en":"Patchouli","cn":"廣藿香","note":["Base"],"type":["香基","Woody"],"alias":["香基 58"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1059,"en":"Vetiver","cn":"岩蘭草","note":["Base"],"type":["香基","Woody"],"alias":["香基 59"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1060,"en":"Hinoki","cn":"檜木","note":["Base"],"type":["香基","Woody"],"alias":["香基 60"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1061,"en":"Oak","cn":"橡木","note":["Base"],"type":["香基","Woody"],"alias":["香基 61"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1062,"en":"Musk","cn":"麝香","note":["Base"],"type":["香基","Musky"],"alias":["香基 62"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1063,"en":"White Musk","cn":"白麝香","note":["Base"],"type":["香基","Musky"],"alias":["香基 63"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1064,"en":"Amber","cn":"琥珀","note":["Base"],"type":["香基","Amber"],"alias":["香基 64"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1065,"en":"White Amber","cn":"白琥珀","note":["Base"],"type":["香基","Amber"],"alias":["香基 65"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1066,"en":"Civet Cat","cn":"靈貓感","note":["Base"],"type":["香基","Animalic"],"alias":["香基 66"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1067,"en":"Beaver","cn":"海狸香感","note":["Base"],"type":["香基","Animalic"],"alias":["香基 67"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1068,"en":"Leather","cn":"皮革","note":["Base"],"type":["香基","Leathery"],"alias":["香基 68"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1069,"en":"Vanilla","cn":"香草","note":["Base"],"type":["香基","Gourmand"],"alias":["香基 69"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1070,"en":"Coconut","cn":"椰子","note":["Base"],"type":["香基","Gourmand"],"alias":["香基 70"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1071,"en":"Iris","cn":"鳶尾","note":["Base"],"type":["香基","Powdery"],"alias":["香基 71"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1072,"en":"Orchid","cn":"蘭花","note":["Base"],"type":["香基","Floral"],"alias":["香基 72"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1073,"en":"Tonka Bean","cn":"零陵香豆","note":["Base"],"type":["香基","Gourmand"],"alias":["香基 73"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1074,"en":"Tobacco","cn":"菸草","note":["Base"],"type":["香基","Tobacco"],"alias":["香基 74"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1075,"en":"Hay","cn":"乾草","note":["Base"],"type":["香基","Dry"],"alias":["香基 75"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1076,"en":"Sampaquita","cn":"阿拉伯茉莉／菲律賓茉莉","note":["Base"],"type":["香基","Floral"],"alias":["香基 76"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1077,"en":"Cacao","cn":"可可","note":["Base"],"type":["香基","Gourmand"],"alias":["香基 77"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1078,"en":"Praline","cn":"糖漬堅果糖","note":["Base"],"type":["香基","Gourmand"],"alias":["香基 78"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1079,"en":"Coffee","cn":"咖啡","note":["Base"],"type":["香基","Gourmand"],"alias":["香基 79"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1080,"en":"Moss","cn":"苔蘚","note":["Base"],"type":["香基","Mossy"],"alias":["香基 80"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":1081,"en":"ROSE BASE 01","cn":"玫瑰香基1號","note":["Middle"],"type":["香基","Floral"],"alias":[],"cas":"","inci":"","ifra":"","personal":"青森蘋果","advisors":[],"kind":"香基"},{"id":1082,"en":"JASMINE BASE01","cn":"茉莉香基01","note":["Middle"],"type":["香基","Floral"],"alias":[],"cas":"","inci":"","ifra":"","personal":"","advisors":[],"kind":"香基"},{"id":1083,"en":"Blooming Tears","cn":"","note":[],"type":["香基"],"alias":[],"cas":"","inci":"","ifra":"","personal":"","advisors":[],"kind":"香基"},{"id":1084,"en":"Sandalwood 01","cn":"檀木01","note":["Base"],"type":["香基","Woody"],"alias":[],"cas":"","inci":"","ifra":"","personal":"by Hana","advisors":[],"kind":"香基"},{"id":1085,"en":"Cis-3-Hexenol (C3H)","cn":"葉醇","note":["Top"],"type":["Herbal"],"alias":[],"cas":"928-96-1","inci":"CIS-3-HEXENOL","ifra":"𝐶6𝐻12O\nIFRA 限制：無已知嚴格限制（上限為 100%），惟調香師通常建議安全用量範圍為 0.1% 至 5%，以防氣味過於刺激。主要特性：具有強烈、清新的綠草與果皮香氣（常被形容為剛割下的草地）。使用注意事項：屬於易氧化變質的萜烯類衍生物，需妥善保存於陰暗處。","personal":"","advisors":[{"name":"K.W.","text":"新鮮青澀青草 黃瓜汁水"}],"kind":"單體"},{"id":1086,"en":"blackpepper","cn":"黑楜椒","note":["Top"],"type":["精油","Spicy"],"alias":[],"cas":"","inci":"","ifra":"","personal":"","advisors":[],"kind":"精油"},{"id":1087,"en":"New Material","cn":"","note":[],"type":[],"alias":[],"cas":"","inci":"","ifra":"","personal":"","advisors":[],"kind":"單體"},{"id":1088,"en":"New Material","cn":"","note":[],"type":[],"alias":[],"cas":"","inci":"","ifra":"","personal":"","advisors":[],"kind":"單體"},{"id":1089,"en":"Linalool","cn":"芳樟醇","note":["Middle"],"type":["Herbal"],"alias":[],"cas":"78-70-6","inci":"Linalool","ifra":"","personal":"清甜花香、木質香、伴隨淡淡柑橘調\n薰衣草 (Lavender)： 芳樟醇與乙酸芳樟酯是其關鍵組成。芳樟 (Ho Wood/Leaf)： 含量極高，因此得名「芳樟醇」。花梨木 (Rosewood) (Bergamot)、苦橙葉 (Petitgrain)。","advisors":[],"kind":"單體"},{"id":2,"en":"Ebanol","cn":"檀香木質調","note":["Base"],"type":["Woody"],"alias":["Matsunol","Muscosandrol"],"cas":"67801-20-1","inci":"SANDAL PENTENOL","ifra":"IFRA 第51版：Cat.4無特定限制。建議0.5–5%。Givaudan研發。","personal":"① 回甘、甜味的中藥材、八角味，圓潤感，使心情愉快。\n② 木質香料感，鼻腔中段。\n③ 檀木香氣非常持香。","advisors":[{"name":"Re.","text":"適合與白色花系（如茉莉花）進行搭配。"}],"kind":"單體"},{"id":20,"en":"Undercavertol","cn":"梨子/青蘋果感原料","note":["Top"],"type":["Green","Fresh"],"alias":[],"cas":"67694-66-6","inci":"UNDERCAVERTOL","ifra":"IFRA 第51版：Givaudan專利，查無公開限制。建議向供應商索取合規聲明。","personal":"① 青蘋果皮、綠葉、衝感，鼻腔後段。\n② 冷然、綠色調。\n③ 微量動物感，持香度低。","advisors":[],"kind":"單體"},{"id":27,"en":"Polysantol","cn":"高級檀香醇","note":["Base"],"type":["Woody"],"alias":["Santol Pentenol"],"cas":"107898-54-4","inci":"TRIMETHYLCYCLOPENTENYL DIMETHYLISOPENTENOL","ifra":"IFRA 第51版：Cat.4成品最高1.1%。Firmenich研發，Samsara（Guerlain）中大量使用。","personal":"① 木質明亮感、甜、回甘，類似玫瑰木。","advisors":[{"name":"Re.","text":"專用於高級檀香香調的調配。"}],"kind":"單體"},{"id":1004,"en":"Bergamot","cn":"佛手柑","note":["Top"],"type":["香基","Citrus"],"alias":["香基 04"],"cas":"","inci":"","ifra":"80 種 Olfaction 練習香材／香基，用於聞香訓練與香調辨識。","personal":"","advisors":[],"kind":"香基"},{"id":2001,"en":"Benzaldehyde","cn":"安息香醛","note":["Middle"],"type":["Aldehydic","Nutty","Fruity"],"alias":["CW 歷史單體"],"cas":"100-52-7","inci":"BENZALDEHYDE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"苦杏仁、櫻桃香"}],"kind":"單體"},{"id":2002,"en":"Coumarin","cn":"香豆素","note":["Base"],"type":["Gourmand","Hay","Fougère"],"alias":["CW 歷史單體"],"cas":"91-64-5","inci":"COUMARIN","ifra":"常見香料致敏標示物質之一；實際限量請以最新版 IFRA 與供應商文件為準。","personal":"","advisors":[{"name":"CW","text":"香草甜香，Fougère 香調基石"}],"kind":"單體"},{"id":2003,"en":"Cinnamaldehyde","cn":"肉桂醛","note":["Middle"],"type":["Spicy","Warm"],"alias":["CW 歷史單體"],"cas":"104-55-2","inci":"CINNAMAL","ifra":"常見香料致敏標示物質之一；實際限量請以最新版 IFRA 與供應商文件為準。","personal":"","advisors":[{"name":"CW","text":"辛辣肉桂"}],"kind":"單體"},{"id":2004,"en":"Geraniol","cn":"香葉醇","note":["Middle"],"type":["Floral","Rose"],"alias":["CW 歷史單體"],"cas":"106-24-1","inci":"GERANIOL","ifra":"常見香料致敏標示物質之一；實際限量請以最新版 IFRA 與供應商文件為準。","personal":"","advisors":[{"name":"CW","text":"玫瑰花香"}],"kind":"單體"},{"id":2006,"en":"Vanillin","cn":"香蘭素","note":["Base"],"type":["Gourmand","Vanilla"],"alias":["CW 歷史單體"],"cas":"121-33-5","inci":"VANILLIN","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"香草甜"}],"kind":"單體"},{"id":2007,"en":"Phenylacetaldehyde","cn":"苯乙醛","note":["Middle"],"type":["Floral","Green","Honey"],"alias":["CW 歷史單體"],"cas":"122-78-1","inci":"PHENYLACETALDEHYDE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"蜂蜜、綠葉玫瑰調"}],"kind":"單體"},{"id":2008,"en":"Musk Ketone","cn":"麝香酮","note":["Base"],"type":["Musky","Powdery"],"alias":["CW 歷史單體"],"cas":"81-14-1","inci":"MUSK KETONE","ifra":"硝基麝香類，實務使用需特別確認法規、IFRA 與供應商合規文件。","personal":"","advisors":[{"name":"CW","text":"合成麝香，早期白麝香精"}],"kind":"單體"},{"id":2009,"en":"Musk Acetophenone","cn":"麝香葵子酮","note":["Base"],"type":["Musky","Powdery","Animalic"],"alias":["CW 歷史單體"],"cas":"83-66-9","inci":"MUSK ACETOPHENONE","ifra":"硝基麝香類，實務使用需特別確認法規、IFRA 與供應商合規文件。","personal":"","advisors":[{"name":"CW","text":"粉質動物麝香"}],"kind":"單體"},{"id":2010,"en":"Aldehyde C10","cn":"十醛","note":["Top"],"type":["Aldehydic","Citrus","Waxy"],"alias":["CW 歷史單體"],"cas":"112-31-2","inci":"DECANAL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"柑橘蠟質"}],"kind":"單體"},{"id":2011,"en":"Aldehyde C11","cn":"十一醛","note":["Top"],"type":["Aldehydic","Soapy","Waxy"],"alias":["CW 歷史單體"],"cas":"112-44-7","inci":"UNDECANAL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"蠟脂、皂感，Chanel No.5 靈魂"}],"kind":"單體"},{"id":2012,"en":"Aldehyde C12","cn":"十二醛","note":["Top"],"type":["Aldehydic","Soapy","Fatty"],"alias":["CW 歷史單體"],"cas":"112-54-9","inci":"LAURALDEHYDE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"肥皂脂肪，少女甜香"}],"kind":"單體"},{"id":2013,"en":"Aldehyde C16","cn":"草莓醛","note":["Middle"],"type":["Fruity","Strawberry","Green"],"alias":["CW 歷史單體"],"cas":"77-83-8","inci":"ETHYL METHYLPHENYLGLYCIDATE","ifra":"俗稱 C16 strawberry aldehyde；實務使用請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"綠果草莓，少女甜香"}],"kind":"單體"},{"id":2014,"en":"Benzyl Acetate(IS)","cn":"乙酸苄酯","note":["Middle"],"type":["Floral","Fruity","White Floral"],"alias":["CW 歷史單體"],"cas":"140-11-4","inci":"BENZYL ACETATE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"茉莉，白花香主要使用"}],"kind":"單體"},{"id":2015,"en":"Methyl Ionone","cn":"甲基紫羅蘭酮","note":["Middle","Base"],"type":["Powdery","Orris","Woody"],"alias":["CW 歷史單體"],"cas":"1335-46-2","inci":"METHYLIONONE","ifra":"Ionone 類常有規範差異；請以供應商 IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"粉霧鳶尾"}],"kind":"單體"},{"id":2016,"en":"Phenylethyl Alcohol","cn":"苯乙醇","note":["Middle"],"type":["Floral","Rose"],"alias":["CW 歷史單體"],"cas":"60-12-8","inci":"PHENETHYL ALCOHOL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"酸甜清脆、減齡玫瑰"}],"kind":"單體"},{"id":2017,"en":"Indole","cn":"吲哚","note":["Base"],"type":["Floral","White Floral","Animalic"],"alias":["CW 歷史單體"],"cas":"120-72-9","inci":"INDOLE","ifra":"強效原料；成品使用量需依配方與供應商 IFRA Certificate 確認。","personal":"","advisors":[{"name":"CW","text":"開臭花後變茉莉，天然茉莉極低含量"}],"kind":"單體"},{"id":2018,"en":"Exaltone","cn":"環十五酮","note":["Base"],"type":["Musky","Animalic"],"alias":["CW 歷史單體"],"cas":"502-72-7","inci":"CYCLOPENTADECANONE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"大環麝香原型"}],"kind":"單體"},{"id":2019,"en":"Civetone","cn":"靈貓酮","note":["Base"],"type":["Animalic","Musky"],"alias":["CW 歷史單體"],"cas":"542-46-1","inci":"CIVETONE","ifra":"動物感強，實際使用需低劑量並以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"腥臊性感，天然靈貓香替代"}],"kind":"單體"},{"id":2020,"en":"Exaltolide","cn":"環十五內酯","note":["Base"],"type":["Musky","Clean"],"alias":["CW 歷史單體"],"cas":"106-02-5","inci":"PENTADECALACTONE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"柔日麝香，Narciso Rodriguez"}],"kind":"單體"},{"id":2021,"en":"Cedryl Acetate","cn":"乙酸柏木酯","note":["Base"],"type":["Woody","Cedar"],"alias":["CW 歷史單體"],"cas":"77-54-3","inci":"CEDRYL ACETATE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"乾燥雪松"}],"kind":"單體"},{"id":2022,"en":"Vetiveryl Acetate","cn":"香根草醇醋酸酯","note":["Base"],"type":["Woody","Vetiver","Smoky"],"alias":["CW 歷史單體"],"cas":"68917-34-0","inci":"VETIVERYL ACETATE","ifra":"天然衍生混合物；請以供應商 SDS / IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"煙燻香根草，Encre Noire"}],"kind":"單體"},{"id":2023,"en":"Patchouliol","cn":"廣藿香醇","note":["Base"],"type":["Woody","Earthy","Chypre"],"alias":["CW 歷史單體"],"cas":"5986-55-0","inci":"PATCHOULI ALCOHOL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"土味藥感，西普調必備"}],"kind":"單體"},{"id":2024,"en":"Iso E Super","cn":"ISO E Super","note":["Base"],"type":["Woody","Amber","Transparent"],"alias":["CW 歷史單體"],"cas":"54464-57-2","inci":"TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES","ifra":"實際限量依 OTNE 異構物比例與最新版 IFRA Standards 確認。","personal":"","advisors":[{"name":"CW","text":"隱形木質，Terre d’Hermès 骨架"}],"kind":"單體"},{"id":2026,"en":"Tonalide","cn":"吐納麝香","note":["Base"],"type":["Musky","Soapy"],"alias":["CW 歷史單體"],"cas":"1506-02-1","inci":"TONALIDE","ifra":"請以供應商 IFRA Certificate 與最新版 IFRA Standards 確認使用限制。","personal":"","advisors":[{"name":"CW","text":"持久皂香"}],"kind":"單體"},{"id":2027,"en":"Musk Tibetene","cn":"西藏麝香","note":["Base"],"type":["Musky","Spicy","Woody"],"alias":["CW 歷史單體"],"cas":"145-39-1","inci":"MUSK TIBETENE","ifra":"硝基麝香類，實務使用需特別確認法規、IFRA 與供應商合規文件。","personal":"","advisors":[{"name":"CW","text":"辛辣木質香"}],"kind":"單體"},{"id":2028,"en":"Calone","cn":"西瓜酮","note":["Middle"],"type":["Marine","Aquatic","Fruity"],"alias":["CW 歷史單體"],"cas":"28940-11-6","inci":"CALONE","ifra":"強效原料；通常低劑量使用，請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"水生調始祖"}],"kind":"單體"},{"id":2030,"en":"Aldehyde C14","cn":"桃醛","note":["Middle"],"type":["Fruity","Peach","Lactonic"],"alias":["CW 歷史單體"],"cas":"104-67-6","inci":"UNDECALACTONE","ifra":"俗稱 C14 peach aldehyde；請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"奶油桃子，甜甜果香"}],"kind":"單體"},{"id":2031,"en":"Fructone","cn":"蘋果酯","note":["Top","Middle"],"type":["Fruity","Apple","Fresh"],"alias":["CW 歷史單體"],"cas":"6413-10-1","inci":"ETHYL 2-METHYL-1,3-DIOXOLANE-2-ACETATE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"青蘋果，Light Blue"}],"kind":"單體"},{"id":2032,"en":"Leaf Alcohol","cn":"葉醇","note":["Top"],"type":["Green","Fresh"],"alias":["CW 歷史單體"],"cas":"928-96-1","inci":"CIS-3-HEXENOL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"割草青綠"}],"kind":"單體"},{"id":2033,"en":"Triplal","cn":"萃取醛","note":["Top","Middle"],"type":["Green","Leafy"],"alias":["CW 歷史單體"],"cas":"27939-60-2","inci":"TRIPLAL","ifra":"強效綠葉原料；請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"綠葉"}],"kind":"單體"},{"id":2034,"en":"Strawberry Furanone","cn":"草莓呋喃酮","note":["Middle","Base"],"type":["Fruity","Gourmand","Strawberry"],"alias":["CW 歷史單體"],"cas":"3658-77-3","inci":"FURANEOL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"熟透草莓"}],"kind":"單體"},{"id":2036,"en":"Isoeugenol","cn":"異丁香酚","note":["Middle","Base"],"type":["Spicy","Warm","Oriental"],"alias":["CW 歷史單體"],"cas":"97-54-1","inci":"ISOEUGENOL","ifra":"常見香料致敏標示物質之一；實際限量請以最新版 IFRA 與供應商文件為準。","personal":"","advisors":[{"name":"CW","text":"溫暖老式東方調"}],"kind":"單體"},{"id":2037,"en":"Birch Tar","cn":"樺木焦油","note":["Base"],"type":["Smoky","Leathery"],"alias":["CW 歷史單體"],"cas":"8001-88-5","inci":"BETULA ALBA TAR","ifra":"焦油類原料法規限制多；需以供應商 IFRA Certificate / PAH 合規資料為準。","personal":"","advisors":[{"name":"CW","text":"煙燻皮革"}],"kind":"單體"},{"id":2038,"en":"Floralozone","cn":"海風醛","note":["Top","Middle"],"type":["Marine","Ozonic"],"alias":["CW 歷史單體"],"cas":"67634-15-5","inci":"FLORALOZONE","ifra":"強效海洋／臭氧原料；請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"鹽氣微風水生"}],"kind":"單體"},{"id":2039,"en":"Ozonil","cn":"臭氧酮","note":["Top","Middle"],"type":["Ozonic","Fresh"],"alias":["CW 歷史單體"],"cas":"","inci":"OZONIL","ifra":"專利／商品名原料；CAS 與 IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"雨後清新"}],"kind":"單體"},{"id":2040,"en":"Melonal","cn":"西瓜醛","note":["Top","Middle"],"type":["Marine","Melon","Aquatic"],"alias":["CW 歷史單體"],"cas":"106-72-9","inci":"MELONAL","ifra":"強效原料；請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"不甜西瓜，90 年代水生"}],"kind":"單體"},{"id":2041,"en":"Musk T","cn":"麝香 T","note":["Base"],"type":["Musky","Clean"],"alias":["CW 歷史單體"],"cas":"","inci":"MUSK T","ifra":"商品名原料；CAS 與 IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"棉麻微麝香"}],"kind":"單體"},{"id":2042,"en":"Ambrinol","cn":"龍涎香醚","note":["Base"],"type":["Amber","Animalic","Marine"],"alias":["CW 歷史單體"],"cas":"41199-19-3","inci":"AMBRINOL","ifra":"強效琥珀／龍涎感原料；請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"昂貴龍涎"}],"kind":"單體"},{"id":2043,"en":"p-Cresol","cn":"對甲酚","note":["Base"],"type":["Animalic","Phenolic"],"alias":["CW 歷史單體"],"cas":"106-44-5","inci":"P-CRESOL","ifra":"苯酚類刺激性與安全限制需特別確認；請以供應商 SDS / IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"馬廄臭味"}],"kind":"單體"},{"id":2044,"en":"Ethyl Maltol","cn":"乙基麥芽酚","note":["Base"],"type":["Gourmand","Caramel"],"alias":["CW 歷史單體"],"cas":"4940-11-8","inci":"ETHYL MALTOL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"焦糖棉花糖"}],"kind":"單體"},{"id":2045,"en":"Furaneol","cn":"呋喃酮","note":["Middle","Base"],"type":["Gourmand","Strawberry","Caramel"],"alias":["CW 歷史單體"],"cas":"3658-77-3","inci":"FURANEOL","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"草莓焦糖"}],"kind":"單體"},{"id":2046,"en":"Ethyl Vanillin","cn":"乙基香蘭素","note":["Base"],"type":["Gourmand","Vanilla"],"alias":["CW 歷史單體"],"cas":"121-32-4","inci":"ETHYL VANILLIN","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"3 倍香草"}],"kind":"單體"},{"id":2047,"en":"Ethyl Brassylate","cn":"乙基巴西酸酯","note":["Base"],"type":["Musky","Clean"],"alias":["CW 歷史單體"],"cas":"105-95-3","inci":"ETHYLENE BRASSYLATE","ifra":"大環麝香，通常相對友善；仍請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"IFRA 友好麝香"}],"kind":"單體"},{"id":2048,"en":"Ethylene Brassylate","cn":"乙烯巴西酸酯","note":["Base"],"type":["Musky","Chypre"],"alias":["CW 歷史單體"],"cas":"105-95-3","inci":"ETHYLENE BRASSYLATE","ifra":"大環麝香，通常相對友善；仍請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"麝香替代，Chypre 調復興"}],"kind":"單體"},{"id":2049,"en":"Clearwood","cn":"Clearwood","note":["Base"],"type":["Woody","Patchouli","Clean"],"alias":["CW 歷史單體"],"cas":"","inci":"CLEARWOOD","ifra":"Firmenich 商品名／生物科技來源原料；CAS、INCI、IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"合成廣藿香"}],"kind":"單體"},{"id":2050,"en":"Ambroxan","cn":"Ambroxan","note":["Base"],"type":["Amber","Mineral","Woody"],"alias":["CW 歷史單體"],"cas":"6790-58-5","inci":"AMBROXIDE","ifra":"請以供應商 IFRA Certificate 與最新版 IFRA Standards 確認。","personal":"","advisors":[{"name":"CW","text":"礦物琥珀，Dior Sauvage"}],"kind":"單體"},{"id":2051,"en":"Ambroxide","cn":"Ambroxide","note":["Base"],"type":["Amber","Animalic","Marine"],"alias":["CW 歷史單體"],"cas":"6790-58-5","inci":"AMBROXIDE","ifra":"請以供應商 IFRA Certificate 與最新版 IFRA Standards 確認。","personal":"","advisors":[{"name":"CW","text":"生物發酵龍涎"}],"kind":"單體"},{"id":2052,"en":"Cashmeran","cn":"Cashmeran","note":["Middle","Base"],"type":["Woody","Musky","Powdery"],"alias":["CW 歷史單體"],"cas":"33704-61-9","inci":"CASHMERAN","ifra":"請以供應商 IFRA Certificate 與最新版 IFRA Standards 確認。","personal":"","advisors":[{"name":"CW","text":"喀什米爾羊毛粉感"}],"kind":"單體"},{"id":2053,"en":"Akigalawood","cn":"Akigalawood","note":["Base"],"type":["Woody","Spicy","Patchouli"],"alias":["CW 歷史單體"],"cas":"","inci":"AKIGALAWOOD","ifra":"Givaudan 商品名／生物科技來源原料；CAS、INCI、IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"黑胡椒木質，業界新寵"}],"kind":"單體"},{"id":2054,"en":"Dreamwood","cn":"Dreamwood","note":["Base"],"type":["Woody","Sandalwood"],"alias":["CW 歷史單體"],"cas":"","inci":"DREAMWOOD","ifra":"Symrise 商品名；CAS、INCI、IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"AI 生成木質，Symrise 單體品"}],"kind":"單體"},{"id":2055,"en":"Sandalore","cn":"Sandalore","note":["Base"],"type":["Woody","Sandalwood"],"alias":["CW 歷史單體"],"cas":"65113-99-7","inci":"SANDALORE","ifra":"請以供應商 IFRA Certificate 與最新版 IFRA Standards 確認。","personal":"","advisors":[{"name":"CW","text":"合成檀香"}],"kind":"單體"},{"id":2056,"en":"Symroxane","cn":"Symroxane","note":["Base"],"type":["Woody","Ozonic"],"alias":["CW 歷史單體"],"cas":"","inci":"SYMROXANE","ifra":"Symrise 商品名；CAS、INCI、IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"木質、臭氧混合體"}],"kind":"單體"},{"id":2057,"en":"Javanol","cn":"Javanol","note":["Base"],"type":["Woody","Sandalwood"],"alias":["CW 歷史單體"],"cas":"155788-28-6","inci":"JAVANOL","ifra":"強效檀香原料；請以供應商 IFRA Certificate 為準。","personal":"","advisors":[{"name":"CW","text":"強力合成檀香"}],"kind":"單體"},{"id":2058,"en":"Paradismide","cn":"Paradismide","note":["Middle","Base"],"type":["Fruity","Tropical","Gourmand"],"alias":["CW 歷史單體"],"cas":"","inci":"PARADISMIDE","ifra":"Firmenich 商品名；CAS、INCI、IFRA 請以供應商文件確認。","personal":"","advisors":[{"name":"CW","text":"芒果椰子熟帶感"}],"kind":"單體"},{"id":2059,"en":"Musk Xylene","cn":"二甲苯麝香","note":["Base"],"type":["Musky"],"alias":["CW 歷史單體"],"cas":"81-15-2","inci":"MUSK XYLENE","ifra":"多地已受嚴格限制或禁用；不建議作為實務配方原料，請以當地法規與供應商合規文件為準。","personal":"","advisors":[{"name":"CW","text":"禁用：光毒性與環境殘留"}],"kind":"單體"},{"id":2060,"en":"Oakmoss Absolute","cn":"苔蘚原精","note":["Base"],"type":["Mossy","Chypre"],"alias":["CW 歷史單體"],"cas":"90028-68-5","inci":"EVERNIA PRUNASTRI EXTRACT","ifra":"Oakmoss 類受 IFRA 嚴格限制；需確認 atranol/chloroatranol 等規範與供應商 IFRA Certificate。","personal":"","advisors":[{"name":"CW","text":"經典西普魂，IFRA 禁用／嚴格限制"}],"kind":"單體"},{"id":2061,"en":"Hydrogen Sulfide","cn":"硫化氫","note":["Base"],"type":["Sulfurous","Mineral"],"alias":["CW 歷史單體"],"cas":"7783-06-4","inci":"HYDROGEN SULFIDE","ifra":"高危險毒性氣體；不建議教學或實務調香使用，只保留為氣味知識。","personal":"","advisors":[{"name":"CW","text":"臭雞蛋味，極微量用於礦泉、鐵氣香"}],"kind":"單體"},{"id":2062,"en":"CL02","cn":"","note":["Middle"],"type":["香基","Floral"],"alias":[],"cas":"","inci":"","ifra":"","personal":"CLO2配方 11%濃度 細項請看配方表","advisors":[],"kind":"香基"},{"id":9,"en":"Benzyl Acetate","cn":"乙酸苯甲酯","note":["Top"],"type":["Floral","Fruity"],"alias":[],"cas":"140-11-4","inci":"BENZYL ACETATE","ifra":"IFRA 第51版：純品無限制。EU 26種致敏原：leave-on≥0.01%須標示。FEMA 2135。","personal":"① 香蕉、百花、茉莉。\n② 微量動物感、甜，鼻腔中段。","advisors":[{"name":"Re.","text":"應用於Jasmine與Muguet；Fruity中的Apple, Banana, Strawberry分類。"}],"kind":"單體"},{"id":2014,"en":"Benzyl Acetate","cn":"乙酸苄酯","note":["Middle"],"type":["Floral","White Floral","Fruity"],"alias":["CW 歷史單體"],"cas":"140-11-4","inci":"BENZYL ACETATE","ifra":"教學暫存：請以供應商 SDS / IFRA Certificate 與最新版 IFRA Standards 為準。","personal":"","advisors":[{"name":"CW","text":"茉莉，白花香主役"}],"kind":"單體"}]};

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function normalizeMaterialsForApp(materials){
    if(!Array.isArray(materials)) return [];
    return materials.map((item, index) => {
      const next = {...item};
      if(next.id == null || next.id === '') next.id = index + 1;
      if(!Array.isArray(next.note)) next.note = next.note ? [next.note] : [];
      if(!Array.isArray(next.type)) next.type = next.type ? [next.type] : [];
      if(!Array.isArray(next.alias)) next.alias = next.alias ? [next.alias] : [];
      if(!Array.isArray(next.advisors)) next.advisors = [];
      if(typeof normalizeItem === 'function') return normalizeItem(next);
      return next;
    });
  }

  function applyMaterials(materialPackage, sourceLabel){
    const materials = Array.isArray(materialPackage) ? materialPackage : materialPackage && materialPackage.materials;
    const cleaned = normalizeMaterialsForApp(materials);
    if(!cleaned.length) throw new Error('沒有可匯入的原料資料。');

    db = cleaned;
    if(typeof saveDb === 'function') saveDb();
    if(typeof renderLibrary === 'function') renderLibrary();
    if(typeof renderFormula === 'function') renderFormula();

    return cleaned.length;
  }

  function applyFormulas(formulaPackage){
    if(!formulaPackage) throw new Error('雲端沒有配方資料。');
    const incoming = Array.isArray(formulaPackage.formulas) ? formulaPackage.formulas : null;
    if(!incoming) throw new Error('配方資料格式不正確。');

    if(typeof saveActiveFormulaFromDom === 'function') saveActiveFormulaFromDom();

    formulas = clone(incoming);
    activeFormulaId = formulaPackage.activeFormulaId || (formulas[0] && formulas[0].id) || '';

    const f = typeof currentFormula === 'function' ? currentFormula() : formulas[0];
    if(f){
      rows = (f.rows && f.rows.length ? f.rows : Array.from({length:8}, emptyFormulaRow)).map(r => ({...emptyFormulaRow(), ...r}));
      if(typeof applyMetaToDom === 'function') applyMetaToDom(f);
    }

    if(typeof persistFormulas === 'function') persistFormulas();
    if(typeof renderFormulaList === 'function') renderFormulaList();
    if(typeof renderFormula === 'function') renderFormula();

    return formulas.length;
  }

  function getMaterialPackage(){
    return {
      type: 'hfugue-organ-material-db',
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      materialCount: Array.isArray(db) ? db.length : 0,
      materials: clone(db || [])
    };
  }

  function getFormulaPackage(){
    if(typeof saveActiveFormulaFromDom === 'function') saveActiveFormulaFromDom();
    return {
      type: 'hfugue-organ-formulas',
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      activeFormulaId: activeFormulaId || '',
      formulaCount: Array.isArray(formulas) ? formulas.length : 0,
      formulas: clone(formulas || [])
    };
  }

  async function cloudGet(key){
    if(!CLOUD_ENDPOINT) throw new Error('尚未設定 Google Apps Script 部署網址。');
    const url = CLOUD_ENDPOINT + '?action=load&key=' + encodeURIComponent(key) + '&t=' + Date.now();
    const res = await fetch(url, {method:'GET', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || '雲端下載失敗。');
    return json.data;
  }

  async function cloudSaveAll(){
    if(!CLOUD_ENDPOINT) throw new Error('尚未設定 Google Apps Script 部署網址。');
    const body = {
      action: 'saveAll',
      materials: getMaterialPackage(),
      formulas: getFormulaPackage()
    };
    const res = await fetch(CLOUD_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || '雲端上傳失敗。');
    return json;
  }

  async function cloudPing(){
    if(!CLOUD_ENDPOINT) throw new Error('尚未設定 Google Apps Script 部署網址。');
    const res = await fetch(CLOUD_ENDPOINT + '?action=ping&t=' + Date.now(), {method:'GET', cache:'no-store'});
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || '雲端連線失敗。');
    alert('雲端連線成功：' + (json.message || 'OK'));
  }

  async function uploadToCloud(){
    try{
      const ok = confirm('要把「這台裝置目前的原料庫與配方」上傳到雲端嗎？\n\n這會覆蓋 Google Sheet 裡的 materials / formulas。');
      if(!ok) return;
      setCloudButtonState(true, '上傳中…');
      const result = await cloudSaveAll();
      alert('已上傳到雲端。\n時間：' + (result.savedAt || new Date().toISOString()));
    }catch(err){
      console.error(err);
      alert('雲端上傳失敗：' + err.message + '\n\n請確認 Apps Script 部署權限是「任何人」。');
    }finally{
      setCloudButtonState(false);
    }
  }

  async function downloadFromCloud(){
    try{
      const ok = confirm('要從雲端下載資料到這台裝置嗎？\n\n這會覆蓋這台裝置目前的原料庫與配方。');
      if(!ok) return;
      setCloudButtonState(true, '下載中…');
      const [materialsData, formulasData] = await Promise.all([
        cloudGet('materials'),
        cloudGet('formulas')
      ]);

      const materialCount = materialsData ? applyMaterials(materialsData, 'cloud') : 0;
      const formulaCount = formulasData ? applyFormulas(formulasData) : 0;
      alert(`已從雲端下載。\n原料：${materialCount} 種\n配方：${formulaCount} 支`);
    }catch(err){
      console.error(err);
      alert('雲端下載失敗：' + err.message + '\n\n如果這是第一次使用，請先在有完整資料的裝置按「上傳到雲端」。');
    }finally{
      setCloudButtonState(false);
    }
  }

  function downloadFullBackup(){
    try{
      const data = {
        type: 'hfugue-organ-full-backup',
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        materials: getMaterialPackage(),
        formulas: getFormulaPackage()
      };
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
      a.download = `hfugue-organ-full-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }catch(err){
      console.error(err);
      alert('完整備份下載失敗：' + err.message);
    }
  }

  function setCloudButtonState(disabled, label){
    ['cloudUploadBtn','cloudDownloadBtn','cloudPingBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if(btn) btn.disabled = !!disabled;
    });
    const upload = document.getElementById('cloudUploadBtn');
    if(upload) upload.textContent = disabled && label ? label : '上傳到雲端';
  }

  function injectCloudButtons(){
    const topActions = document.querySelector('.top-actions');
    if(!topActions || document.getElementById('cloudUploadBtn')) return;

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'btn dark';
    uploadBtn.id = 'cloudUploadBtn';
    uploadBtn.textContent = '上傳到雲端';
    uploadBtn.addEventListener('click', uploadToCloud);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn';
    downloadBtn.id = 'cloudDownloadBtn';
    downloadBtn.textContent = '從雲端下載';
    downloadBtn.addEventListener('click', downloadFromCloud);

    const pingBtn = document.createElement('button');
    pingBtn.type = 'button';
    pingBtn.className = 'btn';
    pingBtn.id = 'cloudPingBtn';
    pingBtn.textContent = '測試雲端';
    pingBtn.addEventListener('click', cloudPing);

    const backupBtn = document.createElement('button');
    backupBtn.type = 'button';
    backupBtn.className = 'btn';
    backupBtn.id = 'fullBackupBtn';
    backupBtn.textContent = '完整備份 JSON';
    backupBtn.addEventListener('click', downloadFullBackup);

    const installBtn = document.getElementById('installAppBtn');
    const anchor = document.getElementById('materialExportBtn') || installBtn;

    if(anchor){
      topActions.insertBefore(uploadBtn, anchor);
      topActions.insertBefore(downloadBtn, anchor);
      topActions.insertBefore(pingBtn, anchor);
      topActions.insertBefore(backupBtn, anchor);
    }else{
      topActions.appendChild(uploadBtn);
      topActions.appendChild(downloadBtn);
      topActions.appendChild(pingBtn);
      topActions.appendChild(backupBtn);
    }
  }

  function installEmbeddedMaterialsIfNeeded(){
    if(typeof db === 'undefined' || typeof saveDb !== 'function') return false;
    const embeddedCount = EMBEDDED_MATERIAL_DB && EMBEDDED_MATERIAL_DB.materials ? EMBEDDED_MATERIAL_DB.materials.length : 0;
    const currentCount = Array.isArray(db) ? db.length : 0;

    if(embeddedCount && currentCount < embeddedCount){
      try{
        localStorage.setItem('hfugue-organ-material-db-before-embedded-' + Date.now(), JSON.stringify(db || []));
      }catch(e){}
      const count = applyMaterials(EMBEDDED_MATERIAL_DB, 'embedded');
      console.log('H.FUGUE Organ: embedded material database installed:', count);
      return true;
    }
    return false;
  }

  function bootCloudSync(){
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      injectCloudButtons();
      installEmbeddedMaterialsIfNeeded();

      if((document.getElementById('cloudUploadBtn') && typeof db !== 'undefined' && typeof formulas !== 'undefined') || attempts > 40){
        clearInterval(timer);
      }
    }, 150);
  }

  window.HFUGUE_CLOUD_SYNC = {
    uploadToCloud,
    downloadFromCloud,
    cloudPing,
    downloadFullBackup,
    installEmbeddedMaterialsIfNeeded
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootCloudSync);
  }else{
    bootCloudSync();
  }
})();

