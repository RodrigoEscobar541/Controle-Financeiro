/**
 * /agente [pergunta ou instrução]
 *
 * Aciona o workflow "agente-ia" no GitHub Actions via repository_dispatch.
 * O Actions roda o script scripts/agente-ia.js que chama a API do Claude
 * e responde ao usuário diretamente pelo Telegram.
 */

const axios = require('axios');

module.exports = async (ctx) => {
  const mensagem = ctx.message.text.replace('/agente', '').trim();

  if (!mensagem) {
    return ctx.reply(
      '🤖 *Agente IA Financeiro*\n\n' +
      'Envie uma pergunta ou instrução depois do comando.\n\n' +
      'Exemplos:\n' +
      '/agente qual é meu saldo atual?\n' +
      '/agente quanto gastei esse mês?\n' +
      '/agente me mostre meu patrimônio',
      { parse_mode: 'Markdown' }
    );
  }

  const chatId = ctx.chat.id;

  await ctx.reply('🤖 Consultando o Agente IA... aguarde um momento.');

  try {
    await axios.post(
      `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
      {
        event_type: 'agente-ia',
        client_payload: { mensagem, chat_id: String(chatId) }
      },
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    // A resposta virá via GitHub Actions → Telegram API diretamente
  } catch (err) {
    console.error('Erro ao acionar GitHub Actions:', err.response?.data || err.message);
    ctx.reply('❌ Erro ao acionar o Agente. Verifique as configurações do GitHub.');
  }
};
