"""Generate README architecture image variants via Gemini/Imagen.

Usage examples:
  python docs/diagrams/generate-images.py
  python docs/diagrams/generate-images.py --dotenv D:\\legate\\.env

Environment variables accepted for API key:
  GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_NANO_BANANA_API_KEY
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import textwrap
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "generated"
MANIFEST_PATH = ROOT / "generated-manifest.json"
PREVIEW_PATH = ROOT / "preview-generated.html"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"

BASE_PROMPT = textwrap.dedent(
    """
    Create a minimal, premium architecture diagram in 16:9 landscape ratio.
    The content must be an architecture flow for "Portarium (VAOP)".

    Required structure:
    - Top row: exactly 3 labeled elements -> "Agents", "Automations", "OpenClaw".
      Include robot motifs/icons in this row.
    - Center row: a prominent "Portarium" block with subtitle "Control Plane".
      Include a "User / Workforce" element connected to Portarium with a bidirectional arrow.
    - Bottom row: exactly 3 labeled elements -> "Services", "Software", "APIs & Tools".
    - Vertical flow from top row through Portarium to bottom row.

    Constraints:
    - Keep it clean and readable for a README hero section.
    - Use iconography, not photos.
    - Keep text spelling exact as written above.
    - No extra brand logos, no watermark, no random text.
    """
).strip()


@dataclass(frozen=True)
class ImagePrompt:
    slug: str
    title: str
    model: str
    style_prompt: str
    temperature: float = 0.7

    @property
    def full_prompt(self) -> str:
        return f"{BASE_PROMPT}\n\nStyle direction:\n{self.style_prompt.strip()}"


PROMPTS: list[ImagePrompt] = [
    ImagePrompt(
        slug="minimal_robotic_blueprint_original",
        title="Minimal Robotic Blueprint (Original)",
        model="gemini-3-pro-image-preview",
        style_prompt="""
        Light minimal linework on white background with blueprint-like thin strokes.
        Strong robot iconography in the top row, including a clear robot head for Agents.
        The OpenClaw element must use a lobster claw or lobster icon next to the label.
        Use subtle cyan and indigo accents only; keep layout clean and documentation-first.
        """,
        temperature=0.6,
    ),
    ImagePrompt(
        slug="isometric_minimal_fusion_original",
        title="Isometric-Minimal Fusion (Original)",
        model="gemini-3-pro-image-preview",
        style_prompt="""
        Hybrid style: isometric structure but minimal linework and low visual noise.
        Emphasize robots in the top row while preserving documentation readability.
        OpenClaw must use a lobster icon (not generic scales) while still labeled OpenClaw.
        Keep center Portarium block bold and the user/workforce relationship explicit.
        """,
        temperature=0.6,
    ),
    ImagePrompt(
        slug="minimal_robotic_blueprint_edited",
        title="Minimal Robotic Blueprint (Edited)",
        model="gemini-3-pro-image-preview",
        style_prompt="""
        Keep the same look as Minimal Robotic Blueprint: white background, thin blueprint strokes,
        strong robot motifs, and OpenClaw shown with a lobster claw icon.
        In the Portarium control-plane area, add exactly three short dot points in small text:
        • Orchestrates cross-system workflows
        • Enforces policy and approvals
        • Captures evidence for audit
        Place these bullets inside or immediately under the Portarium block.
        """,
        temperature=0.6,
    ),
    ImagePrompt(
        slug="isometric_minimal_fusion_edited",
        title="Isometric-Minimal Fusion (Edited)",
        model="gemini-3-pro-image-preview",
        style_prompt="""
        Keep the same look as Isometric-Minimal Fusion: clean hybrid isometric-minimal composition,
        robots emphasized in the top row, and OpenClaw represented with a lobster icon.
        In the Portarium control-plane area, add exactly three short dot points in small text:
        • Orchestrates cross-system workflows
        • Enforces policy and approvals
        • Captures evidence for audit
        Keep the bullets readable but visually lightweight.
        """,
        temperature=0.6,
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate README architecture diagrams.")
    parser.add_argument(
        "--dotenv",
        type=Path,
        help="Optional .env file to read API key from if env vars are not set.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of prompt variants to generate (0 means all).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing generated files if present.",
    )
    return parser.parse_args()


def _read_key_from_dotenv(path: Path) -> str | None:
    if not path.exists():
        return None
    wanted = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_NANO_BANANA_API_KEY")
    line_re = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$")
    for raw in path.read_text(encoding="utf-8").splitlines():
        match = line_re.match(raw)
        if not match:
            continue
        key, value = match.group(1), match.group(2)
        if key not in wanted:
            continue
        value = value.strip().strip('"').strip("'")
        if value:
            return value
    return None


def resolve_api_key(dotenv_path: Path | None) -> str:
    for env_key in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_NANO_BANANA_API_KEY"):
        value = os.getenv(env_key, "").strip()
        if value:
            return value
    if dotenv_path is not None:
        from_file = _read_key_from_dotenv(dotenv_path)
        if from_file:
            return from_file
    raise RuntimeError(
        "No API key found. Set GEMINI_API_KEY (or GOOGLE_API_KEY/GOOGLE_NANO_BANANA_API_KEY), "
        "or pass --dotenv <path-to-.env>."
    )


def _ext_for_mime(mime: str) -> str:
    lower = mime.lower()
    if "png" in lower:
        return "png"
    if "jpeg" in lower or "jpg" in lower:
        return "jpg"
    if "webp" in lower:
        return "webp"
    return "bin"


def _request_json(url: str, body: dict, timeout: int = 180) -> dict:
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url=url,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read())


def _extract_images_from_generate_content(data: dict) -> list[tuple[str, str]]:
    images: list[tuple[str, str]] = []
    for candidate in data.get("candidates", []):
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            inline = part.get("inlineData")
            if not inline:
                continue
            b64 = inline.get("data")
            mime = inline.get("mimeType", "image/png")
            if b64:
                images.append((b64, mime))
    return images


def _extract_images_from_predict(data: dict) -> list[tuple[str, str]]:
    images: list[tuple[str, str]] = []
    for prediction in data.get("predictions", []):
        if isinstance(prediction, dict):
            if "bytesBase64Encoded" in prediction:
                images.append((prediction["bytesBase64Encoded"], "image/png"))
                continue
            if "image" in prediction and isinstance(prediction["image"], dict):
                img = prediction["image"]
                b64 = img.get("bytesBase64Encoded")
                if b64:
                    mime = img.get("mimeType", "image/png")
                    images.append((b64, mime))
                    continue
    return images


def generate_with_gemini(api_key: str, prompt: ImagePrompt) -> list[tuple[str, str]]:
    url = f"{API_BASE}/models/{prompt.model}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": prompt.full_prompt}]}],
        "generationConfig": {
            "temperature": prompt.temperature,
            "responseModalities": ["TEXT", "IMAGE"],
        },
    }
    data = _request_json(url, body)
    return _extract_images_from_generate_content(data)


def generate_with_imagen_predict(
    api_key: str,
    model: str,
    prompt_text: str,
    *,
    aspect_ratio: str = "16:9",
) -> list[tuple[str, str]]:
    url = f"{API_BASE}/models/{model}:predict?key={api_key}"
    body = {
        "instances": [{"prompt": prompt_text}],
        "parameters": {"sampleCount": 1, "aspectRatio": aspect_ratio},
    }
    data = _request_json(url, body)
    return _extract_images_from_predict(data)


def write_preview_html(rows: Iterable[dict]) -> None:
    cards = []
    for row in rows:
        image_rel = row["image_rel_path"].replace("\\", "/")
        title = row["title"]
        model = row["model"]
        slug = row["slug"]
        cards.append(
            f"""
            <article class="card">
              <div class="meta">
                <h2>{title}</h2>
                <p><strong>Slug:</strong> {slug}</p>
                <p><strong>Model:</strong> {model}</p>
                <p><strong>File:</strong> {image_rel}</p>
              </div>
              <img loading="lazy" src="{image_rel}" alt="{title}" />
            </article>
            """.strip()
        )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Portarium Diagram Preview</title>
  <style>
    :root {{
      --bg: #0b1220;
      --card: #121b2f;
      --line: #24324e;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: radial-gradient(circle at 20% 0%, #16213a, var(--bg) 45%);
      color: var(--text);
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      padding: 24px;
    }}
    header {{
      margin-bottom: 16px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 24px;
    }}
    p {{
      margin: 0;
      color: var(--muted);
      line-height: 1.4;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }}
    .card {{
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border-radius: 14px;
      overflow: hidden;
    }}
    .meta {{
      padding: 14px;
      border-bottom: 1px solid var(--line);
    }}
    .meta h2 {{
      margin: 0 0 8px;
      font-size: 16px;
      color: var(--accent);
    }}
    .meta p {{
      margin: 2px 0;
      font-size: 13px;
    }}
    img {{
      display: block;
      width: 100%;
      height: auto;
      background: #fff;
    }}
  </style>
</head>
<body>
  <header>
    <h1>Portarium README Diagram Candidates</h1>
    <p>Generated on {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")} using Gemini image models.</p>
  </header>
  <section class="grid">
    {"".join(cards)}
  </section>
</body>
</html>
"""
    PREVIEW_PATH.write_text(html, encoding="utf-8")


