#!/usr/bin/env python3
"""Build data/mushaf.js from the quran-qcf4 and quran-meta npm packages.

The output is a compact description of all 604 pages of the Madinah Mushaf
(1441 AH, 15 lines per page): which glyph goes on which line, where the
surah banners and bismillah lines sit, and the rub' al-hizb positions for
the margin medallions. The page fonts themselves are not copied; the reader
loads them at runtime (see assets/js/fonts.js).

Usage:
    npm pack quran-qcf4@1.1.0 quran-meta@latest
    tar xzf quran-qcf4-1.1.0.tgz -C /tmp/qcf4
    tar xzf quran-meta-*.tgz -C /tmp/meta
    pip install fonttools brotli
    python3 scripts/build_data.py --qcf4 /tmp/qcf4/package --meta /tmp/meta/package
"""

import argparse
import glob
import json
import os
import re

from fontTools.ttLib import TTFont

# Line natural widths are in font units (2500 per em). Lines narrower than
# CENTER_BELOW are printed centred in the Mushaf; every other line is justified
# to MEASURE. The few lines wider than MEASURE are scaled down very slightly.
MEASURE = 42000
CENTER_BELOW = 37000

DIACRITICS = re.compile("[ً-ٰٟۖ-ۭـ]")
ALLAH = re.compile("^(?:و|ف|أ|ء)?(?:ب|ت)?(?:الله|لله)م?$")


