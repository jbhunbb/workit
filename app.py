#!/usr/bin/env python3
"""Workit — Personal Work Hub"""

from flask import Flask, request, jsonify, render_template
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import yaml, json, os, sys, shutil, uuid, re, urllib.request, webbrowser

APP_VERSION = "1.0.1"

# When bundled with PyInstaller, templates/static live in sys._MEIPASS.
# Data always lives in ~/.workit/data/ (user-writable, persists across updates).
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)
    SOURCE_DIR = None
else:
    BASE_DIR   = Path(__file__).parent
    SOURCE_DIR = BASE_DIR          # used for data migration below

DATA_DIR         = Path.home() / ".workit" / "data"
CACHE_DIR        = Path.home() / ".workit" / "cache"
BACKUP_DIR       = Path.home() / ".workit" / "backups"
SETTINGS_FILE    = CACHE_DIR / "settings.json"
SSH_YAML         = DATA_DIR / "ssh" / "conn_info.yaml"
ACCTS_FILE       = DATA_DIR / "accounts" / "accounts.json"
SSH_CONFIG       = Path.home() / ".ssh" / "config"
SSH_WORKIT_DIR   = DATA_DIR / "ssh"                         # ssh data root: ~/.workit/data/ssh/
SSH_CONFS_DIR    = DATA_DIR / "ssh" / "configs"             # conf files: ~/.workit/data/ssh/configs/*.conf
KEYS_ROOT        = DATA_DIR / "ssh" / "keys"                # key files: ~/.workit/data/ssh/keys/
ENV_ORDER        = ["dev", "test", "stg", "prd"]
KUBE_JSON        = DATA_DIR / "kube" / "contexts.json"
KUBE_CONFIG      = Path.home() / ".kube" / "config"   # system kubeconfig — not modified
KUBE_CONFIGS_DIR = DATA_DIR / "kube" / "configs"      # workit kubeconfigs: ~/.workit/data/kube/configs/
DOCS_DIR         = DATA_DIR / "docs"

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)

_DEFAULT_SSH_YAML = """\
version: "1.0"

defaults:
  user: ec2-user
  port: 22
  keys_dir: ~/.workit/data/ssh/keys
  key_extension: .pem
  forward_agent: false
  server_alive_interval: 60
  server_alive_count_max: 3

servers: []
"""


def _backup(src: Path, category: str = "misc", keep: int = 5) -> None:
    """Copy src to ~/.workit/backups/{category}/{filename}.backup (single overwriting backup)."""
    dest_dir = BACKUP_DIR / category
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest_dir / f"{src.name}.backup")


def _init():
    # Migrate data from old repo-relative location if running from source
    if SOURCE_DIR is not None:
        old_data = SOURCE_DIR / "data"
        _migrate_file(old_data / "ssh" / "conn_info.yaml", SSH_YAML)
        _migrate_file(old_data / "kube" / "contexts.json", KUBE_JSON)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    SSH_WORKIT_DIR.mkdir(parents=True, exist_ok=True)
    SSH_WORKIT_DIR.chmod(0o700)
    SSH_CONFS_DIR.mkdir(parents=True, exist_ok=True)
    SSH_CONFS_DIR.chmod(0o700)
    KEYS_ROOT.mkdir(parents=True, exist_ok=True)

    # Migrate conf files from old ~/.ssh/workit/ location
    _old_ssh_workit = Path.home() / ".ssh" / "workit"
    if _old_ssh_workit.exists():
        for f in _old_ssh_workit.glob("*.conf"):
            dst = SSH_CONFS_DIR / f.name
            if not dst.exists():
                shutil.copy2(f, dst)

    # Migrate conf files from old ~/.workit/data/ssh/*.conf → ~/.workit/data/ssh/configs/
    for f in SSH_WORKIT_DIR.glob("*.conf"):
        dst = SSH_CONFS_DIR / f.name
        if not dst.exists():
            shutil.copy2(f, dst)
        f.unlink()

    # Migrate SSH keys from old ~/.ssh/keys/
    _old_keys = Path.home() / ".ssh" / "keys"
    if _old_keys.exists() and not any(KEYS_ROOT.rglob("*.pem")):
        for src in _old_keys.rglob("*"):
            if src.is_file():
                rel = src.relative_to(_old_keys)
                dst = KEYS_ROOT / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                if not dst.exists():
                    shutil.copy2(src, dst)

    if not SSH_YAML.exists():
        SSH_YAML.write_text(_DEFAULT_SSH_YAML)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    ACCTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _migrate_file(Path.home() / ".workit" / "accounts" / "accounts.json", ACCTS_FILE)
    if not ACCTS_FILE.exists():
        ACCTS_FILE.write_text('{"accounts": []}')
    ACCTS_FILE.chmod(0o600)

    (DATA_DIR / "kube").mkdir(parents=True, exist_ok=True)
    if not KUBE_JSON.exists():
        KUBE_JSON.write_text('{"contexts": []}')
    KUBE_CONFIGS_DIR.mkdir(parents=True, exist_ok=True)

    # Migrate kube configs from old ~/.kube/configs/
    _old_kube_configs = Path.home() / ".kube" / "configs"
    if _old_kube_configs.exists():
        for f in _old_kube_configs.glob("*.yaml"):
            dst = KUBE_CONFIGS_DIR / f.name
            if not dst.exists():
                shutil.copy2(f, dst)

    DOCS_DIR.mkdir(parents=True, exist_ok=True)


def _migrate_file(src: Path, dst: Path):
    """Copy src → dst if src exists and dst doesn't."""
    if src.exists() and not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src), str(dst))


# ═══ SSH helpers ══════════════════════════════════════════════

def _load_ssh():
    with open(SSH_YAML) as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data.get("servers"), list):
        data["servers"] = []
    return data


def _yv(v):
    return ("true" if v else "false") if isinstance(v, bool) else str(v)


