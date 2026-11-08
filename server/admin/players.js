// تبويب «اللاعبون وبيانات اللعبة» في لوحة الإدارة — ملف مستقل بيضيف نفسه جنب التبويبات الموجودة.
(() => {
  const nav = document.getElementById('tabs'); if (!nav) return;
  const btn = document.createElement('button'); btn.dataset.t = 'ply'; btn.textContent = '👥 اللاعبون وبيانات اللعبة'; nav.appendChild(btn);
  btn.addEventListener('click', (e) => { e.stopPropagation(); nav.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === btn)); view(); });
  const fmt = (d) => (d ? new Date(d).toLocaleString('ar-EG') : '—');
  async function view() {
    const pane = document.getElementById('pane'); pane.innerHTML = '<p>⏳</p>';
    let info, players; try { [info, players] = await Promise.all([api('/api/admin/info'), api('/api/admin/players')]); } catch (e) { pane.innerHTML = '<p class="empty">' + esc(e.message) + '</p>'; return; }
    const ops = info.operators || [];
    pane.innerHTML = `<div class="ad-card" style="display:block"><h3>📇 بيانات اللعبة والمطوّر والمشغّلين</h3>
      <p class="hint">بتظهر للاعبين في شاشة الدخول، ورقم الواتساب هو اللي بيتواصلوا عليه لإعادة ضبط كلمة السر.</p>
      <label>اسم اللعبة<input id="i-game" value="${esc(info.gameName)}"></label>
      <label>المطوّر<input id="i-dev" value="${esc(info.developer)}"></label>
      <label>واتساب الإدارة (بالكود الدولي، مثال 201001234567)<input id="i-wa" dir="ltr" value="${esc(info.whatsapp)}"></label>
      <label>ملاحظة تظهر للاعبين<input id="i-note" value="${esc(info.note)}"></label>
      <label>Google Client ID (لتفعيل الدخول بجوجل — من Google Cloud Console)<input id="i-gid" dir="ltr" value="${esc(info.googleClientId)}"></label>
      <h4>المشغّلون</h4><div id="i-ops">${ops.map((o, k) => opRow(o, k)).join('')}</div>
      <div class="row"><button class="btn sm" id="i-addop">+ مشغّل</button><button class="btn primary" id="i-save">💾 حفظ البيانات</button></div></div>
      <div class="ad-card" style="display:block;margin-top:12px"><h3>👥 اللاعبون (${players.length})</h3>
      ${players.length ? `<div style="overflow:auto"><table style="width:100%;font-size:13px;border-collapse:collapse"><tr style="text-align:right;color:var(--mute)"><th>الاسم</th><th>الهاتف / الإيميل</th><th>نقاط</th><th>توصيلات</th><th>آخر حفظ</th><th></th></tr>
      ${players.sort((a, b) => b.points - a.points).map((p) => `<tr data-id="${esc(p.id)}" style="border-top:1px solid var(--line)"><td>${esc(p.name)}</td><td dir="ltr">${esc(p.phone || p.email || '—')}${p.google ? ' 🅖' : ''}</td><td>${p.points}</td><td>${p.deliveries}</td><td>${fmt(p.updatedAt)}</td><td style="white-space:nowrap"><button class="btn sm" data-a="rst">🔑 إعادة ضبط</button> <button class="btn sm danger" data-a="del">🗑</button></td></tr>`).join('')}</table></div>` : '<p class="empty">لسه مفيش لاعبين سجّلوا.</p>'}</div>`;
    const rows = () => pane.querySelector('#i-ops');
    pane.querySelector('#i-addop').onclick = () => rows().insertAdjacentHTML('beforeend', opRow({}, rows().children.length));
    rows().onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) b.closest('.oprow').remove(); };
    pane.querySelector('#i-save').onclick = async () => {
      const operators = [...rows().querySelectorAll('.oprow')].map((r) => ({ name: r.querySelector('.o-n').value, role: r.querySelector('.o-r').value, whatsapp: r.querySelector('.o-w').value })).filter((o) => o.name || o.whatsapp);
      try { await api('/api/admin/info', { method: 'PUT', body: JSON.stringify({ gameName: pane.querySelector('#i-game').value, developer: pane.querySelector('#i-dev').value, whatsapp: pane.querySelector('#i-wa').value, note: pane.querySelector('#i-note').value, googleClientId: pane.querySelector('#i-gid').value, operators }) }); toast('اتحفظت بيانات اللعبة ✔'); } catch (e) { toast(e.message, true); }
    };
    pane.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.querySelector('[data-a=rst]').onclick = async () => { const pw = prompt('كلمة سر جديدة للاعب (سيبها فاضية لتوليد كلمة عشوائية):', ''); if (pw === null) return; try { const r = await api('/api/admin/players/' + tr.dataset.id + '/reset-password', { method: 'POST', body: JSON.stringify({ password: pw }) }); prompt('كلمة السر الجديدة — ابعتها للاعب على واتساب:', r.password); } catch (e) { toast(e.message, true); } };
      tr.querySelector('[data-a=del]').onclick = async () => { if (!confirm('حذف حساب ' + tr.children[0].textContent + ' نهائيًا؟')) return; try { await api('/api/admin/players/' + tr.dataset.id, { method: 'DELETE' }); view(); } catch (e) { toast(e.message, true); } };
    });
  }
  const opRow = (o) => `<div class="oprow" style="display:flex;gap:6px;margin:4px 0"><input class="o-n" placeholder="الاسم" value="${esc(o.name)}"><input class="o-r" placeholder="الدور" value="${esc(o.role)}"><input class="o-w" dir="ltr" placeholder="واتساب" value="${esc(o.whatsapp)}"><button class="btn sm danger" data-rm>✕</button></div>`;
})();
