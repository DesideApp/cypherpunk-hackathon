// 📝 Definiciones de Acciones - ÚNICA FUENTE DE VERDAD
// Agrega nuevas acciones aquí y ejecuta: npm run generate-intents

export default [
  {
    key: 'send',
    verbs: ['send', 'envía', 'manda', 'transfiere', 'mándame'],
    patterns: ['amount', 'token', 'recipient'],
    handler: 'createSendAction',
    description: 'Enviar tokens a otro usuario',
    examples: [
      'envía 5 SOL',
      'manda 10 USDC a @usuario',
      'send 2 USDT',
      'transfiere 0.5 SOL'
    ]
  },
  
  {
    key: 'request',
    verbs: ['request', 'pide', 'solicita', 'necesito'],
    patterns: ['amount', 'token'],
    handler: 'createRequestAction',
    description: 'Solicitar tokens de otro usuario',
    examples: [
      'pídeme 5 SOL',
      'necesito 10 USDC',
      'request 2 USDT',
      'solicita 0.5 SOL'
    ]
  },
  
  {
    key: 'buy',
    verbs: ['buy', 'compra', 'adquiere', 'quiero comprar'],
    patterns: ['amount', 'token'],
    handler: 'createBuyAction',
    description: 'Comprar tokens con SOL',
    examples: [
      'compra 0.5 SOL',
      'buy 1 USDC',
      'adquiere 2 USDT',
      'quiero comprar 0.1 SOL'
    ]
  },
  
  {
    key: 'swap',
    verbs: ['swap', 'cambia', 'convierte', 'intercambia'],
    patterns: ['amount', 'fromToken', 'toToken'],
    handler: 'createSwapAction',
    description: 'Intercambiar tokens',
    examples: [
      'cambia 1 SOL a USDC',
      'swap 10 USDC to SOL',
      'convierte 5 USDT en SOL',
      'intercambia 2 SOL por USDC'
    ]
  }
];
