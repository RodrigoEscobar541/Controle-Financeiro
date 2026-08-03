/**
 * /registrarafazerface [descrição] [valor]
 * Exemplo: /registrarafazerface alinhar direção 350
 * Adiciona ao fim da fila na coleção face (tipo:'afazer', section Face)
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/registrarafazerface', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /registrarafazerface [descrição] [valor]\nExemplo: /registrarafazerface alinhar direção 350'
    );
  }

  const partes   = text.split(/\s+/);
  const valorStr = partes.pop().replace(',', '.');
  const valor    = parseFloat(valorStr);

  if (isNaN(valor) || valor < 0) {
    return ctx.reply('❌ Valor inválido. Ex: /registrarafazerface alinhar direção 350');
  }

  const descricao = partes.join(' ') || 'sem descrição';

  try {
    const snap = await db.collection('face').where('tipo', '==', 'afazer').get();
    const maxPrio    = snap.docs.reduce((max, d) => Math.max(max, d.data().prioridade || 0), 0);
    const prioridade = maxPrio + 1;

    await db.collection('face').add({ tipo: 'afazer', prioridade, descricao, valor });

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *A Fazer Face adicionado!*\n📝 ${descricao}\n💰 ${valorFmt}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar. Tente novamente.');
  }
};
