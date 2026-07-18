# CLAUDE.md — Controle Financeiro

Atue como um engenheiro de software com 20 anos de experiencia, qualquer duvida para um sistema perfeito, pergunte para mim

## Status do Projeto

✅ **Sistema criado e completo.** As instruções abaixo desta seção são históricas (fase de criação) e não são mais necessárias para operação.

---

## Regras Permanentes (sempre válidas)

- **Sempre fazer `git pull` antes de qualquer alteração**
- **Sempre fazer push no GitHub** (não no Firebase diretamente — o GitHub Actions faz o deploy automático)
- **Queries ao Firestore devem ficar na pasta `Querys/`** (para o bot Render)
- **Sempre que alterar código que o Agente usa, atualizar `Agente_Financeiro_IA.md`** para garantir que o agente não quebre
## Git Commit Convention

Sempre que realizar um commit, seguir o padrão **Conventional Commits**.

### Formato

```text
<emoji> <tipo>: <descrição curta>
```

Exemplos:

```text
✨ feat: adicionar cálculo de consumo por tanque
🐛 fix: corrigir erro na validação do hodômetro
♻️ refactor: reorganizar lógica de cálculo
📚 docs: atualizar documentação do projeto
🎨 style: padronizar formatação do código
⚡ perf: otimizar processamento dos registros
🧪 test: adicionar testes para cálculo de autonomia
🔧 chore: atualizar dependências do projeto
🚑 hotfix: corrigir falha crítica na produção
```

### Tipos permitidos

| Emoji | Tipo | Quando usar |
|--------|------|-------------|
| ✨ | feat | Nova funcionalidade. |
| 🐛 | fix | Correção de bug. |
| 🚑 | hotfix | Correção urgente em produção. |
| ♻️ | refactor | Reorganização do código sem alterar o comportamento. |
| ⚡ | perf | Melhoria de desempenho. |
| 🎨 | style | Alterações de formatação ou estilo do código, sem modificar sua lógica. |
| 🧪 | test | Adição ou alteração de testes. |
| 📚 | docs | Alterações na documentação. |
| 🔧 | chore | Manutenção do projeto, configurações, dependências, scripts, CI/CD, etc. |

### Regras

- Utilizar sempre o tipo mais específico possível.
- A descrição deve ser curta, objetiva e escrita em português.
- Escrever a descrição no infinitivo, por exemplo:
  - `✨ feat: adicionar autenticação`
  - `🐛 fix: corrigir cálculo de consumo`
  - `♻️ refactor: simplificar módulo de relatórios`
- Não utilizar mensagens genéricas como `update`, `ajustes`, `mudanças`, `coisas`, etc.
- Cada commit deve representar uma alteração lógica única.
---

## Estrutura do Projeto

Veja `documentação.md` na raiz do projeto para a documentação completa.

**Resumo dos arquivos:**
- `public/` → App web (Firebase Hosting)
- `Querys/` → Queries Firestore para o bot
- `Bot Render/` → Bot Telegram (roda no **VPS Contabo** via pm2; a pasta mantém o nome antigo por histórico)
- `scripts/agente-ia.js` → Agente IA (roda no GitHub Actions)
- `.github/workflows/` → CI/CD automático

> **Hospedagem do bot (desde 2026-07-18):** migrado do Render para um **VPS
> Contabo (Linux) + pm2**. O UptimeRobot foi desativado (era só para manter o
> Render acordado). Como atualizar o bot no VPS e detalhes da credencial do
> Firebase (`serviceAccountKey.json` com fallback para `FIREBASE_SERVICE_ACCOUNT`):
> ver `documentação.md` → seção "VPS Contabo (Bot)".

---

## Tokens e Keys necessários

Para configurar o sistema do zero, você precisará de:

| Token/Key | Onde obter | Onde colocar |
|-----------|-----------|-------------|
| Firebase Config (apiKey, projectId, etc.) | Console Firebase → Configurações → Seus Apps | `public/js/firebase-config.js` |
| Firebase Project ID | Console Firebase | `.firebaserc` |
| Firebase Service Account (JSON) | Console Firebase → Contas de Serviço | GitHub Secret: `FIREBASE_SERVICE_ACCOUNT` (Actions) + arquivo `Bot Render/serviceAccountKey.json` no VPS (bot) |
| Telegram Bot Token | @BotFather no Telegram → /newbot | GitHub Secret `TELEGRAM_BOT_TOKEN` + `Bot Render/.env` |
| Anthropic API Key | console.anthropic.com | GitHub Secret: `ANTHROPIC_API_KEY` |
| GitHub Personal Access Token | GitHub → Settings → Developer settings → PAT | `Bot Render/.env` como `GITHUB_TOKEN` |

---

<!-- ============================================================
     HISTÓRICO — CRIAÇÃO DO SISTEMA (não mais necessário)
     ============================================================

     As instruções abaixo foram usadas para criar o sistema e
     não são mais necessárias. Mantidas apenas como referência.

     ## Para criar o sistema (CONCLUÍDO em 2026-06-23):
     Atue como um engenheiro de software para criar o sistema "Controle Financeiro"
     Para isso use o arquivo @O_que_é_o_sistema.md para entender mais sobre o sistema
     Após gerar o codigo completo do sistema, atualize o arquivo @Agente_Financeiro_IA.md
     
     Sempre faça o push no repositorio do github, e não no firebase,
     pois do github vai direto pro firebase!
     Sempre faça pull do repositório antes de fazer alguma alteração
     
     As quersy ao firestore deve ficar dentro da pasta @Querys
     
     Gere um arquivo chamado documentação.md para explicar td sobre esse projeto em um doc só
     
     Me instrua para colocar os tokens necessario, como key do telegram, e do claude
     
     Reestruturar claude.md:
     Após criar todo o sistema com exatidao e completo, Comente aqui as informações
     pertinentes apenas a criação do sistema, deixando claro que é coisa antiga
     
     Cire um glossario se necessario das palavras neste .md e nos outros dentro da pasta Documentação
     
     Deve ter: Sempre que alterar o codigo, se envolver algo que o agente deve saber
     presente em @Agente_Financeiro_IA.md, atualize esse .md com o novo codigo,
     garantindo assim que o agente nunca quebre ou erre!
     ============================================================ -->
