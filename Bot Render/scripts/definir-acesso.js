/**
 * Define quem é ADMIN e o que cada CONVIDADO pode ver no Controle Financeiro.
 *
 * ⚠️  ORDEM IMPORTA — LEIA ANTES DE RODAR:
 *   As regras em `firestore.rules` fecham tudo para quem não é admin.
 *   Se você publicar as regras ANTES de rodar este script, você fica
 *   trancado para fora do seu próprio app (o app abre vazio e o console
 *   do navegador mostra "Missing or insufficient permissions").
 *
 *   Sequência correta:
 *     1. node scripts/definir-acesso.js admin <SEU_UID>
 *     2. saia e entre de novo no app (o token só carrega o claim novo
 *        depois de renovado — logout/login resolve na hora)
 *     3. só então publique as regras (push para o main)
 *
 * ─────────────────────────────────────────────────────────────────
 * USO
 *
 *   cd "Bot Render"
 *
 *   # 1) Tornar alguém admin (vê e edita tudo, para sempre)
 *   node scripts/definir-acesso.js admin seu-email@gmail.com
 *
 *   # 2) Cadastrar/atualizar um convidado e o que ele enxerga
 *   node scripts/definir-acesso.js convidado bella@exemplo.com "Bella" \
 *        contas-casa:leitura face:escrita
 *
 *   # 3) Conferir o que está valendo hoje
 *   node scripts/definir-acesso.js listar
 *
 *   # 4) Remover um acesso (o convidado deixa de ver a section)
 *   node scripts/definir-acesso.js convidado bella@exemplo.com "Bella" face:nenhum
 *
 *   Onde o script pede <uid|email>, os dois servem. O UID sai no Firebase
 *   Console → Authentication → coluna "User UID"; o e-mail costuma ser mais
 *   fácil de acertar (um caractere errado no UID concede acesso a ninguém,
 *   silenciosamente).
 *
 *   Rodar de novo MESCLA: conceder uma section não revoga as já concedidas.
 *   Para tirar, use o nível `nenhum`.
 *
 * ─────────────────────────────────────────────────────────────────
 * ONDE CADA COISA FICA
 *   admin      → custom claim no token (`admin: true`). Não é documento,
 *                não custa leitura, e é o que as regras checam primeiro.
 *   convidado  → documento `permissoes/{uid}`:
 *                  { nome, secoes: { "face": "escrita", … }, atualizadoEm }
 *                Section ausente do mapa = sem acesso.
 */

// O .env fica na raiz de "Bot Render" — sem carregá-lo, rodar este script
// na sua máquina não acharia a credencial (só o VPS tem o
// serviceAccountKey.json em arquivo). É o mesmo que index.js faz.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const caminhoChave = path.join(__dirname, '..', 'serviceAccountKey.json');
const caminhoEnv   = path.join(__dirname, '..', '.env');

/**
 * O dotenv só entende valor multi-linha se ele estiver entre aspas. No .env
 * deste projeto o JSON da conta de serviço está "bonito", quebrado em várias
 * linhas e sem aspas — então process.env.FIREBASE_SERVICE_ACCOUNT chega com
 * apenas "{" e o JSON.parse morre.
 *
 * Em vez de exigir que o arquivo seja reformatado (mexer no .env é mexer no
 * que faz o bot subir), lemos o bloco na mão: da linha da variável até a
 * próxima variável. JSON.parse ignora quebras de linha entre os campos, então
 * basta concatenar.
 */
function credencialDoEnvBruto() {
  if (!fs.existsSync(caminhoEnv)) return null;

  const linhas = fs.readFileSync(caminhoEnv, 'utf8').split(/\r?\n/);
  const inicio = linhas.findIndex(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT='));
  if (inicio === -1) return null;

  const desaspar = (t) => (
    (t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))
  ) ? t.slice(1, -1) : t;

  // Vai acumulando linha a linha e tenta interpretar a cada passo, parando no
  // primeiro JSON completo. Adivinhar onde o bloco termina não funciona: logo
  // depois do "}" vêm linhas em branco e COMENTÁRIOS, que não parecem o começo
  // de outra variável e entrariam junto, quebrando o parse.
  const bloco = [linhas[inicio].slice('FIREBASE_SERVICE_ACCOUNT='.length)];
  for (let i = inicio; i < linhas.length; i++) {
    if (i > inicio) {
      if (/^[A-Z0-9_]+=/.test(linhas[i])) break;   // começou a próxima variável
      bloco.push(linhas[i]);
    }
    const texto = desaspar(bloco.join('\n').trim());
    if (!texto) continue;
    try { return JSON.parse(texto); } catch { /* ainda incompleto — segue */ }
  }

  return null;
}

function carregarCredencial() {
  if (fs.existsSync(caminhoChave)) return require(caminhoChave);

  const doEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (doEnv) {
    try { return JSON.parse(doEnv); } catch { /* cai para o parser manual */ }
  }

  const bruto = credencialDoEnvBruto();
  if (bruto) return bruto;

  console.error('\n❌ Credencial da conta de serviço não encontrada ou ilegível.');
  console.error('   É preciso um destes:');
  console.error(`   • o arquivo ${caminhoChave}`);
  console.error('   • FIREBASE_SERVICE_ACCOUNT no "Bot Render/.env" (JSON válido,');
  console.error('     em uma linha ou em várias — os dois funcionam)\n');
  process.exit(1);
}

const serviceAccount = carregarCredencial();

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const NIVEIS = ['leitura', 'escrita', 'nenhum'];

