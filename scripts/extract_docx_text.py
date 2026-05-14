"""Extract plain text from Word .docx (paragraph-wise) for review."""
import re
import sys
import zipfile
from pathlib import Path


def main(docx_path: Path, out_path: Path) -> None:
    with zipfile.ZipFile(docx_path, "r") as z:
        xml = z.read("word/document.xml").decode("utf-8")

    paras = xml.split("</w:p>")
    chunks: list[str] = []
    for p in paras:
        ts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, flags=re.DOTALL)
        line = "".join(ts)
        line = re.sub(r"<[^>]+>", "", line)
        line = (
            line.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("\xa0", " ")
        )
        if line.strip():
            chunks.append(line.strip())

    out = "\n".join(chunks)
    out_path.write_text(out, encoding="utf-8")
    print(f"paragraphs: {len(chunks)} chars: {len(out)}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    docx = root / "WordFinalGlicNutri.docx"
    out = root / "_word_plain.txt"
    if len(sys.argv) >= 2:
        docx = Path(sys.argv[1])
    if len(sys.argv) >= 3:
        out = Path(sys.argv[2])
    main(docx, out)
