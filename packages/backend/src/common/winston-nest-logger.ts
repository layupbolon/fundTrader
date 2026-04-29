import type { LoggerService } from '@nestjs/common';
import type winston from 'winston';

type LogMeta = Record<string, unknown>;

/**
 * Adapts Nest LoggerService calls to Winston's `log(level, message, meta)` API.
 *
 * Nest calls logger methods as `log(message, ...optionalParams)`, while raw
 * Winston expects the first argument to be the log level. Passing a Winston
 * instance directly to `app.useLogger()` makes route mapping messages become
 * invalid levels such as "Mapped {/api/health, GET} route".
 */
export class WinstonNestLogger implements LoggerService {
  constructor(private readonly logger: winston.Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const meta = this.buildMeta(level, message, optionalParams);
    this.logger.log(level, this.formatMessage(message), meta);
  }

  private buildMeta(level: string, message: unknown, optionalParams: unknown[]): LogMeta {
    const meta: LogMeta = {};
    const remainingParams = [...optionalParams];

    if (message instanceof Error && message.stack) {
      meta.stack = message.stack;
    }

    if (level === 'error' && typeof remainingParams[0] === 'string') {
      meta.trace = remainingParams.shift();
    }

    const extraParams: unknown[] = [];

    for (const param of remainingParams) {
      if (param === undefined || param === null) {
        continue;
      }

      if (typeof param === 'string') {
        if (!meta.context) {
          meta.context = param;
        } else {
          extraParams.push(param);
        }
        continue;
      }

      if (this.isPlainObject(param)) {
        Object.assign(meta, param);
        continue;
      }

      extraParams.push(param);
    }

    if (extraParams.length > 0) {
      meta.params = extraParams;
    }

    return meta;
  }

  private formatMessage(message: unknown): string {
    if (message instanceof Error) {
      return message.message;
    }

    if (typeof message === 'string') {
      return message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private isPlainObject(value: unknown): value is LogMeta {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
