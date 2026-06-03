# Gera PDF do relatório de andamento (gestão ADS5) via Edge headless
import pathlib
import subprocess
import sys

_HERE = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = _HERE.parents[1]
HTML_PATH = PROJECT_ROOT / "entregas" / "gestao-projeto" / "relatorio-andamento-glicnutri.html"
PDF_PATH = PROJECT_ROOT / "entregas" / "gestao-projeto" / "Relatorio-Andamento-GlicNutri.pdf"

EDGE_CANDIDATES = [
    pathlib.Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    pathlib.Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]


def find_edge() -> pathlib.Path | None:
    for candidate in EDGE_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def main() -> int:
    if not HTML_PATH.is_file():
        print(f"HTML não encontrado: {HTML_PATH}", file=sys.stderr)
        return 1

    edge = find_edge()
    if not edge:
        print("Microsoft Edge não encontrado. Abra o HTML no browser e imprima como PDF.", file=sys.stderr)
        print(str(HTML_PATH.resolve()), file=sys.stderr)
        return 1

    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    pdf_abs = PDF_PATH.resolve()
    html_uri = HTML_PATH.resolve().as_uri()

    cmd = [
        str(edge),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"--print-to-pdf={pdf_abs}",
        "--print-to-pdf-no-header",
        html_uri,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        sys.stderr.write(result.stderr or "")
        sys.stderr.write(result.stdout or "")
        return result.returncode or 1

    if not PDF_PATH.is_file():
        print("PDF não foi criado.", file=sys.stderr)
        return 1

    print(str(PDF_PATH))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
