Atue como um profissional em arquitetura de Banco de dados com alto conhecimento em firestore. Temos o limite de 50k de leituras por dias, e 20k de gravação e 20k de exclusões.
O foco é não deixar passar desses 50k
E Manter o sistema atomico e sem falhas
Todas as query devem ser carregadas para melhorar a experiencia do usuario

## Dados section Dashboard:
- Para pegar as ultimas 5 saidas, a query deve procurar as ultimas 5 saidas pela data na coleção "Banco" com limit(5) para não gastar Leitura
- Para pegar as ultimas 5 Entradas, a query deve procurar as ultimas 5 Entradas pela data na coleção "Banco" com limit(5) para não gastar Leitura
- Pega o resultado da coluna "total" na section "Distribuição Mensal" referente ao mes atual
- Pega o dado da coluna "total" na section "Contas casa" referente ao mes atual
- Pega o total dos valores de cada documento na coleção "Patrimonio"

## Dados Section Entrada e saída:
- Coleção "Banco"
- Gere um documento com codigo aleatorio com os campos:
    Data: "xx-xx-xxxx" (Autocomplete)
    Tipo: "Saida" (Vem do input=radio do html) (Usuario preenche)
    Valor: "100" (Usuario preenche)
    Descrição: "cinema" (Usuario preenche)

- Outro documento:
    Data: "xx-xx-xxxx" (Autocomplete)
    Tipo: "Entrada" (Vem do input=radio do html) (Usuario preenche)
    Valor: "150" (Usuario preenche)
    Descrição: "paga" (Usuario preenche)

## Dados Section Patrimonio:
- Coleção "Patrimonio"
- Gere um documento com codigo aleatorio com os campos:
    NomeDoAtivo: "BTC" (usuario preenche)
    Plataforma: "Mercado Bitcoin" (usuario preenche)
    Valor: "2,180" (usuario preenche)
- O usuario atualizara esses campos se achar necessario


## Dados Section Distribuição Mensal:
- Coleção "Distribuição Mensal"
- Gere um documento com codigo aleatorio com os campos:
    dataMes: "xx-xxxx" (autocomplete)
    ColunaName: "Seguro cartao MP" (usuario preenche ao abrir a coluna)
    Valor: "5,99" (usuario preenche)
    Status "Pago" (preenchido como verde como diz em @Estrutura do sistema.md) (usuario Atualiza)

- Outro documento:
    dataMes: "xx-xxxx" (autocomplete)
    Coluna: "HBO" (usuario preenche ao abrir a coluna)
    Valor: "14" (usuario preenche)
    Status: "naoPago" (usuario Atualiza)


## Dados da section Contas casa:
- Coleção "Contas casa"
- Gera um documnto com codigo aleatorio com os campos:
    dataMes: "xx-xxxx" (autocomplete)
    Pagante: "Bella" (usuario escolhe)
    ColunaName: "Mercado" (usuario preenche)
    Valor: "180.54" (usuario preenche)
    Status: "Pago" (preenchido como verde como diz em @Estrutura do sistema.md) (usuario Atualiza)

- Outro documento:
    dataMes: "xx-xxxx" (autocomplete)
    Pagante: "Digo" (usuario escolhe)
    Coluna: "Luz" (usuario preenche)
    Valor: "180.54" (usuario preenche)
    Status: "naoPago" (usuario Atualiza)

