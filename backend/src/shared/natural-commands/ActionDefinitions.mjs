// 📝 Definiciones de Acciones - ÚNICA FUENTE DE VERDAD
// Agrega nuevas acciones aquí y ejecuta: npm run generate-intents

export default [
  {
    key: 'send',
    verbs: ['send', 'envía', 'manda', 'transfiere', 'mándame'],
    patterns: ['amount', 'token'],
    optionalParams: ['recipient'],
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
    verbs: ['request', 'pide', 'pídeme', 'solicita', 'necesito'],
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
  },

  {
    key: 'deposit',
    verbs: ['deposit', 'deposita', 'stake', 'ingresa', 'mete'],
    patterns: ['amount', 'token', 'protocol'],
    protocols: ['kamino', 'marginfi', 'jupiter'],
    handler: 'createDepositAction',
    description: 'Depositar tokens en protocolo DeFi',
    examples: [
      'deposita 5 SOL en kamino',
      'stake 10 USDC in marginfi',
      'ingresa 2 USDT a kamino',
      'mete 0.5 SOL en marginfi'
    ]
  },

  {
    key: 'withdraw',
    verbs: ['withdraw', 'retira', 'saca', 'unstake', 'extrae'],
    patterns: ['amount', 'token', 'protocol'],
    protocols: ['kamino', 'marginfi', 'jupiter'],
    handler: 'createWithdrawAction',
    description: 'Retirar tokens de protocolo DeFi',
    examples: [
      'retira 5 SOL de kamino',
      'withdraw 10 USDC from marginfi',
      'saca 2 USDT de kamino',
      'unstake 0.5 SOL de marginfi'
    ]
  },

  {
    key: 'borrow',
    verbs: ['borrow', 'pide prestado', 'toma prestado', 'solicita'],
    patterns: ['amount', 'token', 'protocol'],
    protocols: ['marginfi', 'kamino'],
    handler: 'createBorrowAction',
    description: 'Tomar préstamo de protocolo DeFi',
    examples: [
      'pide prestado 5 SOL de marginfi',
      'borrow 10 USDC from kamino',
      'toma prestado 2 USDT de marginfi',
      'solicita 0.5 SOL de kamino'
    ]
  },

  {
    key: 'repay',
    verbs: ['repay', 'paga', 'devuelve', 'liquida'],
    patterns: ['amount', 'token', 'protocol'],
    protocols: ['marginfi', 'kamino'],
    handler: 'createRepayAction',
    description: 'Pagar préstamo en protocolo DeFi',
    examples: [
      'paga 5 SOL en marginfi',
      'repay 10 USDC to kamino',
      'devuelve 2 USDT a marginfi',
      'liquida 0.5 SOL en kamino'
    ]
  },

  {
    key: 'claim',
    verbs: ['claim', 'reclama', 'cobra', 'retira rewards'],
    patterns: ['protocol'],
    protocols: ['kamino', 'marginfi', 'jupiter'],
    handler: 'createClaimAction',
    description: 'Reclamar recompensas de protocolo DeFi',
    examples: [
      'reclama rewards de kamino',
      'claim rewards from marginfi',
      'cobra recompensas de kamino',
      'retira rewards de marginfi'
    ]
  }
];
