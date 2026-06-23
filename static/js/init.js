// ── Init ─────────────────────────────────────────────────────
// Track unsaved changes in SSH drawer
document.getElementById('add-form').addEventListener('input', () => { if (editAlias) drawerDirty = true; });
document.getElementById('add-form').addEventListener('change', () => { if (editAlias) drawerDirty = true; });
// Patch selEnv and toggleFwd to also set drawerDirty
const _origSelEnv = selEnv;
window.selEnv = function(e) { _origSelEnv(e); if (editAlias) drawerDirty = true; };
const _origToggleFwd = toggleFwd;
window.toggleFwd = function() { _origToggleFwd(); if (editAlias) drawerDirty = true; };

switchTab(localStorage.getItem('workit_tab') || 'ssh');
_applyTheme(document.body.classList.contains('dark'));
// Backup: confirm theme from server after load (handles cases where template injection was stale)
fetch('/api/settings').then(r => r.json()).then(d => {
  if (d.theme) _applyTheme(d.theme === 'dark');
  if (d.font_scale) { document.body.style.zoom = d.font_scale; document.documentElement.style.setProperty('--bz', d.font_scale); _updateFontScaleUI(d.font_scale); }
}).catch(() => {});

// Command + R / Ctrl + R 새로고침 및 Cmd + +/- 크기 조절 단축키 지원
window.addEventListener('keydown', (e) => {
  const isZoomIn = (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd');
  const isZoomOut = (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract');
  const isZoomReset = (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0');

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    window.location.reload();
  }
  else if ((e.metaKey || e.ctrlKey) && isZoomIn) {
    e.preventDefault();
    e.stopPropagation();
    changeFontScale(0.05);
  }
  else if ((e.metaKey || e.ctrlKey) && isZoomOut) {
    e.preventDefault();
    e.stopPropagation();
    changeFontScale(-0.05);
  }
  else if ((e.metaKey || e.ctrlKey) && isZoomReset) {
    e.preventDefault();
    e.stopPropagation();
    setFontScale(1.0);
  }
}, { capture: true });

// Check for updates on startup
setTimeout(() => {
  fetch('/api/check_update')
    .then(r => r.json())
    .then(d => {
      if (d.has_update) {
        const msg = `새로운 버전(v${d.latest_version})이 출시되었습니다. 업데이트를 진행하시겠습니까?\n\n` +
                    `현재 버전: v${d.current_version}\n` +
                    `최신 버전: v${d.latest_version}\n\n` +
                    `[업데이트 내용]\n${d.release_notes || '설명이 없습니다.'}`;
        if (confirm(msg)) {
          fetch('/api/open_url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: d.html_url })
          });
        }
      }
    })
    .catch(err => console.error('Update check failed:', err));
}, 1500);