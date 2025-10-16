// ai-token-agent/src/tokenAgent.js
import chalk from 'chalk';
import ora from 'ora';
import { validateTokenComplete, getTokenPrice } from './jupiterValidator.js';
import { 
  calculateMaxAmount, 
  applyTokenToCodebase, 
  isTokenAlreadyAdded,
  generateTokenCode 
} from './codeGenerator.js';
import { saveTokenToMemory } from './memoryManager.js';

/**
 * Motor principal: Añadir un token al sistema
 */
export async function addToken(mintAddress, options = {}) {
  console.log(chalk.bold.blue('\n🤖 AI TOKEN AGENT'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(chalk.cyan(`📍 Mint: ${mintAddress}\n`));
  
  let spinner = ora('Validando token en Jupiter...').start();
  
  try {
    // PASO 1: Validar existencia en Jupiter
    const validation = await validateTokenComplete(mintAddress);
    
    if (!validation.validation.valid) {
      spinner.fail(chalk.red('Token no encontrado en Jupiter'));
      console.log(chalk.gray(`   Razón: ${validation.validation.reason}`));
      return { success: false, reason: validation.validation.reason };
    }
    
    const tokenInfo = validation.validation.data;
    spinner.succeed(chalk.green('Token encontrado en Jupiter'));
    
    console.log(chalk.gray(`   Symbol:   ${chalk.white(tokenInfo.code)}`));
    console.log(chalk.gray(`   Name:     ${chalk.white(tokenInfo.label)}`));
    console.log(chalk.gray(`   Decimals: ${chalk.white(tokenInfo.decimals)}`));
    console.log(chalk.gray(`   Verified: ${tokenInfo.verified ? chalk.green('✓') : chalk.yellow('✗')}`));
    
    // PASO 2: Verificar liquidez
    spinner = ora('Verificando liquidez...').start();
    
    if (!validation.liquidity.hasLiquidity) {
      // Si falla pero el token está en Jupiter, permitir continuar
      spinner.warn(chalk.yellow('No se pudo verificar liquidez'));
      console.log(chalk.gray(`   Razón: ${validation.liquidity.reason}`));
      console.log(chalk.cyan('   ℹ️  Token está en Jupiter → probablemente tiene liquidez'));
    } else {
      spinner.succeed(chalk.green('Liquidez confirmada'));
      console.log(chalk.gray(`   Price Impact: ${chalk.white(validation.liquidity.priceImpact.toFixed(2))}%`));
      console.log(chalk.gray(`   Rutas:        ${chalk.white(validation.liquidity.routeInfo.numberOfRoutes)}`));
    }
    
    // PASO 3: Obtener precio
    spinner = ora('Obteniendo precio...').start();
    
    const priceInfo = validation.price || {};
    
    if (priceInfo.price) {
      spinner.succeed(chalk.green('Precio obtenido'));
      console.log(chalk.gray(`   Precio USD:   ${chalk.white('$' + priceInfo.price.toFixed(6))}`));
      
      if (priceInfo.change24h !== null && priceInfo.change24h !== undefined) {
        const changeColor = priceInfo.change24h >= 0 ? chalk.green : chalk.red;
        const changeSymbol = priceInfo.change24h >= 0 ? '+' : '';
        console.log(chalk.gray(`   Cambio 24h:   ${changeColor(changeSymbol + priceInfo.change24h.toFixed(2) + '%')}`));
      }
      
      if (priceInfo.volume24h) {
        console.log(chalk.gray(`   Volumen 24h:  ${chalk.white('$' + (priceInfo.volume24h / 1000).toFixed(1) + 'K')}`));
      }
    } else {
      spinner.warn(chalk.yellow('Precio no disponible'));
    }
    
    // PASO 4: Verificar si ya existe
    spinner = ora('Verificando si ya existe...').start();
    
    const codeToUse = options.code || tokenInfo.code;
    const alreadyExists = await isTokenAlreadyAdded(codeToUse);
    
    if (alreadyExists && !options.force) {
      spinner.fail(chalk.red(`Token ${codeToUse} ya existe`));
      console.log(chalk.yellow('\n💡 Usa --force para sobrescribir'));
      return { success: false, reason: 'Ya existe' };
    }
    
    if (alreadyExists) {
      spinner.warn(chalk.yellow('Token ya existe (sobrescribiendo)'));
    } else {
      spinner.succeed(chalk.green('Token no existe (OK para añadir)'));
    }
    
    // PASO 5: Preparar datos
    const maxAmount = calculateMaxAmount(priceInfo.price, tokenInfo.decimals);
    
    const tokenData = {
      mint: mintAddress,
      code: codeToUse,
      label: options.label || tokenInfo.label,
      decimals: tokenInfo.decimals,
      maxAmount: options.maxAmount || maxAmount,
      minAmount: options.minAmount || 0.001,
      logoURI: tokenInfo.logoURI,
      verified: tokenInfo.verified,
    };
    
    console.log(chalk.bold.cyan('\n📊 Resumen del Token:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`   Code:       ${chalk.white(tokenData.code)}`));
    console.log(chalk.gray(`   Label:      ${chalk.white(tokenData.label)}`));
    console.log(chalk.gray(`   Max Amount: ${chalk.white(tokenData.maxAmount.toLocaleString())}`));
    console.log(chalk.gray(`   Min Amount: ${chalk.white(tokenData.minAmount)}`));
    
    // PASO 6: Preview del código (si se solicita)
    if (options.preview) {
      const code = generateTokenCode(tokenData);
      
      console.log(chalk.bold.cyan('\n📝 Preview del código:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.yellow('Backend:'));
      console.log(code.backend);
      console.log(chalk.yellow('\nFrontend:'));
      console.log(`  ALLOWED: [..., ${code.frontend}]`);
      console.log(chalk.yellow('\n.env:'));
      console.log(`  ${code.envExample}`);
      
      if (!options.autoApprove) {
        console.log(chalk.yellow('\n⚠️  Preview mode: no se aplicarán cambios'));
        console.log(chalk.gray('   Ejecuta sin --preview para aplicar'));
        return { success: true, preview: true, tokenData };
      }
    }
    
    // PASO 7: Aplicar cambios
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run: no se aplicarán cambios'));
      return { success: true, dryRun: true, tokenData };
    }
    
    spinner = ora('Aplicando cambios al código...').start();
    
    const applyResults = await applyTokenToCodebase(tokenData, {
      force: options.force,
      downloadLogo: options.downloadLogo !== false,
    });
    
    if (applyResults.errors.length > 0) {
      spinner.fail(chalk.red('Error aplicando cambios'));
      applyResults.errors.forEach(err => {
        console.log(chalk.red(`   ✗ ${err}`));
      });
      return { success: false, errors: applyResults.errors };
    }
    
    spinner.succeed(chalk.green('Cambios aplicados exitosamente'));
    
    if (applyResults.backendEnv) {
      console.log(chalk.green('   ✓ env.js actualizado'));
    }
    if (applyResults.backend) {
      console.log(chalk.green('   ✓ Backend actualizado'));
    }
    if (applyResults.frontend) {
      console.log(chalk.green('   ✓ Frontend actualizado'));
    }
    if (applyResults.logo?.success) {
      console.log(chalk.green(`   ✓ Logo descargado (${applyResults.logo.ext})`));
    } else if (applyResults.logo) {
      console.log(chalk.yellow(`   ⚠ Logo no descargado: ${applyResults.logo.reason}`));
    }
    
    // PASO 8: Guardar en memoria
    await saveTokenToMemory({
      ...tokenData,
      addedAt: new Date().toISOString(),
      priceAtAddition: priceInfo.price,
      liquidityCheck: validation.liquidity,
    });
    
    console.log(chalk.bold.green('\n✅ ¡Token añadido exitosamente!'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.cyan(`\n💡 Próximos pasos:`));
    console.log(chalk.gray(`   1. Reinicia el backend para cargar el token`));
    console.log(chalk.gray(`   2. Añade MINT_${tokenData.code} al .env (opcional)`));
    console.log(chalk.gray(`   3. Prueba el blink de compra desde el frontend\n`));
    
    return { 
      success: true, 
      tokenData,
      applyResults,
      priceInfo,
    };
    
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error inesperado'));
    }
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Actualizar precios de tokens existentes
 */
export async function updateTokenPrices() {
  console.log(chalk.bold.blue('\n💰 Actualizando precios de tokens...'));
  
  // TODO: Leer tokens del backend y actualizar precios
  // Por ahora es un placeholder
  
  console.log(chalk.yellow('Función en desarrollo'));
  return { success: false, reason: 'Not implemented' };
}

