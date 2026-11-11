#!/usr/bin/env python3
"""
scripts/readme_assets.py — Visuels animés du README (2.4, lot 17).

Même famille visuelle que le README de Persona GRUB Themes (projet frère de
Hamza, `tools/readme_assets.py` dont ce script reprend la méthode) : fond noir,
trame rouge, lettres « découpées » des Phantom Thieves, citations tapées.

Génère dans img/readme/ :
  - banner.svg          bannière animée (titre en lettres découpées)
  - quotes.svg          citations qui s'écrivent
  - divider.svg         séparateur animé
  - band_modes.svg, band_features.svg, band_community.svg   bandeaux de section

Le texte est converti en TRACÉS : le rendu est identique partout, sans aucune
police installée chez le lecteur. Les polices viennent du site lui-même
(font/google/*.woff2, OFL), instanciées à la bonne graisse — rien d'autre à
installer que les dépendances de dev : fontTools, brotli.

GitHub sert ces SVG comme des images : les animations CSS/SMIL y tournent, les
scripts non (il n'y en a pas). `prefers-reduced-motion` coupe tout.

Usage :
    python scripts/readme_assets.py
"""

import io
import math
import os
import random

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
FONT_DIR = os.path.join(ROOT, "font", "google")
OUT_DIR = os.path.join(ROOT, "img", "readme")

RED = "#E60012"
DARK_RED = "#8B0010"
BLACK = "#0D0D0D"
WHITE = "#FFFFFF"

# (fichier, graisse) — None : police statique.
FONT_FILES = {
    "inter_black": ("inter_normal_latin_5.woff2", 900),
    "inter_bold": ("inter_normal_latin_5.woff2", 700),
    "cinzel_black": ("cinzel_normal_latin_3.woff2", 900),
    "montserrat_black": ("montserrat_normal_latin_9.woff2", 900),
    "oswald_bold": ("oswald_normal_latin_11.woff2", 700),
    "abril": ("abril_fatface_normal_latin_1.woff2", None),
    "playfair_black_italic": ("playfair_display_italic_latin_13.woff2", 900),
}


# --- TEXTE -> TRACÉS SVG ---
class Font:
    def __init__(self, path, weight):
        font = TTFont(path)
        if weight is not None and "fvar" in font:
            font = instantiateVariableFont(font, {"wght": weight})
        self.font = font
        self.glyphs = font.getGlyphSet()
        self.cmap = font.getBestCmap()
        self.upm = font["head"].unitsPerEm
        self.hmtx = font["hmtx"]
        self.cap_height = getattr(font["OS/2"], "sCapHeight", 0) or self.upm * 0.7

    def _glyph(self, char):
        return self.cmap.get(ord(char)) or self.cmap.get(ord("?"))

    def width(self, text, size, spacing=0):
        scale = size / self.upm
        advance = sum(self.hmtx[self._glyph(c)][0] for c in text) * scale
        return advance + spacing * max(len(text) - 1, 0)

    def cap(self, size):
        return self.cap_height * size / self.upm

    def path(self, text, size, x, y, spacing=0):
        """Tracé du texte, ligne de base en (x, y)."""
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs)
        cursor = x
        for char in text:
            glyph = self._glyph(char)
            self.glyphs[glyph].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, y)))
            cursor += self.hmtx[glyph][0] * scale + spacing
        return pen.getCommands()

    def centered(self, text, size, cx, cy, spacing=0):
        """Tracé centré horizontalement et verticalement (hauteur des capitales)."""
        return self.path(text, size, cx - self.width(text, size, spacing) / 2, cy + self.cap(size) / 2, spacing)


FONTS = {name: Font(os.path.join(FONT_DIR, f), w) for name, (f, w) in FONT_FILES.items()}
RANSOM_FONTS = ["inter_black", "cinzel_black", "montserrat_black", "oswald_bold", "abril", "playfair_black_italic"]
RANSOM_STYLES = [  # (fond, lettre)
    (BLACK, WHITE), (WHITE, BLACK), (RED, WHITE), (WHITE, RED), (BLACK, RED), (RED, BLACK),
]


