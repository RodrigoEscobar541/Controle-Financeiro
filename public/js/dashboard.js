import { db } from './firebase-config.js';
import { fmtBRL, fmtDate, mesAtualId, idToLabel, mesAtualLabel } from './app.js';
import { carregarSecoesCustomizadas } from './section-templates.js';
import { metricaSecao } from './custom-sections.js';
import {
  collection, query, orderBy, where, limit, getDocs, doc, getDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ──────────────────────────────────────────────
// STATUS DO BOT (heartbeat sistema/status_bot)
// ──────────────────────────────────────────────
// O bot grava sistema/status_bot a cada ~1 min. Online = último batimento com
// menos de 3 min; senão, provavelmente caiu (ou a VPS reiniciou).
const STATUS_BOT_ONLINE_MS = 3 * 60_000;
let statusBotUnsub = null;
let statusBotData  = null;

function humanizarDesde(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function renderStatusBot() {
  const el = document.getElementById('status-bot');
  if (!el) return;
  if (!statusBotData?.atualizado_em) { el.hidden = true; return; }
  const desde  = Date.now() - Date.parse(statusBotData.atualizado_em);
  const online = desde < STATUS_BOT_ONLINE_MS;
  el.hidden = false;
  el.className = `status-bot ${online ? 'online' : 'offline'}`;
  const versao = statusBotData.versao ? ` · v${statusBotData.versao}` : '';
  const quando = online ? 'ativo agora' : `sem sinal ${humanizarDesde(desde)}`;
  const uptime = online && statusBotData.iniciado_em
    ? ` · no ar ${humanizarDesde(Date.now() - Date.parse(statusBotData.iniciado_em))}`
    : '';
  el.textContent = `${online ? '🟢 Bot online' : '🔴 Bot offline'} — ${quando}${uptime}${versao}`;
}

function iniciarStatusBot() {
  if (statusBotUnsub) return; // liga o listener uma vez só
  statusBotUnsub = onSnapshot(doc(db, 'sistema', 'status_bot'), snap => {
    statusBotData = snap.data() ?? null;
    renderStatusBot();
  });
  // "online" depende do tempo decorrido: reavalia sozinho para virar offline
  // mesmo sem chegar um snapshot novo.
  setInterval(renderStatusBot, 30_000);
}

// Limita 5 leituras por tabela e usa os dados cacheados no dashboard
export async function initDashboard() {
  iniciarStatusBot();
  await Promise.all([
    carregarUltimasSaidas(),
    carregarUltimasEntradas(),
    carregarOrcamentoMensal(),
    carregarOrcamentoProximoMes(),
    carregarContasCasaMes(),
    carregarTotalInvestimentos(),
    carregarDevoDeve(),
    carregarConsumoCarro('carro_abastecimento', 'dash-focus-kml', 'dash-focus-rskm'),
    carregarConsumoCarro('focus_abastecimento', 'dash-face-kml', 'dash-face-rskm'),
    renderCardsSecoesCustomizadas()
  ]);
}

// ──────────────────────────────────────────────
// CARDS DE SECTIONS CUSTOMIZADAS ("+ Nova Section")
// ──────────────────────────────────────────────
async function renderCardsSecoesCustomizadas() {
  const grid = document.getElementById('dashboard-grid');
  if (!grid) return;
  grid.querySelectorAll('[data-custom-card]').forEach(el => el.remove());
  const secoes = (await carregarSecoesCustomizadas()).filter(s => s.ativo);
  for (const secao of secoes) {
    await adicionarCardSecaoCustomizada(secao);
  }
}

export async function adicionarCardSecaoCustomizada(secao) {
  const grid = document.getElementById('dashboard-grid');
  if (!grid || grid.querySelector(`[data-custom-card="${secao.id}"]`)) return;

  let metrica;
  try { metrica = await metricaSecao(secao); } catch { metrica = null; }

  const card = document.createElement('div');
  card.dataset.customCard = secao.id;
  card.title = `Abrir ${secao.nome}`;
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('cf:ir-para-secao', { detail: { name: `custom-${secao.slug}` } }));
  });

  if (metrica?.secundaria) {
    card.className = 'card stat-card orcamento-duplo';
    card.innerHTML = `
      <div class="orcamento-item">
        <div class="stat-icon">${secao.icone || '📁'}</div>
        <div class="stat-info">
          <div class="stat-value">${metrica.principal.valor}</div>
          <div class="stat-label">${escDash(metrica.principal.label)}</div>
          <div class="stat-sub">${escDash(secao.nome)}</div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="orcamento-item">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <div class="stat-value">${metrica.secundaria.valor}</div>
          <div class="stat-label">${escDash(metrica.secundaria.label)}</div>
          <div class="stat-sub">Section customizada</div>
        </div>
      </div>`;
  } else {
    card.className = 'card stat-card';
    card.innerHTML = `
      <div class="stat-icon">${secao.icone || '📁'}</div>
      <div class="stat-info">
        <div class="stat-value">${metrica?.principal?.valor ?? '—'}</div>
        <div class="stat-label">${escDash(metrica?.principal?.label ?? secao.nome)}</div>
        <div class="stat-sub">${escDash(secao.nome)}${metrica?.sub ? ' · ' + escDash(metrica.sub) : ''}</div>
      </div>`;
  }

  grid.appendChild(card);
}

export function removerCardSecaoCustomizada(secaoId) {
  document.querySelector(`[data-custom-card="${secaoId}"]`)?.remove();
}

