// ai-token-agent/src/tokenDiscovery.js
import chalk from 'chalk';
import ora from 'ora';
import { validateTokenComplete, getTokenPrice } from './jupiterValidator.js';
import { isTokenAlreadyAdded } from './codeGenerator.js';

/**
 * Descubre tokens trending en Jupiter
 * Nota: Jupiter no tiene un endpoint oficial de "trending", 
 * así que usamos los top tokens de CoinGecko vía Jupiter Price API
 */
export async function discoverTrendingTokens(options = {}) {
  const spinner = ora('Descubriendo tokens trending...').start();
  
  try {
    // Lista de tokens populares de Solana para analizar
    // En producción, esto vendría de una API como CoinGecko o Birdeye
    const candidateMints = [
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
      '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
      'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump', // CHILLGUY
      'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',  // MEW
      '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', // FARTCOIN
    ];
    
    spinner.text = `Analizando ${candidateMints.length} candidatos...`;
    
    const results = [];
    
    for (const mint of candidateMints) {
      try {
        // Verificar si ya está añadido
        const validation = await validateTokenComplete(mint);
        
        if (!validation.passed) continue;
        
        const tokenInfo = validation.validation.data;
        const alreadyAdded = await isTokenAlreadyAdded(tokenInfo.code);
        
        if (alreadyAdded && !options.includeExisting) continue;
        
        const priceInfo = validation.price;
        
        results.push({
          mint,
          code: tokenInfo.code,
          label: tokenInfo.label,
          decimals: tokenInfo.decimals,
          price: priceInfo.price,
          change24h: priceInfo.change24h,
          volume24h: priceInfo.volume24h,
          priceImpact: validation.liquidity.priceImpact,
          verified: tokenInfo.verified,
          alreadyAdded,
        });
      } catch (error) {
        // Continuar con siguiente token
        continue;
      }
    }
    
    spinner.succeed(chalk.green(`${results.length} tokens encontrados`));
    
    // Ordenar por volumen 24h
    results.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    
    return results;
    
  } catch (error) {
    spinner.fail(chalk.red('Error en discovery'));
    throw error;
  }
}

/**
 * Muestra tokens descubiertos en formato bonito
 */
export function displayDiscoveredTokens(tokens) {
  console.log(chalk.bold.cyan('\n🔥 Tokens Trending en Solana:'));
  console.log(chalk.gray('═'.repeat(70)));
  
  if (tokens.length === 0) {
    console.log(chalk.yellow('\n   No se encontraron tokens nuevos\n'));
    return;
  }
  
  tokens.forEach((token, index) => {
    const statusBadge = token.alreadyAdded 
      ? chalk.gray('[AÑADIDO]') 
      : chalk.green('[NUEVO]');
    
    const verifiedBadge = token.verified 
      ? chalk.blue('✓') 
      : chalk.gray('·');
    
    console.log(chalk.bold.white(`\n${index + 1}. ${token.code} ${verifiedBadge} ${statusBadge}`));
    console.log(chalk.gray(`   ${token.label}`));
    console.log(chalk.gray(`   CA: ${token.mint.slice(0, 8)}...${token.mint.slice(-6)}`));
    
    if (token.price) {
      const priceStr = token.price < 0.01 
        ? token.price.toFixed(8) 
        : token.price.toFixed(4);
      console.log(chalk.gray(`   💰 $${priceStr}`));
    }
    
    if (token.change24h !== null) {
      const changeColor = token.change24h >= 0 ? chalk.green : chalk.red;
      const changeSymbol = token.change24h >= 0 ? '+' : '';
      console.log(chalk.gray(`   📈 ${changeColor(changeSymbol + token.change24h.toFixed(2) + '%')} 24h`));
    }
    
    if (token.volume24h) {
      const volStr = token.volume24h > 1_000_000
        ? `$${(token.volume24h / 1_000_000).toFixed(2)}M`
        : `$${(token.volume24h / 1_000).toFixed(1)}K`;
      console.log(chalk.gray(`   📊 Vol: ${volStr}`));
    }
    
    if (token.priceImpact !== undefined) {
      const impactColor = token.priceImpact < 1 
        ? chalk.green 
        : token.priceImpact < 3 
          ? chalk.yellow 
          : chalk.red;
      console.log(chalk.gray(`   💧 Impact: ${impactColor(token.priceImpact.toFixed(2) + '%')}`));
    }
  });
  
  console.log(chalk.gray('\n' + '═'.repeat(70) + '\n'));
}