def _save_ssh(data):
    d, servers = data.get("defaults", {}), data.get("servers", [])
    by_env = {}
    for s in servers:
        by_env.setdefault(s["env"], []).append(s)

    out = ['version: "1.0"', "", "defaults:"]
    for k, v in d.items():
        out.append(f"  {k}: {_yv(v)}")
    out += ["", "servers:"]
    for env in ENV_ORDER:
        if env not in by_env:
            continue
        out.append(f"\n  # ── {env} {'─' * 50}")
        for s in by_env[env]:
            items = list(s.items())
            k0, v0 = items[0]
            out.append(f"  - {k0}: {_yv(v0)}")
            for k, v in items[1:]:
                out.append(f"    {k}: {_yv(v)}")
            out.append("")
    with open(SSH_YAML, "w") as f:
        f.write("\n".join(out) + "\n")


def _alias(project, env, role):
    return f"{project}-{env}-{role}"


def _resolve_alias(s):
    """Return the SSH Host alias: explicit 'alias' field, or computed from project/env/role."""
    return s.get("alias") or _alias(s["project"], s["env"], s.get("role", ""))


def _enrich(s, d):
    a  = _resolve_alias(s)
    e  = s["env"]
    kp = KEYS_ROOT / e / f"{a}{d.get('key_extension', '.pem')}"
    return {
        **s,
        "alias":         a,
        "user":          s.get("user",          d.get("user",          "ec2-user")),
        "port":          s.get("port",          d.get("port",          22)),
        "proxy_jump":    s.get("proxy_jump",    ""),
        "forward_agent": s.get("forward_agent", d.get("forward_agent", False)),
        "key_path":      str(kp),
        "key_exists":    kp.exists(),
        "description":   s.get("description", ""),
    }


def _save_key(kp, file=None, text=None, local_path=None):
    kp.parent.mkdir(parents=True, exist_ok=True)
    kp.parent.chmod(0o700)
    if file:
        file.save(str(kp))
    elif text:
        content = text.strip()
        if not content.endswith("\n"):
            content += "\n"
        kp.write_text(content)
    elif local_path:
        lp = Path(os.path.expanduser(local_path))
        if not lp.exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {lp}")
        if lp.resolve() != kp.resolve():
            shutil.copy2(str(lp), str(kp))
    os.chmod(str(kp), 0o600)


def _build_project_ssh_config(project, servers, d):
    """Generate SSH config block for a single project."""
    by_env = defaultdict(list)
    for s in servers:
        by_env[s["env"]].append(s)

    def rv(s, field, fallback=None):
        return s.get(field, d.get(field, fallback))

    lines = [
        f"# Workit — {project}  [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]",
        "",
    ]
    for env in ENV_ORDER:
        if env not in by_env:
            continue
        lines += [f"# ── {env} {'─' * 50}", ""]
        for s in by_env[env]:
            a  = _resolve_alias(s)
            kp = KEYS_ROOT / env / f"{a}{rv(s, 'key_extension', '.pem')}"
            fa = "yes" if rv(s, "forward_agent", False) else "no"
            lines += [
                f"# [{env}] {a}", f"Host {a}",
                f"    HostName          {s['hostname']}",
                f"    User              {rv(s, 'user', 'ec2-user')}",
                f"    Port              {rv(s, 'port', 22)}",
                f"    IdentityFile      {kp}",
                f"    IdentitiesOnly    yes",
                f"    ForwardAgent      {fa}",
                f"    ServerAliveInterval   {rv(s, 'server_alive_interval', 60)}",
                f"    ServerAliveCountMax   {rv(s, 'server_alive_count_max', 3)}",
            ]
            if s.get("proxy_jump"):
                lines.append(f"    ProxyJump         {s['proxy_jump']}")
            lines.append("")
    return "\n".join(lines) + "\n"


def _ensure_ssh_include():
    """Ensure ~/.ssh/config includes the workit conf directory."""
    new_include = "Include ~/.workit/data/ssh/configs/*.conf"
    old_includes = [
        "Include ~/.workit/data/ssh/*.conf",
        "Include ~/.ssh/workit/*.conf",
    ]
    if SSH_CONFIG.exists():
        text = SSH_CONFIG.read_text(errors="replace")
        for old in old_includes:
            if old in text:
                _backup(SSH_CONFIG, "ssh")
                SSH_CONFIG.write_text(text.replace(old, new_include))
                SSH_CONFIG.chmod(0o600)
                return
        if new_include in text:
            return
        _backup(SSH_CONFIG, "ssh")
        SSH_CONFIG.write_text(f"{new_include}\n\n{text}")
    else:
        SSH_CONFIG.write_text(f"{new_include}\n")
    SSH_CONFIG.chmod(0o600)


def _parse_ssh_host_blocks(text):
    """Parse SSH Host blocks from a config text. Returns list of host dicts (no tagging)."""
    entries, current = [], None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        lower = line.lower()
        if lower.startswith("include"):
            continue
        if lower.startswith("match"):
            if current and current.get("alias") and current["alias"] != "*":
                entries.append(current)
            current = None
            continue
        if lower.startswith("host "):
            if current and current.get("alias") and current["alias"] != "*":
                entries.append(current)
            current = {"alias": line.split(None, 1)[1].strip()}
            continue
        if current is None:
            continue
        if "=" in line:
            key, _, value = line.partition("=")
        else:
            parts = line.split(None, 1)
            key, value = parts[0], parts[1] if len(parts) > 1 else ""
        field_map = {
            "hostname": "hostname", "user": "user", "port": "port",
            "identityfile": "key_path", "proxyjump": "proxy_jump",
            "forwardagent": "forward_agent",
        }
        k = key.strip().lower()
        if k in field_map:
            current[field_map[k]] = value.strip()
    if current and current.get("alias") and current["alias"] != "*":
        entries.append(current)
    return entries