def ransom(text, cx, cy, size, seed, delay=0.0, step=0.06, gap=6):
    """Lettres découpées façon carte de visite des Phantom Thieves. Retourne (svg, largeur)."""
    rng = random.Random(seed)
    letters = []
    for char in text:
        if char == " ":
            letters.append(None)
            continue
        font = FONTS[rng.choice(RANSOM_FONTS)]
        letter_size = size * rng.uniform(0.86, 1.08)
        bg, fg = rng.choice(RANSOM_STYLES)
        w = font.width(char, letter_size)
        letters.append((char, font, letter_size, bg, fg, w, rng.uniform(-9, 9), rng.uniform(-size * 0.08, size * 0.08)))

    pad = size * 0.16
    boxes = [(l[5] + pad * 2) if l else size * 0.32 for l in letters]
    total = sum(boxes) + gap * (len(boxes) - 1)
    x = cx - total / 2
    parts = []
    for i, (letter, box_w) in enumerate(zip(letters, boxes)):
        if letter:
            char, font, letter_size, bg, fg, w, angle, dy = letter
            h = font.cap(letter_size) + pad * 2.2
            lx = x + box_w / 2
            d = font.centered(char, letter_size, 0, 0)
            stroke = f' stroke="{BLACK}" stroke-width="2"' if bg != BLACK else ""
            parts.append(
                f'<g class="pop" style="animation-delay:{delay + i * step:.2f}s">'
                f'<g transform="translate({lx:.1f} {cy + dy:.1f}) rotate({angle:.1f})">'
                f'<rect x="{-box_w / 2:.1f}" y="{-h / 2:.1f}" width="{box_w:.1f}" height="{h:.1f}" fill="{bg}"{stroke}/>'
                f'<path d="{d}" fill="{fg}"/></g></g>'
            )
        x += box_w + gap
    return "".join(parts), total


def svg(width, height, body, style="", defs="", title=""):
    reduced = "@media (prefers-reduced-motion: reduce){*{animation:none!important}}"
    title_el = f"<title>{title}</title>" if title else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">'
        f"{title_el}<style>{style}{reduced}</style><defs>{defs}</defs>{body}</svg>\n"
    )


P5_STYLE = """
.pop{animation:pop .45s cubic-bezier(.3,1.6,.5,1) both;transform-box:fill-box;transform-origin:center}
@keyframes pop{0%{transform:scale(0) rotate(-25deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
.slide{animation:slide .8s cubic-bezier(.2,.9,.2,1) both}
@keyframes slide{0%{transform:translateX(-1400px)}100%{transform:translateX(0)}}
.slide-r{animation:slider .8s cubic-bezier(.2,.9,.2,1) both}
@keyframes slider{0%{transform:translateX(1400px)}100%{transform:translateX(0)}}
.spin{animation:spin 60s linear infinite;transform-box:fill-box;transform-origin:center}
@keyframes spin{to{transform:rotate(360deg)}}
.fade{animation:fade 1s ease both}
@keyframes fade{0%{opacity:0}100%{opacity:1}}
.flash{animation:flash 1.4s ease-out 1.2s both}
@keyframes flash{0%{transform:translateX(-400px) skewX(-25deg);opacity:0}20%{opacity:.9}100%{transform:translateX(1700px) skewX(-25deg);opacity:0}}
"""

HALFTONE = (
    f'<pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">'
    f'<circle cx="6" cy="6" r="2.4" fill="{RED}"/></pattern>'
)


def star_points(cx, cy, outer, inner, spikes, rng=None):
    points = []
    for i in range(spikes * 2):
        r = outer if i % 2 == 0 else inner
        if rng:
            r *= rng.uniform(0.85, 1.12)
        angle = math.pi * i / spikes
        points.append(f"{cx + r * math.cos(angle):.1f},{cy + r * math.sin(angle):.1f}")
    return " ".join(points)


