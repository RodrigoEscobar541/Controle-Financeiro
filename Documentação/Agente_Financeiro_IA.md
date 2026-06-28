# Agente Financeiro IA

Você é um consultor financeiro pessoal do Rodrigo Escobar (também chamado de "Digo").
Sua função é auxiliar Rodrigo a entender, organizar e gerenciar suas finanças pessoais com base nos dados reais do banco de dados.

---

## Contexto Pessoal

- **Digo** = Rodrigo (o usuário)
- **Bella** = companheira/parceira que divide as contas da casa
- Banco utilizado: **Mercado Pago**

---

## Como o Agente é Acionado

O usuário envia `/agente [mensagem]` pelo Telegram.

O bot (Render) processa o comando diretamente em `Bot Render/commands/agente.js`:
1. Constrói o prompt com o contexto do sistema + mensagem do usuário
2. Envia para a API do **Google Gemini** (`gemini-2.0-flash`) com function calling
3. O Gemini decide quais ferramentas (funções) chamar para buscar/alterar dados
4. O bot executa as ferramentas no Firestore usando o Firebase Admin SDK
5. O Gemini compõe a resposta final e envia de volta ao Telegram
6. Toda a interação é registrada na coleção `agente_log` no Firestore

---

## Arquitetura

```
Telegram → Bot (Render) → Gemini API → Function Calling → Firestore
                                    ↑_____________________________|
                                    (loop até resposta final)
                                           ↓
                                      agente_log
```

**Vantagem sobre a arquitetura anterior (GitHub Actions):**
- Resposta imediata (sem delay de ~30s do Actions)
- Sem necessidade de repository_dispatch
- Tudo roda dentro do próprio bot no Render

---

## Ferramentas Disponíveis (function calling)

| Ferramenta | Coleção | O que faz |
|------------|---------|-----------|
| `consultar_banco` | `banco` | Lê lançamentos, filtrando por mês/ano/tipo |
| `registrar_lancamento` | `banco` | Cria nova entrada ou saída |
| `excluir_lancamento` | `banco` | Remove um lançamento pelo ID |
| `consultar_patrimonio` | `patrimonio` | Lista todos os ativos |
| `registrar_patrimonio` | `patrimonio` | Adiciona novo ativo |
| `atualizar_patrimonio` | `patrimonio` | Atualiza valor/nome/plataforma de ativo |
| `excluir_patrimonio` | `patrimonio` | Remove um ativo |
| `consultar_distribuicao_mensal` | `distribuicao_mensal` | Lê planejamento do mês |
| `atualizar_status_distribuicao` | `distribuicao_mensal` | Marca conta como Pago/naoPago |
| `consultar_contas_casa` | `contas_casa` | Lê contas da casa do mês |
| `atualizar_conta_casa` | `contas_casa` | Atualiza status/valor/pagante de conta |
| `consultar_config` | `config` | Lê nomes de colunas configuradas |

---

## Estrutura do Banco de Dados (Firestore)

```
banco/{id}
  data:      "2026-06-23"      // YYYY-MM-DD
  tipo:      "Entrada" | "Saida"
  valor:     1500.00
  descricao: "Salário"

patrimonio/{id}
  nomeDoAtivo: "BTC"
  plataforma:  "Mercado Bitcoin"
  valor:       2180.00

distribuicao_mensal/{YYYY-MM}   // ex: "2026-06"
  dataMes:  "06-2026"
  colunas:
    "Netflix": { valor: 45.90, status: "Pago" | "naoPago" }
    "HBO":     { valor: 14.00, status: "Pago" | "naoPago" }

contas_casa/{YYYY-MM}           // ex: "2026-06"
  dataMes:  "06-2026"
  colunas:
    "Mercado": { valor: 180.54, status: "Pago", pagante: "Digo" }
    "Luz":     { valor: 120.00, status: "naoPago", pagante: "Bella" }

config/distribuicao_colunas
  colunas: ["Netflix", "HBO", ...]

config/contas_casa_colunas
  colunas:
    "Mercado": { defaultPagante: "Digo" }
    "Luz":     { defaultPagante: "Bella" }

agente_log/{id}                 // registro automático de cada interação
  timestamp:        "2026-06-28T14:30:00.000Z"
  data:             "28/06/2026"
  mensagem_usuario: "registra saída cinema 45 reais"
  resposta_agente:  "✅ Saída registrada: cinema — R$ 45,00"
  acoes_realizadas: [
    { tipo: "ESCRITA", colecao: "banco", id: "abc123", descricao: "Saida: cinema R$ 45" }
  ]
```

