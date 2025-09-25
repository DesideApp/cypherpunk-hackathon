import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// ✅ Directorio de logs configurable por variable de entorno
const logDir = process.env.LOG_DIR || 'logs';

// ✅ Asegurar que la carpeta de logs existe
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ✅ Formato de logs mejorado
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }), // ✅ Capturar stack de errores
  format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level}]: ${message}\nStack Trace:\n${stack}`
      : `${timestamp} [${level}]: ${message}`;
  })
);

// ✅ Definición de transportes con rotación diaria de logs
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info', // ✅ Nivel de logs configurable
  format: logFormat,
  transports: [
    // 📋 Log en consola (detallado en desarrollo)
    new transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // ✅ En desarrollo, más detalles
      format: format.combine(format.colorize(), logFormat),
    }),

    // 📁 Archivo de errores rotativo diario
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d', // Guardar los últimos 30 días
    }),

    // 📁 Archivo combinado rotativo diario
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],

  // ✅ Captura de excepciones no controladas
  exceptionHandlers: [
    new transports.File({ filename: path.join(logDir, 'exceptions.log') }),
  ],

  // ✅ Captura de promesas no manejadas
  rejectionHandlers: [
    new transports.File({ filename: path.join(logDir, 'rejections.log') }),
  ],
});

// ✅ Mensaje inicial indicando que el logger está activo
logger.info('📋 Logger inicializado correctamente.');

export default logger;
