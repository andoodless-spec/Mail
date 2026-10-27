"""Новые пиксельные SVG «Тихого ящика» (v31).

Рисуем сеточными картами: каждая клетка — один пиксель, поэтому формы
читаются, а края остаются ровными (shape-rendering: crispEdges).
"""

# --- Котик: 18x14 клеток, тело, грудка, лапки и хвост справа -----------------
CAT = [
    '..................',
    '..BB..........BB..',
    '..BBB........BBB..',
    '..BBBB......BBBB..',
    '..BBBBBBBBBBBBBB..',
    '..BBBBBBBBBBBBBB..',
    '..BBDDBBBBBBDDBB..',
    '..BBBBBBBBBBBBBB..',
    '..BBKBBBBBBBBKBB.B',
    '..BBBBBBBBNNBBBB.B',
    '...BBBBBBBBBBBB.BB',
    '...BBLLLLLLLLBB.BB',
    '...BBLLLLLLLLBB.B.',
    '....LLL....LLL....',
]

# --- Почтовый ящик: 12x16 клеток, арка, дверца, флажок, столбик --------------
MAILBOX = [
    '....AAAAAAAA....',
    '..AAAAAAAAAAAA..',
    '.BBBBBBBBBBBBBBH',
    '.BWWWWWWWWWWWWBH',
    '.BWWDDDDDDDDWWBH',
    '.BWWWWWWWWWWWWB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
]

# --- Сердце: 9x8 ------------------------------------------------------------
HEART = [
    '.CC...CC.',
    'CCCCCCCCC',
    'CCCCCCCCC',
    'CCCCCCCCC',
    '.CCCCCCC.',
    '..CCCCC..',
    '...CCC...',
    '....C....',
]

# --- Травинки: 5x5 ----------------------------------------------------------
TUFT = [
    '..G..',
    'G.G.G',
    'G.G.G',
    '.GGG.',
    '.....',
]


def render(grid, palette, x=0, y=0, scale=1):
    """Превращает карту в набор прямоугольников, группируя по цвету."""
    by_color = {}
    for row, line in enumerate(grid):
        for col, ch in enumerate(line):
            color = palette.get(ch)
            if not color:
                continue
            by_color.setdefault(color, []).append((col, row))
    out = []
    transform = ''
    if x or y or scale != 1:
        transform = f' transform="translate({x} {y}) scale({scale})"'
    out.append(f'<g{transform}>')
    for color, cells in by_color.items():
        # горизонтальные полосы одного цвета склеиваем в один rect
        rows = {}
        for col, row in cells:
            rows.setdefault(row, []).append(col)
        for row, cols in sorted(rows.items()):
            cols.sort()
            start = cols[0]
            prev = cols[0]
            for col in cols[1:] + [None]:
                if col is not None and col == prev + 1:
                    prev = col
                    continue
                out.append(f'<rect x="{start}" y="{row}" width="{prev - start + 1}" height="1" fill="{color}"/>')
                if col is not None:
                    start = prev = col
    out.append('</g>')
    return ''.join(out)


CAT_PALETTE = {'B': '#c997ab', 'L': '#e9d6ce', 'D': '#675565', 'K': '#d8aebe', 'N': '#675565'}
CAT_PALETTE_ALT = {'B': '#b0a1c4', 'L': '#e4dcee', 'D': '#4f4359', 'K': '#c3b3d3', 'N': '#4f4359'}
MAILBOX_PALETTE = {'A': '#c997ab', 'B': '#b0a1c4', 'W': '#e9d6ce', 'D': '#675565', 'H': '#a1ac93'}


