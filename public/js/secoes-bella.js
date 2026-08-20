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
    colecoes: { principal: 'banco_bella' }
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
  'dashboard',
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