def main() -> int:
    args = parse_args()
    try:
        api_key = resolve_api_key(args.dotenv)
    except RuntimeError as exc:
        print(f"Error: {exc}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    prompts = PROMPTS[: args.limit] if args.limit > 0 else PROMPTS
    manifest_rows: list[dict] = []
    failures: list[str] = []

    for idx, prompt in enumerate(prompts, start=1):
        filename_prefix = f"{idx:02d}_{prompt.slug}"
        existing = list(OUT_DIR.glob(f"{filename_prefix}.*"))
        if existing and not args.overwrite:
            print(f"[skip] {prompt.slug} (already exists)")
            chosen = existing[0]
            manifest_rows.append(
                {
                    "slug": prompt.slug,
                    "title": prompt.title,
                    "model": prompt.model,
                    "image_rel_path": str(chosen.relative_to(ROOT)),
                }
            )
            continue

        print(f"[run] {prompt.slug} -> {prompt.model}")
        try:
            images = generate_with_gemini(api_key, prompt)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            print(f"  HTTP {exc.code}: {body[:400]}")
            images = []
        except Exception as exc:  # pragma: no cover - network/runtime issues
            print(f"  Error: {exc}")
            images = []

        # Optional fallback to Imagen if no image was returned.
        if not images:
            print("  Gemini returned no image; trying Imagen fallback...")
            try:
                images = generate_with_imagen_predict(
                    api_key,
                    "imagen-4.0-generate-001",
                    prompt.full_prompt,
                )
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                print(f"  Imagen HTTP {exc.code}: {body[:300]}")
            except Exception as exc:  # pragma: no cover
                print(f"  Imagen error: {exc}")

        if not images:
            failures.append(prompt.slug)
            print("  Failed: no image produced.")
            time.sleep(1.5)
            continue

        b64, mime = images[0]
        ext = _ext_for_mime(mime)
        out_path = OUT_DIR / f"{filename_prefix}.{ext}"
        out_path.write_bytes(base64.b64decode(b64))
        print(f"  Saved: {out_path}")
        manifest_rows.append(
            {
                "slug": prompt.slug,
                "title": prompt.title,
                "model": prompt.model,
                "image_rel_path": str(out_path.relative_to(ROOT)),
            }
        )
        time.sleep(1.2)

    manifest = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "count": len(manifest_rows),
        "items": manifest_rows,
        "failures": failures,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    write_preview_html(manifest_rows)

    print("\nDone.")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Preview:  {PREVIEW_PATH}")
    if failures:
        print(f"Failures: {', '.join(failures)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
