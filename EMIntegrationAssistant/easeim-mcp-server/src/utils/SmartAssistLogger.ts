import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export type SmartAssistLogEntry = {
  log_version: 'v1';
  timestamp: string;
  request_id: string;
  session_id: string;
  raw_query: string;
  enhanced_query?: string;
  platform?: {
    provided?: string | null;
    detected?: string | null;
    effective?: string | null;
  };
  ambiguity?: {
    is_ambiguous: boolean;
    type?: string;
  };
  continuity?: {
    is_continuation: boolean;
    type?: string;
  };
  intent?: {
    name: string;
    confidence: number;
    sub_intent?: string;
  };
  entities?: Record<string, unknown>;
  template_match?: {
    template_name: string;
    score: number;
  };
  route: {
    name: string;
    reason?: string;
  };
  response: {
    type: 'answer' | 'clarification' | 'error';
  };
  timing_ms: {
    total: number;
  };
  error?: {
    message: string;
  };
};

export class SmartAssistLogger {
  private static enabled = SmartAssistLogger.resolveEnabled();
  private static logPath = process.env.EASEIM_SMART_ASSIST_LOG_PATH;
  private static dirReady = false;

  static newRequestId(): string {
    return randomUUID();
  }

  static log(entry: SmartAssistLogEntry) {
    if (!SmartAssistLogger.enabled) return;
    const line = JSON.stringify(entry);

    if (SmartAssistLogger.logPath) {
      SmartAssistLogger.ensureDir();
      fs.appendFileSync(SmartAssistLogger.logPath, `${line}\n`);
      return;
    }

    console.error(line);
  }

  private static resolveEnabled(): boolean {
    const value = process.env.EASEIM_SMART_ASSIST_LOG;
    if (!value) return false;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private static ensureDir() {
    if (SmartAssistLogger.dirReady || !SmartAssistLogger.logPath) return;
    const dir = path.dirname(SmartAssistLogger.logPath);
    fs.mkdirSync(dir, { recursive: true });
    SmartAssistLogger.dirReady = true;
  }
}
