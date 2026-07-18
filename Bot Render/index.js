require('dotenv').config();
const { Telegraf }    = require('telegraf');
const admin           = require('firebase-admin');
const cmdSaida        = require('./commands/saida');
const cmdEntrada      = require('./commands/entrada');
const cmdSaldo        = require('./commands/saldo');
const cmdRegGastosFocus       = require('./commands/registrargastosfocus');
const cmdRegGastosFace        = require('./commands/registrargastosface');
const cmdRegAfazerFocus       = require('./commands/registrarafazerfocus');
const cmdRegAfazerFace        = require('./commands/registrarafazerface');
const cmdValorMesAtual        = require('./commands/valortotalmesatual');
const cmdValorMesProximo      = require('./commands/valortotalmesproximo');
const cmdPatrimonioTotal      = require('./commands/patrimoniototal');
const cmdCriarColDist         = require('./commands/criarcolunadistribuicao');
const cmdCriarColCasa         = require('./commands/criarcolunacontascasa');
const cmdDevo                 = require('./commands/devo');
const cmdDevem                = require('./commands/devem');
const cmdAgente               = require('./commands/agente');

// ─── Firebase Admin ──────────────────────────────────────────
// Credencial da conta de serviço: prioriza o arquivo local
// serviceAccountKey.json (usado no VPS — JSON multi-linha, à prova de
// dotenv); se não existir, cai para a variável de ambiente
// FIREBASE_SERVICE_ACCOUNT (usada no Render / .env como JSON em uma linha).
const fs   = require('fs');
const path = require('path');
const caminhoChave = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = fs.existsSync(caminhoChave)
  ? require('./serviceAccountKey.json')
  : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── Bot ─────────────────────────────────────────────────────
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware: aceita apenas o chat autorizado (segurança básica)
const CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID_AUTORIZADO);
bot.use((ctx, next) => {
  if (CHAT_ID && ctx.chat?.id !== CHAT_ID) {
    return ctx.reply('❌ Acesso não autorizado.');
  }
  return next();
});

// ─── Comandos ────────────────────────────────────────────────
bot.start(ctx => ctx.reply(
  `💰 *Controle Financeiro Bot*\n\n` +
  `Olá! Use /help para ver todos os comandos.`,
  { parse_mode: 'Markdown' }
));

bot.help(ctx => ctx.reply(
  `📋 *Comandos disponíveis*\n\n` +
  `*Banco*\n` +
  `/saida [desc] [valor] — Registrar saída\n` +
  `/entrada [desc] [valor] — Registrar entrada\n` +
  `/saldo — Ver saldo atual\n\n` +
  `*Focus (carro)*\n` +
  `/registrargastosfocus [desc] [valor] — Registrar gasto feito\n` +
  `/registrarafazerfocus [desc] [valor] — Adicionar ao A Fazer\n\n` +
  `*Face*\n` +
  `/registrargastosface [desc] [valor] — Registrar gasto feito\n` +
  `/registrarafazerface [desc] [valor] — Adicionar ao A Fazer\n\n` +
  `*Distribuição*\n` +
  `/valortotalmesatual — Ver total do mês atual\n` +
  `/valortotalmesproximo — Ver total do próximo mês\n` +
  `/criarcolunadistribuicao [nome] [valor] — Criar coluna\n\n` +
  `*Contas da Casa*\n` +
  `/criarcolunacontascasa [nome] [valor] [Bella|Digo] — Criar conta\n\n` +
  `*Patrimônio*\n` +
  `/patrimoniototal — Ver patrimônio total\n\n` +
  `*Devo / Devem*\n` +
  `/devo [desc] [valor] [parcelas] — Registrar o que devo\n` +
  `/devem [desc] [valor] [parcelas] — Registrar o que me devem\n\n` +
  `*🤖 Agente IA*\n` +
  `/agente [mensagem] — Consultor financeiro com IA (Gemini)\n\n` +
  `Use os comandos acima para gerenciar suas finanças.`,
  { parse_mode: 'Markdown' }
));

bot.command('saida',                    ctx => cmdSaida(ctx, db));
bot.command('entrada',                  ctx => cmdEntrada(ctx, db));
bot.command('saldo',                    ctx => cmdSaldo(ctx, db));
bot.command('registrargastosfocus',     ctx => cmdRegGastosFocus(ctx, db));
bot.command('registrargastosface',      ctx => cmdRegGastosFace(ctx, db));
bot.command('registrarafazerfocus',     ctx => cmdRegAfazerFocus(ctx, db));
bot.command('registrarafazerface',      ctx => cmdRegAfazerFace(ctx, db));
bot.command('valortotalmesatual',       ctx => cmdValorMesAtual(ctx, db));
bot.command('valortotalmesproximo',     ctx => cmdValorMesProximo(ctx, db));
bot.command('patrimoniototal',          ctx => cmdPatrimonioTotal(ctx, db));
bot.command('criarcolunadistribuicao',  ctx => cmdCriarColDist(ctx, db));
bot.command('criarcolunacontascasa',    ctx => cmdCriarColCasa(ctx, db));
bot.command('devo',                     ctx => cmdDevo(ctx, db));
bot.command('devem',                    ctx => cmdDevem(ctx, db));
bot.command('agente',                   ctx => cmdAgente(ctx, db));

bot.on('text', ctx => ctx.reply(
  'Comando não reconhecido. Use /help para ver os comandos disponíveis.'
));

// ─── Health check para o Render ──────────────────────────────
const http = require('http');
http.createServer((req, res) => res.end('Bot está vivo!')).listen(process.env.PORT || 3000);

// ─── Heartbeat (status do bot para a dashboard) ──────────────
// O bot é orientado a eventos (long polling), sem loop próprio; então um
// setInterval grava um "batimento" no Firestore (sistema/status_bot) a cada
// ~1 min. A dashboard usa `atualizado_em` para mostrar o bot como online/offline
// — visibilidade do processo 24/7 na VPS, onde não há monitor externo.
const BOT_INICIADO_EM = new Date().toISOString();
const VERSAO_BOT = require('./package.json').version;
async function gravarStatusBot() {
  try {
    await db.collection('sistema').doc('status_bot').set({
      atualizado_em: new Date().toISOString(),
      iniciado_em: BOT_INICIADO_EM,
      versao: VERSAO_BOT,
    }, { merge: true });
  } catch (err) {
    console.error('Falha ao gravar status_bot:', err.message);
  }
}
gravarStatusBot();                      // primeiro batimento imediato
setInterval(gravarStatusBot, 60_000);   // depois, a cada 1 minuto

// ─── Start ───────────────────────────────────────────────────
bot.launch()
  .then(() => console.log('✅ Bot iniciado com sucesso!'))
  .catch(err => { console.error('Erro ao iniciar bot:', err); process.exit(1); });

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
