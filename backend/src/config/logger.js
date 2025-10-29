import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const baseFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.metadata({ fillExcept: ['timestamp', 'level', 'message'] })
);

const jsonFormat = format.combine(baseFormat, format.json());

const devConsoleFormat = format.combine(
  baseFormat,
  format.colorize({ all: true }),
  format.printf(({ timestamp, level, message, stack, metadata }) => {
    const meta = Object.keys(metadata || {}).length ? ` ${JSON.stringify(metadata)}` : '';
    return stack
      ? `${timestamp} [${level}] ${message}${meta}\n${stack}`
      : `${timestamp} [${level}] ${message}${meta}`;
  })
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'relay-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  format: jsonFormat,
  transports: [
    new transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: process.env.NODE_ENV === 'production' ? jsonFormat : devConsoleFormat,
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: jsonFormat,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(logDir, 'exceptions.log'), format: jsonFormat }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logDir, 'rejections.log'), format: jsonFormat }),
  ],
});

export const createModuleLogger = (moduleMeta = {}) =>
  logger.child({ module: moduleMeta.module || moduleMeta.name || 'unknown-module', ...moduleMeta });

export default logger;
