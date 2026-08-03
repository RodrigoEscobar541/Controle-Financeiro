# Documentação — Novas Sections

---

## Section: Focus

> Chamada de "Carro" (e arquivo `carro.js`) quando foi criada originalmente.
> Depois de uma consolidação de banco de dados, o nome interno virou `focus`
> (igual ao rótulo já exibido no menu) e as 3 listas passaram a viver na
> mesma coleção — ver `Arquitetura_BD_Firestore.md` para o schema atual e a
> convenção de "1 coleção por section" que motivou a mudança.

### Visão Geral

Section de anotações do carro, dividida em 3 listas independentes. Não é uma planilha financeira — é um bloco de notas estruturado para rastrear manutenções pendentes, realizadas e preventivas.

**Rota:** `#focus`
**Arquivo JS:** `public/js/focus.js`
**Section HTML:** `<section id="section-focus" class="content-section">`

---

### Banco de Dados Firestore

Coleção única `focus`, um documento por registro, diferenciado pelo campo `tipo`
(ver `Arquitetura_BD_Firestore.md` para o schema completo e atualizado):

#### `tipo: "afazer"`
Manutenções necessárias, ordenadas por prioridade (campo numérico `prioridade`,
atribuída automaticamente como fim da fila — não é pedida ao usuário).

```
{id_aleatorio}: {
  tipo:        "afazer",
  prioridade:  1,              // inteiro — define a ordem da lista (1 = mais urgente)
  descricao:   "Trocar pneu traseiro esquerdo",
  valor:        450.00         // preço estimado
}
```

#### `tipo: "feito"`
Manutenções já realizadas, ordenadas por data (mais recente primeiro).

```
{id_aleatorio}: {
  tipo:        "feito",
  data:        "2026-06-10",   // YYYY-MM-DD
  descricao:   "Troca de óleo",
  valor:        180.00
}
```

#### `tipo: "manutencao"`
Itens de manutenção preventiva periódica.

```
{id_aleatorio}: {
  tipo:          "manutencao",
  descricao:     "Troca de óleo",
  data:          "2026-05-01",   // YYYY-MM-DD — data da última troca
  kmUltimaTroca: "52.400 km",   // string livre
  kmProximaTroca:"57.400 km",   // string livre
  valor:          180.00
}
```

---

### Estrutura Visual

A section é dividida em 3 blocos verticais (ou abas), cada um com sua própria tabela e formulário de adição:

#### 1. A Fazer
- Lista ordenada por `prioridade` (menor número = topo da lista)
- Colunas: `Prioridade` | `Descrição` | `Valor estimado` | `Ações`
- Formulário: Prioridade (número), Descrição (texto), Valor (R$)
- Ação de excluir via botão 🗑️

#### 2. Feitos
- Lista ordenada por `data` decrescente
- Colunas: `Data` | `Descrição` | `Valor` | `Ações`
- Formulário: Data (date picker), Descrição (texto), Valor (R$)
- Ação de excluir via botão 🗑️

#### 3. Manutenção Preventiva
- Lista sem ordenação específica (ordem de inserção)
- Colunas: `Descrição` | `Data última troca` | `KM última` | `KM próxima` | `Valor` | `Ações`
- Formulário: Descrição, Data (date picker), KM última troca (texto), KM próxima troca (texto), Valor (R$)
- Ação de editar (atualiza `data`, `kmUltimaTroca`, `kmProximaTroca`) + excluir 🗑️

---

### Arquivos a Criar/Alterar

| Arquivo | Alteração |
|---------|-----------|
| `public/js/focus.js` | Criar — lógica da section (subscribe, render, forms) |
| `public/app.html` | Adicionar `<a data-section="focus">` no nav + `<section id="section-focus">` |
| `public/js/app.js` | Adicionar `import { initFocus }` e chamada no switch de sections |
| `Querys/focus-queries.js` | Criar — queries para o bot Telegram (opcional, fase 2) |