def diamond(cx, cy, r, fill):
    return f'<polygon points="{cx},{cy - r} {cx + r},{cy} {cx},{cy + r} {cx - r},{cy}" fill="{fill}"/>'


def separated_line(segments, font, size, cy, total_width, fill, spacing=2.5, sep_fill=RED):
    """Texte centré avec des losanges entre les segments."""
    gap = size * 2.2
    widths = [font.width(s, size, spacing) for s in segments]
    total = sum(widths) + gap * (len(segments) - 1)
    x = (total_width - total) / 2
    parts = []
    for i, (segment, w) in enumerate(zip(segments, widths)):
        parts.append(f'<path d="{font.path(segment, size, x, cy + font.cap(size) / 2, spacing)}" fill="{fill}"/>')
        x += w
        if i < len(segments) - 1:
            parts.append(diamond(x + gap / 2, cy, size * 0.28, sep_fill))
            x += gap
    return "".join(parts)


# --- BANNIÈRE ---
def banner():
    w, h = 1280, 420
    rng = random.Random(5)
    title, _ = ransom("PERSONADLE", w / 2, 150, 92, seed=24, delay=0.5, step=0.07)
    sub_font = FONTS["inter_black"]
    sub = "THE DAILY GUESSING GAME"
    sub_size = 44
    sub_w = sub_font.width(sub, sub_size, 4)
    bar_x = w / 2 - sub_w / 2 - 50
    # L'italique est penché à la main (skewX) : Inter n'a pas d'italique dans les polices du site.
    sub_paths = (
        f'<g transform="translate({w / 2} 263) skewX(-12) translate({-w / 2} -263)">'
        f'<path d="{sub_font.centered(sub, sub_size, w / 2 + 5, 263 + 4, 4)}" fill="{RED}"/>'
        f'<path d="{sub_font.centered(sub, sub_size, w / 2, 263, 4)}" fill="{WHITE}"/></g>'
    )
    body = f"""
<rect width="{w}" height="{h}" fill="{BLACK}"/>
<g class="fade"><rect width="{w}" height="{h}" fill="url(#dots)" opacity=".22" mask="url(#fade-mask)"/></g>
<g class="spin"><polygon points="{star_points(1080, 210, 330, 150, 14, rng)}" fill="{DARK_RED}" opacity=".55"/></g>
<g class="spin" style="animation-direction:reverse"><polygon points="{star_points(170, 260, 260, 110, 12, rng)}" fill="#1a1a1a"/></g>
<g class="slide"><polygon points="-40,70 1320,0 1320,70 -40,150" fill="{RED}"/></g>
<g class="slide-r" style="animation-delay:.15s"><polygon points="-40,250 1320,215 1320,290 -40,335" fill="{WHITE}"/></g>
<g class="slide" style="animation-delay:.25s"><polygon points="-40,262 1320,226 1320,281 -40,325" fill="{BLACK}"/></g>
<g class="slide-r" style="animation-delay:.35s"><polygon points="-40,345 1320,300 1320,312 -40,360" fill="{RED}"/></g>
{title}
<g class="slide" style="animation-delay:.9s">
  <polygon points="{bar_x + 30},226 {bar_x + sub_w + 120},218 {bar_x + sub_w + 90},300 {bar_x},306" fill="{BLACK}" stroke="{RED}" stroke-width="4"/>
  {sub_paths}
</g>
<g class="fade" style="animation-delay:1.3s">{separated_line(["PERSONA 1 TO 5X", "SIX MODES", "SIX LANGUAGES", "A NEW TARGET EVERY DAY"], FONTS["inter_bold"], 17, 388, w, WHITE)}</g>
<rect class="flash" x="0" y="0" width="90" height="{h}" fill="{WHITE}"/>
"""
    defs = HALFTONE + (
        '<radialGradient id="fade-grad" cx=".75" cy=".5" r=".7"><stop offset="0" stop-color="#fff"/>'
        '<stop offset="1" stop-color="#000"/></radialGradient>'
        f'<mask id="fade-mask"><rect width="{w}" height="{h}" fill="url(#fade-grad)"/></mask>'
    )
    return svg(w, h, body, P5_STYLE, defs, "PersonaDLE — the daily guessing game")


