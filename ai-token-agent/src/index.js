#!/usr/bin/env node
// ai-token-agent/src/index.js
import { Command } from 'commander';
import chalk from 'chalk';
import prompts from 'prompts';
import { addTokenOrchestrated, removeTokenOrchestrated } from './orchestrator.js';
import { discoverTrendingTokens, displayDiscoveredTokens } from './tokenDiscovery.js';
import { 
  getMemoryStats, 
  cleanupOldTokens,
  getAddedTokens 
} from './memoryManager.js';

const program = new Command();

program
  .name('token-agent')
  .description('🤖 AI Token Agent - Automatiza la gestión de tokens SPL en tu sistema de blinks')
  .version('1.0.0');

/**
 * Comando: add
 * Añade un token por contract address
 */
program
  .command('add <mint>')
  .description('Añade un token por su contract address')
  .option('-c, --code <symbol>', 'Symbol del token (auto-detectado si no se provee)')
  .option('-l, --label <name>', 'Nombre del token (auto-detectado si no se provee)')
  .option('--max-amount <amount>', 'Max amount personalizado', parseFloat)
  .option('--min-amount <amount>', 'Min amount personalizado', parseFloat)
  .option('--no-download-logo', 'No descargar logo automáticamente')
  .option('--preview', 'Mostrar preview del código sin aplicar')
  .option('--dry-run', 'Simular sin aplicar cambios')
  .option('--force', 'Sobrescribir si el token ya existe')
  .option('--verbose', 'Mostrar información detallada de errores')
  .action(async (mint, options) => {
    const result = await addTokenOrchestrated(mint, options);
    process.exit(result.success ? 0 : 1);
  });

/**
 * Comando: discover
 * Descubre tokens trending
 */