---

## Estrutura do App Web (para contexto do agente)

O app web é organizado como uma planilha com as seções:

| Seção | Coleção Firestore | Descrição |
|-------|-------------------|-----------|
| Dashboard | múltiplas | Resumo geral (não editável) |
| Banco | `banco` | Todas as entradas e saídas |
| Distribuição Mensal | `distribuicao_mensal` | Planejamento mensal do salário |
| Patrimônio | `patrimonio` | Ativos e investimentos |
| Contas Casa | `contas_casa` | Gastos compartilhados Digo/Bella |
| Focus | `carro_gastos`, `carro_afazer` | Gastos com Ford Focus |
| Face | `face_gastos`, `face_afazer` | Gastos com outro carro |
| Devo/Devem | `devo_devem` | Controle de dívidas |

> O agente atualmente cobre: Banco, Patrimônio, Distribuição Mensal e Contas Casa.
> Focus, Face e Devo/Devem não têm ferramentas no agente (pode ser expandido).

---

## Como Alterar o Agente

O arquivo principal é `Bot Render/commands/agente.js`.

**Para adicionar uma nova ferramenta:**
1. Adicione a declaração no array `FERRAMENTAS` (nome, description, parameters)
2. Adicione o `case` correspondente na função `executarTool`
3. Commit e push — o Render faz o redeploy automático

**Para alterar o comportamento/personalidade:**
- Edite a constante `SYSTEM_PROMPT` no topo do arquivo

**Para trocar o modelo Gemini:**
- Troque `'gemini-2.0-flash'` por outro modelo (ex: `'gemini-1.5-pro'`)

**Para testar localmente:**
```bash
cd "Bot Render"
GEMINI_API_KEY="sua_key" TELEGRAM_BOT_TOKEN="..." FIREBASE_SERVICE_ACCOUNT="..." node index.js
# Então envie /agente [mensagem] no Telegram
```

---

## Log de Interações (`agente_log`)

Cada interação do agente gera automaticamente um documento em `agente_log` com:
- Timestamp da interação
- Mensagem original do usuário
- Resposta do agente
- Lista de todas as ações realizadas no BD (leituras, escritas e exclusões)

Isso garante rastreabilidade completa de tudo que o agente fez.

---

## Variável de Ambiente Necessária

| Variável | Onde obter |
|----------|-----------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) — gratuito |

Adicionar no painel do Render: **Environment Variables → Add Variable**.

---

## Comandos Telegram

| Comando | O que faz | Código |
|---------|-----------|--------|
| `/agente [msg]` | Aciona o Agente IA com Gemini | `Bot Render/commands/agente.js` |
| `/saida [desc] [valor]` | Registra saída direta | `Bot Render/commands/saida.js` |
| `/entrada [desc] [valor]` | Registra entrada direta | `Bot Render/commands/entrada.js` |
| `/saldo` | Saldo atual | `Bot Render/commands/saldo.js` |

---

## Comportamento Esperado

- Respostas diretas e objetivas em português
- Formatação Markdown compatível com Telegram (`*negrito*`, `_itálico_`)
- Sempre confirma ações realizadas com emoji de sucesso
- Pergunta antes de agir quando há ambiguidade
- Para exclusões sem ID, consulta primeiro e pede confirmação
- Ao final de alterações, lista o que foi feito no BD
