// 🧠 PatternGenerator Inteligente - Genera patrones flexibles y tolerantes
// Maneja variaciones, sinónimos y errores de escritura sin IA

export class PatternGenerator {
  constructor() {
    this.synonyms = this.buildSynonyms();
    this.tokenVariations = this.buildTokenVariations();
    this.amountPatterns = this.buildAmountPatterns();
  }

  // 📚 Diccionario de sinónimos por idioma - VARIACIONES ELABORADAS
  buildSynonyms() {
    return {
      send: {
        es: [
          // Formales
          'envía', 'envia', 'enviar', 'envío', 'envio', 'enviando',
          // Informales
          'manda', 'mandar', 'mando', 'mandando',
          // Técnicos
          'transfiere', 'transferir', 'transfiero', 'transfiriendo',
          // Variaciones
          'mándame', 'mandame', 'envíame', 'enviame'
        ],
        en: [
          'send', 'sending', 'sent', 'give', 'giving', 'gave',
          'transfer', 'transferring', 'transferred', 'forward', 'forwarding'
        ]
      },
      request: {
        es: [
          // Directos
          'pide', 'pide', 'pedir', 'pidiendo', 'pidió', 'pidio',
          'pídeme', 'pideme', 'pídeme', 'pideme',
          // Formales
          'solicita', 'solicitar', 'solicito', 'solicitando',
          // Necesidad
          'necesito', 'necesitar', 'necesitando', 'necesitas',
          'quiero', 'querer', 'quiriendo', 'quieres',
          'requiero', 'requerir', 'requiriendo'
        ],
        en: [
          'request', 'requesting', 'asked', 'ask', 'asking',
          'need', 'needing', 'needed', 'want', 'wanting', 'wanted',
          'require', 'requiring', 'required'
        ]
      },
      buy: {
        es: [
          'compra', 'compra', 'comprar', 'compro', 'comprando',
          'cómprame', 'comprame', 'cómprame', 'comprame',
          'adquiere', 'adquirir', 'adquiero', 'adquiriendo',
          'obtén', 'obtener', 'obtengo', 'obteniendo'
        ],
        en: [
          'buy', 'buying', 'bought', 'purchase', 'purchasing', 'purchased',
          'get', 'getting', 'got', 'acquire', 'acquiring', 'acquired'
        ]
      },
      swap: {
        es: [
          'cambia', 'cambia', 'cambiar', 'cambio', 'cambiando',
          'intercambia', 'intercambiar', 'intercambio', 'intercambiando',
          'convierte', 'convertir', 'convierto', 'convirtiendo',
          'swap', 'swapping', 'swapped'
        ],
        en: [
          'swap', 'swapping', 'swapped', 'exchange', 'exchanging', 'exchanged',
          'convert', 'converting', 'converted', 'trade', 'trading', 'traded'
        ]
      },
      deposit: {
        es: [
          'deposita', 'deposita', 'depositar', 'deposito', 'depositando',
          'ingresa', 'ingresar', 'ingreso', 'ingresando',
          'stake', 'stake', 'stake', 'staking', 'staked',
          'apuesta', 'apostar', 'apuesto', 'apostando',
          'poner', 'poniendo', 'puesto'
        ],
        en: [
          'deposit', 'depositing', 'deposited', 'stake', 'staking', 'staked',
          'enter', 'entering', 'entered', 'put', 'putting', 'placed'
        ]
      },
      withdraw: {
        es: [
          'retira', 'retira', 'retirar', 'retiro', 'retirando',
          'saca', 'sacar', 'saco', 'sacando',
          'extrae', 'extraer', 'extraigo', 'extrayendo',
          'quitar', 'quitando', 'quitado',
          'withdraw', 'withdrawing', 'withdrawn'
        ],
        en: [
          'withdraw', 'withdrawing', 'withdrawn', 'take', 'taking', 'taken',
          'extract', 'extracting', 'extracted', 'pull', 'pulling', 'pulled'
        ]
      },
      borrow: {
        es: [
          'presta', 'presta', 'prestar', 'presto', 'prestando',
          'toma prestado', 'tomar prestado', 'tomando prestado',
          'solicita préstamo', 'solicitar préstamo', 'solicitando préstamo',
          'pide prestado', 'pedir prestado', 'pidiendo prestado'
        ],
        en: [
          'borrow', 'borrowing', 'borrowed', 'loan', 'loaning', 'loaned',
          'take loan', 'taking loan', 'took loan'
        ]
      },
      repay: {
        es: [
          'paga', 'paga', 'pagar', 'pago', 'pagando',
          'devuelve', 'devolver', 'devuelvo', 'devolviendo',
          'reembolsa', 'reembolsar', 'reembolso', 'reembolsando',
          'repay', 'repaying', 'repaid'
        ],
        en: [
          'repay', 'repaying', 'repaid', 'pay back', 'paying back', 'paid back',
          'return', 'returning', 'returned', 'refund', 'refunding', 'refunded'
        ]
      },
      claim: {
        es: [
          'reclama', 'reclama', 'reclamar', 'reclamo', 'reclamando',
          'cobra', 'cobrar', 'cobro', 'cobrando',
          'obtén', 'obtener', 'obtengo', 'obteniendo',
          'claim', 'claiming', 'claimed'
        ],
        en: [
          'claim', 'claiming', 'claimed', 'collect', 'collecting', 'collected',
          'get', 'getting', 'got', 'obtain', 'obtaining', 'obtained'
        ]
      }
    };
  }

