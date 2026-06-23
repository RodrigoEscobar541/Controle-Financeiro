/**
 * /entrada [descrição] [valor]
 * Exemplo: /entrada salário 8556
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/entrada', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /entrada [descrição] [valor]\nExemplo: /entrada salário 8556'
    );
  }

  const partes    = text.split(/\s+/);
  const valorStr  = partes.pop().replace(',', '.');
  const valor     = parseFloat(valorStr);

  if (isNaN(valor) || valor <= 0) {
    return ctx.reply('❌ Valor inválido. Use números, ex: /entrada salário 8556');
  }

  const descricao = partes.join(' ') || 'sem descrição';
  const hoje      = new Date();
  const data      = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  try {
    await db.collection('banco').add({ data, tipo: 'Entrada', valor, descricao });

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *Entrada registrada!*\n📝 ${descricao}\n💰 ${valorFmt}\n📅 ${data.split('-').reverse().join('/')}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar entrada. Tente novamente.');
  }
};
