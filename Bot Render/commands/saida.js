/**
 * /saida [descrição] [valor]
 * Exemplo: /saida cinema 42,90
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/saida', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /saida [descrição] [valor]\nExemplo: /saida cinema 42.90'
    );
  }

  // Último token é o valor, o resto é a descrição
  const partes    = text.split(/\s+/);
  const valorStr  = partes.pop().replace(',', '.');
  const descricao = partes.join(' ') || valorStr;
  const valor     = parseFloat(valorStr);

  if (isNaN(valor) || valor <= 0) {
    return ctx.reply('❌ Valor inválido. Use números, ex: /saida cinema 42.90');
  }

  const hoje  = new Date();
  const data  = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  try {
    await db.collection('banco').add({
      data,
      tipo: 'Saida',
      valor,
      descricao: partes.length > 0 ? partes.join(' ') : 'sem descrição'
    });

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(`✅ *Saída registrada!*\n📝 ${descricao}\n💸 ${valorFmt}\n📅 ${data.split('-').reverse().join('/')}`,
      { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar saída. Tente novamente.');
  }
};
