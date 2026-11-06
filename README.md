# HANA 調香台 Organ｜Master

This repository is the **master / internal Organ** for Hana Scent Artist.

- Master safety data: `safety-data.js`
- Internal interface: `index.html`
- Architecture: see [ARCHITECTURE.md](./ARCHITECTURE.md)

The student production interface is maintained at `https://hanascent.com/organ/`.  
The old `hana-scent-organ` repository is only a compatibility entry and should not become a second source of rules.


## 2026-11-07：14 種單體參考資料與 IFRA 初篩

- `safety-data.js`：保留原 CW 80 款香基數值，另設 `singleMolecules`，包含 CAS、INCI、氣味、香型、試作用量、來源、查核日期與 Cat.4／9／10B 限量。
- `material-catalog.js`：將參考資料加入原料庫，依 CAS 更新已存在的單體，保留 ID、私人聞香筆記、建議與配方；新條目遇 ID 衝突時分配未使用 ID。
- `safety-engine.js`：單體依 CAS、香基依原產品身分比對；重複成分加總，不套用相似名稱的香基限量。滴數、未知資料、原料規格未確認均保留待複核。
- `safety.js`：顯示目標成品比例、同成分合計、限量及複核原因；以有效香料重量比例計算，不推定未提供的複方組成。
- `1%` 與 `0.5%` 明確表示 1% 與 0.5%；不再被當成 100% 與 50%。無百分號的 0–1 小數沿用原本比例輸入慣例。

### 資料界線

試作用量以未稀釋有效單體占香精配方的 w/w% 表示；IFRA 數值以最終成品 w/w% 表示。建議區間不是法規安全上限。尚未取得每瓶原料的批次規格，無特定標準不視為已完成安全評估。配方中的其他複方可能含有相同受限成分，其未知貢獻不會被系統自動推定。

舊 `Undercavertol`（ID 20／CAS 67694-66-6）名稱與身分不一致，保留記錄並標示待確認；新 `Undecavertol` 使用 CAS 81782-77-6，兩筆不自動合併。

### 驗證

執行 `node tests/single-molecules.test.cjs`。涵蓋 14 種原料、分類別限量、重複成分合計、臨界值、未知與規格型原料、滴數／混合單位、舊紀錄更新、筆記保留、ID 衝突、重載與百分比解析。
