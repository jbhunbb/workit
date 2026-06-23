
// ── Theme ────────────────────────────────────────────────────
const _moonSvg = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;
const _sunSvg  = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;

function _applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('dark', dark);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = dark ? _sunSvg : _moonSvg;
}
async function toggleTheme() {
  const dark = !document.body.classList.contains('dark');
  _applyTheme(dark);
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({theme: dark ? 'dark' : 'light'}),
    });
  } catch(e) {}
}

// ── Nav ──────────────────────────────────────────────────────
let curTab = 'ssh';
const loaded = {};

function switchTab(name) {
  document.querySelectorAll('.tab-item').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === `section-${name}`));
  document.getElementById('actions-ssh').classList.toggle('hidden', name !== 'ssh');
  document.getElementById('actions-accounts').classList.toggle('hidden', name !== 'accounts');
  document.getElementById('actions-kube').classList.toggle('hidden', name !== 'kube');
  document.getElementById('actions-docs').classList.toggle('hidden', name !== 'docs');
  curTab = name;
  localStorage.setItem('workit_tab', name);
  if (!loaded[name]) { loaded[name] = true; if (name === 'ssh') sshLoad(); if (name === 'accounts') acctLoad(); if (name === 'kube') kubeLoad(); if (name === 'docs') docsLoad(); }
}

// ── Toast ────────────────────────────────────────────────────
let _tt;
function toast(msg, ok = true) {
  const i = document.getElementById('toast-inner');
  i.textContent = msg;
  i.className = `px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`;
  document.getElementById('toast').classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(() => document.getElementById('toast').classList.remove('show'), 2500);
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function eA(s)  { return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function togglePw(id) { const i = document.getElementById(id); i.type = i.type === 'password' ? 'text' : 'password'; }
function copyText(t, btn) {
  navigator.clipboard.writeText(t).then(() => {
    toast('복사됨');
    if (btn) { btn.classList.add('copy-done'); setTimeout(() => btn.classList.remove('copy-done'), 1800); }
  });
}
function copyCode(id, spanId) {
  navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => {
    const s = document.getElementById(spanId);
    const btn = s.closest('button');
    s.textContent = '✓';
    if (btn) btn.classList.add('copy-done');
    setTimeout(() => { s.textContent = 'copy'; if (btn) btn.classList.remove('copy-done'); }, 1800);
    toast('복사됨');
  });
}

// ── Drop zone helpers ────────────────────────────────────────
function dzOver(e, id) { e.preventDefault(); document.getElementById(id).classList.add('over'); }
function dzLeave(id)   { document.getElementById(id).classList.remove('over'); }
function dzDrop(e, dzId, inputId) {
  e.preventDefault(); document.getElementById(dzId).classList.remove('over');
  const f = e.dataTransfer.files[0]; if (!f) return;
  const dt = new DataTransfer(); dt.items.add(f); document.getElementById(inputId).files = dt.files;
  dzMark(dzId, dzId === 'km-dz' ? 'km-dz-icon' : 'dz-icon', dzId === 'km-dz' ? 'km-dz-text' : 'dz-text', f.name);
}
function dzSelect(inp, dzId, iconId, txtId) { if (inp.files[0]) dzMark(dzId, iconId, txtId, inp.files[0].name); }
function dzMark(dz, icon, txt, name) {
  document.getElementById(dz).classList.add('done');
  document.getElementById(icon).innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`;
  document.getElementById(icon).classList.replace('text-slate-400','text-emerald-500');
  const t = document.getElementById(txt); t.textContent = name; t.classList.add('font-medium','text-emerald-700');
}
function dzReset(dz, icon, txt) {
  document.getElementById(dz).classList.remove('done','over');
  document.getElementById(icon).innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>`;
  document.getElementById(icon).classList.replace('text-emerald-500','text-slate-400');
  const t = document.getElementById(txt); t.textContent = '클릭하거나 드래그하세요'; t.classList.remove('font-medium','text-emerald-700');
}

// ── env badge helper ─────────────────────────────────────────
function envBadge(env) {
  if (!env) return `<span class="text-[11px] text-slate-300">—</span>`;
  const cls = {dev:'badge-dev',test:'badge-test',stg:'badge-stg',prd:'badge-prd'}[env] || 'bg-slate-100 text-slate-500';
  return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}">${esc(env)}</span>`;
}

