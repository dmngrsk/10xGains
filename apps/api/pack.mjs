import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

// Assemble the self-contained Azure Functions deployment package in deploy/:
// host.json + dist/ + a minimal package.json whose only dependency is
// @azure/functions. Everything else is bundled into dist/main.js by esbuild,
// and the full package.json cannot be deployed as-is: its workspace:* protocol
// is not resolvable by the plain npm install that runs during remote build.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));

await rm('deploy', { recursive: true, force: true });
await mkdir('deploy');
await cp('host.json', 'deploy/host.json');
await cp('dist', 'deploy/dist', { recursive: true });
await writeFile(
  'deploy/package.json',
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
