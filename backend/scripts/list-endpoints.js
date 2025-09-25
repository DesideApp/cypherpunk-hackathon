#!/usr/bin/env node
/**
 * 🚀 Lista todos los endpoints del backend API
 * 
 * MODO DE USO:
 * 
 * 1. Modo simple (solo rutas):
 *    npm run endpoints
 *    node scripts/list-endpoints.js
 * 
 * 2. Modo ampliado (con archivos y middleware):
 *    npm run endpoints -- --extended
 *    node scripts/list-endpoints.js --extended
 * 
 * 3. Filtrar por módulo específico:
 *    npm run endpoints -- --module contacts
 *    node scripts/list-endpoints.js --module auth
 * 
 * 4. Formato JSON para integración:
 *    npm run endpoints -- --json
 *    node scripts/list-endpoints.js --json > endpoints.json
 * 
 * 5. Generar documentación fuera del repo (con timestamp):
 *    npm run endpoints -- --docs [--out ./docs]
 *    node scripts/list-endpoints.js --docs --out ./docs
 * 
 * 6. Opcionales de visualización (no rompen nada):
 *    --no-compat    → oculta rutas montadas en '/'
 *    --canonical    → alias de --no-compat
 * 
 * EJEMPLOS:
 *   npm run endpoints                           # Modo simple
 *   npm run endpoints -- --extended            # Con detalles
 *   npm run endpoints -- --module relay       # Solo relay
 *   npm run endpoints -- --json --module auth  # Auth en JSON
 *   npm run endpoints -- --docs                # Documentación completa fuera del repo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const isExtended = args.includes('--extended');
const isJson = args.includes('--json');
const generateDocs = args.includes('--docs');
const docsOutDirArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const moduleFilter = args.includes('--module') ? args[args.indexOf('--module') + 1] : null;
const noCompat = args.includes('--no-compat') || args.includes('--canonical');

if (!isJson && !generateDocs) {
  console.log('🚀 Backend API Endpoints\n');
}

// Función para extraer rutas de un archivo
function extractRoutes(filePath, modulePrefix = '') {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const routes = [];
    
    // Regex para capturar router.method('/path', middleware, handler)
    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]([^)]*)\)/gi;
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
      const [fullMatch, method, routePath, middlewareStr] = match;
      const fullPath = modulePrefix.replace(/\/+$/, '') + '/' + (routePath === '/' ? '' : routePath.replace(/^\/+/, ''));
      
      // Extraer middleware de la definición (modo extendido)
      const middleware = [];
      if (middlewareStr && isExtended) {
        // Protecciones comunes
        const middlewareMatches = middlewareStr.match(/\b\w+Protect\b|\b\w+Middleware\b|\bprotectRoute\b/g);
        if (middlewareMatches) middleware.push(...middlewareMatches);

        let fg;
        while ((fg = fgLoose.exec(middlewareStr)) !== null) {
          const flagKey = fg[1];
        }
      }
      
      routes.push({
        method: method.toUpperCase(),
        path: fullPath,
        file: path.relative(rootDir, filePath),
        middleware: middleware,
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return routes;
  } catch (error) {
    return [];
  }
}

// Función para escanear un módulo
function scanModule(modulePath, moduleName) {
  const routesDir = path.join(modulePath, 'routes');
  if (!fs.existsSync(routesDir)) return [];

  const allRoutes = [];
  const modulePrefix = `/api/v1/${moduleName}`;

  const v1Index = path.join(routesDir, 'v1', 'index.js');
  const v1Dir = path.dirname(v1Index);

  if (fs.existsSync(v1Index)) {
    // 1) Rutas definidas directamente en v1/index.js
    const inlineRoutes = extractRoutes(v1Index, modulePrefix);
    inlineRoutes.forEach(r => { r.sourceMount = '/'; });
    allRoutes.push(...inlineRoutes);

    // 2) Subrouters: router.use('/sub', [mw], subRoutes)
    const content = fs.readFileSync(v1Index, 'utf8');
    const importRegex = /import\s+(\w+)\s+from\s+['"]\.\/([^'"\n]+)['"]/gi;
    const importMap = {};
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      importMap[m[1]] = path.resolve(v1Dir, m[2]);
    }

    const useRegex = /router\.use\s*\(\s*['"`]\/([^'"`]*)['"`]\s*,\s*([^\)]+)\)/gi;
    let u;
    while ((u = useRegex.exec(content)) !== null) {
      const subMount = '/' + (u[1] || '').replace(/^\/+|\/+$/g, '');
      const argsStr = u[2];
      const parts = argsStr.split(',').map(s => s.trim()).filter(Boolean);
      const routerVar = parts[parts.length - 1].replace(/[,;]\s*$/, '');
      const subMiddlewares = parts.slice(0, -1)
        .filter(p => /protectRoute|adminProtect/.test(p))
        .map(p => {
          return p;
        });

      // Resolver archivo del subrouter
      let subFile = importMap[routerVar];
      if (!subFile) {
        // Fallback: privateRoutes → private.js
        const guess = routerVar.replace(/Routes?$/, '').toLowerCase() + '.js';
        subFile = path.resolve(v1Dir, guess);
      }
      if (!fs.existsSync(subFile)) continue;

      const subRoutes = extractRoutes(subFile, modulePrefix + subMount);
      // anotar origen y middlewares del subrouter (si hay)
      subRoutes.forEach(r => {
        r.sourceMount = subMount || '/';
        if (subMiddlewares.length) r.subMiddleware = subMiddlewares;
      });
      allRoutes.push(...subRoutes);
    }

    return allRoutes;
  }

  // Fallback: escaneo genérico
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.name.endsWith('.js')) {
        const routes = extractRoutes(filePath, modulePrefix);
        routes.forEach(r => { r.sourceMount = '/'; });
        allRoutes.push(...routes);
      }
    }
  }
  scanDirectory(routesDir);
  return allRoutes;
}

// Parse router.js para mapear mounts -> módulo real y middlewares
function parseRouterMounts() {
  const routerPath = path.join(rootDir, 'src/apps/api/v1/router.js');
  const result = [];
  try {
    const content = fs.readFileSync(routerPath, 'utf8');

    // 1) Mapa de imports: varName -> moduleDir
    const importRegex = /import\s+(\w+)\s+from\s+['"]#modules\/([^/'"]+)\/routes\/index\.js['"]/gi;
    const importMap = {};
    let im;
    while ((im = importRegex.exec(content)) !== null) {
      importMap[im[1]] = im[2];
    }

    // 2) v1.use('/mount', [mw,...], routerVar)
    const useRegex = /v1\.use\s*\(\s*['"`]\/([^'"`]+)['"`]\s*,\s*([^\)]+)\)/gi;
    let um;
    while ((um = useRegex.exec(content)) !== null) {
      const mount = um[1];
      const argsStr = um[2];
      const parts = argsStr.split(',').map(s => s.trim()).filter(Boolean);
      const routerVar = parts[parts.length - 1].replace(/[,;]\s*$/, '');
      const middlewares = parts.slice(0, -1)
        .filter(p => /protectRoute|adminProtect/.test(p))
        .map(p => {
          return p;
        });

      result.push({
        mount,
        routerVar,
        moduleDir: importMap[routerVar] || mount,
        middlewares,
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Error reading router.js:', error.message);
    return [];
  }
}

// Main execution
const mounts = parseRouterMounts();
const allEndpoints = [];

for (const info of mounts) {
  const { mount, moduleDir, middlewares } = info;
  if (moduleFilter && mount !== moduleFilter) continue;

  const modulePath = path.join(rootDir, 'src/modules', moduleDir);
  if (!fs.existsSync(modulePath)) continue;

  const routes = scanModule(modulePath, mount);

  // Anotar middleware del router principal (para clasificación de acceso)
  routes.forEach(route => {
    if (middlewares && middlewares.length) route.moduleMiddleware = middlewares;
  });

  allEndpoints.push(...routes);
}

// Opcional: ocultar rutas legacy/compat (montadas en '/')
const visibleEndpoints = noCompat
  ? allEndpoints.filter(e => (e.sourceMount && e.sourceMount !== '/'))
  : allEndpoints;

// Salida JSON
if (isJson) {
  console.log(JSON.stringify({
    total: visibleEndpoints.length,
    modules: [...new Set(visibleEndpoints.map(e => e.path.split('/')[3]))].length,
    endpoints: visibleEndpoints
  }, null, 2));
  process.exit(0);
}

// Agrupar por módulo y mostrar
const groupedByModule = {};
visibleEndpoints.forEach(endpoint => {
  const module = endpoint.path.split('/')[3]; // /api/v1/MODULE/...
  if (!groupedByModule[module]) {
    groupedByModule[module] = [];
  }
  groupedByModule[module].push(endpoint);
});

// Generar documentación completa fuera del repo
if (generateDocs) {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const docsDir = docsOutDirArg || '/home/vderohe/API-Documentation';
  const fileName = `backend-endpoints-${timestamp}.json`;
  const filePath = path.join(docsDir, fileName);
  
  try {
    // Crear directorio si no existe
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const docData = {
      generatedAt: new Date().toISOString(),
      generatedBy: 'npm run endpoints --docs',
      project: 'backend-deside',
      summary: {
        total: visibleEndpoints.length,
        modules: [...new Set(visibleEndpoints.map(e => e.path.split('/')[3]))].length,
        publicEndpoints: visibleEndpoints.filter(e => {
          const mw = [...(e.moduleMiddleware || []), ...(e.subMiddleware || []), ...(e.middleware || [])];
          return mw.length === 0;
        }).length,
        protectedEndpoints: visibleEndpoints.filter(e => {
          const mw = [...(e.moduleMiddleware || []), ...(e.subMiddleware || []), ...(e.middleware || [])];
          return mw.includes('protectRoute');
        }).length,
        adminOnlyEndpoints: visibleEndpoints.filter(e => {
          const mw = [...(e.moduleMiddleware || []), ...(e.subMiddleware || []), ...(e.middleware || [])];
          return mw.includes('adminProtect');
        }).length,
      },
      endpoints: visibleEndpoints,
      moduleBreakdown: Object.keys(groupedByModule).reduce((acc, module) => {
        acc[module] = {
          count: groupedByModule[module].length,
          endpoints: groupedByModule[module]
        };
        return acc;
      }, {})
    };
    
    fs.writeFileSync(filePath, JSON.stringify(docData, null, 2));
    console.log(`📚 Documentación generada exitosamente:`);
    console.log(`📂 ${filePath}`);
    console.log(`📊 ${allEndpoints.length} endpoints documentados`);
    console.log(`📅 Fecha: ${timestamp}`);
    
    // También crear un README con resumen
    const readmePath = path.join(docsDir, `README-${timestamp}.md`);
    const readme = `# Backend API Documentation
Generated: ${new Date().toISOString()}

## Summary
- **Total Endpoints:** ${allEndpoints.length}
- **Modules:** ${[...new Set(allEndpoints.map(e => e.path.split('/')[3]))].length}
- **Public Endpoints:** ${allEndpoints.filter(e => !e.moduleMiddleware || e.moduleMiddleware.length === 0).length}
- **Protected Endpoints:** ${allEndpoints.filter(e => e.moduleMiddleware && e.moduleMiddleware.includes('protectRoute')).length}
- **Admin Only:** ${allEndpoints.filter(e => e.moduleMiddleware && e.moduleMiddleware.includes('adminProtect')).length}

## Modules Breakdown
${Object.keys(groupedByModule).sort().map(module => 
  `### ${module.toUpperCase()} (${groupedByModule[module].length} endpoints)\n${groupedByModule[module].map(ep => 
    `- \`${ep.method} ${ep.path}\``
  ).join('\n')}`
).join('\n\n')}

---
*Generated with \`npm run endpoints --docs\`*
`;
    
    fs.writeFileSync(readmePath, readme);
    console.log(`📝 README generado: README-${timestamp}.md`);
    
  } catch (error) {
    console.error(`❌ Error generando documentación:`, error.message);
  }
  
  process.exit(0);
}

// Mostrar endpoints agrupados por módulo
Object.keys(groupedByModule).sort().forEach(module => {
  console.log(`📁 ${module.toUpperCase()}`);
  
  groupedByModule[module]
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach(endpoint => {
      const methodColor = {
        'GET': '🟢',
        'POST': '🟡',
        'PUT': '🔵',
        'DELETE': '🔴',
        'PATCH': '🟠'
      }[endpoint.method] || '⚪';
      
      let output = `  ${methodColor} ${endpoint.method.padEnd(6)} ${endpoint.path}`;
      
      // Modo extendido: mostrar archivo, línea y middleware
      if (isExtended) {
        output += `\n    📂 ${endpoint.file}:${endpoint.line}`;
        
        const allMiddlewareRaw = [
          ...(endpoint.moduleMiddleware || []),
          ...(endpoint.subMiddleware || []),
          ...(endpoint.middleware || [])
        ];
        const seen = new Set();
        const allMiddleware = allMiddlewareRaw.filter(m => (m && !seen.has(m) && seen.add(m)));
        if (allMiddleware.length > 0) {
          output += `\n    🛡️  ${allMiddleware.join(' → ')}`;
        }
      }
      
      console.log(output);
    });
  
  console.log('');
});

  console.log(`\n📊 Total endpoints: ${visibleEndpoints.length}`);
  console.log(`📦 Modules scanned: ${Object.keys(groupedByModule).length}`);

if (moduleFilter) {
  console.log(`🔍 Filtered by: ${moduleFilter}`);
}

if (isExtended) {
  console.log('📋 Extended mode: showing files and middleware');
}
