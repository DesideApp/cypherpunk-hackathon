#!/bin/bash
# scripts/setup-telegram-bot.sh
# Script para configurar el bot de Telegram

set -e

echo "🤖 Configurando Bot de Telegram para Deside Hackathon"
echo "=================================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install telegraf

# Verificar variables de entorno
echo "🔧 Verificando configuración..."

if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Archivo .env creado. Configura TELEGRAM_BOT_TOKEN"
    else
        echo "❌ No se encontró .env.example. Crea manualmente el archivo .env"
    fi
fi

# Verificar token de Telegram
if ! grep -q "TELEGRAM_BOT_TOKEN=" .env 2>/dev/null; then
    echo "⚠️  TELEGRAM_BOT_TOKEN no configurado en .env"
    echo ""
    echo "Para obtener un token:"
    echo "1. Habla con @BotFather en Telegram"
    echo "2. Usa /newbot para crear un nuevo bot"
    echo "3. Copia el token y añádelo a .env:"
    echo "   TELEGRAM_BOT_TOKEN=tu_token_aqui"
    echo ""
fi

# Crear directorio de logs si no existe
mkdir -p logs

echo ""
echo "✅ Configuración completada!"
echo ""
echo "🚀 Para iniciar el bot:"
echo "   npm run telegram:dev    # Desarrollo con auto-reload"
echo "   npm run telegram:bot    # Producción"
echo ""
echo "📊 Para ver estadísticas:"
echo "   curl http://localhost:3001/api/v1/telegram-bot/stats"
echo ""
echo "📖 Para más información, lee:"
echo "   backend/src/modules/telegram-bot/README.md"
echo ""






