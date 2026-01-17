import re
import json
import sys
import fitz
# Regex patterns
START_RE = re.compile(
    r'^\s{0,4}(Definition|Theorem|Proposition|Claim|Lemma|Corollary)\s+(\d+(?:\.\d+)+)\s*\.?\s*(.*?)$',
    re.MULTILINE
)

STOP_RE = re.compile(
    r'^\s{0,4}(Proof\.|Proof\s|Note:|Note\s+[A-Z]|Note\s+We|Examples?\.|Examples?\s+[a-z\(]|Solution\.|Rough Work)',
    re.MULTILINE | re.IGNORECASE
)

def normalize(text: str) -> str:
    """Normalize PDF text: dehyphenate, fix newlines"""
    text = re.sub(r'-\n(\w)', r'\1', text)
    text = re.sub(r'\r\n?', '\n', text)
    return text

def extract_items(pdf_path: str):
    """Extract theorem/definition statements (without proofs)"""
    doc = fitz.open(pdf_path)
    chunks = []
    for i in range(len(doc)):
        t = doc.load_page(i).get_text("text")
        chunks.append(f"\n<<<PAGE:{i+1}>>>\n{t}")
    
    full = normalize("".join(chunks))
    matches = list(START_RE.finditer(full))
    
    items = []
    seen = set()
    
    for k, m in enumerate(matches):
        kind = m.group(1).strip()
        num = m.group(2).strip()
        title_part = (m.group(3) or "").strip()
        
        # Deduplicate
        item_key = (kind, num)
        if item_key in seen:
            continue
        seen.add(item_key)
        
        # Find body region
        default_end = matches[k + 1].start() if k + 1 < len(matches) else len(full)
        body_start = m.end()
        body_region = full[body_start:default_end]
        
        # Stop at proof/note/examples
        stop_match = STOP_RE.search(body_region)
        body_end = body_start + stop_match.start() if stop_match else default_end
        
        # Clean body text
        body = full[body_start:body_end].strip()
        body = re.sub(r'<<<PAGE:\d+>>>', '', body)
        body = re.sub(r'\n{3,}', '\n\n', body)
        body = re.sub(r'\s+\n', '\n', body)
        body = body.strip()
        
        if len(body) < 10:
            continue
        
        items.append({
            "id": f"{kind} {num}",
            "type": kind,
            "number": num,
            "title": title_part,
            "text": body,
        })
    
    return items

def to_latex(items):
    """Generate LaTeX document"""
    def esc(s: str) -> str:
        s = s.replace('\\', r'\textbackslash{}')
        for a, b in [('&', r'\&'), ('%', r'\%'), ('$', r'\$'), 
                     ('#', r'\#'), ('_', r'\_'), ('{', r'\{'), ('}', r'\}')]:
            s = s.replace(a, b)
        return s
    
    out = [
        r"\documentclass{article}",
        r"\usepackage[margin=1in]{geometry}",
        r"\usepackage{amsmath}",
        r"\begin{document}",
        r"\title{Extracted Definitions and Theorems}",
        r"\maketitle",
    ]
    
    for it in items:
        heading = f"{it['type']} {it['number']}"
        if it['title']:
            heading += f" --- {it['title']}"
        out.append(r"\subsection*{" + esc(heading) + "}")
        out.append(esc(it['text']))
        out.append(r"\medskip")
        out.append("")
    
    out.append(r"\end{document}")
    return "\n".join(out)

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_definitions.py <textbook.pdf>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    items = extract_items(pdf_path)
    
    # Save JSON
    json_path = "definitions.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    
    # Save LaTeX
    tex_path = "definitions.tex"
    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(to_latex(items))
    
    print(f"✓ Extracted {len(items)} items from {pdf_path}")
    print(f"  - JSON: {json_path}")
    print(f"  - LaTeX: {tex_path}")

if __name__ == "__main__":
    main()
