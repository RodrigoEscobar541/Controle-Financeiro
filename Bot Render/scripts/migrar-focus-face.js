/**
 * Migração: consolida as 4 coleções de cada carro em 1 coleção com campo `tipo`.
 *
 *   carro_afazer + carro_feitos + carro_manutencao + carro_abastecimento  → focus
 *   focus_afazer + focus_feitos + focus_manutencao + focus_abastecimento → face
 *
 * Também migra qualquer section customizada criada a partir do template "carro"
 * (secoes_customizadas com template === 'carro'), de 4 coleções para 1.
 *
 * Não apaga nenhuma coleção antiga. Idempotente: usa doc IDs determinísticos
 * (`${tipo}_${idAntigo}`) com `.set({ merge: true })`, então rodar de novo não
 * duplica nada.
 *
 * Uso:
 *   cd "Bot Render"
 *   node scripts/migrar-focus-face.js            # migra (não apaga nada)
 *   node scripts/migrar-focus-face.js --apagar-antigas   # só depois de confirmar
 *                                                          # que tudo está certo
 */

const fs   = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const caminhoChave = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = fs.existsSync(caminhoChave)
  ? require(caminhoChave)
  : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// tipo → nome da coleção antiga, por prefixo ("carro" e "focus" são os prefixos hoje)
function colecoesAntigas(prefixo) {
  return {
    afazer:        `${prefixo}_afazer`,
    feito:         `${prefixo}_feitos`,
    manutencao:    `${prefixo}_manutencao`,
    abastecimento: `${prefixo}_abastecimento`
  };
}

const PARES_FIXOS = [
  { novaColecao: 'focus', antigas: colecoesAntigas('carro') },
  { novaColecao: 'face',  antigas: colecoesAntigas('focus') }
];

/** Migra um conjunto {tipo: nomeColecaoAntiga} para 1 coleção nova. Retorna contagem por tipo. */
async function migrarConjunto(novaColecao, antigasPorTipo) {
  const contagem = {};

  for (const [tipo, colecaoAntiga] of Object.entries(antigasPorTipo)) {
    const snap = await db.collection(colecaoAntiga).get();
    let batch = db.batch();
    let dentroDoBatch = 0;

    for (const docAntigo of snap.docs) {
      const refNovo = db.collection(novaColecao).doc(`${tipo}_${docAntigo.id}`);
      batch.set(refNovo, { ...docAntigo.data(), tipo }, { merge: true });
      dentroDoBatch++;

      if (dentroDoBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        dentroDoBatch = 0;
      }
    }

    if (dentroDoBatch > 0) await batch.commit();
    contagem[tipo] = snap.size;
  }

  return contagem;
}

/**
 * A chave interna da section "Focus" no menu mudou de 'carro' para 'focus'
 * (corrigindo o nome trocado). Isso afeta dois documentos que usavam essa
 * chave como ID:
 *   - notas/carro            → precisa virar notas/focus
 *   - config/secoes_ocultas  → o array `nomes` pode conter "carro" (se o
 *     usuário já tiver ocultado essa section); precisa virar "focus"
 * ('face' não muda — já era o nome correto.)
 */
async function migrarChaveSecaoFocus() {
  const notaAntiga = await db.collection('notas').doc('carro').get();
  if (notaAntiga.exists) {
    await db.collection('notas').doc('focus').set(notaAntiga.data(), { merge: true });
    console.log('✅ notas/carro migrado para notas/focus');
  } else {
    console.log('  Nenhuma nota em notas/carro para migrar.');
  }

  const ocultasRef  = db.collection('config').doc('secoes_ocultas');
  const ocultasSnap = await ocultasRef.get();
  const nomesAtuais = ocultasSnap.exists ? (ocultasSnap.data().nomes || []) : [];
  if (nomesAtuais.includes('carro')) {
    const nomesNovos = nomesAtuais.map(n => (n === 'carro' ? 'focus' : n));
    await ocultasRef.set({ nomes: nomesNovos }, { merge: true });
    console.log('✅ config/secoes_ocultas atualizado ("carro" → "focus")');
  } else {
    console.log('  config/secoes_ocultas não continha "carro" — nada a ajustar.');
  }
}

async function migrarSecoesCustomizadasCarro() {
  const snap = await db.collection('secoes_customizadas').where('template', '==', 'carro').get();
  const resultados = [];

  for (const doc of snap.docs) {
    const secao = doc.data();
    const colecoesAtuais = secao.colecoes || {};
    // buildColecoes do template "carro" gera: { afazer, feitos, manutencao, abastecimento }
    const antigasPorTipo = {
      afazer:        colecoesAtuais.afazer,
      feito:         colecoesAtuais.feitos,
      manutencao:    colecoesAtuais.manutencao,
      abastecimento: colecoesAtuais.abastecimento
    };

    if (Object.values(antigasPorTipo).some(v => !v)) {
      console.log(`  ⚠ Section customizada "${secao.nome}" (${doc.id}) já não está no formato antigo — pulando.`);
      continue;
    }

    const novaColecao = secao.slug;
    const contagem = await migrarConjunto(novaColecao, antigasPorTipo);
    await doc.ref.update({ colecoes: { principal: novaColecao } });

    resultados.push({
      nome: secao.nome,
      slug: novaColecao,
      contagem,
      colecoesAntigas: Object.values(antigasPorTipo)
    });
  }

  return resultados;
}

/**
 * Apaga as coleções antigas — SÓ rodar depois de confirmar que o site e o bot
 * novos estão lendo certinho das coleções novas. Desligado por padrão; exige
 * a flag --apagar-antigas.
 */
async function apagarColecoesAntigas(colecoesCustomizadasMigradas) {
  const nomes = [
    ...Object.values(colecoesAntigas('carro')),
    ...Object.values(colecoesAntigas('focus'))
  ];

  for (const secao of colecoesCustomizadasMigradas) {
    nomes.push(...secao.colecoesAntigas);
  }

  for (const nome of nomes) {
    console.log(`Apagando coleção antiga: ${nome} ...`);
    await db.recursiveDelete(db.collection(nome));
  }

  const notaAntiga = await db.collection('notas').doc('carro').get();
  if (notaAntiga.exists) {
    console.log('Apagando notas/carro (já migrado para notas/focus) ...');
    await notaAntiga.ref.delete();
  }
}

async function main() {
  const apagarAntigas = process.argv.includes('--apagar-antigas');

  console.log('── Migrando Focus/Face para coleção única com campo `tipo` ──');
  for (const { novaColecao, antigas } of PARES_FIXOS) {
    const contagem = await migrarConjunto(novaColecao, antigas);
    console.log(`✅ ${novaColecao}:`, contagem);
  }

  console.log('\n── Migrando chave da section Focus (carro → focus) ──');
  await migrarChaveSecaoFocus();

  console.log('\n── Migrando sections customizadas (template "carro") ──');
  const customsMigradas = await migrarSecoesCustomizadasCarro();
  if (customsMigradas.length === 0) {
    console.log('  Nenhuma section customizada do template "carro" encontrada.');
  } else {
    customsMigradas.forEach(s => console.log(`✅ ${s.nome} (${s.slug}):`, s.contagem));
  }

  if (apagarAntigas) {
    console.log('\n── Apagando coleções antigas (--apagar-antigas) ──');
    await apagarColecoesAntigas(customsMigradas);
    console.log('Concluído.');
  } else {
    console.log('\nNada foi apagado. As coleções antigas continuam intactas como backup.');
    console.log('Depois de confirmar que tudo está certo no site e no bot, rode:');
    console.log('  node scripts/migrar-focus-face.js --apagar-antigas');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
