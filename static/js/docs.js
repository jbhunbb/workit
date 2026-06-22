// ── Docs ─────────────────────────────────────────────────────
let _docs = [];
let _docCurrent = null;
let _editUrls = [];
let _docIsNew = false;

const _DOCS_EMPTY = `<div class="flex flex-col items-center justify-center h-full text-slate-300 gap-3 select-none" style="-webkit-user-select:none"><svg class="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p class="text-sm">문서를 선택하거나 새 문서를 만들어보세요</p></div>`;

async function docsLoad() {
  const data = await fetch('/api/docs').then(r => r.json());
  _docs = data;
  _docsRenderList();
}

function _docsRenderList() {
  const el = document.getElementById('docs-list-panel');
  if (!_docs.length) {
    el.innerHTML = `<p class="text-center text-[11px] text-slate-300 py-6">문서가 없습니다</p>`;
    return;
  }
  el.innerHTML = _docs.map(d => {
    const isActive = _docCurrent && _docCurrent.id === d.id;
    const date = new Date(d.updated_at * 1000).toLocaleDateString('ko-KR', {month:'short',day:'numeric'});
    return `<div class="docs-item${isActive?' active':''}" onclick="docsOpen('${d.id}')">
      <p class="docs-item-title text-[12.5px] font-semibold truncate text-slate-800">${esc(d.title)}</p>
      ${d.preview?`<p class="text-[11px] text-slate-400 truncate mt-0.5">${esc(d.preview)}</p>`:''}
      <p class="text-[10px] text-slate-300 mt-0.5">${date}</p>
    </div>`;
  }).join('');
}

async function docsOpen(id) {
  const data = await fetch(`/api/docs/${id}`).then(r => r.json());
  _docCurrent = data;
  _docsRenderList();
  _docsShowView();
}

function _docsShowView() {
  const d = _docCurrent;
  const urlsHtml = (d.urls||[]).map(u =>
    `<a href="${eA(u)}" target="_blank" onclick="event.stopPropagation()"
      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-mono max-w-[240px] truncate">
      <svg class="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
      <span class="truncate">${esc(u.replace(/^https?:\/\//,''))}</span>
    </a>`
  ).join('');
  document.getElementById('docs-detail-panel').innerHTML = `
    <div class="max-w-2xl pb-10">
      <div class="flex items-start justify-between mb-3 gap-4">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-bold text-slate-900">${esc(d.title)}</h1>
          ${urlsHtml?`<div class="flex flex-wrap gap-1.5 mt-2">${urlsHtml}</div>`:''}
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button onclick="docsDelete('${d.id}')" class="px-2.5 py-1 rounded-lg text-[11.5px] text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">삭제</button>
          <button onclick="docsEdit()" class="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors">편집</button>
        </div>
      </div>
      <div class="mt-4 md-body">${_renderMd(d.content)||'<p class="text-slate-300 text-sm">내용 없음. 편집 버튼을 눌러 작성하세요.</p>'}</div>
    </div>`;
}

function docsEdit() {
  if (!_docCurrent) return;
  _editUrls = [...(_docCurrent.urls||[])];
  _docIsNew = false;
  _docsShowEdit();
}

function docsNew() {
  _docCurrent = {id:null,title:'',urls:[],content:''};
  _editUrls = [];
  _docIsNew = true;
  _docsRenderList();
  _docsShowEdit();
}

