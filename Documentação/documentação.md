# Documentação — Controle Financeiro

## Visão Geral

Sistema web de controle financeiro pessoal com interface tipo planilha, autenticação Firebase, banco de dados Firestore e bot Telegram com Agente IA.

---

## Arquitetura

```
GitHub (código) → GitHub Actions → Firebase Hosting (front-end)
                                 → Firestore (banco de dados)

Telegram Bot (VPS Contabo · pm2) → Firestore (leitura/escrita direta)
                                 → GitHub Actions (via repository_dispatch) → Agente IA (Claude API)
```

> **Hospedagem do bot (desde 2026-07-18):** o bot roda 24/7 num **VPS Contabo
> (Linux)** gerenciado pelo **pm2**, que o mantém vivo e o reinicia sozinho em
> quedas/reboot. Substituiu o **Render** (que hibernava no plano free) e o
> **UptimeRobot** (que existia só para pingar o Render e impedir a
> hibernação) — ambos foram desativados. O bot usa *long polling* do Telegram,
> então não precisa de porta pública nem de ping externo. A pasta continua
> chamada `Bot Render/` por histórico; o nome não reflete mais a hospedagem.

---

## Estrutura de Arquivos

```
Controle-Financeiro/
├── public/                        ← Hospedado no Firebase Hosting
│   ├── index.html                 ← Página de login
│   ├── app.html                   ← Aplicação principal (5 sections)
│   ├── css/styles.css             ← Estilos globais
│   └── js/
│       ├── firebase-config.js     ← ⚠️ PREENCHA com suas credenciais Firebase
│       ├── auth.js                ← Autenticação (login/logout)
│       ├── app.js                 ← Controlador principal + utilitários
│       ├── dashboard.js           ← Section Dashboard
│       ├── banco.js               ← Section Banco (entradas/saídas)
│       ├── distribuicao.js        ← Section Distribuição Mensal
│       ├── patrimonio.js          ← Section Patrimônio
│       └── contas-casa.js         ← Section Contas da Casa
│
├── Querys/                        ← Queries Firestore (usadas pelo bot Render)
│   ├── banco-queries.js
│   ├── patrimonio-queries.js
│   ├── distribuicao-queries.js
│   └── contas-casa-queries.js
│
├── Bot Render/                    ← Bot Telegram (roda no VPS Contabo via pm2)
│   ├── index.js                   ← Entrada do bot (long polling)
│   ├── package.json
│   ├── .env.example               ← ⚠️ Copie para .env e preencha
│   ├── .env                       ← (não versionado) segredos do bot
│   ├── serviceAccountKey.json     ← (não versionado) chave Firebase no VPS
│   └── commands/
│       ├── saida.js               ← Comando /saida
│       ├── entrada.js             ← Comando /entrada
│       ├── saldo.js               ← Comando /saldo
│       └── agente.js              ← Comando /agente (aciona GitHub Actions)
│
├── scripts/
│   ├── package.json
│   └── agente-ia.js              ← Script do Agente IA (roda no GitHub Actions)
│
├── .github/workflows/
│   ├── deploy-firebase.yml        ← Deploy automático no Firebase (push → main)
│   └── agente-ia.yml             ← Executa o Agente IA quando acionado pelo bot
│
├── firebase.json                  ← Configuração Firebase Hosting
├── .firebaserc                    ← ⚠️ Coloque seu Project ID aqui
└── .gitignore
```

---

## Banco de Dados Firestore

### Coleção: `banco`
Transações financeiras (Mercado Pago).
```
{id_aleatorio}: {
  data:      "2026-06-23",     // YYYY-MM-DD
  tipo:      "Entrada"|"Saida",
  valor:     1500.00,
  descricao: "Salário"
}
```

### Coleção: `patrimonio`
Ativos e investimentos.
```
{id_aleatorio}: {
  nomeDoAtivo: "BTC",
  plataforma:  "Mercado Bitcoin",
  valor:       2180.00
}
```

### Coleção: `distribuicao_mensal`
Distribuição mensal do salário. Um documento por mês.
```
"2026-06": {
  dataMes: "06-2026",
  colunas: {
    "HBO":    { valor: 14.00, status: "naoPago" },
    "Seguro": { valor: 5.99,  status: "Pago"    }
  }
}
```

### Coleção: `contas_casa`
Contas domésticas. Um documento por mês.
```
"2026-06": {
  dataMes: "06-2026",
  colunas: {
    "Mercado": { valor: 180.54, status: "Pago",    pagante: "Digo"  },
    "Luz":     { valor: 120.00, status: "naoPago", pagante: "Bella" }
  }
}
```

### Coleção: `config`
Configurações dinâmicas (lista de colunas criadas pelo usuário).
```
"distribuicao_colunas": { colunas: ["HBO","Netflix","Seguro",...] }
"contas_casa_colunas":  { colunas: { "Mercado": { defaultPagante:"Digo" }, ... } }
```

---

