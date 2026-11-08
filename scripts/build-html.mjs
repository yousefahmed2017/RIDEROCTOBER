// يبني نسخة ملف HTML واحد (كل الكود + CSS + Three.js + PeerJS جواه) في dist/october-rider.html
// تشغيل: npm run build:html
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const out = await build({
  entryPoints: [path.join(www, 'js/game.js')], bundle: true, minify: true, format: 'iife', target: 'es2020',
  write: false, legalComments: 'none', charset: 'utf8', nodePaths: [path.join(root, 'node_modules')],
});
const js = out.outputFiles[0].text;
const peer = fs.readFileSync(path.join(root, 'node_modules/peerjs/dist/peerjs.min.js'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
const css = fs.readFileSync(path.join(www, 'style.css'), 'utf8');

// الخريطة الحقيقية (www/data/osm.json) مدمجة gzip+base64 عشان اللعبة تشتغل من ملف واحد حتى بدون نت
const osmFile = path.join(www, 'data/osm.json');
const blocksIdx = fs.existsSync(path.join(root, 'www/data/blocks/index.json')) ? fs.readFileSync(path.join(root, 'www/data/blocks/index.json'), 'utf8') : null; // ملخص بلوكات الأحياء (صغير) — البلوكات نفسها بتتقص من الخريطة المدمجة
const osmGz = fs.existsSync(osmFile) ? zlib.gzipSync(fs.readFileSync(osmFile), { level: 9 }).toString('base64') : '';
// المحتوى الافتراضي المدمج (صورة صيدليات الجهيني كـ data URI عشان يشتغل من file://)
const lmImg = path.join(www, 'assets/landmarks/elgehainy.jpg');
const dflt = { version: 1, ads: [], landmarks: fs.existsSync(lmImg) ? [{ id: 'home-elgehainy', image: 'data:image/jpeg;base64,' + fs.readFileSync(lmImg).toString('base64') }] : [], models: {}, bikeModels: {} };
let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
html = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<script src="https:\/\/unpkg\.com\/peerjs[^>]*><\/script>\s*/, '')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="js\/game\.js"><\/script>/, () => `<script>window.__DEFAULT_CONTENT__=${safe(JSON.stringify(dflt))};${osmGz ? 'window.__OSM_GZ__="' + osmGz + '";' : ''}${blocksIdx ? 'window.__BLOCKS_INDEX__=' + safe(blocksIdx) + ';' : ''}</script>\n<script>${safe(peer)}</script>\n<script>${safe(js)}</script>`);
for (const [f, mime] of [['assets/logo.png', 'image/png'], ['favicon.png', 'image/png']]) { const d = 'data:' + mime + ';base64,' + fs.readFileSync(path.join(www, f)).toString('base64'); html = html.split(f).join(d); } // اللوجو مدمج في الملف الواحد
if (html.includes('importmap') || html.includes('src="js/game.js"') || html.includes('unpkg.com')) throw new Error('بقى جزء مش متضمّن في الملف');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const dest = path.join(root, 'dist/october-rider.html');
fs.writeFileSync(dest, html);
console.log('✓', dest, (fs.statSync(dest).size / 1024).toFixed(0) + ' KB');
