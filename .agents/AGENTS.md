# CareLoop 安步 — 專案 AI 協作規則（AGENTS.md）

## 專案定位（不可更動）

**CareLoop 是「隱私優先的居家 FTSST 動作觀察與家屬交接工具」**，這是技術可行性原型（Proof-of-Concept）。

**禁止**在任何程式碼、UI 文字、文件中使用以下字眼：
- `醫療診斷`、`臨床診斷`、`疾病判斷`
- `高風險`、`危險`（不可用於描述使用者的測試結果）
- `FDA 認可`、`In Silico Validation`（系統本身的驗證不可宣稱符合此標準）
- `準確率繼承`、`我們的系統繼承了...的準確性`
- `stable`/`unstable`/`risk` 作為 ObservationLevel 的值（已棄用）

**必須**在所有涉及驗證宣稱的地方使用以下正確用語：
- 驗證方法：`參數一致性測試（Parameter Consistency Test）`
- 系統定位：`居家動作觀察工具`、`技術可行性原型（Proof-of-Concept）`
- 統計數字：`整體一致率`（非「準確率」）

---

## 型別系統規則

### ObservationLevel（核心狀態型別）
```typescript
type ObservationLevel = 'smooth' | 'attention' | 'review'
```

| 值 | 顯示文字 | 意義 |
|----|----------|------|
| `smooth` | 動作順暢 | 無明顯偏移訊號 |
| `attention` | 略有偏移 | 輕度偏移，建議留意 |
| `review` | 建議家人確認 | 明顯偏移或晃動 |

### 禁止使用的舊值（已棄用）
- `stable`、`caution`、`unstable`、`high`、`medium`、`low`

### HudStatus（UI 狀態，僅供前端使用）
```typescript
type HudStatus = 'setup' | 'ready' | 'smooth' | 'attention' | 'review' | 'tracking-lost'
```

---

## ESLint 規則（必須全數通過）

```bash
npx eslint .  # 必須 0 errors, 0 warnings
```

### 常見錯誤與對策

| 錯誤 | 對策 |
|------|------|
| `react-hooks/refs`：render 中存取 ref.current | 改用 state 或在 useEffect / event handler 中存取 |
| `react-hooks/set-state-in-effect`：effect 同步 setState | 改用 `setTimeout(fn, 0)` 非同步觸發 |
| `react-hooks/purity`：Date.now() 在 useMemo | 改用 `useState(() => Date.now())` |
| `@typescript-eslint/no-explicit-any` | 補齊具體型別定義 |
| `react/no-unescaped-entities` | `'` → `&apos;`，`"` → `&quot;` |

---

## TypeScript 規則

- `next.config.mjs` 中**禁止**設定 `ignoreBuildErrors: true`
- 所有元件必須通過 `npx tsc --noEmit`
- 所有 React 元件 props 必須有明確型別定義
- 禁止使用 `as any`，必須使用具體型別或 `as unknown as SpecificType`

---

## 容錯機制（必須實作）

### GPU Fallback（PoseCanvas.tsx）
MediaPipe 初始化時必須有 GPU → CPU 的 try-catch 降級機制。

### localStorage 保護（storage.ts）
所有 localStorage.setItem 呼叫必須包在 try-catch 中，處理 `QuotaExceededError`。

### Demo 防線（history/page.tsx）
必須提供「使用示範資料」按鈕，確保攝影機不可用時仍能展示完整功能。

---

## 檔案命名與路徑規則

| 功能 | 檔案路徑 |
|------|----------|
| 型別定義 | `lib/types.ts` |
| 決策引擎 | `lib/decision-engine.ts` |
| 感測器融合 | `lib/sensor-fusion.ts` |
| 個人化基準線 | `lib/adaptive-baseline.ts` |
| 參數一致性測試 | `lib/synthetic-validation.ts` |
| 敘事引擎 | `lib/narrative-engine.ts` |
| 行動層 | `lib/action-engine.ts` |
| 本機儲存 | `lib/storage.ts` |

---

## 示範資料 Schema（public/demo-sessions.json）

示範資料必須使用**最新 Schema**，`level` 欄位只能是 `smooth`、`attention`、`review`。

---

## 文件更新規則

修改系統功能時，必須同步更新：
1. `README.md` — 功能描述與已知限制
2. `docs/validation-benchmark.md` — 如涉及驗證方法或臨床依據
3. `docs/verification-benchmark.md` — 如涉及測試結果或容錯機制
4. `docs/CareLoop_研究報告.docx` — 如有重大架構變更（重新執行 `docs/generate_report.py`）

---

## 建置驗證流程

提交前必須通過：

```bash
npx eslint .          # 0 errors, 0 warnings
npx tsc --noEmit      # 無型別錯誤
npm run build         # 所有靜態頁面成功生成
```