  // 🪙 Variaciones de tokens (sinónimos y símbolos) - SIN USD COIN
  buildTokenVariations() {
    return {
      'SOL': ['SOL', 'sol', 'Solana', 'solana', 'SOLs', 'sols'],
      'USDC': ['USDC', 'usdc'],
      'USDT': ['USDT', 'usdt', 'Tether', 'tether'],
      'BONK': ['BONK', 'bonk', 'Bonk'],
      'JUP': ['JUP', 'jup', 'Jupiter', 'jupiter']
    };
  }

  // 💰 Patrones de cantidades flexibles - VARIACIONES ELABORADAS
  buildAmountPatterns() {
    return {
      // Números enteros y decimales
      number: '(\\d+(?:\\.\\d+)?)',
      // Palabras especiales
      special: '(all|todo|todos|max|máximo|máx|maximum)',
      // Porcentajes
      percentage: '(\\d+(?:\\.\\d+)?%)',
      // Números en palabras (básicos)
      words: '(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|one|two|three|four|five|six|seven|eight|nine|ten)',
      // Combinado - MÁS FLEXIBLE
      flexible: '(\\d+(?:\\.\\d+)?|all|todo|todos|max|máximo|máx|maximum|\\d+(?:\\.\\d+)?%|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|one|two|three|four|five|six|seven|eight|nine|ten)'
    };
  }

  // 🎯 Genera patrones inteligentes para una acción
  generate(actionDef) {
    const { key, verbs, patterns: paramPatterns, optionalParams = [], protocols = [] } = actionDef;
    const generatedPatterns = [];

    // Obtener todos los verbos (incluyendo sinónimos)
    const allVerbs = this.getAllVerbs(verbs, key);

    allVerbs.forEach(verb => {
      const pattern = this.buildPattern(verb, paramPatterns, optionalParams, protocols);
      if (pattern) {
        generatedPatterns.push(pattern);
      }
    });

    return generatedPatterns;
  }

  // 🔄 Obtiene todos los verbos incluyendo sinónimos
  getAllVerbs(verbs, actionKey) {
    const allVerbs = new Set();
    
    // Agregar verbos originales
    verbs.forEach(verb => {
      allVerbs.add(verb);
    });
    
    // Buscar sinónimos específicos para esta acción
    if (this.synonyms[actionKey]) {
      Object.values(this.synonyms[actionKey]).forEach(synonymList => {
        synonymList.forEach(synonym => allVerbs.add(synonym));
      });
    }

    return Array.from(allVerbs);
  }

  // 🏗️ Construye un patrón específico
  buildPattern(verb, paramPatterns, optionalParams, protocols) {
    let regex = `^${this.escapeRegex(verb)}\\s+`;
    
    paramPatterns.forEach((pattern, index) => {
      const patternRegex = this.getPatternRegex(pattern, protocols);
      regex += patternRegex;
      
      // Agregar separador entre parámetros
      if (index < paramPatterns.length - 1) {
        regex += '\\s+';
      }
    });

    // Agregar parámetros opcionales
    optionalParams.forEach(param => {
      const optionalPattern = this.getOptionalPattern(param, protocols);
      if (optionalPattern) {
        regex += optionalPattern;
      }
    });

    return new RegExp(regex, 'i');
  }

  // 🎨 Obtiene regex para un tipo de parámetro
  getPatternRegex(pattern, protocols) {
    switch (pattern) {
      case 'amount':
        return this.amountPatterns.flexible;
      
      case 'token':
        return this.getTokenPattern();
      
      case 'fromToken':
        return this.getTokenPattern();
      
      case 'toToken':
        return `(?:a|to|en|por)\\s+${this.getTokenPattern()}`;
      
      case 'protocol':
        return protocols.length > 0 ? `(?:en|in)\\s+(${protocols.join('|')})` : '';
      
      case 'recipient':
        return '(?:a|to|@)\\s*([a-zA-Z0-9_]+)';
      
      default:
        return `(${pattern})`;
    }
  }

  // 🪙 Patrón para tokens con variaciones
  getTokenPattern() {
    const allTokens = Object.keys(this.tokenVariations).join('|');
    return `(${allTokens})`;
  }

  // 🔧 Patrón para parámetros opcionales
  getOptionalPattern(param, protocols) {
    switch (param) {
      case 'recipient':
        return '(?:\\s+(?:a|to|@)\\s*([a-zA-Z0-9_]+))?';
      
      case 'memo':
        return '(?:\\s+(?:por|for|memo|nota|note):\\s*([^\\s]+))?';
      
      case 'protocol':
        return protocols.length > 0 ? `(?:\\s+(?:en|in)\\s+(${protocols.join('|')}))?` : '';
      
      default:
        return `(?:\\s+(${param}))?`;
    }
  }

  // 🛡️ Escapa caracteres especiales de regex
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 🔍 Valida si un token es válido
  isValidToken(token) {
    const normalizedToken = token.toUpperCase();
    return Object.keys(this.tokenVariations).includes(normalizedToken);
  }

  // 🔄 Normaliza un token a su forma estándar
  normalizeToken(token) {
    const normalizedToken = token.toUpperCase();
    for (const [standard, variations] of Object.entries(this.tokenVariations)) {
      if (variations.includes(token) || variations.includes(normalizedToken)) {
        return standard;
      }
    }
    return normalizedToken;
  }

  // 📊 Obtiene estadísticas de patrones generados
  getStats() {
    return {
      totalSynonyms: Object.values(this.synonyms).reduce((acc, group) => 
        acc + Object.values(group).reduce((sum, list) => sum + list.length, 0), 0),
      tokenVariations: Object.keys(this.tokenVariations).length,
      amountPatterns: Object.keys(this.amountPatterns).length
    };
  }
}
