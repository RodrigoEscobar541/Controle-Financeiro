/**
 * /valortotalmesproximo
 * Exibe o total e o detalhamento de colunas do próximo mês em distribuicao_mensal
 */

module.exports = async (ctx, db) => {
  try {
    const now     = new Date();
    const proximo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const mesId   = `${proximo.getFullYear()}-${String(proximo.getMonth()+1).padStart(2,'0')}`;
    const snap    = await db.collection('distribuicao_mensal').doc(mesId).get();

    if (!snap.exists) {
      return ctx.reply(`❌ Nenhum dado para o próximo mês (${mesId}).`);
    }

    const cols   = snap.data().colunas || {};
    const fmt    = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    let total    = 0;
    const linhas = [];

    for (const [nome, col] of Object.entries(cols)) {
      const val = parseFloat(col.valor) || 0;
      total += val;
      linhas.push(`  ${nome}: *${fmt(val)}*`);
    }

    const mesLabel = proximo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    ctx.reply(
      `📊 *Distribuição — ${mesLabel}*\n\n` +
      (linhas.length > 0 ? linhas.join('\n') : '  Nenhuma coluna cadastrada.') +
      `\n\n━━━━━━━━━━━━━━━━━\n💰 Total: *${fmt(total)}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao consultar distribuição. Tente novamente.');
  }
};
