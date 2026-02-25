import { RSPRESS_TEMP_DIR } from '@rspress/shared';
import * as path from 'node:path';

export const staticPath = path.join(__dirname, 'static');
export const virtualDir = path.join(process.cwd(), 'node_modules', RSPRESS_TEMP_DIR, 'virtual-demo');
