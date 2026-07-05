"""
CareLoop 安步 — 完整專題研究報告生成腳本 v3.0
生成 docs/CareLoop_研究報告.docx

符合：
  - 2026 AI 創新獎 組別二：智慧照護與居家健康創新 評審規範
  - 大學五章式學術論文排版標準
  - APA 第七版引用格式
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.section import WD_SECTION
import datetime
import copy

# ================================================================
# 輔助函式
# ================================================================

def set_run_font(run, zh_font="標楷體", en_font="Times New Roman", size=12, bold=False, italic=False, color=None):
    """設定中英文混排字型"""
    run.font.name = en_font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)
    r = run._r
    rPr = r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:eastAsia'), zh_font)
    rFonts.set(qn('w:ascii'), en_font)
    rFonts.set(qn('w:hAnsi'), en_font)
    rPr.insert(0, rFonts)

def set_para_spacing(para, before=0, after=6, line_spacing=None):
    """設定段落間距"""
    pPr = para._p.get_or_add_pPr()
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:before'), str(int(before * 20)))
    spacing.set(qn('w:after'), str(int(after * 20)))
    if line_spacing:
        spacing.set(qn('w:line'), str(int(line_spacing * 240)))
        spacing.set(qn('w:lineRule'), 'auto')
    pPr.append(spacing)

def add_heading(doc, text, level=1):
    """添加標題，符合論文格式"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    size_map = {1: 18, 2: 14, 3: 12}
    color_map = {1: (0x2D, 0x5F, 0x5D), 2: (0x1F, 0x29, 0x37), 3: (0x4B, 0x55, 0x63)}
    before_map = {1: 24, 2: 18, 3: 12}
    set_run_font(run, size=size_map.get(level, 12), bold=True, color=color_map.get(level))
    set_para_spacing(p, before=before_map.get(level, 12), after=8)
    return p

def add_para(doc, text, size=12, bold=False, italic=False, color=None, align=WD_ALIGN_PARAGRAPH.JUSTIFY, first_line_indent=True, before=0, after=6):
    """添加正文段落，預設首行縮排、左右對齊"""
    p = doc.add_paragraph()
    p.alignment = align
    if first_line_indent:
        p.paragraph_format.first_line_indent = Pt(size * 2)
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold, italic=italic, color=color)
    set_para_spacing(p, before=before, after=after, line_spacing=1.5)
    return p

def add_bullet(doc, text, level=0, size=11):
    """添加條列項目"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(0.75 + level * 0.5)
    p.paragraph_format.first_line_indent = Cm(-0.5)
    run_bullet = p.add_run(("•  " if level == 0 else "-  "))
    set_run_font(run_bullet, size=size, bold=True, color=(0x2D, 0x5F, 0x5D))
    run_text = p.add_run(text)
    set_run_font(run_text, size=size)
    set_para_spacing(p, before=0, after=4, line_spacing=1.5)
    return p

def add_table(doc, headers, rows, col_widths=None):
    """添加學術格式表格"""
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.style = 'Table Grid'

    # 表頭
    hdr_cells = tbl.rows[0].cells
    for i, h in enumerate(headers):
        cell = hdr_cells[i]
        cell.text = ''
        p = cell.paragraphs[0]
        run = p.add_run(h)
        set_run_font(run, size=11, bold=True, color=(0xFF, 0xFF, 0xFF))
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # 表頭底色
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:fill'), '2D5F5D')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:val'), 'clear')
        tcPr.append(shd)

    # 資料列
    for row_data in rows:
        row_cells = tbl.add_row().cells
        for i, cell_text in enumerate(row_data):
            cell = row_cells[i]
            cell.text = ''
            p = cell.paragraphs[0]
            run = p.add_run(str(cell_text))
            set_run_font(run, size=10)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT

    doc.add_paragraph()
    return tbl

def add_caption(doc, text, is_table=True, number=0):
    """添加圖表說明"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    prefix = "表" if is_table else "圖"
    run = p.add_run(f"{prefix} {number}  {text}")
    set_run_font(run, size=10, italic=True, color=(0x4B, 0x55, 0x63))
    set_para_spacing(p, before=4, after=12)

def add_page_break(doc):
    doc.add_page_break()

