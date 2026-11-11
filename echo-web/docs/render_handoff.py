"""Regenerate a copyable PDF from one of the docs Markdown files. Requires reportlab.

Usage: python echo-web/docs/render_handoff.py [ECHO-WEB-MASTER-HANDOFF|ECHO-DEVELOPMENT-REPORT]
"""
import sys
from pathlib import Path
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

root = Path(__file__).resolve().parent
name = sys.argv[1] if len(sys.argv) > 1 else 'ECHO-WEB-MASTER-HANDOFF'
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('BodyWrap', parent=styles['BodyText'], fontName='Helvetica', fontSize=10,
                          leading=14, spaceAfter=7, splitLongWords=True, alignment=TA_LEFT))
story = []
for block in (root / f'{name}.md').read_text(encoding='utf-8').split('\n\n'):
    block = block.strip()
    if not block:
        continue
    if block.startswith('# '):
        story.append(Paragraph(escape(block[2:]), styles['Title']))
    elif block.startswith('## '):
        story.append(Paragraph(escape(block[3:]), styles['Heading2']))
    else:
        story.append(Paragraph(escape(block).replace('\n', '<br/>'), styles['BodyWrap']))
    # A spacer after a heading defeats ReportLab's keep-with-next behavior.
    if not block.startswith('#'):
        story.append(Spacer(1, 2))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#526173'))
    canvas.drawString(42, 24, 'ECHO / Veritas - Engineering handoff - 2026-11-11')
    canvas.drawRightString(553, 24, str(doc.page))
    canvas.restoreState()

SimpleDocTemplate(str(root / f'{name}.pdf'), pagesize=(595, 842),
                  rightMargin=42, leftMargin=42, topMargin=40, bottomMargin=42,
                  title='ECHO to Veritas - Master Handoff' if name == 'ECHO-WEB-MASTER-HANDOFF'
                  else 'ECHO / Veritas - Development Report', author='ECHO engineering').build(
                      story, onFirstPage=footer, onLaterPages=footer)
