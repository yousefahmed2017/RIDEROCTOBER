// خلاط الصوت أثناء اللعب: زر 🔊 عائم (بيتسحب) بيفتح شريط تحكم: عام · مؤثرات · موتور · موسيقى · فويس الشات · النطق.
// الإعدادات بتتحفظ على جهاز اللاعب وبتتطبق فورًا.
import { makeFloating, anchorPanel } from './float.js';
import { speechSupported, arabicVoices } from './speech.js';
const KEY = 'orider-audio-v1';
export const MIX_DEFAULT = { master: 1, sfx: 1, eng: 0.8, music: 1, chat: 1, speech: 1, speechOn: true };
export const loadMix = () => { try { return { ...MIX_DEFAULT, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { return { ...MIX_DEFAULT }; } };
const saveMix = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } };

export function createMixer({ sfx, voice, music, onSpeechTest }) {
  const mix = loadMix();
  const apply = () => { sfx.setVol('master', mix.master); sfx.setVol('sfx', mix.sfx); sfx.setVol('eng', mix.eng); voice.vol = mix.chat; if (music && music.setVolume) music.setVolume(mix.music * mix.master); };
  apply();
  const st = document.createElement('style'); st.textContent = '#mixbtn{position:fixed;z-index:60}#mixp{position:fixed;z-index:61;width:min(300px,88vw);background:rgba(14,26,43,.96);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:12px;font:600 13px Cairo,Tahoma,Arial,sans-serif;direction:rtl;box-shadow:0 10px 30px rgba(0,0,0,.5)}#mixp.hidden{display:none}#mixp h4{margin:0 0 8px;font-size:14px}#mixp label{display:grid;grid-template-columns:86px 1fr 38px;align-items:center;gap:8px;margin:7px 0}#mixp input[type=range]{width:100%;accent-color:#19c2a0;min-height:28px}#mixp .row{display:flex;gap:8px;margin-top:8px}#mixp button{flex:1;min-height:40px;border-radius:10px;border:0;background:#263a56;color:#fff;font:inherit;cursor:pointer}#mixp button:focus-visible,#mixp input:focus-visible{outline:2px solid #ffc83d;outline-offset:2px}#mixp small{color:#9fb0c6;display:block;margin-top:6px}';
  document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'mixbtn'; btn.className = 'round'; btn.title = 'التحكم في الصوت (اسحبه لأي مكان)'; btn.setAttribute('aria-label', 'التحكم في الصوت'); btn.textContent = '🔊';
  const pan = document.createElement('div'); pan.id = 'mixp'; pan.className = 'hidden'; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', 'التحكم في الصوت');
  document.body.append(btn, pan);
  const ROWS = [['master', '🔊 الصوت العام'], ['sfx', '🔔 المؤثرات'], ['eng', '🏍️ الموتور'], ['music', '🎵 الموسيقى'], ['chat', '🎙️ فويس الشات'], ['speech', '🗣️ نطق التحذيرات']];
  const draw = () => {
    pan.innerHTML = `<h4>🎚️ التحكم في الصوت</h4>${ROWS.map(([k, l]) => `<label><span>${l}</span><input type="range" min="0" max="1" step="0.05" value="${mix[k]}" data-k="${k}" aria-label="${l}"><output>${Math.round(mix[k] * 100)}%</output></label>`).join('')}
    <div class="row"><button data-a="speechOn">${mix.speechOn ? '🗣️ النطق: شغّال' : '🔇 النطق: مقفول'}</button><button data-a="test">▶ جرّب النطق</button></div>
    <div class="row"><button data-a="mute">${mix.master === 0 ? '🔊 رجّع الصوت' : '🔇 كتم الكل'}</button><button data-a="reset">↺ الافتراضي</button></div>
    ${speechSupported() ? (arabicVoices().length ? '' : '<small>جهازك مفيهوش صوت عربي للنطق — نزّل صوت عربي من إعدادات الجهاز (Text-to-speech).</small>') : '<small>المتصفح ده مبيدعمش النطق.</small>'}`;
  };
  const place = anchorPanel(pan, btn);
  makeFloating(btn, 'mixer', { def: { x: 0.01, y: 0.2 }, onTap: () => { pan.classList.toggle('hidden'); draw(); place(); } });
  pan.oninput = (e) => { const k = e.target.dataset.k; if (!k) return; mix[k] = +e.target.value; e.target.nextElementSibling.textContent = Math.round(mix[k] * 100) + '%'; apply(); saveMix(mix); sfx.init(); if (k !== 'master' && k !== 'music' && k !== 'chat' && k !== 'speech') { /* ديمو بسيط */ } };
  pan.onchange = (e) => { const k = e.target.dataset.k; if (k === 'sfx') sfx.ding(); else if (k === 'speech') onSpeechTest && onSpeechTest(); };
  pan.onclick = (e) => { const a = e.target.closest('button') && e.target.closest('button').dataset.a; if (!a) return;
    if (a === 'speechOn') mix.speechOn = !mix.speechOn; else if (a === 'test') onSpeechTest && onSpeechTest(); else if (a === 'mute') mix.master = mix.master === 0 ? 1 : 0; else if (a === 'reset') Object.assign(mix, MIX_DEFAULT);
    apply(); saveMix(mix); draw(); };
  document.addEventListener('pointerdown', (e) => { if (!pan.classList.contains('hidden') && !pan.contains(e.target) && e.target !== btn) pan.classList.add('hidden'); });
  return { mix, apply, show(v) { btn.classList.toggle('hidden', !v); if (!v) pan.classList.add('hidden'); }, local: () => ({ on: mix.speechOn, vol: mix.speech * mix.master }) };
}