def parse_list(js, name):
    m = re.search(name + r":\s*\[(.*?)\n\t\]", js, re.S)
    return [int(x) for x in re.findall(r"-?\d+", m.group(1))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--qcf4", required=True, help="unpacked quran-qcf4 package dir")
    ap.add_argument("--meta", required=True, help="unpacked quran-meta package dir")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "mushaf.js"))
    args = ap.parse_args()

    fonts = {}

    def advance(font_name, code):
        if font_name not in fonts:
            fname = font_name + ("" if font_name == "QCF4_QBSML" else "_W") + ".woff2"
            f = TTFont(os.path.join(args.qcf4, "fonts-woff2", fname))
            fonts[font_name] = (f.getBestCmap(), f["hmtx"])
        cmap, hmtx = fonts[font_name]
        return hmtx[cmap[code]][0]

    index = json.load(open(os.path.join(args.qcf4, "index.json"), encoding="utf-8"))
    verses = json.load(open(os.path.join(args.qcf4, "verses.json"), encoding="utf-8"))
    qbsml = json.load(open(os.path.join(args.qcf4, "qbsml.json"), encoding="utf-8"))
    hafs_js = open(glob.glob(os.path.join(args.meta, "dist", "HafsLists-*.js"))[0], encoding="utf-8").read()

    chapters = index["chapters"]
    verse_counts = [c["verses_count"] for c in chapters]

    def ayah_from_abs(n):
        for s, cnt in enumerate(verse_counts, start=1):
            if n <= cnt:
                return s, n
            n -= cnt
        raise ValueError(n)

    quarters = [ayah_from_abs(n) for n in parse_list(hafs_js, "HizbQuarterList")[1:-1]]
    juz_starts = [ayah_from_abs(n) for n in parse_list(hafs_js, "JuzList")[1:-1]]
    sajdas = {ayah_from_abs(n) for n in parse_list(hafs_js, "SajdaList")}
    assert len(quarters) == 240 and len(juz_starts) == 30 and len(sajdas) == 15

    # Running-header surah labels: one small glyph per page, some shared by short surahs.
    merged = next(s for s in qbsml["sets"] if s["name"] == "surah_headers_style_a_merged")["entries"]
    label_for_set = {tuple(e["suras"]): e["codepoint"] for e in merged}
    label_containing = {}
    for e in merged:
        for s in e["suras"]:
            label_containing.setdefault(s, e["codepoint"])

    def running_label(starting, present):
        if starting and tuple(starting) in label_for_set:
            return label_for_set[tuple(starting)]
        sura = starting[-1] if starting else present[0]
        # Al-Fatihah has no running-header glyph; the opening pages carry none in print.
        return label_for_set.get((sura,), label_containing.get(sura, 0))

    def verse_line(key):
        v = verses[key]
        return v["page"], v["lines"][0]["line"]

    marks = {}
    for i, (s, a) in enumerate(quarters):
        page, line = verse_line(f"{s}:{a}")
        marks.setdefault(page, []).append([line, "r", i])
    for s, a in sorted(sajdas):
        v = verses[f"{s}:{a}"]
        page, line = v["page"], v["lines"][-1]["line"]
        marks.setdefault(page, []).append([line, "s", s])

    juz_of_page = {}
    juz_pages = []
    for j, (s, a) in enumerate(juz_starts, start=1):
        page, _ = verse_line(f"{s}:{a}")
        juz_pages.append([page, s, a])

    def juz_for(page):
        j = 1
        for k, (p, _, _) in enumerate(juz_pages, start=1):
            if p <= page:
                j = k
        return j

    pages = []
    widest = 0
    for pg in range(1, 605):
        p = json.load(open(os.path.join(args.qcf4, "pages", "%03d.json" % pg), encoding="utf-8"))
        font_no = int(p["font"].rsplit("_", 1)[1])
        first = next(w for l in p["lines"] for w in l["words"] if w["type"] in ("word", "end"))
        start_s, start_a = map(int, first["verse_key"].split(":"))
        cur_s, cur_a = start_s, start_a
        lines = []
        starting = []
        for l in p["lines"]:
            ws = l["words"]
            kind = ws[0]["type"]
            if kind == "surah_header":
                cur_s, cur_a = ws[0]["sura"], 1
                starting.append(cur_s)
                lines.append([0, cur_s])
                continue
            if kind == "bismillah":
                lines.append([1, ws[0]["code"]])
                continue
            glyphs, types, width = [], [], 0
            for w in ws:
                t = w["type"]
                assert w["font"] == p["font"], (pg, w)
                width += advance(w["font"], w["code"])
                glyphs.append(chr(w["code"]))
                if t == "quarter":
                    types.append("q")
                    continue
                assert w["verse_key"] == f"{cur_s}:{cur_a}", (pg, l["line"], w["verse_key"], cur_s, cur_a)
                if t == "end":
                    types.append("e")
                    cur_a += 1
                elif ALLAH.match(DIACRITICS.sub("", w["text"]).replace("ٱ", "ا")):
                    types.append("a")
                else:
                    types.append("w")
            widest = max(widest, width)
            lines.append(["".join(glyphs), "".join(types), width])
        assert [i + 1 for i in range(len(p["lines"]))] == [l["line"] for l in p["lines"]]
        present = [s["id"] for s in p["surahs"]]
        pages.append([
            font_no,
            start_s,
            start_a,
            juz_for(pg),
            running_label(starting, present),
            lines,
            sorted(marks.get(pg, [])),
        ])

    data = {
        "source": "quran-qcf4 1.1.0 page data (MIT, (c) 2026 Mohamad Hajj Rabee) and quran-meta (MIT, Quran-Center)",
        "measure": MEASURE,
        "centerBelow": CENTER_BELOW,
        "chapters": [
            [c["name_arabic"], c["name_complex"].replace("`", "ʿ").replace("'", "ʾ"), c["translated_name"], c["verses_count"],
             "m" if c["revelation_place"] == "makkah" else "d", c["pages"][0], c["pages"][1]]
            for c in chapters
        ],
        "juz": juz_pages,
        "pages": pages,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("/* Generated by scripts/build_data.py. Glyph layout of the Madinah Mushaf (1441 AH).\n")
        f.write("   Page data from quran-qcf4 (MIT, (c) 2026 Mohamad Hajj Rabee); metadata from quran-meta (MIT). */\n")
        f.write("window.MUSHAF_DATA=")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("pages", len(pages), "widest line", widest, "bytes", os.path.getsize(args.out))


if __name__ == "__main__":
    main()
