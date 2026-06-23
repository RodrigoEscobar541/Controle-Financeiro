Esse arquivo explica como os comandos enviados para o bot do telegram devem funcinar

/saida Registrador de despesas 
Esse comando deve registrar uma saida, o usuario digitará: "/saida cinema 42,88" e o algoritmo deve lançar uma saida no Banco de Dados com essa descrição, data e valor

/entrada Registrador de receita 
Esse comando deve gerar uma entrada no BD o usuario colocará "/entrada salário 8556" e o algoritmo deve lançar a descrição, o valor e a data no Banco de dados

/saldo Consultar saldo 
Quando o usuario solicitar "/saldo" deve retornar o saldo final entre as entradas e saida, basicamento um entradas-saida = saldo bem simples

/agente Executar agente IA
Esse comando diz mais em @Agente_Financeiro_IA.md

Quem ficará ouvindo as mensagens do telegram, será o Railway
Tudos os arquivo referente ao bot, coloque na pasta @Bot Railway
Me auxilie se necessario, fazer essa conectividade como o railway