def _parse_unmanaged_ssh_hosts(registered_aliases=None):
    """Return ALL SSH hosts visible through ~/.ssh/config (direct + from Include files).

    Returns (hosts, includes):
      hosts:    list of host dicts with is_workit and source_file fields
      includes: list of {"pattern": str, "files": [str]} for each Include directive
    """
    if not SSH_CONFIG.exists():
        return [], []

    confs_dir_str = str(SSH_CONFS_DIR)
    includes = []
    direct_hosts = []
    current = None

    for raw_line in SSH_CONFIG.read_text(errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        lower = line.lower()
        if lower.startswith("include"):
            pattern_raw = line.split(None, 1)[1].strip() if len(line.split(None, 1)) > 1 else ""
            pattern_exp = str(Path(pattern_raw.replace("~", str(Path.home()))))
            expanded = sorted(str(p) for p in Path("/").glob(pattern_exp.lstrip("/"))) if pattern_exp else []
            includes.append({"pattern": pattern_raw, "files": expanded})
            continue
        if lower.startswith("match"):
            if current and current.get("alias") and current["alias"] != "*":
                direct_hosts.append(current)
            current = None
            continue
        if lower.startswith("host "):
            if current and current.get("alias") and current["alias"] != "*":
                direct_hosts.append(current)
            current = {"alias": line.split(None, 1)[1].strip()}
            continue
        if current is None:
            continue
        if "=" in line:
            key, _, value = line.partition("=")
        else:
            parts = line.split(None, 1)
            key, value = parts[0], parts[1] if len(parts) > 1 else ""
        field_map = {
            "hostname": "hostname", "user": "user", "port": "port",
            "identityfile": "key_path", "proxyjump": "proxy_jump",
            "forwardagent": "forward_agent",
        }
        k = key.strip().lower()
        if k in field_map:
            current[field_map[k]] = value.strip()

    if current and current.get("alias") and current["alias"] != "*":
        direct_hosts.append(current)

    hosts = []
    seen_aliases: set = set(registered_aliases or [])

    for h in direct_hosts:
        alias = h.get("alias", "")
        if not alias or alias == "*" or alias in seen_aliases:
            continue
        h["source_file"] = "~/.ssh/config"
        h["is_workit"] = False
        h["is_direct"] = True
        seen_aliases.add(alias)
        hosts.append(h)

    # Also parse hosts from each Include file
    for inc in includes:
        for file_path in inc["files"]:
            is_workit_file = file_path.startswith(confs_dir_str)
            if is_workit_file:
                continue
            fp = Path(file_path)
            if not fp.exists():
                continue
            try:
                file_hosts = _parse_ssh_host_blocks(fp.read_text(errors="replace"))
            except Exception:
                continue
            display_path = file_path.replace(str(Path.home()), "~")
            for h in file_hosts:
                alias = h.get("alias", "")
                if not alias or alias == "*" or alias in seen_aliases:
                    continue
                seen_aliases.add(alias)
                h["source_file"] = display_path
                h["is_workit"] = False
                h["is_direct"] = False
                hosts.append(h)

    return hosts, includes


# ═══ Settings helpers ═════════════════════════════════════════

def _load_settings():
    try:
        return json.loads(SETTINGS_FILE.read_text()) if SETTINGS_FILE.exists() else {}
    except Exception:
        return {}


def _save_settings(data):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))


# ═══ Accounts helpers ═════════════════════════════════════════

def _load_accounts():
    with open(ACCTS_FILE) as f:
        return json.load(f)


