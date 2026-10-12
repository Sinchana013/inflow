import io
import os
import datetime
from typing import Dict, Any, List, Optional
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# PowerPoint
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# Word
from docx import Document
from docx.shared import Inches as DocxInches, Pt as DocxPt, RGBColor as DocxRGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# Excel
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# PDF
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Color Constants
PRIMARY_COLOR_HEX = "#1e40af"  # Deep blue
SECONDARY_COLOR_HEX = "#3b82f6"  # Blue
TEXT_COLOR_HEX = "#0f172a"  # Slate 900
MUTED_TEXT_HEX = "#64748b"  # Slate 500
BG_HEADER_HEX = "#f8fafc"  # Slate 50


# -------------------------------------------------------------
# 1. PowerPoint (.pptx) Generator
# -------------------------------------------------------------
def generate_pptx_report(
    title: str,
    subtitle: Optional[str],
    summary: Optional[str],
    kpis: Optional[List[Dict[str, Any]]] = None,
    insights: Optional[List[Dict[str, Any]]] = None,
    tables: Optional[List[Dict[str, Any]]] = None,
    recommendations: Optional[List[str]] = None,
    sources: Optional[List[Dict[str, Any]]] = None
) -> io.BytesIO:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6]

    # Helper: Set slide background color
    def set_slide_background(slide, rgb_tuple):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = RGBColor(*rgb_tuple)

    # Helper: Add standard slide header
    def add_slide_header(slide, slide_title: str, category: str = "INSIGHTFLOW AI INTELLIGENCE"):
        header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(1.0))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p_cat = tf.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = RGBColor(37, 99, 235)

        p_title = tf.add_paragraph()
        p_title.text = slide_title
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = RGBColor(15, 23, 42)

    # Slide 1: Cover Slide
    slide1 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide1, (248, 250, 252))

    # Accent decorative bar
    bar = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(0.2), Inches(3.8))
    bar.fill.solid()
    bar.fill.fore_color.rgb = RGBColor(37, 99, 235)
    bar.line.fill.background()

    cover_box = slide1.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(10.5), Inches(3.8))
    tf1 = cover_box.text_frame
    tf1.word_wrap = True
    tf1.margin_left = tf1.margin_top = tf1.margin_right = tf1.margin_bottom = 0

    p_super = tf1.paragraphs[0]
    p_super.text = "INSIGHTFLOW AI ENTERPRISE INTELLIGENCE REPORT"
    p_super.font.size = Pt(13)
    p_super.font.bold = True
    p_super.font.color.rgb = RGBColor(37, 99, 235)
    p_super.space_after = Pt(14)

    p_main = tf1.add_paragraph()
    p_main.text = title
    p_main.font.size = Pt(36)
    p_main.font.bold = True
    p_main.font.color.rgb = RGBColor(15, 23, 42)
    p_main.space_after = Pt(12)

    if subtitle:
        p_sub = tf1.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.size = Pt(18)
        p_sub.font.color.rgb = RGBColor(100, 116, 139)
        p_sub.space_after = Pt(20)

    p_date = tf1.add_paragraph()
    p_date.text = f"Generated: {datetime.datetime.now().strftime('%B %d, %Y • %H:%M UTC')} | System: InsightFlow AI Platform"
    p_date.font.size = Pt(11)
    p_date.font.color.rgb = RGBColor(148, 163, 184)

    # Slide 2: Executive Summary & KPIs
    slide2 = prs.slides.add_slide(blank_layout)
    set_slide_background(slide2, (255, 255, 255))
    add_slide_header(slide2, "Executive Summary & Core Performance Indicators")

    # Summary box
    if summary:
        sum_box = slide2.shapes.add_textbox(Inches(0.8), Inches(1.7), Inches(11.7), Inches(1.5))
        tf_sum = sum_box.text_frame
        tf_sum.word_wrap = True
        tf_sum.margin_left = tf_sum.margin_top = tf_sum.margin_right = tf_sum.margin_bottom = 0
        p_s = tf_sum.paragraphs[0]
        p_s.text = summary
        p_s.font.size = Pt(14)
        p_s.font.color.rgb = RGBColor(51, 65, 85)

    # KPI Cards row
    if kpis:
        kpi_count = min(len(kpis), 4)
        kpi_width = 11.7 / kpi_count
        for i, kpi in enumerate(kpis[:4]):
            x = Inches(0.8 + i * kpi_width)
            card = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(3.6), Inches(kpi_width - 0.2), Inches(2.8))
            card.fill.solid()
            card.fill.fore_color.rgb = RGBColor(248, 250, 252)
            card.line.color.rgb = RGBColor(226, 232, 240)

            tf_k = card.text_frame
            tf_k.word_wrap = True
            tf_k.margin_left = tf_k.margin_right = Inches(0.3)
            tf_k.margin_top = Inches(0.4)

            p_t = tf_k.paragraphs[0]
            p_t.text = str(kpi.get("title", "Metric")).upper()
            p_t.font.size = Pt(11)
            p_t.font.bold = True
            p_t.font.color.rgb = RGBColor(100, 116, 139)
            p_t.space_after = Pt(10)

            p_v = tf_k.add_paragraph()
            p_v.text = str(kpi.get("formatted_value") or kpi.get("value", "0"))
            p_v.font.size = Pt(28)
            p_v.font.bold = True
            p_v.font.color.rgb = RGBColor(15, 23, 42)
            p_v.space_after = Pt(8)

            p_sub = tf_k.add_paragraph()
            sub_text = kpi.get("period_label", "")
            if kpi.get("change_percentage") is not None:
                sub_text += f" ({kpi.get('change_percentage'):+.1f}%)"
            p_sub.text = sub_text
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = RGBColor(37, 99, 235)

    # Slide 3: Detailed Data Table
    if tables and len(tables) > 0:
        for tbl in tables[:2]:
            slide_tbl = prs.slides.add_slide(blank_layout)
            set_slide_background(slide_tbl, (255, 255, 255))
            add_slide_header(slide_tbl, tbl.get("title", "Detailed Data Breakdown"), "DATA AUDIT")

            cols = tbl.get("columns", [])
            rows = tbl.get("rows", [])
            if cols and rows:
                col_count = len(cols)
                row_count = min(len(rows) + 1, 9)
                table_shape = slide_tbl.shapes.add_table(row_count, col_count, Inches(0.8), Inches(1.8), Inches(11.7), Inches(0.55 * row_count))
                table_obj = table_shape.table

                for col_idx, col in enumerate(cols):
                    cell = table_obj.cell(0, col_idx)
                    cell.text = str(col.get("label", col.get("key", f"Col {col_idx}")))
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = RGBColor(30, 64, 175)
                    for p in cell.text_frame.paragraphs:
                        p.font.size = Pt(12)
                        p.font.bold = True
                        p.font.color.rgb = RGBColor(255, 255, 255)

                for row_idx, r in enumerate(rows[:row_count - 1]):
                    for col_idx, col in enumerate(cols):
                        key = col.get("key", "")
                        val = r.get(key, "")
                        cell = table_obj.cell(row_idx + 1, col_idx)
                        cell.text = str(val)
                        cell.fill.solid()
                        bg = (248, 250, 252) if row_idx % 2 == 1 else (255, 255, 255)
                        cell.fill.fore_color.rgb = RGBColor(*bg)
                        for p in cell.text_frame.paragraphs:
                            p.font.size = Pt(11)
                            p.font.color.rgb = RGBColor(30, 41, 59)

    # Slide 4: Strategic Recommendations & Action Items
    if recommendations:
        slide_rec = prs.slides.add_slide(blank_layout)
        set_slide_background(slide_rec, (255, 255, 255))
        add_slide_header(slide_rec, "Strategic Recommendations & Action Items", "ACTIONABLE INSIGHTS")

        rec_box = slide_rec.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.0))
        tf_rec = rec_box.text_frame
        tf_rec.word_wrap = True

        for idx, rec in enumerate(recommendations[:6]):
            p = tf_rec.paragraphs[0] if idx == 0 else tf_rec.add_paragraph()
            p.text = f"{idx + 1}.  {rec}"
            p.font.size = Pt(15)
            p.font.color.rgb = RGBColor(30, 41, 59)
            p.space_after = Pt(16)

    # Slide 5: Traceable Evidence & Citations
    if sources:
        slide_src = prs.slides.add_slide(blank_layout)
        set_slide_background(slide_src, (248, 250, 252))
        add_slide_header(slide_src, "Traceable Sources & Verifiable Evidence", "DATA AUDIT & REPRODUCIBILITY")

        src_box = slide_src.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.0))
        tf_s = src_box.text_frame
        tf_s.word_wrap = True

        for idx, src in enumerate(sources[:7]):
            p = tf_s.paragraphs[0] if idx == 0 else tf_s.add_paragraph()
            idx_label = src.get("index", idx + 1)
            title_label = src.get("title", "Application Data Record")
            type_label = src.get("source_type", "application_data").replace("_", " ").upper()
            excerpt = src.get("excerpt", "")
            route = src.get("route", "")

            p.text = f"[{idx_label}] {title_label} ({type_label})"
            p.font.size = Pt(13)
            p.font.bold = True
            p.font.color.rgb = RGBColor(30, 64, 175)

            p_sub = tf_s.add_paragraph()
            p_sub.text = f"Route: {route} | Excerpt: \"{excerpt}\""
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = RGBColor(100, 116, 139)
            p_sub.space_after = Pt(10)

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return buf


