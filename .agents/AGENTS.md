# Workit Agent Rules & Project Guidelines

이 문서에는 Workit 프로젝트의 개발 방향성, 기술 스택, 디자인 가이드라인, 단축키 처리, 그리고 버전 관리 및 자동 업데이트에 대한 규칙이 요약되어 있습니다. 에이전트 작업 시 본 가이드라인을 엄격히 준수하여 일관성 있는 코드를 작성해 주세요.

---

## 1. 프로젝트 개요 (Overview)
* **Workit**은 Flask 백엔드와 PyWebView 프론트엔드로 구동되는 macOS 데스크톱 개인 작업 허브 애플리케이션입니다.
* 사용자는 SSH 커넥션 정보 관리, Kubernetes 컨텍스트 관리, 개인 계정 정보 저장, 마크다운 기반의 Docs 기능 등을 이용할 수 있습니다.

---

## 2. 기술 스택 (Tech Stack)
* **Backend**: Python 3.12+ (Flask, PyYAML)
* **Frontend**: HTML5, Vanilla CSS (TailwindCSS는 유틸리티 및 보조용으로만 제한적 사용), JavaScript (ES6)
* **OS Integration**: PyWebView (macOS Cocoa WebKit)

---

## 3. 디자인 시스템 및 스타일 가이드라인 (Design & Styling)
* **테마 시스템**: Light 모드와 Dark 모드를 모두 완벽하게 지원합니다.
  * 테마 전환 시 `body.dark` 클래스가 추가/제거되며, 색상은 CSS 변수(예: `--bg-body`, `--text-main` 등)를 통해 동적으로 처리됩니다.
  * Tailwind의 `.bg-white` 등 하드코딩된 유틸리티 클래스가 다크 모드에서 하얗게 보이지 않도록 `app.css` 내에서 `body.dark .bg-white { background: var(--bg-card) !important; }`와 같이 적절히 오버라이드하고 있습니다.
* **프로젝트 헤더 Contrast 가이드라인**:
  * SSH 및 Kubernetes 탭의 프로젝트명 헤더(`.proj-hdr`) 내부 텍스트는 `text-white/90`과 같이 하얀색 톤으로 하드코딩되어 있습니다.
  * 따라서 배경색은 항상 어두운 색상을 유지해야 합니다.
    * **Light 모드**: `#1e293b` (slate-800)
    * **Dark 모드**: `#111c35`
* **비율 설정 (Zoom / Scale)**:
  * 전체 앱 화면의 비율은 `document.body.style.zoom` 및 CSS 변수 `--bz`를 활용해 제어합니다.
  * 사용자가 지정한 크기는 `/api/settings`에 저장되며, 앱이 로드될 때 복원됩니다.

---

## 4. 단축키 바인딩 규칙 (Keyboard Shortcuts)
* macOS WebKit(PyWebView) 환경에서는 브라우저 기본 줌 기능(`Cmd` + `+`, `Cmd` + `-`)이 오버라이드되기 쉽습니다.
* 앱 내 줌 스케일링 단축키를 설정할 때는 아래 원칙을 준수해야 합니다.
  * 이벤트 리스너를 반드시 **캡처 단계 (`{ capture: true }`)**에서 등록하여 WebKit 브라우저 기본 이벤트를 가로챕니다.
  * 이벤트 발생 시 `e.preventDefault()`와 `e.stopPropagation()`을 둘 다 호출하여 기본 줌 현상이 이중으로 발생하는 문제를 방지합니다.
  * QWERTY뿐만 아니라 키패드 줌 키 등 다양한 자판 레이아웃에 대응하기 위해 `key`와 `code` 검증을 병행합니다.
    * **Zoom In**: `e.key === '='` / `e.key === '+'` / `e.code === 'Equal'` / `e.code === 'NumpadAdd'`
    * **Zoom Out**: `e.key === '-'` / `e.key === '_'` / `e.code === 'Minus'` / `e.code === 'NumpadSubtract'`
    * **Zoom Reset**: `e.key === '0'` / `e.code === 'Digit0'` / `e.code === 'Numpad0'`

---

## 5. 버전 관리 및 자동 업데이트 시스템 (Versioning & Updates)
* **앱 현재 버전**: `1.0.2`
  * Python 백엔드 `app.py` 내 `APP_VERSION = "1.0.2"`로 하드코딩 및 중앙 집중식 관리됩니다.
  * 메인 렌더링(/) 시 `version` 변수로 템플릿에 주입되며, 헤더 타이틀 우측에 `v1.0.1` 배지가 표기됩니다.
* **업데이트 확인 프로세스**:
  * 앱 시작 1.5초 후 프론트엔드(`static/js/init.js`)에서 `/api/check_update` 라우트를 호출합니다.
  * 백엔드는 GitHub의 최신 Release 정보 API(`https://api.github.com/repos/jbhunbb/workit/releases/latest`)를 파싱하여 최신 버전을 조회합니다.
  * 조회한 `tag_name`의 버전(예: `v1.0.2` -> `1.0.2`)과 백엔드의 `APP_VERSION`을 비교(SemVer 기반 세 부분 비교)하여 최신 버전이 더 클 경우 `has_update: true`와 함께 릴리즈 정보(HTML URL, 릴리즈 노트)를 리턴합니다.
* **업데이트 진행 및 브라우저 연동**:
  * 신규 버전이 존재하면 프론트엔드는 사용자에게 릴리즈 노트를 표기하며 `confirm` 경고창을 제공합니다.
  * 사용자가 동의할 경우, 백엔드 `/api/open_url` API를 통해 Python 표준 라이브러리인 `webbrowser` 모듈을 구동하여 사용자의 기본 브라우저에서 안전하게 해당 다운로드 페이지를 열어줍니다.

---

## 6. 기능 관련 에러 처리 및 경고 (Error Handling)
* **Kubernetes YAML Context 파싱**:
  * 파일 업로드 및 텍스트 영역 직접 입력을 통해 새로운 kubeconfig Context를 추가할 때, 파싱이 실패하면 단순 토스트 노출뿐만 아니라 에러의 상세 사유가 명시된 브라우저 `alert()` 알람창을 제공하여 입력 값 오류를 즉시 안내하도록 처리해야 합니다.