---

## Bloco: Abastecimento (dentro das sections Focus e Face)

### Visão Geral

4º bloco dentro das sections de carro (`section-focus`/`focus.js` e `section-face`/
`face.js`), para registrar cada enchida de tanque e calcular km/L e R$/km de cada
carro. Segue o mesmo padrão dos outros blocos (onSnapshot + render + modal).

**Coleções por carro:** `focus` (section Focus) e `face` (section Face) — mesma
coleção única usada pelos outros 3 blocos da section, diferenciada pelo campo
`tipo: "abastecimento"`.

**Coleção compartilhada:** `combustivel_tipos` — lista gerenciável de tipos de
combustível (CRUD), usada pelas duas sections. Seedada com 3 defaults (Gasolina,
Etanol, Diesel) na primeira vez que estiver vazia.

---

### Banco de Dados Firestore

#### `tipo: "abastecimento"` (nas coleções `focus` / `face`)

```
{id_aleatorio}: {
  tipo:            "abastecimento",
  data:            "2026-07-02",  // YYYY-MM-DD, auto = hoje ao criar, editável
  km:               350,           // km rodado NESTE tanque (não é odômetro acumulado)
  correcao:         10,            // % a descontar do km informado (0 = sem correção)
  litros:           30,
  valorPago:        6.19,          // preço pago POR LITRO (não o total do abastecimento), opcional (null se não informado)
  tipoCombustivel:  "Gasolina"     // string solta, denormalizada de combustivel_tipos
}
```

`kmEfetivo = km * (1 - correcao/100)` é calculado no front, não persistido.
A partir dele: `km/L = kmEfetivo / litros` e `R$/km = (valorPago * litros) / kmEfetivo` (se houver valorPago).

#### Coleção: `combustivel_tipos`

```
{id_aleatorio}: { nome: "Gasolina" }
```

---

### Estrutura Visual

Card "⛽ Abastecimento", com botão "⚙️ Tipos" (abre modal de gerenciar tipos) e
"+ Registrar". Tabela: `Data | KM (com correção) | Litros | Combustível | Valor/L | km/L | R$/km | Ações`.

- Por padrão mostra só o registro mais recente; botão "Carregar mais" soma 5 por clique
  (mesmo mecanismo do bloco Feitos).
- Editar/excluir por botão ✏️/🗑️ por linha.
- No formulário de registro, o select de tipo tem uma opção "+ Novo tipo..." que
  revela um campo de texto — ao salvar, cria o tipo em `combustivel_tipos` antes de
  gravar o abastecimento.
- "Valor pago por litro" é opcional; o último valor digitado fica em `localStorage`
  (`tf_valorPago_focus` / `tf_valorPago_face`) só para pré-preencher o campo na
  próxima abertura do formulário — o valor em si sempre é salvo no Firestore.

---

### Arquivos Criados/Alterados

| Arquivo | Alteração |
|---------|-----------|
| `public/js/combustivel-tipos.js` | Criado — CRUD e modal de gerenciamento de `combustivel_tipos`, compartilhado entre as duas sections |
| `public/js/focus.js` | Bloco Abastecimento (`tipo:"abastecimento"` na coleção `focus`) |
| `public/js/face.js` | Bloco Abastecimento (`tipo:"abastecimento"` na coleção `face`) |
| `public/app.html` | Card "⛽ Abastecimento" nas duas sections, entre Feitos e Manutenção Preventiva |
| `Querys/focus-queries.js` / `Querys/face-queries.js` | CRUD de abastecimento para uso futuro do bot Telegram |
| `Querys/combustivel-tipos-queries.js` | Criado — CRUD de tipos de combustível para uso futuro do bot Telegram |

---

---

## Section: Devo e Devem

### Visão Geral

Section com 2 tabelas para controle de dívidas: o que o usuário **deve** a outros e o que **devem** a ele. Suporta registro à vista ou parcelado — no caso de parcelas, o sistema gera automaticamente um documento por mês no Firestore.