let _docsDragCounter = 0;
function docsDragEnter(e) {
  e.preventDefault();
  _docsDragCounter++;
  const overlay = document.getElementById('docs-drag-overlay');
  if (overlay) overlay.classList.remove('hidden');
}
function docsDragOver(e) {
  e.preventDefault();
}
function docsDragLeave(e) {
  e.preventDefault();
  _docsDragCounter--;
  if (_docsDragCounter <= 0) {
    _docsDragCounter = 0;
    const overlay = document.getElementById('docs-drag-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}
function docsDragDrop(e) {
  e.preventDefault();
  _docsDragCounter = 0;
  const overlay = document.getElementById('docs-drag-overlay');
  if (overlay) overlay.classList.add('hidden');
  
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    docsHandleUpload(files);
  }
}

function docsHandleUpload(inputOrFiles) {
  let files;
  if (inputOrFiles instanceof FileList || Array.isArray(inputOrFiles)) {
    files = inputOrFiles;
  } else if (inputOrFiles.files) {
    files = inputOrFiles.files;
  }
  const file = files ? files[0] : null;
  if (!file) return;
  if (!file.name.match(/\.md$/i)) {
    toast('MD 파일(.md)만 업로드할 수 있습니다');
    if (inputOrFiles && typeof inputOrFiles.value !== 'undefined') inputOrFiles.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    let title = file.name.replace(/\.md$/i, '');
    let urls = [];
    let content = text;
    // Parse YAML frontmatter if present
    if (text.startsWith('---')) {
      const idx = text.indexOf('\n---', 3);
      if (idx !== -1) {
        const yaml = text.slice(3, idx);
        const tm = yaml.match(/^title:\s*(.+)$/m);
        if (tm) title = tm[1].trim().replace(/^['"]|['"]$/g, '');
        const um = yaml.match(/^urls:\s*\n((?:[ \t]*-[ \t]*.+\n?)*)/m);
        if (um) urls = um[1].split('\n').map(l => l.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
        content = text.slice(idx + 4).replace(/^\n/, '');
      }
    }
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title, urls, content}),
    });
    const data = await res.json();
    if (inputOrFiles && typeof inputOrFiles.value !== 'undefined') inputOrFiles.value = '';
    toast(`'${title}' 업로드됨`);
    await docsLoad();
    docsOpen(data.id);
  };
  reader.readAsText(file);
}

function _docsShowEdit() {
  const d = _docCurrent;
  document.getElementById('docs-detail-panel').innerHTML = `
    <div class="max-w-2xl pb-6">
      <div class="flex items-center gap-2 mb-4">
        <input id="docs-edit-title" value="${eA(d.title)}" placeholder="제목을 입력하세요"
          autocapitalize="off" autocomplete="off" spellcheck="false"
          class="flex-1 text-lg font-bold border-b-2 border-slate-200 pb-1.5 bg-transparent outline-none focus:border-indigo-400 text-slate-900 placeholder-slate-300 transition-colors">
        <button onclick="docsCancel()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-slate-50 flex-shrink-0">취소</button>
        <button onclick="docsSave()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0 transition-all" style="background:#4f46e5">저장</button>
      </div>
      <div class="mb-4 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
        <p class="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">관련 URL</p>
        <div id="docs-urls-list" class="space-y-1.5 mb-2.5"></div>
        <div class="flex gap-2">
          <input id="docs-url-input" placeholder="https://..." autocapitalize="off" autocomplete="off" spellcheck="false"
            class="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-indigo-300 font-mono transition-colors"
            onkeydown="if(event.key==='Enter'){docsAddUrl();event.preventDefault()}">
          <button onclick="docsAddUrl()" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 flex-shrink-0">추가</button>
        </div>
      </div>
      <textarea id="docs-edit-content" placeholder="Markdown으로 작성하세요..." autocapitalize="off" autocorrect="off" spellcheck="false"
        class="w-full text-[12.5px] font-mono bg-slate-50 rounded-xl p-4 border border-slate-100 outline-none focus:border-indigo-200 text-slate-700 placeholder-slate-300 resize-none leading-relaxed transition-colors"
        style="height:calc(100vh - 370px);min-height:180px">${esc(d.content)}</textarea>
    </div>`;
  _docsRenderUrls();
  document.getElementById('docs-edit-title').focus();
}

function _docsRenderUrls() {
  const el = document.getElementById('docs-urls-list');
  if (!el) return;
  if (!_editUrls.length) { el.innerHTML=`<p class="text-[11px] text-slate-300">추가된 URL이 없습니다</p>`; return; }
  el.innerHTML = _editUrls.map((u,i) =>
    `<div class="flex items-center gap-2">
      <span class="flex-1 text-[11.5px] font-mono text-slate-500 truncate">${esc(u)}</span>
      <button onclick="docsRemoveUrl(${i})" class="text-slate-300 hover:text-rose-400 transition-colors text-base leading-none w-4 flex-shrink-0">×</button>
    </div>`
  ).join('');
}

function docsAddUrl() {
  const inp = document.getElementById('docs-url-input');
  const v = inp.value.trim();
  if (!v) return;
  _editUrls.push(v); inp.value=''; _docsRenderUrls();
}

function docsRemoveUrl(i) { _editUrls.splice(i,1); _docsRenderUrls(); }

function docsCancel() {
  if (_docIsNew) {
    _docCurrent = null;
    _docsRenderList();
    document.getElementById('docs-detail-panel').innerHTML = _DOCS_EMPTY;
  } else {
    _docsShowView();
  }
}

async function docsSave() {
  const title = document.getElementById('docs-edit-title').value.trim();
  const content = document.getElementById('docs-edit-content').value;
  if (!title) { toast('제목을 입력해주세요'); return; }
  const body = {title, urls: _editUrls, content};
  if (_docIsNew) {
    const res = await fetch('/api/docs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data = await res.json();
    _docCurrent = {id:data.id, title, urls:_editUrls, content};
    _docIsNew = false;
  } else {
    await fetch(`/api/docs/${_docCurrent.id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    _docCurrent = {..._docCurrent, title, urls:_editUrls, content};
  }
  toast('저장됨');
  await docsLoad();
  _docsShowView();
}

async function docsDelete(id) {
  if (!confirm('이 문서를 삭제하시겠습니까?')) return;
  await fetch(`/api/docs/${id}`, {method:'DELETE'});
  _docCurrent = null;
  toast('삭제됨');
  await docsLoad();
  document.getElementById('docs-detail-panel').innerHTML = _DOCS_EMPTY;
}

function openGuide(tab) {
  const g = GUIDES[tab];
  if (!g) return;
  document.getElementById('guide-title').textContent = g.title;
  document.getElementById('guide-icon').style.background = g.iconBg;
  document.getElementById('guide-body').innerHTML = g.html;
  document.getElementById('guide-modal').classList.add('open');
}
function closeGuide() { document.getElementById('guide-modal').classList.remove('open'); }
function copyGuideCmd(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ copied'; setTimeout(() => btn.textContent = 'copy', 1800);
  });
}
