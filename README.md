# Workit

개인 업무 허브 — SSH 서버, Kubernetes Context, 계정 정보를 한 곳에서 관리하는 로컬 웹 앱입니다.

## 기능

### SSH
- 서버 목록을 Project / Env (dev·test·stg·prd) / Role로 분류
- SSH 키 파일 업로드 및 관리 (`~/.ssh/keys/{env}/{alias}.pem`)
- `저장` 버튼 한 번으로 `~/.ssh/config` 자동 생성 → 터미널에서 `ssh {alias}` 바로 접속

### Kubernetes
- `~/.kube/config` 및 `~/.kube/configs/` 하위 파일을 자동 임포트
- **미등록** 컨텍스트(Project/Env 미설정)와 **등록** 컨텍스트를 분리하여 표시
- `등록` 버튼으로 Project / Env / 설명 설정 → `~/.kube/configs/{context}.yaml`로 저장
- context 파일 내 cluster/user 이름을 context 이름과 동일하게 저장해 KUBECONFIG 병합 시 충돌 방지
- 미등록 context 삭제 시 `~/.kube/config`에서도 자동 제거

### 계정 정보
- 비밀번호, API 키, 토큰 등 계정 정보 로컬 저장 및 관리

## 설치 및 실행

```bash
pip install -r requirements.txt
python3 app.py
# http://localhost:5010
```

### macOS 자동 시작 (launchd)

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
| SSH 서버 목록 | `workit/data/ssh/conn_info.yaml` |
| SSH 키 파일 | `~/.ssh/keys/{env}/{alias}.pem` |
| SSH 설정 | `~/.ssh/config` (적용 시 생성) |
| Kubernetes 메타데이터 | `workit/data/kube/contexts.json` |
| Kubernetes context 파일 | `~/.kube/configs/{context}.yaml` |
| 계정 정보 | `workit/data/accounts.json` |

## 기술 스택

- **Backend**: Python / Flask
- **Frontend**: Tailwind CSS (CDN) + Vanilla JS
- **Config**: PyYAML
