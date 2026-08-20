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
│       ├── permissoes.js          ← Papel do usuário: podeVer / podeEditar
│       ├── secoes-bella.js        ← Registro das sections do 2º usuário
│       ├── app.js                 ← Controlador principal + utilitários
│       ├── dashboard.js           ← Section Dashboard
│       ├── banco.js               ← Section Banco (entradas/saídas)
│       ├── distribuicao.js        ← Section Distribuição Mensal
│       ├── patrimonio.js          ← Section Patrimônio
│       ├── contas-casa.js         ← Section Contas da Casa
│       ├── section-templates.js   ← Registro de sections fixas e templates
│       └── custom-sections.js     ← Monta sections a partir de um template
│
├── firestore.rules                ← Regras de segurança (NÃO edite pelo console)
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
Ativos e investimentos. Campos exibidos na tabela como **Ativo**, **Descrição**
(campo `plataforma`), **Tipo de investimento** (campo `tipoInvestimento` —
nome de uma divisão do gráfico pizza) e **Valor investido** (campo `valor`).
Os nomes internos dos campos `plataforma`/`valor` foram mantidos; só os rótulos
da interface mudaram.
```
{id_aleatorio}: {
  nomeDoAtivo:      "BTC",
  plataforma:       "Mercado Bitcoin",   // exibido como "Descrição"
  tipoInvestimento: "Criptomoeda",       // nome de uma divisão (patrimonioDivisoes)
  valor:            2180.00              // exibido como "Valor investido"
}
```

### Coleção: `patrimonioDivisoes`
Divisões do gráfico pizza da section Patrimônio (adicionar/alterar/excluir pela
interface). Cada linha da tabela `patrimonio` referencia uma divisão pelo nome
(`tipoInvestimento`); o gráfico soma o `valor` investido de todas as linhas com
o mesmo `tipoInvestimento`. Ativos sem tipo definido são desconsiderados no
gráfico. As cores são atribuídas automaticamente (paleta harmônica), mas podem
ser editadas.
```
{id_aleatorio}: {
  nome: "Criptomoeda",
  cor:  "#EF6C00"        // hex
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

### Coleção: `sistema`
Estado interno do sistema. Doc `status_bot` = heartbeat do bot (escrito só pelo
bot, a cada ~1 min; a dashboard só lê para o selo online/offline).
```
"status_bot": {
  atualizado_em: "2026-07-18T21:00:00.000Z",  // último batimento
  iniciado_em:   "2026-07-18T20:31:00.000Z",  // boot do processo (uptime)
  versao:        "1.0.0"
}
```

### Coleção: `focus` (section Focus) / `face` (section Face)
1 coleção por carro — um documento por registro, diferenciado pelo campo `tipo`
(`"afazer"|"feito"|"manutencao"|"abastecimento"`). Ver `Arquitetura_BD_Firestore.md`
para o schema completo de cada `tipo` e a convenção por trás dessa modelagem.

### Coleção: `dividas`
Devo/Devem. Um documento por parcela.
```
{id_aleatorio}: {
  tipo:      "Devo"|"Devem",
  data:      "06-2026",       // MM-YYYY
  descricao: "Empréstimo Nubank (2/6)",
  valor:     150.00,
  status:    "Aberta"|"Paga"
}
```

### Coleção: `combustivel_tipos`
Tipos de combustível cadastrados, compartilhada entre as sections Focus e Face.
```
{id_aleatorio}: { nome: "Gasolina" }
```

### Coleção: `secoes_customizadas`
Sections criadas pelo usuário (botão "+ Nova Section"). Ver cabeçalho de
`public/js/section-templates.js` para o schema completo.

### Coleção: `agente_log`
Registro automático de cada interação do Agente IA (mensagem, resposta e ações
realizadas no BD). Ver `Agente_Financeiro_IA.md`.

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

**Deploy automático (cron na VPS):** todo push na `main` vira produção em até
~2 min, sem intervenção. O script `scripts/vps-deploy.sh` (versionado) é chamado
por um cron: faz `git fetch`, e só quando há commit novo puxa, checa a sintaxe
do `index.js` e reinicia o bot pelo pm2 (não sobe código com erro de sintaxe).

Requisito para o cron funcionar sem senha: o repositório na VPS precisa usar
**SSH com deploy key** (o `git pull` por HTTPS pediria token a cada vez).
Instalação (uma vez):

```bash
# 1) chave SSH dedicada a este repo
ssh-keygen -t ed25519 -C "vps-deploy-cf" -f ~/.ssh/id_deploy_cf -N ""
# 2) alias de host (para conviver com a deploy key de outros repos)
cat >> ~/.ssh/config <<'EOF'