**Rota:** `#devo-devem`
**Arquivo JS:** `public/js/devo-devem.js`
**Section HTML:** `<section id="section-devo-devem" class="content-section">`

---

### Banco de Dados Firestore

#### Coleção: `dividas`
Cada documento representa **uma parcela** (ou o valor total se for à vista).

```
{id_aleatorio}: {
  tipo:      "Devo" | "Devem",   // quem deve a quem
  data:      "06-2026",          // MM-YYYY — mês de vencimento desta parcela
  descricao: "Carro",            // descrição da dívida
  valor:      5000.00,           // valor desta parcela (total / nº de parcelas)
  status:    "Aberta" | "Fechada"
}
```

**Exemplo — dívida de R$ 25.000 em 5x a partir de maio/2026:**

| data | descricao | valor | status |
|------|-----------|-------|--------|
| 05-2026 | Carro | 5000.00 | Fechada |
| 06-2026 | Carro | 5000.00 | Aberta |
| 07-2026 | Carro | 5000.00 | Aberta |
| 08-2026 | Carro | 5000.00 | Aberta |
| 09-2026 | Carro | 5000.00 | Aberta |

> A parcela do mês atual fica `"Aberta"`. Parcelas de meses já passados ficam `"Fechada"` no momento da criação.

---

### Formulário de Registro

O usuário preenche:

| Campo | Tipo | Observação |
|-------|------|------------|
| Tipo | Radio: `Devo` / `Devem` | — |
| Descrição | Texto | — |
| Parcelas | Número (opcional) | Vazio ou `1` = à vista |
| Valor | R$ (número) | Valor **total** da dívida |
| Data inicial | Texto `MM-AAAA` | Mês da 1ª parcela — autocomplete com mês atual |

**Lógica de geração das parcelas:**
- `valorParcela = valor / parcelas`
- Cria `n` documentos no Firestore, um por mês sequencial a partir da `data` informada
- Status: meses anteriores ao atual → `"Fechada"` | mês atual em diante → `"Aberta"`

---

### Estrutura Visual

A section é dividida em 2 tabelas lado a lado (ou empilhadas no mobile):

#### Tabela "Devo"
- Filtra `tipo === "Devo"`
- Colunas: `Mês` | `Descrição` | `Valor` | `Status` | `Ações`
- Status visual: badge verde para `Fechada`, laranja para `Aberta`
- Ação: marcar como `Fechada` ✓ + excluir 🗑️ (exclui **todas** as parcelas da mesma descrição + data-bloco, ou apenas a parcela selecionada — a definir)

#### Tabela "Devem"
- Filtra `tipo === "Devem"`
- Mesmas colunas e ações da tabela "Devo"

#### Totais por tabela
- Total `Aberta` de cada tabela exibido no rodapé (quanto ainda falta pagar / receber)

---

### Arquivos a Criar/Alterar

| Arquivo | Alteração |
|---------|-----------|
| `public/js/devo-devem.js` | Criar — lógica da section (subscribe, render, form, geração de parcelas) |
| `public/app.html` | Adicionar `<a data-section="devo-devem">` no nav + `<section id="section-devo-devem">` |
| `public/js/app.js` | Adicionar `import { initDevoDeve }` e chamada no switch de sections |
| `Querys/dividas-queries.js` | Criar — queries para o bot Telegram (opcional, fase 2) |

---

## Feature: "+ Nova Section" (sections dinâmicas/customizadas)

### Visão Geral

Botão no menu lateral que permite criar novas sections em tempo real, sem alterar
código, a partir de 5 templates — réplicas fiéis (porém vazias/zeradas) das
sections fixas: **Banco**, **Tabela Distribuição**, **Patrimônio**, **Novo Carro**
e **Devo/Devem**. O nome escolhido pelo usuário vira o `slug` que nomeia as
coleções no Firestore.

