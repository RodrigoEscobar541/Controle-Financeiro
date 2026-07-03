import { db } from './firebase-config.js';
import { fmtBRL, fmtDate, mesAtualId, idToLabel, mesAtualLabel } from './app.js';
import {
  collection, query, orderBy, where, limit, getDocs, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Limita 5 leituras por tabela e usa os dados cacheados no dashboard
export async function initDashboard() {
  await Promise.all([
    carregarUltimasSaidas(),
    carregarUltimasEntradas(),
    carregarOrcamentoMensal(),
    carregarOrcamentoProximoMes(),
    carregarContasCasaMes(),
    carregarTotalInvestimentos(),
    carregarDevoDeve(),
    carregarConsumoCarro('carro_abastecimento', 'dash-focus-kml', 'dash-focus-rskm'),
    carregarConsumoCarro('focus_abastecimento', 'dash-face-kml', 'dash-face-rskm')
  ]);
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
      if (item.valorPago && kmEfetivo > 0)      rsKmValores.push(parseFloat(item.valorPago) / kmEfetivo);
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
