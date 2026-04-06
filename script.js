/* ================================================
   script.js — DataViz · Análise de Dados
================================================ */

/* ================================================
   ESTADO GLOBAL
================================================ */
let rawData     = [];
let columns     = [];
let filteredData = [];
let sortCol     = null;
let sortDir     = 1;
let currentPage = 1;
let visibleCols = [];
let charts      = {};
let lineType    = 'line';

const PAGE_SIZE = 20;
const PALETTE   = ['#3d82f6','#22d3a5','#f97316','#a855f7','#f43f5e','#eab308','#06b6d4','#84cc16'];

/* ================================================
   DATASETS DE EXEMPLO
================================================ */
const samples = {

  vendas: {
    name: 'vendas_2024.csv',
    data: (() => {
      const rows    = [];
      const produtos = ['Notebook','Smartphone','Tablet','Monitor','Teclado','Mouse','Headset','Webcam'];
      const regioes  = ['Sul','Norte','Sudeste','Nordeste','Centro-Oeste'];
      const meses    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      for (let i = 0; i < 200; i++) {
        rows.push({
          id:         i + 1,
          mes:        meses[i % 12],
          produto:    produtos[Math.floor(Math.random() * produtos.length)],
          regiao:     regioes[Math.floor(Math.random() * regioes.length)],
          quantidade: Math.floor(Math.random() * 100) + 1,
          preco_unit: Math.round((Math.random() * 2000 + 200) * 100) / 100,
          desconto:   Math.round(Math.random() * 0.3 * 100) / 100,
          receita:    null
        });
        rows[i].receita = Math.round(rows[i].quantidade * rows[i].preco_unit * (1 - rows[i].desconto) * 100) / 100;
      }
      return rows;
    })()
  },

  financeiro: {
    name: 'financeiro_2024.csv',
    data: (() => {
      const rows      = [];
      const categorias = ['Receita','Despesa Fixa','Despesa Variável','Investimento','Imposto'];
      const meses      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      for (let i = 0; i < 120; i++) {
        const cat = categorias[Math.floor(Math.random() * categorias.length)];
        const val = cat === 'Receita'
          ?  Math.round(Math.random() * 50000 + 10000)
          : -Math.round(Math.random() * 20000 + 1000);
        rows.push({
          id:         i + 1,
          mes:        meses[i % 12],
          trimestre:  `Q${Math.floor((i % 12) / 3) + 1}`,
          categoria:  cat,
          valor:      val,
          acumulado:  0
        });
      }
      let acc = 0;
      rows.forEach(r => { acc += r.valor; r.acumulado = acc; });
      return rows;
    })()
  },

  rh: {
    name: 'colaboradores_rh.csv',
    data: (() => {
      const rows   = [];
      const depts  = ['Engenharia','Marketing','Vendas','RH','Produto','Jurídico','Financeiro'];
      const cargos = ['Analista','Sênior','Pleno','Júnior','Gerente','Coordenador','Diretor'];
      const status = ['Ativo','Férias','Licença'];
      for (let i = 0; i < 150; i++) {
        rows.push({
          id:            i + 1,
          nome:          `Colaborador ${i + 1}`,
          departamento:  depts[Math.floor(Math.random() * depts.length)],
          cargo:         cargos[Math.floor(Math.random() * cargos.length)],
          salario:       Math.round(Math.random() * 18000 + 3000),
          anos_empresa:  Math.floor(Math.random() * 15),
          status:        status[Math.floor(Math.random() * status.length)],
          avaliacao:     Math.round(Math.random() * 4 + 1 * 10) / 10
        });
      }
      return rows;
    })()
  },

  ecommerce: {
    name: 'ecommerce_pedidos.csv',
    data: (() => {
      const rows      = [];
      const cats      = ['Eletrônicos','Moda','Casa','Esporte','Beleza','Livros','Alimentos'];
      const status    = ['Entregue','Enviado','Processando','Cancelado','Devolvido'];
      const pagamentos = ['Cartão','Boleto','PIX','Parcelado'];
      for (let i = 0; i < 300; i++) {
        rows.push({
          pedido_id:    10000 + i,
          categoria:    cats[Math.floor(Math.random() * cats.length)],
          valor:        Math.round(Math.random() * 1500 + 30),
          frete:        Math.round(Math.random() * 40 + 8),
          status:       status[Math.floor(Math.random() * status.length)],
          pagamento:    pagamentos[Math.floor(Math.random() * pagamentos.length)],
          avaliacao:    Math.floor(Math.random() * 5) + 1,
          dias_entrega: Math.floor(Math.random() * 14) + 1
        });
      }
      return rows;
    })()
  }
};

