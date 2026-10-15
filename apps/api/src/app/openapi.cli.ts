import { exportOpenApi } from './openapi.js';

// Usage: node dist/app/openapi.cli.js [output.json]
await exportOpenApi(process.argv[2] ?? 'openapi.json');
