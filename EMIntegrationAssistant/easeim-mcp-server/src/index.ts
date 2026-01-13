#!/usr/bin/env node
/**
 * 环信 IM SDK MCP Server 入口
 */

import { EaseIMServer } from './server.js';

async function main() {
  const server = new EaseIMServer();
  await server.start();
}

main().catch((error) => {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
});
