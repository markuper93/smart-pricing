import os
import tempfile
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from typing import List, Dict, Any

try:
    from bidi.algorithm import get_display
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False

def _register_hebrew_font():
    """Register a Hebrew-capable font."""
    # Look for DejaVu Sans bundled with the project first
    bundled = os.path.join(os.path.dirname(__file__), '..', '..', 'fonts', 'DejaVuSans.ttf')
    if os.path.exists(bundled):
        try:
            pdfmetrics.registerFont(TTFont('DejaVuSans', bundled))
            return 'DejaVuSans'
        except Exception:
            pass

    font_candidates = [
        ("DejaVuSans", os.path.join(os.path.dirname(__file__), '..', '..', 'fonts', 'DejaVuSans.ttf')),
        ("Arial", "C:/Windows/Fonts/arial.ttf"),
        ("Arial", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("Arial", "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf"),
        ("David", "C:/Windows/Fonts/david.ttf"),
    ]
    for name, path in font_candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                return name
            except Exception:
                continue
    return "Helvetica"

FONT_NAME = _register_hebrew_font()

def rtl(text: str) -> str:
    """Apply RTL bidi algorithm to Hebrew text for proper display in PDF."""
    if not text:
        return ""
    if HAS_BIDI:
        return get_display(str(text))
    return str(text)

def generate_pdf(report_data: List[Dict[str, Any]], title: str, avg_change: float, filename: str) -> str:
    filepath = os.path.join(tempfile.gettempdir(), filename)
    
    page_w, page_h = landscape(A4)
    doc = SimpleDocTemplate(
        filepath,
        pagesize=landscape(A4),
        rightMargin=1*cm,
        leftMargin=1*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm,
    )
    
    # Styles
    title_style = ParagraphStyle(
        "Title",
        fontName=FONT_NAME,
        fontSize=14,
        alignment=TA_CENTER,
        leading=18,
        spaceAfter=8*mm,
        textColor=colors.HexColor("#1a1a2e"),
    )
    header_style = ParagraphStyle(
        "Header",
        fontName=FONT_NAME,
        fontSize=7,
        alignment=TA_CENTER,
        leading=9,
        textColor=colors.white,
    )
    cell_style = ParagraphStyle(
        "Cell",
        fontName=FONT_NAME,
        fontSize=7,
        alignment=TA_CENTER,
        leading=9,
    )
    cell_positive = ParagraphStyle(
        "CellPos",
        fontName=FONT_NAME,
        fontSize=7,
        alignment=TA_CENTER,
        leading=9,
        textColor=colors.HexColor("#16a34a"),
    )
    cell_negative = ParagraphStyle(
        "CellNeg",
        fontName=FONT_NAME,
        fontSize=7,
        alignment=TA_CENTER,
        leading=9,
        textColor=colors.HexColor("#dc2626"),
    )
    summary_style = ParagraphStyle(
        "Summary",
        fontName=FONT_NAME,
        fontSize=10,
        alignment=TA_CENTER,
        leading=14,
        spaceBefore=6*mm,
        textColor=colors.HexColor("#1a1a2e"),
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph(rtl(title), title_style))
    
    if not report_data:
        elements.append(Paragraph(rtl("אין נתונים להצגה"), cell_style))
        doc.build(elements)
        return filepath
    
    # Build table - reverse column order for RTL (first column should be on the right)
    headers = list(report_data[0].keys())
    headers_reversed = list(reversed(headers))
    
    # Header row
    header_row = [Paragraph(rtl(h), header_style) for h in headers_reversed]
    table_data = [header_row]
    
    # Data rows
    change_col_idx = None
    for i, h in enumerate(headers_reversed):
        if 'שינוי' in h and 'אחוז' in h:
            change_col_idx = i
            break
    
    for row in report_data:
        row_cells = []
        for i, h in enumerate(headers_reversed):
            val = str(row.get(h, ""))
            style = cell_style
            # Color the percentage change column
            if i == change_col_idx:
                try:
                    num = float(val.replace('%', '').replace(',', ''))
                    if num > 0:
                        style = cell_positive
                    elif num < 0:
                        style = cell_negative
                except ValueError:
                    pass
            row_cells.append(Paragraph(rtl(val), style))
        table_data.append(row_cells)
    
    # Calculate column widths - distribute evenly
    available_width = page_w - 2*cm
    col_width = available_width / len(headers)
    col_widths = [col_width] * len(headers)
    
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#34495e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        # Alternating row colors
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        # Padding
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)
    
    # Summary
    sign = "+" if avg_change > 0 else ""
    summary_text = rtl(f"אחוז שינוי ממוצע לכלל הרכבים (מחירון ללא עליה לכביש): {sign}{avg_change:.2f}%")
    elements.append(Paragraph(summary_text, summary_style))
    
    doc.build(elements)
    return filepath
