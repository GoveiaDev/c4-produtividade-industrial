(() => {
  const D = window.DADOS, A0 = D.anos[0], MIN_PO = D.regra.min_po, MIN_UF = D.regra.min_uf;
  const $ = id => document.getElementById(id);
  const nS = D.setores.length, nU = D.ufs.length;
  // cubo[ano][setor][uf] = {po, vti, receita, folha}
  const cubo = D.anos.map(() => D.setores.map(() => new Array(nU).fill(null)));
  for (const [a, s, u, po, vti, receita, folha] of D.celulas) cubo[a][s][u] = { po, vti, receita, folha };

  const st = { setor: D.setores.findIndex(s => s.cod === '10'), uf: D.ufs.findIndex(u => u.sigla === 'MG'), ano: D.anos.length - 1, med: 'vti', calcEditado: false };

  // ---------- formato ----------
  const nf = (v, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const milR = v => 'R$ ' + nf(v) + ' mil'; // v em mil R$
  const reais = v => { // v em mil R$
    const a = Math.abs(v);
    if (a >= 1e6) return 'R$ ' + nf(v / 1e6, 1) + ' bi';
    if (a >= 1e3) return 'R$ ' + nf(v / 1e3, 1) + ' mi';
    return 'R$ ' + nf(v) + ' mil';
  };
  const pessoas = v => v >= 1e6 ? nf(v / 1e6, 2) + ' mi' : v >= 1e3 ? nf(v / 1e3, 0) + ' mil' : nf(v);
  const pct = v => (v >= 0 ? '+' : '−') + nf(Math.abs(v) * 100, 0) + '%';
  const quantil = (arr, q) => { // interpolação linear, igual ao pandas
    const s = [...arr].sort((a, b) => a - b), p = (s.length - 1) * q, i = Math.floor(p);
    return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (p - i) : s[i];
  };

  // ---------- cálculo ----------
  const porPessoa = (c, med) => c && c.po > 0 && c[med] != null ? c[med] / c.po : null;
  function setorAno(a, s, med) {
    const lista = [];
    for (let u = 0; u < nU; u++) {
      const c = cubo[a][s][u], v = porPessoa(c, med);
      if (c && c.po >= MIN_PO && v != null) lista.push({ u, v, c });
    }
    if (lista.length < MIN_UF) return { ok: false, lista };
    const vs = lista.map(x => x.v);
    return { ok: true, lista, p25: quantil(vs, .25), p50: quantil(vs, .5), p75: quantil(vs, .75) };
  }
  const cache = {};
  const SA = (a, s, med) => cache[a + '|' + s + '|' + med] || (cache[a + '|' + s + '|' + med] = setorAno(a, s, med));
  function heroi(a, med) {
    const gaps = [];
    for (let s = 0; s < nS; s++) { const r = SA(a, s, med); if (r.ok) gaps.push(r.p75 - r.p25); }
    return { gap: quantil(gaps, .5), n: gaps.length };
  }
  function folhaBR(a, s) { // soma das células divulgadas
    let f = 0, v = 0;
    for (let u = 0; u < nU; u++) { const c = cubo[a][s][u]; if (c && c.folha != null && c.vti != null) { f += c.folha; v += c.vti; } }
    return v > 0 ? f / v : null;
  }
  function folhaInd(a) {
    let f = 0, v = 0;
    for (let s = 0; s < nS; s++) for (let u = 0; u < nU; u++) { const c = cubo[a][s][u]; if (c && c.folha != null && c.vti != null) { f += c.folha; v += c.vti; } }
    return v > 0 ? f / v : null;
  }

  // ---------- filtros ----------
  const fS = $('fSetor'), fU = $('fUf'), fA = $('fAno');
  D.setores.map((s, i) => [s, i]).sort((x, y) => x[0].curto.localeCompare(y[0].curto, 'pt')).forEach(([s, i]) => fS.add(new Option(s.curto, i)));
  D.ufs.map((u, i) => [u, i]).sort((x, y) => x[0].nome.localeCompare(y[0].nome, 'pt')).forEach(([u, i]) => fU.add(new Option(u.nome + ' (' + u.sigla + ')', i)));
  D.anos.slice().reverse().forEach(a => fA.add(new Option(a, a - A0)));
  fS.onchange = () => { st.setor = +fS.value; render(); };
  fU.onchange = () => { st.uf = +fU.value; render(); };
  fA.onchange = () => { st.ano = +fA.value; render(); };
  document.querySelectorAll('#fMed button').forEach(b => b.onclick = () => {
    st.med = b.dataset.m;
    document.querySelectorAll('#fMed button').forEach(x => x.setAttribute('aria-pressed', x === b));
    st.calcEditado = false; render();
  });
  $('cPes').oninput = $('cVal').oninput = () => { st.calcEditado = true; renderCalc(); };

  // ---------- tooltip ----------
  const dica = $('dica');
  const mostra = (e, html) => { dica.innerHTML = html; dica.style.opacity = 1; move(e); };
  const move = e => {
    const w = dica.offsetWidth, h = dica.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    dica.style.left = Math.max(8, x) + 'px'; dica.style.top = Math.max(8, y) + 'px';
  };
  const esconde = () => dica.style.opacity = 0;

  const nomeMed = () => st.med === 'vti' ? 'valor da transformação' : 'receita líquida';

  // ---------- render ----------
  function render() {
    fS.value = st.setor; fU.value = st.uf; fA.value = st.ano;
    const a = st.ano, ano = D.anos[a], s = st.setor, u = st.uf, med = st.med;
    const set = D.setores[s], uf = D.ufs[u], r = SA(a, s, med);
    const h = heroi(a, med);

    $('heroNum').textContent = reais(h.gap * 100).replace(',0 ', ' ');
    $('heroRot').textContent = (med === 'vti' ? 'A MAIS DE VALOR' : 'A MAIS DE RECEITA') + ' POR ANO A CADA 100 PESSOAS';
    $('heroTxt').textContent = `no mesmo setor · mediana de ${h.n} setores · ${ano}`;
    $('faixa').innerHTML = `<b>${set.curto}</b> · ${uf.nome} · ${ano} · ${nomeMed()} por pessoa ocupada · valores em reais de ${ano}`;

    // KPIs
    const c = cubo[a][s][u], vUf = porPessoa(c, med), naComp = r.ok && c && c.po >= MIN_PO && vUf != null;
    if (r.ok) {
      $('kMed').textContent = milR(r.p50);
      $('kMedTxt').textContent = `por pessoa, por ano · entre ${r.lista.length} estados com 1.000+ pessoas`;
      $('kGap').textContent = reais((r.p75 - r.p25) * 100);
      $('kGapTxt').textContent = `por ano · quartil de cima ${milR(r.p75)}, de baixo ${milR(r.p25)} por pessoa`;
    } else {
      $('kMed').textContent = '—'; $('kMedTxt').textContent = `só ${r.lista.length} estados com 1.000+ pessoas; o mínimo para comparar é ${MIN_UF}`;
      $('kGap').textContent = '—'; $('kGapTxt').textContent = 'setor sem comparação neste ano';
    }
    $('kUfRot').textContent = uf.nome;
    if (vUf != null) {
      $('kUf').textContent = milR(vUf);
      if (naComp) {
        const pos = [...r.lista].sort((x, y) => y.v - x.v).findIndex(x => x.u === u) + 1;
        $('kUfTxt').textContent = `por pessoa · ${pos}º de ${r.lista.length} estados no setor`;
      } else $('kUfTxt').textContent = c.po < MIN_PO ? `por pessoa · só ${nf(c.po)} pessoas, fora da comparação` : 'por pessoa · setor sem comparação neste ano';
    } else { $('kUf').textContent = '—'; $('kUfTxt').textContent = c ? 'valor omitido pelo IBGE (sigilo)' : 'sem fábrica com 5+ pessoas no setor'; }
    if (naComp) {
      const dif = vUf / r.p50 - 1, ate = (r.p50 - vUf) * 100;
      $('kDif').textContent = pct(dif);
      $('kDifTxt').textContent = ate > 0 ? `faltam ${reais(ate)} por ano a cada 100 pessoas para a mediana` : `${reais(-ate)} por ano a cada 100 pessoas acima da mediana`;
    } else { $('kDif').textContent = '—'; $('kDifTxt').textContent = 'estado fora da comparação neste setor e ano'; }
    if (c && c.folha != null && c.vti > 0) {
      const fUf = c.folha / c.vti, fBr = folhaBR(a, s);
      $('kFol').textContent = 'R$ ' + nf(fUf * 100);
      $('kFolTxt').textContent = `de salários e encargos a cada R$ 100 de VTI · no setor, Brasil: R$ ${nf(fBr * 100)}`;
    } else { $('kFol').textContent = '—'; $('kFolTxt').textContent = 'sem dado de folha nesta célula'; }
    let poT = 0, nT = 0;
    for (let k = 0; k < nU; k++) { const x = cubo[a][s][k]; if (x && x.po != null) { poT += x.po; nT++; } }
    $('kPo').textContent = pessoas(poT);
    $('kPoTxt').textContent = `em ${nT} estados, somando as células divulgadas` + (c && c.po != null ? ` · ${uf.sigla}: ${pessoas(c.po)}` : '');

    // leitura
    let txt;
    if (r.ok && naComp) {
      const dif = vUf / r.p50 - 1;
      txt = `Em ${set.curto.toLowerCase()}, cada pessoa ocupada em ${uf.nome} gerou <b>${milR(vUf)}</b> de ${nomeMed()} em ${ano}, `
        + (Math.abs(dif) < .03 ? 'praticamente na mediana dos estados' : `<b>${nf(Math.abs(dif) * 100)}% ${dif > 0 ? 'acima' : 'abaixo'}</b> da mediana dos estados (${milR(r.p50)})`)
        + `. Entre o quartil de cima e o de baixo do setor, a distância é de <b>${reais((r.p75 - r.p25) * 100)} por ano a cada 100 pessoas</b>.`;
    } else if (r.ok) txt = `Em ${set.curto.toLowerCase()}, a mediana dos estados foi <b>${milR(r.p50)}</b> por pessoa em ${ano}. ${uf.nome} não entra na comparação deste setor (sigilo ou menos de 1.000 pessoas). Escolha outro estado no gráfico.`;
    else txt = `${set.curto} tem menos de ${MIN_UF} estados com 1.000+ pessoas em ${ano}, então não há comparação justa entre estados. Escolha outro setor.`;
    $('leitura').innerHTML = txt;

    renderEstados(r, set, ano); renderCalor(a, med, ano); renderEvo(); renderFolha(); renderCalc();
  }

  function renderEstados(r, set, ano) {
    $('tEst').textContent = `${set.curto}: cada estado`;
    const box = $('estados');
    if (!r.lista.length) { box.innerHTML = '<div class="vazio">Nenhum estado com 1.000+ pessoas neste setor e ano.</div>'; $('estSub').textContent = ''; return; }
    $('estSub').textContent = `${nomeMed()[0].toUpperCase() + nomeMed().slice(1)} por pessoa ocupada em ${ano}, estados com 1.000+ pessoas no setor` + (r.ok ? '' : ' (poucos estados: sem quartis)');
    const lista = [...r.lista].sort((x, y) => y.v - x.v), max = lista[0].v * 1.04;
    const w = v => (v / max * 100).toFixed(2) + '%';
    box.innerHTML = lista.map(x => `<button type="button" class="linha${x.u === st.uf ? ' sel' : ''}" data-u="${x.u}"><span class="n">${D.ufs[x.u].nome}</span><span class="trilho"><i style="width:${w(x.v)};background:${x.u === st.uf ? '#ca7820' : '#2563d5'}"></i></span><span class="val tab">${milR(x.v)}</span></button>`).join('');
    const ms = r.ok ? [['m25', r.p25, 'Q1'], ['m50', r.p50, 'mediana'], ['m75', r.p75, 'Q3']] : [];
    const linhas = ms.map(([k, v, t]) => `<div class="marca ${k}" style="left:calc(140px + (100% - 222px) * ${(v / max).toFixed(4)})"><span>${t}</span></div>`).join('');
    box.insertAdjacentHTML('beforeend', linhas);
    box.querySelectorAll('.linha').forEach(b => {
      const x = lista.find(l => l.u === +b.dataset.u);
      b.onclick = () => { st.uf = x.u; render(); };
      b.onmousemove = e => mostra(e, `<b>${D.ufs[x.u].nome}</b><br>${milR(x.v)} por pessoa<br>${pessoas(x.c.po)} pessoas ocupadas<br>${r.ok ? pct(x.v / r.p50 - 1) + ' vs. mediana do setor' : ''}`);
      b.onmouseleave = esconde;
    });
  }

  function cor(ind) { // ind = estado ÷ mediana; escala log simétrica de 0,5× a 2×
    const t = Math.max(-1, Math.min(1, Math.log2(ind)));
    const mix = (c1, c2, k) => c1.map((v, i) => Math.round(v + (c2[i] - v) * k));
    const branco = [244, 246, 251], azul = [37, 99, 213], roxo = [120, 81, 190];
    const c = t >= 0 ? mix(branco, azul, t) : mix(branco, roxo, -t);
    return `rgb(${c})`;
  }
  function renderCalor(a, med, ano) {
    const el = $('calor');
    $('calorSub').textContent = `${nomeMed()[0].toUpperCase() + nomeMed().slice(1)} por pessoa em ${ano}, estado ÷ mediana dos estados no mesmo setor. Escala de metade (roxo) ao dobro (azul).`;
    const ufsOrd = D.ufs.map((x, i) => i).sort((x, y) => D.ufs[x].sigla.localeCompare(D.ufs[y].sigla));
    const setOrd = D.setores.map((x, i) => i).sort((x, y) => D.setores[x].curto.localeCompare(D.setores[y].curto, 'pt'));
    el.style.gridTemplateColumns = `150px repeat(${nU}, minmax(20px, 1fr))`;
    let html = '<div></div>' + ufsOrd.map(u => `<div class="h${u === st.uf ? ' sel' : ''}">${D.ufs[u].sigla}</div>`).join('');
    for (const s of setOrd) {
      const r = SA(a, s, med);
      html += `<div class="r${s === st.setor ? ' sel' : ''}" data-s="${s}">${D.setores[s].curto}</div>`;
      for (const u of ufsOrd) {
        const c = cubo[a][s][u], v = porPessoa(c, med), ok = r.ok && c && c.po >= MIN_PO && v != null;
        const sel = s === st.setor && u === st.uf ? ' sel' : '';
        html += ok ? `<button type="button" class="c${sel}" style="background:${cor(v / r.p50)}" data-s="${s}" data-u="${u}" aria-label="${D.setores[s].curto}, ${D.ufs[u].sigla}"></button>` : `<div class="c nd${sel}" data-s="${s}" data-u="${u}"></div>`;
      }
    }
    el.innerHTML = html;
    el.querySelectorAll('.r').forEach(x => x.onclick = () => { st.setor = +x.dataset.s; render(); });
    el.querySelectorAll('.c').forEach(x => {
      const s = +x.dataset.s, u = +x.dataset.u, c = cubo[a][s][u], r = SA(a, s, med), v = porPessoa(c, med);
      if (!x.classList.contains('nd')) x.onclick = () => { st.setor = s; st.uf = u; render(); };
      x.onmousemove = e => mostra(e, `<b>${D.setores[s].curto} · ${D.ufs[u].nome}</b><br>` + (x.classList.contains('nd')
        ? (!c ? 'sem fábrica com 5+ pessoas' : v == null ? 'omitido pelo IBGE (sigilo)' : !r.ok ? 'setor com poucos estados para comparar' : `só ${nf(c.po)} pessoas: fora da comparação`)
        : `${milR(v)} por pessoa<br>${pct(v / r.p50 - 1)} vs. mediana do setor (${milR(r.p50)})<br>${pessoas(c.po)} pessoas`));
      x.onmouseleave = esconde;
    });
  }

  // gráficos de linha (SVG)
  function linhas(svg, series, { yFmt, yMin, yMax, banda, ref, passo }) {
    const W = 640, H = 230, m = { l: 40, r: 12, t: 12, b: 24 };
    const X = i => m.l + (W - m.l - m.r) * i / (D.anos.length - 1), Y = v => m.t + (H - m.t - m.b) * (1 - (v - yMin) / (yMax - yMin));
    let g = `<svg viewBox="0 0 ${W} ${H}">`;
    for (let v = yMin; v <= yMax + 1e-9; v += passo) { g += `<line class="rule" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${m.l - 6}" y="${Y(v) + 3}" text-anchor="end">${yFmt(v)}</text>`; }
    D.anos.forEach((ano, i) => { if (i % 2 === 0) g += `<text class="axis" x="${X(i)}" y="${H - 6}" text-anchor="middle">${ano}</text>`; });
    if (banda) {
      const pts = banda.map((b, i) => b && [i, b]).filter(Boolean);
      if (pts.length) g += `<path d="M${pts.map(([i, b]) => X(i) + ',' + Y(b[1])).join('L')}L${pts.reverse().map(([i, b]) => X(i) + ',' + Y(b[0])).join('L')}Z" fill="#dfe6f3"/>`;
    }
    if (ref != null) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="#ca7820" stroke-width="1.5"/>`;
    for (const sr of series) {
      let d = '', pen = false;
      sr.v.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; });
      g += `<path d="${d}" fill="none" stroke="${sr.cor}" stroke-width="${sr.w || 2.4}" ${sr.dash ? 'stroke-dasharray="4 3"' : ''}/>`;
      sr.v.forEach((v, i) => { if (v != null && (i === D.anos.length - 1 || i === st.ano)) g += `<circle cx="${X(i)}" cy="${Y(v)}" r="${i === st.ano ? 4.5 : 3}" fill="${sr.cor}" stroke="#fff" stroke-width="1.5"/>`; });
    }
    g += `<line x1="${X(st.ano)}" x2="${X(st.ano)}" y1="${m.t}" y2="${H - m.b}" stroke="#8aa0c2" stroke-dasharray="2 3"/>`;
    svg.outerHTML = g.replace('<svg ', `<svg id="${svg.id}" role="img" aria-label="${svg.getAttribute('aria-label')}" `) + '</svg>';
  }
  function renderEvo() {
    const s = st.setor, u = st.uf, med = st.med;
    $('tEvo').textContent = `${D.ufs[u].nome} em ${D.setores[s].curto.toLowerCase()}, 2007–2023`;
    const v = [], banda = [];
    D.anos.forEach((_, a) => {
      const r = SA(a, s, med), c = cubo[a][s][u], x = porPessoa(c, med);
      v.push(r.ok && c && c.po >= MIN_PO && x != null ? x / r.p50 * 100 : null);
      banda.push(r.ok ? [r.p25 / r.p50 * 100, r.p75 / r.p50 * 100] : null);
    });
    const tudo = [...v.filter(x => x != null), ...banda.filter(Boolean).flat(), 100];
    const yMin = Math.max(0, Math.floor(Math.min(...tudo) / 20) * 20), yMax = Math.ceil(Math.max(...tudo) / 20) * 20;
    const nOk = v.filter(x => x != null).length;
    $('evoSub').textContent = nOk ? `Mediana dos estados = 100. Razão entre valores do mesmo ano, então a inflação não entra. ${nOk} de ${D.anos.length} anos com dado.` : 'Sem anos com dado comparável para este estado neste setor.';
    linhas($('svgEvo'), [{ v, cor: '#2563d5' }], { yFmt: x => nf(x), yMin, yMax, banda, ref: 100, passo: 20 });
  }
  function renderFolha() {
    const s = st.setor, u = st.uf;
    const set = D.anos.map((_, a) => { const f = folhaBR(a, s); return f == null ? null : f * 100; });
    const est = D.anos.map((_, a) => { const c = cubo[a][s][u]; return c && c.folha != null && c.vti > 0 && c.po >= MIN_PO ? c.folha / c.vti * 100 : null; });
    const ind = D.anos.map((_, a) => folhaInd(a) * 100);
    const tudo = [...set, ...est, ...ind].filter(x => x != null && isFinite(x));
    const yMin = Math.max(0, Math.floor(Math.min(...tudo) / 10) * 10), yMax = Math.min(150, Math.ceil(Math.max(...tudo) / 10) * 10);
    linhas($('svgFol'), [{ v: ind, cor: '#8392aa', w: 1.6, dash: true }, { v: set, cor: '#7851be' }, { v: est.map(x => x == null ? null : Math.min(x, yMax)), cor: '#ca7820' }], { yFmt: x => 'R$ ' + nf(x), yMin, yMax, passo: 10 });
  }

  function renderCalc() {
    const a = st.ano, s = st.setor, med = st.med, r = SA(a, s, med), ano = D.anos[a];
    $('cValRot').textContent = (med === 'vti' ? 'VTI' : 'Receita líquida') + ' no ano (R$ milhões)';
    $('calcSub').textContent = `Compare com ${D.setores[s].curto.toLowerCase()} em ${ano}, em reais de ${ano}.`;
    if (!r.ok) {
      ['cPor', 'cMed', 'cQ3'].forEach(k => $(k).textContent = '—'); $('cPos').textContent = 'setor sem comparação neste ano';
      $('regua').innerHTML = ''; $('reguaTxt').innerHTML = ''; return;
    }
    if (!st.calcEditado) { $('cPes').value = 200; $('cVal').value = (r.p25 * 200 / 1000).toFixed(1); }
    const p = +$('cPes').value, val = +$('cVal').value * 1000; // mil R$
    if (!(p > 0) || !(val >= 0)) { ['cPor', 'cMed', 'cQ3'].forEach(k => $(k).textContent = '—'); $('cPos').textContent = 'preencha pessoas e valor'; return; }
    const pp = val / p;
    $('cPor').textContent = milR(pp);
    const abaixo = r.lista.filter(x => x.v < pp).length;
    $('cPos').textContent = `acima de ${abaixo} dos ${r.lista.length} estados do setor`;
    const dM = (r.p50 - pp) * p, dQ = (r.p75 - pp) * p;
    $('cMed').textContent = dM > 0 ? '+ ' + reais(dM) : 'já acima';
    $('cQ3').textContent = dQ > 0 ? '+ ' + reais(dQ) : 'já no quartil de cima';
    const lo = Math.min(r.lista.reduce((m, x) => Math.min(m, x.v), Infinity), pp), hi = Math.max(r.lista.reduce((m, x) => Math.max(m, x.v), 0), pp);
    const L = v => ((v - lo) / (hi - lo || 1) * 100).toFixed(2) + '%';
    $('regua').innerHTML = `<div class="faixa" style="left:0;right:0"></div><div class="faixa" style="left:${L(r.p25)};width:calc(${L(r.p75)} - ${L(r.p25)});background:#b9cbea"></div>`
      + `<div class="q" style="left:${L(r.p25)}"></div><div class="q m" style="left:${L(r.p50)}"></div><div class="q" style="left:${L(r.p75)}"></div><div class="voce" style="left:${L(pp)}" title="sua operação"></div>`;
    $('reguaTxt').innerHTML = `<span>${milR(lo)}</span><span>Q1 ${milR(r.p25)} · mediana ${milR(r.p50)} · Q3 ${milR(r.p75)}</span><span>${milR(hi)}</span>`;
  }

  render();
})();
