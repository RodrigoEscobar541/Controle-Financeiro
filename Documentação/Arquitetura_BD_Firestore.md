# Arquitetura do Banco de Dados (Firestore)

Limites do plano gratuito: 50k leituras/dia, 20k gravações/dia, 20k exclusões/dia.
O foco é não deixar passar desses números, manter o sistema atômico (sem
estados inconsistentes) e carregar tudo o que a interface precisa de uma vez
(evitar paginação desnecessária que gera mais idas ao banco).

Este documento descreve as coleções que **realmente existem hoje** no projeto
e, mais importante, a **convenção que deve ser seguida em qualquer alteração
futura de banco de dados** — leia a seção "Convenção para futuras alterações"
antes de criar uma coleção nova.

---

## Convenção para futuras alterações (leia antes de mexer no BD)

**Regra principal: 1 coleção por section.**

Quando uma section guarda vários "tipos" de registro relacionados (ex.: a
section Focus tem pendências, gastos feitos, manutenções e abastecimentos),
**não crie uma coleção separada por tipo**. Em vez disso, use **uma única
coleção** com um campo discriminador `tipo` (string) dentro de cada documento,
e guarde em cada documento só os campos que fazem sentido para aquele `tipo`.
É o mesmo padrão já usado em `banco` (`tipo: "Entrada"|"Saida"`) e em `dividas`
(`tipo: "Devo"|"Devem"`), e é o padrão que as sections Focus/Face passaram a
seguir (ver coleções `focus`/`face` abaixo) depois de começarem com 4
coleções cada uma — o que gerava bagunça e duplicação de lógica.

**Exceção: coleções de configuração.** Um doc de config que define metadados
(ex.: `config/distribuicao_colunas` guarda a lista de colunas da Distribuição
Mensal; `config/contas_casa_colunas` guarda quem paga cada conta por padrão)
é um padrão diferente e pode ficar separado da coleção de dados
transacionais — isso não é a mesma bagunça do "1 coleção por tipo", é
config vs. dado.

**Ao criar uma nova section fixa ou um novo template de section customizada
(`public/js/section-templates.js`):**
1. Defina `buildColecoes` retornando **1 chave** (`{ principal: slug }`),
   a menos que exista uma real necessidade de separar dado transacional de
   config (como em `distribuicao`, que usa `{ mensal, colunasConfig }`).
2. Se a section tiver sub-tipos de registro, use um campo `tipo` nos
   documentos da coleção `principal`, nunca uma coleção por tipo.
3. Ao escrever queries que misturam `where('tipo','==', X)` com `orderBy`
   num campo diferente (ex.: `data`), prefira **filtrar/ordenar em
   JavaScript** depois de um `onSnapshot`/`get()` simples na coleção inteira,
   em vez de depender de um índice composto do Firestore — mais simples de
   manter (nenhum índice para configurar) e, na escala pessoal deste app,
   o custo de leitura extra é desprezível.

---

## Acesso: admin e convidados

Desde a entrada do 2º usuário, o banco tem dono. O modelo é **admin +
convidados**, e as regras estão versionadas em `firestore.rules` (publicadas
pelo workflow `.github/workflows/deploy-firestore-rules.yml`).

- **Admin** — custom claim `admin: true` no token de autenticação. Vê e edita
  tudo. Não é documento e não custa leitura: viaja dentro do próprio token.
- **Convidado** — documento `permissoes/{uid}`. Section que não estiver no
  mapa simplesmente não existe para ele.

Os dois são definidos por `Bot Render/scripts/definir-acesso.js`.

### `permissoes`
```
{uid_do_usuario}: {
  nome:   "Bella",
  secoes: { "contas-casa": "leitura", "face": "escrita" },
  atualizadoEm: "2026-08-20T12:00:00.000Z"
}
```
Níveis: `"leitura"` (vê, não altera) e `"escrita"` (vê e altera). Ausência da
chave = sem acesso nenhum.

**Por que a permissão é por COLEÇÃO e não por documento:** as regras do
Firestore não filtram documentos dentro de uma query — elas liberam ou negam
um *caminho*. Se um único documento do resultado for negado, a query inteira
falha (não retorna parcial). Isso só funciona aqui porque o projeto já segue
"1 coleção por section"; é a convenção abaixo que torna o controle de acesso
possível, e furá-la quebra o modelo inteiro.

**⚠️ As regras NÃO valem para o bot.** O bot do Telegram e o Agente IA usam
`firebase-admin` (service account), que ignora `firestore.rules` por completo.
Qualquer restrição de convidado no bot precisa ser checada em código, dentro
de `Bot Render/`.

### Sections da Bella — sufixo `_bella`
As sections do 2º usuário usam **coleções próprias na raiz, com sufixo
`_bella`** (`banco_bella`, `dividas_bella`, …), ao lado das existentes.
Nenhum dado do admin foi movido.

