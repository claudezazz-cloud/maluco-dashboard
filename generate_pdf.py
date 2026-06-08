#!/usr/bin/env python3
"""
generate_pdf.py — Gera PDF a partir de Markdown usando fpdf2 (100% Python, sem wkhtmltopdf).
Uso: python3 generate_pdf.py input.md output.pdf
"""
import sys
import re
import unicodedata

try:
    from fpdf import FPDF
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'fpdf2', '-q', '--break-system-packages'])
    from fpdf import FPDF


def sanitize(text):
    """Remove emojis e caracteres Unicode fora do Latin-1, mantendo acentos."""
    # Replace common typographic characters with ASCII equivalents
    replacements = {
        '–': '-', '—': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...'
    }
    for search, replace in replacements.items():
        text = text.replace(search, replace)
        
    out = []
    for ch in text:
        try:
            ch.encode('latin-1')
            out.append(ch)
        except UnicodeEncodeError:
            # Tenta substituir por equivalente ASCII
            nfkd = unicodedata.normalize('NFKD', ch)
            ascii_approx = nfkd.encode('latin-1', 'ignore').decode('latin-1')
            if ascii_approx:
                out.append(ascii_approx)
            else:
                cat = unicodedata.category(ch)
                if cat.startswith('So') or cat.startswith('Sk'):
                    out.append('')  # emoji/symbol — remove
                else:
                    out.append('-') # Default fallback instead of ?
    return ''.join(out)


class MarkdownPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=15)
        
    def header(self):
        pass
        
    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, sanitize(f'Pagina {self.page_no()}/{{nb}}'), align='C')


def parse_inline(pdf, text):
    """Render inline markdown: **bold**, *italic*"""
    text = sanitize(text)
    parts = re.split(r'(\*\*.*?\*\*|\*.*?\*)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            pdf.set_font('', 'B')
            pdf.write(6, part[2:-2])
            pdf.set_font('', '')
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            pdf.set_font('', 'I')
            pdf.write(6, part[1:-1])
            pdf.set_font('', '')
        else:
            pdf.write(6, part)


def md_to_pdf(input_md, output_pdf):
    with open(input_md, 'r', encoding='utf-8') as f:
        md_text = f.read()
    
    pdf = MarkdownPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    lines = md_text.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Empty line
        if not stripped:
            pdf.ln(4)
            i += 1
            continue
        
        # Headings
        if stripped.startswith('### '):
            pdf.set_font('Helvetica', 'B', 13)
            pdf.set_text_color(50, 50, 50)
            pdf.ln(3)
            pdf.cell(0, 8, sanitize(stripped[4:]), new_x='LMARGIN', new_y='NEXT')
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            i += 1
            continue
            
        if stripped.startswith('## '):
            pdf.set_font('Helvetica', 'B', 14)
            pdf.set_text_color(30, 30, 30)
            pdf.ln(4)
            pdf.cell(0, 9, sanitize(stripped[3:]), new_x='LMARGIN', new_y='NEXT')
            # Underline
            pdf.set_draw_color(200, 200, 200)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(3)
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            i += 1
            continue
            
        if stripped.startswith('# '):
            pdf.set_font('Helvetica', 'B', 18)
            pdf.set_text_color(20, 20, 20)
            pdf.cell(0, 12, sanitize(stripped[2:]), new_x='LMARGIN', new_y='NEXT')
            # Thick underline
            pdf.set_draw_color(60, 60, 60)
            pdf.set_line_width(0.5)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.set_line_width(0.2)
            pdf.ln(4)
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            i += 1
            continue
        
        # Horizontal rule
        if stripped in ('---', '***', '___'):
            pdf.ln(3)
            pdf.set_draw_color(180, 180, 180)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(3)
            i += 1
            continue
        
        # Bullet list (- or *)
        if re.match(r'^[\-\*]\s+', stripped):
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            text = re.sub(r'^[\-\*]\s+', '', stripped)
            # Indent
            x = pdf.get_x()
            pdf.set_x(x + 5)
            pdf.cell(5, 6, '-')  # simple dash as bullet
            parse_inline(pdf, text)
            pdf.ln(6)
            i += 1
            continue
        
        # Numbered list
        m = re.match(r'^(\d+)\.\s+', stripped)
        if m:
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(0, 0, 0)
            num = m.group(1)
            text = stripped[m.end():]
            x = pdf.get_x()
            pdf.set_x(x + 5)
            pdf.set_font('Helvetica', 'B', 10)
            pdf.cell(8, 6, f'{num}.')
            pdf.set_font('Helvetica', '', 10)
            parse_inline(pdf, text)
            pdf.ln(6)
            i += 1
            continue
        
        # Table detection
        if '|' in stripped and i + 1 < len(lines) and re.match(r'^[\|\s\-:]+$', lines[i+1].strip()):
            # Parse table header
            headers = [c.strip() for c in stripped.split('|') if c.strip()]
            i += 2  # Skip header + separator
            
            rows = []
            while i < len(lines) and '|' in lines[i].strip() and lines[i].strip():
                row = [c.strip() for c in lines[i].strip().split('|') if c.strip()]
                rows.append(row)
                i += 1
            
            # Calculate column widths
            num_cols = len(headers)
            available = pdf.w - pdf.l_margin - pdf.r_margin
            col_w = available / num_cols
            
            # Header
            pdf.set_font('Helvetica', 'B', 9)
            pdf.set_fill_color(240, 240, 240)
            for h in headers:
                pdf.cell(col_w, 7, sanitize(h[:int(col_w/2.2)]), border=1, fill=True)
            pdf.ln()
            
            # Rows
            pdf.set_font('Helvetica', '', 9)
            pdf.set_fill_color(255, 255, 255)
            for row in rows:
                for j in range(num_cols):
                    val = row[j] if j < len(row) else ''
                    pdf.cell(col_w, 6, sanitize(val[:int(col_w/2.2)]), border=1)
                pdf.ln()
            
            pdf.ln(3)
            continue
        
        # Regular paragraph
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(0, 0, 0)
        parse_inline(pdf, stripped)
        pdf.ln(6)
        i += 1
    
    pdf.output(output_pdf)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python3 generate_pdf.py input.md output.pdf")
        sys.exit(1)
    
    md_to_pdf(sys.argv[1], sys.argv[2])
