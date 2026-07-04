import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

// Assemble the self-contained Azure Functions deployment package in deploy/:
// host.json + dist/ + a minimal package.json whose only dependency is
// @azure/functions. Everything else is bundled into dist/main.js by esbuild,
// and the full package.json cannot be deployed as-is: its workspace:* protocol
// is not resolvable by the plain npm install that runs during remote build.
// Resolve everything relative to this script, not the working directory, so
// the assembly (including the rm -rf) is safe no matter where it is run from.
const here = (path) => new URL(path, import.meta.url);

const pkg = JSON.parse(await readFile(here('package.json'), 'utf8'));

await rm(here('deploy'), { recursive: true, force: true });
await mkdir(here('deploy'));
await cp(here('host.json'), here('deploy/host.json'));
await cp(here('dist'), here('deploy/dist'), { recursive: true });
await writeFile(
  here('deploy/package.json'),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      main: pkg.main,
      dependencies: {
        '@azure/functions': pkg.dependencies['@azure/functions'],
      },
    },
    null,
    2
  ) + '\n'
);

console.log('Deployment package assembled in deploy/');