def _save_accounts(data):
    with open(ACCTS_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ═══ Kubernetes helpers ═══════════════════════════════════════

def _load_kube():
    with open(KUBE_JSON) as f:
        return json.load(f)


def _save_kube(data):
    with open(KUBE_JSON, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _kube_filename(entry):
    def s(t):
        return "".join(c if c.isalnum() or c == "-" else "-" for c in str(t).lower()).strip("-") or "ctx"
    ctx = s(entry.get("context_name") or "ctx")
    return f"{ctx}.yaml"


def _write_kube_context_file(entry):
    ctx_name = entry.get("context_name", "")
    # Use ctx_name for cluster/user names inside the file so each file has unique
    # names and won't collide when multiple configs are merged via KUBECONFIG.
    file_cl  = ctx_name or entry.get("cluster_name", "")
    file_usr = ctx_name or entry.get("user_name", "")
    cl_data  = dict(entry.get("_cluster") or {})
    if entry.get("server"):
        cl_data["server"] = entry["server"]
    raw   = dict(entry.get("_raw_ctx") or {})
    ctx_d = {k: v for k, v in raw.items() if k not in ("cluster", "user", "namespace")}
    ctx_d["cluster"] = file_cl
    ctx_d["user"]    = file_usr
    if entry.get("namespace"):
        ctx_d["namespace"] = entry["namespace"]
    elif "namespace" in raw:
        ctx_d["namespace"] = raw["namespace"]
    cfg = {
        "apiVersion":      "v1",
        "kind":            "Config",
        "preferences":     {},
        "clusters":        [{"name": file_cl, "cluster": cl_data}] if file_cl else [],
        "contexts":        [{"name": ctx_name, "context": ctx_d}],
        "current-context": ctx_name,
        "users":           [{"name": file_usr, "user": entry.get("_user") or {}}] if file_usr else [],
    }
    KUBE_CONFIGS_DIR.mkdir(parents=True, exist_ok=True)
    fpath = KUBE_CONFIGS_DIR / _kube_filename(entry)
    fpath.write_text(yaml.dump(cfg, default_flow_style=False, allow_unicode=True))
    fpath.chmod(0o600)
    return str(fpath)


def _remove_from_kube_config(ctx_name: str):
    """Remove a context (and orphaned cluster/user) from ~/.kube/config."""
    if not KUBE_CONFIG.exists() or not ctx_name:
        return
    try:
        cfg = yaml.safe_load(KUBE_CONFIG.read_text()) or {}
        contexts = cfg.get("contexts") or []
        ctx = next((c for c in contexts if (c or {}).get("name") == ctx_name), None)
        if not ctx:
            return
        cl_ref  = ((ctx.get("context") or {})).get("cluster", "")
        usr_ref = ((ctx.get("context") or {})).get("user", "")
        cfg["contexts"] = [c for c in contexts if (c or {}).get("name") != ctx_name]
        remaining_cl  = {(c.get("context") or {}).get("cluster") for c in cfg["contexts"] if c}
        remaining_usr = {(c.get("context") or {}).get("user")    for c in cfg["contexts"] if c}
        if cl_ref and cl_ref not in remaining_cl:
            cfg["clusters"] = [c for c in (cfg.get("clusters") or []) if (c or {}).get("name") != cl_ref]
        if usr_ref and usr_ref not in remaining_usr:
            cfg["users"] = [u for u in (cfg.get("users") or []) if (u or {}).get("name") != usr_ref]
        if cfg.get("current-context") == ctx_name:
            rem = cfg.get("contexts") or []
            cfg["current-context"] = rem[0]["name"] if rem else ""
        KUBE_CONFIG.write_text(yaml.dump(cfg, default_flow_style=False, allow_unicode=True))
    except Exception:
        pass


# ═══ Routes ═══════════════════════════════════════════════════

@app.route("/")
def index():
    from flask import make_response
    theme = _load_settings().get("theme", "light")
    resp  = make_response(render_template("index.html", theme=theme, version=APP_VERSION))
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/settings")
def settings_get():
    data = _load_settings()
    data["version"] = APP_VERSION
    return jsonify(data)


@app.route("/api/settings", methods=["POST"])
def settings_set():
    body = request.get_json() or {}
    data = _load_settings()
    data.update({k: v for k, v in body.items() if k in ("theme", "font_scale")})
    _save_settings(data)
    return jsonify(data)


@app.route("/api/check_update")
def check_update():
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/jbhunbb/workit/releases/latest",
            headers={"User-Agent": "Workit-App"}
        )
        with urllib.request.urlopen(req, timeout=3) as r:
            if r.status == 200:
                data = json.loads(r.read().decode())
                latest_version = data.get("tag_name", "").strip().lstrip("v")
                html_url = data.get("html_url", "")
                
                # Check version components
                has_update = False
                try:
                    curr_parts = [int(x) for x in APP_VERSION.split(".")]
                    late_parts = [int(x) for x in latest_version.split(".")]
                    if late_parts > curr_parts:
                        has_update = True
                except ValueError:
                    if latest_version and latest_version != APP_VERSION:
                        has_update = True
                        
                return jsonify({
                    "current_version": APP_VERSION,
                    "latest_version": latest_version,
                    "has_update": has_update,
                    "html_url": html_url,
                    "release_notes": data.get("body", "")
                })
    except Exception as e:
        app.logger.error(f"Failed to check update: {e}")
    return jsonify({
        "current_version": APP_VERSION,
        "latest_version": APP_VERSION,
        "has_update": False
    })


@app.route("/api/open_url", methods=["POST"])
def open_url():
    body = request.get_json() or {}
    url = body.get("url")
    if url:
        webbrowser.open(url)
        return jsonify({"ok": True})
    return jsonify({"error": "No url provided"}), 400


# ── SSH ───────────────────────────────────────────────────────

@app.route("/api/ssh/servers")
def ssh_list():
    data     = _load_ssh()
    d        = data.get("defaults", {})
    servers  = [_enrich(s, d) for s in data.get("servers", [])]
    registered_aliases = {s["alias"] for s in servers}
    unmanaged, includes = _parse_unmanaged_ssh_hosts(registered_aliases)
    return jsonify({
        "servers":   servers,
        "aliases":   [s["alias"] for s in servers],
        "unmanaged": unmanaged,
        "includes":  includes,
    })


@app.route("/api/ssh/servers", methods=["POST"])
def ssh_add():
    project     = request.form.get("project",       "").strip()
    env         = request.form.get("env",           "").strip()
    host        = request.form.get("host",          "").strip()   # full SSH alias (user-defined)
    hostname    = request.form.get("hostname",      "").strip()
    user        = request.form.get("user",          "").strip()
    port_s      = request.form.get("port",          "22").strip()
    proxy_jump  = request.form.get("proxy_jump",    "").strip()
    fwd         = request.form.get("forward_agent", "") == "true"
    description = request.form.get("description",   "").strip()
    key_file    = request.files.get("key_file")
    key_text    = request.form.get("key_text",      "").strip()
    key_lpath   = request.form.get("local_path",    "").strip()
    import_source_file = request.form.get("import_source_file", "").strip()
    import_orig_alias  = request.form.get("import_orig_alias",  "").strip()

    if not all([project, env, host, hostname]):
        return jsonify({"error": "project, env, host, hostname are required"}), 400
    if env not in ENV_ORDER:
        return jsonify({"error": f"env must be one of {ENV_ORDER}"}), 400

    data    = _load_ssh()
    d       = data.get("defaults", {})
    servers = data.get("servers", [])

    if any(_resolve_alias(s) == host for s in servers):
        return jsonify({"error": f"'{host}' already exists"}), 400

    # If registered from an unmanaged system config, remove it from that file first
    if import_source_file and import_orig_alias:
        target = Path(import_source_file.replace("~", str(Path.home())))
        if target.exists():
            try:
                text = target.read_text(errors="replace")
                new_text = _remove_ssh_host_block(text, import_orig_alias)
                if new_text != text:
                    _backup(target, "ssh")
                    target.write_text(new_text)
            except Exception as e:
                return jsonify({"error": f"Failed to remove '{import_orig_alias}' from system config: {str(e)}"}), 500

    new = {"project": project, "env": env, "alias": host, "hostname": hostname}
    if user and user != d.get("user"):
        new["user"] = user
    try:
        p = int(port_s)
        if p != int(d.get("port", 22)):
            new["port"] = p
    except (ValueError, TypeError):
        pass
    if proxy_jump:
        new["proxy_jump"] = proxy_jump
    if fwd:
        new["forward_agent"] = True
    if description:
        new["description"] = description

    has_file = key_file and key_file.filename
    if has_file or key_text or key_lpath:
        kp = KEYS_ROOT / env / f"{host}{d.get('key_extension', '.pem')}"
        try:
            _save_key(kp, file=key_file if has_file else None,
                      text=key_text or None, local_path=key_lpath or None)
        except FileNotFoundError:
            pass

    servers.append(new)
    data["servers"] = servers
    _save_ssh(data)
    return jsonify(_enrich(new, d)), 201


@app.route("/api/ssh/servers/<path:a>", methods=["PUT"])
def ssh_update(a):
    project     = request.form.get("project",       "").strip()
    env         = request.form.get("env",           "").strip()
    host        = request.form.get("host",          "").strip()   # new full alias
    hostname    = request.form.get("hostname",      "").strip()
    user        = request.form.get("user",          "").strip()
    port_s      = request.form.get("port",          "22").strip()
    proxy_jump  = request.form.get("proxy_jump",    "").strip()
    fwd         = request.form.get("forward_agent", "") == "true"
    description = request.form.get("description",   "").strip()
    key_file    = request.files.get("key_file")
    key_text    = request.form.get("key_text",      "").strip()
    key_lpath   = request.form.get("local_path",    "").strip()

    if not all([project, env, host, hostname]):
        return jsonify({"error": "project, env, host, hostname are required"}), 400
    if env not in ENV_ORDER:
        return jsonify({"error": f"env must be one of {ENV_ORDER}"}), 400

    data    = _load_ssh()
    d       = data.get("defaults", {})
    servers = data.get("servers", [])

    target_idx = next((i for i, s in enumerate(servers)
                       if _resolve_alias(s) == a), None)
    if target_idx is None:
        return jsonify({"error": "not found"}), 404

    old_server = servers[target_idx]
    new_alias  = host
    if new_alias != a:
        if any(_resolve_alias(s) == new_alias
               for i, s in enumerate(servers) if i != target_idx):
            return jsonify({"error": f"'{new_alias}' already exists"}), 400

    updated = {"project": project, "env": env, "alias": host, "hostname": hostname}
    if user and user != d.get("user"):
        updated["user"] = user
    try:
        p = int(port_s)
        if p != int(d.get("port", 22)):
            updated["port"] = p
    except (ValueError, TypeError):
        pass
    if proxy_jump:
        updated["proxy_jump"] = proxy_jump
    if fwd:
        updated["forward_agent"] = True
    if description:
        updated["description"] = description

    ext    = d.get("key_extension", ".pem")
    old_kp = KEYS_ROOT / old_server["env"] / f"{a}{ext}"
    new_kp = KEYS_ROOT / env / f"{host}{ext}"
    has_new_key = (key_file and key_file.filename) or key_text or key_lpath
    if has_new_key:
        _save_key(new_kp, file=key_file if (key_file and key_file.filename) else None,
                  text=key_text or None, local_path=key_lpath or None)
    elif old_kp != new_kp and old_kp.exists():
        new_kp.parent.mkdir(parents=True, exist_ok=True)
        new_kp.parent.chmod(0o700)
        shutil.copy2(str(old_kp), str(new_kp))
        os.chmod(str(new_kp), 0o600)

    servers[target_idx] = updated
    data["servers"]     = servers
    _save_ssh(data)
    return jsonify(_enrich(updated, d))


@app.route("/api/ssh/servers/<path:a>", methods=["DELETE"])
def ssh_delete(a):
    data     = _load_ssh()
    original = data.get("servers", [])
    data["servers"] = [s for s in original if _resolve_alias(s) != a]
    if len(data["servers"]) == len(original):
        return jsonify({"error": "not found"}), 404
    _save_ssh(data)
    return jsonify({"ok": True})


@app.route("/api/ssh/unmanaged/<path:alias>", methods=["DELETE"])
def ssh_unmanaged_delete(alias):
    """Remove a Host block from a SSH config file by alias.

    Optional JSON body: {"source_file": "~/.workit/data/ssh/configs/project.conf"}
    Defaults to ~/.ssh/config if not provided.
    """
    body = request.get_json(silent=True) or {}
    source_raw = body.get("source_file", "~/.ssh/config")
    target = Path(source_raw.replace("~", str(Path.home())))
    if not target.exists():
        return jsonify({"error": f"{source_raw} not found"}), 404
    text = target.read_text(errors="replace")
    new_text = _remove_ssh_host_block(text, alias)
    if new_text == text:
        return jsonify({"error": "host not found"}), 404
    _backup(target, "ssh")
    target.write_text(new_text)
    return jsonify({"ok": True})


def _remove_ssh_host_block(text, alias):
    """Remove a named Host block from SSH config text, preserving everything else."""
    result, current_block, current_alias = [], [], None
    for line in text.splitlines(keepends=True):
        m = re.match(r'^Host\s+(\S.*)', line, re.I)
        if m:
            if current_alias is not None:
                if current_alias != alias:
                    result.extend(current_block)
            elif current_block:
                result.extend(current_block)
            current_alias = m.group(1).strip()
            current_block = [line]
        else:
            if current_alias is not None:
                current_block.append(line)
            else:
                result.append(line)
    if current_alias is not None:
        if current_alias != alias:
            result.extend(current_block)
    elif current_block:
        result.extend(current_block)
    return ''.join(result)


@app.route("/api/ssh/servers/<path:a>/key", methods=["POST"])
def ssh_upload_key(a):
    file       = request.files.get("file")
    text       = request.form.get("text",       "").strip()
    local_path = request.form.get("local_path", "").strip()

    if not file and not text and not local_path:
        return jsonify({"error": "file, text, local_path 중 하나는 필요합니다"}), 400

    data   = _load_ssh()
    d      = data.get("defaults", {})
    target = next((s for s in data.get("servers", []) if _resolve_alias(s) == a), None)
    if not target:
        return jsonify({"error": f"'{a}' not found"}), 404

    kp = KEYS_ROOT / target["env"] / f"{a}{d.get('key_extension', '.pem')}"
    try:
        _save_key(kp, file=file if (file and file.filename) else None,
                  text=text or None, local_path=local_path or None)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True, "path": str(kp)})


