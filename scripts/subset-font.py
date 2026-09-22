#!/usr/bin/env python3
"""Cut both Archivo faces down to the characters this site sets.

Both files are preloaded, so every visitor pays for them before the first paint,
and between them they carried 492 codepoints of Google's default subsets for a
site written in Bosnian and English:

    archivo-latin.woff2      34,928 -> ~21,000   ASCII plus typography
    archivo-latin-ext.woff2  32,608 ->  ~3,400   ten Bosnian diacritics

Kept deliberately wider than the copy actually uses -- the whole
Bosnian/Croatian/Serbian latin set, all of printable ASCII, and the punctuation
and symbols a site like this reaches for -- so an edit to copy.ts cannot easily
drop a letter into a fallback face.

THE TRADE: a character outside these sets now renders in Helvetica instead of
Archivo, silently. The accented Latin-1 letters (e-acute, u-umlaut, n-tilde) are
the ones most likely to be missed; they are nine kilobytes on their own and no
copy on the site uses one. If the site ever needs them, add the range here and
to the matching unicode-range in styles.css, and re-run. The untouched originals
are kept in assets-backup/.

The unicode-range in styles.css must always match what these sets contain: a
range wider than the file means the browser downloads the file for a character
that is not in it and then falls back anyway.

    python3 scripts/subset-font.py

Needs fonttools and brotli:  pip install fonttools brotli
"""

from pathlib import Path
import subprocess
import sys

FONTS = Path("public/fonts")
BACKUPS = Path("assets-backup")

# printable ASCII, plus the punctuation and symbols a page like this reaches for:
# en and em dash, curly quotes, ellipsis, up and down arrow, euro, degree,
# copyright, middot, guillemets, multiplication sign, trademark, nbsp
LATIN = (
    ["U+0020-007E"]
    + [f"U+{c:04X}" for c in (
        0x00A0, 0x00A9, 0x00AB, 0x00B0, 0x00B7, 0x00BB, 0x00D7,
        0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026,
        0x2191, 0x2193, 0x20AC, 0x2122,
    )]
)

# Ć ć Č č Đ đ Š š Ž ž
LATIN_EXT = [f"U+{c:04X}" for c in
             (0x106, 0x107, 0x10C, 0x10D, 0x110, 0x111, 0x160, 0x161, 0x17D, 0x17E)]

SETS = {"archivo-latin": LATIN, "archivo-latin-ext": LATIN_EXT}


def subset(name: str, ranges: list[str]) -> None:
    src = FONTS / f"{name}.woff2"
    backup = BACKUPS / f"{name}.full.woff2"
    if not src.exists():
        raise SystemExit(f"missing {src}")
    BACKUPS.mkdir(parents=True, exist_ok=True)
    # subset from the backup, never from an already-subset file: running this
    # twice must not be able to narrow the set further than it says it does
    if not backup.exists():
        backup.write_bytes(src.read_bytes())

    before = src.stat().st_size
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(backup),
            "--unicodes=" + ",".join(ranges),
            # a variable font: keep the weight axis, the stylesheet asks for 400-900
            "--layout-features=*",
            "--flavor=woff2",
            f"--output-file={src}",
        ],
        check=True,
    )
    after = src.stat().st_size
    print(f"  {src}: {before} -> {after} bytes ({100 * after / before:.1f}%)")
    print(f"    unicode-range:{','.join(ranges)}")


def main() -> int:
    for name, ranges in SETS.items():
        subset(name, ranges)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
