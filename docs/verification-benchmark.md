# CareLoop 安步：壓力測試與驗證報告
# Verification & Stress Test Report

**報告日期**：2026 年 7 月 5 日
**版本**：v2.0（72 小時救援修訂版）
**適用版本**：`npm run build` 已確認通過的正式版本

---

## 1. 測試環境

| 項目 | 規格 |
|------|------|
| 作業系統 | Windows（PowerShell） |
| Node.js | 內含於 npm 環境 |
| Next.js | 16.2.6（Turbopack） |
| TypeScript | strict mode |
| 程式碼檢查 | ESLint（Next.js 官方設定） |

---

## 2. 靜態分析壓力測試

### 2.1 ESLint（`npx eslint .`）

**最終結果：0 Errors, 0 Warnings**

**本次修復的錯誤清單：**

| 錯誤類型 | 檔案 | 修復內容 |
|----------|------|----------|
| `react-hooks/refs`（render 中存取 ref.current） | `app/session/page.tsx` | 改用 `completedSession` state 儲存完成時的 session |
| `react-hooks/set-state-in-effect`（effect 同步 setState） | `app/validation/page.tsx` | 改用 `setTimeout(runSimulation, 0)` 非同步觸發 |
| `react-hooks/refs`（render 中存取 runCountRef.current） | `app/validation/page.tsx` | 改用 `useState` 追蹤執行次數 |
| `react-hooks/purity`（useMemo 內呼叫 Date.now()） | `app/family/page.tsx` | 改用 `useState(() => Date.now())` 初始化固定值 |
| `@typescript-eslint/no-explicit-any`（4 個 any） | `app/session/page.tsx` | 補齊 Fullscreen API 型別定義 |
| `react/no-unescaped-entities`（Cohen's 引號） | `app/validation/page.tsx` | 改為 `Cohen&apos;s` |
| `@typescript-eslint/no-unused-vars` | `components/nav.tsx` | 移除未使用的 `Home` import |
| 錯字（誕實、影限、晴動等） | `lib/narrative-engine.ts` | 全數修正 |

### 2.2 TypeScript 型別檢查（`npx tsc --noEmit`）

**最終結果：通過，無型別錯誤**

| 修復項目 | 說明 |
|----------|------|
| `ObservationLevel` 未引入 | 在 `app/session/page.tsx` 補齊 import |
| `completionSession` 可能為 null | 改用 `completedSession` state，確保型別為 `SessionEvent`（非 null） |

### 2.3 Production 建置（`npm run build`）

**最終結果：成功**

```
▲ Next.js 16.2.6 (Turbopack)
✓ Compiled successfully in 13.4s
  Finished TypeScript in 10.8s
✓ Generating static pages (9/9) in 2.7s

Route (app)
├ ○ /
├ ○ /_not-found
├ ○ /chat
├ ○ /family
├ ○ /history
├ ○ /privacy
├ ○ /session
└ ○ /validation
```

**重要**：`next.config.mjs` 中的 `ignoreBuildErrors: true` 已於本版本移除，所有 TypeScript 錯誤必須真實修復才能通過建置。

---

## 3. 邊界容錯壓力測試

### 3.1 GPU Delegate 失敗降級（`components/PoseCanvas.tsx`）

**測試條件**：模擬不支援 WebGL 的老舊裝置或瀏覽器設定

**實作機制**：
```typescript
try {
  landmarker = await tasksVision.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { ..., delegate: 'GPU' },
    ...
  })
} catch (err) {
  console.warn('GPU initialization failed, falling back to CPU:', err)
  landmarker = await tasksVision.PoseLandmarker.createFromOptions(vision, {
    baseOptions: { ..., delegate: 'CPU' },
    ...
  })
}
```

**預期行為**：GPU 初始化失敗時，自動重試 CPU 模式，使用者看到正常的骨架顯示而非白屏錯誤。

### 3.2 localStorage 容量超載（`lib/storage.ts`）

**測試條件**：模擬 localStorage 配額耗盡（DOMException: QuotaExceededError）

**實作機制**：
```typescript
try {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted))
} catch (e) {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    console.warn('localStorage quota exceeded. Dropping oldest sessions.')
    if (sessions.length > 20) {
      setSessions(sortSessions(sessions).slice(0, 20))
    }
  }
}
```

**預期行為**：超過容量時，自動保留最新 20 筆資料，應用程式不崩潰，最新測試結果仍可儲存。

### 3.3 Demo 防線（`app/history/page.tsx`）

**測試條件**：攝影機拒絕授權，localStorage 為空，無任何歷史資料

**實作機制**：「使用示範資料」按鈕，從 `/demo-sessions.json`（最新 Schema：`smooth/attention/review`）一鍵匯入。

**預期行為**：Demo 環節中即使攝影機無法使用，仍可完整展示歷史紀錄頁、家屬摘要頁的所有功能。

---

## 4. 敘事與文案合規測試

### 4.1 移除的過度宣稱

| 原始字眼 | 修改後 |
|----------|--------|
| `FDA 認可的 In Silico Validation` | `參數一致性測試（Parameter Consistency Test）` |
| `In Silico Validation — FDA 2023 認可方法學` | `Parameter Consistency Test` |
| `Monte Carlo 演算法驗證結果` | `Monte Carlo 參數一致性測試結果` |
| `整體準確率` | `整體一致率` |
| `高風險族群 Recall` | `需留意分類 Recall` |
| `10 位長輩真實測試的早期驗證原型` | `技術可行性原型（Proof-of-Concept）` |

### 4.2 修正的錯字

| 錯誤 | 正確 |
|------|------|
| 誕實 | 誠實 |
| 影限 | 侷限 |
| 晴動 | 晃動 |
| 張家人陸同 | 請家人陪同 |
| 費務或戴動 | 費力或晃動 |

### 4.3 移除的繼承說法

`docs/validation-benchmark.md` 中的「我們的系統繼承了 MediaPipe 已發表的準確性數據」已移除，改為「採用業界成熟開源模型作為感知層基礎，專注於動作特徵提取」。

---

## 5. 資料一致性測試

### 5.1 demo-sessions.json Schema 遷移

舊 Schema（已遷移）：

```json
{ "level": "high" }   // 舊
{ "level": "medium" } // 舊
{ "level": "low" }    // 舊
```

新 Schema（現行）：

```json
{ "level": "review" }    // 需留意
{ "level": "attention" } // 略有偏移
{ "level": "smooth" }    // 動作順暢
```

---

## 6. 結論

本版本（v2.0）已通過以下所有驗證門檻：

| 驗證項目 | 狀態 |
|----------|------|
| `npx eslint .` → 0 errors | ✅ 通過 |
| `npx tsc --noEmit` → 無型別錯誤 | ✅ 通過 |
| `npm run build` → 9/9 靜態頁面成功 | ✅ 通過 |
| GPU Fallback 容錯機制 | ✅ 已實作 |
| localStorage Quota 保護 | ✅ 已實作 |
| Demo 示範資料按鈕 | ✅ 已實作 |
| 過度宣稱文案全面清除 | ✅ 完成 |
| 錯字全數修正 | ✅ 完成 |

---

*本報告由 CareLoop 安步開發團隊撰寫，版本 v2.0，2026 年 7 月 5 日。*
