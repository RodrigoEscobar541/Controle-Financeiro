/**
 * /devem [descrição] [valor] [parcelas]
 * Exemplo: /devem João empréstimo 500 3
 * Exemplo: /devem Pedro 200
 * Cria registro(s) na coleção dividas com tipo="Devem"
 * Se parcelas > 1, gera um documento por mês a partir do mês atual
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/devem', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /devem [descrição] [valor] [parcelas]\nExemplo: /devem João empréstimo 500 3\nExemplo: /devem Pedro 200'
    );
  }

  const partes = text.split(/\s+/);

  // Detecta parcelas: se últimos 2 tokens são ambos numéricos, o último é parcelas
  let parcelas = 1;
  if (
    partes.length >= 3 &&
    /^\d+$/.test(partes[partes.length - 1]) &&
    !isNaN(parseFloat(partes[partes.length - 2].replace(',', '.')))
  ) {
    parcelas = parseInt(partes.pop());
  }

  const valorStr  = partes.pop()?.replace(',', '.');
  const valor     = parseFloat(valorStr);
  const descricao = partes.join(' ') || 'sem descrição';

  if (isNaN(valor) || valor <= 0) {
    return ctx.reply('❌ Valor inválido. Ex: /devem João empréstimo 500 3');
  }
  if (parcelas < 1 || parcelas > 360) {
    return ctx.reply('❌ Número de parcelas inválido (1–360).');
  }

  try {
    const now          = new Date();
    const mesAtualNum  = now.getFullYear() * 100 + (now.getMonth() + 1);
    const mesInicio    = now.getMonth() + 1;
    const anoInicio    = now.getFullYear();
    const valorParcela = Math.round((valor / parcelas) * 100) / 100;

    const promises = [];
    for (let i = 0; i < parcelas; i++) {
      const totalMes  = mesInicio + i;
      const anoOffset = Math.floor((totalMes - 1) / 12);
      const mesReal   = ((totalMes - 1) % 12) + 1;
      const anoReal   = anoInicio + anoOffset;

      const data   = `${anoReal}-${String(mesReal).padStart(2, '0')}`;
      const docNum = anoReal * 100 + mesReal;
      const status = docNum < mesAtualNum ? 'Fechada' : 'Aberta';

      promises.push(db.collection('dividas').add({ tipo: 'Devem', data, descricao, valor: valorParcela, status }));
    }
    await Promise.all(promises);

    const fmt    = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const resumo = parcelas === 1
      ? `💵 ${fmt(valor)}`
      : `💵 ${fmt(valor)} em ${parcelas}x de ${fmt(valorParcela)}`;

    ctx.reply(
      `✅ *Devem registrado!*\n📝 ${descricao}\n${resumo}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao registrar. Tente novamente.');
  }
};
