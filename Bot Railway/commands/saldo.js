/**
 * /saldo
 * Retorna: total de entradas, total de saídas e saldo atual.
 */

module.exports = async (ctx, db) => {
  try {
    const snap = await db.collection('banco').get();
    let entradas = 0, saidas = 0;

    snap.docs.forEach(d => {
      const { tipo, valor } = d.data();
      if (tipo === 'Entrada') entradas += parseFloat(valor) || 0;
      if (tipo === 'Saida')   saidas   += parseFloat(valor) || 0;
    });

    const saldo = entradas - saidas;
    const fmt   = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    ctx.reply(
      `💰 *Saldo Atual*\n\n` +
      `📈 Entradas: *${fmt(entradas)}*\n` +
      `📉 Saídas:   *${fmt(saidas)}*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `${saldo >= 0 ? '✅' : '⚠️'} Saldo:    *${fmt(saldo)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao consultar saldo. Tente novamente.');
  }
};
