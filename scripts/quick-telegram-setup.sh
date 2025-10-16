#!/bin/bash
# scripts/quick-telegram-setup.sh
# Configuración rápida del bot de Telegram

set -e

echo "🤖 Configuración Rápida del Bot de Telegram"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Verificar que el servidor esté funcionando
echo "🔍 Verificando que el servidor esté funcionando..."
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Error: El servidor no está funcionando. Ejecuta 'npm run dev' primero."
    exit 1
fi
echo "✅ Servidor funcionando correctamente"

# Verificar dependencias
echo "📦 Verificando dependencias..."
if ! npm list telegraf > /dev/null 2>&1; then
    echo "📦 Instalando telegraf..."
    npm install telegraf
else
    echo "✅ Dependencias ya instaladas"
fi

# Verificar configuración
echo "🔧 Verificando configuración..."

if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando..."
    touch .env
fi

# Verificar token de Telegram
if ! grep -q "TELEGRAM_BOT_TOKEN=" .env 2>/dev/null; then
    echo ""
    echo "🔑 CONFIGURACIÓN REQUERIDA:"
    echo "=========================="
    echo ""
    echo "Para usar el bot de Telegram, necesitas:"
    echo ""
    echo "1. Hablar con @BotFather en Telegram"
    echo "2. Usar /newbot para crear un nuevo bot"
    echo "3. Copiar el token que te da"
    echo "4. Añadirlo a tu .env:"
    echo ""
    echo "   echo 'TELEGRAM_BOT_TOKEN=tu_token_aqui' >> .env"
    echo ""
    echo "5. Reiniciar el servidor:"
    echo "   npm run dev"
    echo ""
    echo "6. Iniciar el bot:"
    echo "   npm run telegram:dev"
    echo ""
else
    echo "✅ TELEGRAM_BOT_TOKEN ya configurado"
fi

# Mostrar estado actual
echo ""
echo "📊 Estado actual del bot:"
curl -s http://localhost:3001/api/v1/telegram-bot/stats | jq '.' 2>/dev/null || curl -s http://localhost:3001/api/v1/telegram-bot/stats

echo ""
echo "🚀 Comandos útiles:"
echo "=================="
echo ""
echo "# Iniciar bot (desarrollo)"
echo "npm run telegram:dev"
echo ""
echo "# Ver estadísticas"
echo "curl http://localhost:3001/api/v1/telegram-bot/stats"
echo ""
echo "# Iniciar bot via API"
echo "curl -X POST http://localhost:3001/api/v1/telegram-bot/start"
echo ""
echo "# Detener bot via API"
echo "curl -X POST http://localhost:3001/api/v1/telegram-bot/stop"
echo ""

echo "✅ Configuración completada!"
echo ""
echo "📖 Para más información:"
echo "   backend/src/modules/telegram-bot/README.md"
echo ""

