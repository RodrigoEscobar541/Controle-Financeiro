/**
 * /agente [mensagem]
 * Agente IA financeiro usando Google Gemini com function calling.
 * Acessa o Firestore diretamente para ler, escrever e excluir dados.
 * Registra cada interação em agente_log/{id}.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── Prompt do sistema ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um consultor financeiro pessoal do Rodrigo Escobar (também chamado de "Digo").
Sua função é auxiliar Rodrigo a entender, organizar e gerenciar suas finanças pessoais com base nos dados reais do banco de dados.

CONTEXTO PESSOAL:
- "Digo" = Rodrigo (o usuário, você fala com ele)
- "Bella" = companheira/parceira de Rodrigo que divide as contas da casa
- O banco usado é o Mercado Pago

ESTRUTURA DO BANCO DE DADOS (Firestore):

1. COLEÇÃO: banco/{id}
   Registra todas as movimentações financeiras (entradas e saídas).
   Campos: data (YYYY-MM-DD), tipo ("Entrada" ou "Saida"), valor (número), descricao (string)
   → Use para: saldo, histórico de gastos, registrar/excluir lançamentos

2. COLEÇÃO: patrimonio/{id}
   Ativos e investimentos do Rodrigo.
   Campos: nomeDoAtivo (string), plataforma (string), valor (número)
   → Use para: total investido, adicionar/remover ativos

3. COLEÇÃO: distribuicao_mensal/{YYYY-MM}
   Planejamento mensal do salário — cada documento é um mês.
   Campos: dataMes ("MM-YYYY"), colunas: { [nomeConta]: { valor, status ("Pago"|"naoPago") } }
   Exemplos de colunas: "Netflix", "HBO", "Seguro cartão MP"
   → Use para: quanto está distribuído no mês, marcar contas como pagas

4. COLEÇÃO: contas_casa/{YYYY-MM}
   Gastos compartilhados da casa — cada documento é um mês.
   Campos: dataMes ("MM-YYYY"), colunas: { [nomeConta]: { valor, status ("Pago"|"naoPago"), pagante ("Digo"|"Bella") } }
   Exemplos de colunas: "Mercado", "Luz", "Internet"
   → Use para: quanto cada um deve pagar, marcar contas como pagas

5. COLEÇÃO: config/distribuicao_colunas
   Campos: colunas (array de strings com os nomes das colunas de distribuição)

6. COLEÇÃO: config/contas_casa_colunas
   Campos: colunas (objeto com { [nome]: { defaultPagante: "Digo"|"Bella" } })

ESTRUTURA DO APP WEB (para contexto):
O app é organizado como uma planilha com as seguintes seções:
- Dashboard: resumo geral (últimas entradas/saídas, totais, patrimônio)
- Banco: tabela de entradas e saídas (coleção banco)
- Distribuição Mensal: planejamento do salário por mês, cada linha é um mês e cada coluna é uma conta fixa
- Patrimônio: tabela de ativos e investimentos
- Contas Casa: gastos da casa por mês, divididos entre Digo e Bella
- Focus: gastos com o Ford Focus — coleções carro_feitos (gastos feitos), carro_afazer (lista de serviços pendentes) e carro_abastecimento (registro de combustível)
- Face: gastos com o Ecosport/Face — coleções focus_feitos (gastos feitos), focus_afazer (lista de serviços pendentes) e focus_abastecimento (registro de combustível)
- Devo/Devem: controle de dívidas (não coberto pelas suas ferramentas)

7. COLEÇÃO: carro_feitos/{id}  — gastos já realizados no Focus
   Campos: data (YYYY-MM-DD), descricao (string), valor (número)

8. COLEÇÃO: carro_afazer/{id}  — serviços pendentes/futuros no Focus
   Campos: prioridade (número, quanto menor = mais urgente), descricao (string), valor (número estimado)

9. COLEÇÃO: focus_feitos/{id}  — gastos já realizados no Face
   Campos: data (YYYY-MM-DD), descricao (string), valor (número)

10. COLEÇÃO: focus_afazer/{id}  — serviços pendentes/futuros no Face
    Campos: prioridade (número, quanto menor = mais urgente), descricao (string), valor (número estimado)

11. COLEÇÃO: carro_abastecimento/{id} — abastecimentos do Focus | focus_abastecimento/{id} — abastecimentos do Face
    Campos: data (YYYY-MM-DD), km (número, km rodado NESTE tanque, não é odômetro acumulado),
    correcao (número 0-100, % a descontar do km informado), litros (número),
    valorPago (número ou null, opcional), tipoCombustivel (string, ex: "Gasolina")
    → km efetivo = km * (1 - correcao/100); km/L = km efetivo / litros; R$/km = valorPago / km efetivo (se houver valorPago)
    → Use para: registrar um abastecimento e para calcular/informar consumo (km/L) e custo por km de cada carro

12. COLEÇÃO: combustivel_tipos/{id} — tipos de combustível cadastrados (compartilhada entre Focus e Face)
    Campos: nome (string). Já vem com Gasolina, Etanol e Diesel; o usuário pode ter cadastrado outros (ex: GNV)

REGRAS DE COMPORTAMENTO:
- Seja direto e objetivo
- Use formatação Markdown compatível com Telegram (*negrito*, _itálico_, \`código\`)
- Sempre confirme ações: "✅ Saída registrada: cinema — R$ 42,90"
- Se não tiver certeza do que o usuário quer, pergunte antes de agir
- Em registrar_abastecimento, valorPago é opcional: se o usuário não mencionar o valor pago, registre
  direto com valorPago null — NÃO pergunte por ele. Só informe que o R$/km não pôde ser calculado para
  aquele registro por falta do valor.
- Para excluir um lançamento sem ID, consulte primeiro para encontrar o item e mostre ao usuário para confirmar
- Ao responder sobre valores, sempre formate em R$ (ex: R$ 1.500,00)
- Ao final de cada resposta, se realizou alguma alteração no BD, liste resumidamente o que foi feito
- Data atual: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

// ─── Declarações de ferramentas ───────────────────────────────────────────────

const FERRAMENTAS = [
  {
    name: 'consultar_banco',
    description: 'Consulta transações (entradas e saídas) do banco de dados. Retorna lista com id, data, tipo, valor e descrição de cada lançamento.',
    parameters: {
      type: 'object',
      properties: {
        mes:    { type: 'string', description: 'Filtrar por mês no formato MM (ex: "06"). Opcional.' },
        ano:    { type: 'string', description: 'Filtrar por ano no formato YYYY (ex: "2026"). Opcional.' },
        tipo:   { type: 'string', description: 'Filtrar por tipo: "Entrada" ou "Saida". Opcional.' },
        limite: { type: 'number', description: 'Máximo de resultados. Padrão: 100.' }
      },
      required: []
    }
  },
  {
    name: 'registrar_lancamento',
    description: 'Registra uma nova entrada ou saída financeira no banco de dados.',
    parameters: {
      type: 'object',
      properties: {
        tipo:      { type: 'string', description: '"Entrada" ou "Saida".' },
        descricao: { type: 'string', description: 'Descrição do lançamento (ex: "cinema", "salário").' },
        valor:     { type: 'number', description: 'Valor em reais (ex: 42.90).' },
        data:      { type: 'string', description: 'Data no formato YYYY-MM-DD. Se omitido, usa hoje.' }
      },
      required: ['tipo', 'descricao', 'valor']
    }
  },
  {
    name: 'excluir_lancamento',
    description: 'Exclui permanentemente um lançamento do banco de dados pelo ID do documento.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do documento Firestore a excluir.' }
      },
      required: ['id']
    }
  },
  {
    name: 'consultar_patrimonio',
    description: 'Consulta todos os ativos e investimentos cadastrados no patrimônio.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'registrar_patrimonio',
    description: 'Adiciona um novo ativo ou investimento ao patrimônio.',
    parameters: {
      type: 'object',
      properties: {
        nomeDoAtivo: { type: 'string', description: 'Nome do ativo (ex: "BTC", "CDB Nubank", "Tesouro Direto").' },
        plataforma:  { type: 'string', description: 'Plataforma ou corretora (ex: "Mercado Bitcoin", "Nubank").' },
        valor:       { type: 'number', description: 'Valor atual em reais.' }
      },
      required: ['nomeDoAtivo', 'plataforma', 'valor']
    }
  },
  {
    name: 'atualizar_patrimonio',
    description: 'Atualiza informações de um ativo existente no patrimônio (valor, nome ou plataforma).',
    parameters: {
      type: 'object',
      properties: {
        id:          { type: 'string', description: 'ID do documento do ativo.' },
        nomeDoAtivo: { type: 'string', description: 'Novo nome do ativo. Opcional.' },
        plataforma:  { type: 'string', description: 'Nova plataforma. Opcional.' },
        valor:       { type: 'number', description: 'Novo valor em reais. Opcional.' }
      },
      required: ['id']
    }
  },
  {
    name: 'excluir_patrimonio',
    description: 'Remove um ativo do patrimônio pelo ID do documento.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do documento do ativo.' }
      },
      required: ['id']
    }
  },
  {
    name: 'consultar_distribuicao_mensal',
    description: 'Consulta a distribuição mensal do salário para um mês específico, mostrando todas as contas planejadas e seus status de pagamento.',
    parameters: {
      type: 'object',
      properties: {
        ano_mes: { type: 'string', description: 'Mês no formato YYYY-MM (ex: "2026-06"). Se omitido, usa o mês atual.' }
      },
      required: []
    }
  },
  {
    name: 'atualizar_status_distribuicao',
    description: 'Marca uma conta da distribuição mensal como paga ou não paga.',
    parameters: {
      type: 'object',
      properties: {
        ano_mes: { type: 'string', description: 'Mês no formato YYYY-MM (ex: "2026-06").' },
        coluna:  { type: 'string', description: 'Nome exato da coluna/conta (ex: "Netflix", "HBO").' },
        status:  { type: 'string', description: '"Pago" ou "naoPago".' }
      },
      required: ['ano_mes', 'coluna', 'status']
    }
  },
  {
    name: 'consultar_contas_casa',
    description: 'Consulta as contas da casa para um mês, mostrando cada conta com valor, pagante (Digo/Bella) e status.',
    parameters: {
      type: 'object',
      properties: {
        ano_mes: { type: 'string', description: 'Mês no formato YYYY-MM (ex: "2026-06"). Se omitido, usa o mês atual.' }
      },
      required: []
    }
  },
  {
    name: 'atualizar_conta_casa',
    description: 'Atualiza o status de pagamento, valor ou pagante de uma conta da casa.',
    parameters: {
      type: 'object',
      properties: {
        ano_mes: { type: 'string', description: 'Mês no formato YYYY-MM.' },
        coluna:  { type: 'string', description: 'Nome exato da conta (ex: "Mercado", "Luz").' },
        status:  { type: 'string', description: '"Pago" ou "naoPago". Opcional.' },
        valor:   { type: 'number', description: 'Novo valor em reais. Opcional.' },
        pagante: { type: 'string', description: '"Digo" ou "Bella". Opcional.' }
      },
      required: ['ano_mes', 'coluna']
    }
  },
  {
    name: 'consultar_config',
    description: 'Consulta os nomes de colunas configuradas para distribuição mensal e contas da casa.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'criar_coluna_contas_casa',
    description: 'Cria uma nova coluna (conta) permanente em Contas da Casa. Adiciona ao config e a todos os meses presentes e futuros.',
    parameters: {
      type: 'object',
      properties: {
        nome:    { type: 'string', description: 'Nome da nova conta (ex: "Mercado Isa", "Internet").' },
        valor:   { type: 'number', description: 'Valor padrão mensal em reais.' },
        pagante: { type: 'string', description: '"Digo" ou "Bella". Quem normalmente paga essa conta. Padrão: "Digo".' }
      },
      required: ['nome', 'valor']
    }
  },
  {
    name: 'criar_coluna_distribuicao',
    description: 'Cria uma nova coluna (despesa fixa) permanente na Distribuição Mensal. Adiciona ao config e a todos os meses presentes e futuros.',
    parameters: {
      type: 'object',
      properties: {
        nome:  { type: 'string', description: 'Nome da nova coluna (ex: "Disney+", "Seguro carro").' },
        valor: { type: 'number', description: 'Valor mensal em reais.' }
      },
      required: ['nome', 'valor']
    }
  },
  {
    name: 'consultar_carro',
    description: 'Consulta gastos feitos e lista de serviços a fazer de um dos carros (Focus ou Face).',
    parameters: {
      type: 'object',
      properties: {
        carro: { type: 'string', description: '"focus" para o Ford Focus, "face" para o Face/Ecosport.' }
      },
      required: ['carro']
    }
  },
  {
    name: 'registrar_gasto_carro',
    description: 'Registra um gasto já realizado em um dos carros (Focus ou Face).',
    parameters: {
      type: 'object',
      properties: {
        carro:     { type: 'string', description: '"focus" ou "face".' },
        descricao: { type: 'string', description: 'Descrição do serviço/gasto (ex: "troca de óleo", "pastilha de freio").' },
        valor:     { type: 'number', description: 'Valor pago em reais.' },
        data:      { type: 'string', description: 'Data no formato YYYY-MM-DD. Se omitido, usa hoje.' }
      },
      required: ['carro', 'descricao', 'valor']
    }
  },
  {
    name: 'registrar_afazer_carro',
    description: 'Adiciona um serviço pendente/futuro à lista "a fazer" de um dos carros. A prioridade é automática (fim da fila).',
    parameters: {
      type: 'object',
      properties: {
        carro:     { type: 'string', description: '"focus" ou "face".' },
        descricao: { type: 'string', description: 'Descrição do serviço a fazer (ex: "revisão 60mil km", "alinhar direção").' },
        valor:     { type: 'number', description: 'Valor estimado em reais.' }
      },
      required: ['carro', 'descricao', 'valor']
    }
  },
  {
    name: 'excluir_item_carro',
    description: 'Remove um registro de gasto feito ou item da lista a fazer de um dos carros.',
    parameters: {
      type: 'object',
      properties: {
        carro:   { type: 'string', description: '"focus" ou "face".' },
        colecao: { type: 'string', description: '"feitos" para gastos realizados, "afazer" para a lista pendente.' },
        id:      { type: 'string', description: 'ID do documento a excluir.' }
      },
      required: ['carro', 'colecao', 'id']
    }
  },
  {
    name: 'registrar_abastecimento',
    description: 'Registra um abastecimento (enchida de tanque) de um dos carros (Focus ou Face): km rodado, litros, tipo de combustível e valor pago opcional. Se o tipo de combustível informado ainda não existir na lista cadastrada, ele é criado automaticamente.',
    parameters: {
      type: 'object',
      properties: {
        carro:           { type: 'string', description: '"focus" ou "face".' },
        km:              { type: 'number', description: 'Km rodado NESTE tanque (não é odômetro acumulado).' },
        litros:          { type: 'number', description: 'Litros abastecidos.' },
        tipoCombustivel: { type: 'string', description: 'Nome do tipo de combustível (ex: "Gasolina", "Etanol", "Diesel"). Se não existir na lista, será cadastrado automaticamente.' },
        correcao:        { type: 'number', description: 'Percentual (0-100) a descontar do km informado, ex: se o painel/GPS costuma superestimar. Opcional, padrão 0.' },
        valorPago:       { type: 'number', description: 'Valor pago em reais. Opcional.' },
        data:            { type: 'string', description: 'Data no formato YYYY-MM-DD. Se omitido, usa hoje.' }
      },
      required: ['carro', 'km', 'litros', 'tipoCombustivel']
    }
  },
  {
    name: 'consultar_abastecimento',
    description: 'Consulta o histórico de abastecimentos de um dos carros (Focus ou Face), já com km/L e R$/km calculados por registro e a média de km/L.',
    parameters: {
      type: 'object',
      properties: {
        carro:  { type: 'string', description: '"focus" ou "face".' },
        limite: { type: 'number', description: 'Máximo de registros mais recentes a retornar. Padrão: 10.' }
      },
      required: ['carro']
    }
  }
];

// ─── Executor de ferramentas ──────────────────────────────────────────────────

async function executarTool(nome, args, db, acoesLog) {
  const hoje    = new Date();
  const anoMes  = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  try {
    switch (nome) {

      case 'consultar_banco': {
        const snap = await db.collection('banco').get();
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (args.tipo) docs = docs.filter(d => d.tipo === args.tipo);
        if (args.ano)  docs = docs.filter(d => d.data && String(d.data).startsWith(args.ano));
        if (args.mes)  docs = docs.filter(d => {
          const data = String(d.data || '');
          // suporta YYYY-MM-DD e DD-MM-YYYY
          return data.includes(`-${args.mes}-`) || data.startsWith(`${args.mes}-`) || data.includes(`/${args.mes}/`);
        });

        docs.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
        if (args.limite) docs = docs.slice(0, args.limite);

        const totalEntradas = docs.filter(d => d.tipo === 'Entrada').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const totalSaidas   = docs.filter(d => d.tipo === 'Saida').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

        acoesLog.push({ tipo: 'LEITURA', colecao: 'banco', descricao: `Consultou ${docs.length} lançamentos` });
        return { sucesso: true, lancamentos: docs, total_registros: docs.length, total_entradas: totalEntradas, total_saidas: totalSaidas, saldo: totalEntradas - totalSaidas };
      }

      case 'registrar_lancamento': {
        const data = args.data || dataHoje;
        const ref  = await db.collection('banco').add({
          data,
          tipo:      args.tipo,
          valor:     args.valor,
          descricao: args.descricao
        });
        acoesLog.push({ tipo: 'ESCRITA', colecao: 'banco', id: ref.id, descricao: `${args.tipo}: "${args.descricao}" R$ ${args.valor}` });
        return { sucesso: true, id: ref.id, mensagem: `${args.tipo} registrada com sucesso` };
      }

      case 'excluir_lancamento': {
        const snap = await db.collection('banco').doc(args.id).get();
        if (!snap.exists) return { sucesso: false, erro: `Documento ${args.id} não encontrado` };
        const dadosAntes = snap.data();
        await db.collection('banco').doc(args.id).delete();
        acoesLog.push({ tipo: 'EXCLUSAO', colecao: 'banco', id: args.id, descricao: `Excluiu: "${dadosAntes.descricao}" R$ ${dadosAntes.valor} (${dadosAntes.tipo})` });
        return { sucesso: true, mensagem: 'Lançamento excluído com sucesso', dados_excluidos: dadosAntes };
      }

      case 'consultar_patrimonio': {
        const snap = await db.collection('patrimonio').get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const total = docs.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        acoesLog.push({ tipo: 'LEITURA', colecao: 'patrimonio', descricao: `Consultou ${docs.length} ativos` });
        return { sucesso: true, ativos: docs, total_patrimonio: total };
      }

      case 'registrar_patrimonio': {
        const ref = await db.collection('patrimonio').add({
          nomeDoAtivo: args.nomeDoAtivo,
          plataforma:  args.plataforma,
          valor:       args.valor
        });
        acoesLog.push({ tipo: 'ESCRITA', colecao: 'patrimonio', id: ref.id, descricao: `Adicionou ativo: ${args.nomeDoAtivo} R$ ${args.valor}` });
        return { sucesso: true, id: ref.id };
      }

      case 'atualizar_patrimonio': {
        const campos = {};
        if (args.nomeDoAtivo !== undefined) campos.nomeDoAtivo = args.nomeDoAtivo;
        if (args.plataforma  !== undefined) campos.plataforma  = args.plataforma;
        if (args.valor       !== undefined) campos.valor       = args.valor;
        if (Object.keys(campos).length === 0) return { sucesso: false, erro: 'Nenhum campo para atualizar informado' };
        await db.collection('patrimonio').doc(args.id).update(campos);
        acoesLog.push({ tipo: 'ESCRITA', colecao: 'patrimonio', id: args.id, descricao: `Atualizou ativo ${args.id}: ${JSON.stringify(campos)}` });
        return { sucesso: true };
      }

      case 'excluir_patrimonio': {
        const snap = await db.collection('patrimonio').doc(args.id).get();
        if (!snap.exists) return { sucesso: false, erro: `Documento ${args.id} não encontrado` };
        const dadosAntes = snap.data();
        await db.collection('patrimonio').doc(args.id).delete();
        acoesLog.push({ tipo: 'EXCLUSAO', colecao: 'patrimonio', id: args.id, descricao: `Excluiu ativo: ${dadosAntes.nomeDoAtivo}` });
        return { sucesso: true, dados_excluidos: dadosAntes };
      }

      case 'consultar_distribuicao_mensal': {
        const mesId = args.ano_mes || anoMes;
        const snap  = await db.collection('distribuicao_mensal').doc(mesId).get();
        acoesLog.push({ tipo: 'LEITURA', colecao: 'distribuicao_mensal', descricao: `Consultou ${mesId}` });
        if (!snap.exists) return { sucesso: true, dados: null, mensagem: `Sem dados cadastrados para ${mesId}` };
        const d     = snap.data();
        const cols  = d.colunas || {};
        const total = Object.values(cols).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
        return { sucesso: true, dados: { id: snap.id, ...d }, total };
      }

      case 'atualizar_status_distribuicao': {
        const docRef = db.collection('distribuicao_mensal').doc(args.ano_mes);
        const snap   = await docRef.get();
        if (!snap.exists) return { sucesso: false, erro: `Mês ${args.ano_mes} não encontrado na distribuição mensal` };
        await docRef.update({ [`colunas.${args.coluna}.status`]: args.status });
        acoesLog.push({ tipo: 'ESCRITA', colecao: 'distribuicao_mensal', id: args.ano_mes, descricao: `"${args.coluna}" → ${args.status}` });
        return { sucesso: true };
      }

      case 'consultar_contas_casa': {
        const mesId = args.ano_mes || anoMes;
        const snap  = await db.collection('contas_casa').doc(mesId).get();
        acoesLog.push({ tipo: 'LEITURA', colecao: 'contas_casa', descricao: `Consultou ${mesId}` });
        if (!snap.exists) return { sucesso: true, dados: null, mensagem: `Sem dados para ${mesId}` };
        const d    = snap.data();
        const cols = d.colunas || {};
        let total = 0, digo = 0, bella = 0;
        Object.values(cols).forEach(c => {
          const v = parseFloat(c.valor) || 0;
          total += v;
          if (c.pagante === 'Bella') bella += v; else digo += v;
        });
        return { sucesso: true, dados: { id: snap.id, ...d }, total, digo, bella, metade: total / 2 };
      }

      case 'atualizar_conta_casa': {
        const docRef = db.collection('contas_casa').doc(args.ano_mes);
        const snap   = await docRef.get();
        if (!snap.exists) return { sucesso: false, erro: `Mês ${args.ano_mes} não encontrado nas contas da casa` };
        const updates = {};
        if (args.status  !== undefined) updates[`colunas.${args.coluna}.status`]  = args.status;
        if (args.valor   !== undefined) updates[`colunas.${args.coluna}.valor`]   = args.valor;
        if (args.pagante !== undefined) updates[`colunas.${args.coluna}.pagante`] = args.pagante;
        if (Object.keys(updates).length === 0) return { sucesso: false, erro: 'Nenhum campo para atualizar informado' };
        await docRef.update(updates);
        acoesLog.push({ tipo: 'ESCRITA', colecao: 'contas_casa', id: args.ano_mes, descricao: `"${args.coluna}" atualizado: ${JSON.stringify(updates)}` });
        return { sucesso: true };
      }

      case 'consultar_config': {
        const [distSnap, casaSnap] = await Promise.all([
          db.collection('config').doc('distribuicao_colunas').get(),
          db.collection('config').doc('contas_casa_colunas').get()
        ]);
        acoesLog.push({ tipo: 'LEITURA', colecao: 'config', descricao: 'Consultou colunas configuradas' });
        return {
          sucesso: true,
          distribuicao_colunas: distSnap.exists ? distSnap.data() : null,
          contas_casa_colunas:  casaSnap.exists  ? casaSnap.data()  : null
        };
      }

      case 'consultar_carro': {
        const isFocus  = args.carro === 'focus';
        const colFeitos = isFocus ? 'carro_feitos' : 'focus_feitos';
        const colAfazer = isFocus ? 'carro_afazer' : 'focus_afazer';
        const nome      = isFocus ? 'Focus' : 'Face';

        const [snapFeitos, snapAfazer] = await Promise.all([
          db.collection(colFeitos).get(),
          db.collection(colAfazer).orderBy('prioridade', 'asc').get()
        ]);

        const feitos = snapFeitos.docs.map(d => ({ id: d.id, ...d.data() }));
        feitos.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
        const afazer = snapAfazer.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalFeitos = feitos.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const totalAfazer = afazer.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

        acoesLog.push({ tipo: 'LEITURA', colecao: `${colFeitos}+${colAfazer}`, descricao: `Consultou carro ${nome}` });
        return { sucesso: true, carro: nome, feitos, total_gasto: totalFeitos, afazer, total_estimado_afazer: totalAfazer };
      }

      case 'registrar_gasto_carro': {
        const isFocus  = args.carro === 'focus';
        const colecao  = isFocus ? 'carro_feitos' : 'focus_feitos';
        const data     = args.data || dataHoje;
        const ref      = await db.collection(colecao).add({ data, descricao: args.descricao, valor: args.valor });
        acoesLog.push({ tipo: 'ESCRITA', colecao, id: ref.id, descricao: `Gasto ${args.carro}: "${args.descricao}" R$ ${args.valor}` });
        return { sucesso: true, id: ref.id };
      }

      case 'registrar_afazer_carro': {
        const isFocus  = args.carro === 'focus';
        const colecao  = isFocus ? 'carro_afazer' : 'focus_afazer';
        const snap     = await db.collection(colecao).orderBy('prioridade', 'desc').limit(1).get();
        const maxPrio  = snap.empty ? 0 : (snap.docs[0].data().prioridade || 0);
        const ref      = await db.collection(colecao).add({ prioridade: maxPrio + 1, descricao: args.descricao, valor: args.valor });
        acoesLog.push({ tipo: 'ESCRITA', colecao, id: ref.id, descricao: `A fazer ${args.carro}: "${args.descricao}" R$ ${args.valor}` });
        return { sucesso: true, id: ref.id, prioridade: maxPrio + 1 };
      }

      case 'criar_coluna_contas_casa': {
        const pagante    = args.pagante || 'Digo';
        const configRef  = db.collection('config').doc('contas_casa_colunas');
        const configSnap = await configRef.get();
        const dataConf   = configSnap.exists ? configSnap.data() : {};
        const colunasConfig = dataConf.colunas || {};
        const ordemAtual    = Array.isArray(dataConf.ordem) ? dataConf.ordem : [];

        if (colunasConfig[args.nome]) {
          return { sucesso: false, erro: `A conta "${args.nome}" já existe em Contas da Casa.` };
        }

        await configRef.set({
          colunas: { ...colunasConfig, [args.nome]: { defaultPagante: pagante } },
          ordem:   [...ordemAtual, args.nome]
        });

        const mesAtualId = anoMes;
        const mesesSnap  = await db.collection('contas_casa').get();
        const batch      = db.batch();
        let atualizados  = 0;

        for (const mesDoc of mesesSnap.docs) {
          if (mesDoc.id >= mesAtualId) {
            const cols = mesDoc.data().colunas || {};
            if (!cols[args.nome]) {
              batch.update(mesDoc.ref, { [`colunas.${args.nome}`]: { valor: args.valor, status: 'naoPago', pagante } });
              atualizados++;
            }
          }
        }
        if (atualizados > 0) await batch.commit();

        acoesLog.push({ tipo: 'ESCRITA', colecao: 'config + contas_casa', descricao: `Criou coluna "${args.nome}" (${pagante}) em ${atualizados} mês(es)` });
        return { sucesso: true, mensagem: `Coluna "${args.nome}" criada em ${atualizados} mês(es)`, pagante };
      }

      case 'criar_coluna_distribuicao': {
        const configRef  = db.collection('config').doc('distribuicao_colunas');
        const configSnap = await configRef.get();
        const colunasAtual = configSnap.exists ? (configSnap.data().colunas || []) : [];

        if (colunasAtual.includes(args.nome)) {
          return { sucesso: false, erro: `A coluna "${args.nome}" já existe na Distribuição Mensal.` };
        }

        await configRef.set({ colunas: [...colunasAtual, args.nome] }, { merge: true });

        const mesAtualId = anoMes;
        const mesesSnap  = await db.collection('distribuicao_mensal').get();
        const batch      = db.batch();
        let atualizados  = 0;

        for (const mesDoc of mesesSnap.docs) {
          if (mesDoc.id >= mesAtualId) {
            const cols = mesDoc.data().colunas || {};
            if (!cols[args.nome]) {
              batch.update(mesDoc.ref, { [`colunas.${args.nome}`]: { valor: args.valor, status: 'naoPago' } });
              atualizados++;
            }
          }
        }
        if (atualizados > 0) await batch.commit();

        acoesLog.push({ tipo: 'ESCRITA', colecao: 'config + distribuicao_mensal', descricao: `Criou coluna "${args.nome}" em ${atualizados} mês(es)` });
        return { sucesso: true, mensagem: `Coluna "${args.nome}" criada em ${atualizados} mês(es)` };
      }

      case 'excluir_item_carro': {
        const isFocus = args.carro === 'focus';
        const colecao = args.colecao === 'feitos'
          ? (isFocus ? 'carro_feitos' : 'focus_feitos')
          : (isFocus ? 'carro_afazer' : 'focus_afazer');
        const snap = await db.collection(colecao).doc(args.id).get();
        if (!snap.exists) return { sucesso: false, erro: `Documento ${args.id} não encontrado em ${colecao}` };
        const dadosAntes = snap.data();
        await db.collection(colecao).doc(args.id).delete();
        acoesLog.push({ tipo: 'EXCLUSAO', colecao, id: args.id, descricao: `Excluiu: "${dadosAntes.descricao}"` });
        return { sucesso: true, dados_excluidos: dadosAntes };
      }

      case 'registrar_abastecimento': {
        const isFocus  = args.carro === 'focus';
        const colecao  = isFocus ? 'carro_abastecimento' : 'focus_abastecimento';
        const data     = args.data || dataHoje;
        const correcao = args.correcao || 0;
        const valorPago = args.valorPago !== undefined ? args.valorPago : null;
        const nomeTipo  = String(args.tipoCombustivel || '').trim();

        const tiposSnap = await db.collection('combustivel_tipos').get();
        const jaExiste   = tiposSnap.docs.some(d => (d.data().nome || '').toLowerCase() === nomeTipo.toLowerCase());
        if (!jaExiste && nomeTipo) await db.collection('combustivel_tipos').add({ nome: nomeTipo });

        const ref = await db.collection(colecao).add({
          data, km: args.km, correcao, litros: args.litros, valorPago, tipoCombustivel: nomeTipo
        });

        const kmEfetivo  = args.km * (1 - correcao / 100);
        const kmPorLitro = args.litros > 0 ? kmEfetivo / args.litros : null;
        const rsPorKm    = (valorPago && kmEfetivo > 0) ? valorPago / kmEfetivo : null;

        acoesLog.push({
          tipo: 'ESCRITA', colecao, id: ref.id,
          descricao: `Abastecimento ${args.carro}: ${args.km}km, ${args.litros}L, ${nomeTipo}${valorPago ? `, R$ ${valorPago}` : ''}`
        });
        return { sucesso: true, id: ref.id, km_efetivo: kmEfetivo, km_por_litro: kmPorLitro, rs_por_km: rsPorKm };
      }

      case 'consultar_abastecimento': {
        const isFocus = args.carro === 'focus';
        const colecao = isFocus ? 'carro_abastecimento' : 'focus_abastecimento';
        const limite  = args.limite || 10;

        const snap = await db.collection(colecao).orderBy('data', 'desc').limit(limite).get();
        const registros = snap.docs.map(d => {
          const item      = { id: d.id, ...d.data() };
          const correcao  = parseFloat(item.correcao) || 0;
          const kmEfetivo = (parseFloat(item.km) || 0) * (1 - correcao / 100);
          const litros    = parseFloat(item.litros) || 0;
          return {
            ...item,
            km_efetivo:  kmEfetivo,
            km_por_litro: litros > 0 ? kmEfetivo / litros : null,
            rs_por_km:    (item.valorPago && kmEfetivo > 0) ? item.valorPago / kmEfetivo : null
          };
        });

        const validos = registros.filter(r => r.km_por_litro !== null);
        const mediaKmPorLitro = validos.length
          ? validos.reduce((s, r) => s + r.km_por_litro, 0) / validos.length
          : null;

        acoesLog.push({ tipo: 'LEITURA', colecao, descricao: `Consultou ${registros.length} abastecimentos (${args.carro})` });
        return { sucesso: true, carro: isFocus ? 'Focus' : 'Face', registros, media_km_por_litro: mediaKmPorLitro };
      }

      default:
        return { sucesso: false, erro: `Ferramenta desconhecida: ${nome}` };
    }
  } catch (err) {
    console.error(`[AGENTE] Erro na ferramenta ${nome}:`, err);
    return { sucesso: false, erro: err.message };
  }
}

// ─── Handler do comando ───────────────────────────────────────────────────────

module.exports = async (ctx, db) => {
  const mensagem = ctx.message.text.replace(/^\/agente\s*/i, '').trim();

  if (!mensagem) {
    return ctx.reply(
      '🤖 *Agente Financeiro*\n\n' +
      'Me diga o que precisa! Exemplos:\n' +
      '• /agente qual é meu saldo atual?\n' +
      '• /agente registra saída cinema 45 reais\n' +
      '• /agente quais foram meus gastos de junho?\n' +
      '• /agente quanto tenho de patrimônio?\n' +
      '• /agente marca Netflix como pago em junho\n' +
      '• /agente qual o total das contas da casa esse mês?\n' +
      '• /agente registra abastecimento do focus, 350km, 30 litros de gasolina, paguei 180 reais\n' +
      '• /agente qual o consumo médio do face?',
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.reply('🤔 _Analisando..._', { parse_mode: 'Markdown' });

  const acoesLog = [];

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: FERRAMENTAS }]
    });

    const chat   = model.startChat();
    let resultado = await chat.sendMessage(mensagem);

    // Loop agêntico: executa ferramentas até o modelo responder em texto
    let iteracoes = 0;
    while (iteracoes < 10) {
      const calls = resultado.response.functionCalls();
      if (!calls || calls.length === 0) break;

      const respostas = [];
      for (const call of calls) {
        console.log(`[AGENTE] Chamando ferramenta: ${call.name}`, call.args);
        const saida = await executarTool(call.name, call.args, db, acoesLog);
        respostas.push({ functionResponse: { name: call.name, response: saida } });
      }

      resultado = await chat.sendMessage(respostas);
      iteracoes++;
    }

    const resposta = resultado.response.text();

    // Gravar log no Firestore
    await db.collection('agente_log').add({
      timestamp:        new Date().toISOString(),
      data:             new Date().toLocaleDateString('pt-BR'),
      mensagem_usuario: mensagem,
      resposta_agente:  resposta,
      acoes_realizadas: acoesLog
    });

    // Enviar resposta (Telegram tem limite de 4096 chars)
    if (resposta.length > 4000) {
      const partes = resposta.match(/.{1,4000}/gs) || [resposta];
      for (const parte of partes) {
        await ctx.reply(parte, { parse_mode: 'Markdown' });
      }
    } else {
      await ctx.reply(resposta, { parse_mode: 'Markdown' });
    }

  } catch (err) {
    console.error('[AGENTE] Erro:', err);
    await ctx.reply(`❌ Erro no agente: ${err.message}`);
  }
};
