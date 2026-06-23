# CLAUDE.md — Controle Financeiro

## Status do Projeto

✅ **Sistema criado e completo.** As instruções abaixo desta seção são históricas (fase de criação) e não são mais necessárias para operação.

---

## Regras Permanentes (sempre válidas)

- **Sempre fazer `git pull` antes de qualquer alteração**
- **Sempre fazer push no GitHub** (não no Firebase diretamente — o GitHub Actions faz o deploy automático)
- **Queries ao Firestore devem ficar na pasta `Querys/`** (para o bot Railway)
- **Sempre que alterar código que o Agente usa, atualizar `Agente_Financeiro_IA.md`** para garantir que o agente não quebre

---

## Estrutura do Projeto

Veja `documentação.md` na raiz do projeto para a documentação completa.

**Resumo dos arquivos:**
- `public/` → App web (Firebase Hosting)
- `Querys/` → Queries Firestore para o bot
- `Bot Railway/` → Bot Telegram (hospedado no Railway)
- `scripts/agente-ia.js` → Agente IA (roda no GitHub Actions)
- `.github/workflows/` → CI/CD automático

---

## Tokens e Keys necessários

Para configurar o sistema do zero, você precisará de:

| Token/Key | Onde obter | Onde colocar |
|-----------|-----------|-------------|
| Firebase Config (apiKey, projectId, etc.) | Console Firebase → Configurações → Seus Apps | `public/js/firebase-config.js` |
| Firebase Project ID | Console Firebase | `.firebaserc` |
| Firebase Service Account (JSON) | Console Firebase → Contas de Serviço | GitHub Secret: `FIREBASE_SERVICE_ACCOUNT` |
| Telegram Bot Token | @BotFather no Telegram → /newbot | GitHub Secret `TELEGRAM_BOT_TOKEN` + `Bot Railway/.env` |
| Anthropic API Key | console.anthropic.com | GitHub Secret: `ANTHROPIC_API_KEY` |
| GitHub Personal Access Token | GitHub → Settings → Developer settings → PAT | `Bot Railway/.env` como `GITHUB_TOKEN` |

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