@app.route("/api/ssh/keys/scan")
def ssh_scan_keys():
    home  = Path.home()
    env_q = request.args.get("env", "").strip()
    dirs  = [home / ".ssh", home / "Downloads", home / "Desktop", home / "Documents"]
    for env in ([env_q] if env_q in ENV_ORDER else ENV_ORDER):
        d = KEYS_ROOT / env
        if d.exists():
            dirs.append(d)
    found, seen = [], set()
    for d in dirs:
        if not d.exists():
            continue
        for f in sorted(f for ext in ("*.pem", "*.key") for f in d.glob(ext) if f.is_file()):
            if str(f) in seen:
                continue
            seen.add(str(f))
            found.append({"path": str(f), "name": f.name, "dir": str(f.parent).replace(str(home), "~"), "size_kb": round(f.stat().st_size / 1024, 1)})
    return jsonify({"files": found})


@app.route("/api/ssh/apply", methods=["POST"])
def ssh_apply():
    data    = _load_ssh()
    d       = data.get("defaults", {})
    servers = data.get("servers", [])

    # Group by project → one file per project in ~/.ssh/workit/
    by_project: dict = {}
    for s in servers:
        by_project.setdefault(s["project"], []).append(s)

    SSH_CONFS_DIR.mkdir(parents=True, exist_ok=True)
    SSH_CONFS_DIR.chmod(0o700)

    written: set = set()
    for project, proj_servers in by_project.items():
        content = _build_project_ssh_config(project, proj_servers, d)
        fpath   = SSH_CONFS_DIR / f"{project}.conf"
        fpath.write_text(content)
        fpath.chmod(0o600)
        written.add(project)

    # Remove stale project files that no longer have servers
    for fpath in SSH_CONFS_DIR.glob("*.conf"):
        if fpath.stem not in written:
            fpath.unlink()

    # Create key directories
    keys_root = Path(os.path.expanduser(d.get("keys_dir", "~/.workit/data/ssh/keys")))
    for env in {s["env"] for s in servers}:
        env_dir = keys_root / env
        env_dir.mkdir(parents=True, exist_ok=True)
        env_dir.chmod(0o700)

    # Ensure ~/.ssh/config has the Include line (backs up config first if needed)
    _ensure_ssh_include()

    n = len(written)
    return jsonify({"ok": True, "output": f"~/.ssh/workit/ 업데이트 완료 ({n}개 프로젝트)"})


