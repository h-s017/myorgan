window.HFUGUE_CONFIG = {
  // 貼上 Google Apps Script Web App URL
  CLOUD_SYNC_URL: ""
};

// IFRA 分級擴充：保留原本 index.html，不改動既有原料與配方邏輯。
// 正式 IFRA Standard 類型：Prohibition / Restriction / Specification。
// 「無特定標準、待供應商文件、待確認」為本資料庫的管理狀態，不是 IFRA 正式 Standard 類型。
(() => {
  const IFRA_OPTIONS = [
    ['prohibition', '禁止｜Prohibition'],
    ['restriction', '限制｜Restriction'],
    ['specification', '規格｜Specification'],
    ['restriction_specification', '限制＋規格｜Restriction + Specification'],
    ['no_specific_standard', '無特定標準'],
    ['pending_supplier', '待供應商文件'],
    ['unverified', '待確認']
  ];

  const IFRA_LABELS = Object.fromEntries(IFRA_OPTIONS);

  function inferIfraClass(material) {
    const text = String(material?.ifra || '').trim();
    const lower = text.toLowerCase();

    if (!text) return 'unverified';

    // 80 種練習香基是複方，應以供應商針對實際產品提供的 IFRA Certificate / 合規文件為準。
    if (/80\s*種\s*olfaction|練習香材|練習香基|香基，用於聞香訓練/i.test(text)) {
      return 'pending_supplier';
    }

    const hasProhibition = /prohibition|prohibited|禁止|禁用|不得使用/.test(lower);
    const hasNoSpecific = /無特定限制|查無特定限制|本身無特定限制|無限制/.test(text);
    const hasRestriction = !hasNoSpecific && (/restriction|restricted|有限制|最高\s*[0-9]|最高[：:]?\s*[0-9]|cat\.?\s*\d+\s*最高|限制/.test(lower));
    const hasSpecification = /specification|規格要求|規格標準|純度標準|純度要求/.test(lower);

    if (hasProhibition) return 'prohibition';
    if (hasRestriction && hasSpecification) return 'restriction_specification';
    if (hasRestriction) return 'restriction';
    if (hasSpecification) return 'specification';
    if (hasNoSpecific) return 'no_specific_standard';

    // 「無禁止規定」只代表未看到禁用，不等於沒有 Restriction / Specification。
    if (/無禁止規定|no prohibition/.test(lower)) return 'unverified';

    return 'unverified';
  }

  function ifraClass(material) {
    return material?.ifraClass || inferIfraClass(material);
  }

  function optionHtml(selected) {
    return IFRA_OPTIONS.map(([value, label]) =>
      `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
    ).join('');
  }

  function statusCssClass(value) {
    if (value === 'prohibition') return 'ifra-prohibition';
    if (value === 'restriction' || value === 'restriction_specification') return 'ifra-restriction';
    if (value === 'specification') return 'ifra-specification';
    if (value === 'no_specific_standard') return 'ifra-clear';
    if (value === 'pending_supplier') return 'ifra-pending';
    return 'ifra-unverified';
  }

  function injectStyles() {
    if (document.getElementById('ifra-extension-styles')) return;
    const style = document.createElement('style');
    style.id = 'ifra-extension-styles';
    style.textContent = `
      .tag.ifra-tag{font-weight:600;letter-spacing:.01em}
      .tag.ifra-prohibition{background:#fff0ed;border-color:#e5aaa0;color:#9d3f31}
      .tag.ifra-restriction{background:#fff7e8;border-color:#e7ca8b;color:#7a5a22}
      .tag.ifra-specification{background:#eef3f8;border-color:#c8d4df;color:#40566b}
      .tag.ifra-clear{background:#eef5ef;border-color:#c6d8c9;color:#47604b}
      .tag.ifra-pending{background:#f4f1ea;border-color:#d8d0c1;color:#6d6253}
      .tag.ifra-unverified{background:#f3f2ed;border-color:#ddd8ce;color:#77736c}
      .ifra-field-note{font-size:11px;color:var(--muted);line-height:1.5;margin-top:2px}
    `;
    document.head.appendChild(style);
  }

  function currentFilteredMaterials() {
    try {
      const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
      const sf = document.getElementById('scentFilter')?.value || '';
      return sortedMaterials().filter(m => {
        const types = (m.type || []).map(cleanLabel);
        const hay = [
          m.en,
          m.cn,
          m.cas,
          m.inci,
          types.join(' '),
          (m.note || []).join(' '),
          (m.alias || []).join(' '),
          IFRA_LABELS[ifraClass(m)] || '',
          m.ifra || ''
        ].join(' ').toLowerCase();
        return (!q || hay.includes(q)) &&
          (!activeNote || (m.note || []).includes(activeNote)) &&
          (!activeKind || m.kind === activeKind) &&
          (!sf || types.includes(sf));
      });
    } catch (error) {
      console.warn('IFRA card mapping fallback:', error);
      return [];
    }
  }

  function enhanceCards() {
    const cards = [...document.querySelectorAll('#materialGrid .card')];
    if (!cards.length) return;

    const materials = currentFilteredMaterials();
    cards.forEach((card, index) => {
      if (card.querySelector('.ifra-tag')) return;
      const material = materials[index];
      if (!material) return;

      const value = ifraClass(material);
      const badge = document.createElement('span');
      badge.className = `tag ifra-tag ${statusCssClass(value)}`;
      badge.textContent = `IFRA｜${(IFRA_LABELS[value] || '待確認').split('｜')[0]}`;
      badge.title = material.ifra || IFRA_LABELS[value] || '待確認';

      const meta = card.querySelector('.meta');
      if (meta) meta.appendChild(badge);
    });
  }

  function migrateIfraClass() {
    try {
      let changed = false;
      db.forEach(material => {
        if (!material.ifraClass) {
          material.ifraClass = inferIfraClass(material);
          changed = true;
        }
      });
      if (changed && typeof saveDb === 'function') saveDb();
    } catch (error) {
      console.warn('IFRA migration skipped:', error);
    }
  }

  function patchApp() {
    if (typeof renderLibrary !== 'function' || typeof drawerHtml !== 'function' || typeof saveDrawer !== 'function') {
      console.warn('IFRA extension: app functions not ready.');
      return;
    }

    injectStyles();
    migrateIfraClass();

    const baseRenderLibrary = renderLibrary;
    renderLibrary = function () {
      const result = baseRenderLibrary.apply(this, arguments);
      enhanceCards();
      return result;
    };

    const baseDrawerHtml = drawerHtml;
    drawerHtml = function (material) {
      const html = baseDrawerHtml(material);
      const selected = ifraClass(material);
      const field = `<div class="fg"><label>IFRA 分級</label><select id="d_ifra_class">${optionHtml(selected)}</select><div class="ifra-field-note">正式類型為禁止／限制／規格；複方香基請以供應商針對實際產品用途提供的 IFRA Certificate 為準。</div></div>`;
      const target = '<div class="fg full"><label>IFRA / 合規備註</label>';
      return html.includes(target) ? html.replace(target, field + target) : html;
    };

    const baseSaveDrawer = saveDrawer;
    saveDrawer = function () {
      try {
        const material = db.find(x => x.id === currentId);
        const select = document.getElementById('d_ifra_class');
        if (material && select) material.ifraClass = select.value;
      } catch (error) {
        console.warn('IFRA class save skipped:', error);
      }
      return baseSaveDrawer.apply(this, arguments);
    };

    // init() 在 index.html 內已先跑過一次；補跑以立即把分級顯示到卡片。
    renderLibrary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchApp, { once: true });
  } else {
    setTimeout(patchApp, 0);
  }
})();
