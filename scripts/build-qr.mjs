import {build} from 'esbuild';
await build({entryPoints:['node_modules/qrcode/lib/browser.js'],bundle:true,format:'esm',platform:'browser',minify:true,outfile:'public/vendor/qr.js',legalComments:'linked'});
await build({entryPoints:['node_modules/jsqr/dist/jsQR.js'],bundle:true,format:'esm',platform:'browser',minify:true,outfile:'public/vendor/scan.js',legalComments:'linked'});