# ── Kubernetes ────────────────────────────────────────────────

def _parse_kubeconfig(text):
    """Parse a kubeconfig YAML and return (clusters, users, contexts) dicts."""
    try:
        cfg = yaml.safe_load(text) or {}
    except Exception:
        return None, None, None
    if not isinstance(cfg, dict) or cfg.get("kind") != "Config":
        return None, None, None
    clusters = {c["name"]: c.get("cluster") or {} for c in (cfg.get("clusters") or []) if "name" in c}
    users    = {u["name"]: u.get("user")    or {} for u in (cfg.get("users")    or []) if "name" in u}
    contexts = cfg.get("contexts") or []
    return clusters, users, contexts


def _import_contexts(data, clusters, users, ctx_list, known):
    """Import contexts into data dict if not already known. Returns changed flag."""
    changed = False
    for ctx in ctx_list:
        ctx_name = ctx.get("name", "")
        if not ctx_name or ctx_name in known:
            continue
        ctx_data  = ctx.get("context") or {}
        cl_name   = ctx_data.get("cluster",   "")
        user_name = ctx_data.get("user",      "")
        namespace = ctx_data.get("namespace", "")
        cl_info   = dict(clusters.get(cl_name, {}))
        data.setdefault("contexts", []).append({
            "id":           str(uuid.uuid4()),
            "context_name": ctx_name,
            "cluster_name": cl_name,
            "user_name":    user_name,
            "namespace":    namespace,
            "server":       cl_info.get("server", ""),
            "_cluster":     cl_info,
            "_user":        dict(users.get(user_name, {})),
            "_raw_ctx":     dict(ctx_data),
            "project":      "",
            "env":          "",
            "description":  "",
        })
        known.add(ctx_name)
        changed = True
    return changed


@app.route("/api/kube/contexts")
def kube_list():
    data    = _load_kube()
    known   = {c["context_name"] for c in data.get("contexts", [])}
    changed = False

    # Always re-sync from ~/.kube/config — system-managed contexts always visible
    if KUBE_CONFIG.exists():
        clusters, users, ctx_list = _parse_kubeconfig(KUBE_CONFIG.read_text())
        if ctx_list is not None:
            changed |= _import_contexts(data, clusters, users, ctx_list, known)

    # Also import from ~/.kube/configs/*.yaml (workit-managed files)
    if KUBE_CONFIGS_DIR.exists():
        for fpath in sorted(KUBE_CONFIGS_DIR.glob("*.yaml")):
            clusters, users, ctx_list = _parse_kubeconfig(fpath.read_text())
            if ctx_list is not None:
                changed |= _import_contexts(data, clusters, users, ctx_list, known)

    if changed:
        _save_kube(data)

    return jsonify({"contexts": data.get("contexts", [])})


@app.route("/api/kube/parse", methods=["POST"])
def kube_parse():
    text = request.form.get("text", "").strip()
    f    = request.files.get("file")
    if f and f.filename:
        try:
            text = f.read().decode("utf-8")
        except Exception:
            return jsonify({"error": "파일 읽기 실패"}), 400
    if not text:
        return jsonify({"error": "내용이 없습니다"}), 400
    try:
        cfg = yaml.safe_load(text)
    except yaml.YAMLError as e:
        return jsonify({"error": f"YAML 파싱 오류: {str(e)[:200]}"}), 400
    if not isinstance(cfg, dict) or cfg.get("kind") != "Config":
        return jsonify({"error": "kubeconfig 형식이 아닙니다 (kind: Config 필요)"}), 400

    clusters = {c["name"]: c.get("cluster") or {} for c in (cfg.get("clusters") or []) if "name" in c}
    users    = {u["name"]: u.get("user")    or {} for u in (cfg.get("users")    or []) if "name" in u}
    result   = []
    for ctx in (cfg.get("contexts") or []):
        ctx_name  = ctx.get("name", "")
        ctx_data  = ctx.get("context") or {}
        cl_name   = ctx_data.get("cluster",   "")
        user_name = ctx_data.get("user",      "")
        namespace = ctx_data.get("namespace", "")
        cl_info   = dict(clusters.get(cl_name, {}))
        result.append({
            "context_name": ctx_name,
            "cluster_name": cl_name,
            "user_name":    user_name,
            "namespace":    namespace,
            "server":       cl_info.get("server", ""),
            "_cluster":     cl_info,
            "_user":        dict(users.get(user_name, {})),
            "_raw_ctx":     dict(ctx_data),
            "project":      "",
            "env":          "",
            "description":  "",
        })

    if not result:
        return jsonify({"error": "contexts를 찾을 수 없습니다"}), 400
    return jsonify({"contexts": result})