Também é possível **excluir qualquer section** (fixa ou customizada) pelo menu —
a exclusão nunca apaga dados: só oculta a section do menu/dashboard, exigindo que
o usuário digite o nome exato para confirmar. O `/agente` do bot Telegram tem as
mesmas capacidades via as ferramentas `criar_secao`, `excluir_secao` e
`listar_secoes`.

**Botões:** `#btn-nova-secao` / `#btn-excluir-secao` (sidebar, abaixo do `.nav-list`)

---

### Banco de Dados Firestore

#### Coleção: `secoes_customizadas`
Uma section criada pelo usuário (ou pelo agente) a partir de um template.

```
{id_aleatorio}: {
  nome:       "Moto",                          // nome de exibição, escolhido pelo usuário
  slug:       "moto",                          // gerado a partir do nome — nomeia as coleções
  template:   "banco"|"distribuicao"|"patrimonio"|"carro"|"devo-devem",
  icone:      "🚗",
  colecoes:   { ... },                         // nomes de coleção, montados a partir do slug
  criadoEm:   "2026-07-03T...",                // ISO string
  origem:     "web"|"agente",
  ativo:      true,
  excluidoEm: null                             // ISO string quando excluída (soft delete)
}
```

Mapeamento de `colecoes` por template (a partir do `slug`):
- `banco` / `patrimonio` / `devo-devem` / `carro` → `{ principal: slug }`
  (no template `carro`, os registros dentro de `principal` são diferenciados
  pelo campo `tipo`, igual às coleções `focus`/`face` — compartilha a coleção
  global `combustivel_tipos` com Focus/Face)
- `distribuicao` → `{ mensal: "{slug}_mensal", colunasConfig: "{slug}_colunas" }`

#### Documento: `config/secoes_ocultas`
Sections **fixas** ocultadas pelo usuário (nunca inclui `"dashboard"`).

```
{ nomes: ["focus", "banco"] }
```

---

### Estrutura Visual

- **Nova Section:** modal com `<select>` de template (mostra descrição ao trocar) +
  campo de nome. Ao confirmar, a section aparece na hora no menu, ganha um card no
  dashboard e o usuário é levado direto para ela (já vazia, pronta para uso).
- **Excluir Section:** modal com `<select>` de todas as sections visíveis (exceto
  Dashboard) + campo "digite o nome exato para confirmar" (nome atualizado
  dinamicamente ao trocar a seleção).
- Cada template customizado é uma réplica genérica do original (`public/js/custom-sections.js`),
  incluindo o bloco de Anotações (`notas/custom-{slug}`), parametrizada só pelas
  coleções do Firestore — nenhum HTML novo precisa ser escrito por section.

---

### Arquivos Criados/Alterados

| Arquivo | Alteração |
|---------|-----------|
| `public/js/section-templates.js` | Criado — registro dos 5 templates, `slugify`, CRUD de `secoes_customizadas` e `config/secoes_ocultas` |
| `public/js/custom-sections.js` | Criado — renderização genérica dos 5 templates + `metricaSecao` para o card do dashboard |
| `public/js/app.js` | Botões Nova/Excluir Section, nav + `<section>` dinâmicos, `activateSection` estendido para `custom-{slug}`, ocultação de sections fixas no boot |
| `public/js/dashboard.js` | Card por section customizada ativa (`adicionarCardSecaoCustomizada`/`removerCardSecaoCustomizada`) |
| `public/app.html` | `data-dash-section` nos cards fixos do dashboard (para ocultar), `id="dashboard-grid"`, botões `#btn-nova-secao`/`#btn-excluir-secao` |
| `public/css/styles.css` | `.sidebar-actions`, `.btn-sidebar-action`, `.form-hint` |
| `Bot Render/commands/agente.js` | Ferramentas `criar_secao`, `excluir_secao`, `listar_secoes` (mesma lógica de templates/slug do front) |
