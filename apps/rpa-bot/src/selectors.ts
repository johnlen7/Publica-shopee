/**
 * Selectors CSS centralizados. Atualize aqui quando o Seller Centre
 * mudar o layout — nenhum outro arquivo referencia selectors diretamente.
 *
 * Convenção: cada chave documenta o contexto esperado. Prefira
 * seletores por texto (`:has-text("...")`) quando possível, pois são
 * mais resilientes a mudanças de classe CSS.
 *
 * ⚠️ Esses selectors são PLACEHOLDERS baseados no layout observado em
 * abril/2026. Antes de rodar em produção, abra o Seller Centre com
 * DevTools aberto e valide cada um. Mudanças de UI da Shopee quebram
 * o robô — preveja monitoramento e manutenção contínua.
 */

export const SELECTORS = {
  // Menu lateral / navegação para Shopee Video
  videoMenuEntry: 'a:has-text("Shopee Video"), a:has-text("Vídeos")',

  // Tela de listagem de vídeos
  createVideoButton:
    'button:has-text("Criar Novo Vídeo"), button:has-text("Upload Video"), button:has-text("Criar vídeo")',

  // Zona de upload (input file real é geralmente escondido atrás de uma drop zone)
  uploadDropZone: '[class*="upload"][class*="drop" i], .upload-area',
  fileInput: 'input[type="file"]',

  // Campos do formulário de post
  captionField:
    'textarea[placeholder*="legenda" i], textarea[placeholder*="caption" i], textarea[placeholder*="descri" i]',
  hashtagsInput:
    'input[placeholder*="hashtag" i], input[placeholder*="tag" i]',

  // Agendamento
  scheduleToggle: 'label:has-text("Agendar"), label:has-text("Schedule")',
  datePickerInput: 'input[placeholder*="data" i], input[placeholder*="date" i]',

  // Submissão
  publishButton:
    'button:has-text("Publicar"):not([disabled]), button:has-text("Publish"):not([disabled]), button:has-text("Agendar publicação"):not([disabled])',

  // Estados de progresso / erro
  progressIndicator: '[class*="progress" i][role="progressbar"]',
  successToast: '[class*="toast" i]:has-text("sucesso"), [class*="notification" i]:has-text("success")',
  errorToast: '[class*="toast" i][class*="error" i], [class*="notification" i][class*="error" i]',

  // Página de login (para detecção "não autenticado")
  loginForm: 'form:has(input[name="email" i]), form:has(input[type="password"])',
} as const;
