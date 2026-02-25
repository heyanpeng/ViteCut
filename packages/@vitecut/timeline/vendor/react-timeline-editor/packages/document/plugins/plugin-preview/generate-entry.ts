import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { staticPath, virtualDir } from './constant';
import type { DemoInfo } from './types';

function generateEntryForPerComponent(demos: DemoInfo, entryCssPath: string): Record<string, string> {
  const sourceEntry: Record<string, string> = {};
  Object.values(demos).forEach((routes) => {
    routes.forEach((route) => {
      const { id, path: demoPath } = route;
      const entry = join(virtualDir, `${id}.entry.tsx`);
      const reactEntry = `
      import { render } from 'react-dom';
      import ${JSON.stringify(entryCssPath)};
      import Demo from ${JSON.stringify(demoPath)};
      render(<Demo />, document.getElementById('root'));
      `;
      const entryContent = reactEntry;
      writeFileSync(entry, entryContent);
      sourceEntry[id] = entry;
    });
  });
  return sourceEntry;
}

// TODO: Support custom entry template files
export function generateEntry(demos: DemoInfo): Record<string, string> {
  const sourceEntry: Record<string, string> = {};
  const entryCssPath = join(staticPath, 'global-styles', 'entry.css');
  const entries = generateEntryForPerComponent(demos, entryCssPath);
  Object.assign(sourceEntry, entries);

  return sourceEntry;
}
