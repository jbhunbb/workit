let acctData=[], acctActiveCat='';
const CAT_C = {DB:'bg-blue-100 text-blue-700',Server:'bg-emerald-100 text-emerald-700',API:'bg-violet-100 text-violet-700',Service:'bg-amber-100 text-amber-700','기타':'bg-slate-100 text-slate-600'};

async function acctLoad() {
  const d=await(await fetch('/api/accounts')).json();
  acctData=d.accounts||[];
  renderFilter(); renderGrid();
}
function renderFilter() {
  const cats=['', ...new Set(acctData.map(a=>a.category))];
  document.getElementById('acct-filter').innerHTML=cats.map(c=>`<button onclick="acctCat('${eA(c)}')" class="fpill ${acctActiveCat===c?'on':''}">${c||'전체'}</button>`).join('');
}
function acctCat(c) { acctActiveCat=c; renderFilter(); renderGrid(); }
function renderGrid() {
  const el   = document.getElementById('acct-grid');
  const list = acctActiveCat ? acctData.filter(a => a.category === acctActiveCat) : acctData;
  if (!list.length) {
    el.innerHTML = `<div class="flex flex-col items-center py-24 text-slate-400">
      <svg class="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
      <p class="text-sm font-medium">계정이 없습니다</p>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
    <table class="w-full text-sm table-fixed">
      <thead><tr class="text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
        <th class="px-4 py-2.5 text-left font-semibold th w-[22%]">이름</th>
        <th class="px-4 py-2.5 text-left font-semibold th w-[20%]">ID / Username</th>
        <th class="px-4 py-2.5 text-left font-semibold th w-[20%]">Password</th>
        <th class="px-4 py-2.5 text-left font-semibold th w-[15%]">URL</th>
        <th class="px-4 py-2.5 text-left font-semibold th w-[15%]">메모</th>
        <th class="px-4 py-2.5 th w-[8%] text-right"></th>
      </tr></thead>
      <tbody class="divide-y divide-slate-50">${list.map(acctRow).join('')}</tbody>
    </table>
  </div>`;
}

function acctRow(a) {
  const cc  = CAT_C[a.category] || 'bg-slate-100 text-slate-600';
  const cpI = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
  const eyeI = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
  return `<tr>
    <td class="px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-[13px] text-slate-900">${esc(a.name)}</span>
        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cc} flex-shrink-0">${esc(a.category)}</span>
      </div>
    </td>
    <td class="px-4 py-3">
      ${a.username ? `<div class="flex items-center gap-1.5 font-mono text-[12.5px] text-slate-700">
        ${esc(a.username)}
        <button onclick="copyText('${eA(a.username)}',this)" class="text-slate-300 hover:text-indigo-500 transition-colors">${cpI}</button>
      </div>` : `<span class="text-slate-300 text-xs">—</span>`}
    </td>
    <td class="px-4 py-3">
      ${a.password ? `<div class="flex items-center gap-1.5 font-mono text-[12.5px] text-slate-700">
        <span id="pw-${a.id}" class="tracking-widest select-none">••••••</span>
        <button onclick="acctReveal('${eA(a.id)}','${eA(a.password)}')" class="text-slate-300 hover:text-indigo-500 transition-colors">${eyeI}</button>
        <button onclick="copyText('${eA(a.password)}',this)" class="text-slate-300 hover:text-indigo-500 transition-colors">${cpI}</button>
      </div>` : `<span class="text-slate-300 text-xs">—</span>`}
    </td>
    <td class="px-4 py-3 text-xs text-slate-400 max-w-[160px]">
      <span class="block truncate" title="${esc(a.url)}">${esc(a.url) || '—'}</span>
    </td>
    <td class="px-4 py-3 text-xs text-slate-400 max-w-[180px]">
      <span class="block truncate" title="${esc(a.notes)}">${esc(a.notes) || '—'}</span>
    </td>
    <td class="px-4 py-3">
      <div class="flex items-center gap-2">
        <button onclick="acctOpenModal('${eA(a.id)}')" title="편집" class="text-slate-300 hover:text-sky-500 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="acctDel('${eA(a.id)}')" title="삭제" class="text-slate-300 hover:text-rose-500 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </td>
  </tr>`;
}
function acctReveal(id, pw) {
  const el=document.getElementById(`pw-${id}`);
  el.textContent = el.textContent === '••••••' ? pw : '••••••';
}
function acctOpenModal(id) {
  const a=id?acctData.find(x=>x.id===id):null;
  document.getElementById('acct-modal-title').textContent=a?'계정 편집':'계정 추가';
  document.getElementById('acct-id').value=a?.id||'';
  document.getElementById('acct-name').value=a?.name||'';
  document.getElementById('acct-cat').value=a?.category||'DB';
  document.getElementById('acct-user').value=a?.username||'';
  document.getElementById('acct-pw').value=a?.password||'';
  document.getElementById('acct-url').value=a?.url||'';
  document.getElementById('acct-notes').value=a?.notes||'';
  document.getElementById('acct-pw').type='password';
  document.getElementById('acct-modal').classList.add('open');
}
function acctCloseModal() { document.getElementById('acct-modal').classList.remove('open'); }
async function acctSubmit(e) {
  e.preventDefault();
  const id=document.getElementById('acct-id').value;
  const name=document.getElementById('acct-name').value.trim();
  if (!name) { toast('이름을 입력해주세요', false); document.getElementById('acct-name').focus(); return; }
  const payload={name,category:document.getElementById('acct-cat').value,username:document.getElementById('acct-user').value.trim(),password:document.getElementById('acct-pw').value.trim(),url:document.getElementById('acct-url').value.trim(),notes:document.getElementById('acct-notes').value.trim()};
  const r=await fetch(id?`/api/accounts/${id}`:'/api/accounts',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(r.ok){toast(id?'수정됨':'추가됨');acctCloseModal();await acctLoad();}
  else{const d=await r.json();toast(d.error||'오류',false);}
}
async function acctDel(id) {
  const a=acctData.find(x=>x.id===id);
  if(!confirm(`'${a?.name}' 삭제할까요?`))return;
  const r=await fetch(`/api/accounts/${id}`,{method:'DELETE'});
  if(r.ok){toast('삭제됨');await acctLoad();}else toast('삭제 실패',false);
}

// ═══════════════════════════════════════════════════════════
//  Kubernetes