| Section (slug de permissão) | Coleções |
|---|---|
| `banco-bella`         | `banco_bella` |
| `distribuicao-bella`  | `distribuicao_mensal_bella` + `config/distribuicao_colunas_bella` |
| `patrimonio-bella`    | `patrimonio_bella`, `reservas_bella` |
| `devo-devem-bella`    | `dividas_bella` |

O sufixo deixa a separação visível já no console do Firestore, sem precisar
abrir o código para saber de quem é o quê.

**Cada coleção nova exige um bloco explícito em `firestore.rules`.** Um
wildcard genérico (`match /{colecao}/{doc}` casando o nome da coleção com o
mapa de permissões) economizaria linhas, mas regras se combinam por **união**:
um bloco largo só consegue afrouxar o que está escrito nos outros, nunca
apertar. Explícito custa algumas linhas e não vaza por engano.

---

## Coleções em uso hoje

### `banco`
Transações financeiras (Mercado Pago). Um documento por lançamento.
```
{id_aleatorio}: {
  data:      "2026-06-23",     // YYYY-MM-DD
  tipo:      "Entrada"|"Saida",
  valor:     1500.00,
  descricao: "Salário"
}
```

### `patrimonio`
Ativos e investimentos.
```
{id_aleatorio}: {
  nomeDoAtivo:      "BTC",
  plataforma:       "Mercado Bitcoin",   // exibido como "Descrição"
  tipoInvestimento: "Criptomoeda",       // nome de uma divisão (patrimonioDivisoes)
  valor:            2180.00
}
```

### `patrimonioDivisoes`
Divisões do gráfico pizza da section Patrimônio (config/apoio, não é a mesma
bagunça do "1 coleção por tipo": é uma lista de categorias referenciada pelo
campo `tipoInvestimento` de `patrimonio`, não um sub-tipo de ativo).
```
{id_aleatorio}: { nome: "Criptomoeda", cor: "#EF6C00" }
```

### `reservas`
Reservas da section Patrimônio (a tabela de cima, separada dos ativos
investidos). Um documento por reserva.
```
{id_aleatorio}: {
  nome:     "Reserva de emergência",
  ondeEsta: "Nubank",
  valor:    5000.00
}
```

### `distribuicao_mensal`
Distribuição mensal do salário. Um documento por mês (`YYYY-MM`).

> **O nome da coluna é a chave do mapa, não um rótulo.** Renomear uma coluna
> (botão ✏️ no cabeçalho) reescreve o mapa `colunas` de **todos os meses já
> lançados**, num `writeBatch` em lotes de 400 — e o histórico inteiro passa a
> exibir o nome novo, não só dali pra frente. A gravação escreve o mapa
> `colunas` inteiro em vez de usar caminho de campo (`colunas.${nome}`), senão
> um nome com ponto viraria campo aninhado. O array em `config` é atualizado
> por **último**: se um lote falhar, o nome antigo continua valendo e a tabela
> segue coerente. Renomear para um nome que já teve lançamentos é recusado —
> sobrescreveria valores antigos sem aviso.
```
"2026-06": {
  dataMes: "06-2026",
  colunas: {
    "HBO":    { valor: 14.00, status: "naoPago" },
    "Seguro": { valor: 5.99,  status: "Pago"    }
  }
}
```

### `contas_casa`
Contas domésticas. Um documento por mês (`YYYY-MM`).
```
"2026-06": {
  dataMes: "06-2026",
  colunas: {
    "Mercado": { valor: 180.54, status: "Pago",    pagante: "Digo"  },
    "Luz":     { valor: 120.00, status: "naoPago", pagante: "Bella" }
  }
}
```

### `focus` (section Focus — Ford Focus) / `face` (section Face — outro carro)
1 coleção por carro. Um documento por registro, diferenciado pelo campo
`tipo`. É o exemplo concreto da convenção acima: antes eram 4 coleções por
carro (`*_afazer`, `*_feitos`, `*_manutencao`, `*_abastecimento`) — foram
consolidadas numa só.
```
focus/{id}  ou  face/{id}:

  tipo: "afazer"
    prioridade: 1        // definida automaticamente (maior atual + 1 = fim da fila),
                          // NUNCA pedida ao usuário — não aparece na UI
    descricao:  "Trocar pneu traseiro"
    valor:      450.00

  tipo: "feito"
    data:      "2026-06-10"   // YYYY-MM-DD
    descricao: "Troca de óleo"
    valor:     180.00

  tipo: "manutencao"
    descricao:      "Troca de óleo"
    data:           "2026-05-01"   // data da última troca
    kmUltimaTroca:  "52.400 km"
    kmProximaTroca: "57.400 km"
    valor:          180.00

  tipo: "abastecimento"
    data:            "2026-07-02"
    km:              350     // km rodado NESTE tanque, não é odômetro acumulado
    correcao:        10      // % a descontar do km informado (painel/GPS superestimado)
    litros:          30
    valorPago:       6.19    // preço POR LITRO (não o total); opcional, pode ser null
    tipoCombustivel: "Gasolina"
```
Sections customizadas criadas a partir do template "Novo Carro" seguem o
mesmo esquema (1 coleção = `secao.colecoes.principal`, campo `tipo`).

