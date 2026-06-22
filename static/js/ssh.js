function _sshDisplayList() {
  const list = [];
  for (const s of servers) {
    if (sshDraft.edits.has(s.alias)) {
      list.push({ ...s, ...sshDraft.edits.get(s.alias), alias: s.alias, _draftState: 'edit' });
    } else if (sshDraft.deletes.has(s.alias)) {
      list.push({ ...s, _draftState: 'delete' });
    } else {
      list.push({ ...s, _draftState: null });
    }
  }
  for (const add of sshDraft.adds) {
    list.push({ ...add, key_path: `~/.workit/data/ssh/keys/${add.env}/${add.alias}.pem`, _draftState: 'add' });
  }
  return list;
}

function sshRender() {
  const el = document.getElementById('ssh-list');
  const list = _sshDisplayList();
  let html = '';

  if (!list.length && !unmanagedHosts.length && !sshIncludes.length) {
    el.innerHTML = `<div class="flex flex-col items-center justify-center py-24 text-slate-400">
      <svg class="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M12 5l7 7-7 7"/></svg>
      <p class="text-sm font-medium">서버가 없습니다</p>
      <p class="text-xs mt-1">서버 추가 버튼을 눌러 시작하세요</p>
    </div>`;
    return;
  }

  // ── ~/.ssh/config 시스템 Config — 직접 Host 블록 + Include 경로 표시 ──
  if (unmanagedHosts.length || sshIncludes.length) {
    const chevron = unmgdCollapsed
      ? `<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`
      : `<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;

    // Build include paths block
    let includesHtml = '';
    if (sshIncludes.length) {
      const rows = sshIncludes.map(inc => {
        const fileList = inc.files.length
          ? inc.files.map(f => {
              const isWorkit = f.includes('.workit/data/ssh/');
              const badge = isWorkit
                ? `<span class="inline-flex items-center ml-2 px-1.5 py-px rounded text-[9.5px] font-semibold bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 leading-none">Workit 관리</span>`
                : '';
              return `<span class="flex items-center gap-0 pl-3 before:content-['↳'] before:mr-1.5 before:text-slate-300 dark:before:text-slate-700"><span class="font-mono text-[11px] text-slate-500 dark:text-slate-400">${esc(f)}</span>${badge}</span>`;
            }).join('')
          : `<span class="text-[11px] text-slate-400 pl-3 italic">파일 없음</span>`;
        return `<div class="py-1.5">
          <span class="font-mono text-[11.5px] text-sky-600 dark:text-sky-400">${esc(inc.pattern)}</span>
          ${fileList}
        </div>`;
      }).join('');
      includesHtml = `<div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50">
        <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Include 파일</p>
        ${rows}
      </div>`;
    }

    const bodyHtml = unmanagedHosts.length
      ? `<table class="w-full text-sm table-fixed">
          <thead><tr class="border-b border-slate-100 dark:border-slate-800">
            <th class="px-4 py-2.5 text-left th w-[8%]">Env</th>
            <th class="px-4 py-2.5 text-left th w-[20%]">Host</th>
            <th class="px-4 py-2.5 text-left th w-[15%]">파일</th>
            <th class="px-4 py-2.5 text-left th w-[17%]">IP / 주소</th>
            <th class="px-4 py-2.5 text-left th w-[12%]">계정</th>
            <th class="px-4 py-2.5 text-left th w-[8%]">Port</th>
            <th class="px-4 py-2.5 text-left th w-[12%]">키 파일</th>
            <th class="px-4 py-2.5 th w-[8%] text-right"></th>
          </tr></thead>
          <tbody class="divide-y divide-slate-50">${unmanagedHosts.map(sshUnmgdRow).join('')}</tbody>
        </table>`
      : `<div class="px-5 py-4 text-[12px] text-slate-400 italic">~/.ssh/config에 직접 등록된 Host 없음 (Include 파일로 관리 중)</div>`;

    html += `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4 shadow-sm">
      <div class="px-5 py-2.5 flex items-center gap-2.5 cursor-pointer select-none" style="background:#334155" onclick="toggleUnmgd()">
        <svg class="w-3.5 h-3.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <span class="text-white font-bold text-xs uppercase tracking-widest">시스템 Config</span>
        ${unmanagedHosts.length ? `<span class="bg-white/20 text-white text-[11px] px-1.5 py-0.5 rounded-full font-semibold">${unmanagedHosts.length}</span>` : ''}
        <span class="text-slate-400 text-[11px] ml-1">~/.ssh/config</span>
        <span class="ml-auto">${chevron}</span>
      </div>
      ${unmgdCollapsed ? '' : includesHtml + bodyHtml}
    </div>`;
  }

  // ── Workit-managed servers grouped by project — 알파벳순 ───
  if (list.length) {
    const byProject = {};
    for (const s of list) {
      const proj = s.project || '(미분류)';
      (byProject[proj] = byProject[proj] || []).push(s);
    }
    const sortedProjects = Object.keys(byProject).sort((a, b) => {
      if (a === '(미분류)') return -1;
      if (b === '(미분류)') return 1;
      return a.localeCompare(b);
    });
    html += sortedProjects.map(proj => { const grp = byProject[proj]; return `
      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4 shadow-sm">
        <div class="px-5 py-3 proj-hdr flex items-center gap-2.5">
          <div class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-white/10 text-white/90 flex-shrink-0">${(proj[0]||'?').toUpperCase()}</div>
          <span class="text-white/90 font-semibold text-[12.5px] tracking-wide">${esc(proj)}</span>
          <span class="bg-white/15 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">${grp.length}</span>
        </div>
        <table class="w-full text-sm table-fixed">
          <thead><tr class="border-b border-slate-100 dark:border-slate-800">
            <th class="px-4 py-2.5 text-left th w-[8%]">Env</th>
            <th class="px-4 py-2.5 text-left th w-[20%]">Host</th>
            <th class="px-4 py-2.5 text-left th w-[15%]">메모</th>
            <th class="px-4 py-2.5 text-left th w-[17%]">IP / 주소</th>
            <th class="px-4 py-2.5 text-left th w-[12%]">계정</th>
            <th class="px-4 py-2.5 text-left th w-[8%]">Port</th>
            <th class="px-4 py-2.5 text-center th w-[12%]">키</th>
            <th class="px-4 py-2.5 th w-[8%] text-right"></th>
          </tr></thead>
          <tbody class="divide-y divide-slate-50">${grp.map(sshRow).join('')}</tbody>
        </table>
      </div>`; }).join('');
  }

  el.innerHTML = html;
}

function toggleUnmgd() { unmgdCollapsed = !unmgdCollapsed; sshRender(); }
function toggleKubeUnreg() { kubeUnregCollapsed = !kubeUnregCollapsed; kubeRender(); }

function sshUnmgdRow(h) {
  const isDraftAdd = sshDraft.adds.some(a => a.alias === h.alias || a.import_orig_alias === h.alias);

  const keyCell = h.key_path
    ? `<span class="font-mono text-[11.5px] text-slate-400 truncate block w-full" title="${esc(h.key_path)}">${esc(h.key_path.split('/').pop())}</span>`
    : `<span class="text-slate-300 text-xs">—</span>`;

  const deleteBtn = `<button onclick="sshUnmgdDelete('${eA(h.alias)}','${eA(h.source_file||'~/.ssh/config')}')" title="${esc(h.source_file||'~/.ssh/config')}에서 삭제" class="text-slate-300 hover:text-rose-500 transition-colors">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
  </button>`;
  const srcLabel = `<span class="font-mono text-[10px] text-slate-400 block truncate w-full" title="${esc(h.source_file||'')}">${esc((h.source_file||'').split('/').pop())}</span>`;
  let actionCell;
  if (isDraftAdd) {
    actionCell = `<div class="flex items-center justify-end px-1"><span class="text-[11px] font-bold text-amber-500 whitespace-nowrap">이전 대기 중</span></div>`;
  } else if (h.is_workit) {
    actionCell = `<div class="flex items-center justify-end gap-2">
      <button onclick="openEditDrawer('${eA(h.alias)}')"
         class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-sky-600 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors border border-sky-200 dark:border-sky-800 whitespace-nowrap">
         편집
      </button>
      ${deleteBtn}
    </div>`;
  } else {
    actionCell = `<div class="flex items-center justify-end gap-2">
      <button onclick='openImportDrawer(${JSON.stringify(h).replace(/'/g,"&#39;")})'
         class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-colors border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
         등록
      </button>
      ${deleteBtn}
    </div>`;
  }

  const badge = isDraftAdd
    ? `<span class="ml-1.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap staged-badge">저장 시 시스템 설정에서 삭제됨</span>`
    : '';
  const rowCls = isDraftAdd ? 'opacity-60 bg-amber-50/10 dark:bg-amber-950/10' : '';

  return `<tr class="${rowCls}">
    <td class="px-4 py-3"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase leading-none">Sys</span></td>
    <td class="px-4 py-3"><div class="flex items-center gap-1.5 truncate w-full">${_cp(h.alias,'font-mono font-semibold text-slate-900 dark:text-slate-100 text-[12.5px]')}${badge}</div></td>
    <td class="px-4 py-3">${srcLabel}</td>
    <td class="px-4 py-3">${_cp(h.hostname,'text-slate-600 dark:text-slate-400 text-[13px]')}</td>
    <td class="px-4 py-3 text-slate-500 dark:text-slate-400 text-[13px]">${esc(h.user || '—')}</td>
    <td class="px-4 py-3 text-slate-500 dark:text-slate-400 text-[13px]">${esc(h.port || '22')}</td>
    <td class="px-4 py-3">${keyCell}</td>
    <td class="px-4 py-3">${actionCell}</td>
  </tr>`;
}

async function sshUnmgdDelete(alias, sourceFile) {
  const src = sourceFile || '~/.ssh/config';
  if (!confirm(`"${alias}" 항목을 ${src}에서 삭제하시겠습니까?\n(백업 파일이 자동 생성됩니다)`)) return;
  const res = await fetch(`/api/ssh/unmanaged/${encodeURIComponent(alias)}`, {
    method: 'DELETE',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({source_file: src}),
  });
  if (res.ok) { toast(`"${alias}" 삭제됨`); await sshLoad(); }
  else { const d = await res.json(); toast(`삭제 실패: ${d.error || '오류'}`); }
}

function sshRow(s) {
  const isDelete = s._draftState === 'delete';
  const isAdd    = s._draftState === 'add';
  const isEdit   = s._draftState === 'edit';
  const badge = isDelete
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">삭제 예정</span>`
    : isAdd
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">신규</span>`
    : isEdit
    ? `<span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">수정됨</span>`
    : '';
  const rowCls = isDelete ? 'opacity-50 line-through' : '';
  const keyIco = s.key_exists
    ? `<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="${esc(s.key_path)}"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`
    : `<svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="${esc(s.key_path)}"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  const actions = isDelete
    ? `<button onclick="sshUndoDel('${eA(s.alias)}')" title="되돌리기" class="text-rose-400 hover:text-rose-600 text-xs font-semibold transition-colors">취소</button>`
    : isAdd
    ? `<button onclick="sshDel('${eA(s.alias)}')" title="추가 취소" class="text-slate-300 hover:text-rose-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
       </button>`
    : `<button onclick="openEditDrawer('${eA(s.alias)}')" title="편집" class="text-slate-300 hover:text-sky-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
       </button>
       <button onclick="kmOpen('${eA(s.alias)}','${eA(s.key_path || '')}')" title="키 설정" class="text-slate-300 hover:text-indigo-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
       </button>
       <button onclick="sshDel('${eA(s.alias)}')" title="삭제" class="text-slate-300 hover:text-rose-500 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
       </button>`;
  return `<tr class="${rowCls}">
    <td class="px-4 py-3">${envBadge(s.env)}</td>
    <td class="px-4 py-3"><div class="flex items-center gap-1.5 truncate w-full">${_cp(s.alias,'font-mono font-semibold text-slate-900 dark:text-slate-100 text-[12.5px]')}${badge}</div></td>
    <td class="px-4 py-3 text-slate-400 text-xs truncate" title="${esc(s.description)}">${esc(s.description) || '<span class="text-slate-300">—</span>'}</td>
    <td class="px-4 py-3">${_cp(s.hostname,'text-slate-600 dark:text-slate-400 text-[13px]')}</td>
    <td class="px-4 py-3">${_cp(s.user,'text-slate-500 dark:text-slate-400 text-[13px]')}</td>
    <td class="px-4 py-3 text-slate-500 dark:text-slate-400 text-[13px]">${esc(s.port || '22')}</td>
    <td class="px-4 py-3"><div class="flex justify-center">${isAdd ? '' : keyIco}</div></td>
    <td class="px-4 py-3"><div class="flex justify-end items-center gap-2.5">${actions}</div></td>
  </tr>`;
}

let drawerDirty = false;
function _drawerReset() {
  editAlias = ''; drawerDirty = false; lastAutoHint = '';
  document.getElementById('drawer-title').textContent = '서버 추가';
  document.getElementById('submit-btn').textContent = '추가';
  const cancelBtn = document.getElementById('drawer-cancel-btn');
  cancelBtn.textContent = '취소';
  cancelBtn.onclick = () => closeDrawer();
  document.getElementById('f-import-key-path').value = '';
  document.getElementById('import-key-path-txt').textContent = '';
  document.getElementById('import-key-notice-wrap').classList.add('hidden');
  document.getElementById('f-import-source-file').value = '';
  document.getElementById('f-import-orig-alias').value = '';
}
function openImportDrawer(h) {
  _drawerReset();
  document.getElementById('drawer-title').textContent = '미분류 서버 등록';
  document.getElementById('submit-btn').textContent = '등록';
  const cancelBtn = document.getElementById('drawer-cancel-btn');
  cancelBtn.textContent = '저장안함';
  cancelBtn.onclick = () => _drawerForceClose();
  document.getElementById('f-host').value = h.alias || '';
  document.querySelector('input[name="hostname"]').value = h.hostname || '';
  document.querySelector('input[name="user"]').value    = h.user     || '';
  document.querySelector('input[name="port"]').value    = h.port     || '22';
  document.getElementById('f-import-source-file').value = h.source_file || '';
  document.getElementById('f-import-orig-alias').value = h.alias || '';
  if (h.key_path) {
    document.getElementById('f-import-key-path').value    = h.key_path;
    document.getElementById('import-key-path-txt').textContent = h.key_path;
    document.getElementById('import-key-notice-wrap').classList.remove('hidden');
  }
  updatePreview();
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function openDrawer() {
  _drawerReset();
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  if (!document.getElementById('f-project').value && servers.length) {
    const freq = {};
    servers.forEach(s => freq[s.project] = (freq[s.project]||0)+1);
    document.getElementById('f-project').value = Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
    _autoHintHost();
    updatePreview();
  }
}
function openEditDrawer(alias) {
  const s = sshDraft.edits.get(alias) || servers.find(x => x.alias === alias);
  if (!s) return;
  editAlias = alias; drawerDirty = false; lastAutoHint = '';
  document.getElementById('drawer-title').textContent = '서버 편집';
  document.getElementById('submit-btn').textContent = '저장';
  const cancelBtn = document.getElementById('drawer-cancel-btn');
  cancelBtn.textContent = '저장안함';
  cancelBtn.onclick = () => _drawerForceClose();
  document.getElementById('f-project').value = s.project || '';
  document.getElementById('f-host').value = s.alias || '';
  document.querySelector('input[name="hostname"]').value = s.hostname || '';
  document.querySelector('input[name="user"]').value = s.user || '';
  document.querySelector('input[name="port"]').value = s.port || 22;
  document.getElementById('f-proxy').value = s.proxy_jump || '';
  document.getElementById('f-desc').value = s.description || '';
  fwdOn = !!s.forward_agent;
  document.getElementById('fwd-toggle').classList.toggle('on', fwdOn);
  document.getElementById('fwd-val').value = fwdOn ? 'true' : 'false';
  selEnv(s.env);
  updatePreview();
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function closeDrawer() {
  if (drawerDirty) {
    showUnsaved(() => _drawerForceClose(), () => document.getElementById('add-form').requestSubmit());
    return;
  }
  _drawerForceClose();
}
function _drawerForceClose() {
  drawerDirty = false; _drawerReset();
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}
function selEnv(e) {
  selectedEnv = e;
  document.querySelectorAll('.env-pill').forEach(el => { el.className='env-pill'; if(el.dataset.env===e) el.classList.add(`sel-${e}`); });
  document.querySelector(`input[value="${e}"]`).checked = true;
  _autoHintHost();
  updatePreview();
}
function _enforceHostChars(el) {
  const pos = el.selectionStart;
  const clean = el.value.replace(/[^a-zA-Z0-9\-_.]/g, '');
  if (clean !== el.value) { el.value = clean; el.setSelectionRange(pos - 1, pos - 1); }
}
function _autoHintHost() {
  const p = document.getElementById('f-project').value.trim();
  const e = selectedEnv;
  const hint = (p && e) ? `${p}-${e}-` : (p ? `${p}-` : '');
  const hostEl = document.getElementById('f-host');
  if (!hostEl.value || hostEl.value === lastAutoHint) {
    hostEl.value = hint;
    lastAutoHint = hint;
  }
}
function updatePreview() {
  const h = document.getElementById('f-host').value.trim();
  const e = selectedEnv;
  if (h) {
    document.getElementById('alias-preview').textContent = `Host: ${h}`;
    document.getElementById('key-preview').textContent = `IdentityFile: ~/.workit/data/ssh/keys/${e || '{env}'}/${h}.pem`;
  } else {
    document.getElementById('alias-preview').textContent = '—';
    document.getElementById('key-preview').textContent = 'IdentityFile: —';
  }
  const env = e || '{env}', hh = h || '{host}';
  const kg = document.getElementById('keygen-hint');
  if (kg) kg.textContent = `ssh-keygen -t rsa -b 4096 -f ~/.workit/data/ssh/keys/${env}/${hh}.pem -C "${hh}"`;
  const kc = document.getElementById('keygen-chmod');
  if (kc) kc.textContent = `chmod 600 ~/.workit/data/ssh/keys/${env}/${hh}.pem`;
  const ki = document.getElementById('keygen-copyid');
  if (ki) ki.textContent = `ssh-copy-id -i ~/.workit/data/ssh/keys/${env}/${hh}.pem.pub ${h ? (document.querySelector('input[name="user"]')?.value.trim() || 'user') + '@' + (document.querySelector('input[name="hostname"]')?.value.trim() || '{hostname}') : 'user@{hostname}'}`;

}
function populateProxy() { const s=document.getElementById('f-proxy');while(s.options.length>1)s.remove(1);aliases.forEach(a=>{const o=document.createElement('option');o.value=a;o.textContent=a;s.appendChild(o);}); }
function toggleFwd() {
  fwdOn=!fwdOn;
  document.getElementById('fwd-toggle').classList.toggle('on',fwdOn);
  document.getElementById('fwd-val').value=fwdOn?'true':'false';
}
function setKeyMode(m) {
  keyMode=m;
  document.getElementById('key-file-zone').classList.toggle('hidden',m!=='file');
  document.getElementById('key-text-zone').classList.toggle('hidden',m!=='text');
  document.getElementById('tab-file').classList.toggle('active',m==='file');
  document.getElementById('tab-text').classList.toggle('active',m==='text');
}
function submitForm(e) {
  e.preventDefault();
  if (!selectedEnv) { toast('타입을 선택하세요', false); return; }
  const isEdit = !!editAlias;
  const proj  = document.getElementById('f-project').value.trim();
  const host  = document.getElementById('f-host').value.trim();
  const alias = host || (editAlias || '');
  const keyFile      = keyMode === 'file' ? (document.getElementById('f-keyfile').files?.[0] || null) : null;
  const keyText      = keyMode === 'text' ? (document.querySelector('textarea[name="key_text"]')?.value?.trim() || '') : '';
  const keyLocalPath = document.getElementById('f-import-key-path').value.trim();
  const importSourceFile = document.getElementById('f-import-source-file').value.trim();
  const importOrigAlias = document.getElementById('f-import-orig-alias').value.trim();
  const entry = {
    alias,
    project:        proj,
    env:            selectedEnv,
    host:           host,
    hostname:       document.querySelector('input[name="hostname"]').value.trim(),
    user:           document.querySelector('input[name="user"]').value.trim(),
    port:           parseInt(document.querySelector('input[name="port"]').value) || 22,
    proxy_jump:     document.getElementById('f-proxy').value,
    description:    document.getElementById('f-desc').value.trim(),
    forward_agent:  fwdOn,
    key_mode:       keyMode,
    key_file:       keyFile,
    key_text:       keyText,
    key_local_path: keyLocalPath,
    key_exists:     isEdit ? (servers.find(x => x.alias === editAlias)?.key_exists || false) : false,
    key_path:       `~/.workit/data/ssh/keys/${selectedEnv}/${alias}.pem`,
    import_source_file: importSourceFile,
    import_orig_alias:  importOrigAlias,
  };
  if (isEdit) {
    const orig = servers.find(x => x.alias === editAlias);
    const hasKeyChange = !!(keyFile || keyText || keyLocalPath);
    const noChange = orig &&
      alias          === (orig.alias       || '') &&
      proj           === (orig.project     || '') &&
      selectedEnv    === (orig.env         || '') &&
      entry.hostname === (orig.hostname    || '') &&
      entry.user     === (orig.user        || '') &&
      entry.port     === (orig.port        || 22) &&
      entry.proxy_jump    === (orig.proxy_jump    || '') &&
      entry.description   === (orig.description   || '') &&
      entry.forward_agent === !!(orig.forward_agent) &&
      !hasKeyChange;
    if (noChange) {
      sshDraft.edits.delete(editAlias);
      _drawerForceClose(); _updateSaveBtn('ssh'); sshRender();
      return;
    }
    sshDraft.edits.set(editAlias, entry);
  } else {
    const existingIdx = sshDraft.adds.findIndex(a => a.alias === alias);
    if (existingIdx >= 0) sshDraft.adds[existingIdx] = entry;
    else sshDraft.adds.push(entry);
  }
  toast(isEdit ? `${alias} 수정 예정 — 저장 버튼으로 확정하세요` : `${alias} 추가 예정 — 저장 버튼으로 확정하세요`);
  e.target.reset();
  dzReset('dz', 'dz-icon', 'dz-text'); setKeyMode('file');
  selectedEnv = ''; fwdOn = false;
  document.getElementById('fwd-toggle').classList.remove('on');
  document.getElementById('fwd-val').value = 'false';
  document.querySelectorAll('.env-pill').forEach(el => el.className = 'env-pill');
  updatePreview(); _drawerForceClose();
  _updateSaveBtn('ssh');
  sshRender();
}
function sshDel(alias) {
  const addIdx = sshDraft.adds.findIndex(a => a.alias === alias);
  if (addIdx >= 0) {
    sshDraft.adds.splice(addIdx, 1);
    _updateSaveBtn('ssh'); sshRender(); return;
  }
  sshDraft.edits.delete(alias);
  sshDraft.deletes.add(alias);
  _updateSaveBtn('ssh'); sshRender();
}
function sshUndoDel(alias) {
  sshDraft.deletes.delete(alias);
  _updateSaveBtn('ssh'); sshRender();
}
function sshCancelDrafts() {
  if (!confirm('저장하지 않은 모든 SSH 변경사항을 취소하시겠습니까?')) return;
  sshDraft.deletes.clear();
  sshDraft.edits.clear();
  sshDraft.adds.length = 0;
  _updateSaveBtn('ssh');
  sshRender();
}
async function sshApply() {
  const btn = document.getElementById('ssh-apply-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg class="w-4 h-4 spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
  const total = sshDraftCount();
  const errs = [];

  // Process staged deletes
  for (const alias of sshDraft.deletes) {
    try {
      const r = await fetch(`/api/ssh/servers/${alias}`, { method: 'DELETE' });
      if (!r.ok) errs.push(`삭제 실패: ${alias}`);
    } catch { errs.push(`오류: ${alias}`); }
  }
  // Process staged edits
  for (const [alias, entry] of sshDraft.edits) {
    const fd = new FormData();
    fd.append('project', entry.project); fd.append('env', entry.env); fd.append('host', entry.host || entry.alias);
    fd.append('hostname', entry.hostname); fd.append('user', entry.user); fd.append('port', entry.port);
    fd.append('proxy_jump', entry.proxy_jump); fd.append('description', entry.description);
    fd.append('forward_agent', entry.forward_agent ? 'true' : 'false');
    if (entry.key_mode === 'file' && entry.key_file) fd.append('key_file', entry.key_file);
    else if (entry.key_mode === 'text' && entry.key_text) fd.append('key_text', entry.key_text);
    else if (entry.key_local_path) fd.append('local_path', entry.key_local_path);
    try {
      const r = await fetch(`/api/ssh/servers/${alias}`, { method: 'PUT', body: fd });
      if (!r.ok) { const d = await r.json(); errs.push(d.error || `수정 실패: ${alias}`); }
    } catch { errs.push(`오류: ${alias}`); }
  }
  // Process staged adds
  for (const entry of sshDraft.adds) {
    const fd = new FormData();
    fd.append('project', entry.project); fd.append('env', entry.env); fd.append('host', entry.host || entry.alias);
    fd.append('hostname', entry.hostname); fd.append('user', entry.user); fd.append('port', entry.port);
    fd.append('proxy_jump', entry.proxy_jump); fd.append('description', entry.description);
    fd.append('forward_agent', entry.forward_agent ? 'true' : 'false');
    if (entry.key_mode === 'file' && entry.key_file) fd.append('key_file', entry.key_file);
    else if (entry.key_mode === 'text' && entry.key_text) fd.append('key_text', entry.key_text);
    else if (entry.key_local_path) fd.append('local_path', entry.key_local_path);
    if (entry.import_source_file) fd.append('import_source_file', entry.import_source_file);
    if (entry.import_orig_alias) fd.append('import_orig_alias', entry.import_orig_alias);
    try {
      const r = await fetch('/api/ssh/servers', { method: 'POST', body: fd });
      if (!r.ok) { const d = await r.json(); errs.push(d.error || '추가 실패'); }
    } catch { errs.push('추가 오류'); }
  }
  // Apply SSH config
  try {
    const r = await fetch('/api/ssh/apply', { method: 'POST' }), d = await r.json();
    if (d.ok) { if (!errs.length) toast(total > 0 ? `${total}개 변경사항 저장됨` : d.output); }
    else errs.push('SSH 설정 적용 실패');
  } catch { errs.push('SSH 설정 적용 실패'); }

  sshDraft.deletes.clear(); sshDraft.edits.clear(); sshDraft.adds.length = 0;
  errs.forEach(e => toast(e, false));
  btn.disabled = false; _updateSaveBtn('ssh');
  await sshLoad();
}

// Key modal
let kmAlias='', kmCurrentTab='file';
function kmOpen(alias, path) {
  kmAlias=alias;
  document.getElementById('km-alias').textContent=alias;
  document.getElementById('km-path').textContent=path;
  document.getElementById('km-text').value='';
  dzReset('km-dz','km-dz-icon','km-dz-text');
  document.getElementById('km-file-inp').value='';
  document.getElementById('km-path-inp').value='';
  document.getElementById('km-guide-body').classList.add('hidden');
  document.getElementById('km-chevron').style.transform='';
  kmScan();
  const s=servers.find(x=>x.alias===alias);
  if(s){
    const y=v=>`<span class="text-yellow-300">${v}</span>`;
    const keyPath = `~/.workit/data/ssh/keys/${y(s.env)}/${y(s.alias)}.pem`;
    document.getElementById('km-keygen').innerHTML=`ssh-keygen -t rsa -b 4096 -m PEM \\\n  -f ~/.workit/data/ssh/keys/${y(s.env)}/${y(s.alias)}.pem \\\n  -C "${y(s.alias)}"`;
    document.getElementById('km-chmod').innerHTML=`chmod 600 ~/.workit/data/ssh/keys/${y(s.env)}/${y(s.alias)}.pem`;
    document.getElementById('km-copyid').innerHTML=`ssh-copy-id \\\n  -i ~/.workit/data/ssh/keys/${y(s.env)}/${y(s.alias)}.pem.pub \\\n  ${y(s.user)}@${y(s.hostname)}`;
    document.getElementById('km-test').innerHTML=`ssh ${y(s.alias)}`;
  }
  kmTabSwitch('file');
  document.getElementById('key-modal').classList.add('open');
}
async function kmScan() {
  const list=document.getElementById('km-scan'); list.innerHTML='<p class="text-xs text-slate-400 text-center py-3">스캔 중...</p>';
  try {
    const s=servers.find(x=>x.alias===kmAlias);
    const d=await(await fetch(s?`/api/ssh/keys/scan?env=${s.env}`:'/api/ssh/keys/scan')).json();
    const files=d.files||[];
    if(!files.length){list.innerHTML='<p class="text-xs text-slate-400 text-center py-3">파일 없음</p>';return;}
    const byDir={};files.forEach(f=>(byDir[f.dir]=byDir[f.dir]||[]).push(f));
    list.innerHTML=Object.entries(byDir).map(([dir,items])=>`
      <div class="mb-1"><p class="text-[10px] text-slate-400 font-mono px-1.5 mb-0.5">📁 ${esc(dir)}/</p>
      ${items.map(f=>`<button type="button" onclick="document.getElementById('km-path-inp').value='${eA(f.path)}'"
        class="w-full flex justify-between px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 text-left transition-colors">
        <span class="font-mono text-xs text-slate-700 truncate">${esc(f.name)}</span>
        <span class="text-[10px] text-slate-400 ml-2">${f.size_kb}KB</span>
      </button>`).join('')}
      </div>`).join('');
  } catch { list.innerHTML='<p class="text-xs text-rose-400 text-center py-3">스캔 실패</p>'; }
}
function kmGuide() {
  const b=document.getElementById('km-guide-body'),c=document.getElementById('km-chevron'),hidden=b.classList.contains('hidden');
  b.classList.toggle('hidden'); c.style.transform=hidden?'rotate(180deg)':'';
}
function kmClose() { document.getElementById('key-modal').classList.remove('open'); }
function kmTabSwitch(t) {
  kmCurrentTab=t;
  ['file','text','path'].forEach(x=>{document.getElementById(`km-panel-${x}`).classList.toggle('hidden',x!==t);document.getElementById(`km-tab-${x}`).classList.toggle('active',x===t);});
}
async function kmSave() {
  const btn=document.getElementById('km-save'); btn.disabled=true; btn.textContent='저장 중...';
  const fd=new FormData();
  if(kmCurrentTab==='file'){const i=document.getElementById('km-file-inp');if(!i.files[0]){toast('파일을 선택하세요',false);btn.disabled=false;btn.textContent='저장';return;}fd.append('file',i.files[0]);}
  else if(kmCurrentTab==='text'){const t=document.getElementById('km-text').value.trim();if(!t){toast('키 내용을 입력하세요',false);btn.disabled=false;btn.textContent='저장';return;}fd.append('text',t);}
  else{const p=document.getElementById('km-path-inp').value.trim();if(!p){toast('경로를 입력하세요',false);btn.disabled=false;btn.textContent='저장';return;}fd.append('local_path',p);}
  try {
    const r=await fetch(`/api/ssh/servers/${kmAlias}/key`,{method:'POST',body:fd}),d=await r.json();
    if(r.ok){toast('키 저장 완료');document.getElementById('key-modal').classList.remove('open');await sshLoad();}
    else toast(d.error||'저장 실패',false);
  } catch { toast('네트워크 오류',false); }
  finally { btn.disabled=false; btn.textContent='저장'; }
}

// ═══════════════════════════════════════════════════════════
//  Accounts
// ═══════════════════════════════════════════════════════════