/* ================================================
   UPLOAD & PARSE
================================================ */
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => parseCSV(ev.target.result, file.name);
  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text, name) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  processData(result.data, name);
}

function loadSample(key) {
  document.querySelectorAll('.sample-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const s = samples[key];
  processData(s.data, s.name);
}

/* ================================================
   PROCESSAR DADOS
================================================ */
function processData(data, name) {
  rawData      = data;
  filteredData = [...data];
  columns      = Object.keys(data[0] || {});
  visibleCols  = columns.slice(0, Math.min(8, columns.length));
  sortCol      = null;
  currentPage  = 1;

  document.getElementById('dashboard').style.display  = 'block';
  document.getElementById('uploadZone').style.display = 'none';
  document.querySelector('.sample-section').style.marginBottom = '0';

  updateInfoBar(name);
  renderMetrics();
  renderCharts();
  renderColStats();
  renderColSelector();
  renderTable();
}

/* ================================================
   BARRA DE INFORMAÇÕES
================================================ */
function updateInfoBar(name) {
  const numCols = columns.filter(c => typeof rawData[0][c] === 'number').length;
  const strCols = columns.length - numCols;
  let nulls = 0;
  rawData.forEach(row => {
    columns.forEach(c => {
      if (row[c] === null || row[c] === '' || row[c] === undefined) nulls++;
    });
  });

  document.getElementById('infoRows').textContent = rawData.length.toLocaleString('pt-BR');
  document.getElementById('infoCols').textContent = columns.length;
  document.getElementById('infoNum').textContent  = numCols;
  document.getElementById('infoStr').textContent  = strCols;
  document.getElementById('infoNull').textContent = nulls;
  document.getElementById('infoFile').textContent = name || 'desconhecido';
}

/* ================================================
   MÉTRICAS
================================================ */
function renderMetrics() {
  const numCols  = columns.filter(c => typeof rawData[0][c] === 'number');
  const container = document.getElementById('metricsGrid');
  container.innerHTML = '';
  const colors = ['blue','green','orange','purple'];

  numCols.slice(0, 4).forEach((col, i) => {
    const vals = rawData.map(r => r[col]).filter(v => v !== null && !isNaN(v));
    const sum  = vals.reduce((a, b) => a + b, 0);
    const avg  = sum / vals.length;
    const max  = Math.max(...vals);
    const min  = Math.min(...vals);

    const card = document.createElement('div');
    card.className = `metric-card ${colors[i % 4]}`;
    card.innerHTML = `
      <div class="metric-label">${col}</div>
      <div class="metric-value">${fmt(sum)}</div>
      <div class="metric-sub">Média: ${fmt(avg)} · Máx: ${fmt(max)} · Mín: ${fmt(min)}</div>
    `;
    container.appendChild(card);
  });

  if (numCols.length === 0) {
    container.innerHTML = '<div style="color:var(--text3);font-size:13px;">Nenhuma coluna numérica encontrada.</div>';
  }
}

/* Formata número abreviado */
function fmt(n) {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Number.isInteger(n) ? n.toLocaleString('pt-BR') : n.toFixed(2);
}

/* ================================================
   GRÁFICOS — ORQUESTRADOR
================================================ */
function renderCharts() {
  const numCols = columns.filter(c => typeof rawData[0][c] === 'number');
  const strCols = columns.filter(c => typeof rawData[0][c] === 'string');
  renderLineChart(numCols);
  renderDonutChart(strCols);
  renderHistogram(numCols);
  renderBarChart(strCols);
  renderScatter(numCols);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* ---- Linha / Barras / Área ---- */
function toggleLineType(type, btn) {
  lineType = type;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const numCols = columns.filter(c => typeof rawData[0][c] === 'number');
  renderLineChart(numCols);
}

function renderLineChart(numCols) {
  destroyChart('line');
  if (!numCols.length) return;

  const col  = numCols[0];
  const step = Math.max(1, Math.floor(rawData.length / 60));
  const vals  = rawData.filter((_, i) => i % step === 0).map(r => r[col]);
  const labels = vals.map((_, i) => `#${i * step + 1}`);
  const fill   = lineType === 'area';

  document.getElementById('lineChartSub').textContent = col;

  charts['line'] = new Chart(document.getElementById('lineChart'), {
    type: lineType === 'area' ? 'line' : lineType,
    data: {
      labels,
      datasets: [{
        label:           col,
        data:            vals,
        borderColor:     '#3d82f6',
        backgroundColor: fill ? 'rgba(61,130,246,0.12)' : '#3d82f6',
        fill,
        tension:         0.3,
        pointRadius:     0,
        borderWidth:     2,
        barThickness:    'flex'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5c6078', font: { size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5c6078', font: { size: 10 }, callback: v => fmt(v) }
        }
      }
    }
  });
}

/* ---- Rosca ---- */
function renderDonutChart(strCols) {
  destroyChart('donut');
  if (!strCols.length) return;

  const col  = strCols[0];
  const freq = {};
  rawData.forEach(r => { const v = r[col] || '(vazio)'; freq[v] = (freq[v] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  document.getElementById('donutChartSub').textContent = col;

  charts['donut'] = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{
        data:            sorted.map(s => s[1]),
        backgroundColor: PALETTE,
        borderWidth:     0,
        hoverOffset:     8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b8fa8', font: { size: 11 }, boxWidth: 10, padding: 8 }
        }
      }
    }
  });
}

