import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Render PDF pages to PNG images with PyMuPDF.")
    parser.add_argument("--input", required=True, help="PDF file path")
    parser.add_argument("--output-dir", required=True, help="Directory for rendered PNG pages")
    parser.add_argument("--dpi", type=int, default=200, help="Render DPI")
    parser.add_argument("--max-pages", type=int, default=0, help="0 means all pages")
    args = parser.parse_args()

    try:
        import fitz
    except ImportError as exc:
        raise SystemExit("PyMuPDF is not installed. Install it with: pip install pymupdf") from exc

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(input_path)
    page_count = doc.page_count
    limit = page_count if args.max_pages <= 0 else min(page_count, args.max_pages)

    rendered_pages = []
    extracted_text_chars = 0

    for page_index, page in enumerate(doc):
        extracted_text_chars += len((page.get_text("text") or "").strip())
        if page_index >= limit:
            continue

        pixmap = page.get_pixmap(dpi=args.dpi, alpha=False)
        image_path = output_dir / f"page_{page_index + 1:02d}.png"
        pixmap.save(image_path)
        rendered_pages.append(
            {
                "page": page_index + 1,
                "path": str(image_path),
                "width": pixmap.width,
                "height": pixmap.height,
            }
        )

    metadata = {
        "pageCount": page_count,
        "renderedPageCount": len(rendered_pages),
        "dpi": args.dpi,
        "pdfMetadata": doc.metadata or {},
        "extractedTextChars": extracted_text_chars,
        "isLikelyImagePdf": extracted_text_chars < max(80, page_count * 10),
        "pages": rendered_pages,
    }

    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
