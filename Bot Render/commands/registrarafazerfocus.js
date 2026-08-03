/**
 * /registrarafazerfocus [descrição] [valor]
 * Exemplo: /registrarafazerfocus revisão 60mil 800
 * Adiciona ao fim da fila na coleção focus (tipo:'afazer', section Focus)
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/registrarafazerfocus', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /registrarafazerfocus [descrição] [valor]\nExemplo: /registrarafazerfocus revisão 60mil 800'
    );
  }

  const partes   = text.split(/\s+/);
  const valorStr = partes.pop().replace(',', '.');
  const valor    = parseFloat(valorStr);

  if (isNaN(valor) || valor < 0) {
    return ctx.reply('❌ Valor inválido. Ex: /registrarafazerfocus revisão 60mil 800');
  }

  const descricao = partes.join(' ') || 'sem descrição';

  try {
    const snap = await db.collection('focus').where('tipo', '==', 'afazer').get();
    const maxPrio  = snap.docs.reduce((max, d) => Math.max(max, d.data().prioridade || 0), 0);
    const prioridade = maxPrio + 1;

    await db.collection('focus').add({ tipo: 'afazer', prioridade, descricao, valor });

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *A Fazer Focus adicionado!*\n📝 ${descricao}\n💰 ${valorFmt}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar. Tente novamente.');
  }
};