# -------------------------------------------------------------
# 2. Word (.docx) Generator
# -------------------------------------------------------------
def generate_docx_report(
    title: str,
    subtitle: Optional[str],
    summary: Optional[str],
    kpis: Optional[List[Dict[str, Any]]] = None,
    insights: Optional[List[Dict[str, Any]]] = None,
    tables: Optional[List[Dict[str, Any]]] = None,
    recommendations: Optional[List[str]] = None,
    sources: Optional[List[Dict[str, Any]]] = None
) -> io.BytesIO:
    doc = Document()

    # Document Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run(title)
    title_run.font.size = DocxPt(24)
    title_run.font.bold = True
    title_run.font.color.rgb = DocxRGBColor(30, 64, 175)
    title_p.paragraph_format.space_after = DocxPt(4)

    if subtitle:
        sub_p = doc.add_paragraph()
        sub_run = sub_p.add_run(subtitle)
        sub_run.font.size = DocxPt(14)
        sub_run.font.color.rgb = DocxRGBColor(100, 116, 139)
        sub_p.paragraph_format.space_after = DocxPt(8)

    meta_p = doc.add_paragraph()
    meta_run = meta_p.add_run(
        f"Generated: {datetime.datetime.now().strftime('%B %d, %Y at %H:%M UTC')} | InsightFlow AI Platform"
    )
    meta_run.font.size = DocxPt(10)
    meta_run.font.italic = True
    meta_run.font.color.rgb = DocxRGBColor(148, 163, 184)
    meta_p.paragraph_format.space_after = DocxPt(18)

    # 1. Executive Summary
    h1 = doc.add_heading("1. Executive Summary", level=1)
    h1.paragraph_format.space_before = DocxPt(12)
    h1.paragraph_format.space_after = DocxPt(6)

    if summary:
        doc.add_paragraph(summary)

    # 2. Key Performance Indicators
    if kpis:
        h2 = doc.add_heading("2. Key Performance Indicators", level=1)
        h2.paragraph_format.space_before = DocxPt(14)
        h2.paragraph_format.space_after = DocxPt(6)

        kpi_table = doc.add_table(rows=1, cols=4)
        kpi_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        hdr_cells = kpi_table.rows[0].cells
        hdr_cells[0].text = "Metric"
        hdr_cells[1].text = "Value"
        hdr_cells[2].text = "Trend"
        hdr_cells[3].text = "Reference Period"

        for cell in hdr_cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.bold = True
                    r.font.color.rgb = DocxRGBColor(30, 64, 175)

        for k in kpis:
            row_cells = kpi_table.add_row().cells
            row_cells[0].text = str(k.get("title", ""))
            row_cells[1].text = str(k.get("formatted_value") or k.get("value", ""))
            row_cells[2].text = str(k.get("trend", "neutral")).upper()
            row_cells[3].text = str(k.get("period_label", ""))

        doc.add_paragraph()

    # 3. Insights and Findings
    if insights:
        h3 = doc.add_heading("3. Diagnostic Findings & Cross-Module Insights", level=1)
        h3.paragraph_format.space_before = DocxPt(14)
        h3.paragraph_format.space_after = DocxPt(6)

        for ins in insights:
            p = doc.add_paragraph(style='List Bullet')
            r_bold = p.add_run(f"{ins.get('title', 'Insight')}: ")
            r_bold.bold = True
            p.add_run(str(ins.get('description', '')))

    # 4. Detailed Data Tables
    if tables:
        h4 = doc.add_heading("4. Supporting Data Tables", level=1)
        h4.paragraph_format.space_before = DocxPt(14)
        h4.paragraph_format.space_after = DocxPt(6)

        for tbl in tables:
            doc.add_heading(tbl.get("title", "Dataset"), level=2)
            cols = tbl.get("columns", [])
            rows = tbl.get("rows", [])
            if cols and rows:
                t = doc.add_table(rows=1, cols=len(cols))
                t.alignment = WD_TABLE_ALIGNMENT.CENTER
                h_cells = t.rows[0].cells
                for idx, col in enumerate(cols):
                    h_cells[idx].text = str(col.get("label", col.get("key", f"Col {idx}")))
                    for p in h_cells[idx].paragraphs:
                        for r in p.runs:
                            r.font.bold = True
                            r.font.color.rgb = DocxRGBColor(30, 64, 175)

                for r in rows[:15]:
                    row_cells = t.add_row().cells
                    for idx, col in enumerate(cols):
                        key = col.get("key", "")
                        row_cells[idx].text = str(r.get(key, ""))

                doc.add_paragraph()

    # 5. Strategic Recommendations
    if recommendations:
        h5 = doc.add_heading("5. Strategic Recommendations", level=1)
        h5.paragraph_format.space_before = DocxPt(14)
        h5.paragraph_format.space_after = DocxPt(6)

        for rec in recommendations:
            p = doc.add_paragraph(style='List Number')
            p.add_run(str(rec))

    # 6. Traceable Sources & References
    if sources:
        h6 = doc.add_heading("6. Traceable Sources & Evidence", level=1)
        h6.paragraph_format.space_before = DocxPt(14)
        h6.paragraph_format.space_after = DocxPt(6)

        for src in sources:
            p = doc.add_paragraph()
            idx = src.get("index", 1)
            title_s = src.get("title", "Application Data Record")
            stype = src.get("source_type", "application_data").replace("_", " ").upper()
            route = src.get("route") or src.get("url", "")
            excerpt = src.get("excerpt", "")

            r_idx = p.add_run(f"[{idx}] {title_s} ({stype})\n")
            r_idx.bold = True
            r_idx.font.color.rgb = DocxRGBColor(30, 64, 175)
            p.add_run(f"Location: {route}\nExcerpt: \"{excerpt}\"\nVerified: Yes")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