@app.route("/api/kube/contexts", methods=["POST"])
def kube_add():
    body     = request.get_json() or {}
    ctx_name = (body.get("context_name") or "").strip()
    if not ctx_name:
        return jsonify({"error": "context_name이 필요합니다"}), 400

    data = _load_kube()
    if any(c["context_name"] == ctx_name for c in data.get("contexts", [])):
        return jsonify({"error": f"'{ctx_name}' 이미 존재합니다"}), 400

    server  = (body.get("server") or "").strip()
    cl_info = dict(body.get("_cluster") or {})
    if server:
        cl_info["server"] = server

    env = (body.get("env") or "").strip()
    if env and env not in ENV_ORDER:
        env = ""

    entry = {
        "id":           str(uuid.uuid4()),
        "context_name": ctx_name,
        "cluster_name": (body.get("cluster_name") or "").strip(),
        "user_name":    (body.get("user_name")    or "").strip(),
        "namespace":    (body.get("namespace")    or "").strip(),
        "server":       server,
        "_cluster":     cl_info,
        "_user":        dict(body.get("_user") or {}),
        "_raw_ctx":     dict(body.get("_raw_ctx") or {}),
        "project":      (body.get("project") or "").strip(),
        "env":          env,
        "description":  (body.get("description") or "").strip(),
    }
    if body.get("_fromSys"):
        try:
            _remove_from_kube_config(ctx_name)
        except Exception:
            pass

    data.setdefault("contexts", []).append(entry)
    _save_kube(data)

    try:
        _write_kube_context_file(entry)
    except Exception:
        pass

    return jsonify(entry), 201


@app.route("/api/kube/contexts/<cid>", methods=["PUT"])
def kube_update(cid):
    body = request.get_json() or {}
    data = _load_kube()
    target = next((c for c in data.get("contexts", []) if c["id"] == cid), None)
    if not target:
        return jsonify({"error": "not found"}), 404

    old_filename = _kube_filename(target)

    env = (body.get("env") or "").strip()
    if env and env not in ENV_ORDER:
        env = ""

    for field in ("context_name", "cluster_name", "user_name", "namespace",
                  "server", "project", "description"):
        if field in body:
            target[field] = (body[field] or "").strip()
    target["env"] = env

    if body.get("_cluster") is not None:
        cl = dict(body["_cluster"])
        if target.get("server"):
            cl["server"] = target["server"]
        target["_cluster"] = cl
    if body.get("_user") is not None:
        target["_user"] = dict(body["_user"])
    if body.get("_raw_ctx") is not None:
        target["_raw_ctx"] = dict(body["_raw_ctx"])

    _save_kube(data)

    old_fpath = KUBE_CONFIGS_DIR / old_filename
    new_fpath = KUBE_CONFIGS_DIR / _kube_filename(target)
    if old_fpath.exists() and old_fpath.resolve() != new_fpath.resolve():
        old_fpath.unlink()
    try:
        _write_kube_context_file(target)
    except Exception:
        pass

    return jsonify(target)


@app.route("/api/kube/contexts/<cid>", methods=["DELETE"])
def kube_delete(cid):
    data = _load_kube()
    orig = data.get("contexts", [])
    target = next((c for c in orig if c["id"] == cid), None)
    if not target:
        return jsonify({"error": "not found"}), 404
    data["contexts"] = [c for c in orig if c["id"] != cid]
    _save_kube(data)

    fpath = KUBE_CONFIGS_DIR / _kube_filename(target)
    if fpath.exists():
        fpath.unlink()

    _remove_from_kube_config(target.get("context_name", ""))

    return jsonify({"ok": True})


@app.route("/api/kube/system")
def kube_system_list():
    """Return contexts directly from ~/.kube/config (read-only view, no import)."""
    if not KUBE_CONFIG.exists():
        return jsonify({"contexts": []})
    clusters, users, ctx_list = _parse_kubeconfig(KUBE_CONFIG.read_text())
    if ctx_list is None:
        return jsonify({"contexts": []})
    result = []
    for ctx in ctx_list:
        ctx_name = ctx.get("name", "")
        if not ctx_name:
            continue
        ctx_data = ctx.get("context") or {}
        cl_name  = ctx_data.get("cluster", "")
        cl_info  = (clusters or {}).get(cl_name, {})
        result.append({
            "context_name": ctx_name,
            "cluster_name": cl_name,
            "server":       cl_info.get("server", ""),
            "user_name":    ctx_data.get("user", ""),
            "namespace":    ctx_data.get("namespace", ""),
        })
    return jsonify({"contexts": result})


@app.route("/api/kube/system/<path:ctx_name>", methods=["DELETE"])
def kube_system_delete(ctx_name):
    """Remove a context (and unused cluster/user) from ~/.kube/config."""
    if not KUBE_CONFIG.exists():
        return jsonify({"error": "~/.kube/config not found"}), 404
    cfg = yaml.safe_load(KUBE_CONFIG.read_text()) or {}
    contexts = cfg.get("contexts") or []
    target = next((c for c in contexts if c.get("name") == ctx_name), None)
    if not target:
        return jsonify({"error": "context not found"}), 404

    cfg["contexts"] = [c for c in contexts if c.get("name") != ctx_name]

    ctx_data  = target.get("context") or {}
    cl_name   = ctx_data.get("cluster", "")
    user_name = ctx_data.get("user", "")
    remaining_clusters = {(c.get("context") or {}).get("cluster") for c in cfg["contexts"]}
    remaining_users    = {(c.get("context") or {}).get("user")    for c in cfg["contexts"]}
    if cl_name and cl_name not in remaining_clusters:
        cfg["clusters"] = [c for c in (cfg.get("clusters") or []) if c.get("name") != cl_name]
    if user_name and user_name not in remaining_users:
        cfg["users"] = [u for u in (cfg.get("users") or []) if u.get("name") != user_name]

    _backup(KUBE_CONFIG, "kube")
    KUBE_CONFIG.write_text(yaml.dump(cfg, default_flow_style=False, allow_unicode=True))
    return jsonify({"ok": True})


