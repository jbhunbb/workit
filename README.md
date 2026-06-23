# Workit

개인 업무 허브 — SSH 서버, Kubernetes Context, 계정 정보, 마크다운 문서(Docs)를 한 곳에서 관리하는 macOS 데스크톱 애플리케이션(PyWebView 기반)입니다.

## 기능

### SSH
- 서버 목록을 Project / Env (dev·test·stg·prd) / Role로 분류
- SSH 키 파일 업로드 및 관리 (`~/.workit/data/ssh/keys/{env}/{alias}.pem`)
- `적용` 버튼 한 번으로 `~/.ssh/config` 자동 생성 → 터미널에서 `ssh {alias}` 바로 접속

### Kubernetes
- `~/.kube/config` 및 `~/.kube/configs/` 하위 파일을 자동 임포트
- **미등록** 컨텍스트(Project/Env 미설정)와 **등록** 컨텍스트를 분리하여 표시
- `등록` 버튼으로 Project / Env / 설명 설정 → `~/.kube/configs/{context}.yaml`로 저장
- context 파일 내 cluster/user 이름을 context 이름과 동일하게 저장해 KUBECONFIG 병합 시 충돌 방지
- 미등록 context 삭제 시 `~/.kube/config`에서도 자동 제거
- **YAML 파싱 에러 알림**: 파일 업로드나 텍스트 직접 입력 시 YAML 형식이 잘못된 경우 브라우저 경고창(`alert`)을 통해 구체적인 파싱 오류 이유를 표시합니다.

### 계정 정보
- 비밀번호, API 키, 토큰 등 계정 정보 관리
- 소스 코드 외부(`~/.workit/accounts/`)에 저장 — git에 노출되지 않음
- 파일 권한 600 자동 설정

### 마크다운 문서 (Docs)
- 드래그 앤 드롭(.md 파일)을 통해 쉽게 문서를 추가 및 관리 가능합니다.
- 테이블(표) 형식 렌더링 및 모던 마크다운 스타일을 지원합니다.

---

## 편의 기능

### 비율 설정 기능 (Zoom & Scale)
- 화면의 글씨 크기 및 줌 스케일을 저장하고 복원할 수 있습니다.
- 단축키 지원 (macOS Cocoa WebKit 기본 동작과 충돌을 막기 위해 캡처 단계에서 제어):
  - **Zoom In**: `Cmd` + `+` (또는 `Cmd` + `=`)
  - **Zoom Out**: `Cmd` + `-`
  - **Zoom Reset**: `Cmd` + `0` (100% 비율로 초기화)

### 버전 관리 및 자동 업데이트
- 앱을 실행하면 GitHub의 최신 Release 정보(`jbhunbb/workit`)와 현재 앱 버전(`v1.0.1`)을 비교합니다.
- 새로운 버전이 있을 경우 릴리즈 노트를 띄우고 기본 웹 브라우저를 구동하여 안전하게 해당 다운로드 페이지를 열어줍니다.

---

## 설치 및 실행

### 개발 모드 실행
```bash
pip install -r requirements.txt
# 브라우저 실행 모드
python3 app.py
# 데스크톱 앱 실행 모드 (PyWebView)
python3 main.py
```

### macOS 애플리케이션 빌드
```bash
# Workit.app 및 Workit.dmg 빌드 패키징
bash build_mac.sh
```

### macOS 자동 시작 (launchd - 브라우저 백그라운드 구동 시)
```bash
bash setup.sh start   # 서비스 등록 및 시작
bash setup.sh stop    # 서비스 중지
bash setup.sh restart # 재시작
bash setup.sh status  # 상태 확인
```

## Kubernetes 권장 설정

```bash
# ~/.zshrc 또는 ~/.bashrc에 추가
export KUBECONFIG=$(find ~/.kube/configs -type f | tr '\n' ':')
```

## 데이터 저장 위치

| 구분 | 경로 |
|------|------|
| SSH 서버 목록 | `~/.workit/data/ssh/conn_info.yaml` |
| SSH 키 파일 | `~/.workit/data/ssh/keys/{env}/{alias}.pem` |
| SSH 설정 | `~/.ssh/config` (적용 시 생성) |
| Kubernetes 메타데이터 | `~/.workit/data/kube/contexts.json` |
| Kubernetes context 파일 | `~/.kube/configs/{context}.yaml` |
| 계정 정보 | `~/.workit/accounts/accounts.json` (권한 600) |
| 마크다운 문서 (Docs) | `~/.workit/data/docs/` |

## 기술 스택

- **Backend**: Python 3.12+ / Flask / PyYAML
- **Frontend**: Vanilla CSS + Vanilla JS (ES6)
- **Desktop Wrapper**: PyWebView (macOS Cocoa WebKit)