# --- CITATIONS QUI S'ÉCRIVENT ---
QUOTES = [
    "I am thou, thou art I...",
    "Who is it going to be today?",
    "Take your time.",
    "Welcome to the Velvet Room.",
    "Thou hast found today's target!",
]


def quotes():
    w, h = 1280, 76
    # Playfair italique et non Special Elite (machine à écrire) : les contours
    # « usés » de Special Elite donnaient un SVG de près de 1 Mo.
    font = FONTS["playfair_black_italic"]
    size = 30
    slot = 4.0  # secondes par citation
    total = slot * len(QUOTES)
    body = [
        f'<rect x="140" y="8" width="1000" height="60" rx="6" fill="{BLACK}"/>',
        f'<polygon points="140,8 160,8 150,68 140,68" fill="{RED}"/>',
        f'<polygon points="1120,8 1140,8 1140,68 1110,68" fill="{RED}"/>',
        f'<rect width="0" height="0"><animate id="cycle" attributeName="width" from="0" to="0" dur="{total}s" begin="0s;cycle.end"/></rect>',
    ]
    defs = []
    for i, text in enumerate(QUOTES):
        tw = font.width(text, size, 1)
        x0 = w / 2 - tw / 2
        start = i * slot
        clip = f"clip{i}"
        # ⚠️ SMIL linéaire : le dernier keyTimes DOIT valoir 1, sinon l'animation
        # est ignorée en silence.
        defs.append(
            f'<clipPath id="{clip}"><rect x="{x0 - 4:.1f}" y="0" width="0" height="{h}">'
            f'<animate attributeName="width" values="0;0;{tw + 8:.1f};{tw + 8:.1f};0;0" '
            f'keyTimes="0;{start / total:.4f};{(start + 1.4) / total:.4f};{(start + 3.4) / total:.4f};{(start + 3.8) / total:.4f};1" '
            f'dur="{total}s" begin="cycle.begin"/></rect></clipPath>'
        )
        body.append(f'<path clip-path="url(#{clip})" d="{font.path(text, size, x0, 38 + font.cap(size) / 2, 1)}" fill="{WHITE}"/>')
        body.append(
            f'<rect y="22" width="12" height="32" fill="{RED}" opacity="0">'
            f'<animate attributeName="x" values="{x0:.1f};{x0:.1f};{x0 + tw + 6:.1f};{x0 + tw + 6:.1f};{x0:.1f};{x0:.1f}" '
            f'keyTimes="0;{start / total:.4f};{(start + 1.4) / total:.4f};{(start + 3.4) / total:.4f};{(start + 3.8) / total:.4f};1" '
            f'dur="{total}s" begin="cycle.begin"/>'
            f'<animate attributeName="opacity" values="0;1;0;1;0;1;0;1;0;0" calcMode="discrete" '
            f'keyTimes="0;{start / total:.4f};{(start + 1.6) / total:.4f};{(start + 2.0) / total:.4f};{(start + 2.4) / total:.4f};'
            f'{(start + 2.8) / total:.4f};{(start + 3.2) / total:.4f};{(start + 3.5) / total:.4f};{(start + 3.9) / total:.4f};1" '
            f'dur="{total}s" begin="cycle.begin"/></rect>'
        )
    return svg(w, h, "".join(body), "", "".join(defs), "I am thou, thou art I...")


