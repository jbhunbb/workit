// ═══════════════════════════════════════════════════════════
let kubeContexts = [], sysKubeContexts = [], kubeInputMode = 'file', kubeParsed = [], kubeEditId = '', kubeOrigParsed = null, kubeUnregCollapsed = false;

async function kubeLoad() {
  try {
    const [r1, r2] = await Promise.all([
      fetch('/api/kube/contexts'),
      fetch('/api/kube/system'),
    ]);
    const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
    kubeContexts    = d1.contexts || [];
    sysKubeContexts = d2.contexts || [];
    kubeRender();
  } catch(err) {
    document.getElementById('kube-list').innerHTML =
      `<div class="text-center py-20 text-rose-500 text-sm">로드 실패: ${err.message}</div>`;
  }
}

function _kubeDisplayList() {
  const list = [];
  for (const c of kubeContexts) {
    if (kubeDraft.edits.has(c.id)) {
      list.push({ ...c, ...kubeDraft.edits.get(c.id), id: c.id, _draftState: 'edit' });
    } else if (kubeDraft.deletes.has(c.id)) {
      list.push({ ...c, _draftState: 'delete' });
    } else {
      list.push({ ...c, _draftState: null });
    }
  }
  for (const add of kubeDraft.adds) {
    list.push({ ...add, id: add._draftId, _draftState: 'add' });
  }
  return list;
}

