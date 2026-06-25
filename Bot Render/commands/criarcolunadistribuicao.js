/**
 * /criarcolunadistribuicao [nome] [valor]
 * Exemplo: /criarcolunadistribuicao Netflix 45.90
 * Cria coluna em config/distribuicao_colunas e em todos os meses futuros de distribuicao_mensal
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/criarcolunadistribuicao', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /criarcolunadistribuicao [nome] [valor]\nExemplo: /criarcolunadistribuicao Netflix 45.90'
    );
  }

  const partes   = text.split(/\s+/);
  const valorStr = partes.pop().replace(',', '.');
  const valor    = parseFloat(valorStr);
  const nome     = partes.join(' ');

  if (!nome) {
    return ctx.reply('❌ Informe o nome da coluna. Ex: /criarcolunadistribuicao Netflix 45.90');
  }
  if (isNaN(valor) || valor < 0) {
    return ctx.reply('❌ Valor inválido. Ex: /criarcolunadistribuicao Netflix 45.90');
  }

  try {
    const configRef  = db.collection('config').doc('distribuicao_colunas');
    const configSnap = await configRef.get();
    const colunasAtual = configSnap.exists ? (configSnap.data().colunas || []) : [];

    if (colunasAtual.includes(nome)) {
      return ctx.reply(`❌ A coluna "${nome}" já existe na distribuição.`);
    }

    await configRef.set({ colunas: [...colunasAtual, nome] }, { merge: true });

    const now       = new Date();
    const mesAtualId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    const mesesSnap = await db.collection('distribuicao_mensal').get();
    const batch     = db.batch();
    let atualizados = 0;

    for (const mesDoc of mesesSnap.docs) {
      if (mesDoc.id >= mesAtualId) {
        const cols = mesDoc.data().colunas || {};
        if (!cols[nome]) {
          batch.update(mesDoc.ref, { [`colunas.${nome}`]: { valor, status: 'naoPago' } });
          atualizados++;
        }
      }
    }

    if (atualizados > 0) await batch.commit();

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *Coluna criada na Distribuição!*\n📋 Nome: *${nome}*\n💰 Valor: *${valorFmt}*\n📅 Adicionada em *${atualizados}* mês(es) futuro(s)`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao criar coluna. Tente novamente.');
  }
};