Host github-cf
  HostName github.com
  IdentityFile ~/.ssh/id_deploy_cf
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
cat ~/.ssh/id_deploy_cf.pub   # → GitHub: repo Controle-Financeiro → Settings → Deploy keys → Add (só leitura)
# 3) apontar o remote para SSH via o alias e testar
cd ~/Controle-Financeiro
git remote set-url origin git@github-cf:RodrigoEscobar541/Controle-Financeiro.git
ssh -T git@github-cf && git pull
# 4) agendar o deploy
chmod +x scripts/vps-deploy.sh
crontab -e   # adicionar:
# */2 * * * * /root/Controle-Financeiro/scripts/vps-deploy.sh >> /root/deploy-cf.log 2>&1
```

Acompanhar: `tail -f /root/deploy-cf.log`. Deploy/atualização manual, se
precisar: `bash ~/Controle-Financeiro/scripts/vps-deploy.sh`.

> `.env` e `serviceAccountKey.json` estão no `.gitignore` — o `git pull` nunca
> os sobrescreve. Comandos úteis: `pm2 status`, `pm2 logs controle-financeiro-bot`.

**Status do bot (heartbeat):** o bot grava `sistema/status_bot` no Firestore a
cada ~1 min (`atualizado_em`, `iniciado_em`, `versao`). A dashboard (topo do
Dashboard) mostra um selo 🟢 **online** (batimento < 3 min) / 🔴 **offline**,
que vira offline sozinho se o bot cair — substitui o antigo monitor externo.

**Credencial do Firebase (`index.js`):** a inicialização do Admin SDK prioriza
o arquivo `serviceAccountKey.json` (usado no VPS) e, se ele não existir, cai
para a variável de ambiente `FIREBASE_SERVICE_ACCOUNT` (compatível com o
antigo deploy no Render / `.env` em uma linha). Assim funciona nos dois cenários.

### 5. Deploy Automático (front-end)

Após configurar os Secrets, qualquer push na branch `main` com alterações em `public/` fará deploy automático no Firebase Hosting.

---

## Regras do Firestore (Segurança)

> ⚠️ **Não configure regras pelo console.** Elas vivem em **`firestore.rules`,
> versionado na raiz do repositório**. Colar regras direto no console
> sobrescreve o arquivo silenciosamente — e a versão que está no Git passa a
> mentir sobre o que está no ar.
>
> A regra genérica `allow read, write: if request.auth != null`, que já esteve
> aqui, hoje **desfaria todo o controle de acesso**: liberaria a Bella para ler
> e escrever tudo, inclusive o que ela nem vê na tela.

O modelo é **admin + convidados** — ver `Arquitetura_BD_Firestore.md`, seção
"Acesso: admin e convidados", para a estrutura completa.

**Antes de mudar as regras**, valide sem publicar:

```bash
firebase deploy --only firestore:rules --dry-run
```

**Para publicar:** faça push do `firestore.rules` para o `main`. O workflow
`.github/workflows/deploy-firestore-rules.yml` cuida do resto.

> 🔧 **Pendência conhecida:** esse workflow falha hoje com
> `403 Permission denied to get service [firestore.googleapis.com]`. A conta de
> serviço do secret `FIREBASE_SERVICE_ACCOUNT` foi criada só para Hosting e
> precisa dos papéis **Firebase Rules Admin** e **Service Usage Consumer** no
> Google Cloud. Enquanto isso não for concedido, mudanças em regras não sobem
> pelo CI.

---

## Multiusuário (admin e convidados)

O sistema nasceu para um usuário só e ganhou um segundo em 20/08/2026.

| Papel | Como é identificado | O que enxerga |
|---|---|---|
| **Admin** | custom claim `admin: true` no token | tudo |
| **Convidado** | documento `permissoes/{uid}` | só as sections listadas nele |

O claim de admin **não custa leitura**: viaja dentro do próprio token de
autenticação. Só o convidado paga um `get()` do documento de permissões.

### Conceder e revogar acesso

```bash
cd "Bot Render"
npm install                                              # uma vez

