#!/usr/bin/env bash
# Phase 36A — Provision ForexConnect sidecar runtime on the VPS.
# Installs a dedicated Python 3.7 venv (official linux wheels are cp35–cp37),
# verifies import as the service user, writes a safe runtime probe, and only
# then enables KWIZERA_FOREXCONNECT_ENABLED=1.
#
# Never prints or writes FXCM passwords. Safe to run from update-from-github.sh.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_DIR="${APP_DIR:-/opt/kwizera-ai}"
SERVICE_USER="${SERVICE_USER:-kwizera}"
SIDECAR_DIR="${APP_DIR}/services/forexconnect-sidecar"
VENV_DIR="${SIDECAR_DIR}/.venv"
ENV_FILE="${APP_DIR}/.env"
STORAGE_ROOT="${KWIZERA_STORAGE_ROOT:-/var/lib/kwizera-ai-studio}"
PROBE_DIR="${STORAGE_ROOT}/forexconnect"
PROBE_FILE="${PROBE_DIR}/runtime-probe.json"
FC_VERSION="${KWIZERA_FOREXCONNECT_PIP_VERSION:-1.6.43}"

mkdir -p "$PROBE_DIR"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$PROBE_DIR" 2>/dev/null || true

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip("\n")))' <<<"$1"
}

write_probe() {
  local ready="$1"
  local enabled_allowed="$2"
  local python_bin="$3"
  local sdk_ok="$4"
  local sdk_version="$5"
  local import_error="$6"
  local note="$7"
  local os_name arch python_sys python37
  os_name="$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"
  arch="$(uname -m 2>/dev/null || echo unknown)"
  python_sys="$(python3 --version 2>&1 || echo unknown)"
  python37="$(command -v python3.7 >/dev/null && python3.7 --version 2>&1 || echo missing)"
  local checked
  checked="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat >"$PROBE_FILE" <<EOF
{
  "ok": true,
  "provider": "FOREXCONNECT",
  "checkedAt": $(json_escape "$checked"),
  "os": $(json_escape "$os_name"),
  "kernel": $(json_escape "$(uname -r 2>/dev/null || echo unknown)"),
  "arch": $(json_escape "$arch"),
  "systemPython": $(json_escape "$python_sys"),
  "sidecarPython": $(json_escape "$python37"),
  "venvPython": $(json_escape "$python_bin"),
  "sdkPackage": "forexconnect",
  "sdkVersionRequested": $(json_escape "$FC_VERSION"),
  "sdkVersionInstalled": $(json_escape "$sdk_version"),
  "sdkImportOk": $([[ "$sdk_ok" == "true" ]] && echo true || echo false),
  "sdkImportError": $(json_escape "$import_error"),
  "runtimeReady": $([[ "$ready" == "true" ]] && echo true || echo false),
  "enableAllowed": $([[ "$enabled_allowed" == "true" ]] && echo true || echo false),
  "sidecarBind": "127.0.0.1:5179",
  "serviceUser": $(json_escape "$SERVICE_USER"),
  "note": $(json_escape "$note")
}
EOF
  chown "${SERVICE_USER}:${SERVICE_USER}" "$PROBE_FILE" 2>/dev/null || true
  chmod 644 "$PROBE_FILE" || true
}

upsert_env_enabled() {
  local value="$1"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE" || true
  if grep -Eq '^[[:space:]]*KWIZERA_FOREXCONNECT_ENABLED[[:space:]]*=' "$ENV_FILE"; then
    # Preserve surrounding .env; never rewrite credential lines.
    sed -i -E "s|^[[:space:]]*KWIZERA_FOREXCONNECT_ENABLED[[:space:]]*=.*$|KWIZERA_FOREXCONNECT_ENABLED=${value}|" "$ENV_FILE"
  else
    printf '\n# Phase 36A — ForexConnect sidecar enablement (credentials via Admin profiles)\nKWIZERA_FOREXCONNECT_ENABLED=%s\n' "$value" >>"$ENV_FILE"
  fi
}

disable_env_enabled() {
  upsert_env_enabled "0"
}

ensure_python37() {
  if command -v python3.7 >/dev/null 2>&1; then
    echo "[KWIZERA] python3.7 present: $(python3.7 --version 2>&1)"
    return 0
  fi
  echo "[KWIZERA] python3.7 missing — attempting install (official ForexConnect linux wheels are cp35–cp37)"
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "[KWIZERA] apt-get unavailable; cannot install python3.7" >&2
    return 1
  fi
  apt-get update -y >/dev/null
  if apt-get install -y python3.7 python3.7-venv python3.7-dev 2>/dev/null; then
    echo "[KWIZERA] installed python3.7 from distro packages"
    return 0
  fi
  if command -v add-apt-repository >/dev/null 2>&1; then
    add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1 || true
    apt-get update -y >/dev/null || true
    if apt-get install -y python3.7 python3.7-venv python3.7-dev 2>/dev/null; then
      echo "[KWIZERA] installed python3.7 from deadsnakes"
      return 0
    fi
  fi
  echo "[KWIZERA] failed to install python3.7" >&2
  return 1
}

