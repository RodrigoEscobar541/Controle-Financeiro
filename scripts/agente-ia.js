/**
 * Agente IA Financeiro — roda via GitHub Actions
 *
 * Variáveis de ambiente necessárias (Secrets do GitHub):
 *   ANTHROPIC_API_KEY        — Chave da API do Claude (Anthropic)
 *   FIREBASE_SERVICE_ACCOUNT — JSON da conta de serviço Firebase (em uma linha)
 *   TELEGRAM_BOT_TOKEN       — Token do bot Telegram
 *   MENSAGEM                 — Mensagem/instrução do usuário (do payload do dispatch)
 *   CHAT_ID                  — ID do chat Telegram para responder
 */

const Anthropic = require('@anthropic-ai/sdk');
const admin     = require('firebase-admin');

// ─── Inicialização ───────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MENSAGEM = process.env.MENSAGEM || '';
const CHAT_ID  = process.env.CHAT_ID  || '';
const BOT_TOKEN= process.env.TELEGRAM_BOT_TOKEN;

// ─── Coletar contexto financeiro do Firestore ────────────────
async function coletarContexto() {
  const [bancoSnap, patrimonioSnap] = await Promise.all([
    db.collection('banco').orderBy('data', 'desc').limit(50).get(),
    db.collection('patrimonio').get()
  ]);

  const transacoes = bancoSnap.docs.map(d => d.data());
  const patrimonio = patrimonioSnap.docs.map(d => d.data());

  let entradas = 0, saidas = 0;
  transacoes.forEach(t => {
    if (t.tipo === 'Entrada') entradas += parseFloat(t.valor) || 0;
    if (t.tipo === 'Saida')   saidas   += parseFloat(t.valor) || 0;
  });

  const totalPatrimonio = patrimonio.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);

  const fmt = v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return `
## Contexto Financeiro Atual

**Saldo:** ${fmt(entradas - saidas)}
**Total Entradas:** ${fmt(entradas)}
**Total Saídas:** ${fmt(saidas)}
**Patrimônio Total:** ${fmt(totalPatrimonio)}

**Últimas transações (máx. 50):**
${transacoes.slice(0, 20).map(t =>
  `- [${t.data}] ${t.tipo}: ${t.descricao} — ${fmt(parseFloat(t.valor))}`
).join('\n')}

**Ativos:**
${patrimonio.map(a => `- ${a.nomeDoAtivo} (${a.plataforma}): ${fmt(parseFloat(a.valor))}`).join('\n')}
`.trim();
}

// ─── Ferramentas (tools) para Claude ────────────────────────
const tools = [
  {
    name: 'registrar_saida',
    description: 'Registra uma saída (despesa) no banco de dados financeiro.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descrição da despesa' },
        valor:     { type: 'number', description: 'Valor em reais' }
      },
      required: ['descricao', 'valor']
    }
  },
  {
    name: 'registrar_entrada',
    description: 'Registra uma entrada (receita) no banco de dados financeiro.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descrição da receita' },
        valor:     { type: 'number', description: 'Valor em reais' }
      },
      required: ['descricao', 'valor']
    }
  },
  {
    name: 'excluir_lancamento',
    description: 'Exclui um lançamento pelo ID do documento no Firestore.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do documento a excluir' }
      },
      required: ['id']
    }
  }
];

// ─── Executar tool use ───────────────────────────────────────
async function executarTool(name, input) {
  const hoje = new Date();
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  if (name === 'registrar_saida') {
    await db.collection('banco').add({ data, tipo: 'Saida', valor: input.valor, descricao: input.descricao });
    return `Saída registrada: ${input.descricao} — R$ ${input.valor}`;
  }
  if (name === 'registrar_entrada') {
    await db.collection('banco').add({ data, tipo: 'Entrada', valor: input.valor, descricao: input.descricao });
    return `Entrada registrada: ${input.descricao} — R$ ${input.valor}`;
  }
  if (name === 'excluir_lancamento') {
    await db.collection('banco').doc(input.id).delete();
    return `Lançamento ${input.id} excluído.`;
  }
  return 'Ferramenta desconhecida.';
}

// ─── Enviar mensagem ao Telegram ─────────────────────────────
async function enviarTelegram(texto) {
  const fetch = (await import('node-fetch')).default;
  const url   = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    CHAT_ID,
      text:       texto,
      parse_mode: 'Markdown'
    })
  });
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  if (!MENSAGEM) {
    console.error('Nenhuma mensagem recebida.');
    process.exit(1);
  }

  console.log(`Mensagem recebida: "${MENSAGEM}"`);

  const contexto = await coletarContexto();

  const systemPrompt = `Você é um assistente financeiro pessoal inteligente e preciso.
Você tem acesso ao banco de dados financeiro do usuário e pode:
- Consultar saldos e transações
- Registrar novas entradas e saídas
- Excluir lançamentos
- Responder perguntas sobre as finanças

Seja direto, use formatação Markdown para Telegram (negrito com *texto*, itálico com _texto_).
Sempre confirme ações realizadas com clareza.

${contexto}`;

  const messages = [{ role: 'user', content: MENSAGEM }];

  // Loop de agentic (suporta múltiplas chamadas de tools)
  let resposta = '';
  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      tools,
      messages
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      resposta = textBlock?.text || 'Sem resposta.';
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(b => b.type === 'tool_use');
      if (!toolUse) break;

      const resultado = await executarTool(toolUse.name, toolUse.input);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: resultado }]
      });
    } else {
      break;
    }
  }

  await enviarTelegram(`🤖 *Agente Financeiro*\n\n${resposta}`);
  console.log('Resposta enviada ao Telegram.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro no agente:', err);
  enviarTelegram('❌ Erro interno no Agente IA. Verifique os logs no GitHub Actions.')
    .finally(() => process.exit(1));
});