node scripts/definir-acesso.js admin seu-email@gmail.com
node scripts/definir-acesso.js convidado <uid|email> "Nome" contas-casa:leitura face:escrita
node scripts/definir-acesso.js listar                    # o que está valendo
node scripts/definir-acesso.js convidado <uid|email> "Nome" face:nenhum   # revogar
```

Níveis: `leitura`, `escrita`, `nenhum`. Rodar de novo **mescla** — conceder
uma section não revoga as outras.

### ⚠️ Ordem importa no primeiro deploy

As regras fecham tudo para quem não é admin. Publicá-las **antes** de definir
o admin tranca você para fora do próprio app. A ordem correta é:

1. `definir-acesso.js admin <seu-email>`
2. conferir com `listar`
3. só então publicar

Se a ordem for invertida, o app mostra uma tela "Sem acesso" explicando o
conserto, em vez de abrir em branco.

### ⚠️ O bot e o Agente IA ignoram as regras

`Bot Render/` usa `firebase-admin` (service account), que **passa por cima de
`firestore.rules` por completo**. Qualquer restrição de convidado no bot
precisa ser checada em código. Hoje o bot atende um único `chat_id`
autorizado (o do admin) — se um convidado ganhar acesso ao bot, essa checagem
passa a ser obrigatória.

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
| Focus | `#focus` | Carro: a fazer, feitos, manutenções, abastecimentos |
| Face | `#face` | Idem, para o outro carro |
| Devo / Devem | `#devo-devem` | Dívidas em aberto e quitadas, por parcela |

### Sections da Bella (2º usuário)

Definidas em `public/js/secoes-bella.js` e montadas por `custom-sections.js` —
não têm HTML próprio. Usam coleções com sufixo `_bella`, ao lado das
existentes; nenhum dado do admin é compartilhado por elas.

| Section | Chave de permissão | Coleções |
|---|---|---|
| Dashboard | `dashboard-bella` | nenhuma (agrega as demais) |
| Distribuição | `distribuicao-bella` | `distribuicao_mensal_bella` + `config/distribuicao_colunas_bella` |
| Banco | `banco-bella` | `banco_bella` |
| Devo / Devem | `devo-devem-bella` | `dividas_bella` |
| Patrimônio | `patrimonio-bella` | `patrimonio_bella`, `reservas_bella` |

O **Patrimônio dela não tem gráfico de pizza** nem a coluna "Tipo de
investimento" — só as tabelas de Reservas e de Ativos.

**Compartilhadas com o admin** (coleções originais, sem cópia): Contas da Casa
em `leitura` e Face em `escrita`. As duas aparecem como card no dashboard
dela — a Face com consumo médio (km/L e custo por km), a mesma conta do
dashboard do admin.

> A **chave** de cada section é a mesma string em três lugares: `data-section`
> no menu, id do documento em `notas/{chave}` e chave em
> `permissoes/{uid}.secoes`. Divergir em qualquer um deles faz a section
> aparecer e quebrar com "sem permissão" ao ser usada.

### Ordem do menu

O admin vê as sections fixas na ordem do HTML e, ao final, o grupo **BELLA**
atrás de um cabeçalho. O convidado vê a própria ordem, definida em
`ORDEM_SIDEBAR_BELLA`, sem cabeçalho — ele não precisa de um rótulo dizendo
que as sections dele são dele.

Cada usuário tem **um** dashboard: o admin entra no Dashboard geral, o
convidado no dele. Ter os dois no mesmo menu mostraria cards de sections que a
pessoa não enxerga.