/* ---- Histograma ---- */
function renderHistogram(numCols) {
  destroyChart('hist');
  if (!numCols.length) return;

  const col  = numCols[0];
  const vals = rawData.map(r => r[col]).filter(v => v !== null && !isNaN(v));
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const bins = 12;
  const size = (max - min) / bins;
  const counts = Array(bins).fill(0);

  vals.forEach(v => {
    let b = Math.floor((v - min) / size);
    if (b >= bins) b = bins - 1;
    counts[b]++;
  });

  const labels = counts.map((_, i) => fmt(min + i * size));
  document.getElementById('histSub').textContent = col;

  charts['hist'] = new Chart(document.getElementById('histChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data:            counts,
        backgroundColor: 'rgba(61,130,246,0.7)',
        borderColor:     '#3d82f6',
        borderWidth:     1,
        borderRadius:    3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#5c6078', font: { size: 10 }, maxTicksLimit: 6 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5c6078', font: { size: 10 } }
        }
      }
    }
  });
}

/* ---- Barras horizontais (top categorias) ---- */
function renderBarChart(strCols) {
  destroyChart('bar');
  if (!strCols.length) return;

  const col  = strCols[strCols.length > 1 ? 1 : 0];
  const freq = {};
  rawData.forEach(r => { const v = r[col] || '(vazio)'; freq[v] = (freq[v] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  document.getElementById('barSub').textContent = col;

  charts['bar'] = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{
        data:            sorted.map(s => s[1]),
        backgroundColor: PALETTE,
        borderRadius:    4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5c6078', font: { size: 10 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#8b8fa8', font: { size: 11 } }
        }
      }
    }
  });
}

