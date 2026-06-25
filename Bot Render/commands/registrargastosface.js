/**
 * /registrargastosface [descrição] [valor]
 * Exemplo: /registrargastosface troca de pastilha 180
 * Registra na coleção focus_feitos (section Face)
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/registrargastosface', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /registrargastosface [descrição] [valor]\nExemplo: /registrargastosface troca de pastilha 180'
    );
  }

  const partes   = text.split(/\s+/);
  const valorStr = partes.pop().replace(',', '.');
  const valor    = parseFloat(valorStr);

  if (isNaN(valor) || valor <= 0) {
    return ctx.reply('❌ Valor inválido. Ex: /registrargastosface troca de pastilha 180');
  }

  const descricao = partes.join(' ') || 'sem descrição';
  const hoje      = new Date();
  const data      = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  try {
    await db.collection('focus_feitos').add({ data, descricao, valor });

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *Gasto Face registrado!*\n📝 ${descricao}\n💸 ${valorFmt}\n📅 ${data.split('-').reverse().join('/')}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar gasto. Tente novamente.');
  }
};
