(() => {
  const SOURCE = window.HFUGUE_SAFETY_DATA || { rows: [] };
  const CATEGORY_LABELS = {
    cat4: '香水／留香型 Cat.4',
    cat9: '洗沐／沖洗型 Cat.9',
    cat10b: '空間噴霧 Cat.10B',
    ...(SOURCE.categories || {})
  };

  function injectStyles() {
    if (document.getElementById('formula-safety-styles')) return;
    const style = document.createElement('style');
    style.id = 'formula-safety-styles';
    style.textContent = `
      .safety-summary{border:1px solid var(--line);border-radius:16px;padding:13px 15px;margin:0 0 12px;background:#fbfaf6}
      .safety-summary.ok{background:#f1f7f2;border-color:#afc7b4;color:#31543a}.safety-summary.near{background:#fff8e8;border-color:#e3c77f;color:#765a20}.safety-summary.over{background:#fff1ee;border-color:#df9d91;color:#8a3428}.safety-summary.neutral{color:var(--muted)}
      .safety-title{font-weight:700}.safety-detail{font-size:12px;margin-top:3px;line-height:1.55}.safety-legal{font-size:11px;margin-top:6px;opacity:.8}
      .safety-cell{min-width:150px}.safety-badge{display:inline-block;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;white-space:nowrap}
      .safety-badge.ok{background:#e5f1e7;color:#31543a}.safety-badge.near{background:#fff0c8;color:#765a20}.safety-badge.over,.safety-badge.prohibited{background:#f8d9d3;color:#8a3428}.safety-badge.review{background:#ece9e2;color:#665f55}
      .safety-numbers{font-size:11px;color:var(--muted);line-height:1.45;margin-top:4px}.product-category{min-width:225px}
    `;
    document.head.appendChild(style);
  }

  function ensureSafetyUI() {
    const top = document.querySelector('.recipe-top');
    if (top && !document.getElementById('productCategory')) {
      const field = document.createElement('div');
      field.className = 'fg';
      field.innerHTML = `<label>產品類別／IFRA 類別</label><select id="productCategory" class="product-category" onchange="recalc()"><option value="">請選擇產品類別</option><option value="cat4">香水／留香型 Cat.4</option><option value="cat9">洗沐／沖洗型 Cat.9</option><option value="cat10b">空間噴霧 Cat.10B</option></select>`;
      const concentration = document.getElementById('perfumeConcentration')?.closest('.fg');
      (concentration || top.lastElementChild)?.after(field);
    }
    const table = document.querySelector('#panel-formula table');
    if (table) {
      const header = table.querySelector('thead tr');
      if (header && !header.querySelector('.safety-head')) {
        const th = document.createElement('th');
        th.className = 'safety-head';
        th.textContent = 'IFRA 配方初篩';
        header.insertBefore(th, header.children[7] || null);
      }
      [...table.querySelectorAll('tbody tr')].forEach(tr => {
        if (tr.querySelector('.safety-cell')) return;
        const td = document.createElement('td');
        td.className = 'safety-cell';
        tr.insertBefore(td, tr.children[7] || null);
      });
    }
    const wrap = document.querySelector('#panel-formula .table-wrap');
    if (wrap && !document.getElementById('safetySummary')) {
      const summary = document.createElement('div');
      summary.id = 'safetySummary';
      summary.className = 'safety-summary neutral';
      summary.innerHTML = '<div class="safety-title">請先選擇產品類別</div><div class="safety-detail">產品類別會決定 IFRA 上限；未選擇前不進行合格／超量判定。</div>';
      wrap.before(summary);
    }
  }

  function fmt(value, digits = 3) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Number(value).toFixed(digits).replace(/\.?0+$/, '') + '%';
  }

  function renderSafety() {
    ensureSafetyUI();
    const category = document.getElementById('productCategory')?.value || '';
    const fragrancePct = parseConcentration(document.getElementById('perfumeConcentration')?.value || '20%');
    const hasG = rows.some(r => r.unit === 'g' && num(r.amount) > 0);
    const hasDrops = rows.some(r => r.unit === '滴' && num(r.amount) > 0);
    const mixed = hasG && hasDrops;
    const results = HFUGUE_FORMULA_SAFETY.evaluateRows(rows, db, category, fragrancePct, {
      mixed, drops:hasDrops,
      invalidConcentration:!HFUGUE_FORMULA_SAFETY.validConcentration(document.getElementById('perfumeConcentration')?.value)
    });
    [...document.querySelectorAll('#formulaRows tr')].forEach((tr, index) => {
      const row = rows[index];
      const result = results[index];
      const cell = tr.querySelector('.safety-cell');
      if (!cell) return;
      row.safety = { category, categoryLabel: CATEGORY_LABELS[category] || '', ...result };
      if (result.blank) { cell.innerHTML = '<span class="muted">—</span>'; return; }
      const usage = result.usage != null && Number.isFinite(result.usage) ? ` · 使用率 ${fmt(result.usage, 1)}` : '';
      const hazards = result.hazards > 0 ? `<br>MSDS：${result.hazards} 項危害聲明` : '';
      const aggregate = result.aggregateActual != null ? ` · 同成分合計 ${fmt(result.aggregateActual)}` : '';
      cell.innerHTML = `<span class="safety-badge ${result.level}">${result.label}</span><div class="safety-numbers">目標成品 ${fmt(result.actual)}${aggregate} · 上限 ${fmt(result.limit)}${usage}${hazards}<br>${esc(result.detail || "")}</div>`;
    });
    const active = results.filter(r => !r.blank);
    const summary = document.getElementById('safetySummary');
    if (!summary) return;

    if (!category) {
      summary.className = 'safety-summary neutral';
      summary.innerHTML = '<div class="safety-title">請先選擇產品類別</div><div class="safety-detail">產品類別會決定 IFRA 上限；未選擇前不進行合格／超量判定。</div>';
      return;
    }

    const counts = level => active.filter(r => r.level === level).length;
    const over = counts('over') + counts('prohibited');
    const near = counts('near');
    const review = counts('review');
    const ok = counts('ok');
    let level = 'neutral', title = '尚未輸入可檢核的配方';
    if (active.length) {
      if (over) { level = 'over'; title = `🔴 配方未通過：${over} 項超量或禁止使用`; }
      else if (near || review) { level = 'near'; title = `🟡 配方需要複核：${near} 項接近上限、${review} 項缺資料`; }
      else { level = 'ok'; title = '🟢 目前未發現 IFRA 超量'; }
    }
    summary.className = `safety-summary ${level}`;
    summary.innerHTML = `<div class="safety-title">${title}</div><div class="safety-detail">${CATEGORY_LABELS[category]} · 已檢核 ${active.length} 項｜數值未超量 ${ok}｜接近 ${near}｜超量／禁用 ${over}｜待複核 ${review}</div><div class="safety-legal">依 CW 文件與 IFRA 第51次修訂單體資料，按目標有效香料濃度初篩；同成分各列已加總。未計入複方中未知成分貢獻，實際秤重、原料規格與成品法規仍需複核。</div>`;
  }

  function patchApp() {
    if (typeof renderFormula !== 'function' || typeof recalc !== 'function') return;
    injectStyles();
    ensureSafetyUI();

    const baseCollectMeta = collectMetaFromDom;
    collectMetaFromDom = function () {
      const meta = baseCollectMeta.apply(this, arguments);
      meta.productCategory = document.getElementById('productCategory')?.value || '';
      return meta;
    };
    const baseApplyMeta = applyMetaToDom;
    applyMetaToDom = function (formula) {
      const result = baseApplyMeta.apply(this, arguments);
      ensureSafetyUI();
      const select = document.getElementById('productCategory');
      if (select) select.value = formula?.productCategory || '';
      return result;
    };
    const baseRecalc = recalc;
    recalc = function () {
      const result = baseRecalc.apply(this, arguments);
      renderSafety();
      return result;
    };
    const baseRenderFormula = renderFormula;
    renderFormula = function () {
      const result = baseRenderFormula.apply(this, arguments);
      ensureSafetyUI();
      renderSafety();
      return result;
    };
    const current = typeof currentFormula === 'function' ? currentFormula() : null;
    if (current && typeof current.productCategory !== 'string') current.productCategory = '';
    renderFormula();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchApp, { once: true });
  else setTimeout(patchApp, 0);
})();