/* ---- Scatter / Correlação ---- */
function renderScatter(numCols) {
  destroyChart('scatter');
  if (numCols.length < 2) return;

  const sel  = document.getElementById('scatterX');
  sel.innerHTML = numCols.map(c => `<option value="${c}">${c}</option>`).join('');

  const colX = numCols[0];
  const colY = numCols[1];
  document.getElementById('scatterSub').textContent = `${colX} vs ${colY}`;

  const pts = rawData
    .filter(r => r[colX] != null && r[colY] != null)
    .slice(0, 200)
    .map(r => ({ x: r[colX], y: r[colY] }));

  charts['scatter'] = new Chart(document.getElementById('scatterChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        data:            pts,
        backgroundColor: 'rgba(61,130,246,0.5)',
        pointRadius:     4,
        pointHoverRadius:6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5c6078', font: { size: 10 }, callback: v => fmt(v) }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5c6078', font: { size: 10 }, callback: v => fmt(v) }
        }
      }
    }
  });
}

function updateScatter() {
  const numCols = columns.filter(c => typeof rawData[0][c] === 'number');
  renderScatter(numCols);
}

/* ================================================
   ESTATÍSTICAS POR COLUNA
================================================ */
function renderColStats() {
  const grid = document.getElementById('colStatsGrid');
  grid.innerHTML = '';

  columns.forEach(col => {
    const vals     = rawData.map(r => r[col]);
    const nullCount = vals.filter(v => v === null || v === '' || v === undefined).length;
    const nullPct  = Math.round(nullCount / vals.length * 100);
    const isNum    = typeof rawData.find(r => r[col] !== null && r[col] !== '')?.[col] === 'number';

    const card = document.createElement('div');
    card.className = 'col-stat-card';

    if (isNum) {
      const nums   = vals.filter(v => v !== null && !isNaN(v));
      const sum    = nums.reduce((a, b) => a + b, 0);
      const avg    = sum / nums.length;
      const sorted = [...nums].sort((a, b) => a - b);
      const med    = sorted[Math.floor(sorted.length / 2)];
      const std    = Math.sqrt(nums.reduce((a, b) => a + (b - avg) ** 2, 0) / nums.length);

      card.innerHTML = `
        <div class="col-stat-name">${col}</div>
        <span class="col-stat-type">numérico</span>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="stat-row-label">Soma</span>
            <span class="stat-row-value">${fmt(sum)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Média</span>
            <span class="stat-row-value">${avg.toFixed(2)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Mediana</span>
            <span class="stat-row-value">${med?.toFixed(2) ?? '-'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Desvio Padrão</span>
            <span class="stat-row-value">${std.toFixed(2)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Mín / Máx</span>
            <span class="stat-row-value">${fmt(sorted[0])} / ${fmt(sorted[sorted.length - 1])}</span>
          </div>
        </div>
        <div class="null-bar-wrap">
          <div class="null-bar-label">Preenchimento: ${100 - nullPct}%</div>
          <div class="null-bar-bg">
            <div class="null-bar-fill" style="width:${100 - nullPct}%;background:var(--accent);"></div>
          </div>
        </div>`;
    } else {
      const noNull = vals.filter(v => v !== null && v !== '');
      const freq   = {};
      noNull.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      const uniq = Object.keys(freq).length;
      const top  = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      const topStr = top?.[0]?.toString() ?? '-';

      card.innerHTML = `
        <div class="col-stat-name">${col}</div>
        <span class="col-stat-type">texto</span>
        <div class="stat-rows">
          <div class="stat-row">
            <span class="stat-row-label">Valores únicos</span>
            <span class="stat-row-value">${uniq}</span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Mais frequente</span>
            <span class="stat-row-value" title="${topStr}">
              ${topStr.slice(0, 12)}${topStr.length > 12 ? '…' : ''}
            </span>
          </div>
          <div class="stat-row">
            <span class="stat-row-label">Frequência top</span>
            <span class="stat-row-value">${top?.[1] ?? '-'}</span>
          </div>
        </div>
        <div class="null-bar-wrap">
          <div class="null-bar-label">Preenchimento: ${100 - nullPct}%</div>
          <div class="null-bar-bg">
            <div class="null-bar-fill" style="width:${100 - nullPct}%;background:var(--accent2);"></div>
          </div>
        </div>`;
    }

    grid.appendChild(card);
  });
}