function abortar(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/**
 * Aceita UID ou e-mail. O e-mail é o que a pessoa sabe de cabeça; o UID
 * obriga a abrir o console do Firebase e copiar uma string de 28 caracteres
 * — e é exatamente aí que se erra um caractere e se concede acesso a
 * ninguém, sem nenhum aviso.
 */
async function resolverUsuario(ref) {
  if (!ref) abortar('Informe o UID ou o e-mail do usuário.');
  const buscar = ref.includes('@')
    ? admin.auth().getUserByEmail(ref)
    : admin.auth().getUser(ref);
  const user = await buscar.catch(() => null);
  if (!user) {
    abortar(`Nenhum usuário encontrado para "${ref}".\n` +
            '   Confira em Firebase Console → Authentication, ou rode:\n' +
            '   node scripts/definir-acesso.js listar');
  }
  return user;
}

// ── admin <uid> ───────────────────────────────────────────────────
async function definirAdmin(ref) {
  const user = await resolverUsuario(ref);

  // Preserva claims que já existam — sobrescrever o objeto inteiro apagaria
  // qualquer outro claim definido no futuro.
  await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });

  console.log(`\n✅ ${user.email || user.uid} agora é ADMIN.`);
  console.log('\n⚠️  Ele precisa SAIR e ENTRAR de novo no app — o token em uso');
  console.log('   ainda é o antigo e não carrega o claim novo.\n');
}

// ── convidado <uid> <nome> <slug:nivel>... ────────────────────────
async function definirConvidado(refUsuario, nome, pares) {
  if (!refUsuario || !nome) {
    abortar('Uso: node scripts/definir-acesso.js convidado <uid|email> "<nome>" slug:nivel [slug:nivel ...]');
  }

  const user = await resolverUsuario(refUsuario);
  if (user.customClaims?.admin === true) {
    abortar(`${user.email || user.uid} é ADMIN. Um admin já vê tudo — o documento\n` +
            '   de permissões seria ignorado. Remova o claim antes, se a intenção\n' +
            '   for rebaixá-lo a convidado.');
  }

  const ref      = db.collection('permissoes').doc(user.uid);
  const atual    = await ref.get();
  // Mescla com o que já existe: rodar o script de novo para conceder UMA
  // section não deve revogar as outras concedidas antes.
  const secoes   = atual.exists ? { ...(atual.data().secoes || {}) } : {};

  for (const par of pares) {
    const [slug, nivel] = par.split(':');
    if (!slug || !nivel) abortar(`"${par}" não está no formato slug:nivel (ex.: face:escrita).`);
    if (!NIVEIS.includes(nivel)) {
      abortar(`Nível "${nivel}" inválido em "${par}". Use: ${NIVEIS.join(', ')}.`);
    }
    if (nivel === 'nenhum') delete secoes[slug];
    else                    secoes[slug] = nivel;
  }

  await ref.set({ nome, secoes, atualizadoEm: new Date().toISOString() }, { merge: true });

  console.log(`\n✅ Convidado "${nome}" (${user.email || user.uid}) atualizado.`);
  console.log('   Sections liberadas:');
  const chaves = Object.keys(secoes);
  if (!chaves.length) console.log('     (nenhuma — ele entra e não vê nada além do Dashboard vazio)');
  else chaves.sort().forEach(s => console.log(`     • ${s.padEnd(20)} ${secoes[s]}`));
  console.log('');
}

// ── listar ────────────────────────────────────────────────────────
async function listar() {
  console.log('\n── ADMINS ────────────────────────────────────────────');
  const { users } = await admin.auth().listUsers(1000);
  const admins = users.filter(u => u.customClaims?.admin === true);
  if (!admins.length) {
    console.log('  ⚠️  NENHUM admin definido. Com as regras publicadas,');
    console.log('      ninguém consegue usar o app. Rode o comando "admin".');
  } else {
    admins.forEach(u => console.log(`  • ${u.email || '(sem e-mail)'}  ${u.uid}`));
  }

  console.log('\n── CONVIDADOS ────────────────────────────────────────');
  const snap = await db.collection('permissoes').get();
  if (snap.empty) {
    console.log('  (nenhum cadastrado)');
  } else {
    snap.docs.forEach(d => {
      const { nome, secoes = {} } = d.data();
      console.log(`  • ${nome || '(sem nome)'}  ${d.id}`);
      const chaves = Object.keys(secoes).sort();
      if (!chaves.length) console.log('      (nenhuma section liberada)');
      else chaves.forEach(s => console.log(`      ${s.padEnd(20)} ${secoes[s]}`));
    });
  }

  console.log('\n── USUÁRIOS SEM ACESSO NENHUM ────────────────────────');
  const semAcesso = users.filter(u =>
    u.customClaims?.admin !== true && !snap.docs.some(d => d.id === u.uid));
  if (!semAcesso.length) console.log('  (nenhum)');
  else semAcesso.forEach(u => console.log(`  • ${u.email || '(sem e-mail)'}  ${u.uid}`));
  console.log('');
}

// ── entrada ───────────────────────────────────────────────────────
(async () => {
  const [comando, ...resto] = process.argv.slice(2);

  try {
    if      (comando === 'admin')     await definirAdmin(resto[0]);
    else if (comando === 'convidado') await definirConvidado(resto[0], resto[1], resto.slice(2));
    else if (comando === 'listar')    await listar();
    else {
      console.log('\nComandos:');
      console.log('  node scripts/definir-acesso.js admin <uid|email>');
      console.log('  node scripts/definir-acesso.js convidado <uid|email> "<nome>" slug:nivel [...]');
      console.log('  node scripts/definir-acesso.js listar');
      console.log(`\nNíveis: ${NIVEIS.join(' | ')}\n`);
      process.exit(1);
    }
  } catch (err) {
    abortar(err.message);
  }
  process.exit(0);
})();
