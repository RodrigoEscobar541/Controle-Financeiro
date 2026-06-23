# A estrutra do sistema será bem parecida com uma planilha, em um arquivo exel há mais de uma planilhas (abas)

Primeira Section: Dashboard
Segunda Section: Entrada e saída
Terceira section: Planilha Distribuição Mensal do salario
Quarta section: Patrimonio
Quinta Section: Contas Casa

Funcionalidades:



## Primeira Section Dashboard Deve conter:
- Ultimas 5 saidas
- Ultimas 5 entradas
- Valor estipulado de gasto para o proximo mes (dado presente na terceira section)
- Gastos com a casa mês atual
- Total em R$ em investimentos

## Segunda Section Entrada e saída:
- O banco que eu uso é o Mercado Pago, então deve haver 2 tabelas, a primeira com todas as entradas, e a segunda com todas as saidas, e um campo para registrar entradas e saidas com: Descrição, valor e tipo
- Tabela entrada e saida deve conter a data do registro, descrição e valor.
- Detalhes sobre o BD em Arquitetura_BD_Firesrore.md

## Terceira section Planilha Distribuição Mensal do salario:
- A imagem @Distribuição Mensal.png mostra como deve ser
- Uma tabela com dados da coleção "Distribuição Mensal"
- Cada linha é um mês,e ao final, deve haver uma coluna ao final da tabela chamada "total" dizendo o valor total distribuido em cada mes, um dado que vem direto da soma da mesma linha
- Se a conta não foi paga não deve estar em verde, mas se ja foi, deve ficar em verde, o usuario deverá ser capaz de alternar a cor da "celula"
- Deve ser possivel cadastrar novas colunas, um "+" ao final da tabela, sendo possivel adicionar uma coluna ao final da tabela e dar nome, assim, cadastrando novos valores em uma nova coluna.

## Quarta section Patrimonio:
- Há uma imagem @Investimentos.png siga esse padrão, onde o usuario possa adicionar novos investimentos e tirar quando quiser, para isso serve o botao "+ Novo Ativo" na imagem

## Quinta Section Contas Casa deve ser:
- Deve haver um botão "salvar" onde salvará os dados atualizados da planilha/tabela no Banco da dados
- Tabela com os gastos mensais da casa, o Usuario deve poder acresentar atualizar e excluir uma coluna nova nessa tabela, com valores diferentes linha por linha, aonde os dados sera atualizado de forma manual pelo usuario
- Cada coluna será uma conta diferente da casa, e cada coluna deve ser atrelada a coluna Digo OU Bella, essas 2 colunas especificas devem ser fixas, pois aqui em casa cada um paga uma conta especifica por mes. Geralmente eu pago o mercado, e ela todas as outras, porem isso pode mudar, então no sistema, deve ser possivel fazer essa mudança, assim como é possivel fazer no exel
- Deve haver um campo apresentando o resultado do calculo: soma das contas do mes atual dividido por 2. E deve ser chamado de "Mês Atual/2"
- Mais detalhes para essa section vc acha no arquivo Controle Financeiro 2026.xlsm na planilha "contas casa".
- Veja a imagem @Contas de casa.png, a conta de luz ainda não foi paga, então eu ainda não coloquei como verde, o mesmo tipo de validação deve existir no sistema, uma forma do usuario colocar o verde ou tirar
- Cada linha da tabela é um mês
- As colunas "Data", "Total", "Bella" e "Digo" são fixas e seus nome vem direto do html, diferente das outras que vem do BD
