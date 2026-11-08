// قايمة الموسيقى الديناميكية: بتقرا www/music/menu و www/music/game كل مرة (من غير ما تحتاج npm run music).
import fs from 'node:fs';
import path from 'node:path';
const AUD = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm|weba)$/i;
export const AUDIO_MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/ogg', '.webm': 'audio/webm', '.weba': 'audio/webm' };
export function musicPlaylist(WWW) {
  const ls = (sub) => { try { return fs.readdirSync(path.join(WWW, 'music', sub)).filter((f) => AUD.test(f)).sort().map((f) => `music/${sub}/${encodeURIComponent(f)}`); } catch (e) { return []; } };
  return { menu: ls('menu'), game: ls('game') };
}
