"""Regenerate the copyable master PDF from Markdown. Requires reportlab."""
from pathlib import Path
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

root = Path(__file__).resolve().parent
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('BodyWrap', parent=styles['BodyText'], fontName='Helvetica', fontSize=10,
                          leading=14, spaceAfter=7, splitLongWords=True, alignment=TA_LEFT))
story = []
for block in (root / 'ECHO-WEB-MASTER-HANDOFF.md').read_text(encoding='utf-8').split('\n\n'):
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
    canvas.drawString(42, 24, 'ECHO / Veritas - Engineering handoff - 2026-11-07')
    canvas.drawRightString(553, 24, str(doc.page))
    canvas.restoreState()

SimpleDocTemplate(str(root / 'ECHO-WEB-MASTER-HANDOFF.pdf'), pagesize=(595, 842),
                  rightMargin=42, leftMargin=42, topMargin=40, bottomMargin=42,
                  title='ECHO to Veritas - Master Handoff', author='ECHO engineering').build(
                      story, onFirstPage=footer, onLaterPages=footer)
