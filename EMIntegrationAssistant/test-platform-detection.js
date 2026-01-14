
import { detectMissingPlatform } from './easeim-mcp-server/src/utils/ResponseBuilder.js';

const query = "如何自定义一个新的订单消息";
const result = detectMissingPlatform(query);

console.log('Query:', query);
console.log('Result:', JSON.stringify(result, null, 2));

const query2 = "自定义消息";
const result2 = detectMissingPlatform(query2);
console.log('Query:', query2);
console.log('Result:', JSON.stringify(result2, null, 2));