/* ================================================
   TABELA DE DADOS
================================================ */
function renderColSelector() {
  const container = document.getElementById('colSelector');
  container.innerHTML = '<span class="section-label" style="font-size:11px;">Colunas:</span>';

  columns.forEach(col => {
    const chip = document.createElement('button');
    chip.className = 'col-chip' + (visibleCols.includes(col) ? ' active' : '');
    chip.textContent = col;
    chip.onclick = () => {
      if (visibleCols.includes(col)) {
        if (visibleCols.length > 1) visibleCols = visibleCols.filter(c => c !== col);
      } else {
        visibleCols.push(col);
      }
      chip.classList.toggle('active', visibleCols.includes(col));
      renderTable();
    };
    container.appendChild(chip);
  });
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  filteredData = rawData.filter(row =>
    columns.some(c => String(row[c] ?? '').toLowerCase().includes(q))
  );
  currentPage = 1;
  renderTable();
}

function changePage(delta) {
  const total = Math.ceil(filteredData.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(total, currentPage + delta));
  renderTable();
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  renderTable();
}

function renderTable() {
  let data = [...filteredData];

  if (sortCol) {
    data.sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir;
    });
  }

  const total = Math.ceil(data.length / PAGE_SIZE);
  document.getElementById('pageInfo').textContent  = `${currentPage} / ${Math.max(1, total)}`;
  document.getElementById('prevBtn').disabled = currentPage <= 1;
  document.getElementById('nextBtn').disabled = currentPage >= total;

  const page = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Cabeçalho
  document.getElementById('tableHead').innerHTML = `
    <tr>
      ${visibleCols.map(c => `
        <th class="${sortCol === c ? (sortDir === 1 ? 'sort-asc' : 'sort-desc') : ''}"
            onclick="sortBy('${c}')">${c}</th>
      `).join('')}
    </tr>`;

  // Corpo
  const tbody = document.getElementById('tableBody');
  if (!page.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="999" style="text-align:center;color:var(--text3);padding:40px;">
          Nenhum resultado encontrado
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = page.map(row => `
    <tr>
      ${visibleCols.map(c => {
        const v = row[c];
        if (v === null || v === undefined || v === '') return `<td><span class="null-tag">null</span></td>`;
        if (typeof v === 'number') return `<td class="num">${v.toLocaleString('pt-BR')}</td>`;
        const str = String(v);
        return `<td title="${str}">${str.slice(0, 40)}${str.length > 40 ? '…' : ''}</td>`;
      }).join('')}
    </tr>
  `).join('');
}

/* ================================================
   EXPORTAR CSV
================================================ */
function exportCSV() {
  if (!filteredData.length) return;
  const csv = [
    columns.join(','),
    ...filteredData.map(row =>
      columns.map(c => {
        const v = row[c];
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : (v ?? '');
      }).join(',')
    )
  ].join('\n');

  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'export_dataviz.csv';
  a.click();
}

/* ================================================
   DRAG & DROP
================================================ */
const zone = document.getElementById('uploadZone');

zone.addEventListener('dragover', e => {
  e.preventDefault();
  zone.classList.add('drag-over');
});

zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file?.name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = ev => parseCSV(ev.target.result, file.name);
    reader.readAsText(file, 'UTF-8');
  }
});

/* ================================================
   RELÓGIO NO FOOTER
================================================ */
function updateTime() {
  document.getElementById('footerTime').textContent = new Date().toLocaleString('pt-BR');
}

updateTime();
setInterval(updateTime, 30000);