program
  .command('discover')
  .description('Descubre tokens trending en Solana')
  .option('-i, --interactive', 'Modo interactivo para añadir tokens')
  .option('--include-existing', 'Incluir tokens ya añadidos')
  .action(async (options) => {
    try {
      const tokens = await discoverTrendingTokens(options);
      displayDiscoveredTokens(tokens);
      
      if (options.interactive && tokens.length > 0) {
        console.log(chalk.cyan('💡 Modo interactivo:\n'));
        
        for (const token of tokens) {
          if (token.alreadyAdded) continue;
          
          const response = await prompts({
            type: 'select',
            name: 'action',
            message: `¿Qué hacer con ${token.code} (${token.label})?`,
            choices: [
              { title: '✅ Añadir', value: 'add' },
              { title: '❌ Rechazar', value: 'reject' },
              { title: '⏭️  Siguiente', value: 'skip' },
              { title: '🚪 Salir', value: 'exit' },
            ],
          });
          
          if (response.action === 'add') {
            await addTokenOrchestrated(token.mint, { code: token.code, label: token.label });
          } else if (response.action === 'exit') {
            break;
          }
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Comando: list
 * Lista tokens añadidos
 */
program
  .command('list')
  .description('Lista todos los tokens añadidos')
  .option('-j, --json', 'Output en formato JSON')
  .action(async (options) => {
    try {
      const tokens = await getAddedTokens();
      
      if (options.json) {
        console.log(JSON.stringify(tokens, null, 2));
      } else {
        console.log(chalk.bold.cyan('\n📋 Tokens Añadidos:'));
        console.log(chalk.gray('═'.repeat(70)));
        
        if (tokens.length === 0) {
          console.log(chalk.yellow('\n   No hay tokens añadidos aún\n'));
        } else {
          tokens.forEach((token, index) => {
            console.log(chalk.bold.white(`\n${index + 1}. ${token.code}`));
            console.log(chalk.gray(`   ${token.label}`));
            console.log(chalk.gray(`   Mint: ${token.mint}`));
            console.log(chalk.gray(`   Añadido: ${new Date(token.addedAt).toLocaleDateString()}`));
            
            if (token.priceAtAddition) {
              console.log(chalk.gray(`   Precio al añadir: $${token.priceAtAddition.toFixed(6)}`));
            }
          });
          
          console.log(chalk.gray('\n' + '═'.repeat(70)));
          console.log(chalk.cyan(`\nTotal: ${tokens.length} tokens\n`));
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Comando: remove
 * Remueve un token
 */
program
  .command('remove <code>')
  .description('Remueve un token del sistema')
  .option('-y, --yes', 'Confirmar automáticamente')
  .action(async (code, options) => {
    try {
      if (!options.yes) {
        const response = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message: `¿Seguro que quieres remover ${code}?`,
          initial: false,
        });
        
        if (!response.confirmed) {
          console.log(chalk.yellow('Operación cancelada'));
          process.exit(0);
        }
      }
      
      const results = await removeTokenOrchestrated(code);
      process.exit(results.success ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Comando: insights
 * Muestra estadísticas del agente
 */
program
  .command('insights')
  .description('Muestra estadísticas y preferencias del agente')
  .action(async () => {
    try {
      const stats = await getMemoryStats();
      
      console.log(chalk.bold.cyan('\n📊 Estadísticas del AI Token Agent:'));
      console.log(chalk.gray('═'.repeat(70)));
      
      console.log(chalk.bold.white('\n📈 Resumen:'));
      console.log(chalk.gray(`   Tokens añadidos:   ${chalk.white(stats.totalAdded)}`));
      console.log(chalk.gray(`   Tokens rechazados: ${chalk.white(stats.totalRejected)}`));
      
      if (stats.mostRecentAdded) {
        console.log(chalk.bold.white('\n🆕 Último token añadido:'));
        console.log(chalk.gray(`   ${stats.mostRecentAdded.code} - ${stats.mostRecentAdded.label}`));
        console.log(chalk.gray(`   ${new Date(stats.mostRecentAdded.addedAt).toLocaleString()}`));
      }
      
      console.log(chalk.bold.white('\n⚙️  Preferencias:'));
      Object.entries(stats.preferences).forEach(([key, value]) => {
        const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        console.log(chalk.gray(`   ${displayKey}: ${chalk.white(value)}`));
      });
      
      console.log(chalk.gray('\n' + '═'.repeat(70) + '\n'));
      process.exit(0);
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Comando: cleanup
 * Limpia tokens antiguos de la memoria
 */
program
  .command('cleanup')
  .description('Limpia tokens antiguos de la memoria')
  .option('-d, --days <days>', 'Días de antigüedad (default: 90)', parseInt, 90)
  .action(async (options) => {
    try {
      console.log(chalk.cyan(`\n🧹 Limpiando tokens con más de ${options.days} días...\n`));
      
      const result = await cleanupOldTokens(options.days);
      
      console.log(chalk.green(`✓ Removidos: ${result.removed}`));
      console.log(chalk.gray(`  Conservados: ${result.kept}\n`));
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Comando: update-prices
 * Actualiza precios de tokens existentes
 */
program
  .command('update-prices')
  .description('Actualiza los precios de tokens existentes (WIP)')
  .action(async () => {
    console.log(chalk.yellow('\n⚠️  Función en desarrollo\n'));
    process.exit(0);
  });

/**
 * Comando: watch
 * Modo observador (cron-like)
 */
program
  .command('watch')
  .description('Modo observador - revisa tokens trending periódicamente (WIP)')
  .option('-i, --interval <minutes>', 'Intervalo en minutos', parseInt, 360)
  .action(async (options) => {
    console.log(chalk.yellow('\n⚠️  Función en desarrollo'));
    console.log(chalk.gray(`   Intervalo configurado: ${options.interval} minutos\n`));
    process.exit(0);
  });

// Banner de ayuda
program.on('--help', () => {
  console.log('');
  console.log(chalk.bold.cyan('🤖 AI Token Agent'));
  console.log(chalk.gray('Automatiza la gestión de tokens SPL en tu sistema de blinks'));
  console.log('');
  console.log(chalk.yellow('Ejemplos:'));
  console.log('');
  console.log(chalk.gray('  # Añadir token por contract address'));
  console.log('  $ npm run token:add DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  console.log('');
  console.log(chalk.gray('  # Descubrir tokens trending (interactivo)'));
  console.log('  $ npm run token:discover -- -i');
  console.log('');
  console.log(chalk.gray('  # Listar tokens añadidos'));
  console.log('  $ npm run token:list');
  console.log('');
  console.log(chalk.gray('  # Ver estadísticas'));
  console.log('  $ npm run token:insights');
  console.log('');
});

// Parsear argumentos
program.parse(process.argv);

// Si no hay comandos, mostrar ayuda
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