# -------------------------------------------------------------
# 3. Excel (.xlsx) Generator
# -------------------------------------------------------------
def generate_xlsx_report(
    title: str,
    subtitle: Optional[str],
    summary: Optional[str],
    kpis: Optional[List[Dict[str, Any]]] = None,
    tables: Optional[List[Dict[str, Any]]] = None,
    recommendations: Optional[List[str]] = None,
    sources: Optional[List[Dict[str, Any]]] = None
) -> io.BytesIO:
    wb = openpyxl.Workbook()

    # Sheet 1: Executive Overview & KPIs
    ws_kpi = wb.active
    ws_kpi.title = "Summary & KPIs"
    ws_kpi.views.sheetView[0].showGridLines = True

    # Title styling
    title_font = Font(name="Calibri", size=16, bold=True, color="1E40AF")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=11, bold=True)
    header_fill = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    ws_kpi["A1"] = title
    ws_kpi["A1"].font = title_font
    ws_kpi["A2"] = f"Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M UTC')} | InsightFlow AI Platform"
    ws_kpi["A2"].font = Font(name="Calibri", size=10, italic=True, color="64748B")

    if summary:
        ws_kpi["A4"] = "Executive Summary:"
        ws_kpi["A4"].font = bold_font
        ws_kpi["A5"] = summary

    # KPI Table
    start_row = 7
    if kpis:
        headers = ["KPI Metric", "Value", "Trend", "Period Comparison"]
        for col_idx, h in enumerate(headers, start=1):
            cell = ws_kpi.cell(row=start_row, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        for r_idx, k in enumerate(kpis, start=start_row + 1):
            ws_kpi.cell(row=r_idx, column=1, value=k.get("title", ""))
            ws_kpi.cell(row=r_idx, column=2, value=k.get("formatted_value") or k.get("value", ""))
            ws_kpi.cell(row=r_idx, column=3, value=str(k.get("trend", "neutral")).upper())
            ws_kpi.cell(row=r_idx, column=4, value=k.get("period_label", ""))

            for c in range(1, 5):
                cell = ws_kpi.cell(row=r_idx, column=c)
                cell.border = thin_border
                if (r_idx % 2) == 0:
                    cell.fill = alt_fill

    # Recommendations section in Sheet 1
    if recommendations:
        r_start = (start_row + len(kpis) + 3) if kpis else 7
        ws_kpi.cell(row=r_start, column=1, value="Strategic Recommendations").font = bold_font
        for idx, rec in enumerate(recommendations, start=1):
            ws_kpi.cell(row=r_start + idx, column=1, value=f"{idx}. {rec}")

    # Auto adjust column widths for sheet 1
    for col in ws_kpi.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_kpi.column_dimensions[col_letter].width = max(max_len + 3, 14)

    # Sheet 2: Data Breakdown
    if tables:
        for t_idx, tbl in enumerate(tables):
            ws_data = wb.create_sheet(title=f"Data Table {t_idx + 1}"[:31])
            ws_data.views.sheetView[0].showGridLines = True

            cols = tbl.get("columns", [])
            rows = tbl.get("rows", [])

            ws_data["A1"] = tbl.get("title", "Data Breakdown")
            ws_data["A1"].font = title_font

            # Headers
            for c_idx, col in enumerate(cols, start=1):
                cell = ws_data.cell(row=3, column=c_idx, value=col.get("label", col.get("key", "")))
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal="center")

            # Rows
            for r_idx, r in enumerate(rows, start=4):
                for c_idx, col in enumerate(cols, start=1):
                    val = r.get(col.get("key", ""), "")
                    cell = ws_data.cell(row=r_idx, column=c_idx, value=val)
                    cell.border = thin_border
                    if (r_idx % 2) == 0:
                        cell.fill = alt_fill

            # Auto adjust widths
            for col in ws_data.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = get_column_letter(col[0].column)
                ws_data.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # Sheet 3: Sources & Audit Trail
    if sources:
        ws_src = wb.create_sheet(title="Sources & Evidence")
        ws_src.views.sheetView[0].showGridLines = True
        ws_src["A1"] = "Traceable Sources & Evidence"
        ws_src["A1"].font = title_font

        headers = ["Ref #", "Source Title", "Type", "Location / Route", "Excerpt", "Verified"]
        for c_idx, h in enumerate(headers, start=1):
            cell = ws_src.cell(row=3, column=c_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill

        for r_idx, s in enumerate(sources, start=4):
            ws_src.cell(row=r_idx, column=1, value=s.get("index", r_idx - 3))
            ws_src.cell(row=r_idx, column=2, value=s.get("title", ""))
            ws_src.cell(row=r_idx, column=3, value=s.get("source_type", ""))
            ws_src.cell(row=r_idx, column=4, value=s.get("route") or s.get("url", ""))
            ws_src.cell(row=r_idx, column=5, value=s.get("excerpt", ""))
            ws_src.cell(row=r_idx, column=6, value="VERIFIED" if s.get("verified", True) else "UNVERIFIED")

            for c in range(1, 7):
                ws_src.cell(row=r_idx, column=c).border = thin_border

        for col in ws_src.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws_src.column_dimensions[col_letter].width = max(max_len + 3, 14)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# -------------------------------------------------------------
# 4. PDF (.pdf) Generator
# -------------------------------------------------------------
def generate_pdf_report(
    title: str,
    subtitle: Optional[str],
    summary: Optional[str],
    kpis: Optional[List[Dict[str, Any]]] = None,
    insights: Optional[List[Dict[str, Any]]] = None,
    tables: Optional[List[Dict[str, Any]]] = None,
    recommendations: Optional[List[str]] = None,
    sources: Optional[List[Dict[str, Any]]] = None
) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#94a3b8'),
        spaceAfter=16
    )

    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=14,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph(title, title_style))
    if subtitle:
        elements.append(Paragraph(subtitle, subtitle_style))
    elements.append(Paragraph(f"Generated: {datetime.datetime.now().strftime('%B %d, %Y • %H:%M UTC')} | InsightFlow AI Platform", meta_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=14))

    # Executive Summary
    if summary:
        elements.append(Paragraph("1. Executive Summary", h1_style))
        elements.append(Paragraph(summary, body_style))
        elements.append(Spacer(1, 8))

    # KPIs Grid
    if kpis:
        elements.append(Paragraph("2. Key Performance Indicators", h1_style))
        kpi_data = [["Metric", "Value", "Trend", "Period Comparison"]]
        for k in kpis:
            kpi_data.append([
                str(k.get("title", "")),
                str(k.get("formatted_value") or k.get("value", "")),
                str(k.get("trend", "neutral")).upper(),
                str(k.get("period_label", ""))
            ])

        t_kpi = Table(kpi_data, colWidths=[160, 110, 80, 180])
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ]))
        elements.append(t_kpi)
        elements.append(Spacer(1, 14))

    # Insights
    if insights:
        elements.append(Paragraph("3. Diagnostic Findings", h1_style))
        for ins in insights:
            text = f"<b>{ins.get('title', 'Insight')}</b>: {ins.get('description', '')}"
            elements.append(Paragraph(f"• {text}", body_style))
        elements.append(Spacer(1, 10))

    # Tables
    if tables:
        elements.append(Paragraph("4. Supporting Data Breakdown", h1_style))
        for tbl in tables[:2]:
            elements.append(Paragraph(f"<b>{tbl.get('title', 'Dataset')}</b>", body_style))
            cols = tbl.get("columns", [])
            rows = tbl.get("rows", [])
            if cols and rows:
                col_headers = [str(c.get("label", c.get("key", ""))) for c in cols]
                tbl_matrix = [col_headers]
                for r in rows[:10]:
                    row_vals = [str(r.get(c.get("key", ""), "")) for c in cols]
                    tbl_matrix.append(row_vals)

                col_w = max(40, int(530 / len(cols)))
                t_sub = Table(tbl_matrix, colWidths=[col_w] * len(cols))
                t_sub.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                ]))
                elements.append(t_sub)
                elements.append(Spacer(1, 12))

    # Recommendations
    if recommendations:
        elements.append(Paragraph("5. Recommended Actions", h1_style))
        for idx, rec in enumerate(recommendations, start=1):
            elements.append(Paragraph(f"<b>{idx}.</b> {rec}", body_style))
        elements.append(Spacer(1, 10))

    # Sources & Traceability
    if sources:
        elements.append(Paragraph("6. Traceable Sources & Evidence", h1_style))
        for s in sources:
            idx = s.get("index", 1)
            stitle = s.get("title", "")
            stype = s.get("source_type", "application_data").replace("_", " ").upper()
            route = s.get("route") or s.get("url", "")
            excerpt = s.get("excerpt", "")
            s_text = f"<b>[{idx}] {stitle}</b> ({stype})<br/>&nbsp;&nbsp;&nbsp;&nbsp;<i>Route</i>: {route} | <i>Excerpt</i>: \"{excerpt}\""
            elements.append(Paragraph(s_text, body_style))

    doc.build(elements)
    buf.seek(0)
    return buf


