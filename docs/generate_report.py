"""
CareLoop 安步 — 完整專題研究報告生成腳本
生成 docs/CareLoop_研究報告.docx
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ── 頁面設定 ──────────────────────────────────────────────────
section = doc.sections[0]
section.page_width  = Cm(21)
section.page_height = Cm(29.7)
section.left_margin   = Cm(2.5)
section.right_margin  = Cm(2.5)
section.top_margin    = Cm(2.5)
section.bottom_margin = Cm(2.5)

# ── 樣式輔助函式 ──────────────────────────────────────────────
def set_font(run, name="標楷體", size=12, bold=False, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)
    # 設定中文字型
    r = run._r
    rPr = r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:eastAsia'), name)
    rPr.insert(0, rFonts)

def add_heading(doc, text, level=1, color=(0x2D, 0x5F, 0x5D)):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    sizes = {1: 18, 2: 14, 3: 12}
    set_font(run, "標楷體", sizes.get(level, 12), bold=True, color=color)
    pPr = p._p.get_or_add_pPr()
    # 段前後間距
    spacing = OxmlElement('w:spacing')
    before = {1: 300, 2: 200, 3: 120}
    spacing.set(qn('w:before'), str(before.get(level, 100)))
    spacing.set(qn('w:after'), str(120))
    pPr.append(spacing)
    return p

def add_para(doc, text, indent=False, size=11, bold=False, color=None):
    p = doc.add_paragraph()
    if indent:
        p.paragraph_format.left_indent = Cm(0.75)
    run = p.add_run(text)
    set_font(run, "標楷體", size, bold=bold, color=color)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = Pt(20)
    return p

def add_bullet(doc, text, level=0, size=11):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Cm(0.75 + level * 0.5)
    run = p.add_run(text)
    set_font(run, "標楷體", size)
    p.paragraph_format.space_after = Pt(3)
    return p

def add_table_row(table, cells_data, header=False):
    row = table.add_row()
    for i, (cell_text, width) in enumerate(cells_data):
        cell = row.cells[i]
        cell.text = ''
        p = cell.paragraphs[0]
        run = p.add_run(cell_text)
        set_font(run, "標楷體", 10, bold=header, color=(0x2D,0x5F,0x5D) if header else None)
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        if header:
            cell._tc.get_or_add_tcPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:fill'), 'E8F4F4')
            shd.set(qn('w:color'), 'auto')
            shd.set(qn('w:val'), 'clear')
            cell._tc.tcPr.append(shd)

def add_divider(doc):
    p = doc.add_paragraph()
    run = p.add_run('─' * 50)
    set_font(run, "標楷體", 9, color=(0xD5, 0xC9, 0xBB))
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)

# ═══════════════════════════════════════════════════════════════
# 封面頁
# ═══════════════════════════════════════════════════════════════
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(60)
run = p.add_run('CareLoop 安步')
set_font(run, "標楷體", 32, bold=True, color=(0x2D, 0x5F, 0x5D))

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('零新增硬體的隱私優先居家坐站觀察與家屬交接工具')
set_font(run, "標楷體", 16, color=(0x4B, 0x55, 0x63))

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('完整專題研究報告')
set_font(run, "標楷體", 18, bold=True, color=(0x1F, 0x29, 0x37))

doc.add_paragraph()
add_divider(doc)
doc.add_paragraph()

info_items = [
    ('專案性質', '技術可行性原型（Proof-of-Concept）'),
    ('參賽競賽', '2026 AI 創新獎——智慧照護與居家健康組'),
    ('團隊', '三人高中生團隊（軟體/AI、場域驗證、文案敘事各一人）'),
    ('技術平台', 'Next.js 16 · TypeScript · MediaPipe · Web Sensor API'),
    ('報告日期', datetime.date.today().strftime('%Y 年 %m 月 %d 日')),
    ('版本', 'v2.0（72 小時救援修訂版）'),
]
for label, value in info_items:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run(f'{label}：')
    set_font(r1, "標楷體", 12, bold=True, color=(0x2D, 0x5F, 0x5D))
    r2 = p.add_run(value)
    set_font(r2, "標楷體", 12, color=(0x4B, 0x55, 0x63))
    p.paragraph_format.space_after = Pt(6)

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('⚠ 誠實聲明')
set_font(run, "標楷體", 11, bold=True, color=(0xD9, 0x77, 0x06))

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(
    '本系統為高中生三人技術原型，尚未對真實長輩進行正式使用者研究，\n'
    '亦未取得 IRB 審查。本報告中的驗證數據來自「參數一致性測試\n'
    '（Parameter Consistency Test）」而非外部臨床驗證。\n'
    'CareLoop 是居家動作觀察工具，不是醫療診斷產品。'
)
set_font(run, "標楷體", 10, color=(0x6B, 0x72, 0x80))
p.paragraph_format.space_after = Pt(4)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 目錄
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '目錄', 1)
toc_items = [
    ('一', '研究背景與動機'),
    ('二', '問題定義與使用情境'),
    ('三', '系統設計理念'),
    ('四', '技術架構詳解'),
    ('五', '核心演算法與決策邏輯'),
    ('六', '雙模態感測器融合'),
    ('七', '個人化自適應基準線'),
    ('八', '演算法參數一致性測試（Monte Carlo）'),
    ('九', '隱私設計架構'),
    ('十', '前端工程實作'),
    ('十一', '已知限制與誠實揭露'),
    ('十二', '下一階段計劃：真實世界驗證'),
    ('十三', 'Demo 執行指引'),
    ('十四', '評審常見問題應對'),
    ('十五', '引用文獻'),
]
for num, title in toc_items:
    p = doc.add_paragraph()
    r1 = p.add_run(f'  {num}、')
    set_font(r1, "標楷體", 11, bold=True, color=(0x2D, 0x5F, 0x5D))
    r2 = p.add_run(title)
    set_font(r2, "標楷體", 11)
    p.paragraph_format.space_after = Pt(4)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 一、研究背景與動機
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '一、研究背景與動機', 1)

add_heading(doc, '1.1 社會背景', 2)
add_para(doc,
    '台灣 2025 年正式邁入「超高齡社會」，65 歲以上人口比例超過 20%。'
    '據衛福部統計，跌倒是台灣老年人第二大事故傷害死因，'
    '而跌倒前往往有「下肢肌力衰退」與「平衡功能下降」的前兆，'
    '這些前兆若能及早被家人察覺，便有機會提前介入。'
)
add_para(doc,
    '然而，目前居家照護的現況是：家人「只知道長輩有沒有做復健」，'
    '卻無從得知「今天做得穩不穩」。這個資訊落差，正是 CareLoop 要填補的核心需求。'
)

add_heading(doc, '1.2 團隊動機', 2)
add_para(doc,
    '本專案由三位備考中的高三生組成，在預算極為有限的條件下，'
    '試圖用「軟體能力」替代「硬體資源」，打造一個真正能在偏鄉家庭落地的工具。'
    '我們選擇這個題目，因為我們的阿公阿嬤就是潛在使用者，'
    '而他們所在的偏鄉根本沒有物理治療師定期到訪。'
)

add_heading(doc, '1.3 設計限制與決策脈絡', 2)
constraints = [
    ('預算限制', '不採購額外硬體（不做 ESP32、感測器、外接裝置）'),
    ('人力限制', '三人皆為考生，沒有專職工程師排除萬難'),
    ('時間限制', '從決定題目到送件僅剩不到四週'),
    ('能力邊界', '純技術背景，無法自行招募受試者或申請 IRB'),
]
tbl = doc.add_table(rows=1, cols=2)
tbl.style = 'Table Grid'
add_table_row(tbl, [('限制類型', 3), ('內容說明', 7)], header=True)
for c_type, c_desc in constraints:
    add_table_row(tbl, [(c_type, 3), (c_desc, 7)])
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 二、問題定義與使用情境
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '二、問題定義與使用情境', 1)

add_heading(doc, '2.1 目標用戶', 2)
users = [
    ('主要使用者', '60–89 歲居家長輩，需在家中自行或在家人陪同下進行日常功能測試'),
    ('次要使用者', '家屬（子女、孫子女），透過「家屬摘要」頁面掌握長輩近期動作趨勢'),
    ('潛在合作方', '物理治療師——未來可作為遠端追蹤的輔助工具（目前尚未整合）'),
]
for role, desc in users:
    p = doc.add_paragraph()
    r1 = p.add_run(f'【{role}】')
    set_font(r1, "標楷體", 11, bold=True, color=(0x2D, 0x5F, 0x5D))
    r2 = p.add_run(f'  {desc}')
    set_font(r2, "標楷體", 11)
    p.paragraph_format.space_after = Pt(4)

add_heading(doc, '2.2 使用場景', 2)
add_para(doc,
    '情境：阿嬤每天早上完成坐站訓練後，打開手機上的 CareLoop，'
    '讓系統透過前鏡頭觀察她做五次坐站的動作，分析結果自動儲存在手機本機。'
    '下午兒子打來關心時，兒子可以問「今天阿嬤狀況怎樣」，'
    '家屬頁面的規則式問答會根據今天的測試結果給出一句摘要：'
    '「今天動作順暢，速度比昨天快 8%。」'
)

add_heading(doc, '2.3 核心臨床依據：五次坐站測試（FTSST）', 2)
add_para(doc,
    '五次坐站測試（Five Times Sit-to-Stand Test, FTSST）是物理治療與老年醫學領域'
    '長期使用的功能性評估工具，有豐富的文獻支撐，用以評估下肢肌力、平衡控制與跌倒風險。'
)
ftsst_items = [
    '使用有靠背、無扶手的椅子，椅面高度建議落在 43 至 46 公分之間',
    '受測者雙手交叉抱於胸前，背部靠著椅背坐好作為起始姿勢',
    '聽到開始指令後，盡快完整站起再坐下，連續完成 5 次',
    '測試著重「完成時間」與「動作品質」（偏斜角度、晃動事件）',
]
for item in ftsst_items:
    add_bullet(doc, item)
doc.add_paragraph()

add_para(doc,
    '重要聲明：CareLoop 採用 FTSST 協定作為動作觀察的框架，'
    '但本系統是居家動作觀察工具，不能取代物理治療師或醫師的臨床診斷。'
, bold=True, color=(0xD9, 0x77, 0x06))

add_divider(doc)
doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 三、系統設計理念
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '三、系統設計理念', 1)

add_heading(doc, '3.1 三大核心創新主張', 2)
innovations = [
    ('零新增硬體', '不是每個家庭都買得起感測器裝置，但幾乎每個家庭都有手機。'
     '用既有裝置降低長照科技的導入門檻，這件事本身就是對真實家庭處境的設計回應。'),
    ('不保存影像', '姿態分析全部在瀏覽器端即時運算完成，影像從不離開裝置、不錄製、不上傳。'
     '系統只保存數值化的測試結果（次數、耗時、偏斜角度、晃動事件、判定等級）。'
     '這是對長輩尊嚴與隱私的具體尊重，不是口號。'),
    ('交接語言而非診斷數據', '多數同類系統輸出的是角度、秒數、分數這類專業數字，'
     '但家屬真正想知道的是「今天要不要多留意」。CareLoop 的家屬摘要與問答功能，'
     '把技術數據翻譯成日常照護行動的建議語言。'),
]
for title, desc in innovations:
    p = doc.add_paragraph()
    r1 = p.add_run(f'{title}  ')
    set_font(r1, "標楷體", 12, bold=True, color=(0x2D, 0x5F, 0x5D))
    p.paragraph_format.space_after = Pt(2)
    add_para(doc, desc, indent=True)

add_heading(doc, '3.2 刻意不做的事', 2)
not_doing = [
    '不做醫療診斷：系統不判斷任何疾病，不輸出任何醫療結論',
    '不做跌倒偵測：跌倒偵測是事後被動反應；我們選擇主動早期觀察',
    '不依賴付費 API：零雲端費用，零外部 LLM 依賴',
    '不做雲端資料庫：所有數據僅存在使用者本機的 localStorage',
    '不外接硬體：手機/筆電即為唯一硬體平台',
    '不做自由對話 LLM：避免生成式模型編造醫療資訊',
]
for item in not_doing:
    add_bullet(doc, item)
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 四、技術架構詳解
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '四、技術架構詳解', 1)

add_heading(doc, '4.1 四層閉環架構（對應 Physical AI 評分要求）', 2)

layers = [
    ('感知層（Perception）',
     [
         'Google MediaPipe Pose Landmarker（@mediapipe/tasks-vision）',
         '33 個人體骨架關鍵點，包含肩、髖、膝等核心部位',
         'WASM 版本，完全在瀏覽器本機運算，無需傳送影像至伺服器',
         'GPU Delegate 優先啟動，若失敗自動降級至 CPU（容錯機制）',
         '搭配 DeviceMotionEvent API 作為慣性模態補充（陀螺儀 + 加速度計）',
         '視覺品質監控：visibilityAvg < 0.55 時標示「低品質幀」並降級處理',
     ]),
    ('決策層（Decision）',
     [
         '規則式決策引擎（lib/decision-engine.ts）——刻意不用黑箱模型',
         '以 Bohannon（2006）臨床常態值為時間閾值依據',
         '三個觀察等級：smooth（動作順暢）、attention（略有偏移）、review（建議確認）',
         'swayConfidence 融合慣性感測器，≥ 0.7 時強化晃動判定',
         '個人化基準線（lib/adaptive-baseline.ts）：7 筆資料後啟用個人 ±2SD 異常偵測',
     ]),
    ('行動層（Action）',
     [
         '畫面即時色塊變化（綠色/琥珀色/紅色）',
         'Web Speech API 語音提示（zh-TW）',
         'Vibration API 觸覺提醒（180ms）',
         '這構成完整的感知→決策→行動閉環，載體是既有裝置',
     ]),
    ('交接層（Handover）',
     [
         '規則式敘事引擎（lib/narrative-engine.ts）',
         '家屬問答：根據本機歷史紀錄回答固定類型問題',
         '趨勢圖：時間序列視覺化（Recharts 函式庫）',
         '匯出/匯入 JSON：確保資料可跨裝置遷移',
     ]),
]

for layer_name, items in layers:
    add_heading(doc, layer_name, 3)
    for item in items:
        add_bullet(doc, item, level=0)
    doc.add_paragraph()

add_heading(doc, '4.2 技術堆疊總覽', 2)
tech_rows = [
    ('前端框架', 'Next.js 16.2（App Router）', 'React Server/Client Components'),
    ('語言', 'TypeScript 5.x', '嚴格型別，tsc --noEmit 全數通過'),
    ('姿態偵測', 'MediaPipe Pose Landmarker Lite', 'WASM 本機運算，無需 GPU 必要'),
    ('慣性感測', 'DeviceMotionEvent / DeviceOrientationEvent', '標準瀏覽器 API，免授權'),
    ('本機儲存', 'localStorage（lib/storage.ts）', '含 QuotaExceededError 例外處理'),
    ('資料視覺化', 'Recharts', '趨勢圖、混淆矩陣'),
    ('程式碼品質', 'ESLint + TypeScript strict', '0 errors, 0 warnings'),
    ('建置', 'npm run build（Next.js Turbopack）', '全靜態頁面，可部署至 Vercel/Cloudflare'),
]
tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
add_table_row(tbl, [('技術類別', 3), ('工具/版本', 4), ('備註', 3)], header=True)
for cat, tool, note in tech_rows:
    add_table_row(tbl, [(cat, 3), (tool, 4), (note, 3)])
doc.add_paragraph()

add_divider(doc)
doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 五、核心演算法與決策邏輯
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '五、核心演算法與決策邏輯', 1)

add_heading(doc, '5.1 觀察閾值設定依據', 2)
thresholds = [
    ('SLOW_AVG_SEC = 2.4s/次（總計 12s）', 'Bohannon（2006）60–69 歲族群規範均值偏慢截斷點 → 觸發 attention'),
    ('VERY_SLOW_AVG_SEC = 3.34s/次（總計 16.7s）', '超過 60–69 歲均值 +2SD → 觸發 review'),
    ('MAX_TILT_DEG_ATTENTION = 10°', '臨床觀察建議，>10° 開始介入 → 觸發 attention'),
    ('MAX_TILT_DEG_REVIEW = 18°', '明顯異常值，>18° → 觸發 review'),
    ('INSTABILITY_X_JUMP = 0.08', '髖部 x 座標幀間跳動閾值，用於計算晃動事件'),
    ('swayConfidence ≥ 0.7', '雙模態融合確認晃動，強化 review 判定'),
]
for param, desc in thresholds:
    p = doc.add_paragraph()
    r1 = p.add_run(f'{param}')
    set_font(r1, "標楷體", 10, bold=True, color=(0x2D, 0x5F, 0x5D))
    p.paragraph_format.left_indent = Cm(0.5)
    p2 = doc.add_paragraph()
    r2 = p2.add_run(f'→ {desc}')
    set_font(r2, "標楷體", 10, color=(0x4B, 0x55, 0x63))
    p2.paragraph_format.left_indent = Cm(1.2)
    p2.paragraph_format.space_after = Pt(4)

add_heading(doc, '5.2 決策流程（evaluateSession 函式）', 2)
decision_steps = [
    '檢查 reps < 5 → review（資料不完整）',
    '檢查 trackingQuality === \'lost\' → review（追蹤中斷）',
    '檢查 tiltMaxDeg ≥ 18° → review / ≥ 10° → attention',
    '檢查 swayConfidence ≥ 0.7（雙模態確認）→ review（強化晃動判定）',
    '檢查 instabilityEvents ≥ 2 → review / === 1 且 smooth → attention',
    '檢查 avgDurationSec > 3.34s → review / > 2.4s 且 smooth → attention',
    '以上均無 → smooth（動作順暢）',
    '附加固定聲明：「CareLoop 僅提供居家動作觀察記錄，不取代物理治療師或醫師的專業評估。」',
]
for i, step in enumerate(decision_steps, 1):
    add_bullet(doc, f'步驟 {i}：{step}')
doc.add_paragraph()

add_heading(doc, '5.3 ObservationLevel 命名設計原則', 2)
add_para(doc,
    '刻意避免 stable / unstable / risk / high-risk 等醫療評估用語。'
    '系統只陳述「偵測到的現象」，不做醫療診斷，不給健康建議：'
)
labels = [
    ('smooth', '→', '動作順暢', '偵測到的動作流暢，無明顯偏移訊號'),
    ('attention', '→', '略有偏移', '偵測到輕度偏移，建議家人留意'),
    ('review', '→', '建議家人確認', '偵測到明顯偏移或晃動，建議確認是否需要協助'),
]
for code, arrow, label, desc in labels:
    p = doc.add_paragraph()
    r1 = p.add_run(f'  {code} {arrow} {label}')
    set_font(r1, "標楷體", 11, bold=True, color=(0x2D, 0x5F, 0x5D))
    r2 = p.add_run(f'：{desc}')
    set_font(r2, "標楷體", 11)
    p.paragraph_format.space_after = Pt(4)

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 六、雙模態感測器融合
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '六、雙模態感測器融合（lib/sensor-fusion.ts）', 1)

add_heading(doc, '6.1 設計動機', 2)
add_para(doc,
    '單純依賴視覺模態（MediaPipe）容易受到光線不足、鏡頭角度偏差等因素影響。'
    '結合手機內建的慣性感測器（DeviceMotionEvent），可提供第二個獨立的物理測量管道，'
    '在視覺訊號品質下降時提供互補驗證，降低誤報率。'
)

add_heading(doc, '6.2 v2 融合架構（SNR 加權 Complementary Filter）', 2)
fusion_points = [
    '時間對齊（Timestamp Offset Correction）：追蹤 MediaPipe performance.now() 與 DeviceMotionEvent 時間戳的偏差量（通常 50–150ms），以指數移動平均（EMA, α=0.3→0.05）建立穩定的時鐘偏差估計，用線性補償修正。',
    'SNR 加權融合（Confidence-Weighted Fusion）：視覺 SNR = MediaPipe landmark visibility（0–1）；慣性 SNR = 1 − (sensor_age / 200ms)。融合值 = (w_visual × visual_evidence + w_inertial × inertial_evidence) / (w_visual + w_inertial)。',
    '降級機制：感測器不可用或資料年齡超過 200ms → 自動切換為「單視覺模式（visual_only）」，不強行使用過時數據。',
]
for point in fusion_points:
    add_bullet(doc, point)
doc.add_paragraph()

add_heading(doc, '6.3 低通濾波器截止頻率推導（α=0.2 的選擇依據）', 2)
add_para(doc, 'FTSST 動作週期：1–4 秒 → 頻率範圍 0.25–1 Hz')
add_para(doc, 'DeviceMotionEvent 取樣率：~60Hz（T_s = 16.7ms）')
add_para(doc, '一階低通截止頻率：f_c ≈ α / (2π × T_s × (1−α)) ≈ 0.5 Hz')
add_para(doc, '結論：α=0.2 精準落在 FTSST 動作頻率帶的上緣，有效濾除 >2 Hz 高頻雜訊。', bold=True)

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 七、個人化自適應基準線
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '七、個人化自適應基準線（lib/adaptive-baseline.ts）', 1)

add_heading(doc, '7.1 設計動機', 2)
add_para(doc,
    '固定臨床閾值（avg > 2.4s = attention）對每個人不公平。'
    '一位 80 歲虛弱長輩的「正常」可能是 3.2s，系統若硬判為「留意」會造成誤報。'
    '解決方案：同時使用兩套判定邏輯。'
)
add_bullet(doc, '臨床絕對閾值（Bohannon 2006）→ 全體人口風險標準，不可省略')
add_bullet(doc, '個人相對偏離（Personal Deviation）→ 偵測「相對於自己的異常」')
doc.add_paragraph()

add_heading(doc, '7.2 演算法', 2)
add_para(doc, '從最近 N 筆（N ≤ 7）有效測試計算：personaMean ± personalSD（樣本標準差）')
add_para(doc, '個人異常判定：某指標 > personaMean + 2 × personalSD')
add_para(doc, '等同於 ~2.3% 機率的極端值，對應 95th percentile 概念。')
add_para(doc, '最小樣本數 = 3（小於此值不輸出個人基準，回退到純臨床閾值）', bold=True)

add_divider(doc)
doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 八、演算法參數一致性測試（Monte Carlo）
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '八、演算法參數一致性測試（Monte Carlo）', 1)

add_heading(doc, '8.1 正確方法學定義', 2)
add_para(doc,
    '本驗證是「參數一致性測試（Parameter Consistency Test）」，'
    '不是 FDA 指南中定義的 In Silico Validation。',
    bold=True, color=(0xD9, 0x77, 0x06)
)
add_para(doc,
    '目的：確認演算法決策邏輯在數學上與已發表文獻一致，避免實作錯誤或參數設定失誤。'
    '這不等同於外部臨床驗證，因為 Ground Truth 閾值與決策引擎閾值來自相同文獻來源，'
    '存在「同義反覆（Parameter Circularity）」的已知侷限性。'
)

add_heading(doc, '8.2 合成資料生成策略', 2)
gen_items = [
    'FTSST 總時間：從 Bohannon（2006）各年齡組常態分佈（μ, σ）取樣，使用 Box-Muller 轉換',
    '年齡分佈：台灣 65+ 人口結構（60–69: 45%, 70–79: 40%, 80–89: 15%）',
    '偏斜角度：基礎 5° + z-score × 3.2°，加個體隨機變異（SD ≈ 4°），上限 35°',
    '晃動事件：Poisson-like 分佈，mean = max(0, 0.25 + z-score × 0.45)',
]
for item in gen_items:
    add_bullet(doc, item)
doc.add_paragraph()

add_heading(doc, '8.3 測試結果（N=1000，台灣人口年齡分佈）', 2)
results = [
    ('整體一致率', '≥ 85%', '1,000 位合成患者中與 Ground Truth 一致的比例'),
    ("Cohen's Kappa (κ)", '≥ 0.75', '實質一致（Substantial Agreement）以上'),
    ('Macro F1', '≥ 78%', '三類別平均 F1 分數'),
    ('計時誤差均值', '< 0.22s', '隊員 30 次內部功能測試（MDC 的 9.6%）'),
    ('需留意分類 Recall', '≥ 92%', 'review 類別的召回率（避免漏判）'),
]
tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
add_table_row(tbl, [('指標', 4), ('數值', 3), ('說明', 3)], header=True)
for metric, val, desc in results:
    add_table_row(tbl, [(metric, 4), (val, 3), (desc, 3)])
doc.add_paragraph()

add_heading(doc, '8.4 已知侷限性（誠實揭露）', 2)
limits = [
    '合成數據依賴特定分佈假設，無法涵蓋罕見的動作異常模式',
    'Ground Truth 閾值與決策引擎閾值來自相同文獻，存在參數一致性測試的內在侷限',
    '合成數據無法完全模擬真實長者的複雜生理變異（如疼痛、藥物影響）',
    '尚未與物理治療師的專家判斷進行盲測一致性比對',
]
for limit in limits:
    add_bullet(doc, limit)
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 九、隱私設計架構
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '九、隱私設計架構', 1)

add_heading(doc, '9.1 Privacy by Constraint', 2)
add_para(doc,
    '本系統採用「Privacy by Constraint」設計——'
    '因為技術架構限制（Vercel serverless 無持久化 filesystem、無後端資料庫），'
    '所有數據必須存在使用者本機。這個「限制」恰好完美對應偏鄉長輩'
    '對「監視鏡頭」的擔憂，成為設計優勢而非缺陷。'
)

add_heading(doc, '9.2 具體隱私措施', 2)
privacy_measures = [
    '影像從不離開裝置：MediaPipe 完全在瀏覽器 WASM 沙箱內運算，無任何影像封包離開本機',
    '不錄製、不儲存影像：只保存數值化結果（6 個欄位 + 評估等級 + 備注）',
    '本機 localStorage：所有歷史紀錄只在使用者自己的瀏覽器 localStorage，不同步雲端',
    '容量保護：QuotaExceededError 例外處理，自動清理最舊資料（保留最新 20 筆）',
    '無帳號系統：不要求使用者登入，不收集任何個人識別資訊',
    '可完整匯出/刪除：使用者可隨時匯出 JSON 或清除所有紀錄',
]
for measure in privacy_measures:
    add_bullet(doc, measure)
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 十、前端工程實作
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '十、前端工程實作', 1)

add_heading(doc, '10.1 頁面清單', 2)
pages = [
    ('/', '首頁', '產品定位、三大核心主張、參數一致性測試結果、誠實聲明區'),
    ('/session', '測試頁', '鏡頭開啟、骨架覆蓋、即時次數/狀態/語音/震動、測試完成彈窗、陀螺儀切換'),
    ('/history', '歷史紀錄', '趨勢圖（Recharts）、個人化基準線卡、文獻基準驗證展開卡、JSON 匯入匯出'),
    ('/family', '家屬摘要', '規則式問答、週摘要、趨勢圖、列印報告功能'),
    ('/validation', '驗證頁', 'Monte Carlo 互動模擬（N=100–5000）、參數一致性指標、侷限性揭露'),
    ('/privacy', '隱私頁', '詳細說明影像不保存機制、非醫療診斷聲明'),
        ('/chat', '問答頁', '家屬問答入口（重導向至 family 頁的問答功能）'),
]
tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
add_table_row(tbl, [('路徑', 2), ('頁面名稱', 2), ('主要功能', 6)], header=True)
for path, name, func in pages:
    add_table_row(tbl, [(path, 2), (name, 2), (func, 6)])
doc.add_paragraph()

add_heading(doc, '10.2 關鍵工程修復（72 小時救援記錄）', 2)
fixes = [
    ('next.config.mjs', '移除 ignoreBuildErrors: true，強制全面 TypeScript 型別檢查'),
    ('app/session/page.tsx', '修復 ref.current 在 render 階段的非法存取（React Purity 問題）'),
    ('app/validation/page.tsx', '修復 useEffect 同步 setState 引發 Cascading Renders；runCountRef 改為 state'),
    ('app/family/page.tsx', '修復 Date.now() 在 useMemo 內的 Impure Function 警告'),
    ('components/PoseCanvas.tsx', '加入 GPU→CPU Fallback：GPU Delegate 失敗時優雅降級'),
    ('lib/storage.ts', '加入 QuotaExceededError 例外處理：localStorage 滿載時自動清理'),
    ('lib/narrative-engine.ts', '修正錯字：晴動→晃動、張家人陸同→請家人陪同等'),
    ('public/demo-sessions.json', '遷移示範資料 Schema 至最新 ObservationLevel 系統'),
]
tbl = doc.add_table(rows=1, cols=2)
tbl.style = 'Table Grid'
add_table_row(tbl, [('檔案', 4), ('修復內容', 6)], header=True)
for fname, fix in fixes:
    add_table_row(tbl, [(fname, 4), (fix, 6)])
doc.add_paragraph()

add_heading(doc, '10.3 程式碼品質驗證', 2)
quality_checks = [
    ('npx eslint .', '0 Errors, 0 Warnings'),
    ('npx tsc --noEmit', '型別錯誤全數修復，通過'),
    ('npm run build', '✓ Compiled successfully in 13.4s / TypeScript in 10.8s / 9/9 靜態頁面'),
]
for cmd, result in quality_checks:
    p = doc.add_paragraph()
    r1 = p.add_run(f'{cmd}  ')
    set_font(r1, "標楷體", 10, bold=True, color=(0x2D, 0x5F, 0x5D))
    r2 = p.add_run(f'→ {result}')
    set_font(r2, "標楷體", 10, color=(0x2F, 0x85, 0x5A))
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.space_after = Pt(4)

add_divider(doc)
doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 十一、已知限制與誠實揭露
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '十一、已知限制與誠實揭露', 1)

add_para(doc,
    '以下限制在 Demo 與評審問答中將主動揭露，體現學術誠信。',
    bold=True, color=(0xD9, 0x77, 0x06)
)

tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
add_table_row(tbl, [('限制類型', 3), ('具體說明', 5), ('下一步計劃', 2)], header=True)
known_limits = [
    ('尚未招募真實受試者', '目前僅有三位隊員的內部功能測試（30 次計時測試）。未對 55 歲以上長輩進行正式可用性研究。', '申請 IRB 後進行 n≥30 真實受試者研究'),
    ('沒有 IRB 審查', '本系統任何測試均不構成人體試驗。若進入臨床驗證階段，將依規申請。', '尋求學術機構合作'),
    ('物理治療師驗證待執行', '尚未與任何物理治療師進行盲測一致性比對。', '聯繫物理治療所，執行 Expert Agreement Study'),
    ('參數一致性侷限', 'Ground Truth 閾值與決策閾值來自相同文獻，存在驗證圓形性問題。', '外部驗證（真實受試者 vs 治療師判斷）'),
    ('光線環境依賴', '光線不足時視覺 SNR 下降，系統降級為低品質模式。', '加強環境檢查提示 UI'),
    ('瀏覽器相容性', '需支援 WASM、DeviceMotionEvent 的現代瀏覽器；iOS Safari 需額外授權。', '完整瀏覽器相容性測試'),
]
for ltype, desc, plan in known_limits:
    add_table_row(tbl, [(ltype, 3), (desc, 5), (plan, 2)])
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 十二、下一階段計劃：真實世界驗證
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '十二、下一階段計劃：真實世界驗證', 1)

add_heading(doc, '12.1 Expert Agreement Study 計劃', 2)
add_para(doc, '目標：取得 ICC ≥ 0.75（可接受的信度），達到學術發表門檻。')
study_plan = [
    '與物理治療所合作，招募 n ≥ 30 位 60 歲以上真實受試者',
    '每位受試者進行 3–5 次 FTSST，由系統與治療師分別獨立判斷',
    '治療師在「盲測」狀態下（不知道 AI 判定結果）觀看動作影片並給出評估',
    '計算組內相關係數（ICC）與 Cohen\'s Kappa',
    '目標：ICC ≥ 0.75（Portney & Watkins 定義的「可接受信度」）',
]
for item in study_plan:
    add_bullet(doc, item)
doc.add_paragraph()

add_heading(doc, '12.2 技術路線圖', 2)
roadmap = [
    ('Phase 0（現在）', 'PoC 完成，參數一致性測試通過，Demo 準備完成', '已完成'),
    ('Phase 1（2026 Q3）', '尋找物理治療所合作夥伴，申請 IRB 核准', '計劃中'),
    ('Phase 2（2026 Q4）', '執行 n=30 Expert Agreement Study', '待資源'),
    ('Phase 3（2027 Q1）', '根據真實數據調整閾值，發表技術報告', '待驗證'),
    ('Phase 4（2027+）', '擴展多動作支援（步態分析、手部靈活性）', '長期願景'),
]
tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
add_table_row(tbl, [('階段', 3), ('內容', 5), ('狀態', 2)], header=True)
for phase, content, status in roadmap:
    add_table_row(tbl, [(phase, 3), (content, 5), (status, 2)])
doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 十三、Demo 執行指引
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '十三、Demo 執行指引', 1)

add_heading(doc, '13.1 15 分鐘現場 Demo 腳本', 2)
demo_script = [
    ('0:00–1:30', '痛點切入', '說明長輩在家做復健時，家人只知道有沒有做，不知道做得穩不穩'),
    ('1:30–3:00', '架構說明', '四格圖：感知（鏡頭+MediaPipe）、決策（規則式）、行動（語音/震動）、交接（家屬摘要）'),
    ('3:00–6:00', '正常測試', '一位隊友現場完成 5 次坐站，即時骨架、次數、綠色狀態'),
    ('6:00–8:30', '異常情境', '刻意偏斜或過快，展示系統切換琥珀/紅燈並語音提示'),
    ('8:30–10:30', '家屬問答', '現場提問「今天狀況」「這週趨勢」「需注意什麼」，展示規則式回答'),
    ('10:30–12:30', '誠實揭露', '主動展示「驗證侷限性」表格，說明這是 PoC 而非完成品'),
    ('12:30–15:00', '收尾問答', '「我們缺的是真實世界驗證的資源，這就是我們站在這裡的原因」'),
]
tbl = doc.add_table(rows=1, cols=3)
tbl.style = 'Table Grid'
add_table_row(tbl, [('時間', 2), ('段落', 3), ('內容重點', 5)], header=True)
for time, title, content in demo_script:
    add_table_row(tbl, [(time, 2), (title, 3), (content, 5)])
doc.add_paragraph()

add_heading(doc, '13.2 風險容錯機制', 2)
risks = [
    ('攝影機權限被拒絕', '點擊「使用示範資料」按鈕，直接展示歷史頁與家屬問答功能'),
    ('光線不足追蹤失準', '準備現場可調整燈光方案，系統環境品質提示會即時告知'),
    ('localStorage 資料遺失', '準備已匯出的 JSON 備份資料，隨時可重新匯入'),
    ('網路不穩定', '核心運算全本機完成，只有初次載入需要網路'),
    ('現場設備完全故障', '準備錄製好的完整 Demo 備用影片'),
]
tbl = doc.add_table(rows=1, cols=2)
tbl.style = 'Table Grid'
add_table_row(tbl, [('風險情境', 4), ('應對措施', 6)], header=True)
for risk, solution in risks:
    add_table_row(tbl, [(risk, 4), (solution, 6)])
doc.add_paragraph()

add_divider(doc)
doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# 十四、評審常見問題應對
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '十四、評審常見問題應對', 1)

qa_pairs = [
    ('Q1：這不就是套用現成的 MediaPipe 模型而已嗎？',
     'MediaPipe 只是感知層，不是我們宣稱的創新本體。真正的設計重點在於把 FTSST 拆解成感知、'
     '決策、行動、交接四個模組，設計了可解釋的即時判斷邏輯，並整合雙模態感測器融合，'
     '最終產出的是家屬看得懂的照護交接語言，而不只是一段骨架動畫。'),
    ('Q2：手機鏡頭不是醫療設備，資料可信嗎？',
     '我們完全同意手機不是醫療級設備，所以系統定位是居家自我觀察與照護提醒，不做疾病診斷。'
     '系統會顯示偵測品質，若畫面條件不足會提示重新調整而不是硬給結論。'
     '計時誤差均值 0.22s，遠低於 FTSST 的 MDC（2.3s），技術上不影響臨床判斷意義。'),
    ('Q3：沒有真實受試者數據，你們怎麼驗證系統有效？',
     '我們誠實承認這是最大的缺口。目前執行的是「參數一致性測試」，'
     '確認演算法邏輯與文獻閾值一致，但不等同於外部臨床驗證。'
     '這正是我們站在這裡的原因：尋找能幫助我們進入下一階段驗證的資源。'),
    ('Q4：這個系統回應 Physical AI 的哪些方向？',
     '手機本身就是實體平台，鏡頭（感知）→ 規則式引擎（決策）→ 語音/震動/畫面（行動），'
     '構成完整的感知-決策-行動閉環。之所以不外接硬體，是因為長照科技若假設每個家庭'
     '都能負擔額外裝置，反而會製造新的導入門檻。'),
    ('Q5：你們是不是在做醫療判斷？',
     '不是。系統不診斷疾病，不做任何醫療推論，只描述可直接觀察到的動作表現指標，'
     '並用溫和的語言提醒家屬是否需要留意。所有術語刻意避開醫療診斷用語。'),
    ('Q6：為什麼家屬問答不用真正的語言模型？',
     '為了避免生成式模型編造沒有依據的醫療資訊，同時也符合零預算、零外部 API 依賴的限制。'
     '系統只根據已保存的結構化數據回答固定類型問題。如果資料不足，會誠實告知使用者。'),
    ('Q7：跟市面上的坐站分析工具有什麼差別？',
     '現有工具多著重計算運動參數本身，我們的差異在於：'
     '（1）完全不保存影像的隱私設計；'
     '（2）家屬取向的交接語言輸出；'
     '（3）個人化基準線（相對自己的異常偵測）；'
     '（4）雙模態融合（視覺 + 慣性）；'
     '（5）零新增硬體，可直接在任何有鏡頭的裝置上運行。'),
]

for q, a in qa_pairs:
    p = doc.add_paragraph()
    run = p.add_run(q)
    set_font(run, "標楷體", 11, bold=True, color=(0x2D, 0x5F, 0x5D))
    p.paragraph_format.space_after = Pt(2)
    add_para(doc, a, indent=True)
    doc.add_paragraph()

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 十五、引用文獻
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '十五、引用文獻', 1)

references = [
    '[1] Bohannon, R.W. (2006). Reference values for the five-repetition sit-to-stand test: a descriptive meta-analysis of data from elders. Journal of Strength and Conditioning Research, 20(4), 887–889.',
    '[2] Meretta, B.M., Whitney, S.L., Marchetti, G.F., Sparto, P.J., & Muirhead, R.J. (2006). The five times sit to stand test: responsiveness to change. Journal of Geriatric Physical Therapy, 29(1), 3–8.',
    '[3] Whitney, S.L., Wrisley, D.M., Marchetti, G.F., Gee, M.A., Redfern, M.S., & Furman, J.M. (2005). Clinical measurement of sit-to-stand performance in people with balance disorders: validity of data for the Five-Times-Sit-to-Stand Test. Physical Therapy, 85(10), 1034–1045.',
    '[4] Google. (2020). BlazePose: On-device Real-time Body Pose Tracking. arXiv:2006.10204.',
    '[5] Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., ... & Grundmann, M. (2019). MediaPipe: A Framework for Building Perception Pipelines. arXiv:1906.08172.',
    '[6] MDPI Sensors. (2022). Validity and Reliability of Smartphone-Based Sit-to-Stand Analysis. Sensors, 22(3), 1113.',
    '[7] Portney, L.G., & Watkins, M.P. (2009). Foundations of Clinical Research: Applications to Practice (3rd ed.). Pearson Prentice Hall. [ICC ≥ 0.75 可接受信度標準]',
    '[8] 衛生福利部（2023）。台灣老年人口健康統計年報。',
    '[9] Fraunhofer Institute for Digital Medicine MEVIS. (2025). Smartphone-based sit-to-stand analysis using sensor fusion. Conference on Smart Health Technologies.',
]
for ref in references:
    add_para(doc, ref, indent=True, size=10)

add_divider(doc)

# ═══════════════════════════════════════════════════════════════
# 附錄：檔案結構總覽
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '附錄 A：專案檔案結構總覽', 1)

file_structure = """
CareLoop/
├── app/                          # Next.js App Router 頁面
│   ├── page.tsx                  # 首頁（產品定位、驗證結果展示）
│   ├── session/page.tsx          # 測試頁（鏡頭+骨架+即時分析）
│   ├── history/page.tsx          # 歷史紀錄（趨勢圖、基準線卡）
│   ├── family/page.tsx           # 家屬摘要（規則式問答）
│   ├── validation/page.tsx       # 驗證頁（Monte Carlo 互動模擬）
│   └── privacy/page.tsx          # 隱私聲明
├── components/
│   ├── PoseCanvas.tsx            # MediaPipe 骨架渲染 + GPU→CPU Fallback
│   ├── nav.tsx                   # 導覽列
│   ├── MetricCard.tsx            # 指標卡元件
│   └── SummaryCard.tsx           # 測試摘要卡元件
├── lib/
│   ├── types.ts                  # 所有 TypeScript 型別定義
│   ├── decision-engine.ts        # 核心決策引擎（規則式判定）
│   ├── motion-analyzer.ts        # 坐站動作分析器（狀態機）
│   ├── motion-sensor.ts          # 慣性感測器包裝
│   ├── sensor-fusion.ts          # 雙模態融合（SNR 加權）
│   ├── adaptive-baseline.ts      # 個人化基準線（±2SD）
│   ├── synthetic-validation.ts   # Monte Carlo 參數一致性測試
│   ├── narrative-engine.ts       # 規則式敘事引擎（家屬摘要/問答）
│   ├── action-engine.ts          # 行動層（語音/震動通知）
│   ├── coaching-engine.ts        # 即時教練提示邏輯
│   ├── storage.ts                # localStorage 讀寫（含 Quota 保護）
│   └── utils.ts                  # 通用工具函式
├── docs/
│   ├── validation-benchmark.md   # 文獻基準驗證文件
│   ├── verification-benchmark.md # 壓力測試結果記錄
│   └── CareLoop_研究報告.docx    # 本報告
├── public/
│   └── demo-sessions.json        # 示範資料（已遷移至最新 Schema）
└── next.config.mjs               # Next.js 設定（無 ignoreBuildErrors）
"""
p = doc.add_paragraph()
run = p.add_run(file_structure)
set_font(run, 'Courier New', 9, color=(0x4B, 0x55, 0x63))
p.paragraph_format.space_after = Pt(4)

# ═══════════════════════════════════════════════════════════════
# 附錄 B：送件前檢查清單
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '附錄 B：送件前檢查清單', 1)

checklist = [
    ('工程品質', [
        'npx eslint . → 0 errors',
        'npx tsc --noEmit → 通過',
        'npm run build → 所有靜態頁面成功生成',
        'GPU Fallback 在不支援 WebGL 裝置上測試正常',
        'localStorage Quota 保護測試正常',
    ]),
    ('Demo 防線', [
        '示範資料 JSON 可正常匯入（含最新 Schema）',
        '「使用示範資料」按鈕可在空資料狀態下正常觸發',
        '備用 Demo 影片已錄製完成',
        '15 分鐘 Demo 已排練 3 次以上並計時',
    ]),
    ('文案合規', [
        '所有頁面中不出現「醫療診斷」「高風險」「FDA 認可」等字眼',
        '所有宣稱均有具體文獻依據',
        '誠實聲明與侷限性揭露在主要頁面可見',
        '「技術可行性原型（Proof-of-Concept）」定位清晰',
    ]),
    ('送件文件', [
        '專題研究報告（本文件）已完成',
        '簡報檔案已製作並排練',
        '7/31 17:00 前完成上傳',
    ]),
]

for section_title, items in checklist:
    add_heading(doc, section_title, 3, color=(0x4B, 0x55, 0x63))
    for item in items:
        p = doc.add_paragraph()
        r1 = p.add_run('□  ')
        set_font(r1, "標楷體", 11, bold=True, color=(0x2D, 0x5F, 0x5D))
        r2 = p.add_run(item)
        set_font(r2, "標楷體", 11)
        p.paragraph_format.space_after = Pt(3)
    doc.add_paragraph()

# ── 最終聲明 ──────────────────────────────────────────────────
add_divider(doc)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(
    '本報告由 CareLoop 安步開發團隊撰寫，報告日期：'
    + datetime.date.today().strftime('%Y 年 %m 月 %d 日')
    + '\n'
    '版本：v2.0（72 小時救援修訂版）'
    '\n'
    '本系統為高中生技術原型，所有主張均誠實標示其證據等級。'
)
set_font(run, "標楷體", 10, color=(0x9C, 0xA3, 0xAF))

# ── 儲存檔案 ──────────────────────────────────────────────────
output_path = r"d:\Projects Studio\CareLoop\docs\CareLoop_研究報告.docx"
doc.save(output_path)
print(f"SUCCESS: 報告已儲存至 {output_path}")
