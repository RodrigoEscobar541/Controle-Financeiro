require('dotenv').config();
const { Telegraf }    = require('telegraf');
const admin           = require('firebase-admin');
const cmdSaida        = require('./commands/saida');
const cmdEntrada      = require('./commands/entrada');
const cmdSaldo        = require('./commands/saldo');
const cmdAgente       = require('./commands/agente');

// ─── Firebase Admin ──────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
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
  `Olá! Esses são os comandos disponíveis:\n\n` +
  `/saida [descrição] [valor] — Registrar saída\n` +
  `/entrada [descrição] [valor] — Registrar entrada\n` +
  `/saldo — Ver saldo atual\n` +
  `/agente [pergunta] — Consultar o Agente IA\n\n` +
  `Exemplos:\n` +
  `/saida cinema 42.90\n` +
  `/entrada salário 8556\n` +
  `/agente qual foi meu gasto total este mês?`,
  { parse_mode: 'Markdown' }
));

bot.help(ctx => ctx.reply(
  `/saida [desc] [valor] — Registrar saída\n` +
  `/entrada [desc] [valor] — Registrar entrada\n` +
  `/saldo — Ver saldo atual\n` +
  `/agente [pergunta] — Agente IA financeiro`
));

bot.command('saida',   ctx => cmdSaida(ctx, db));
bot.command('entrada', ctx => cmdEntrada(ctx, db));
bot.command('saldo',   ctx => cmdSaldo(ctx, db));
bot.command('agente',  ctx => cmdAgente(ctx));

bot.on('text', ctx => ctx.reply(
  'Comando não reconhecido. Use /help para ver os comandos disponíveis.'
));

// ─── Start ───────────────────────────────────────────────────
bot.launch()
  .then(() => console.log('✅ Bot iniciado com sucesso!'))
  .catch(err => { console.error('Erro ao iniciar bot:', err); process.exit(1); });

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