// ── copy-on-click helper ──────────────────────────────────────
const _cpSvg = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
function _cp(val, cls = '') {
  if (!val) return `<span class="text-slate-300 text-xs">—</span>`;
  return `<span class="inline-flex items-center gap-1 ${cls}"><span>${esc(val)}</span><button class="copy-btn" onclick="event.stopPropagation();copyText('${eA(val)}',this)" title="복사">${_cpSvg}</button></span>`;
}
function _cpAs(display, copyVal, cls = '') {
  if (!display) return `<span class="text-slate-300 text-xs">—</span>`;
  return `<span class="inline-flex items-center gap-1 ${cls}"><span>${esc(display)}</span><button class="copy-btn" onclick="event.stopPropagation();copyText('${eA(copyVal)}',this)" title="URL 복사">${_cpSvg}</button></span>`;
}

// ═══════════════════════════════════════════════════════════
//  SSH
// ═══════════════════════════════════════════════════════════
let servers = [], aliases = [], unmanagedHosts = [], sshIncludes = [], selectedEnv = '', fwdOn = false, keyMode = 'file', editAlias = '', lastAutoHint = '', unmgdCollapsed = false;

const sshDraft  = { deletes: new Set(), adds: [], edits: new Map() };
const kubeDraft = { deletes: new Set(), adds: [], edits: new Map() };
function sshDraftCount()  { return sshDraft.deletes.size + sshDraft.adds.length + sshDraft.edits.size; }
function kubeDraftCount() { return kubeDraft.deletes.size + kubeDraft.adds.length + kubeDraft.edits.size; }

