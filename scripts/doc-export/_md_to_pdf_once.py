# One-shot: MD + CSS -> HTML -> Edge headless PDF (UTF-8, preserves source text)
import pathlib
import subprocess
import sys
import markdown

_HERE = pathlib.Path(__file__).resolve().parent
# GlicNutri/ (app root: md, pdf)
PROJECT_ROOT = _HERE.parents[1]
MD_PATH = PROJECT_ROOT / "Planejamento_Final_Atividades_GlicNutri_Ajustado.md"
CSS_PATH = _HERE / "planejamento-pdf-print.css"
PDF_PATH = PROJECT_ROOT / "Planejamento_Final_Atividades_GlicNutri_Ajustado.pdf"
EDGE = pathlib.Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
if not EDGE.is_file():
    EDGE = pathlib.Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")
if not EDGE.is_file():
    EDGE = pathlib.Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")


def main() -> int:
    md_text = MD_PATH.read_text(encoding="utf-8")
    css_text = CSS_PATH.read_text(encoding="utf-8")
    body = markdown.markdown(
        md_text,
        extensions=[
            "markdown.extensions.tables",
            "markdown.extensions.fenced_code",
            "markdown.extensions.nl2br",
            "markdown.extensions.sane_lists",
        ],
    )
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Planejamento GlicNutri</title>
<style>
{css_text}
</style>
</head>
<body>
{body}
</body>
</html>
"""
    html_path = PROJECT_ROOT / "_planejamento_temp_print.html"
    html_path.write_text(html, encoding="utf-8")
    pdf_abs = PDF_PATH.resolve()
    html_uri = html_path.resolve().as_uri()
    cmd = [
        str(EDGE),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"--print-to-pdf={pdf_abs}",
        "--print-to-pdf-no-header",
        html_uri,
    ]
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        sys.stderr.write(r.stderr or "")
        sys.stderr.write(r.stdout or "")
        return r.returncode or 1
    if not PDF_PATH.is_file():
        print("PDF não foi criado.", file=sys.stderr)
        return 1
    try:
        html_path.unlink()
    except OSError:
        pass
    print(str(PDF_PATH))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
