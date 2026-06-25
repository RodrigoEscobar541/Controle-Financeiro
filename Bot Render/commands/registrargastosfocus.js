/**
 * /registrargastosfocus [descrição] [valor]
 * Exemplo: /registrargastosfocus troca de óleo 250
 * Registra na coleção carro_feitos (section Focus)
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/registrargastosfocus', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /registrargastosfocus [descrição] [valor]\nExemplo: /registrargastosfocus troca de óleo 250'
    );
  }

  const partes   = text.split(/\s+/);
  const valorStr = partes.pop().replace(',', '.');
  const valor    = parseFloat(valorStr);

  if (isNaN(valor) || valor <= 0) {
    return ctx.reply('❌ Valor inválido. Ex: /registrargastosfocus troca de óleo 250');
  }

  const descricao = partes.join(' ') || 'sem descrição';
  const hoje      = new Date();
  const data      = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  try {
    await db.collection('carro_feitos').add({ data, descricao, valor });

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *Gasto Focus registrado!*\n📝 ${descricao}\n💸 ${valorFmt}\n📅 ${data.split('-').reverse().join('/')}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar gasto. Tente novamente.');
  }
};