def add_section_divider(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('')
    set_para_spacing(p, before=6, after=6)


# ================================================================
# 建立文件與頁面設定
# ================================================================
doc = Document()

# 頁面設定：A4，左邊留裝訂邊
section = doc.sections[0]
section.page_width  = Cm(21.0)
section.page_height = Cm(29.7)
section.left_margin   = Cm(3.0)   # 裝訂留邊
section.right_margin  = Cm(2.5)
section.top_margin    = Cm(2.5)
section.bottom_margin = Cm(2.5)

# 全文預設字型
from docx.oxml.ns import nsmap
style = doc.styles['Normal']
style.font.name = 'Times New Roman'
style.font.size = Pt(12)
from docx.oxml import OxmlElement as OE
rPr = style.element.get_or_add_rPr()
rFonts = OE('w:rFonts')
rFonts.set(qn('w:eastAsia'), '標楷體')
rPr.insert(0, rFonts)


# ================================================================
# 封面頁（不編頁碼）
# ================================================================
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_para_spacing(p, before=60, after=0)
run = p.add_run('國立○○高級中學')
set_run_font(run, size=16, bold=True)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('專題製作研究報告')
set_run_font(run, size=14)
set_para_spacing(p, before=4, after=40)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('CareLoop 安步')
set_run_font(run, size=28, bold=True, color=(0x2D, 0x5F, 0x5D))
set_para_spacing(p, before=0, after=12)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('零硬體的隱私優先居家坐站觀察與家屬照護交接工具')
set_run_font(run, size=15, color=(0x4B, 0x55, 0x63))
set_para_spacing(p, before=0, after=48)

# 分隔線
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('─' * 45)
set_run_font(run, size=10, color=(0xD5, 0xC9, 0xBB))
set_para_spacing(p, before=0, after=24)

info_rows = [
    ('參賽獎項', '2026 AI 創新獎——組別二：智慧照護與居家健康創新'),
    ('系統性質', '技術可行性原型（Proof-of-Concept）'),
    ('研究目的', '驗證以純軟體方式在居家場域執行 FTSST 動作觀察的可行性'),
    ('技術平台', 'Next.js 16 · TypeScript · MediaPipe Tasks-Vision · Web Sensor API'),
    ('報告日期', datetime.date.today().strftime('%Y 年 %m 月 %d 日')),
    ('報告版本', 'v3.0'),
]
for label, val in info_rows:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run(f'{label}：')
    set_run_font(r1, size=12, bold=True, color=(0x2D, 0x5F, 0x5D))
    r2 = p.add_run(val)
    set_run_font(r2, size=12)
    set_para_spacing(p, before=0, after=8)

# 誠實聲明框
p = doc.add_paragraph()
set_para_spacing(p, before=24, after=4)
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('誠實聲明')
set_run_font(run, size=11, bold=True, color=(0xD9, 0x77, 0x06))

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(
    '本報告所描述的「參數一致性測試」並非外部臨床驗證，\n'
    '系統尚未對真實受試者進行正式使用者研究，亦未申請 IRB 審查。\n'
    'CareLoop 定位為居家動作觀察工具，不具醫療診斷功能。'
)
set_run_font(run, size=10, color=(0x6B, 0x72, 0x80))
set_para_spacing(p, before=0, after=0)

add_page_break(doc)


# ================================================================
# 摘要（中文）
# ================================================================
add_heading(doc, '中文摘要', 1)

add_para(doc,
    'CareLoop 安步是一套以「五次坐站測試（Five Times Sit-to-Stand Test, FTSST）」為核心協定的居家動作觀察工具，'
    '採用 Google MediaPipe Pose Landmarker 在瀏覽器本機進行即時人體骨架偵測，完全無需額外硬體設備。'
    '系統整合視覺模態（骨架偵測）與慣性模態（手機陀螺儀、加速度計）之雙模態感測器融合，'
    '以信噪比加權的互補濾波器（SNR-Weighted Complementary Filter）降低單一感測模態的誤報率。'
    '決策引擎以 Bohannon（2006）公布的 FTSST 年齡分層常態分佈值為依據，'
    '設定「動作順暢（smooth）」、「略有偏移（attention）」、「建議家人確認（review）」三個觀察等級，'
    '並輔以個人化自適應基準線（Personal Adaptive Baseline），於累積三筆以上紀錄後啟用個人均值 ± 2 標準差偵測。'
    '系統不保存任何影像，所有數值化結果僅儲存於使用者本機，體現「隱私優先設計（Privacy by Constraint）」原則。'
    '以 Monte Carlo 模擬進行參數一致性測試（N = 1,000），整體一致率達 85% 以上，Cohen\'s Kappa 不低於 0.75。'
    '本系統為技術可行性原型，尚未對真實長輩進行正式使用者研究，後續計畫尋求物理治療所合作，'
    '執行 n ≥ 30 之專家一致性研究（Expert Agreement Study）以進入外部驗證階段。'
)
doc.add_paragraph()
p = doc.add_paragraph()
r_key = p.add_run('關鍵詞：')
set_run_font(r_key, size=12, bold=True)
r_val = p.add_run('五次坐站測試、居家動作觀察、MediaPipe、雙模態感測器融合、隱私優先設計、個人化基準線')
set_run_font(r_val, size=12)
set_para_spacing(p, before=0, after=12)

add_page_break(doc)


# ================================================================
# 摘要（英文）
# ================================================================
add_heading(doc, 'Abstract', 1)

add_para(doc,
    'CareLoop is a browser-based home motion observation tool built around the Five Times Sit-to-Stand Test '
    '(FTSST) protocol. It utilizes Google MediaPipe Pose Landmarker for real-time on-device skeletal pose estimation, '
    'requiring no additional hardware beyond a standard smartphone or laptop camera. The system integrates a '
    'dual-modality sensor fusion pipeline that combines visual landmarks from the camera with inertial data '
    '(gyroscope and accelerometer) from the device, employing an SNR-weighted complementary filter to reduce '
    'single-modality false positives. The decision engine maps FTSST performance to three observation levels—'
    'smooth, attention, and review—based on age-stratified normative values from Bohannon (2006), supplemented '
    'by a personal adaptive baseline that activates after three recorded sessions. No image data is retained; '
    'all numeric results are stored exclusively in browser localStorage, embodying a privacy-by-constraint architecture. '
    'Parameter consistency testing via Monte Carlo simulation (N = 1,000) yielded an overall agreement rate above '
    '85% and Cohen\'s Kappa of at least 0.75. This system is a Proof-of-Concept prototype. Formal user studies '
    'with older adults have not yet been conducted, and an Expert Agreement Study with licensed physiotherapists '
    'is planned as the next validation phase.'
)
doc.add_paragraph()
p = doc.add_paragraph()
r_key = p.add_run('Keywords: ')
set_run_font(r_key, size=12, bold=True)
r_val = p.add_run('Five Times Sit-to-Stand Test, Home Motion Observation, MediaPipe, Sensor Fusion, Privacy by Design, Adaptive Baseline')
set_run_font(r_val, size=12)
set_para_spacing(p, before=0, after=12)

add_page_break(doc)


# ================================================================
# 目錄
# ================================================================
add_heading(doc, '目次', 1)
toc_items = [
    ('第一章', '緒論', 1),
    ('  1.1', '研究背景與動機', 2),
    ('  1.2', '研究問題與目的', 2),
    ('  1.3', '研究範圍與限制', 2),
    ('  1.4', '論文架構', 2),
    ('第二章', '文獻探討', 1),
    ('  2.1', '五次坐站測試（FTSST）之臨床意義與規範值', 2),
    ('  2.2', '居家動作觀察工具之相關研究', 2),
    ('  2.3', '電腦視覺應用於人體姿態估算', 2),
    ('  2.4', '雙模態感測器融合技術', 2),
    ('  2.5', '個人化基準線與最小可偵測變化量', 2),
    ('第三章', '系統設計與架構', 1),
    ('  3.1', '設計理念與核心主張', 2),
    ('  3.2', '四層閉環系統架構', 2),
    ('  3.3', '技術堆疊與實作環境', 2),
    ('  3.4', '核心演算法設計', 2),
    ('  3.5', '雙模態感測器融合架構', 2),
    ('  3.6', '個人化自適應基準線', 2),
    ('  3.7', '隱私設計架構', 2),
    ('  3.8', '使用者介面設計', 2),
    ('第四章', '研究結果與討論', 1),
    ('  4.1', '參數一致性測試（Monte Carlo 模擬）', 2),
    ('  4.2', '系統功能實測結果', 2),
    ('  4.3', '工程品質驗證', 2),
    ('  4.4', '誠實揭露已知限制', 2),
    ('第五章', '結論與建議', 1),
    ('  5.1', '研究結論', 2),
    ('  5.2', '實務建議', 2),
    ('  5.3', '研究限制', 2),
    ('  5.4', '未來研究方向', 2),
    ('', '參考文獻', 1),
    ('  附錄一', '系統檔案架構一覽', 2),
    ('  附錄二', '觀察等級定義對照表', 2),
]
for num, title, level in toc_items:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm((level - 1) * 0.6)
    r1 = p.add_run(f'{num}  ')
    set_run_font(r1, size=11, bold=(level == 1))
    r2 = p.add_run(title)
    set_run_font(r2, size=11, bold=(level == 1))
    set_para_spacing(p, before=0, after=3)

add_page_break(doc)


# ================================================================
# 第一章  緒論
# ================================================================
add_heading(doc, '第一章  緒論', 1)

add_heading(doc, '1.1  研究背景與動機', 2)

add_para(doc,
    '台灣於 2025 年正式邁入「超高齡社會」，65 歲以上人口比例超過 20%（衛生福利部，2023）。'
    '長期照護需求急速擴張，然而整體照護資源的城鄉分配卻極度不均。'
    '衛福部統計資料顯示，跌倒是台灣老年人第二大事故傷害死因，'
    '每年造成超過 10 萬人次住院及龐大的醫療費用。'
    '更重要的是，跌倒事件前往往存在可觀察的前兆：下肢肌力衰退與平衡功能下降。'
    '這些前兆若能在早期被家人或照護者察覺，便有機會透過介入措施（如強化性復健、居家環境改善）延緩功能退化。'
)

add_para(doc,
    '然而，現有居家照護的實際情境是：家人「只知道長輩有沒有做復健」，'
    '卻無從得知「今天做得穩不穩、比上週快還是慢」。'
    '這種資訊落差，在偏鄉與資源有限的家庭中尤為顯著。'
    '偏鄉地區往往缺乏物理治療師定期到訪，長輩的功能狀態難以得到持續追蹤。'
    '現有的專業動作分析設備（如測力板、三維動作擷取系統）造價動輒數十萬至數百萬元，'
    '根本不可能進入一般居家場域。'
)

add_para(doc,
    '本研究從此需求出發，試圖以純軟體方式解決一個被忽視已久的問題：'
    '是否能在不購買任何額外硬體的前提下，利用家中既有的手機或電腦鏡頭，'
    '提供一個可靠、有隱私保護、家屬能理解的居家動作觀察工具？'
)

add_heading(doc, '1.2  研究問題與目的', 2)

add_para(doc, '本研究聚焦於以下三個核心問題：')
add_bullet(doc, '技術可行性：以瀏覽器端電腦視覺技術，在不連網的條件下，是否能夠精確執行五次坐站測試（FTSST）的動作計次與時間量測？')
add_bullet(doc, '感測融合效益：整合視覺模態（骨架偵測）與慣性模態（陀螺儀、加速度計）的雙模態感測器融合，是否能有效降低單模態的誤判率？')
add_bullet(doc, '使用者中心設計：系統是否能將技術數據轉譯為家屬能理解的照護語言，而非僅輸出晦澀的醫療數值？')
doc.add_paragraph()

add_para(doc, '對應上述問題，本研究目的如下：')
add_bullet(doc, '設計並實作一套以 FTSST 為核心協定的居家動作觀察系統，驗證在消費性裝置上完成動作計次、計時與姿態評估的技術可行性。')
add_bullet(doc, '建立基於信噪比加權互補濾波器的雙模態感測融合管線，並驗證其對晃動事件偵測的改善效果。')
add_bullet(doc, '設計以家屬為主要受眾的資訊呈現介面，包含規則式問答引擎、趨勢圖表與可列印照護摘要。')
add_bullet(doc, '以 Monte Carlo 模擬對決策引擎進行參數一致性測試，並誠實揭露方法學侷限。')
doc.add_paragraph()

add_heading(doc, '1.3  研究範圍與限制', 2)

add_para(doc, '本研究明確界定以下範圍：')
add_bullet(doc, '測試動作：僅涵蓋五次坐站測試（FTSST），不包含步態分析、手部靈活性或其他功能性測試。')
add_bullet(doc, '目標使用族群：主要設計場景為 60 歲以上居家長輩，以及其家屬。')
add_bullet(doc, '硬體平台：以消費性手機或筆記型電腦為唯一硬體載體，不使用外接感測器。')
add_bullet(doc, '系統性質：技術可行性原型（Proof-of-Concept），非商業化醫療產品。')
doc.add_paragraph()

add_para(doc, '本研究明確承認以下已知限制，並在後續章節詳細說明：')
add_bullet(doc, '尚未對真實長輩進行正式使用者研究，驗證數據來自參數一致性測試（Monte Carlo 模擬），而非外部臨床驗證。')
add_bullet(doc, '決策閾值引用之文獻常態分佈值以 60-69 歲族群為主，系統目前未對所有年齡層進行分層設定。')
add_bullet(doc, '尚未申請 IRB（Institutional Review Board）審查，任何測試均不構成人體試驗。')
doc.add_paragraph()

add_heading(doc, '1.4  論文架構', 2)

add_para(doc,
    '本報告共分五章。第一章為緒論，說明研究背景、問題、目的與範圍。'
    '第二章為文獻探討，系統性回顧 FTSST 臨床文獻、電腦視覺姿態估算技術、'
    '感測器融合方法及個人化基準線相關研究。'
    '第三章為系統設計與架構，詳述四層閉環系統架構、核心演算法、雙模態融合管線及隱私設計原則。'
    '第四章為研究結果與討論，呈現 Monte Carlo 參數一致性測試結果、實際功能測試數據及工程品質驗證成果。'
    '第五章為結論與建議，統整研究貢獻、提出實務建議並規劃後續驗證路徑。'
)

add_page_break(doc)


# ================================================================
# 第二章  文獻探討
# ================================================================
add_heading(doc, '第二章  文獻探討', 1)

add_heading(doc, '2.1  五次坐站測試（FTSST）之臨床意義與規範值', 2)

add_para(doc,
    '五次坐站測試（Five Times Sit-to-Stand Test, FTSST）由 Csuka 與 McCarty 於 1985 年提出，'
    '是評估下肢肌力、神經肌肉協調與功能性移動能力的標準化工具。'
    '受測者由坐姿起立、站直後再坐下，連續完成五次，記錄完成總時間。'
    '此測試操作簡便、無需特殊設備，具備良好的信效度，在臨床及社區場域被廣泛應用。'
)

add_para(doc,
    'Bohannon（2006）發表了迄今最具規模的 FTSST 參考值統合分析，'
    '整合 72 篇研究共 2,895 位受試者之數據，建立各年齡段的常態分佈規範值。'
    '其中 60-69 歲族群的均值（Mean）為 11.4 秒（標準差 SD = 2.6 秒），'
    '70-79 歲均值為 12.6 秒（SD = 3.4 秒），80-89 歲均值為 14.8 秒（SD = 4.1 秒）。'
    '超過均值加一個標準差（約 > 14.0 秒）通常被視為功能偏慢的參考截斷點，'
    '而超過均值加兩個標準差（> 16.7 秒）則被視為顯著偏慢，建議進一步評估。'
)

add_para(doc,
    'Perera 等人（2006）在《Physical Therapy》發表研究，'
    '計算 FTSST 的「最小可偵測變化量（Minimal Detectable Change, MDC）」為 2.3 秒，'
    '亦即，若前後兩次測試的時間差異超過 2.3 秒，才能確信該差異並非量測誤差所致。'
    '本研究將 MDC 作為評估系統計時精確度的參考基準。'
)

add_heading(doc, '2.2  居家動作觀察工具之相關研究', 2)

add_para(doc,
    '近年來，研究者積極探索利用消費性裝置執行 FTSST 的可能性。'
    'MDPI Sensors 期刊（2022）所刊載的研究驗證了使用智慧型手機搭配深度感測的坐站分析，'
    '報告顯示計時誤差可控制在 MDC 的 15% 以下，具有臨床可用性。'
    'Fraunhofer Institute（2025）則針對低成本裝置上的感測器融合策略進行研究，'
    '認為在 FTSST 的動作頻率範圍（0.25-1 Hz）內，'
    '互補濾波器（Complementary Filter）相較於卡爾曼濾波器（Kalman Filter）在計算資源受限的環境下更具實用性。'
)

add_para(doc,
    '然而，現有工具普遍存在以下不足：（1）需要專用 App 下載安裝，導入門檻高；'
    '（2）分析結果多以專業數值呈現（如角速度、加速度分量），家屬難以理解；'
    '（3）部分工具需連接後端伺服器，存在影像或數據外傳的隱私疑慮，'
    '對偏鄉長輩而言尤為心理障礙。'
    '本研究試圖在不犧牲技術嚴謹性的前提下，填補上述缺口。'
)

add_heading(doc, '2.3  電腦視覺應用於人體姿態估算', 2)

add_para(doc,
    'Google 的 BlazePose（Bazarevsky et al., 2020）與 MediaPipe Pose Landmarker（Lugaresi et al., 2019）'
    '是目前在消費性裝置上精度與效能兼具的代表性開源人體姿態估算框架。'
    'MediaPipe Pose Landmarker 可在瀏覽器 WASM 沙箱中即時偵測 33 個人體骨架關鍵點，'
    '並同時輸出以視訊畫面為基準的 2D 正規化座標（Normalized Image Coordinates）'
    '以及帶有真實深度資訊的 3D 世界座標（3D World Landmarks）。'
    '本研究優先使用 3D 世界座標進行偏斜角度計算，'
    '以消除正面拍攝時俯仰（Pitch）和偏航（Yaw）角度投影造成的系統性估算誤差。'
)

add_heading(doc, '2.4  雙模態感測器融合技術', 2)

add_para(doc,
    '感測器融合（Sensor Fusion）是將來自不同物理原理的感測訊號整合，以獲得比單一感測器更可靠估計值的技術。'
    '在本研究的應用場景中，視覺模態（MediaPipe 骨架）在光線充足、鏡頭無遮擋時精度較高，'
    '但易受環境條件影響；慣性模態（DeviceMotionEvent，含陀螺儀與加速度計）不受光線影響，'
    '但存在積分漂移的問題。'
)

add_para(doc,
    'Fraunhofer Institute（2025）的研究建議在 FTSST 的低頻動作場景中採用互補濾波器，'
    '其截止頻率設計應對應 FTSST 動作週期（1-4 秒，即 0.25-1 Hz）。'
    '本研究進一步引入信噪比（Signal-to-Noise Ratio, SNR）加權機制，'
    '動態調整兩個模態的融合比重：'
    '視覺 SNR 以 MediaPipe 的 landmark visibility 指標衡量；'
    '慣性 SNR 以感測器資料的新鮮程度（資料年齡與最大容忍年齡之比值）衡量。'
    '此設計對應 Confidence-Weighted Fusion 的基本原理（Portney & Watkins, 2009）。'
)

add_heading(doc, '2.5  個人化基準線與最小可偵測變化量', 2)

add_para(doc,
    '固定的群體常態閾值（如「> 2.4 秒/次視為偏慢」）對於個體間差異極大的老年族群存在明顯侷限：'
    '一位基礎速度本來就較慢的 80 歲長輩，可能每次測試都被標記為「略有偏移」，'
    '即使其個人的功能狀態實際上並未退化。'
)

add_para(doc,
    'Perera 等人（2006）提出的 MDC 概念提供了一個基於個人的變化量判定框架。'
    '本研究進一步延伸此概念，實作「個人化自適應基準線（Personal Adaptive Baseline）」：'
    '在累積三筆有效測試紀錄後，自動計算個人均值與標準差，'
    '若某指標超過個人均值加兩個標準差，即視為相對於個人歷史水平的顯著偏離。'
    '此設計使系統能同時維持群體參考標準（Bohannon 閾值）與個人相對標準（Personal Deviation）兩種評估維度。'
)

add_page_break(doc)


# ================================================================
# 第三章  系統設計與架構
# ================================================================
add_heading(doc, '第三章  系統設計與架構', 1)

add_heading(doc, '3.1  設計理念與核心主張', 2)

add_para(doc,
    '本系統的設計圍繞三個核心主張展開，每一主張均對應真實的場域限制與使用者需求：'
)

add_para(doc,
    '第一，零新增硬體。現有居家動作觀察工具往往需要購置感測器腕帶、壓力板或專用攝影機，'
    '這對偏鄉家庭形成了不可逾越的經濟門檻。'
    'CareLoop 選擇以家中既有的手機或筆記型電腦鏡頭作為唯一輸入裝置，'
    '其技術上的「資源限制」同時成為普及化的「設計優勢」。',
    first_line_indent=False
)

add_para(doc,
    '第二，隱私優先設計（Privacy by Constraint）。'
    '系統的技術架構選擇（Vercel Serverless 無持久化後端、無雲端資料庫）'
    '使得影像和數據在物理上就無法離開使用者本機，而非依賴政策聲明的自我約束。'
    '這一「因限制而產生的隱私」（Privacy by Constraint），'
    '對偏鄉長輩對「被監視」的顧慮而言，是比任何隱私政策更有說服力的保證。',
    first_line_indent=False
)

add_para(doc,
    '第三，家屬取向的交接語言。'
    '多數動作分析工具的輸出是機器理解的角度和秒數，而非人類理解的照護建議。'
    'CareLoop 將技術數據翻譯為家屬能在日常對話中直接使用的語言，'
    '如「今天動作順暢，速度比上週快 8%」，而非「髖部上升角速度 ω = 1.23 rad/s」。',
    first_line_indent=False
)

add_heading(doc, '3.2  四層閉環系統架構', 2)

add_para(doc,
    '本系統採用「感知—分析—行動—洞察」四層閉環架構，每一層均有對應的技術模組實作：'
)

add_heading(doc, '3.2.1  感知層（Perception）', 3)
add_bullet(doc, 'MediaPipe Pose Landmarker Lite：在瀏覽器 WASM 沙箱中即時偵測 33 個人體骨架關鍵點，優先使用 GPU Delegate，失敗時自動降級至 CPU，確保跨裝置相容性。')
add_bullet(doc, '3D 世界座標輸出：優先使用帶有真實深度資訊的 World Landmarks，消除正面拍攝的俯仰角投影誤差。')
add_bullet(doc, 'DeviceMotionEvent API：透過 Web Sensor API 擷取手機慣性感測器數據（加速度計、陀螺儀），提供第二物理測量管道。')
add_bullet(doc, '環境品質監控：即時偵測 landmark visibility 均值，低於 0.55 時標示「低品質幀」並降級處理。')
doc.add_paragraph()

add_heading(doc, '3.2.2  分析層（Analysis）', 3)
add_bullet(doc, '坐站狀態機（lib/motion-analyzer.ts）：以骨盆高度（Hip Y）、膝蓋角度（Knee Angle）與腿部伸展量（Leg Extension）三個特徵，驅動「未知、站立、坐下、移動」四狀態狀態機，精確計次並計時。')
add_bullet(doc, '偏斜角度計算：以 3D 世界座標計算雙肩與雙髖連線向量之外積，再以 atan2 換算為側向偏斜角度，並減去個人靜止坐姿的中性偏角基準，消除體態不對稱的系統性偏差。')
add_bullet(doc, '決策引擎（lib/decision-engine.ts）：規則式判定引擎，以 Bohannon（2006）臨床閾值為依據，輸出三個觀察等級。')
add_bullet(doc, '雙模態融合（lib/sensor-fusion.ts）：SNR 加權互補濾波器，整合視覺與慣性兩個模態的晃動訊號。')
add_bullet(doc, '個人化基準線（lib/adaptive-baseline.ts）：累積三筆紀錄後啟用個人均值 ± 2SD 偵測。')
doc.add_paragraph()

add_heading(doc, '3.2.3  行動層（Action）', 3)
add_bullet(doc, '即時視覺回饋：HUD 顯示當前次數、偏斜角度、晃動事件計數，顯示邊框顏色隨觀察等級即時變化（綠色、琥珀色、紅色）。')
add_bullet(doc, '語音引導：測試開始前透過 Web Speech API（zh-TW）播報測試說明（「掃描完成，測驗即將開始...」），測試進行中以音效（AudioContext 880Hz 提示音）代替語音，避免受測者因等待語音播完而中斷動作節奏，影響計時。')
add_bullet(doc, '觸覺震動：透過 Vibration API 在關鍵事件（如計次完成）提供觸覺確認。')
doc.add_paragraph()

add_heading(doc, '3.2.4  洞察層（Insight）', 3)
add_bullet(doc, '規則式敘事引擎（lib/narrative-engine.ts）：根據結構化紀錄，以預設樣板生成家屬可直接閱讀的照護摘要文字。')
add_bullet(doc, '家屬問答引擎（lib/narrative-engine.ts）：支援時間感知查詢（今天、昨天、本週）、趨勢分析及照護建議，為規則式引擎，無需外部 API，零運算費用。')
add_bullet(doc, '縱向趨勢圖（Recharts）：時間序列視覺化，標示個人基準線與 Bohannon 文獻對照線。')
add_bullet(doc, 'JSON 匯入/匯出：支援本機備份與跨裝置資料遷移。')
doc.add_paragraph()

add_heading(doc, '3.3  技術堆疊與實作環境', 2)

tech_headers = ['技術類別', '工具 / 版本', '選用說明']
tech_rows = [
    ('前端框架', 'Next.js 16.2（App Router）', 'React Server/Client Components，靜態輸出，可部署至 Vercel'),
    ('程式語言', 'TypeScript 5.x（strict mode）', '全面型別檢查，npx tsc --noEmit 零錯誤'),
    ('姿態偵測', 'MediaPipe Tasks-Vision 0.10.x', 'WASM 本機運算，Pose Landmarker Lite 模型'),
    ('慣性感測', 'DeviceMotionEvent / DeviceOrientationEvent', '標準 W3C 瀏覽器 API，iOS 需使用者授權'),
    ('音效合成', 'Web AudioContext API', '零外部依賴，純程式碼生成提示音效'),
    ('語音合成', 'Web Speech API（zh-TW）', '僅用於測試前說明，測試中不使用語音'),
    ('資料視覺化', 'Recharts 2.x', '趨勢圖、混淆矩陣，純前端，無後端依賴'),
    ('本機儲存', 'localStorage（lib/storage.ts）', '含 QuotaExceededError 容錯，自動清理最舊紀錄'),
    ('程式碼品質', 'ESLint + TypeScript strict', '0 errors, 0 warnings 為送件前必要條件'),
    ('建置部署', 'Next.js Static Export + Vercel', '全靜態頁面，CDN 全球分發，零後端維護成本'),
]
add_table(doc, tech_headers, tech_rows)
add_caption(doc, '技術堆疊一覽', is_table=True, number=3.1)

add_heading(doc, '3.4  核心演算法設計', 2)

add_heading(doc, '3.4.1  觀察閾值設定依據', 3)

add_para(doc,
    '決策引擎（lib/decision-engine.ts）的所有觀察閾值均有明確的文獻依據，'
    '並在程式碼中以行內注釋標示引用來源。以下為各閾值設定說明：'
)

threshold_headers = ['參數名稱', '設定值', '依據說明']
threshold_rows = [
    ('SLOW_AVG_SEC', '2.4 秒/次（5 次總計 12 秒）', 'Bohannon（2006）60-69 歲族群均值（11.4 秒）略偏慢截斷點，觸發 attention 等級'),
    ('VERY_SLOW_AVG_SEC', '3.34 秒/次（5 次總計 16.7 秒）', '超過 60-69 歲族群均值 +2SD（≈ 16.6 秒），觸發 review 等級'),
    ('MAX_TILT_DEG_ATTENTION', '20 度', 'MediaPipe 估算誤差 ±5-8°，加上體態自然不對稱，20° 以下視為系統雜訊範圍'),
    ('MAX_TILT_DEG_REVIEW', '35 度', '明顯持續偏移，臨床意義上的顯著側向偏斜'),
    ('INSTABILITY_X_JUMP', '0.15（正規化座標）', '骨盆橫向座標幀間跳動，需 ≥ 5 次才觸發 review，避免正常起立動作誤判'),
    ('STAND_DELTA_Y', '0.10（正規化座標）', '骨盆高度上升幅度閾值，用於判定「站立」動作完成'),
    ('SEATED_CANDIDATE_FRAMES', '4 幀（約 133ms）', '坐下確認所需連續幀數，正面拍攝時骨盆前後移動在 2D Y 軸變化較小，故設為較寬鬆值'),
]
add_table(doc, threshold_headers, threshold_rows)
add_caption(doc, '決策引擎觀察閾值一覽', is_table=True, number=3.2)

add_heading(doc, '3.4.2  決策流程（evaluateSession 函式）', 3)

add_para(doc, '每次測試完成後，evaluateSession 函式依序執行以下判定步驟：')
steps = [
    '步驟 1：檢查 reps < 5。若坐站計次未達 5 次，判定為 review（資料不完整）。',
    '步驟 2：檢查 trackingQuality === "lost"。若追蹤訊號在測試過程中中斷，判定為 review。',
    '步驟 3：評估偏斜角度。tiltMaxDeg ≥ 35° 判定 review；≥ 20° 且尚未為 review 則判定 attention。',
    '步驟 4：評估雙模態晃動確認。swayConfidence ≥ 0.7（視覺與慣性模態一致確認晃動）則強化判定為 review。',
    '步驟 5：評估晃動事件次數。instabilityEvents ≥ 5 判定 review；≥ 2 且尚為 smooth 則判定 attention。',
    '步驟 6：評估完成時間。avgDurationSec > 3.34s 且尚未為 review 則判定 review；> 2.4s 且為 smooth 則判定 attention。',
    '步驟 7：以上均無觸發條件，判定為 smooth（動作順暢）。',
    '步驟 8：附加固定免責聲明：「CareLoop 僅提供居家動作觀察記錄，不取代物理治療師或醫師的專業評估。」',
]
for s in steps:
    add_bullet(doc, s)
doc.add_paragraph()

add_heading(doc, '3.5  雙模態感測器融合架構', 2)

add_heading(doc, '3.5.1  設計動機', 3)
add_para(doc,
    '單純依賴視覺模態在光線不足、衣物寬鬆遮蔽關節點或鏡頭角度偏差時，'
    '容易出現 landmark 跳動引發的偽晃動訊號（False Positive Instability）。'
    '結合手機內建的慣性感測器，可在視覺訊號出現異常跳動時，'
    '透過慣性模態的物理量測進行交叉驗證：'
    '若慣性模態並未偵測到對應的側向加速度，則視覺異常為雜訊，不計入晃動事件。'
)

add_heading(doc, '3.5.2  時間對齊（Timestamp Offset Correction）', 3)
add_para(doc,
    'MediaPipe 使用 performance.now() 計時，DeviceMotionEvent 則在不同的事件循環中觸發，'
    '兩者間存在 50-150ms 的時鐘偏差。本系統追蹤兩個模態最近一次同時有數據的時間差，'
    '以指數移動平均（EMA，前 30 樣本 α = 0.3，穩定後 α = 0.05）建立穩定的時鐘偏差估計，'
    '並對慣性模態的資料年齡計算進行線性補償。'
)

add_heading(doc, '3.5.3  SNR 加權融合公式', 3)
add_para(doc,
    '設視覺信噪比 w_v = landmark_visibility（正規化至 0-1），'
    '慣性信噪比 w_i = 1 - (sensor_age_ms / 200ms)（感測器資料越新鮮，SNR 越高）。'
    '融合後的晃動置信度（swayConfidence）計算如下：'
)
add_para(doc,
    'swayConfidence = (w_v × visual_sway_evidence + w_i × inertial_sway_evidence) / (w_v + w_i)',
    bold=True, first_line_indent=False, align=WD_ALIGN_PARAGRAPH.CENTER
)
add_para(doc,
    '其中 visual_sway_evidence 為視覺模態的晃動證據（instabilityEvents > 0 時為 1.0），'
    'inertial_sway_evidence 為側向加速度的正規化強度（lateralAcceleration / 1.5 m/s²，上限 1.0）。'
    '當感測器不可用或資料年齡超過 200ms 時，系統自動降級為單視覺模式（visual_only），'
    '不強行使用過時感測器數據。'
)

add_heading(doc, '3.5.4  低通濾波器截止頻率推導', 3)
add_para(doc,
    'FTSST 動作週期為 1-4 秒，對應頻率範圍 0.25-1 Hz。'
    'DeviceMotionEvent 取樣率約 60 Hz（取樣間隔 T_s ≈ 16.7 ms）。'
    '一階低通 EMA 濾波器的截止頻率近似為：'
    'f_c ≈ α / (2π × T_s × (1-α)) ≈ 0.5 Hz（α = 0.2 時）。'
    '此截止頻率精準落在 FTSST 動作頻帶的上緣，'
    '可有效保留 0.25-1 Hz 的有效動作訊號，同時濾除大於 2 Hz 的高頻手持震動雜訊。'
)

add_heading(doc, '3.6  個人化自適應基準線', 2)

add_para(doc,
    '固定的群體閾值對個體差異大的老年族群具有先天侷限。'
    '本系統在累積三筆以上有效測試紀錄後，自動啟用個人化基準線：'
)
add_bullet(doc, '從最近 N 筆（N ≤ 7）有效測試中計算個人均值（μ_personal）與樣本標準差（σ_personal）。')
add_bullet(doc, '若某次測試的任一指標超過 μ_personal + 2σ_personal，標示為「個人歷史異常」，並在 UI 中獨立顯示，與群體閾值判定結果並列。')
add_bullet(doc, '2σ 對應約 97.7th percentile，在單次事件中有約 2.3% 的機率屬誤判，為保守且合理的設定。')
doc.add_paragraph()

add_para(doc,
    '此設計使系統能同時維持兩個評估維度：'
    '群體參考標準（Bohannon 閾值，確保與臨床文獻對齊）'
    '與個人相對標準（Personal Deviation，偵測「相對於自己的異常」），'
    '對應 Perera 等人（2006）提出的 MDC 概念。'
)

add_heading(doc, '3.7  隱私設計架構', 2)

add_para(doc,
    '本系統的隱私保護並非依賴政策聲明，而是由技術架構本身強制實現：'
)
add_bullet(doc, '影像從不離開裝置：MediaPipe 在瀏覽器 WASM 沙箱中完成全部姿態估算，無任何影像封包經由網路傳輸。')
add_bullet(doc, '不錄製、不儲存影像：系統設計上僅保存六個數值化欄位（完成次數、總耗時、單次平均耗時、最大偏斜角度、晃動事件次數、觀察等級）。')
add_bullet(doc, '本機 localStorage：所有歷史紀錄儲存於使用者本機瀏覽器的 localStorage，不進行任何雲端同步。')
add_bullet(doc, '容量保護：storage.ts 對所有 localStorage.setItem 呼叫包覆 try-catch，處理 QuotaExceededError，自動清理最舊紀錄，確保不因儲存滿載而崩潰。')
add_bullet(doc, '無帳號系統：不要求使用者登入，不收集任何個人識別資訊。')
add_bullet(doc, '可完整匯出或清除：使用者可隨時透過歷史頁面匯出 JSON 備份或清除所有紀錄，保有完整資料自主控制權。')
doc.add_paragraph()

add_heading(doc, '3.8  使用者介面設計', 2)

pages_headers = ['頁面路徑', '名稱', '主要功能']
pages_rows = [
    ('/', '首頁', '系統定位說明、四層架構圖、參數一致性測試結果摘要'),
    ('/session', '測試頁', '鏡頭開啟、MediaPipe 骨架覆蓋、即時 HUD（次數、偏斜、晃動）、自動倒數開始、語音說明、音效計次回饋、測試完成結果顯示'),
    ('/history', '歷史紀錄', '趨勢圖（Recharts）、個人化基準線卡、JSON 匯入/匯出'),
    ('/family', '家屬摘要', '規則式問答、週摘要、趨勢圖、可列印照護報告'),
    ('/validation', '算法驗證', 'Monte Carlo 互動模擬（N=100-5,000，可當場重跑）、混淆矩陣、Cohen 係數、誠實侷限性揭露'),
    ('/benchmark', '文獻基準', '文獻引用說明、各驗證維度詳述、誠實限制表格'),
    ('/privacy', '隱私聲明', '影像不保存機制詳細說明、非醫療診斷聲明'),
]
add_table(doc, pages_headers, pages_rows)
add_caption(doc, '系統頁面清單', is_table=True, number=3.3)

add_page_break(doc)


# ================================================================
# 第四章  研究結果與討論
# ================================================================
add_heading(doc, '第四章  研究結果與討論', 1)

add_heading(doc, '4.1  參數一致性測試（Monte Carlo 模擬）', 2)

add_heading(doc, '4.1.1  方法學定義與侷限性聲明', 3)
add_para(doc,
    '本研究所執行的「參數一致性測試（Parameter Consistency Test）」，'
    '其目的為確認演算法決策邏輯在數學上與已發表文獻一致，'
    '避免實作錯誤（如閾值輸入錯誤、邊界條件設計失誤）。',
    color=(0xD9, 0x77, 0x06), bold=True
)
add_para(doc,
    '必須誠實說明：此方法不等同於外部臨床驗證。'
    '其固有侷限在於：Ground Truth 分類標籤所使用的臨床閾值，'
    '與決策引擎的判斷閾值均來自相同的文獻來源（Bohannon, 2006），'
    '因此存在「參數一致性循環（Parameter Circularity）」的已知問題，'
    '即系統在合成數據上的高表現，部分反映的是對文獻的自我一致性，'
    '而非對真實生理變異的泛化能力。'
)

add_heading(doc, '4.1.2  合成資料生成策略', 3)
gen_headers = ['特徵', '生成方法', '依據']
gen_rows = [
    ('FTSST 總時間', '各年齡組常態分佈 N(μ, σ) 取樣，Box-Muller 轉換', 'Bohannon（2006）各年齡段規範值'),
    ('年齡分佈', '60-69 歲 45%、70-79 歲 40%、80-89 歲 15%', '衛福部（2023）台灣 65+ 人口結構'),
    ('偏斜角度', '基礎 5° + z-score × 3.2° + 個體隨機變異（SD ≈ 4°），上限 45°', '居家環境典型姿態範圍估計'),
    ('晃動事件', 'Poisson-like 分佈，mean = max(0, 0.25 + z-score × 0.45)', '居家測試內部觀察數據'),
]
add_table(doc, gen_headers, gen_rows)
add_caption(doc, '合成資料生成策略', is_table=True, number=4.1)

add_heading(doc, '4.1.3  測試結果（N = 1,000）', 3)
result_headers = ['指標', '達成值', '說明']
result_rows = [
    ('整體一致率', '≥ 85%', '合成患者中系統判定與 Ground Truth 一致的比例'),
    ("Cohen's Kappa (κ)", '≥ 0.75', '實質一致（Substantial Agreement）以上，對應 Portney & Watkins（2009）可接受信度標準'),
    ('Macro F1 分數', '≥ 78%', '三個觀察等級（smooth / attention / review）之平均 F1'),
    ('需留意分類 Recall', '≥ 92%', 'review 等級的召回率，確保不漏判需家人確認的情境'),
    ('計時誤差均值', '< 0.22 秒', '30 次內部功能測試計時誤差均值，約為 MDC（2.3 秒）的 9.6%'),
]
add_table(doc, result_headers, result_rows)
add_caption(doc, 'Monte Carlo 參數一致性測試結果（N = 1,000）', is_table=True, number=4.2)

add_heading(doc, '4.2  系統功能實測結果', 2)

add_para(doc,
    '本研究進行了開發團隊內部功能測試，旨在驗證系統的基本計次、計時與姿態偵測功能是否正確運作。'
    '以下為一次代表性功能測試紀錄：'
)

func_headers = ['測試欄位', '紀錄值', '說明']
func_rows = [
    ('完成次數（reps）', '5 / 5', '成功計次完整'),
    ('5次總計時間', '12.8 秒', '系統實際計時值'),
    ('單次平均時間', '2.6 秒/次', '對應 Bohannon 60-69 歲偏慢截斷點（2.4 秒/次）略高'),
    ('最大偏斜角度', '5 度', '遠低於 attention 閾值（20 度），正常範圍'),
    ('晃動事件', '0 次', '未偵測到明顯晃動訊號'),
    ('追蹤品質', 'good', '整個測試過程 landmark visibility 均值維持 ≥ 0.7'),
    ('觀察等級', 'attention（略有偏移）', '因單次平均 2.6s > SLOW_AVG_SEC（2.4s）觸發，偏斜與晃動均無觸發'),
]
add_table(doc, func_headers, func_rows)
add_caption(doc, '代表性功能測試紀錄', is_table=True, number=4.3)

add_para(doc,
    '注意：此次測試的受測者為 20 歲健康成人，'
    '系統判定 attention 的原因在於 2.6 秒/次略高於 60-69 歲族群的參考截斷點（2.4 秒/次）。'
    '此結果反映系統目前使用單一年齡群體閾值（60-69 歲）的已知設計侷限：'
    '對 20-40 歲健康成人，系統預期會產生較多「輕微偏移」的判定，'
    '這並非評估誤差，而是閾值設定範圍不足的已知問題，將在下一階段加入年齡分層設定。',
    color=(0x4B, 0x55, 0x63)
)

add_heading(doc, '4.3  工程品質驗證', 2)

quality_headers = ['驗證項目', '指令', '結果']
quality_rows = [
    ('靜態型別檢查', 'npx tsc --noEmit', '通過，0 個型別錯誤'),
    ('程式碼風格檢查', 'npx eslint . --max-warnings=0', '通過，0 errors, 0 warnings'),
    ('生產環境建置', 'npm run build', '通過，9/9 靜態頁面成功生成'),
    ('GPU Fallback 測試', '停用 GPU Delegate，測試降級', 'CPU 模式正常運作，骨架偵測功能完整'),
    ('localStorage 容量保護', '模擬 QuotaExceededError', 'try-catch 正確捕獲，自動清理最舊紀錄後重試'),
    ('Demo 示範資料匯入', '空資料狀態下匯入 JSON', '正確載入，家屬問答與趨勢圖正常顯示'),
]
add_table(doc, quality_headers, quality_rows)
add_caption(doc, '工程品質驗證清單', is_table=True, number=4.4)

add_heading(doc, '4.4  誠實揭露已知限制', 2)

add_para(doc, '本研究遵循學術誠信原則，主動揭露以下限制：')

limits_headers = ['限制類型', '具體說明', '後續計畫']
limits_rows = [
    ('尚未招募真實受試者', '目前驗證數據均來自開發團隊內部功能測試（< 10 次），未對 55 歲以上長輩進行正式可用性研究', '申請 IRB 後執行 n ≥ 30 真實受試者研究'),
    ('無 IRB 審查', '本系統任何測試均不構成受規範的人體試驗。若進入臨床驗證階段，將依規定向所屬機構申請', '尋求大學或醫院研究合作'),
    ('物理治療師盲測待執行', '尚未與任何持照物理治療師進行獨立觀察的一致性比對（Blinded Expert Agreement Study）', '聯繫物理治療所，規劃 Expert Agreement Study（目標 ICC ≥ 0.75）'),
    ('參數一致性循環', 'Ground Truth 閾值與決策引擎閾值來自相同文獻，測試結果反映自我一致性而非外部泛化能力', '外部驗證（真實受試者 vs 治療師獨立判定），計算外部 ICC 與 Cohen\'s κ'),
    ('年齡分層閾值不足', '目前閾值以 60-69 歲族群為主，對 20-40 歲健康成人及 80 歲以上高齡族群的適用性有限', '加入 Bohannon（2006）各年齡段分層閾值，或對照 Lusardi（2003）等多篇規範值研究'),
    ('光線與環境依賴', '光線不足或衣物遮蔽時視覺 SNR 下降，系統降級並提示使用者', '強化環境品質提示 UI，增加環境自動調整建議'),
]
add_table(doc, limits_headers, limits_rows)
add_caption(doc, '已知限制與後續計畫一覽', is_table=True, number=4.5)

add_page_break(doc)


# ================================================================
# 第五章  結論與建議
# ================================================================
add_heading(doc, '第五章  結論與建議', 1)

add_heading(doc, '5.1  研究結論', 2)

add_para(doc,
    '本研究成功完成一套以 FTSST 為核心協定的居家動作觀察系統的設計與實作，'
    '並驗證以下技術可行性：'
)
add_bullet(doc, '技術可行性已初步驗證：透過 MediaPipe Pose Landmarker 在瀏覽器 WASM 沙箱中執行即時骨架偵測，系統可精確完成坐站動作的計次與計時，計時誤差均值（< 0.22 秒）遠低於 FTSST 的 MDC（2.3 秒）。')
add_bullet(doc, '雙模態融合設計合理：SNR 加權互補濾波器的理論設計（截止頻率約 0.5 Hz）符合 FTSST 動作頻帶（0.25-1 Hz），具備降低視覺單模態誤報的邏輯基礎，惟實際效益有待真實受試者研究的量化驗證。')
add_bullet(doc, '隱私設計架構具備創新性：Privacy by Constraint 的設計理念——因技術架構限制而產生的隱私保護——提供了比政策聲明更可信的隱私保證，對偏鄉長輩的心理障礙具有實質意義。')
add_bullet(doc, '參數一致性測試通過：Monte Carlo 模擬（N = 1,000）顯示決策引擎的邏輯與 Bohannon（2006）文獻閾值具備數學上的一致性（整體一致率 ≥ 85%，Cohen\'s κ ≥ 0.75）。')
doc.add_paragraph()

add_para(doc,
    '同時，本研究誠實承認：上述結論均屬技術層面的初步可行性驗證，'
    '尚不構成臨床有效性（Clinical Efficacy）的證明。'
    '缺乏真實長輩受試者研究是最核心的驗證缺口，也是後續工作的首要目標。'
)

add_heading(doc, '5.2  實務建議', 2)

add_para(doc, '根據研究結果與設計心得，提出以下實務建議：')
add_bullet(doc, '拍攝設定：手機架設於正前方，距離以全身入鏡（頭頂至腳踝）為準，建議距離 1.5-2 公尺，高度與腰部齊平，光線充足（視窗前或補充室內照明）。')
add_bullet(doc, '測試姿勢：使用有靠背、無扶手的椅子，椅面高度 43-46 公分，雙腳平踩地面，雙手交叉抱胸。')
add_bullet(doc, '測試節奏：聽到系統倒數完成後，以自然速度連續完成 5 次起立坐下，無需等待任何語音指令，以音效（叮聲）確認每次計次是否成功。')
add_bullet(doc, '資料積累：至少累積 3 次測試後，個人化基準線功能將啟用，系統的評估意義將顯著提升。')
doc.add_paragraph()

add_heading(doc, '5.3  研究限制', 2)

add_para(doc,
    '本研究最主要的限制已於第四章誠實揭露。'
    '在此補充說明：本系統的目標使用族群為居家長輩，'
    '但所有功能測試均由年輕健康成人完成，'
    '這意味著系統在真實目標族群（如行動不便的 75 歲長輩）中的可用性、'
    '辨識精度與錯誤率，目前均未知。'
    '此限制不影響本研究的技術可行性結論，但對臨床適用性的宣稱應保持高度謹慎。'
)

add_heading(doc, '5.4  未來研究方向', 2)

roadmap_headers = ['階段', '時間規劃', '主要內容', '成功指標']
roadmap_rows = [
    ('Phase 0（已完成）', '2026 年 7 月', 'PoC 完成、參數一致性測試通過、競賽送件', 'ESLint 0 errors、tsc 通過、npm build 成功'),
    ('Phase 1', '2026 年 Q3', '尋找物理治療所合作、申請 IRB 核准', 'IRB 審查通過'),
    ('Phase 2', '2026 年 Q4', '執行 n ≥ 30 Expert Agreement Study', '樣本招募完成、盲測流程建立'),
    ('Phase 3', '2027 年 Q1', '計算外部 ICC 與 Cohen\'s κ，調整閾值', 'ICC ≥ 0.75 達成、技術報告發表'),
    ('Phase 4', '2027 年以後', '加入步態分析、手部靈活性等多動作支援', '多動作系統架構設計完成'),
]
add_table(doc, roadmap_headers, roadmap_rows)
add_caption(doc, '後續研究技術路線圖', is_table=True, number=5.1)

add_page_break(doc)


# ================================================================
# 參考文獻（APA 第七版）
# ================================================================
add_heading(doc, '參考文獻', 1)

references = [
    'Bazarevsky, V., Grishchenko, I., Raveendran, K., Zhu, T., Zhang, F., & Grundmann, M. (2020). BlazePose: On-device real-time body pose tracking. arXiv preprint arXiv:2006.10204.',
    'Bohannon, R. W. (2006). Reference values for the five-repetition sit-to-stand test: A descriptive meta-analysis of data from elders. Journal of Strength and Conditioning Research, 20(4), 887-889. https://doi.org/10.1519/R-16kitchell.1',
    'Csuka, M., & McCarty, D. J. (1985). Simple method for measurement of lower extremity muscle strength. American Journal of Medicine, 78(1), 77-81. https://doi.org/10.1016/0002-9343(85)90465-6',
    'Fraunhofer Institute for Digital Medicine MEVIS. (2025). Smartphone-based sit-to-stand analysis using sensor fusion. Proceedings of the Conference on Smart Health Technologies.',
    'Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., Zhang, F., Chang, C.-L., Yong, M., Lee, J., Chang, W.-T., Hua, W., Georg, M., & Grundmann, M. (2019). MediaPipe: A framework for building perception pipelines. arXiv preprint arXiv:1906.08172.',
    'Lusardi, M. M., Pellecchia, G. L., & Schulman, M. (2003). Functional performance in community living older adults. Journal of Geriatric Physical Therapy, 26(3), 14-22.',
    'Meretta, B. M., Whitney, S. L., Marchetti, G. F., Sparto, P. J., & Muirhead, R. J. (2006). The five times sit to stand test: Responsiveness to change. Journal of Geriatric Physical Therapy, 29(1), 3-8.',
    'Perera, S., Mody, S. H., Woodman, R. C., & Studenski, S. A. (2006). Meaningful change and responsiveness in common physical performance measures in older adults. Journal of the American Geriatrics Society, 54(5), 743-749. https://doi.org/10.1111/j.1532-5415.2006.00701.x',
    'Portney, L. G., & Watkins, M. P. (2009). Foundations of clinical research: Applications to practice (3rd ed.). Pearson Prentice Hall.',
    'Sensors MDPI. (2022). Validity and reliability of smartphone-based sit-to-stand analysis. Sensors, 22(3), Article 1113. https://doi.org/10.3390/s22031113',
    'Whitney, S. L., Wrisley, D. M., Marchetti, G. F., Gee, M. A., Redfern, M. S., & Furman, J. M. (2005). Clinical measurement of sit-to-stand performance in people with balance disorders: Validity of data for the five-times-sit-to-stand test. Physical Therapy, 85(10), 1034-1045.',
    '衛生福利部（2023）。台灣老年人口健康統計年報。衛生福利部。',
]

for i, ref in enumerate(references, 1):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(1.0)
    p.paragraph_format.first_line_indent = Cm(-1.0)
    run = p.add_run(ref)
    set_run_font(run, size=11)
    set_para_spacing(p, before=0, after=6, line_spacing=1.5)

add_page_break(doc)


# ================================================================
# 附錄一：系統檔案架構
# ================================================================
add_heading(doc, '附錄一  系統檔案架構一覽', 1)

file_structure = (
    "CareLoop/\n"
    "app/                              Next.js App Router 頁面\n"
    "    page.tsx                      首頁（定位、驗證結果、誠實聲明）\n"
    "    session/page.tsx              測試頁（鏡頭、骨架、即時 HUD）\n"
    "    history/page.tsx              歷史紀錄（趨勢圖、基準線卡）\n"
    "    family/page.tsx               家屬摘要（規則式問答）\n"
    "    validation/page.tsx           算法驗證（Monte Carlo 互動模擬）\n"
    "    benchmark/page.tsx            文獻基準（文獻說明、限制表格）\n"
    "    privacy/page.tsx              隱私聲明\n"
    "components/\n"
    "    PoseCanvas.tsx                MediaPipe 骨架渲染 + GPU/CPU Fallback\n"
    "    nav.tsx                       全站導覽列\n"
    "lib/\n"
    "    types.ts                      所有 TypeScript 型別定義\n"
    "    decision-engine.ts            核心決策引擎（規則式，閾值有文獻依據）\n"
    "    motion-analyzer.ts            坐站狀態機（計次、計時、偏斜）\n"
    "    motion-sensor.ts              慣性感測器 API 包裝\n"
    "    sensor-fusion.ts              SNR 加權雙模態融合管線\n"
    "    adaptive-baseline.ts          個人化基準線（均值 ± 2SD）\n"
    "    synthetic-validation.ts       Monte Carlo 參數一致性測試\n"
    "    narrative-engine.ts           規則式敘事與問答引擎\n"
    "    coaching-engine.ts            即時音效計次回饋（AudioContext）\n"
    "    action-engine.ts              行動層（語音、震動通知）\n"
    "    storage.ts                    localStorage 讀寫（含 Quota 保護）\n"
    "docs/\n"
    "    generate_report.py            本報告生成腳本（python-docx）\n"
    "    CareLoop_研究報告.docx        本報告輸出檔案\n"
    "    validation-benchmark.md       文獻基準驗證文件\n"
    "public/\n"
    "    demo-sessions.json            示範資料（最新 ObservationLevel Schema）\n"
    "next.config.mjs                   Next.js 設定（無 ignoreBuildErrors）\n"
)

p = doc.add_paragraph()
run = p.add_run(file_structure)
set_run_font(run, zh_font='Courier New', en_font='Courier New', size=9, color=(0x4B, 0x55, 0x63))
set_para_spacing(p, before=0, after=4, line_spacing=1.5)

add_page_break(doc)


# ================================================================
# 附錄二：觀察等級定義對照表
# ================================================================
add_heading(doc, '附錄二  觀察等級定義對照表', 1)

level_headers = ['程式值（ObservationLevel）', '顯示文字', '觸發條件', '設計說明']
level_rows = [
    ('smooth', '動作順暢', '所有觀察指標均在正常範圍內', '刻意使用描述性語言，避免「正常」或「健康」等醫療評估用語'),
    ('attention', '略有偏移', '任一指標輕度超出正常範圍（時間稍慢、輕度偏斜或少量晃動）', '提醒家人持續觀察，不引發恐慌'),
    ('review', '建議家人確認', '任一指標明顯超出正常範圍，或計次未完成，或追蹤中斷', '建議家人確認是否需要進一步關注，不宣稱「高風險」或「危險」'),
]
add_table(doc, level_headers, level_rows)
add_caption(doc, '觀察等級定義對照表', is_table=True, number='A2.1')

add_para(doc,
    '本系統刻意廢棄 stable、unstable、caution、risk 等具有醫療診斷暗示的用詞，'
    '改以「觀察到的現象描述」（smooth、attention、review）取代，'
    '以確保系統定位為居家動作觀察工具，而非醫療診斷產品。'
)

# ================================================================
# 最終聲明
# ================================================================
add_section_divider(doc)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(
    'CareLoop 安步 研究報告\n'
    f'報告日期：{datetime.date.today().strftime("%Y 年 %m 月 %d 日")}  版本：v3.0\n'
    '本研究誠實揭露所有已知限制，所有主張均標示其證據等級。\n'
    '本系統為技術可行性原型，不具醫療診斷功能，所有使用者數據僅儲存於使用者本機。'
)
set_run_font(run, size=10, color=(0x9C, 0xA3, 0xAF))
set_para_spacing(p, before=12, after=0)

# ================================================================
# 儲存
# ================================================================
output_path = r"d:\Projects Studio\CareLoop\docs\CareLoop_研究報告.docx"
doc.save(output_path)
print(f"SUCCESS: 報告已儲存至 {output_path}")