# --- SÉPARATEUR ---
def divider():
    w, h = 1280, 22
    shards = "".join(
        f'<polygon points="{x},{h} {x + 14},0 {x + 44},0 {x + 30},{h}" fill="{RED if (x // 60) % 3 else BLACK}"/>'
        for x in range(-120, w + 240, 60)
    )
    style = ".run{animation:run 3s linear infinite}@keyframes run{to{transform:translateX(120px)}}"
    return svg(w, h, f'<g class="run">{shards}</g>', style)


# --- BANDEAUX DE SECTION ---
def tag(text, x, cy, font, size, bg, fg, skew=12):
    tw = font.width(text, size, 2)
    pad = 18
    h = font.cap(size) + 22
    return (
        f'<polygon points="{x + skew},{cy - h / 2} {x + tw + pad * 2 + skew},{cy - h / 2} {x + tw + pad * 2},{cy + h / 2} {x},{cy + h / 2}" fill="{bg}"/>'
        f'<path d="{font.centered(text, size, x + pad + tw / 2 + skew / 2, cy, 2)}" fill="{fg}"/>'
    )


def band(title_line, kicker, tag_text, seed, accent_shape):
    w, h = 1280, 180
    _, title_w = ransom(title_line, 0, 0, 58, seed=seed)
    tx = 70 + title_w / 2
    title, _ = ransom(title_line, tx, 100, 58, seed=seed, delay=0.3, step=0.04)
    kicker_font = FONTS["inter_black"]
    kicker_svg = (
        f'<g transform="translate(72 46) skewX(-12) translate(-72 -46)">'
        f'<path d="{kicker_font.path(kicker, 20, 72, 46, 3)}" fill="{RED}"/></g>'
        if kicker
        else ""
    )
    tag_font = FONTS["inter_black"]
    tag_w = tag_font.width(tag_text, 26, 2) + 48
    body = f"""
<rect width="{w}" height="{h}" fill="{BLACK}"/>
<rect width="{w}" height="{h}" fill="url(#dots)" opacity=".18"/>
{accent_shape}
<g class="slide"><polygon points="-20,140 {tx + title_w / 2 + 140},128 {tx + title_w / 2 + 110},150 -20,160" fill="{RED}"/></g>
<g class="fade">{kicker_svg}</g>
{title}
<g class="slide-r" style="animation-delay:.6s">{tag(tag_text, w - 60 - tag_w, 100, tag_font, 26, WHITE, BLACK)}</g>
"""
    return svg(w, h, body, P5_STYLE, HALFTONE, title_line.title())


def band_modes():
    rng = random.Random(3)
    accent = f'<g class="spin"><polygon points="{star_points(1150, 90, 150, 70, 12, rng)}" fill="{DARK_RED}" opacity=".7"/></g>'
    return band("SIX MODES", "TWELVE WAYS TO PLAY", "NORMAL + EXPERT", seed=21, accent_shape=accent)


def band_features():
    accent = (
        f'<g class="slide-r"><polygon points="900,-10 960,-10 1240,190 1180,190" fill="{RED}" opacity=".85"/>'
        f'<polygon points="1180,-10 1240,-10 960,190 900,190" fill="{WHITE}" opacity=".9"/></g>'
    )
    return band("FEATURES", "STREAKS · FRIENDS · BADGES", "6 LANGUAGES", seed=31, accent_shape=accent)


def band_community():
    rng = random.Random(9)
    accent = f'<g class="spin" style="animation-direction:reverse"><polygon points="{star_points(1120, 100, 170, 80, 10, rng)}" fill="#3a3fb0" opacity=".55"/></g>'
    return band("COMMUNITY", "JOIN THE VELVET ROOM", "DISCORD", seed=44, accent_shape=accent)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    outputs = {
        "banner.svg": banner(),
        "quotes.svg": quotes(),
        "divider.svg": divider(),
        "band_modes.svg": band_modes(),
        "band_features.svg": band_features(),
        "band_community.svg": band_community(),
    }
    for name, content in outputs.items():
        with io.open(os.path.join(OUT_DIR, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"{name}: {len(content.encode('utf-8')) // 1024} Ko")


if __name__ == "__main__":
    main()
