/**
 * Type definitions for Deno APIs
 *
 * This file provides TypeScript declarations for Deno-specific globals
 * to improve IDE integration and eliminate linting errors.
 */

declare namespace Deno {
  /**
   * Environment variables interface
   */
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  /**
   * Get an environment variable
   */
  export const env: Env;

  /**
   * Console interface
   */
  export interface Console {
    log(...data: unknown[]): void;
    error(...data: unknown[]): void;
    warn(...data: unknown[]): void;
    info(...data: unknown[]): void;
    debug(...data: unknown[]): void;
  }

  /**
   * File system APIs
   */
  export namespace fs {
    export function readTextFileSync(path: string): string;
    export function writeTextFileSync(path: string, data: string): void;
    export function existsSync(path: string): boolean;
  }

  /**
   * Process information
   */
  export const cwd: () => string;
  export const args: string[];
  export const exit: (code?: number) => never;
}

/**
 * Fetch API types
 */
declare interface Request {
  url: string;
  method: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<FormData>;
}

declare interface Response {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  formData(): Promise<FormData>;
}

declare class Headers {
  constructor(init?: HeadersInit);
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  forEach(callback: (value: string, key: string) => void): void;
}