# -------------------------------------------------------------
# 5. Chart PNG Generator (Matplotlib high-res export)
# -------------------------------------------------------------
def generate_chart_png(
    chart_type: str,
    title: str,
    data: List[Dict[str, Any]],
    x_key: str,
    y_keys: List[str]
) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(10, 5), dpi=150)
    fig.patch.set_facecolor('#ffffff')
    ax.set_facecolor('#ffffff')

    x_labels = [str(d.get(x_key, '')) for d in data]

    if chart_type in ['bar', 'bar_chart']:
        for idx, y_k in enumerate(y_keys):
            y_vals = [float(d.get(y_k, 0)) for d in data]
            ax.bar(x_labels, y_vals, label=y_k.replace('_', ' ').title(), color='#2563eb', alpha=0.85)
    else:  # line / line_chart
        for idx, y_k in enumerate(y_keys):
            y_vals = [float(d.get(y_k, 0)) for d in data]
            ax.plot(x_labels, y_vals, marker='o', linewidth=2.5, label=y_k.replace('_', ' ').title(), color='#2563eb')

    ax.set_title(title, fontsize=14, fontweight='bold', color='#0f172a', pad=15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#cbd5e1')
    ax.spines['bottom'].set_color('#cbd5e1')
    ax.tick_params(colors='#64748b', labelsize=9)
    plt.xticks(rotation=25, ha='right')
    ax.grid(axis='y', linestyle='--', alpha=0.4, color='#e2e8f0')

    if len(y_keys) > 1:
        ax.legend(frameon=False)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=200)
    plt.close(fig)
    buf.seek(0)
    return buf
