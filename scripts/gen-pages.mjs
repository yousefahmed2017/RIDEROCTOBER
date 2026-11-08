// بيولّد صفحات ثابتة (about/privacy/terms) من js/info.js بنفس هوية اللعبة — للنشر على دومين (مفيدة لمحركات البحث)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { INFO } from '../www/js/info.js';
const www = path.join(path.dirname(fileURLToPath(import.meta.url)), '../www');
const nav = Object.entries(INFO).map(([k, v]) => `<a href="../${k}/">${v.t}</a>`).join('');
for (const [k, v] of Object.entries(INFO)) {
  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0E1A2B"><title>${v.t} — كوكب الجحود أكتوبر</title><meta name="description" content="${v.t} — لعبة دليفري وسباقات بالموتوسيكل في 6 أكتوبر.">
<link rel="icon" href="../favicon.png"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#0E1A2B;--glass:rgba(14,26,43,.78);--line:rgba(255,255,255,.12);--sun:#FF7A1A;--gold:#FFC83D;--text:#F7F1E3;--mute:#A9B4C6}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Cairo,Tahoma,system-ui,sans-serif;font-weight:600;color:var(--text);line-height:1.9;background:radial-gradient(120% 90% at 50% 100%,#ff7a1a44,transparent 55%),linear-gradient(180deg,#0a1226,#16263D 60%,#3a2a3f);padding:20px}
main{max-width:720px;margin:0 auto;background:var(--glass);border:1px solid var(--line);border-radius:26px;padding:24px 22px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
h1{margin:0 0 6px;font-size:26px}h3{color:var(--gold);margin:18px 0 4px}a{color:var(--gold)}nav{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 14px;font-size:14px}
.cta{display:inline-block;margin-top:14px;padding:12px 22px;border-radius:14px;background:linear-gradient(135deg,var(--sun),#ff4d1a);color:#fff;font-weight:800;text-decoration:none}.muted{color:var(--mute);font-size:13px}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body><main><nav>${nav}</nav><h1>${v.t}</h1>${v.h}<a class="cta" href="../index.html">العب دلوقتي 🏍️</a></main></body></html>`;
  fs.mkdirSync(path.join(www, k), { recursive: true }); fs.writeFileSync(path.join(www, k, 'index.html'), html);
}
console.log('✓ صفحات ثابتة:', Object.keys(INFO).join(', '));
