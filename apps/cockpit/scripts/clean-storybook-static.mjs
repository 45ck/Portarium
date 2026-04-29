import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = join(scriptDir, '..', 'storybook-static');

rmSync(outputDir, { recursive: true, force: true });