function _updateSaveBtn(tab) {
  const count = tab === 'ssh' ? sshDraftCount() : kubeDraftCount();
  const btnId = tab === 'ssh' ? 'ssh-apply-btn' : 'kube-apply-btn';
  const cancelBtnId = tab === 'ssh' ? 'ssh-cancel-btn' : 'kube-cancel-btn';
  const btn = document.getElementById(btnId);
  const cancelBtn = document.getElementById(cancelBtnId);
  if (!btn) return;

  const svgFloppy = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-4-4H8z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20v-6H8v6M16 4v4H8V4"/></svg>`;
  const svgUndo = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>`;

  if (count > 0) {
    btn.disabled = false;
    btn.innerHTML = `${svgFloppy} <span class="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold" style="background:rgba(255,255,255,0.35); margin-left: 4px;">${count}</span>`;
    btn.className = "flex items-center justify-center px-3 h-8 rounded-lg text-white bg-amber-500 border border-amber-500 hover:bg-amber-600 transition-all font-semibold cursor-pointer shadow-sm shadow-amber-500/20";
    btn.title = `변경사항 저장 (${count}개)`;

    if (cancelBtn) {
      cancelBtn.disabled = false;
      cancelBtn.innerHTML = svgUndo;
      cancelBtn.className = "flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:border-rose-900/50 cursor-pointer transition-all shadow-sm shadow-rose-500/10";
      cancelBtn.title = "변경사항 취소 (저장 안 함)";
    }
  } else {
    btn.disabled = true;
    btn.innerHTML = svgFloppy;
    btn.className = "flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 dark:text-slate-600 border border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed transition-all";
    btn.title = "변경사항 없음";

    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.innerHTML = svgUndo;
      cancelBtn.className = "flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 dark:text-slate-600 border border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed transition-all";
      cancelBtn.title = "변경사항 없음";
    }
  }
}

function _refreshSpin(btnId, fn) {
  const btn = document.getElementById(btnId);
  const spinSvg = `<svg class="w-3.5 h-3.5 spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
  const idleSvg  = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
  const doneSvg  = `<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
  if (btn) { btn.innerHTML = spinSvg; btn.disabled = true; }
  return fn().finally(() => {
    if (!btn) return;
    btn.innerHTML = doneSvg; btn.disabled = false;
    setTimeout(() => { btn.innerHTML = idleSvg; }, 1200);
  });
}
async function sshRefresh()  { await _refreshSpin('ssh-refresh-btn',  sshLoad); }
async function kubeRefresh() { await _refreshSpin('kube-refresh-btn', kubeLoad); }

function _fetchTimeout(url, opts, ms=15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function sshLoad() {
  try {
    const r = await fetch('/api/ssh/servers');
    const d = await r.json();
    servers = d.servers || []; aliases = d.aliases || []; unmanagedHosts = d.unmanaged || []; sshIncludes = d.includes || [];
    sshRender(); populateProxy();
  } catch(err) {
    document.getElementById('ssh-list').innerHTML =
      `<div class="text-center py-20 text-rose-500 text-sm">로드 실패: ${err.message}</div>`;
  }
}

// ── Font scale ────────────────────────────────────────────────
function setFontScale(scale) {
  document.body.style.zoom = scale;
  document.documentElement.style.setProperty('--bz', scale);
  const menu = document.getElementById('font-scale-menu');
  if (menu) menu.classList.add('hidden');
  _updateFontScaleUI(scale);
  fetch('/api/settings', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({font_scale: scale})}).catch(()=>{});
}
function changeFontScale(delta) {
  let scale = parseFloat(document.body.style.zoom) || 1.0;
  scale += delta;
  scale = Math.max(0.5, Math.min(2.0, parseFloat(scale.toFixed(2))));
  setFontScale(scale);
}
function _updateFontScaleUI(scale) {
  document.querySelectorAll('.font-scale-opt').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.scale) === parseFloat(scale));
  });
  const indicator = document.getElementById('zoom-indicator');
  if (indicator) {
    indicator.textContent = `${Math.round(scale * 100)}%`;
  }
}

// ── Guide ─────────────────────────────────────────────────────
const GUIDES = {
  ssh: {
    title: 'SSH 가이드',
    iconBg: '#4f46e5',
    html: `
      <div class="guide-section">
        <p class="guide-section-title">저장 위치</p>
        <div class="guide-path"><code>~/.workit/data/ssh/conn_info.yaml</code><span>서버 목록 (Workit DB)</span></div>
        <div class="guide-path"><code>~/.workit/data/ssh/configs/{project}.conf</code><span>SSH 설정 (프로젝트별 분리)</span></div>
        <div class="guide-path"><code>~/.ssh/config</code><span>Include 연결 (최초 적용 시 자동 추가)</span></div>
        <div class="guide-path"><code>~/.workit/data/ssh/keys/{env}/{alias}.pem</code><span>키 파일</span></div>
        <div class="guide-path"><code>~/.workit/backups/ssh/config.backup</code><span>백업 파일 (저장 시 자동 덮어씀)</span></div>
      </div>
      <div class="guide-section">
        <p class="guide-section-title">동작 방식</p>
        <div class="guide-step"><div class="guide-step-num">1</div><div class="guide-step-text">서버 추가 → <code>conn_info.yaml</code>에 저장, alias는 <code>{project}-{env}-{role}</code> 형식</div></div>
        <div class="guide-step"><div class="guide-step-num">2</div><div class="guide-step-text">키 파일을 업로드하면 <code>~/.workit/data/ssh/keys/{env}/{alias}.pem</code>에 저장 (권한 600 자동 설정)</div></div>
        <div class="guide-step"><div class="guide-step-num">3</div><div class="guide-step-text"><code>저장</code> 버튼 → 프로젝트별 <code>~/.workit/data/ssh/configs/{project}.conf</code> 파일 생성. <code>~/.ssh/config</code>에 <code>Include ~/.workit/data/ssh/configs/*.conf</code> 자동 추가 (기존 설정 유지)</div></div>
        <div class="guide-step"><div class="guide-step-num">4</div><div class="guide-step-text">시스템 Config 탭에서 <code>~/.ssh/config</code>의 직접 등록 호스트 + Include 파일의 모든 호스트가 표시됩니다. 미등록 호스트는 "등록" 버튼으로 Workit에 추가 가능</div></div>
        <div class="guide-step"><div class="guide-step-num">5</div><div class="guide-step-text">터미널에서 <code>ssh {alias}</code>로 바로 접속</div></div>
      </div>
      <div class="guide-section">
        <p class="guide-section-title">접속 예시</p>
        <div class="guide-cmd">
          <code>ssh hyundai-capital-test-master-01</code>
          <button class="guide-cmd-copy" onclick="copyGuideCmd(this,'ssh hyundai-capital-test-master-01')">copy</button>
        </div>
      </div>
      <div class="guide-note info">저장 시 <code>~/.ssh/config</code>의 백업이 <code>~/.workit/backups/ssh/config.backup</code>에 자동 생성됩니다 (단일 파일, 덮어쓰기).</div>
    `
  },
  kube: {
    title: 'Kubernetes 가이드',
    iconBg: '#0ea5e9',
    html: `
      <div class="guide-section">
        <p class="guide-section-title">저장 위치</p>
        <div class="guide-path"><code>~/.kube/config</code><span>시스템 kubeconfig (자동 읽기)</span></div>
        <div class="guide-path"><code>~/.workit/data/kube/configs/{context}.yaml</code><span>Workit 저장 파일</span></div>
        <div class="guide-path"><code>~/.workit/data/kube/contexts.json</code><span>Project/Env/설명 메타데이터</span></div>
        <div class="guide-path"><code>~/.workit/backups/kube/config.backup</code><span>백업 파일 (삭제 시 자동 덮어씀)</span></div>
      </div>
      <div class="guide-section">
        <p class="guide-section-title">동작 방식</p>
        <div class="guide-step"><div class="guide-step-num">1</div><div class="guide-step-text">시스템 Config 섹션에 <code>~/.kube/config</code>의 context가 자동 표시됩니다. 미등록 context는 "등록" 버튼으로 Workit에 추가</div></div>
        <div class="guide-step"><div class="guide-step-num">2</div><div class="guide-step-text">등록된 context는 <code>~/.workit/data/kube/configs/{context-name}.yaml</code>에 독립 kubeconfig로 저장</div></div>
        <div class="guide-step"><div class="guide-step-num">3</div><div class="guide-step-text">시스템 Config의 "삭제" 버튼은 <code>~/.kube/config</code>에서만 제거. Workit 등록 context는 별도 관리</div></div>
        <div class="guide-step"><div class="guide-step-num">4</div><div class="guide-step-text"><code>저장</code> 버튼은 변경사항을 확정. 실제 변경이 없으면 저장 버튼이 활성화되지 않음</div></div>
      </div>
      <div class="guide-section">
        <p class="guide-section-title">환경변수 설정 (셸 rc 파일에 추가)</p>
        <div class="guide-cmd">
          <code>export KUBECONFIG=~/.kube/config:$(find ~/.workit/data/kube/configs -type f -name "*.yaml" | sort | tr '\n' ':')</code>
          <button class="guide-cmd-copy" onclick="copyGuideCmd(this,&quot;export KUBECONFIG=~/.kube/config:$(find ~/.workit/data/kube/configs -type f -name '*.yaml' | sort | tr '\\n' ':')&quot;)">copy</button>
        </div>
      </div>
      <div class="guide-note">환경변수를 설정하면 <code>~/.workit/data/kube/configs/</code> 안의 모든 파일이 <code>kubectl</code>에 자동 로드됩니다. <code>kubectl config get-contexts</code>로 확인하세요.</div>
    `
  },
  accounts: {
    title: 'Accounts 가이드',
    iconBg: '#4f46e5',
    html: `
      <div class="guide-section">
        <p class="guide-section-title">저장 위치</p>
        <div class="guide-path"><code>~/.workit/data/accounts/accounts.json</code><span>계정 정보 (소스 외부)</span></div>
      </div>
      <div class="guide-section">
        <p class="guide-section-title">동작 방식</p>
        <div class="guide-step"><div class="guide-step-num">1</div><div class="guide-step-text">계정 정보는 <code>~/.workit/data/accounts/</code>에 저장됩니다. git에 절대 포함되지 않습니다.</div></div>
        <div class="guide-step"><div class="guide-step-num">2</div><div class="guide-step-text">파일 권한은 <code>600</code>으로 자동 설정됩니다 (본인만 읽기 가능).</div></div>
        <div class="guide-step"><div class="guide-step-num">3</div><div class="guide-step-text">카테고리(DB, Server, API, Service 등)로 분류하고 필터링할 수 있습니다.</div></div>
        <div class="guide-step"><div class="guide-step-num">4</div><div class="guide-step-text">비밀번호 필드는 <code>•••</code>로 가려지며 눈 아이콘 또는 복사 버튼으로 확인할 수 있습니다.</div></div>
      </div>
      <div class="guide-note">⚠️ 로컬 파일에 <strong>평문</strong>으로 저장됩니다. 프로덕션 크리덴셜 등 민감한 정보는 별도 보안 저장소(Vault, 1Password 등)를 사용하세요.</div>
    `
  }
};

// ── Setup Guide ───────────────────────────────────────────────
let _setupStatus = { step1: false, step2: false, step3: false };

function openSetupGuide() {
  document.getElementById('setup-modal').classList.add('open');
  fetch('/api/setup_status').then(r => r.json()).then(d => {
    _setupStatus = d;
    _renderSetupStatus(d);
  }).catch(() => {});
}
function closeSetupGuide() { document.getElementById('setup-modal').classList.remove('open'); }

function _renderSetupStatus(d) {
  const doneColor = '#10b981';
  [1, 2, 3].forEach(n => {
    const done    = d[`step${n}`];
    const stepEl  = document.getElementById(`setup-step-${n}`);
    const numEl   = document.getElementById(`setup-num-${n}`);
    const statusEl= document.getElementById(`setup-status-${n}`);
    const bodyEl  = document.getElementById(`setup-body-${n}`);
    if (!stepEl) return;
    if (done) {
      stepEl.style.opacity   = '0.55';
      if (numEl)   { numEl.style.background = doneColor; numEl.textContent = '✓'; }
      statusEl?.classList.remove('hidden');
      bodyEl?.classList.add('pointer-events-none');
    } else {
      stepEl.style.opacity   = '1';
      statusEl?.classList.add('hidden');
      bodyEl?.classList.remove('pointer-events-none');
    }
  });

  const allDone   = d.step1 && d.step2 && d.step3;
  const pending   = [1,2,3].filter(n => !d[`step${n}`]);
  document.getElementById('setup-all-done')?.classList.toggle('hidden', !allDone);
  document.getElementById('setup-copy-wrap')?.classList.toggle('hidden', allDone);

  if (!allDone) {
    const lbl = document.getElementById('setup-copy-label');
    if (lbl) {
      lbl.textContent = pending.length < 3
        ? `미완료 스크립트 (${pending.join('·')}단계) 한 번에 복사`
        : '전체 스크립트 (1+2+3) 한 번에 복사';
    }
  }
}

function copySetupScript() {
  const pending = [1,2,3].filter(n => !_setupStatus[`step${n}`]);
  const scripts = {
    1: [
      '# 1. SSH 키 디렉토리 및 ~/.ssh/config Include 설정',
      'mkdir -p ~/.workit/data/ssh/keys/{dev,test,stg,prd}',
      'chmod 700 ~/.workit/data/ssh/keys',
      'mkdir -p ~/.ssh',
      'if ! grep -q "~/.workit/data/ssh/configs/*.conf" ~/.ssh/config 2>/dev/null; then',
      '  (echo "Include ~/.workit/data/ssh/configs/*.conf"; cat ~/.ssh/config 2>/dev/null) > /tmp/w_ssh && mv /tmp/w_ssh ~/.ssh/config && chmod 600 ~/.ssh/config',
      'fi',
      'echo "✓  ~/.ssh/config Include 및 키 폴더 설정 완료"',
    ].join('\n'),
    2: [
      '# 2. Kubernetes kubeconfig 디렉토리 생성',
      'mkdir -p ~/.workit/data/kube/configs',
      'echo "✓  kubeconfig 디렉토리: ~/.workit/data/kube/configs"',
    ].join('\n'),
    3: [
      "# 3. ~/.zshrc에 KUBECONFIG 함수 추가 (중복 방지)",
      'if ! grep -q "_load_kubeconfigs" ~/.zshrc 2>/dev/null; then',
      "  cat >> ~/.zshrc << 'EOF'",
      '',
      '# Workit — Kubernetes 멀티 컨텍스트 자동 로드',
      '_load_kubeconfigs() {',
      '  if [ -d ~/.workit/data/kube/configs ]; then',
      "    export KUBECONFIG=~/.kube/config:$(find ~/.workit/data/kube/configs -type f -name \"*.yaml\" | sort | tr '\\n' ':')",
      '  fi',
      '}',
      '_load_kubeconfigs',
      "alias kubereload=\"_load_kubeconfigs && echo 'KUBECONFIG reloaded'\"",
      'EOF',
      '  echo "✓  KUBECONFIG 함수 추가: ~/.zshrc"',
      'else',
      '  echo "ℹ  이미 설정되어 있습니다 (_load_kubeconfigs)"',
      'fi',
      '',
      'source ~/.zshrc 2>/dev/null || true',
    ].join('\n'),
  };
  const raw = [
    '# ─── Workit 초기 설정 ─────────────────────────────────────────',
    '# 이 스크립트를 터미널에 붙여넣으면 자동으로 설정됩니다',
    '',
    ...pending.map(n => scripts[n]),
    '',
    'echo ""',
    'echo "🎉  완료! Workit 앱을 재시작하면 변경사항이 반영됩니다."',
  ].join('\n');
  const copyBtn = document.getElementById('setup-copy-btn');
  navigator.clipboard.writeText(raw).then(() => {
    const lbl = document.getElementById('setup-copy-label');
    const orig = lbl?.textContent;
    if (lbl) lbl.textContent = '✓ 복사됨';
    if (copyBtn) copyBtn.classList.add('copy-done');
    setTimeout(() => {
      if (lbl) lbl.textContent = orig;
      if (copyBtn) copyBtn.classList.remove('copy-done');
    }, 2000);
    toast('설정 스크립트 복사됨');
  });
}

const _STEP_SCRIPTS = {
  1: [
    'mkdir -p ~/.workit/data/ssh/keys/{dev,test,stg,prd}',
    'chmod 700 ~/.workit/data/ssh/keys',
    'mkdir -p ~/.ssh',
    'if ! grep -q "~/.workit/data/ssh/configs/*.conf" ~/.ssh/config 2>/dev/null; then',
    '  (echo "Include ~/.workit/data/ssh/configs/*.conf"; cat ~/.ssh/config 2>/dev/null) > /tmp/w_ssh && mv /tmp/w_ssh ~/.ssh/config && chmod 600 ~/.ssh/config',
    'fi',
    'echo "✓  ~/.ssh/config Include 및 키 폴더 설정 완료"'
  ].join('\n'),
  2: 'mkdir -p ~/.workit/data/kube/configs\necho "✓  kubeconfig 디렉토리: ~/.workit/data/kube/configs"',
  3: [
    "if ! grep -q '_load_kubeconfigs' ~/.zshrc 2>/dev/null; then",
    "  cat >> ~/.zshrc << 'EOF'",
    "",
    "# Workit — Kubernetes 멀티 컨텍스트 자동 로드",
    "_load_kubeconfigs() {",
    "  if [ -d ~/.workit/data/kube/configs ]; then",
    "    export KUBECONFIG=~/.kube/config:$(find ~/.workit/data/kube/configs -type f -name \"*.yaml\" | sort | tr '\\n' ':')",
    "  fi",
    "}",
    "_load_kubeconfigs",
    "alias kubereload=\"_load_kubeconfigs && echo 'KUBECONFIG reloaded'\"",
    "EOF",
    "  echo \"✓  KUBECONFIG 함수 추가: ~/.zshrc\"",
    "else",
    "  echo \"ℹ  이미 설정되어 있습니다 (_load_kubeconfigs)\"",
    "fi",
    "",
    "source ~/.zshrc 2>/dev/null || true",
  ].join('\n'),
};
function copyStep(n, btn) {
  navigator.clipboard.writeText(_STEP_SCRIPTS[n]).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ 복사됨';
    btn.classList.add('copy-done');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copy-done'); }, 2000);
    toast('복사됨');
  });
}

// ── Markdown renderer ────────────────────────────────────────
function _mdEsc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _mdInline(t) {
  return _mdEsc(t)
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      if (href.startsWith('#')) {
        const id = href.slice(1);
        return `<a href="javascript:void(0)" onclick="(function(){var el=document.getElementById('${id}');if(el)el.scrollIntoView({behavior:'smooth'});})();" class="md-anchor">${text}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
    });
}
function _renderMd(raw) {
  if (!raw) return '';
  const lines = raw.split('\n');
  const out = [];
  let inCode = false, codeLang = '', codeLines = [];
  let listType = null, listBuf = [];
  function flushList() {
    if (!listType) return;
    out.push(`<${listType}>`);
    listBuf.forEach(t => out.push(`<li>${_mdInline(t)}</li>`));
    out.push(`</${listType}>`);
    listType = null; listBuf = [];
  }

  let inTable = false, tableHeaders = [], tableRows = [];
  function flushTable() {
    if (!inTable) return;
    let html = '<div class="overflow-x-auto my-3"><table>';
    if (tableHeaders.length) {
      html += '<thead><tr>';
      tableHeaders.forEach(h => {
        html += `<th>${_mdInline(h)}</th>`;
      });
      html += '</tr></thead>';
    }
    if (tableRows.length) {
      html += '<tbody>';
      tableRows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
          html += `<td>${_mdInline(cell)}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody>';
    }
    html += '</table></div>';
    out.push(html);
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  }

  for (const line of lines) {
    if (inCode) {
      if (/^```/.test(line)) { out.push(`<pre><code${codeLang?` class="lang-${codeLang}"`:''}>${_mdEsc(codeLines.join('\n'))}</code></pre>`); inCode=false; codeLines=[]; }
      else codeLines.push(line);
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) { flushList(); flushTable(); inCode=true; codeLang=fence[1]; continue; }

    // Check if GFM table row
    const isTableLine = /^\s*\|(.*)\|\s*$/.test(line);
    if (isTableLine) {
      flushList();
      const isSeparator = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line);
      if (!inTable) {
        if (!isSeparator) {
          inTable = true;
          tableHeaders = line.split('|').map(c => c.trim()).slice(1, -1);
        }
      } else {
        if (!isSeparator) {
          tableRows.push(line.split('|').map(c => c.trim()).slice(1, -1));
        }
      }
      continue;
    } else {
      flushTable();
    }

    const hm = line.match(/^(#{1,6}) (.*)/);
    if (hm) {
      flushList();
      const hid = hm[2].toLowerCase().replace(/[\s]+/g,'-').replace(/[^a-z0-9가-힣\-]/g,'');
      out.push(`<h${hm[1].length} id="${hid}">${_mdInline(hm[2])}</h${hm[1].length}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushList(); out.push('<hr>'); continue; }
    const bq = line.match(/^> ?(.*)/);
    if (bq) { flushList(); out.push(`<blockquote>${_mdInline(bq[1])}</blockquote>`); continue; }
    const ul = line.match(/^[-*+] (.*)/);
    if (ul) { if (listType!=='ul'){flushList();listType='ul';} listBuf.push(ul[1]); continue; }
    const ol = line.match(/^\d+\. (.*)/);
    if (ol) { if (listType!=='ol'){flushList();listType='ol';} listBuf.push(ol[1]); continue; }

    flushList();
    if (line.trim()) out.push(`<p>${_mdInline(line)}</p>`);
  }
  flushList();
  flushTable();
  if (inCode && codeLines.length) out.push(`<pre><code>${_mdEsc(codeLines.join('\n'))}</code></pre>`);
  return out.join('\n');
}

// ── Input autocapitalize / autocorrect 비활성화 ──────────────
(function() {
  function _fixInput(el) {
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
  }
  document.querySelectorAll('input, textarea').forEach(_fixInput);
  new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches('input, textarea')) _fixInput(n);
      n.querySelectorAll('input, textarea').forEach(_fixInput);
    }));
  }).observe(document.body, { childList: true, subtree: true });
})();
