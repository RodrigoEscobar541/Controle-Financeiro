/**
 * /criarcolunacontascasa [nome] [valor] [Bella|Digo]
 * Exemplo: /criarcolunacontascasa Internet 120 Digo
 * Pagante é opcional — padrão: Digo
 * Cria coluna em config/contas_casa_colunas e em todos os meses futuros de contas_casa
 */

module.exports = async (ctx, db) => {
  const text = ctx.message.text.replace('/criarcolunacontascasa', '').trim();

  if (!text) {
    return ctx.reply(
      '❌ Formato inválido.\n\nUse: /criarcolunacontascasa [nome] [valor] [Bella|Digo]\nExemplo: /criarcolunacontascasa Internet 120 Digo'
    );
  }

  const partes = text.split(/\s+/);

  // Detecta pagante opcional no último token
  let pagante = 'Digo';
  const ultimoToken = partes[partes.length - 1];
  if (ultimoToken === 'Bella' || ultimoToken === 'bella') {
    pagante = 'Bella';
    partes.pop();
  } else if (ultimoToken === 'Digo' || ultimoToken === 'digo') {
    pagante = 'Digo';
    partes.pop();
  }

  const valorStr = partes.pop()?.replace(',', '.');
  const valor    = parseFloat(valorStr);
  const nome     = partes.join(' ');

  if (!nome) {
    return ctx.reply('❌ Informe o nome da conta. Ex: /criarcolunacontascasa Internet 120');
  }
  if (isNaN(valor) || valor < 0) {
    return ctx.reply('❌ Valor inválido. Ex: /criarcolunacontascasa Internet 120');
  }

  try {
    const configRef  = db.collection('config').doc('contas_casa_colunas');
    const configSnap = await configRef.get();
    const dataConf   = configSnap.exists ? configSnap.data() : {};
    const colunasConfig = dataConf.colunas || {};
    const ordemAtual    = Array.isArray(dataConf.ordem) ? dataConf.ordem : [];

    if (colunasConfig[nome]) {
      return ctx.reply(`❌ A conta "${nome}" já existe em Contas da Casa.`);
    }

    const novoConfig = { ...colunasConfig, [nome]: { defaultPagante: pagante } };
    const novaOrdem  = [...ordemAtual, nome];
    await configRef.set({ colunas: novoConfig, ordem: novaOrdem });

    const now        = new Date();
    const mesAtualId = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    const mesesSnap = await db.collection('contas_casa').get();
    const batch     = db.batch();
    let atualizados = 0;

    for (const mesDoc of mesesSnap.docs) {
      if (mesDoc.id >= mesAtualId) {
        const cols = mesDoc.data().colunas || {};
        if (!cols[nome]) {
          batch.update(mesDoc.ref, { [`colunas.${nome}`]: { valor, status: 'naoPago', pagante } });
          atualizados++;
        }
      }
    }

    if (atualizados > 0) await batch.commit();

    const valorFmt = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ctx.reply(
      `✅ *Conta criada em Contas da Casa!*\n📋 Nome: *${nome}*\n💰 Valor: *${valorFmt}*\n👤 Responsável: *${pagante}*\n📅 Adicionada em *${atualizados}* mês(es) futuro(s)`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Erro ao criar coluna. Tente novamente.');
  }
};