install_venv_and_sdk() {
  local py="$1"
  rm -rf "$VENV_DIR"
  "$py" -m venv "$VENV_DIR"
  # shellcheck disable=SC1091
  source "${VENV_DIR}/bin/activate"
  python -m pip install --upgrade pip wheel setuptools >/dev/null
  # Official Gehtsoft package + documented runtime deps (numpy/pandas).
  # Do not claim success from pip alone — import is verified below.
  if ! python -m pip install "forexconnect==${FC_VERSION}"; then
    echo "[KWIZERA] pip install forexconnect==${FC_VERSION} failed" >&2
    deactivate || true
    return 1
  fi
  # Prefer package-bundled requirements when present.
  local req=""
  req="$(find "${VENV_DIR}/lib" -path '*/forexconnect/*requirements.txt' 2>/dev/null | head -n 1 || true)"
  if [[ -n "$req" && -f "$req" ]]; then
    echo "[KWIZERA] installing ForexConnect requirements from ${req}"
    python -m pip install -r "$req" || true
  fi
  # Documented pins from Gehtsoft forexconnect README.
  if ! python -m pip install \
      "numpy==1.14.5" \
      "pandas==0.23.4" \
      "python-dateutil==2.7.3" \
      "pytz==2018.5" \
      "six==1.11.0"; then
    echo "[KWIZERA] pinned ForexConnect deps failed — trying compatible numpy/pandas for cp37" >&2
    if ! python -m pip install "numpy<1.22" "pandas<1.4" "python-dateutil" "pytz" "six"; then
      echo "[KWIZERA] numpy/pandas install failed" >&2
      deactivate || true
      return 1
    fi
  fi
  deactivate || true
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$VENV_DIR"
  return 0
}

test_import_as_service_user() {
  local out ec
  set +e
  out="$(su -s /bin/bash "$SERVICE_USER" -c "\"${VENV_DIR}/bin/python\" -c \"import forexconnect; from forexconnect import ForexConnect; print(getattr(forexconnect, '__version__', 'installed'))\"" 2>&1)"
  ec=$?
  set -e
  if [[ "$ec" -ne 0 ]]; then
    IMPORT_ERROR="$out"
    SDK_VERSION=""
    return 1
  fi
  SDK_VERSION="$(printf '%s' "$out" | tail -n 1 | tr -d '\r')"
  IMPORT_ERROR=""
  return 0
}

echo "[KWIZERA] ForexConnect provision starting"
echo "[KWIZERA] host=$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}") arch=$(uname -m) kernel=$(uname -r)"
echo "[KWIZERA] systemPython=$(python3 --version 2>&1 || true)"

if [[ ! -d "$SIDECAR_DIR" ]]; then
  write_probe false false "" false "" "sidecar directory missing" "Sidecar source not found at ${SIDECAR_DIR}"
  disable_env_enabled
  echo "[KWIZERA] ForexConnect provision failed: missing sidecar dir" >&2
  exit 0
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  write_probe false false "" false "" "service user missing" "Service user ${SERVICE_USER} does not exist"
  disable_env_enabled
  echo "[KWIZERA] ForexConnect provision failed: missing user ${SERVICE_USER}" >&2
  exit 0
fi

if ! ensure_python37; then
  write_probe false false "" false "" "python3.7 unavailable" \
    "Official ForexConnect PyPI wheels target Python 3.5–3.7 on Linux. Install python3.7 (deadsnakes) or provide a compatible wheel, then redeploy."
  disable_env_enabled
  echo "[KWIZERA] ForexConnect left DISABLED — python3.7 unavailable"
  exit 0
fi

if ! install_venv_and_sdk "$(command -v python3.7)"; then
  write_probe false false "${VENV_DIR}/bin/python" false "" "pip install failed" \
    "pip could not install forexconnect==${FC_VERSION} for this host. Check wheel/platform compatibility."
  disable_env_enabled
  echo "[KWIZERA] ForexConnect left DISABLED — pip install failed"
  exit 0
fi

IMPORT_ERROR=""
SDK_VERSION=""
if ! test_import_as_service_user; then
  write_probe false false "${VENV_DIR}/bin/python" false "" "${IMPORT_ERROR}" \
    "forexconnect package installed but import failed under user ${SERVICE_USER}. Native libraries may be incompatible with this OS/arch."
  disable_env_enabled
  echo "[KWIZERA] ForexConnect left DISABLED — SDK import failed under ${SERVICE_USER}"
  printf '%s\n' "$IMPORT_ERROR" | sed 's/\(password\|passwd\|pwd\)[=:][^ ]*/\1=[redacted]/gi' | head -c 500 >&2 || true
  exit 0
fi

# Runtime is ready — enable flag only now.
upsert_env_enabled "1"
write_probe true true "${VENV_DIR}/bin/python" true "${SDK_VERSION}" "" \
  "SDK import verified as ${SERVICE_USER}. Sidecar may start on 127.0.0.1:5179. Enter DEMO credentials in Forex Admin (not .env)."

echo "[KWIZERA] ForexConnect SDK import OK version=${SDK_VERSION}"
echo "[KWIZERA] KWIZERA_FOREXCONNECT_ENABLED=1 set (credentials remain Admin-profile based)"
exit 0