@app.route("/api/kube/apply", methods=["POST"])
def kube_apply():
    workit_ctxs = _load_kube().get("contexts", [])
    KUBE_CONFIGS_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for c in workit_ctxs:
        try:
            _write_kube_context_file(c)
            written += 1
        except Exception:
            pass
    return jsonify({"ok": True, "output": f"~/.kube/configs/ 저장 완료 ({written}개 파일)"})


# ── Accounts ──────────────────────────────────────────────────

@app.route("/api/accounts")
def accts_list():
    return jsonify(_load_accounts())


@app.route("/api/accounts", methods=["POST"])
def accts_add():
    body = request.get_json() or {}
    data = _load_accounts()
    new  = {
        "id":       str(uuid.uuid4()),
        "name":     body.get("name",     "").strip(),
        "category": body.get("category", "기타").strip(),
        "username": body.get("username", "").strip(),
        "password": body.get("password", "").strip(),
        "url":      body.get("url",      "").strip(),
        "notes":    body.get("notes",    "").strip(),
    }
    if not new["name"]:
        return jsonify({"error": "name is required"}), 400
    data["accounts"].append(new)
    _save_accounts(data)
    return jsonify(new), 201


@app.route("/api/accounts/<aid>", methods=["PUT"])
def accts_update(aid):
    body = request.get_json() or {}
    data = _load_accounts()
    for a in data["accounts"]:
        if a["id"] == aid:
            for f in ("name", "category", "username", "password", "url", "notes"):
                if f in body:
                    a[f] = body[f]
            _save_accounts(data)
            return jsonify(a)
    return jsonify({"error": "not found"}), 404


@app.route("/api/accounts/<aid>", methods=["DELETE"])
def accts_delete(aid):
    data = _load_accounts()
    orig = data["accounts"]
    data["accounts"] = [a for a in orig if a["id"] != aid]
    if len(data["accounts"]) == len(orig):
        return jsonify({"error": "not found"}), 404
    _save_accounts(data)
    return jsonify({"ok": True})


# ═══ Docs helpers ═════════════════════════════════════════════

def _parse_doc(text):
    """Return (frontmatter_dict, markdown_content) from a doc file."""
    if not text.startswith('---'):
        return {}, text
    try:
        idx = text.index('\n---', 3)
        front = yaml.safe_load(text[3:idx]) or {}
        return front, text[idx + 4:].lstrip('\n')
    except (ValueError, yaml.YAMLError):
        return {}, text


def _format_doc(title, urls, content):
    front = {'title': title}
    valid = [u for u in (urls or []) if isinstance(u, str) and u.strip()]
    if valid:
        front['urls'] = valid
    return "---\n" + yaml.dump(front, allow_unicode=True, default_flow_style=False).strip() + "\n---\n\n" + content


# ═══ Docs routes ══════════════════════════════════════════════

@app.route('/api/docs', methods=['GET'])
def docs_list():
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    docs = []
    for f in sorted(DOCS_DIR.glob('*.md'), key=lambda p: p.stat().st_mtime, reverse=True):
        text = f.read_text(encoding='utf-8')
        front, content = _parse_doc(text)
        docs.append({
            'id': f.stem,
            'title': front.get('title') or f.stem,
            'urls': front.get('urls') or [],
            'preview': content[:100].replace('\n', ' ').strip(),
            'updated_at': int(f.stat().st_mtime),
        })
    return jsonify(docs)


@app.route('/api/docs/<doc_id>', methods=['GET'])
def docs_get(doc_id):
    path = DOCS_DIR / f"{doc_id}.md"
    if not path.exists():
        return jsonify({'error': 'not found'}), 404
    text = path.read_text(encoding='utf-8')
    front, content = _parse_doc(text)
    return jsonify({'id': doc_id, 'title': front.get('title') or doc_id,
                    'urls': front.get('urls') or [], 'content': content})


@app.route('/api/docs', methods=['POST'])
def docs_create():
    data = request.get_json() or {}
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    (DOCS_DIR / f"{doc_id}.md").write_text(
        _format_doc(data.get('title', '제목 없음'), data.get('urls', []), data.get('content', '')),
        encoding='utf-8')
    return jsonify({'id': doc_id}), 201


@app.route('/api/docs/<doc_id>', methods=['PUT'])
def docs_update(doc_id):
    path = DOCS_DIR / f"{doc_id}.md"
    if not path.exists():
        return jsonify({'error': 'not found'}), 404
    existing_front, existing_content = _parse_doc(path.read_text(encoding='utf-8'))
    data = request.get_json() or {}
    path.write_text(_format_doc(
        data.get('title', existing_front.get('title', '')),
        data.get('urls', existing_front.get('urls', [])),
        data.get('content', existing_content),
    ), encoding='utf-8')
    return jsonify({'ok': True})


@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def docs_delete(doc_id):
    path = DOCS_DIR / f"{doc_id}.md"
    if path.exists():
        path.unlink()
    return jsonify({'ok': True})


# ═══ Entry ════════════════════════════════════════════════════

if __name__ == "__main__":
    _init()
    port  = int(os.environ.get("WORKIT_PORT", 5010))
    debug = "--debug" in sys.argv
    if not debug:
        print(f"  Workit  →  http://localhost:{port}")
    app.run(debug=debug, port=port, host="127.0.0.1")
