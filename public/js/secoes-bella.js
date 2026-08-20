/**
 * Sections da Bella
 *
 * O 2º usuário tem sections próprias, com coleções próprias na raiz do
 * Firestore (sufixo `_bella`). Nenhum dado do admin é compartilhado por elas
 * — o que é compartilhado (Contas da Casa, Face) continua nas coleções
 * originais e é liberado por `permissoes/{uid}`.
 *
 * POR QUE ISTO É UM REGISTRO E NÃO HTML:
 *   `custom-sections.js` já sabe montar telas inteiras de banco, distribuição,
 *   patrimônio e devo/devem a partir do nome das coleções — é a máquina que
 *   serve o botão "+ Nova Section". Reaproveitá-la evita duplicar quatro
 *   telas (e quatro futuras correções de bug) só para trocar o nome de uma
 *   coleção.
 *
 * A `chave` de cada section é a MESMA string em três lugares, e isso não é
 * coincidência:
 *   • `data-section` no menu e no DOM;
 *   • id do documento em `notas/{chave}`;
 *   • chave de permissão em `permissoes/{uid}.secoes` e em `firestore.rules`.
 * Divergir em qualquer um deles produz o mesmo sintoma confuso: a section
 * aparece, mas quebra com "sem permissão" ao ser usada.
 */

export const GRUPO_BELLA = 'Bella';

export const SECOES_BELLA = [
  {
    chave:    'banco-bella',
    slug:     'banco-bella',
    nome:     'Banco',
    titulo:   'Banco — Mercado Pago',
    icone:    '💳',
    template: 'banco',
    colecoes: { principal: 'banco_bella' },
    // O card de saldo vem acompanhado das duas listas de últimos lançamentos,
    // como no dashboard do admin.
    dashboard: { listas: true }
  },
  {
    chave:    'distribuicao-bella',
    slug:     'distribuicao-bella',
    nome:     'Distribuição',
    titulo:   'Distribuição Mensal do Salário',
    icone:    '📅',
    template: 'distribuicao',
    // `colunasConfig` é um id de DOCUMENTO dentro da coleção `config`,
    // não uma coleção — é assim que o template já funciona.
    colecoes: { mensal: 'distribuicao_mensal_bella', colunasConfig: 'distribuicao_colunas_bella' }
  },
  {
    chave:    'patrimonio-bella',
    slug:     'patrimonio-bella',
    nome:     'Patrimônio',
    titulo:   'Patrimônio e Investimentos',
    icone:    '💎',
    template: 'patrimonio',
    // Sem gráfico de pizza e sem a coluna "Tipo de investimento": o template
    // de patrimônio do custom-sections já nasceu assim. A coleção `reservas`
    // é o que acrescenta a segunda tabela.
    colecoes: { principal: 'patrimonio_bella', reservas: 'reservas_bella' }
  },
  {
    chave:    'devo-devem-bella',
    slug:     'devo-devem-bella',
    nome:     'Devo / Devem',
    titulo:   'Devo e Devem',
    icone:    '💸',
    template: 'devo-devem',
    colecoes: { principal: 'dividas_bella' }
  }
];

/**
 * Sections do admin que a Bella também acessa.
 *
 * Não são replicadas: apontam para as coleções originais (`contas_casa`,
 * `face`), as mesmas que o admin usa. Entram aqui só para render­izar card no
 * dashboard dela — quem decide se ela pode lê-las é `permissoes/{uid}`.
 *
 * A Face cai no template `carro` sem adaptação (mesma coleção com campo
 * `tipo`). Contas da Casa tem formato próprio — doc por mês com mapa de
 * colunas — e por isso ganhou um caso em `metricaSecao`.
 */
export const SECOES_COMPARTILHADAS = [
  {
    chave:    'contas-casa',
    nome:     'Contas Casa',
    icone:    '🏠',
    template: 'contas-casa',
    colecoes: { mensal: 'contas_casa' }
  },
  {
    chave:    'face',
    nome:     'Face',
    icone:    '🚙',
    template: 'carro',
    colecoes: { principal: 'face' },
    // Consumo médio em vez de total gasto — é o que o dashboard do admin
    // mostra para este carro.
    dashboard: { tipo: 'consumo' }
  }
];

/**
 * Dashboard da Bella.
 *
 * Não tem coleção própria: os números saem das sections listadas em
 * `membros`, uma consulta por card. Por isso não precisa (nem deve ganhar)
 * bloco em `firestore.rules` — cada card já é barrado ou liberado pela regra
 * da coleção que ele lê.
 *
 * Inclui as compartilhadas: o dashboard dela é a casa dela, e esconder ali
 * justamente o que ela divide com o admin tiraria do painel a informação
 * que mais muda no dia a dia.
 */
export const DASHBOARD_BELLA = {
  chave:    'dashboard-bella',
  slug:     'dashboard-bella',
  nome:     'Dashboard',
  titulo:   'Dashboard',
  icone:    '📊',
  template: 'dashboard-grupo',
  membros:  [...SECOES_BELLA, ...SECOES_COMPARTILHADAS]
};

/** O que entra no menu: o dashboard dela primeiro, depois as sections. */
export const SECOES_BELLA_MENU = [DASHBOARD_BELLA, ...SECOES_BELLA];

/**
 * Ordem do menu na visão da Bella.
 *
 * A ordem padrão viria da ordem do HTML (sections fixas) seguida das
 * sections dela, o que deixaria Contas Casa e Face no meio. Aqui as dela
 * vêm primeiro, e as duas compartilhadas fecham a lista.
 *
 * Chaves que não estiverem aqui continuam funcionando — só ficam antes das
 * listadas. Na prática são as sections que ela não vê, então não aparecem.
 */
export const ORDEM_SIDEBAR_BELLA = [
  'dashboard-bella',
  'distribuicao-bella',
  'banco-bella',
  'devo-devem-bella',
  'patrimonio-bella',
  'contas-casa',
  'face'
];

/** Chaves de permissão de todas as sections da Bella. */
export const CHAVES_BELLA = SECOES_BELLA.map(s => s.chave);

export function secaoBellaPorChave(chave) {
  return SECOES_BELLA.find(s => s.chave === chave) || null;
}