function kubeRender() {
  const el = document.getElementById('kube-list');
  const allCtx = _kubeDisplayList();
  const sysContextsToShow = sysKubeContexts.filter(c => {
    const workit = allCtx.find(x => x.context_name === c.context_name);
    return !workit || workit._draftState === 'add';
  });

  if (!allCtx.length && !sysContextsToShow.length) {
    el.innerHTML = `<div class="flex flex-col items-center justify-center py-24 text-slate-400">
      <svg class="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M12 5l7 7-7 7"/></svg>
      <p class="text-sm font-medium">Context가 없습니다</p>
      <p class="text-xs mt-1">context 추가 버튼을 눌러 시작하세요</p>
    </div>`;
    return;
  }
  const reg = allCtx.filter(c => c.project);
  const byProject = {};
  for (const c of reg) (byProject[c.project] = byProject[c.project] || []).push(c);
  let html = '';
  // ── ~/.kube/config 시스템 contexts ───────────────────────────
  if (sysContextsToShow.length) {
    const kubeChevron = kubeUnregCollapsed
      ? `<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`
      : `<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
    html += `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4 shadow-sm">
      <div class="px-5 py-2.5 flex items-center gap-2.5 cursor-pointer select-none" style="background:#1e3a5f" onclick="toggleKubeUnreg()">
        <svg class="w-3.5 h-3.5 text-sky-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
        <span class="text-white font-bold text-xs uppercase tracking-widest">시스템 Config</span>
        <span class="bg-white/20 text-white text-[11px] px-1.5 py-0.5 rounded-full font-semibold">${sysContextsToShow.length}</span>
        <span class="text-sky-300 text-[11px] ml-1">~/.kube/config</span>
        <span class="ml-auto">${kubeChevron}</span>
      </div>
      ${kubeUnregCollapsed ? '' : `<table class="w-full text-sm table-fixed">
        <thead><tr class="border-b border-slate-100 dark:border-slate-800">
          <th class="px-4 py-2.5 text-left th w-[8%]">Env</th>
          <th class="px-4 py-2.5 text-left th w-[22%]">컨텍스트</th>
          <th class="px-4 py-2.5 text-left th w-[15%]">클러스터</th>
          <th class="px-4 py-2.5 text-left th w-[20%]">서버 주소</th>
          <th class="px-4 py-2.5 text-left th w-[12%]">사용자</th>
          <th class="px-4 py-2.5 text-left th w-[15%]">Namespace</th>
          <th class="px-4 py-2.5 text-left th w-[7%]">메모</th>
          <th class="px-4 py-2.5 th w-[8%] text-right"></th>
        </tr></thead>
        <tbody class="divide-y divide-slate-50">${sysContextsToShow.map(kubeSystemRow).join('')}</tbody>
      </table>`}
    </div>`;
  }
  // ── 등록된 contexts — 알파벳순 ───────────────────────────────
  Object.keys(byProject).sort((a, b) => a.localeCompare(b)).forEach(proj => {
    html += `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4 shadow-sm">
      <div class="px-5 py-3 proj-hdr flex items-center gap-2.5">
        <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-white/10 text-white/90 flex-shrink-0">${(proj[0]||'?').toUpperCase()}</div>
        <span class="text-white/90 font-semibold text-[12.5px] tracking-wide">${esc(proj)}</span>
        <span class="bg-white/15 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">${byProject[proj].length}</span>
      </div>
      <table class="w-full text-sm table-fixed">
        <thead><tr class="border-b border-slate-100 dark:border-slate-800">
          <th class="px-4 py-2.5 text-left th w-[8%]">Env</th>
          <th class="px-4 py-2.5 text-left th w-[22%]">컨텍스트</th>
          <th class="px-4 py-2.5 text-left th w-[15%]">클러스터</th>
          <th class="px-4 py-2.5 text-left th w-[20%]">서버 주소</th>
          <th class="px-4 py-2.5 text-left th w-[12%]">사용자</th>
          <th class="px-4 py-2.5 text-left th w-[8%]">Namespace</th>
          <th class="px-4 py-2.5 text-left th w-[7%]">메모</th>
          <th class="px-4 py-2.5 th w-[8%] text-right"></th>
        </tr></thead>
        <tbody class="divide-y divide-slate-50">${byProject[proj].map(kubeRegRow).join('')}</tbody>
      </table>
    </div>`;
  });
  el.innerHTML = html;
}

function kubeRegRow(c) {
  const serverShort = c.server ? c.server.replace(/^https?:\/\//, '') : '—';
  const isDelete = c._draftState === 'delete';
  const isAdd    = c._draftState === 'add';
  const isEdit   = c._draftState === 'edit';
  const badge = isDelete
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">삭제 예정</span>`
    : isAdd
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">신규</span>`
    : isEdit
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">수정됨</span>`
    : '';
  const rowCls = isDelete ? 'opacity-50' : '';
  const actions = isDelete
    ? `<button onclick="kubeUndoDel('${eA(c.id)}')" class="text-rose-400 hover:text-rose-600 text-xs font-semibold transition-colors">취소</button>`
    : `<button onclick="kubeOpenEdit('${eA(c.id)}')" title="편집" class="text-slate-300 hover:text-sky-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
       </button>
       <button onclick="kubeDel('${eA(c.id)}')" title="삭제" class="text-slate-300 hover:text-rose-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
       </button>`;
  return `<tr class="${rowCls}">
    <td class="px-4 py-3">${envBadge(c.env)}</td>
    <td class="px-4 py-3"><div class="flex items-center gap-1.5 truncate w-full">${_cp(c.context_name,'font-mono font-semibold text-slate-900 dark:text-slate-100 text-[12.5px]')}${badge}</div></td>
    <td class="px-4 py-3">${_cp(c.cluster_name,'text-slate-600 dark:text-slate-400 text-[13px]')}</td>
    <td class="px-4 py-3">${_cpAs(serverShort, c.server,'text-slate-500 dark:text-slate-400 text-xs font-mono')}</td>
    <td class="px-4 py-3 text-slate-400 dark:text-slate-400 text-[13px]">${esc(c.user_name) || '<span class="text-slate-300">—</span>'}</td>
    <td class="px-4 py-3 text-slate-400 dark:text-slate-400 text-xs truncate">${esc(c.namespace) || '<span class="text-slate-300">—</span>'}</td>
    <td class="px-4 py-3 text-slate-400 dark:text-slate-400 text-xs truncate" title="${esc(c.description)}">${esc(c.description) || '<span class="text-slate-300">—</span>'}</td>
    <td class="px-4 py-3"><div class="flex items-center justify-end gap-2.5">${actions}</div></td>
  </tr>`;
}

function kubeUnregRow(c) {
  const serverShort = c.server ? c.server.replace(/^https?:\/\//, '') : '—';
  const isDelete = c._draftState === 'delete';
  const badge = isDelete
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">삭제 예정</span>`
    : '';
  const rowCls = isDelete ? 'opacity-50' : 'hover:bg-sky-50/30 transition-colors';
  const trashBtn = `<button onclick="kubeDel('${eA(c.id)}')" title="삭제" class="text-slate-300 hover:text-rose-500 transition-colors">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
  </button>`;
  const actions = isDelete
    ? `<button onclick="kubeUndoDel('${eA(c.id)}')" class="text-rose-400 hover:text-rose-600 text-xs font-semibold transition-colors">취소</button>`
    : c.project
    ? `<button onclick="kubeOpenEdit('${eA(c.id)}')"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors border border-sky-200 whitespace-nowrap">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        편집
       </button>
       ${trashBtn}`
    : `<button onclick="kubeOpenEdit('${eA(c.id)}')"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 transition-colors border border-sky-200 whitespace-nowrap">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        등록
       </button>
       ${trashBtn}`;
  return `<tr class="${rowCls}">
    <td class="px-4 py-3.5"><div class="flex items-center gap-1.5">${_cp(c.context_name,'font-mono font-semibold text-slate-900 dark:text-slate-100 text-[12.5px]')}${badge}</div></td>
    <td class="px-4 py-3.5">${_cp(c.cluster_name,'text-slate-500 text-[13px]')}</td>
    <td class="px-4 py-3.5">${_cpAs(serverShort, c.server,'text-slate-400 text-xs font-mono')}</td>
    <td class="px-4 py-3.5 text-slate-400 text-[13px]">${esc(c.user_name) || '<span class="text-slate-300">—</span>'}</td>
    <td class="px-4 py-3.5"><div class="flex items-center justify-end gap-2">${actions}</div></td>
  </tr>`;
}

function kubeSystemRow(c) {
  const serverShort = c.server ? c.server.replace(/^https?:\/\//, '') : '—';
  const workit = _kubeDisplayList().find(x => x.context_name === c.context_name);
  const isDraftAdd = workit && workit._draftState === 'add';

  let actionCell;
  if (isDraftAdd) {
    actionCell = `<div class="flex items-center justify-end px-1"><span class="text-[11px] font-bold text-amber-500 whitespace-nowrap">이전 대기 중</span></div>`;
  } else {
    const regBtn = workit
      ? `<button onclick="kubeOpenEdit('${eA(workit.id)}')"
          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold text-sky-600 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors border border-sky-200 dark:border-sky-800 whitespace-nowrap">
          편집
         </button>`
      : `<button onclick='kubeRegisterSysCtx(${JSON.stringify(c).replace(/'/g,"&#39;")})'
          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
          등록
         </button>`;
    actionCell = `<div class="flex items-center justify-end gap-2">
      ${regBtn}
      <button onclick="kubeSystemDelete('${eA(c.context_name)}')" title="~/.kube/config에서 삭제" class="text-slate-300 hover:text-rose-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>`;
  }

  const badge = isDraftAdd
    ? `<span class="ml-1.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap staged-badge">저장 시 시스템 설정에서 삭제됨</span>`
    : '';
  const rowCls = isDraftAdd ? 'opacity-60 bg-amber-50/10 dark:bg-amber-950/10' : 'hover:bg-sky-50/30 transition-colors';

  return `<tr class="${rowCls}">
    <td class="px-4 py-3"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase leading-none">Sys</span></td>
    <td class="px-4 py-3"><div class="flex items-center gap-1.5 truncate w-full">${_cp(c.context_name,'font-mono font-semibold text-slate-900 dark:text-slate-100 text-[12.5px]')}${badge}</div></td>
    <td class="px-4 py-3">${_cp(c.cluster_name,'text-slate-500 dark:text-slate-400 text-[13px]')}</td>
    <td class="px-4 py-3">${_cpAs(serverShort, c.server,'text-slate-400 dark:text-slate-500 text-xs font-mono')}</td>
    <td class="px-4 py-3 text-slate-400 dark:text-slate-500 text-[13px]">${esc(c.user_name) || '<span class="text-slate-300">—</span>'}</td>
    <td class="px-4 py-3 text-slate-300 text-xs">—</td>
    <td class="px-4 py-3 text-slate-300 text-xs">—</td>
    <td class="px-4 py-3">${actionCell}</td>
  </tr>`;
}

async function kubeSystemDelete(ctxName) {
  if (!confirm(`~/.kube/config에서 "${ctxName}" context를 삭제하시겠습니까?\n(백업 파일이 자동 생성됩니다)`)) return;
  const res = await fetch(`/api/kube/system/${encodeURIComponent(ctxName)}`, { method: 'DELETE' });
  if (res.ok) { toast(`"${ctxName}" 삭제됨`); await kubeLoad(); }
  else { const d = await res.json(); toast(`삭제 실패: ${d.error || '오류'}`); }
}

function kubeOpenModal() {
  kubeEditId = ''; kubeParsed = []; kubeOrigParsed = null;
  document.getElementById('kube-step-input').classList.remove('hidden');
  document.getElementById('kube-step-parsed').classList.add('hidden');
  document.getElementById('kube-modal-title').textContent = 'Kubernetes Context 추가';
  document.getElementById('kube-add-btn').textContent = '저장';
  kubeSetInputMode('file');
  dzReset('kube-dz','kube-dz-icon','kube-dz-text');
  document.getElementById('kube-file-inp').value = '';
  document.getElementById('kube-text-inp').value = '';
  document.getElementById('kube-modal').classList.add('open');
}
function kubeOpenEdit(id) {
  // Check draft adds first (id === _draftId), then draft edits merged with original, then kubeContexts
  const addEntry = kubeDraft.adds.find(a => a._draftId === id);
  if (addEntry) {
    kubeEditId = id;
    kubeParsed = [{ ...addEntry, _selected: true }];
    kubeOrigParsed = JSON.parse(JSON.stringify(kubeParsed));
    document.getElementById('kube-step-input').classList.add('hidden');
    document.getElementById('kube-step-parsed').classList.remove('hidden');
    document.getElementById('kube-modal-title').textContent = 'Context 편집 (신규)';
    document.getElementById('kube-add-btn').textContent = '저장';
    const backBtn = document.getElementById('kube-back-btn');
    backBtn.textContent = '저장안함';
    backBtn.onclick = () => _kubeForceClose();
    kubeRenderParsed();
    document.getElementById('kube-modal').classList.add('open');
    return;
  }
  let c = kubeContexts.find(x => x.id === id);
  if (!c) return;
  if (kubeDraft.edits.has(id)) c = { ...c, ...kubeDraft.edits.get(id), id };
  kubeEditId = id;
  kubeParsed = [{ ...c, _selected: true }];
  kubeOrigParsed = JSON.parse(JSON.stringify(kubeParsed));
  document.getElementById('kube-step-input').classList.add('hidden');
  document.getElementById('kube-step-parsed').classList.remove('hidden');
  document.getElementById('kube-modal-title').textContent = !c.project ? 'Context 등록' : 'Context 편집';
  document.getElementById('kube-add-btn').textContent = '저장';
  const backBtn = document.getElementById('kube-back-btn');
  backBtn.textContent = '저장안함';
  backBtn.onclick = () => _kubeForceClose();
  kubeRenderParsed();
  document.getElementById('kube-modal').classList.add('open');
}
function kubeRegisterSysCtx(c) {
  // Open modal pre-filled with a system context so user only fills project/env/description
  kubeEditId = ''; kubeOrigParsed = null;
  kubeParsed = [{
    context_name: c.context_name || '',
    cluster_name: c.cluster_name || '',
    server:       c.server || '',
    user_name:    c.user_name || '',
    namespace:    c.namespace || '',
    project:      '',
    env:          '',
    description:  '',
    _selected:    true,
    _fromSys:     true,
  }];
  kubeOrigParsed = JSON.parse(JSON.stringify(kubeParsed));
  document.getElementById('kube-step-input').classList.add('hidden');
  document.getElementById('kube-step-parsed').classList.remove('hidden');
  document.getElementById('kube-modal-title').textContent = 'Context 등록';
  document.getElementById('kube-add-btn').textContent = '저장';
  const backBtn = document.getElementById('kube-back-btn');
  backBtn.textContent = '취소';
  backBtn.onclick = () => _kubeForceClose();
  kubeRenderParsed();
  document.getElementById('kube-modal').classList.add('open');
}

function kubeCloseModal() {
  if (kubeOrigParsed && _kubeHasChanges()) {
    showUnsaved(() => _kubeForceClose(), () => kubeAddParsed());
    return;
  }
  _kubeForceClose();
}
function _kubeForceClose() {
  kubeEditId = ''; kubeOrigParsed = null;
  document.getElementById('kube-add-btn').textContent = '저장';
  const backBtn = document.getElementById('kube-back-btn');
  backBtn.textContent = '← 뒤로';
  backBtn.onclick = kubeBackToInput;
  document.getElementById('kube-modal').classList.remove('open');
}
function _kubeHasChanges() {
  if (!kubeOrigParsed || !kubeParsed.length) return false;
  const strip = c => { const {_selected, ...r} = c; return r; };
  return JSON.stringify(kubeParsed.map(strip)) !== JSON.stringify(kubeOrigParsed.map(strip));
}

function kubeSetInputMode(m) {
  kubeInputMode = m;
  document.getElementById('kube-file-zone').classList.toggle('hidden', m !== 'file');
  document.getElementById('kube-text-zone').classList.toggle('hidden', m !== 'text');
  document.getElementById('ktab-file').classList.toggle('active', m === 'file');
  document.getElementById('ktab-text').classList.toggle('active', m === 'text');
}

async function kubeParse() {
  const btn = document.getElementById('kube-parse-btn');
  btn.disabled = true; btn.textContent = '파싱 중...';
  const fd = new FormData();
  if (kubeInputMode === 'file') {
    const f = document.getElementById('kube-file-inp').files[0];
    if (!f) { toast('파일을 선택하세요', false); btn.disabled = false; btn.textContent = '파싱하기'; return; }
    fd.append('file', f);
  } else {
    const t = document.getElementById('kube-text-inp').value.trim();
    if (!t) { toast('내용을 입력하세요', false); btn.disabled = false; btn.textContent = '파싱하기'; return; }
    fd.append('text', t);
  }
  let ok = false;
  let errorMsg = '';
  let responseData = null;

  try {
    const r = await fetch('/api/kube/parse', { method: 'POST', body: fd });
    responseData = await r.json();
    ok = r.ok;
    if (!ok) {
      errorMsg = responseData.error || '파싱 실패';
    }
  } catch (err) {
    alert("네트워크 오류로 파싱에 실패했습니다.");
    toast('네트워크 오류', false);
    btn.disabled = false; btn.textContent = '파싱하기';
    return;
  }

  btn.disabled = false; btn.textContent = '파싱하기';

  if (!ok) {
    alert("YAML 파싱 실패:\n" + errorMsg);
    toast(errorMsg, false);
    return;
  }

  kubeParsed = responseData.contexts.map(c => ({ ...c, _selected: true }));
  kubeShowParsed();
}

function kubeShowParsed() {
  kubeOrigParsed = JSON.parse(JSON.stringify(kubeParsed));
  document.getElementById('kube-step-input').classList.add('hidden');
  document.getElementById('kube-step-parsed').classList.remove('hidden');
  document.getElementById('kube-modal-title').textContent = `Context 편집 (${kubeParsed.length}개 발견)`;
  kubeRenderParsed();
}

function kubeBackToInput() {
  document.getElementById('kube-step-parsed').classList.add('hidden');
  document.getElementById('kube-step-input').classList.remove('hidden');
  document.getElementById('kube-modal-title').textContent = 'Kubernetes Context 추가';
}

function kubeRenderParsed() {
  document.getElementById('kube-parsed-list').innerHTML = kubeParsed.map((c, i) => `
    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Context ${i + 1}</span>
      </div>
      <div class="p-4 space-y-3" id="kube-card-${i}">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="lbl">Project <span class="font-normal text-slate-400">(대분류)</span></label>
            <input value="${esc(c.project||'')}" oninput="kubeField(${i},'project',this.value)"
              class="inp text-sm" placeholder="hyundai-capital">
          </div>
          <div>
            <label class="lbl">Env <span class="font-normal text-slate-400">(소분류)</span></label>
            <div class="grid grid-cols-4 gap-1">
              ${['dev','test','stg','prd'].map(e => `<button type="button" onclick="kubeEnv(${i},'${e}')" id="kube-ep-${i}-${e}"
                class="env-pill text-[11px] py-1 ${(c.env||'')=== e ? 'sel-'+e : ''}">${e}</button>`).join('')}
            </div>
          </div>
        </div>
        <div>
          <label class="lbl">설명</label>
          <input value="${esc(c.description||'')}" oninput="kubeField(${i},'description',this.value)"
            class="inp text-sm" placeholder="개발 클러스터">
        </div>
        <div>
          <label class="lbl">Context 이름</label>
          <input value="${esc(c.context_name)}" oninput="kubeField(${i},'context_name',this.value)"
            class="inp text-sm font-mono" placeholder="my-context">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="lbl">Cluster 이름</label>
            <input value="${esc(c.cluster_name)}" oninput="kubeField(${i},'cluster_name',this.value)"
              class="inp text-sm" placeholder="my-cluster">
          </div>
          <div>
            <label class="lbl">User 이름</label>
            <input value="${esc(c.user_name)}" oninput="kubeField(${i},'user_name',this.value)"
              class="inp text-sm" placeholder="admin">
          </div>
        </div>
        <div>
          <label class="lbl">Server URL <span class="font-normal text-slate-400">(IP / hostname)</span></label>
          <input value="${esc(c.server)}" oninput="kubeField(${i},'server',this.value)"
            class="inp text-sm font-mono" placeholder="https://192.168.1.100:6443">
        </div>
        <div>
          <label class="lbl">Namespace <span class="font-normal text-slate-400">(선택)</span></label>
          <input value="${esc(c.namespace || '')}" oninput="kubeField(${i},'namespace',this.value)"
            class="inp text-sm" placeholder="default">
        </div>
      </div>
    </div>`).join('');
}

function kubeField(i, field, val) { kubeParsed[i][field] = val; }

function kubeEnv(i, env) {
  kubeParsed[i].env = kubeParsed[i].env === env ? '' : env;
  const selected = kubeParsed[i].env;
  ['dev','test','stg','prd'].forEach(e => {
    const btn = document.getElementById(`kube-ep-${i}-${e}`);
    if (btn) btn.className = `env-pill text-[11px] py-1${selected === e ? ' sel-'+e : ''}`;
  });
}

function kubeAddParsed() {
  const selected = kubeParsed.filter(c => c._selected);

  if (kubeEditId) {
    const addIdx = kubeDraft.adds.findIndex(a => a._draftId === kubeEditId);
    if (addIdx >= 0) {
      const c = selected[0];
      kubeDraft.adds[addIdx] = { ...c, _draftId: kubeEditId };
      delete kubeDraft.adds[addIdx]._selected;
    } else {
      const c = selected[0];
      const entry = { ...c }; delete entry._selected;
      // Check if anything actually changed vs original
      const orig = kubeContexts.find(x => x.id === kubeEditId);
      const kubeFields = ['context_name','cluster_name','server','user_name','namespace','project','env','description'];
      const noChange = orig && kubeFields.every(f => (entry[f]||'') === (orig[f]||''));
      if (noChange) {
        kubeDraft.edits.delete(kubeEditId);
        kubeOrigParsed = null; _kubeForceClose(); _updateSaveBtn('kube'); kubeRender();
        return;
      }
      kubeDraft.edits.set(kubeEditId, entry);
    }
    toast('수정 예정 — 저장 버튼으로 확정하세요');
  } else {
    for (const c of selected) {
      const draftId = 'kadd_' + Date.now() + '_' + kubeDraft.adds.length;
      const entry = { ...c, _draftId: draftId }; delete entry._selected;
      kubeDraft.adds.push(entry);
    }
    toast(`${selected.length}개 추가 예정 — 저장 버튼으로 확정하세요`);
  }

  kubeOrigParsed = null; _kubeForceClose();
  _updateSaveBtn('kube'); kubeRender();
}

function kubeDel(id) {
  const addIdx = kubeDraft.adds.findIndex(a => a._draftId === id);
  if (addIdx >= 0) {
    kubeDraft.adds.splice(addIdx, 1);
    _updateSaveBtn('kube'); kubeRender(); return;
  }
  kubeDraft.edits.delete(id);
  kubeDraft.deletes.add(id);
  _updateSaveBtn('kube'); kubeRender();
}
function kubeUndoDel(id) {
  kubeDraft.deletes.delete(id);
  _updateSaveBtn('kube'); kubeRender();
}
function kubeCancelDrafts() {
  if (!confirm('저장하지 않은 모든 Kubernetes 변경사항을 취소하시겠습니까?')) return;
  kubeDraft.deletes.clear();
  kubeDraft.edits.clear();
  kubeDraft.adds.length = 0;
  _updateSaveBtn('kube');
  kubeRender();
}
async function kubeApply() {
  const total = kubeDraftCount();
  const btn = document.getElementById('kube-apply-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg class="w-4 h-4 spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
  const errs = [];

  // Process staged deletes
  for (const id of kubeDraft.deletes) {
    try {
      const r = await fetch(`/api/kube/contexts/${id}`, { method: 'DELETE' });
      if (!r.ok) errs.push('삭제 실패');
    } catch { errs.push('네트워크 오류'); }
  }
  // Process staged edits
  for (const [id, entry] of kubeDraft.edits) {
    const payload = { ...entry }; delete payload._draftState; delete payload._selected;
    if (payload._cluster) payload._cluster = { ...payload._cluster, server: entry.server };
    try {
      const r = await fetch(`/api/kube/contexts/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!r.ok) { const d = await r.json(); errs.push(d.error || '수정 실패'); }
    } catch { errs.push('네트워크 오류'); }
  }
  // Process staged adds
  for (const entry of kubeDraft.adds) {
    const payload = { ...entry }; delete payload._draftId; delete payload._draftState; delete payload._selected;
    if (payload._cluster) payload._cluster = { ...payload._cluster, server: entry.server };
    try {
      const r = await fetch('/api/kube/contexts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!r.ok) { const d = await r.json(); errs.push(d.error || '추가 실패'); }
    } catch { errs.push('네트워크 오류'); }
  }
  // Write kube config files
  try {
    const r = await fetch('/api/kube/apply', { method: 'POST' });
    const d = await r.json();
    if (!d.ok) errs.push('파일 저장 실패');
    else if (!errs.length) toast(total > 0 ? `${total}개 변경사항 저장됨` : d.output);
  } catch { errs.push('파일 저장 실패'); }

  kubeDraft.deletes.clear(); kubeDraft.edits.clear(); kubeDraft.adds.length = 0;
  errs.forEach(e => toast(e, false));
  btn.disabled = false; _updateSaveBtn('kube');
  await kubeLoad();
}

let _unsavedCb = null;
function showUnsaved(onDiscard, onSave) {
  _unsavedCb = { onDiscard, onSave };
  document.getElementById('unsaved-modal').classList.add('open');
}
function unsavedDiscard() {
  document.getElementById('unsaved-modal').classList.remove('open');
  _unsavedCb?.onDiscard?.();
  _unsavedCb = null;
}
function unsavedSave() {
  document.getElementById('unsaved-modal').classList.remove('open');
  _unsavedCb?.onSave?.();
  _unsavedCb = null;
}
