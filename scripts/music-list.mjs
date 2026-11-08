// بيولّد www/music/playlist.json من فولدرين: www/music/menu (موسيقى القائمة) و www/music/game (موسيقى اللعب — ترتيب عشوائي ومتكرر).
// تشغيل: npm run music
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../www/music'), AUD = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm|weba)$/i;
const ls = (sub) => { const d = path.join(dir, sub); fs.mkdirSync(d, { recursive: true }); return fs.readdirSync(d).filter((f) => AUD.test(f)).sort().map((f) => `music/${sub}/${encodeURIComponent(f)}`); };
const out = { menu: ls('menu'), game: ls('game') }; fs.writeFileSync(path.join(dir, 'playlist.json'), JSON.stringify(out, null, 1));
console.log(`✓ menu: ${out.menu.length} · game: ${out.game.length} → www/music/playlist.json`);
