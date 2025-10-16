// Índice de acciones - Punto de entrada para todas las funcionalidades de acciones
// Exporta todo lo necesario para usar el sistema de acciones

// Registry de acciones
export {
  ACTIONS_REGISTRY,
  detectAction,
  processAction,
  getAvailableActions,
  registerAction,
  detectBlinkUrls
} from './actions-registry.js';

// Blink Explorer
export {
  getBlinkInfo,
  BlinkPreview,
  useBlinkExplorer
} from './blink-explorer.jsx';

// Parser de comandos
export {
  CommandParser,
  useCommandParser,
  ParserUtils
} from './command-parser.js';

// URL Builder (existente)
export {
  buildTransfer,
  buildRequest,
  isAllowedBlink,
  asDialToUrl
} from './blinkUrlBuilder.js';