function escDash(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function carregarUltimasSaidas() {
  const tbody = document.querySelector('#dash-saidas tbody');
  try {
    const q = query(
      collection(db, 'banco'),
      orderBy('data', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    const saidas = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.tipo === 'Saida');

    if (saidas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhuma saída registrada</td></tr>';
      return;
    }
    tbody.innerHTML = saidas.map(s => `
      <tr>
        <td>${fmtDate(s.data)}</td>
        <td>${s.descricao}</td>
        <td class="text-right text-danger">${fmtBRL(s.valor)}</td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Erro ao carregar</td></tr>';
  }
}

async function carregarUltimasEntradas() {
  const tbody = document.querySelector('#dash-entradas tbody');
  try {
    const q = query(
      collection(db, 'banco'),
      orderBy('data', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    const entradas = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.tipo === 'Entrada');

    if (entradas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhuma entrada registrada</td></tr>';
      return;
    }
    tbody.innerHTML = entradas.map(e => `
      <tr>
        <td>${fmtDate(e.data)}</td>
        <td>${e.descricao}</td>
        <td class="text-right text-success">${fmtBRL(e.valor)}</td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Erro ao carregar</td></tr>';
  }
}

function proximoMesId() {
  const now     = new Date();
  const proximo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
}

async function carregarOrcamentoMensal() {
  const el      = document.getElementById('dash-orcamento');
  const labelEl = document.getElementById('dash-orcamento-label');
  try {
    const mesId = mesAtualId();
    if (labelEl) labelEl.textContent = idToLabel(mesId);
    const snap  = await getDoc(doc(db, 'distribuicao_mensal', mesId));
    if (!snap.exists()) { el.textContent = 'Não cadastrado'; return; }
    const total = Object.values(snap.data().colunas || {})
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);
    el.textContent = fmtBRL(total);
  } catch {
    el.textContent = '—';
  }
}

async function carregarOrcamentoProximoMes() {
  const el      = document.getElementById('dash-orcamento-proximo');
  const labelEl = document.getElementById('dash-orcamento-proximo-label');
  try {
    const mesId = proximoMesId();
    if (labelEl) labelEl.textContent = idToLabel(mesId);
    const snap  = await getDoc(doc(db, 'distribuicao_mensal', mesId));
    if (!snap.exists()) { el.textContent = 'Não cadastrado'; return; }
    const total = Object.values(snap.data().colunas || {})
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);
    el.textContent = fmtBRL(total);
  } catch {
    el.textContent = '—';
  }
}

async function carregarContasCasaMes() {
  const el = document.getElementById('dash-contas-casa');
  try {
    const mesId = mesAtualId();
    const docRef = doc(db, 'contas_casa', mesId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) { el.textContent = 'R$ 0,00'; return; }

    const data = snap.data();
    const total = Object.values(data.colunas || {})
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);
    el.textContent = fmtBRL(total);
  } catch {
    el.textContent = '—';
  }
}

async function carregarTotalInvestimentos() {
  const el = document.getElementById('dash-investimentos');
  try {
    const snap = await getDocs(collection(db, 'patrimonio'));
    const total = snap.docs.reduce((sum, d) => sum + (parseFloat(d.data().valor) || 0), 0);
    el.textContent = fmtBRL(total);
  } catch {
    el.textContent = '—';
  }
}

// Consumo médio (km/L e R$/km) dos últimos 100 abastecimentos de um carro
async function carregarConsumoCarro(colecao, idKmL, idRsKm) {
  const elKmL  = document.getElementById(idKmL);
  const elRsKm = document.getElementById(idRsKm);
  try {
    const q    = query(collection(db, colecao), orderBy('data', 'desc'), limit(100));
    const snap = await getDocs(q);

    const kmLValores  = [];
    const rsKmValores = [];
    snap.docs.forEach(d => {
      const item      = d.data();
      const correcao  = parseFloat(item.correcao) || 0;
      const kmEfetivo = (parseFloat(item.km) || 0) * (1 - correcao / 100);
      const litros    = parseFloat(item.litros) || 0;
      if (litros > 0 && kmEfetivo > 0)          kmLValores.push(kmEfetivo / litros);
      if (item.valorPago && kmEfetivo > 0)      rsKmValores.push((parseFloat(item.valorPago) * litros) / kmEfetivo);
    });

    elKmL.textContent  = kmLValores.length
      ? `${(kmLValores.reduce((s, v) => s + v, 0) / kmLValores.length).toFixed(2)} km/L`
      : '—';
    elRsKm.textContent = rsKmValores.length
      ? `${fmtBRL(rsKmValores.reduce((s, v) => s + v, 0) / rsKmValores.length)}/km`
      : '—';
  } catch {
    elKmL.textContent  = '—';
    elRsKm.textContent = '—';
  }
}

async function carregarDevoDeve() {
  const elDevo  = document.getElementById('dash-devo');
  const elDevem = document.getElementById('dash-devem');
  try {
    const q    = query(collection(db, 'dividas'), where('status', '==', 'Aberta'));
    const snap = await getDocs(q);
    let totalDevo  = 0;
    let totalDevem = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.tipo === 'Devo')  totalDevo  += parseFloat(data.valor) || 0;
      if (data.tipo === 'Devem') totalDevem += parseFloat(data.valor) || 0;
    });
    elDevo.textContent  = fmtBRL(totalDevo);
    elDevem.textContent = fmtBRL(totalDevem);
  } catch {
    elDevo.textContent  = '—';
    elDevem.textContent = '—';
  }
}
