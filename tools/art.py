from pathlib import Path
root=Path(__file__).resolve().parents[1]/'assets/ui'
colors={'p':'#c997ab','l':'#b0a1c4','b':'#91a8bc','i':'#675565','c':'#e9d6ce','g':'#a1ac93','w':'#f1e5df'}
patterns={
'heart': [('p','M3 6h7V3h5v3h7v9h-3v4h-4v4h-5v-4H6v-4H3z'),('l','M6 8h4v3H6z')],
'letter':[('c','M2 5h22v17H2z'),('p','M2 5h22v3h-4v3h-4v3H10v-3H6V8H2z'),('l','M2 19h6v3H2zM18 19h6v3h-6z')],
'candy':[('l','M1 7h5v4h3v5H6v4H1zM21 7h5v13h-5v-4h-3v-5h3z'),('p','M8 6h11v15H8z'),('c','M10 8h3v11h-3z')],
'ice':[('b','M4 4h18v18H4z'),('w','M6 6h5v3H6zM6 9h3v8H6z'),('l','M17 9h3v11h-3z')],
'mailbox':[('l','M2 7h20v13H2z'),('p','M4 4h15v3H4zM20 7h4v13h-4z'),('i','M12 20h3v6h-3z'),('c','M5 9h11v7H5z'),('p','M17 2h3v9h-3zM20 2h5v4h-5z')],
'conversation':[('b','M2 3h20v13H9v5H5v-5H2z'),('c','M6 7h12v2H6zM6 11h8v2H6z')],
'agreements':[('c','M5 2h17v23H5z'),('p','M9 1h9v4H9z'),('g','M8 10h3v3h-3zM8 17h3v3h-3z'),('i','M14 10h5v2h-5zM14 17h5v2h-5z')],
'capsule':[('l','M3 11h21v12H3z'),('p','M1 7h25v5H1z'),('c','M11 7h5v16h-5z'),('p','M7 2h6v5H7zM15 2h6v5h-6z')],
'date':[('c','M3 5h21v19H3z'),('p','M3 5h21v5H3z'),('i','M7 2h2v6H7zM18 2h2v6h-2z'),('l','M7 13h4v3H7zM16 13h4v3h-4zM7 18h4v3H7z')],
'game':[('l','M4 6h19v3h3v12h-7v-4H8v4H1V9h3z'),('i','M6 9h3v7H6zM4 11h7v3H4z'),('p','M18 10h3v3h-3zM22 14h3v3h-3z')],
'home':[('p','M2 11h3V8h4V5h4V2h3v3h4v3h4v3h3v3H2z'),('c','M5 14h19v12H5z'),('l','M12 18h6v8h-6zM7 16h3v4H7z')],
'flower':[('g','M12 10h3v15h-3zM6 17h6v3H6zM15 14h6v3h-6z'),('p','M8 2h10v3h4v6h-4v3H8v-3H4V5h4z'),('c','M10 5h6v6h-6z')],
'tea':[('c','M3 9h17v13H3zM20 11h5v7h-5z'),('p','M2 23h22v2H2z'),('l','M7 1h2v5H7zM14 3h2v5h-2z')],
'star':[('c','M11 1h5v8h9v5h-6v5h-3v7h-5v-7H8v-5H2V9h9z')],
'moon':[('l','M10 2h9v3h-8v4H8v9h4v4h10v3H8v-3H4V6h6z')],
'sun':[('p','M9 7h10v12H9z'),('c','M11 1h5v4h-5zM11 21h5v5h-5zM1 11h5v5H1zM22 11h5v5h-5z')],
'settings':[('l','M9 2h8v4h5v5h4v7h-4v5h-5v4H9v-4H4v-5H0v-7h4V6h5z'),('c','M9 10h8v8H9z')],
'bulb':[('c','M7 2h12v3h4v11h-4v5H7v-5H3V5h4z'),('l','M9 22h8v4H9z')],
'door':[('l','M4 2h16v24H4z'),('c','M16 13h2v3h-2z')],
'cat':[('p','M3 2h6v4h10V2h6v18h-4v4H7v-4H3z'),('i','M7 12h3v3H7zM18 12h3v3h-3zM12 18h4v2h-4z')],
}
for name,items in patterns.items():
 svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" shape-rendering="crispEdges">'+''.join(f'<path fill="{colors[c]}" d="{d}"/>' for c,d in items)+'</svg>'
 (root/(name+'.svg')).write_text(svg)
# Standalone illustration: two cats, a shared mailbox, sprigs and letters.
cat=''.join(f'<path fill="{colors[c]}" d="{d}"/>' for c,d in patterns['cat'])
mail=''.join(f'<path fill="{colors[c]}" d="{d}"/>' for c,d in patterns['mailbox'])
flower=''.join(f'<path fill="{colors[c]}" d="{d}"/>' for c,d in patterns['flower'])
hero=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 150" shape-rendering="crispEdges">
<path fill="#b7a6ad" opacity=".25" d="M16 126h219v3H16z"/>
<g transform="translate(20 68) scale(2.3)">{cat}</g>
<g transform="translate(166 67) scale(2.3)">{cat.replace(colors['p'],colors['l'])}</g>
<g transform="translate(94 27) scale(2.5)">{mail}</g>
<g transform="translate(3 104) scale(.8)">{flower}</g><g transform="translate(227 104) scale(.8)">{flower}</g>
<path fill="#d0acb8" d="M70 30h6v-4h8v4h6v8h-4v4h-6v4h-4v-4h-6z"/>
<path fill="#b2a6c2" d="M173 26h5v-5h5v5h5v5h-5v5h-5v-5h-5z"/>
</svg>'''
(root/'together.svg').write_text(hero)
