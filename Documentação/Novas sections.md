# Documentação — Novas Sections

---

## Section: Carro

### Visão Geral

Section de anotações do carro, dividida em 3 listas independentes. Não é uma planilha financeira — é um bloco de notas estruturado para rastrear manutenções pendentes, realizadas e preventivas.

**Rota:** `#carro`
**Arquivo JS:** `public/js/carro.js`
**Section HTML:** `<section id="section-carro" class="content-section">`

---

### Banco de Dados Firestore

#### Coleção: `carro_afazer`
Manutenções necessárias, ordenadas por prioridade (campo numérico `prioridade`).

```
{id_aleatorio}: {
  prioridade:  1,              // inteiro — define a ordem da lista (1 = mais urgente)
  descricao:   "Trocar pneu traseiro esquerdo",
  valor:        450.00         // preço estimado
}
```

#### Coleção: `carro_feitos`
Manutenções já realizadas, ordenadas por data (mais recente primeiro).

```
{id_aleatorio}: {
  data:        "2026-06-10",   // YYYY-MM-DD
  descricao:   "Troca de óleo",
  valor:        180.00
}
```

#### Coleção: `carro_manutencao`
Itens de manutenção preventiva periódica.

```
{id_aleatorio}: {
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
| `public/js/carro.js` | Criar — lógica da section (subscribe, render, forms) |
| `public/app.html` | Adicionar `<a data-section="carro">` no nav + `<section id="section-carro">` |
| `public/js/app.js` | Adicionar `import { initCarro }` e chamada no switch de sections |
| `Querys/carro-queries.js` | Criar — queries para o bot Telegram (opcional, fase 2) |

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
