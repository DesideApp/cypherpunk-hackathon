// ai-token-agent/src/orchestrator.js
import chalk from 'chalk';
import ora from 'ora';
import { validateTokenComplete } from './jupiterValidator.js';
import { calculateMaxAmount } from './codeGenerator.js';
import { saveTokenToMemory } from './memoryManager.js';
import { BackendAgent } from './agents/backendAgent.js';
import { FrontendAgent } from './agents/frontendAgent.js';

/**
 * Orquestador principal - Coordina backend y frontend agents
 */
export async function addTokenOrchestrated(mintAddress, options = {}) {
  console.log(chalk.bold.blue('\n🤖 AI TOKEN AGENT (Arquitectura Segura)'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(chalk.cyan(`📍 Mint: ${mintAddress}\n`));
  
  let spinner = ora('Validando token en Jupiter...').start();
  
  try {
    // PASO 1: Validar en Jupiter
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
    
    // PASO 2: Verificar liquidez (opcional)
    spinner = ora('Verificando liquidez...').start();
    
    if (!validation.liquidity.hasLiquidity) {
      spinner.warn(chalk.yellow('No se pudo verificar liquidez'));
      console.log(chalk.gray(`   Razón: ${validation.liquidity.reason}`));
      console.log(chalk.cyan('   ℹ️  Token está en Jupiter → probablemente tiene liquidez'));
    } else {
      spinner.succeed(chalk.green('Liquidez confirmada'));
      console.log(chalk.gray(`   Price Impact: ${chalk.white(validation.liquidity.priceImpact.toFixed(2))}%`));
    }
    
    // PASO 3: Obtener precio
    spinner = ora('Obteniendo precio...').start();
    
    const priceInfo = validation.price || {};
    
    if (priceInfo.price) {
      spinner.succeed(chalk.green('Precio obtenido'));
      console.log(chalk.gray(`   Precio USD:   ${chalk.white('$' + priceInfo.price.toFixed(6))}`));
    } else {
      spinner.warn(chalk.yellow('Precio no disponible'));
    }
    
    // PASO 4: Preparar datos del token
    const maxAmount = calculateMaxAmount(priceInfo.price, tokenInfo.decimals);
    
    const tokenData = {
      mint: mintAddress,
      code: options.code || tokenInfo.code,
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
    
    if (options.dryRun) {
      console.log(chalk.yellow('\n🔍 Dry run: no se aplicarán cambios'));
      return { success: true, dryRun: true, tokenData };
    }
    
    // PASO 5: Aplicar cambios con agentes separados
    console.log(chalk.bold.cyan('\n📝 Aplicando cambios (solo configuración):'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const backendAgent = new BackendAgent();
    const frontendAgent = new FrontendAgent();
    
    // Backend: Modificar tokens.json
    spinner = ora('Backend: Actualizando tokens.json...').start();
    const backendResult = await backendAgent.addToken(tokenData);
    
    if (backendResult.success) {
      spinner.succeed(chalk.green('Backend: tokens.json actualizado'));
      console.log(chalk.gray(`   Archivo: ${backendResult.file}`));
    } else {
      spinner.fail(chalk.red(`Backend: ${backendResult.reason}`));
    }
    
    // Frontend: Modificar .env.tokens y descargar logo
    spinner = ora('Frontend: Actualizando configuración...').start();
    const frontendResult = await frontendAgent.addToken(tokenData);
    
    if (frontendResult.env) {
      console.log(chalk.green('   ✓ .env.tokens actualizado'));
    }
    if (frontendResult.json) {
      console.log(chalk.green('   ✓ config/tokens.json actualizado'));
    }
    if (frontendResult.logo?.success) {
      console.log(chalk.green(`   ✓ Logo descargado (${frontendResult.logo.ext})`));
    }
    
    if (frontendResult.env || frontendResult.json) {
      spinner.succeed(chalk.green('Frontend: Configuración actualizada'));
    } else {
      spinner.fail(chalk.red('Frontend: Error actualizando'));
      frontendResult.errors.forEach(err => {
        console.log(chalk.red(`   ✗ ${err}`));
      });
    }
    
    // Guardar en memoria
    await saveTokenToMemory({
      ...tokenData,
      addedAt: new Date().toISOString(),
      priceAtAddition: priceInfo.price,
    });
    
    console.log(chalk.bold.green('\n✅ ¡Token añadido exitosamente!'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.cyan('\n💡 Archivos modificados:'));
    console.log(chalk.gray('   ✓ backend/config/tokens.json'));
    console.log(chalk.gray('   ✓ frontend/.env.tokens'));
    console.log(chalk.gray('   ✓ frontend/config/tokens.json'));
    if (frontendResult.logo?.success) {
      console.log(chalk.gray(`   ✓ frontend/public/tokens/${tokenData.code.toLowerCase()}.${frontendResult.logo.ext}`));
    }
    
    console.log(chalk.cyan('\n🚀 Próximos pasos:'));
    console.log(chalk.gray('   1. Reinicia backend/frontend (cambios en config)'));
    console.log(chalk.gray(`   2. El token ${tokenData.code} estará disponible automáticamente\n`));
    
    return {
      success: true,
      tokenData,
      backend: backendResult,
      frontend: frontendResult,
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
 * Remueve un token (orquestado)
 */
export async function removeTokenOrchestrated(tokenCode) {
  console.log(chalk.cyan(`\n🗑️  Removiendo token ${tokenCode}...\n`));
  
  const backendAgent = new BackendAgent();
  const frontendAgent = new FrontendAgent();
  
  const backendResult = await backendAgent.removeToken(tokenCode);
  const frontendResult = await frontendAgent.removeToken(tokenCode);
  
  if (backendResult.success) {
    console.log(chalk.green('   ✓ Removido de backend/config/tokens.json'));
  }
  if (frontendResult.env) {
    console.log(chalk.green('   ✓ Removido de frontend/.env.tokens'));
  }
  if (frontendResult.json) {
    console.log(chalk.green('   ✓ Removido de frontend/config/tokens.json'));
  }
  if (frontendResult.logo) {
    console.log(chalk.green('   ✓ Logo eliminado'));
  }
  
  console.log(chalk.bold.green('\n✅ Token removido exitosamente\n'));
  
  return {
    success: backendResult.success || frontendResult.env,
    backend: backendResult,
    frontend: frontendResult,
  };
}

