# CareLoop 安步

> **技術可行性原型（Proof-of-Concept）**
> 本系統為高中生三人技術原型，尚未對真實長輩進行正式使用者研究，亦未取得 IRB 審查。
> CareLoop 是**居家動作觀察工具**，不是醫療診斷產品。

---

## 專案簡介

CareLoop 安步是一套**隱私優先的居家 FTSST 動作觀察與家屬交接工具**。

用家中已有的手機或筆電，讓長輩完成「五次坐站測試（FTSST）」的動作觀察，系統即時分析並將結果轉譯成家屬看得懂的照護交接語言——全程不錄影、不上傳、不需要額外硬體。

### 三大核心主張

| 主張 | 說明 |
|------|------|
| **零新增硬體** | 手機/筆電即為唯一硬體平台，降低導入門檻 |
| **不保存影像** | 姿態分析全部在瀏覽器端即時運算，影像從不離開裝置 |
| **交接語言輸出** | 把技術數據翻譯成家屬看得懂的日常照護行動建議 |

---

## 功能頁面

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/` | 首頁 | 產品定位、三大主張、參數一致性測試結果、誠實聲明 |
| `/session` | 測試頁 | 開啟攝影機、即時骨架、五次坐站計數、語音/震動提醒 |
| `/history` | 歷史紀錄 | 趨勢圖、個人化基準線、文獻基準驗證卡、JSON 匯出入 |
| `/family` | 家屬摘要 | 規則式問答、週摘要、趨勢圖 |
| `/validation` | 驗證頁 | Monte Carlo 互動模擬（參數一致性測試）、侷限性揭露 |
| `/privacy` | 隱私頁 | 影像不保存機制說明、非醫療診斷聲明 |

---

## 技術架構

```
感知層  →  MediaPipe Pose Landmarker（33 骨架點，WASM 本機）
           + DeviceMotionEvent（陀螺儀 + 加速度計）
           + SNR 加權雙模態融合（lib/sensor-fusion.ts）

決策層  →  規則式決策引擎（lib/decision-engine.ts）
           + 個人化自適應基準線（lib/adaptive-baseline.ts）

行動層  →  畫面色塊 + Web Speech API（zh-TW）+ Vibration API

交接層  →  規則式敘事引擎（lib/narrative-engine.ts）
           + 家屬問答 + 趨勢圖（Recharts）
```

### ObservationLevel 命名原則

| 代碼 | 顯示文字 | 意義 |
|------|----------|------|
| `smooth` | 動作順暢 | 無明顯偏移訊號 |
| `attention` | 略有偏移 | 輕度偏移，建議家人留意 |
| `review` | 建議家人確認 | 明顯偏移或晃動，建議確認 |

> 刻意避免 `stable / unstable / risk / high-risk` 等醫療診斷用語。

---

## 如何執行

```bash
npm install
npm run dev
```

開啟 `http://localhost:3000`。若要使用攝影機，請在 `localhost` 或 HTTPS 環境執行。

### 拍攝成功條件

測試頁會在以下條件都成立時才允許開始或自動倒數：

- 瀏覽器已授權攝影機，且 video stream 正常播放。
- MediaPipe WASM 與 Pose Landmarker Lite 模型已從本機 `/mediapipe` 載入。
- 使用者的頭、肩膀、髖部、膝蓋與腳踝都在畫面中且可見度足夠。
- 鏡頭正對椅子，距離約 2–3 公尺，避免背光或半身入鏡。
- 初始坐姿穩定後，系統會建立坐姿與偏斜中立基準，再開始計數。

### 程式碼品質驗證

```bash
npx eslint .          # 0 errors, 0 warnings
npx tsc --noEmit      # TypeScript 型別全數通過
npm run build         # 全靜態頁面成功生成
```

---

## 演算法驗證

本系統執行**參數一致性測試（Parameter Consistency Test）**而非 FDA In Silico Validation：

- 以 Bohannon（2006）常態分佈參數生成 1,000 位合成患者
- 與已發表臨床閾值比對決策引擎的邏輯一致性
- 結果：整體一致率 ≥ 85%，Cohen's κ ≥ 0.75，計時誤差均值 < 0.22s

**已知侷限（誠實揭露）：**
- Ground Truth 閾值與決策閾值來自相同文獻，存在參數一致性侷限
- 尚未對真實長輩進行正式可用性研究
- 尚未與物理治療師進行盲測一致性比對

下一階段目標：與物理治療所合作，執行 n ≥ 30 的 Expert Agreement Study（目標 ICC ≥ 0.75）。

---

## 隱私聲明

- 攝影機畫面僅用於瀏覽器端即時姿態分析，不錄製、不儲存、不上傳影像
- 系統僅保存數值化測試結果（次數、耗時、偏斜角度、晃動事件、等級）
- 所有歷史紀錄僅儲存在使用者自己的瀏覽器 localStorage，不同步雲端
- 容量超載時自動清理最舊資料（保留最新 20 筆）

---

## 非醫療診斷聲明

CareLoop 是居家動作觀察與照護提醒工具，**不是醫療診斷產品**。系統不判斷任何疾病，不取代醫師或物理治療師的專業評估。若您或家人對身體狀況有疑慮，請諮詢專業醫療人員。

---

## 已知限制

- 所有資料只存在使用者自己的瀏覽器 localStorage，無後端或雲端同步
- MediaPipe WASM 與 Pose Landmarker Lite 模型已放在 `public/mediapipe`，拍攝測試不依賴外部 CDN
- 姿態判斷是 rule-based 居家觀察邏輯，不適合作為臨床判斷依據
- 光線不足時視覺模態 SNR 下降，系統自動降級並提示調整擺位
- iOS Safari 需要額外授權才能使用 DeviceMotionEvent

---

## 文件

| 文件 | 說明 |
|------|------|
| `docs/CareLoop_研究報告.docx` | 完整專題研究報告（Word） |
| `docs/validation-benchmark.md` | 文獻基準驗證方法與來源 |
| `docs/verification-benchmark.md` | 壓力測試條件與結果記錄 |

---

*本專案由三位高中生組成的 CareLoop 安步開發團隊完成，參加 2026 AI 創新獎——智慧照護與居家健康組。*