## Comandos do Bot Telegram

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/saida [desc] [valor]`   | Registra uma saída   | `/saida cinema 42.90` |
| `/entrada [desc] [valor]` | Registra uma entrada | `/entrada salário 8556` |
| `/saldo`                  | Mostra saldo atual   | `/saldo` |
| `/agente [mensagem]`      | Consulta o Agente IA | `/agente quanto gastei esse mês?` |

---

## Como Configurar (Passo a Passo)

### 1. Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto (ou use um existente)
3. Ative **Authentication** → E-mail/Senha → crie seu usuário
4. Ative **Firestore Database** → crie em modo produção
5. Ative **Hosting**
6. Em **Configurações do Projeto → Seus Apps → Web**, copie o `firebaseConfig`
7. Cole em [public/js/firebase-config.js](public/js/firebase-config.js)
8. Em `.firebaserc`, substitua `SEU_FIREBASE_PROJECT_ID`

### 2. GitHub Secrets

Acesse: **GitHub → Repositório → Settings → Secrets → Actions**

| Secret | O que colocar |
|--------|---------------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON da conta de serviço Firebase (Configurações → Contas de Serviço → Gerar nova chave) |
| `FIREBASE_PROJECT_ID`      | ID do projeto Firebase |
| `TELEGRAM_BOT_TOKEN`       | Token do bot (BotFather no Telegram) |
| `ANTHROPIC_API_KEY`        | Chave da API do Claude (console.anthropic.com) |

### 3. Bot Telegram

1. Fale com [@BotFather](https://t.me/BotFather) no Telegram
2. Envie `/newbot` e siga as instruções
3. Copie o **Token** recebido
4. Na pasta `Bot Render/`, copie `.env.example` para `.env` e preencha
5. Descubra seu `TELEGRAM_CHAT_ID_AUTORIZADO`: inicie o bot e envie `/start` — o ID aparece no log

### 4. VPS Contabo (Bot) — hospedagem atual

O bot roda num VPS Linux gerenciado pelo **pm2**. Requer **Node.js ≥ 18**.

**Primeira instalação:**

1. No VPS, instale Node.js e git, depois clone o repositório:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs git
   git clone https://github.com/RodrigoEscobar541/Controle-Financeiro.git
   cd "Controle-Financeiro/Bot Render" && npm install
   ```
2. Crie o `.env` com os segredos (ver `.env.example`): `TELEGRAM_BOT_TOKEN`,
   `GITHUB_TOKEN`, `GITHUB_REPO`, `TELEGRAM_CHAT_ID_AUTORIZADO`, `GEMINI_API_KEY`.
3. Crie o `serviceAccountKey.json` com o JSON completo da conta de serviço do
   Firebase (pode ser multi-linha — é um arquivo `.json`, não passa pelo dotenv).
   Valide: `node -e "JSON.parse(require('fs').readFileSync('serviceAccountKey.json','utf8')); console.log('OK')"`.
4. Suba com o pm2 e deixe persistente entre reboots:
   ```bash
   npm install -g pm2
   pm2 start index.js --name controle-financeiro-bot
   pm2 save && pm2 startup   # rode também o comando que o startup imprimir
   ```

**Atualizar o bot depois de um push no GitHub:**

```bash
cd ~/"Controle-Financeiro/Bot Render"
git pull
pm2 restart controle-financeiro-bot
```

> `.env` e `serviceAccountKey.json` estão no `.gitignore` — o `git pull` nunca
> os sobrescreve. Comandos úteis: `pm2 status`, `pm2 logs controle-financeiro-bot`.

**Credencial do Firebase (`index.js`):** a inicialização do Admin SDK prioriza
o arquivo `serviceAccountKey.json` (usado no VPS) e, se ele não existir, cai
para a variável de ambiente `FIREBASE_SERVICE_ACCOUNT` (compatível com o
antigo deploy no Render / `.env` em uma linha). Assim funciona nos dois cenários.

### 5. Deploy Automático (front-end)

Após configurar os Secrets, qualquer push na branch `main` com alterações em `public/` fará deploy automático no Firebase Hosting.

---

## Regras do Firestore (Segurança)

Configure no Console Firebase → Firestore → Regras:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Limites do Firestore (Plano Gratuito Spark)

| Operação | Limite/dia |
|----------|-----------|
| Leituras  | 50.000 |
| Gravações | 20.000 |
| Exclusões | 20.000 |

O sistema foi projetado para usar `onSnapshot` com eficiência e `limit()` nas queries do dashboard para não ultrapassar esses limites.

---

## Agente IA — Como Funciona

```
Usuário → Telegram (/agente pergunta)
  → Bot (Render) → GitHub Actions (repository_dispatch)
    → agente-ia.js (GitHub Actions)
      → Coleta dados do Firestore
      → Chama API Claude (claude-sonnet-4-6)
      → Claude decide: responder ou usar tool
        → Se tool: executa ação no Firestore e itera
        → Se fim: formata resposta
      → Envia resposta via Telegram API
  → Usuário recebe resposta no Telegram
```

O agente tem acesso a ferramentas:
- `registrar_saida` — lança despesa no BD
- `registrar_entrada` — lança receita no BD
- `excluir_lancamento` — remove lançamento do BD

---

## Sections do App

| Section | Rota | Descrição |
|---------|------|-----------|
| Dashboard | `#dashboard` | Resumo: últimas 5 entradas/saídas, orçamento, casa, patrimônio |
| Banco | `#banco` | Tabelas de entradas e saídas + formulário de registro |
| Distribuição | `#distribuicao` | Planilha de distribuição do salário por mês |
| Patrimônio | `#patrimonio` | Lista de ativos e investimentos |
| Contas Casa | `#contas-casa` | Contas domésticas Digo/Bella por mês |
