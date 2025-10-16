# 🔧 Troubleshooting - AI Token Agent

## 🌐 Problema de Red en WSL2

### Síntoma

```
Error: request to https://token.jup.ag/all failed, reason: getaddrinfo ENOTFOUND token.jup.ag
```

### Causa

WSL2 tiene problemas de DNS o conectividad a internet.

### Soluciones

#### Opción 1: Verificar conectividad

```bash
# Test básico
curl https://token.jup.ag/all | head -20

# Si falla, problema de DNS
ping 8.8.8.8  # ¿Funciona?
ping google.com  # ¿Funciona?
```

#### Opción 2: Configurar DNS en WSL2

```bash
# Editar /etc/resolv.conf
sudo nano /etc/resolv.conf

# Añadir:
nameserver 8.8.8.8
nameserver 1.1.1.1

# Hacer el archivo inmutable
sudo chattr +i /etc/resolv.conf
```

#### Opción 3: Configurar wsl.conf

```bash
# Crear/editar /etc/wsl.conf
sudo nano /etc/wsl.conf

# Añadir:
[network]
generateResolvConf = false

# Reiniciar WSL desde PowerShell:
# wsl --shutdown
```

#### Opción 4: Proxy Corporativo

Si estás detrás de un proxy:

```bash
# Configurar proxy
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Ejecutar agente
npm run token:add <CA>
```

#### Opción 5: Ejecutar desde Windows

En vez de WSL, ejecuta desde PowerShell/CMD de Windows:

```powershell
cd C:\tu\proyecto\deside-hackathon
npm run token:add <CONTRACT_ADDRESS>
```

---

## 🐛 Errores Comunes

### 1. "Token no encontrado en Jupiter"

**Causa:** Token no está en Jupiter Token List

**Solución:**
- Verifica que el contract address es correcto
- Verifica que el token tiene liquidez en Jupiter
- Verifica en https://jup.ag que el token es tradeable

### 2. "Sin liquidez suficiente"

**Causa:** Quote de prueba (0.1 SOL → Token) falló

**Solución:**
- Token no tiene rutas de swap
- Liquidez muy baja
- No añadir este token (no funcionará en tu app)

### 3. "Token ya existe"

**Causa:** Token ya está en `ALLOWED_TOKENS`

**Solución:**
```bash
# Sobrescribir
npm run token:add <CA> -- --force

# O remover primero
npm run token:remove <CODE>
npm run token:add <CA>
```

### 4. "Cannot find module"

**Causa:** Dependencias no instaladas

**Solución:**
```bash
cd ai-token-agent
npm install
```

### 5. "EACCES: permission denied"

**Causa:** Sin permisos para modificar archivos

**Solución:**
```bash
# Verificar permisos
ls -la backend/src/shared/services/blinkValidationService.js

# Dar permisos si necesario
chmod 644 backend/src/shared/services/blinkValidationService.js
```

---

## 🧪 Testing sin Internet

Si no tienes internet, puedes testear con mocks:

### 1. Crear archivo de test con mocks

```bash
# Archivo: ai-token-agent/src/jupiterValidator.test.js
```

```javascript
// Mock de validación (sin llamar a APIs)
export async function validateTokenInJupiterMock(mintAddress) {
  const mockTokens = {
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
      valid: true,
      data: {
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        code: 'BONK',
        label: 'Bonk',
        decimals: 5,
        logoURI: 'https://example.com/bonk.png',
        verified: true,
      }
    }
  };
  
  return mockTokens[mintAddress] || {
    valid: false,
    reason: 'Token not in mock database'
  };
}
```

### 2. Usar modo offline (futuro)

```bash
# Próxima versión
npm run token:add <CA> -- --offline --mock
```

---

## 📝 Logs y Debugging

### Activar verbose

```bash
npm run token:add <CA> -- --verbose
```

Muestra stack traces completos de errores.

### Ver qué archivos se modifican

```bash
npm run token:add <CA> -- --dry-run
```

Simula sin aplicar cambios reales.

### Ver preview del código

```bash
npm run token:add <CA> -- --preview
```

Muestra el código generado antes de aplicar.

---

## 🔍 Verificar Estado

### ¿Qué tokens están añadidos?

```bash
npm run token:list
```

### ¿Está funcionando Jupiter API?

```bash
curl https://token.jup.ag/all | jq '.[0:3]'
curl https://api.jup.ag/price/v2?ids=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
curl "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&amount=100000000&slippageBps=50"
```

### ¿El agente instaló correctamente?

```bash
cd ai-token-agent
node src/index.js --version
```

---

## 💾 Limpiar y Reiniciar

### Limpiar memoria

```bash
rm -rf ai-token-agent/memory/*.json
```

### Reinstalar dependencias

```bash
cd ai-token-agent
rm -rf node_modules package-lock.json
npm install
```

### Revertir cambios en código

```bash
# Restaurar desde git (si aplicaste cambios que rompieron)
git checkout backend/src/shared/services/blinkValidationService.js
git checkout frontend/src/features/messaging/ui/modals/BuyTokenModal.jsx
```

---

## 🆘 Soporte

### Verificar instalación

```bash
# Verificar Node.js
node --version  # >= 20

# Verificar npm
npm --version

# Verificar estructura
ls -la ai-token-agent/src/
```

### Reportar bug

Incluye:

1. Comando ejecutado
2. Output completo del error
3. Node version (`node --version`)
4. OS (`uname -a` o Windows version)
5. ¿WSL? (`echo $WSL_DISTRO_NAME`)

---

## ✅ Checklist de Diagnóstico

Antes de reportar problema:

- [ ] `npm install` ejecutado en `ai-token-agent/`
- [ ] Node.js >= 20
- [ ] Probaste con `--dry-run` primero
- [ ] Verificaste conectividad: `curl https://token.jup.ag/all`
- [ ] Contract address es válido (32-44 caracteres base58)
- [ ] Token existe en Jupiter: https://jup.ag
- [ ] Sin proxy/firewall bloqueando
- [ ] WSL2 tiene DNS configurado correctamente

---

## 🎓 Ejemplos de Errores Resueltos

### Error 1: ENOTFOUND

```bash
# Error
Error: getaddrinfo ENOTFOUND token.jup.ag

# Solución
sudo nano /etc/resolv.conf
# Añadir: nameserver 8.8.8.8
```

### Error 2: Token no tradeable

```bash
# Error
✖ Sin liquidez suficiente
   Razón: No hay rutas de swap disponibles

# Solución
# Este token NO se debe añadir
# No tiene liquidez en Jupiter
```

### Error 3: Permisos

```bash
# Error
Error: EACCES: permission denied

# Solución
chmod 644 backend/src/shared/services/blinkValidationService.js
# O ejecutar con permisos adecuados
```

---

## 🚀 Próximos Pasos

Si el problema persiste:

1. Ejecuta desde Windows en vez de WSL
2. Usa VPN si estás en red corporativa
3. Verifica firewall/antivirus
4. Prueba con otro token (BONK es confiable)

**El agente está 100% funcional, solo necesita acceso a internet.**

