"""Пиксельные SVG «Тихого ящика» версии v34.

Главное отличие от v31: сердце и звезда нарисованы по сеточным картам,
где форма читается с первого взгляда — две доли, выемка сверху и острие
снизу у сердца, пять лучей у звезды. Плюс отдельная иллюстрация
для окна с датой (торт со свечами и сердечками).
"""

OUT = 'assets/ui'

# --- Сердце: 12x10. Две доли, выемка 2 клетки, острие снизу ----------------
HEART = [
    '..BBB..BBB..',
    '.BBHBBBBBBBS',
    'BBHBBBBBBBSS',
    'BBBBBBBBBSS.',
    'BBBBBBBBSS..',
    '.BBBBBBSS...',
    '..BBBBSS....',
    '...BBSS.....',
    '....BSS.....',
    '.....S......',
]
# Мини-сердце для мелких мест (8x7) — та же форма, но без блика.
HEART_SMALL = [
    '.BB..BB.',
    'BBBBBBBB',
    'BBBBBBBB',
    '.BBBBBB.',
    '..BBBB..',
    '...BB...',
    '........',
]

# --- Звезда: 11x10, пять лучей --------------------------------------------
STAR = [
    '.....B.....',
    '.....B.....',
    '....BBB....',
    '....BBB....',
    '.BBBBBBBBB.',
    'BBBBBBBBBBB',
    '.BBBBBBBBB.',
    '....BBB....',
    '....BBB....',
    '.....B.....',
    '.....B.....',
]

# --- Торт: 16x9, глазурь с потёками, крошки, нижняя кромка -----------------
CAKE = [
    '..FFFFFFFFFFFFFF..',
    'FFFFFFFFFFFFFFFFFF',
    'FDFFFFDDFFFFFFDFFF',
    'CFDCCCFDDCCCCDFDCC',
    'CCCCCCCCCCCCCCCCCC',
    'CCDDCCCCCCCCCDDCCC',
    'CCCCCCCCCCCCCCCCCC',
    'CDDDCCCCCCCCCDDDCC',
    'CCCCCCCCCCCCCCCCCC',
    '.SSSSSSSSSSSSSSSS.',
]

# --- Свеча: 3x8, пламя, фитиль, полосатая ножка ----------------------------
CANDLE = [
    '..F..',
    '.FFF.',
    '.FFF.',
    '..W..',
    '.PPP.',
    '..D..',
    '.PPP.',
    '.PPP.',
]

# --- Тарелка: 22x3 --------------------------------------------------------
PLATE = [
    '..LLLLLLLLLLLLLLLLLL..',
    '.LLLLLLLLLLLLLLLLLLLL.',
    '..DDDDDDDDDDDDDDDDDD..',
]

# --- Искра: 3x3 -----------------------------------------------------------
SPARK = [
    '.B.',
    'BBB',
    '.B.',
]


def render(grid, palette, x=0, y=0, scale=1):
    """Превращает карту в набор прямоугольников, склеивая полосы одного цвета."""
    by_color = {}
    for row, line in enumerate(grid):
        for col, ch in enumerate(line):
            color = palette.get(ch)
            if color:
                by_color.setdefault(color, []).append((col, row))
    out = [f'<g transform="translate({x} {y}) scale({scale})">'] if (x or y or scale != 1) else ['<g>']
    for color, cells in by_color.items():
        rows = {}
        for col, row in cells:
            rows.setdefault(row, []).append(col)
        for row, cols in sorted(rows.items()):
            cols.sort()
            start = prev = cols[0]
            for col in cols[1:] + [None]:
                if col is not None and col == prev + 1:
                    prev = col
                    continue
                out.append(f'<rect x="{start}" y="{row}" width="{prev - start + 1}" height="1" fill="{color}"/>')
                if col is not None:
                    start = prev = col
    out.append('</g>')
    return ''.join(out)


def check(grid, name):
    width = {len(line) for line in grid}
    assert len(width) == 1, f'{name}: строки разной ширины {width}'
    return grid


def svg(view_box, body, label):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges" '
            'role="img" aria-label="%s">%s</svg>' % (view_box[0], view_box[1], label, body))


def write(name, content):
    with open(f'{OUT}/{name}', 'w') as handle:
        handle.write(content)
    print(f'{OUT}/{name}: {len(content)} байт')


def icon(grid, palette):
    """Иконка 28x28: карта вписывается в 24 клетки и центрируется."""
    rows, cols = len(grid), max(len(line) for line in grid)
    scale = 24 / max(rows, cols)
    return svg((28, 28), render(grid, palette, x=round((28 - cols * scale) / 2, 2),
                                y=round((28 - rows * scale) / 2, 2), scale=round(scale, 3)), 'сердце')


def heart(palette):
    check(HEART, 'HEART')
    return icon(HEART, palette)


def star(palette):
    check(STAR, 'STAR')
    scale = round(24 / 11, 3)
    return svg((28, 28), render(STAR, palette, x=round((28 - 11 * scale) / 2, 2),
                                y=round((28 - 11 * scale) / 2, 2), scale=scale), 'звезда')


def anniversary():
    """Иллюстрация для окна с датой: торт со свечами, сердечки и искры."""
    for grid, name in ((CAKE, 'CAKE'), (CANDLE, 'CANDLE'), (SPARK, 'SPARK'), (HEART, 'HEART'), (HEART_SMALL, 'HEART_SMALL')):
        check(grid, name)
    cake_palette = {'F': '#f8eaee', 'D': '#b8809a', 'C': '#d09eb2', 'S': '#a8748a'}
    candle_palette = {'F': '#e7b681', 'W': '#675565', 'P': '#efe0d8', 'D': '#c08ba0'}
    parts = []
    # мягкая тень под сценой
    parts.append('<rect x="66" y="126" width="104" height="3" rx="1.5" fill="#8b7a86" opacity=".16"/>')
    # торт (16x9 по 7 пикселей = 112x63)
    parts.append(render(CAKE, cake_palette, x=64, y=64, scale=7))
    # две свечи на торте: 3x8
    parts.append(render(CANDLE, candle_palette, x=86, y=12, scale=6))
    parts.append(render(CANDLE, candle_palette, x=122, y=24, scale=6))
    # сердечки над тортом
    parts.append(render(HEART_SMALL, {'B': '#d0acb8'}, x=38, y=34, scale=4))
    parts.append(render(HEART_SMALL, {'B': '#b2a6c2'}, x=166, y=40, scale=3.5))
    parts.append(render(HEART, {'B': '#d8b3c2', 'H': '#f0d8e2', 'S': '#c090a4'}, x=110, y=0, scale=2))
    # искры по краям
    parts.append(render(SPARK, {'B': '#cfc0a8'}, x=24, y=62, scale=3))
    parts.append(render(SPARK, {'B': '#cfc0a8'}, x=196, y=56, scale=2.4))
    parts.append(render(SPARK, {'B': '#c9b8c4'}, x=206, y=96, scale=2))
    return svg((206, 140), ''.join(parts), 'Тортик со свечами и сердечками — ваша дата')


if __name__ == '__main__':
    write('heart.svg', heart({'B': '#c997ab', 'H': '#e6c2cf', 'S': '#ab7e93'}))
    write('star.svg', star({'B': '#e9d6ce'}))
    write('anniversary.svg', anniversary())
