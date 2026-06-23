# Glossário — Controle Financeiro

Termos usados nos arquivos de documentação deste projeto.

---

| Termo | Significado |
|-------|-------------|
| **Firebase** | Plataforma do Google que oferece Hosting (hospedagem), Firestore (BD), e Authentication |
| **Firebase Hosting** | Serviço de hospedagem de sites estáticos (HTML/CSS/JS) do Firebase, acessível via link HTTPS |
| **Firestore** | Banco de dados NoSQL orientado a documentos do Firebase (substituto do Firebase Realtime DB) |
| **Authentication** | Serviço do Firebase que gerencia login/senha e autenticação de usuários |
| **GitHub Actions** | Sistema de CI/CD do GitHub que executa scripts automaticamente em resposta a eventos (push, dispatch, etc.) |
| **repository_dispatch** | Evento do GitHub que permite acionar um workflow externamente (ex: bot → GitHub Actions) |
| **Railway** | Plataforma de hospedagem de aplicações Node.js (onde o bot Telegram fica rodando 24/7) |
| **Bot Telegram** | Robô que roda no Telegram e responde a comandos como /saida, /entrada, /saldo, /agente |
| **BotFather** | Bot oficial do Telegram para criar e gerenciar outros bots. Acesso: t.me/BotFather |
| **Token** | Chave de acesso única que autentica um serviço ou aplicação (ex: token do bot Telegram) |
| **Anthropic / Claude** | Empresa de IA e seu modelo de linguagem (LLM) respectivamente. API usada pelo Agente IA |
| **API Key** | Chave de acesso à API (Application Programming Interface) de um serviço externo |
| **Service Account** | Conta de serviço do Google/Firebase usada por aplicações backend para acessar recursos sem login de usuário |
| **Secret (GitHub)** | Variável de ambiente criptografada armazenada no GitHub, usada em GitHub Actions |
| **ES Module** | Sistema moderno de módulos JavaScript que usa `import`/`export` (usado no frontend) |
| **CommonJS** | Sistema de módulos JavaScript que usa `require`/`module.exports` (usado no backend/Node.js) |
| **onSnapshot** | Função do Firestore que fica "ouvindo" mudanças em tempo real em uma coleção ou documento |
| **collection** | Agrupamento de documentos no Firestore (equivalente a uma tabela no SQL) |
| **document** | Registro individual no Firestore com campos (equivalente a uma linha no SQL) |
| **Entrada** | Receita: dinheiro que entra (salário, freelance, etc.) |
| **Saída** | Despesa: dinheiro que sai (mercado, cinema, contas, etc.) |
| **Patrimônio** | Conjunto de ativos e investimentos (BTC, ações, tesouro, etc.) |
| **Distribuição Mensal** | Planilha de como o salário é distribuído em despesas fixas mensais |
| **Contas Casa** | Tabela de contas domésticas compartilhadas entre Digo e Bella |
| **Pagante** | Quem paga uma determinada conta da casa (Digo ou Bella) |
| **Mês Atual/2** | Total das contas da casa do mês atual dividido por 2 (divisão igualitária) |
| **Tool Use** | Recurso da API do Claude onde o modelo pode chamar funções externas para agir no mundo real |
| **Agente IA** | Modelo Claude configurado com ferramentas que pode ler e escrever no Firestore |
| **SDK** | Software Development Kit — conjunto de ferramentas para integrar com uma plataforma (ex: Firebase SDK) |
| **CDN** | Content Delivery Network — rede de servidores que entrega arquivos rapidamente (usado para Firebase SDK via URL) |
| **SPA** | Single Page Application — aplicação web de página única que não recarrega ao navegar |
| **Deploy** | Publicação de uma versão do código em produção (ex: deploy no Firebase Hosting) |
| **CI/CD** | Continuous Integration / Continuous Deployment — automação de testes e publicações |
| **Plano Spark** | Plano gratuito do Firebase (50k leituras/dia, 20k gravações/dia, 20k exclusões/dia) |
