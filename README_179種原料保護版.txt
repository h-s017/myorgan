H.Fugue 調香台 Organ｜179 種原料保護版

本 package 目的：
1. 保留原本第二版資料架構。
2. 保留 Formula Fix：修正「香料實秤總克數 / 實際需秤 g」計算。
3. 新增「下載原料庫 JSON」與「上傳原料庫 JSON」。
4. 更新 sw.js 快取版本，降低手機/電腦一直讀舊版的機率。

重要操作順序：
1. 先把本 package 的 index.html / config.js / sw.js / manifest.json 覆蓋到 GitHub repo 根目錄。
2. 等 GitHub Pages 更新 1–3 分鐘。
3. 在目前可以看到 179 種原料的瀏覽器開啟 App。
4. 按「下載原料庫 JSON」，確認匯出的 JSON 內 materialCount 是 179。
5. 把這份 hfugue-materials-179-backup.json 保留起來。
6. 之後換電腦、清快取、或重裝 App，可以用「上傳原料庫 JSON」匯回 179 種原料。

注意：
hfugue-formulas.json 是配方備份，不是完整原料庫備份。
原料庫備份檔應該長得像：
{
  "type": "hfugue-organ-material-db",
  "materialCount": 179,
  "materials": [...]
}