### `combustivel_tipos`
Tipos de combustível cadastrados, compartilhada entre Focus e Face (e
qualquer section customizada do template "carro"). Vem com Gasolina, Etanol
e Diesel; o usuário pode cadastrar outros (ex.: GNV).
```
{id_aleatorio}: { nome: "Gasolina" }
```

### `dividas`
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

### `secoes_customizadas`
Sections criadas pelo usuário (botão "+ Nova Section" ou pelo Agente IA).
```
{id_aleatorio}: {
  nome, slug, template ("banco"|"distribuicao"|"patrimonio"|"carro"|"devo-devem"),
  icone, colecoes: {...},          // formato depende do template — ver section-templates.js
  criadoEm, origem: "web"|"agente",
  ativo: true|false, excluidoEm: null|ISOString
}
```
Excluir uma section **nunca apaga dados**: uma section fixa só ganha uma
entrada em `config/secoes_ocultas`; uma customizada só tem `ativo` marcado
`false` — em ambos os casos a coleção/dados de origem continuam intactos.

### `config`
Configurações dinâmicas.
```
"distribuicao_colunas": { colunas: ["HBO","Netflix","Seguro",...] }
"contas_casa_colunas":  { colunas: { "Mercado": { defaultPagante:"Digo" }, ... }, ordem: [...] }
"secoes_ocultas":       { nomes: ["banco","distribuicao","patrimonio","contas-casa","focus","face","devo-devem"] }
                        // chaves das sections FIXAS que o usuário ocultou; "dashboard" nunca entra aqui
```

### `sistema`
Estado interno. Doc `status_bot` = heartbeat do bot (escrito a cada ~1 min
pelo próprio bot; o dashboard só lê para o selo online/offline).
```
"status_bot": {
  atualizado_em: "2026-07-18T21:00:00.000Z",
  iniciado_em:   "2026-07-18T20:31:00.000Z",
  versao:        "1.0.0"
}
```

### `notas`
Anotações livres por section. Um documento por chave de section (a mesma
chave usada em `data-section` no HTML / `secoes_ocultas`; sections
customizadas usam `custom-{slug}`).
```
"focus": { texto: "Lembrar de levar pro alinhamento em julho" }
```

### Coleções da Bella (`*_bella`)
Mesmo esquema das originais, só o nome muda. Criadas em 20/08/2026 com a
entrada do 2º usuário.

| Coleção | Espelha | Esquema |
|---|---|---|
| `banco_bella`               | `banco`               | idêntico |
| `distribuicao_mensal_bella` | `distribuicao_mensal`  | idêntico |
| `patrimonio_bella`          | `patrimonio`           | sem `tipoInvestimento` (a section dela não tem gráfico) |
| `reservas_bella`            | `reservas`             | idêntico |
| `dividas_bella`             | `dividas`              | idêntico |

Não há `patrimonioDivisoes_bella`: a section de Patrimônio dela não tem
gráfico de pizza, então não existem divisões a cadastrar.

Não há `banco_meta_bella`: o agregado de saldo existe para o **bot**
(`Querys/banco-queries.js`), e o bot ainda não opera sobre as coleções dela.
Se um dia operar, criar o agregado junto — sem ele, `getSaldo` faz full-scan.

O doc de config correspondente é `config/distribuicao_colunas_bella`.

### `agente_log`
Registro automático de cada interação do Agente IA (mensagem do usuário,
resposta e lista de ações realizadas no BD — leituras, escritas, exclusões).
Ver `Agente_Financeiro_IA.md`.

---

## Dados por section (referência rápida de UI → BD)

- **Dashboard:** últimas 5 saídas/entradas de `banco` (`limit(5)`); total do
  mês atual de `distribuicao_mensal` e `contas_casa`; soma de `patrimonio`.
- **Banco:** um documento por lançamento em `banco`.
- **Patrimônio:** um documento por ativo em `patrimonio`; divisões do gráfico
  em `patrimonioDivisoes`.
- **Distribuição Mensal:** um documento por mês em `distribuicao_mensal`;
  colunas definidas em `config/distribuicao_colunas`.
- **Contas Casa:** um documento por mês em `contas_casa`; colunas definidas
  em `config/contas_casa_colunas`.
- **Focus / Face:** ver coleções `focus`/`face` acima.
- **Devo/Devem:** um documento por parcela em `dividas`.
