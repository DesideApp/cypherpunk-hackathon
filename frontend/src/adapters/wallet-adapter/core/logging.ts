export interface WaLogger {
  debug: (...a: any[]) => void;
  info: (...a: any[]) => void;
  warn: (...a: any[]) => void;
  error: (...a: any[]) => void;
}

let logger: WaLogger = console;

export const setLogger = (l: WaLogger) => { logger = l; };

export const log = () => logger;
