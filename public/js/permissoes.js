/**
 * Permissões — quem vê o quê
 *
 * Espelha, no front-end, o que `firestore.rules` garante no servidor.
 *
 * ⚠️  Este arquivo NÃO é segurança. Esconder um botão só evita que a pessoa
 *     tropece numa ação que ela não pode fazer — quem abrir o console do
 *     navegador continua barrado pelas regras, e é lá que a trava mora.
 *     Toda restrição escrita aqui precisa ter uma equivalente em
 *     `firestore.rules`; sozinha, aqui, ela não vale nada.
 *
 * DOIS PAPÉIS
 *   admin      → custom claim `admin: true` no token. Vê e edita tudo.
 *                Não custa leitura nenhuma: já vem dentro do token.
 *   convidado  → documento `permissoes/{uid}`:
 *                  { nome: "Bella", secoes: { "face": "escrita", … } }
 *                Section fora do mapa = não existe para ele.
 *
 * Definidos por `Bot Render/scripts/definir-acesso.js`.
 */

import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const SEM_ACESSO = 'nenhum';

let _admin   = false;
let _secoes  = {};    // slug -> "leitura" | "escrita"
let _nome    = '';
let _carregado = false;

/**
 * Carrega o papel do usuário logado. Precisa rodar ANTES de montar a sidebar
 * ou disparar qualquer query — senão o convidado vê a tela inteira por um
 * instante e as consultas quebram com "insufficient permissions".
 */
export async function carregarPermissoes(user) {
  _admin = false; _secoes = {}; _nome = ''; _carregado = false;
  if (!user) return;

  _nome = user.email || '';

  // 1) Admin? A resposta está no token, sem ida ao banco.
  try {
    let token = await getIdTokenResult(user);
    _admin = token.claims?.admin === true;

    // O claim pode ter sido definido DEPOIS do último login — nesse caso o
    // token em cache ainda é o antigo e a pessoa apareceria como convidada
    // sem entender por quê. Uma renovação forçada resolve na hora, em vez de
    // exigir sair e entrar de novo. Só acontece para quem não é admin pelo
    // token em cache, então o custo não recai no uso normal.
    if (!_admin) {
      token = await getIdTokenResult(user, true);
      _admin = token.claims?.admin === true;
    }
  } catch {
    _admin = false;   // na dúvida, o menos privilegiado
  }

  if (_admin) { _carregado = true; return; }

  // 2) Convidado: o que foi liberado para ele.
  try {
    const snap = await getDoc(doc(db, 'permissoes', user.uid));
    if (snap.exists()) {
      const dados = snap.data() || {};
      _secoes = dados.secoes || {};
      if (dados.nome) _nome = dados.nome;
    }
  } catch {
    _secoes = {};     // sem permissões legíveis = sem acesso
  }

  _carregado = true;
}

export function permissoesCarregadas() { return _carregado; }

export function ehAdmin() { return _admin; }

export function nomeUsuario() { return _nome; }

/** Nível numa section: "leitura" | "escrita" | "nenhum". */
export function nivelDe(slug) {
  if (_admin) return 'escrita';
  return _secoes[slug] || SEM_ACESSO;
}

export function podeVer(slug) {
  // O Dashboard é o ponto de entrada de todo mundo: ele nunca é bloqueado,
  // apenas mostra menos cards. Bloqueá-lo deixaria o convidado numa tela
  // em branco sem para onde ir.
  if (slug === 'dashboard') return true;
  return nivelDe(slug) !== SEM_ACESSO;
}

export function podeEditar(slug) {
  return nivelDe(slug) === 'escrita';
}

/** Slugs liberados, sem o dashboard. Usado para montar a sidebar. */
export function secoesLiberadas() {
  return Object.keys(_secoes);
}

/**
 * Conta autenticada que não é admin e não tem NENHUMA section liberada.
 * Acontece em dois casos, e vale distinguir da falha genérica:
 *   • usuário novo que ainda não recebeu acesso;
 *   • o próprio admin, se o front-end foi publicado antes de rodar
 *     `definir-acesso.js admin <uid>`.
 * Sem tratar isso, os dois viram uma tela em branco sem explicação.
 */
export function semAcessoNenhum() {
  return _carregado && !_admin && Object.keys(_secoes).length === 0;
}

/**
 * Coloca uma <section> em modo somente-leitura: esconde os botões de ação e
 * neutraliza os controles de edição. A classe é lida pelo CSS
 * (`.somente-leitura` em styles.css) e serve de bandeira para os módulos que
 * precisam saber disso na hora de montar handlers de clique.
 */
export function aplicarSomenteLeitura(secaoEl, slug) {
  if (!secaoEl) return;
  const bloquear = !podeEditar(slug);
  secaoEl.classList.toggle('somente-leitura', bloquear);
  return bloquear;
}
