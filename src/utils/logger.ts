/**
 * Minimal logger used by the Clash of the Realms scaffolding. In the
 * production bot a more sophisticated logger may already exist; in
 * that case remove this file and adjust imports accordingly.
 */
export const logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
};