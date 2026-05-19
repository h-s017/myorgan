H.FUGUE 調香台 Organ｜個人雲端同步版 v1

本 package 已設定 Google Apps Script endpoint：
https://script.google.com/macros/s/AKfycbyu8ckzH_X11ziS5J6Dz7lUNHpLMnRsLAUt1PCozG02N4mC34NSn072_wrf5_oFSJSH3w/exec

包含功能：
1. 內建 181 筆原料資料
2. 修正香料實秤克數公式
3. iOS / Android PWA 加入主畫面
4. Google Sheet 個人雲端同步
5. 下載 / 上傳原料庫 JSON
6. 完整備份 JSON
7. Service Worker 快取版本更新，避免手機讀舊版

上傳 GitHub：
把這些檔案覆蓋到 myorgan repo 根目錄：
- index.html
- config.js
- sw.js
- manifest.json

注意：
- icons/logo-192.png 與 icons/logo-512.png 仍需保留在 GitHub repo。
- 如果手機已安裝舊版 PWA，請先刪除舊 App，再重新加入主畫面。
- Google Sheet 第一次同步：請先在有完整資料的電腦上按「上傳到雲端」，再到手機按「從雲端下載」。
