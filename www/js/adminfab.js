// أيقونة الإدارة العائمة: بتظهر للمدير (بعد دخول كلمة سر الإدارة) في كل الأوضاع، بتتسحب لأي مكان،
// وبتفتح قايمة سريعة: فتح اللوحة · إضافة إعلان/بيلبورد/معلم في مكانك · خروج.
import { makeFloating, anchorPanel } from './float.js';

export function createAdminFab({ openPanel, addHere, logout, canAddHere, can = () => true }) {
  const btn = document.createElement('button'); btn.id = 'adm-fab'; btn.className = 'round hidden'; btn.title = 'الإدارة (اسحبها لأي مكان)'; btn.textContent = '🛠️';
  const pan = document.createElement('div'); pan.id = 'adm-menu'; pan.className = 'hidden';
  document.body.appendChild(btn); document.body.appendChild(pan);
  const draw = () => {
    const here = canAddHere();
    pan.innerHTML = `<b>🛠️ الإدارة</b>
      <button data-a="panel">📋 فتح لوحة الإدارة</button>
      ${here ? `${can('ads') ? '<button data-a="banner">📍 بانر هنا</button><button data-a="bill">🖼️ بيلبورد هنا</button>' : ''}${can('places') ? '<button data-a="lm">🏛️ معلم هنا</button>' : ''}${can('look') ? '<button data-a="shop">🏪 محل هنا</button>' : ''}` : '<small>الإضافة من موقعك متاحة أثناء اللعب في المدينة.</small>'}
      <button data-a="out" class="out">🚪 خروج من الإدارة</button>`;
  };
  const place = anchorPanel(pan, btn);
  makeFloating(btn, 'admin', { def: { x: 0.99, y: 0.2 }, onTap: () => { pan.classList.toggle('hidden'); draw(); place(); } });
  pan.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return; pan.classList.add('hidden');
    if (a === 'panel') openPanel(); else if (a === 'out') logout(); else addHere(a);
  };
  return { show(v) { btn.classList.toggle('hidden', !v); if (!v) pan.classList.add('hidden'); } };
}
