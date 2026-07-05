# CareLoop 安步：文獻基準驗證文件
# Literature-Based Benchmark Validation

**文件性質**：本文件說明 CareLoop 安步原型在技術層面的文獻基準驗證方式。

> **重要聲明**：本系統為高中生三人隊伍完成的技術原型（Proof-of-Concept），尚未執行獨立的臨床人體受試研究。驗證方法採「文獻基準驗證（Literature-Based Benchmark Validation）」，以下列出具體引用來源與驗證邏輯。

---

## 為什麼用文獻基準驗證？

早期醫療 AI 原型在人體試驗資源有限的情況下，普遍採用兩種驗證策略：

**1. 文獻基準驗證（Literature-Based Benchmark Validation）**：
- 將系統輸出與已發表的金標準研究數據進行比對，驗證系統是否落在合理的臨床預期範圍。
- 優點：可引用、可核實、有學術背書
- 適用階段：Proof-of-Concept / Alpha 原型

**2. 獨立使用者研究（Independent User Study）**：
- 招募真實受試者執行 IRB 核准的研究方案。
- 適用階段：Beta / 商業化前驗證
- **本系統目前所處階段：規劃中，尚未執行**

---

## 驗證維度一：計時準確性（Timing Accuracy）

### 文獻基準

**Bohannon, R.W. (2006).** *Reference values for the five-repetition sit-to-stand test.*
Journal of Strength and Conditioning Research, 20(4), 887–889.

| 年齡組 | 均值（5次總計） | 標準差 |
|--------|----------------|--------|
| 60–69 歲 | 11.4 秒 | 2.6 秒 |
| 70–79 歲 | 12.6 秒 | 3.4 秒 |
| 80–89 歲 | 14.8 秒 | 4.8 秒 |

**Meretta, B.M. et al. (2006).** MDC（最小可偵測變化量）≈ **2.3 秒**

### CareLoop 的驗證邏輯

CareLoop 使用瀏覽器端 `performance.now()` 計時，解析度為 0.5ms（受 Spectre 安全限制）。

**隊員內部功能測試（30 次，模擬不同節奏）：**

| 動作節奏 | 次數 | 均值誤差 | 最大誤差 |
|----------|------|----------|----------|
| 慢速（>14s） | 10 | ±0.19s | 0.38s |
| 正常（10–14s） | 10 | ±0.22s | 0.44s |
| 快速（<10s） | 10 | ±0.26s | 0.48s |
| **整體** | **30** | **±0.22s** | **0.48s** |

**結論**：計時誤差均值 0.22s = MDC 的 9.6%，技術上不會造成臨床判斷偏差。

---

## 驗證維度二：姿態偵測（Pose Detection）

### 文獻基準

**Google MediaPipe BlazePose（2020–2023 benchmark）**
- 33 個骨架關鍵點，支援 3D 估計
- COCO 基準資料集上骨架偵測準確率：> 90%（Full Body Keypoints）
- 智慧型手機端即時推理，30fps 穩定執行

**相關研究：Smartphone-based STS Analysis（MDPI Sensors, 2022）**
- 使用智慧型手機影像分析坐站測試，與實驗室動作捕捉系統的相關性 *r > 0.90*
- ICC 範圍：0.85–0.97
- 絕對誤差百分比：< 6%

### CareLoop 的實作

CareLoop 的姿態偵測使用 MediaPipe `PoseLandmarker Lite`（WASM 版本，完全本機運算）。
- 採用業界成熟的開源模型作為感知層基礎，減少從零訓練模型的風險，專注於動作特徵提取
- 偏斜角度計算使用左右肩膀 x 座標差，當 `visibilityAvg < 0.55` 時自動降級，避免低品質幀誤判
- GPU Delegate 優先啟動，失敗時自動降級至 CPU（`components/PoseCanvas.tsx`）

---

## 驗證維度三：雙模態感測器融合（Sensor Fusion）

### 文獻基準

**Complementary Filter（標準方法）**
- 低成本 IMU + 影像融合的標準做法，廣泛見於機器人與可穿戴設備領域
- Mahony filter / Complementary filter 的運算複雜度遠低於 Kalman filter，適合瀏覽器環境

**低通濾波器截止頻率計算（α = 0.2 的依據）**

```
FTSST 動作週期：1–4 秒 → 頻率範圍 0.25–1 Hz
DeviceMotionEvent 取樣率：~60Hz（T_s = 16.7ms）
一階低通截止頻率：f_c ≈ α / (2π × T_s × (1−α)) ≈ 0.5 Hz
結論：α = 0.2 精準落在 FTSST 動作頻率帶的上緣，有效濾除 >2 Hz 的高頻雜訊
```

---

## 本系統的誠實限制聲明

> 以下限制在競賽 Demo 中將主動揭露，體現學術誠信。

| 限制 | 說明 |
|------|------|
| **尚未招募真實受試者** | 目前僅有三位高中生隊員的內部功能測試。尚未對 55 歲以上長輩進行正式可用性研究。 |
| **沒有 IRB 審查** | 本系統的任何測試均不構成人體試驗，但若未來進入臨床驗證階段，將依規定申請 IRB。 |
| **物理治療師驗證待執行** | 計劃聯繫物理治療所，執行與治療師判斷的一致性研究（目標：ICC ≥ 0.75）。 |
| **環境依賴性** | 光線不足或背光環境下，視覺模態 SNR 下降，系統會自動降級為「單視覺模式」並在 UI 標示。 |
| **參數一致性侷限** | Ground Truth 閾值與決策引擎閾值來自相同文獻，存在參數一致性測試的內在侷限，不等同於外部驗證。 |

---

## 下一階段驗證計劃（Expert Agreement Study）

| 項目 | 內容 |
|------|------|
| 目標樣本 | n ≥ 30 位 60 歲以上真實受試者 |
| 盲測設計 | 物理治療師在不知道 AI 判定結果的情況下，觀看動作影片並獨立給出評估 |
| 統計指標 | ICC（組內相關係數）、Cohen's Kappa |
| 目標標準 | ICC ≥ 0.75（Portney & Watkins 定義的「可接受信度」） |
| 現狀 | 尋找合作物理治療所中，尚未執行 |

---

## 引用文獻

1. Bohannon, R.W. (2006). Reference values for the five-repetition sit-to-stand test. *J Strength Cond Res*, 20(4), 887–889.
2. Meretta, B.M. et al. (2006). The five times sit to stand test: responsiveness to change. *J Geriatr Phys Ther*, 29(1), 3–8.
3. Whitney, S.L. et al. (2005). Clinical measurement of sit-to-stand performance. *Physical Therapy*, 85(10), 1034–1045.
4. Google. (2020). BlazePose: On-device Real-time Body Pose Tracking. *arXiv:2006.10204*.
5. MDPI Sensors (2022). Validity and reliability of smartphone-based sit-to-stand analysis. *Sensors*, 22(3), 1113.
6. Portney, L.G., & Watkins, M.P. (2009). Foundations of Clinical Research (3rd ed.). Pearson.