def hero():
    """Иллюстрация главного экрана 250x150."""
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 150" shape-rendering="crispEdges" '
             'role="img" aria-label="Два котика сидят рядом с почтовым ящиком">']
    # пол: мягкая тень под сценой
    parts.append('<rect x="22" y="132" width="206" height="3" fill="#b7a6ad" opacity=".18"/>')
    parts.append('<rect x="52" y="137" width="146" height="2" fill="#b7a6ad" opacity=".10"/>')
    # левый котик
    parts.append(render(CAT, CAT_PALETTE, x=14, y=75, scale=4.1))
    # правый котик — отзеркален, чтобы мордочки смотрели друг на друга
    mirrored = [line[::-1].replace('B', 'B') for line in CAT]
    parts.append(f'<g transform="translate(250 0) scale(-1 1)">'
                 + render(mirrored, CAT_PALETTE_ALT, x=14, y=75, scale=4.1) + '</g>')
    # ящик по центру, чуть выше линии пола
    parts.append(render(MAILBOX, MAILBOX_PALETTE, x=88, y=85, scale=4.6))
    # сердечки над ящиком
    parts.append(render(HEART, {'C': '#d0acb8'}, x=62, y=30, scale=2.8))
    parts.append(render(HEART, {'C': '#b2a6c2'}, x=118, y=22, scale=2.4))
    parts.append(render(HEART, {'C': '#d8b3c2'}, x=164, y=32, scale=2.8))
    # травинки у лап
    parts.append(render(TUFT, {'G': '#a1ac93'}, x=6, y=121, scale=2.2))
    parts.append(render(TUFT, {'G': '#a1ac93'}, x=224, y=121, scale=2.2))
    parts.append('</svg>')
    return ''.join(parts)


def icon(grid, palette):
    """Иконка 28x28: карта вписывается в 24px и центрируется."""
    rows, cols = len(grid), max(len(line) for line in grid)
    scale = 24 / max(rows, cols)
    x = (28 - cols * scale) / 2
    y = (28 - rows * scale) / 2
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" shape-rendering="crispEdges">'
            + render(grid, palette, x=round(x, 2), y=round(y, 2), scale=round(scale, 3)) + '</svg>')


PROFILE = [
    '...HHHH...',
    '..HHHHHH..',
    '..HEHHEH..',
    '..HHHHHH..',
    '...HHHH...',
    '..SSSSSS..',
    '.SSSSSSSS.',
    '.SSSSSSSS.',
    '.SSSSSSSS.',
]
PROFILE_PALETTE = {'H': '#c997ab', 'E': '#675565', 'S': '#b0a1c4'}

LOCK = [
    '..KKKK..',
    '.K....K.',
    '.K....K.',
    'BBBBBBBB',
    'BBBBBBBB',
    'BBBDDBBB',
    'BBBDDBBB',
    'BBBBBBBB',
]
LOCK_PALETTE = {'K': '#b0a1c4', 'B': '#c997ab', 'D': '#675565'}

PALETTE = [
    '..SSSSSS..',
    '.SSSSSSSS.',
    'SSRRSSPPSS',
    'SSRRSSPPSS',
    'SSSSSSSSSS',
    'SSGGSSYYSS',
    'SSGGSSYYSS',
    '.SSSSSSSS.',
    '..SSSSSS..',
]
PALETTE_PALETTE = {'S': '#e9d6ce', 'R': '#c997ab', 'P': '#b0a1c4', 'G': '#a1ac93', 'Y': '#d0acb8'}

BELL = [
    '...BB...',
    '..BBBB..',
    '..BBBB..',
    '.BBBBBB.',
    '.BBBBBB.',
    'BBBBBBBB',
    '........',
    '...CC...',
]
BELL_PALETTE = {'B': '#c997ab', 'C': '#675565'}

BOX = [
    '..HHHH..',
    '.BBBBBB.',
    'LLLLLLLL',
    'LLLLLLLL',
    'LLLHHLLL',
    'LLLLLLLL',
    'LLLLLLLL',
]
BOX_PALETTE = {'H': '#e9d6ce', 'B': '#c997ab', 'L': '#b0a1c4'}

ICONS = {
    'profile': (PROFILE, PROFILE_PALETTE),
    'lock': (LOCK, LOCK_PALETTE),
    'palette': (PALETTE, PALETTE_PALETTE),
    'bell': (BELL, BELL_PALETTE),
    'box': (BOX, BOX_PALETTE),
}

if __name__ == '__main__':
    open('assets/ui/together.svg', 'w').write(hero())
    for name, (grid, palette) in ICONS.items():
        open(f'assets/ui/{name}.svg', 'w').write(icon(grid, palette))
    print('готово: together.svg +', ', '.join(ICONS))
