/**
 * Registro de Sections — fixas e customizadas
 *
 * Estrutura Firestore:
 *
 *   Coleção: secoes_customizadas/{id}
 *     { nome, slug, template, icone, colecoes: {...}, criadoEm, origem: "web"|"agente",
 *       ativo: true|false, excluidoEm: null|ISOString }
 *
 *   Documento: config/secoes_ocultas
 *     { nomes: ["carro", "banco", ...] }  ← chaves de sections fixas ocultadas pelo usuário
 *
 * Excluir uma section NUNCA apaga dados: sections fixas só ganham uma entrada em
 * "secoes_ocultas" (a coleção original continua intocada) e sections customizadas
 * só têm `ativo` marcado como false (o documento em secoes_customizadas — e portanto
 * a referência às coleções que ela usava — continua no Firestore).
 */

import { db } from './firebase-config.js';
import {
  collection, query, where, doc, getDoc, getDocs, addDoc, updateDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ──────────────────────────────────────────────
// SECTIONS FIXAS (hard-coded em app.html)
// ──────────────────────────────────────────────
export const SECOES_FIXAS = [
  { key: 'banco',        label: 'Banco',        icon: '💳' },
  { key: 'distribuicao', label: 'Distribuição', icon: '📅' },
  { key: 'patrimonio',   label: 'Patrimônio',   icon: '💎' },
  { key: 'contas-casa',  label: 'Contas Casa',  icon: '🏠' },
  { key: 'carro',        label: 'Focus',        icon: '🚗' },
  { key: 'face',         label: 'Face',         icon: '🚙' },
  { key: 'devo-devem',   label: 'Devo / Devem', icon: '💸' }
];

const SECOES_FIXAS_KEYS = SECOES_FIXAS.map(s => s.key);

// ──────────────────────────────────────────────
// TEMPLATES DISPONÍVEIS PARA "+ Nova Section"
// ──────────────────────────────────────────────
export const TEMPLATES = {
  banco: {
    label: 'Banco',
    icon: '💳',
    desc: 'Extrato de entradas e saídas — como Banco, só que numa conta separada.',
    buildColecoes: slug => ({ principal: slug })
  },
  distribuicao: {
    label: 'Tabela Distribuição',
    icon: '📅',
    desc: 'Planilha mensal com colunas que você cadastra na hora — igual à Distribuição Mensal.',
    buildColecoes: slug => ({ mensal: `${slug}_mensal`, colunasConfig: `${slug}_colunas` })
  },
  patrimonio: {
    label: 'Patrimônio',
    icon: '💎',
    desc: 'Lista de ativos/investimentos com valor total — igual à section Patrimônio.',
    buildColecoes: slug => ({ principal: slug })
  },
  carro: {
    label: 'Novo Carro',
    icon: '🚗',
    desc: 'A Fazer, Feitos, Abastecimento e Manutenção Preventiva — igual a Focus/Face.',
    buildColecoes: slug => ({
      afazer:        `${slug}_afazer`,
      feitos:         `${slug}_feitos`,
      manutencao:     `${slug}_manutencao`,
      abastecimento:  `${slug}_abastecimento`
    })
  },
  'devo-devem': {
    label: 'Devo / Devem',
    icon: '💸',
    desc: 'Controle de dívidas parceladas — igual à section Devo e Devem.',
    buildColecoes: slug => ({ principal: slug })
  }
};

// ──────────────────────────────────────────────
// SLUG
// ──────────────────────────────────────────────
export function slugify(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

async function slugEmUso(slug) {
  if (SECOES_FIXAS_KEYS.includes(slug)) return true;
  const snap = await getDocs(query(collection(db, 'secoes_customizadas'), where('slug', '==', slug)));
  return !snap.empty;
}

// ──────────────────────────────────────────────
// SECTIONS CUSTOMIZADAS — CRUD
// ──────────────────────────────────────────────
export async function carregarSecoesCustomizadas() {
  const snap = await getDocs(collection(db, 'secoes_customizadas'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Cria uma nova section a partir de um template.
 * @param {{nome:string, template:string, origem?:string}} params
 * @returns {Promise<object>} documento criado (com id)
 */
export async function criarSecaoCustomizada({ nome, template, origem = 'web' }) {
  const tpl = TEMPLATES[template];
  if (!tpl) throw new Error(`Template "${template}" não existe.`);

  const nomeTrim = String(nome || '').trim();
  if (!nomeTrim) throw new Error('Informe um nome para a section.');
  if (nomeTrim.length > 40) throw new Error('Nome muito longo (máx. 40 caracteres).');

  const slug = slugify(nomeTrim);
  if (!slug) throw new Error('Nome inválido — use letras ou números.');

  if (await slugEmUso(slug)) {
    throw new Error(`Já existe uma section chamada "${nomeTrim}" (ou muito parecida). Escolha outro nome.`);
  }

  const payload = {
    nome: nomeTrim,
    slug,
    template,
    icone: tpl.icon,
    colecoes: tpl.buildColecoes(slug),
    criadoEm: new Date().toISOString(),
    origem,
    ativo: true,
    excluidoEm: null
  };

  const ref = await addDoc(collection(db, 'secoes_customizadas'), payload);
  return { id: ref.id, ...payload };
}

/** Soft-delete: marca como inativa, nunca apaga o documento nem as coleções de dados. */
export async function excluirSecaoCustomizada(id) {
  await updateDoc(doc(db, 'secoes_customizadas', id), {
    ativo: false,
    excluidoEm: new Date().toISOString()
  });
}

// ──────────────────────────────────────────────
// SECTIONS FIXAS — OCULTAR (equivalente a "excluir" sem apagar nada)
// ──────────────────────────────────────────────
function ocultasDocRef() {
  return doc(db, 'config', 'secoes_ocultas');
}

export async function carregarSecoesOcultas() {
  const snap = await getDoc(ocultasDocRef());
  return snap.exists() ? (snap.data().nomes || []) : [];
}

export async function ocultarSecaoFixa(key) {
  const atuais = await carregarSecoesOcultas();
  if (atuais.includes(key)) return;
  await setDoc(ocultasDocRef(), { nomes: [...atuais, key] }, { merge: true });
}
