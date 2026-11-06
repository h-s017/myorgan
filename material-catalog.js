/* Curated reference data is separate from Hana's personal notes and formulas. */
(() => {
  const source = window.HFUGUE_SAFETY_DATA;
  const records = source.singleMolecules || [];
  const revision = source.singleMoleculeRevision;
  const legacyWarning = '舊紀錄名稱 Undercavertol 與 CAS 67694-66-6 不符已查核的 Undecavertol（81782-77-6）。請核對瓶身與 SDS；此筆不套用新單體的 IFRA 資料。';
  function match(material) {
    if (material.kind && material.kind !== '單體') return null;
    if ((material.type || []).some(t => /香基|精油/.test(t))) return null;
    return records.find(r => r.cas === String(material.cas || '').trim()) || null;
  }
  function enrich(material) {
    if (material.en === 'Undercavertol' && material.cas === '67694-66-6') {
      material.identityReview = legacyWarning;
      material.ifra = legacyWarning;
      material.ifraClass = 'unverified';
      return material;
    }
    const record = match(material);
    if (!record) return material;
    material.reference = record;
    material.alias = [...new Set([...(material.alias || []), record.en, ...record.alias])];
    if (material.referenceRevision !== revision) {
      if (material.inci || material.ifra || material.ifraClass) {
        material.referenceHistory = [...(material.referenceHistory || []), {
          replacedBy:revision, inci:material.inci || '', ifra:material.ifra || '', ifraClass:material.ifraClass || ''
        }];
      }
      material.inci = record.inci;
      material.ifra = record.ifra;
      material.ifraClass = record.ifraClass;
      material.referenceRevision = revision;
    }
    return material;
  }
  function defaults(list) {
    const result = list.map(enrich);
    records.forEach(record => {
      if (!result.some(m => match(m)?.cas === record.cas)) {
        result.push(enrich({id: record.id, en: record.en, cn: record.cn,
          cas: record.cas, note: record.note, type: record.type, kind:'單體',
          alias: [...record.alias], personal:'', advisors:[]}));
      }
    });
    return result;
  }
  window.HFUGUE_CATALOG = { defaults, enrich, match };
})();
