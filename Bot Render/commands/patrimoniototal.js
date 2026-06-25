/**
 * /patrimoniototal
 * Exibe todos os ativos do patrimônio (ativo, plataforma, valor) e o total
 */

module.exports = async (ctx, db) => {
  try {
    const snap   = await db.collection('patrimonio').get();
    const ativos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (ativos.length === 0) {
      return ctx.reply('❌ Nenhum ativo cadastrado no patrimônio.');
    }

    const fmt   = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const total = ativos.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);

    const linhas = ativos.map(a =>
      `  📌 *${a.nomeDoAtivo}* — ${a.plataforma}: ${fmt(parseFloat(a.valor) || 0)}`
    );

    ctx.reply(
      `🏦 *Patrimônio Total*\n\n` +
      linhas.join('\n') +
      `\n\n━━━━━━━━━━━━━━━━━\n💰 Total: *${fmt(total)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao consultar patrimônio. Tente novamente.');
  }
};
