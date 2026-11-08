import pandas as pd, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
import sys, os
os.chdir(sys.argv[1])
d = pd.read_csv('dados/pia_1849.csv', dtype={'valor': str})
d['v'] = pd.to_numeric(d.valor.replace('-', '0'), errors='coerce'); d['cod'] = d.cnae.str[:2]
t = d[d.cod.str.isdigit() & (d.cod >= '10') & (d.ano == 2023) & d['var'].isin([631, 811])]
c = t.pivot_table(index=['cod', 'uf'], columns='var', values='v').reset_index()
c = c[c[631] >= 1000]; c['prod'] = c[811] / c[631]
g = c.groupby('cod')['prod'].agg(n='size', p25=lambda s: s.quantile(.25), p50='median', p75=lambda s: s.quantile(.75))
g = g[g.n >= 6]; gap = (g.p75 - g.p25).median()
print('gap', gap)
CURTO = {'10':'Alimentos','11':'Bebidas','13':'Têxteis','14':'Vestuário','15':'Couro e calçados','16':'Madeira','17':'Celulose e papel',
 '18':'Impressão','19':'Petróleo','20':'Químicos','21':'Farmacêuticos','22':'Borracha e plástico','23':'Minerais não metálicos',
 '24':'Metalurgia','25':'Produtos de metal','26':'Eletrônicos','27':'Materiais elétricos','28':'Máquinas e equipamentos',
 '29':'Veículos','30':'Outros eq. transporte','31':'Móveis','32':'Produtos diversos','33':'Manutenção e instalação'}
g = g.drop(index='19', errors='ignore').sort_values('p50')
for f in ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/segoeuib.ttf']:
    fm.fontManager.addfont(f)
plt.rcParams['font.family'] = 'Segoe UI'
NAV, OURO, AZUL, ROXO, LAR, BG = '#172e59', '#ffd06b', '#2563d5', '#7851be', '#ca7820', '#eef1fa'
fig = plt.figure(figsize=(10.8, 13.5), dpi=100, facecolor=BG)
top = fig.add_axes([0, .755, 1, .245]); top.set_facecolor(NAV); top.axis('off'); top.set_xlim(0, 1); top.set_ylim(0, 1)
top.add_patch(plt.Rectangle((0, 0), 1, 1, color=NAV)); top.add_patch(plt.Rectangle((0, .975), 1, .025, color='#f3bd4b'))
top.text(.06, .82, 'GOVEIADEV  ·  PRODUTIVIDADE INDUSTRIAL  ·  IBGE 2023', color='#b6d0f6', fontsize=13, weight='bold')
top.text(.06, .52, f'R$ {gap*100/1000:.1f} mi'.replace('.', ','), color=OURO, fontsize=76, weight='bold')
top.text(.06, .29, 'a mais de valor por ano, a cada 100 pessoas,', color='white', fontsize=22)
top.text(.06, .14, 'no estado do quartil de cima × no de baixo do mesmo setor', color='#c7d7ee', fontsize=18)
ax = fig.add_axes([.30, .085, .64, .625]); ax.set_facecolor('white')
y = range(len(g))
ax.hlines(y, g.p25, g.p75, color='#b9cbea', lw=9)
ax.scatter(g.p25, y, color=ROXO, s=55, zorder=3, label='quartil de baixo')
ax.scatter(g.p75, y, color=AZUL, s=55, zorder=3, label='quartil de cima')
ax.scatter(g.p50, y, color=LAR, s=28, marker='|', zorder=4, linewidths=2.5)
ax.set_yticks(list(y)); ax.set_yticklabels([CURTO[i] for i in g.index], fontsize=14, color='#284976')
ax.tick_params(axis='x', labelsize=12, colors='#5c6a80'); ax.tick_params(axis='y', length=0)
ax.set_xlabel('Valor da transformação por pessoa ocupada, R$ mil por ano', fontsize=13, color='#5c6a80')
for s in ax.spines.values(): s.set_visible(False)
ax.grid(axis='x', color='#e9eef5'); ax.set_axisbelow(True)
ax.legend(loc='lower right', fontsize=12, frameon=False)
fig.text(.06, .73, 'Estados com 1.000+ pessoas no setor · cada linha vai do quartil de baixo ao de cima', fontsize=13, color='#46556d')
fig.text(.06, .015, 'Fonte: IBGE, Pesquisa Industrial Anual (SIDRA 1849). Petróleo fora da escala. Ramon Goveia · projeto C4', fontsize=11.5, color='#647188')
fig.savefig('capa.png', facecolor=BG)
