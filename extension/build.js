require('esbuild').build({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'out/main.js',
    sourcemap: true,
    format: 'cjs',
    //external: Object.keys(require('../package.json').dependencies),
    external: ['vscode', 'vscode-*', 'typescript'],
});