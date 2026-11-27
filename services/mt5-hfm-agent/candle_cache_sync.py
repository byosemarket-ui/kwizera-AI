"""
Bounded candle-cache ordering helpers for HFM MT5 Agent.

Pure functions (no Wine I/O) so unit tests can validate stale/duplicate rejection
without a live terminal.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def coerce_seq(value: Any) -> int | None:
    if value is None:
        return None
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


def parse_observation_epoch(value: Any) -> float | None:
    """Parse cachedAt / retrievedAt strings (ISO or MQL `YYYY.MM.DD HH:MM:SSZ`) to epoch seconds."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    # MQL Expert: "2026.11.27 16:53:36Z"
    if len(s) >= 19 and s[4] == "." and s[7] == ".":
        try:
            body = s.replace("Z", "").replace("z", "").strip()
            dt = datetime.strptime(body, "%Y.%m.%d %H:%M:%S").replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except ValueError:
            pass
    # ISO: "2026-11-27T16:39:46Z"
    try:
        iso = s.replace("Z", "+00:00").replace("z", "+00:00")
        return datetime.fromisoformat(iso).timestamp()
    except ValueError:
        return None


def should_accept_incoming_snapshot(
    *,
    incoming_seq: Any,
    existing_seq: Any,
    incoming_mtime: float | None = None,
    existing_mtime: float | None = None,
    incoming_observed_at: Any = None,
    existing_observed_at: Any = None,
) -> tuple[bool, str]:
    """
    Decide whether an incoming periodic dump may replace the Agent candle cache.

    Rules:
    - Higher seq always wins.
    - Equal seq is idempotent accept (refresh cachedAt / rewrite ok).
    - Lower seq is rejected UNLESS observation time proves an Expert restart
      (incoming observation strictly newer than existing) → ACCEPT_SEQ_RESET_NEWER_OBS.
    - If either seq is missing, fall back to mtime / observation (newer or equal wins).
    - If neither seq nor mtime is usable, accept (bootstrap).
    """
    inc = coerce_seq(incoming_seq)
    cur = coerce_seq(existing_seq)
    obs_in = parse_observation_epoch(incoming_observed_at)
    obs_ex = parse_observation_epoch(existing_observed_at)
    if obs_in is None and isinstance(incoming_mtime, (int, float)):
        obs_in = float(incoming_mtime)
    if obs_ex is None and isinstance(existing_mtime, (int, float)):
        obs_ex = float(existing_mtime)

    if inc is not None and cur is not None:
        if inc < cur:
            # Expert seq counters reset on MT5 restart; wall-clock observation is authoritative.
            if obs_in is not None and obs_ex is not None and obs_in > obs_ex + 0.5:
                return True, "ACCEPT_SEQ_RESET_NEWER_OBS"
            return False, "REJECT_OLDER_SEQ"
        if inc == cur:
            return True, "ACCEPT_SAME_SEQ_IDEMPOTENT"
        return True, "ACCEPT_NEWER_SEQ"
    if inc is not None and cur is None:
        return True, "ACCEPT_BOOTSTRAP_SEQ"
    if inc is None and cur is not None:
        # Incoming without seq must not clobber a sequenced cache unless clearly newer by obs/mtime.
        if obs_in is not None and obs_ex is not None and obs_in > obs_ex:
            return True, "ACCEPT_NEWER_MTIME_NO_SEQ"
        return False, "REJECT_UNSEQUENCED_OVER_SEQUENCED"
    if obs_in is not None and obs_ex is not None:
        if obs_in < obs_ex:
            return False, "REJECT_OLDER_MTIME"
        return True, "ACCEPT_MTIME"
    return True, "ACCEPT_BOOTSTRAP"


def merge_candle_maps(
    existing: Any,
    incoming: Any,
) -> dict[str, Any]:
    """
    Merge symbol/timeframe candle maps so a partial dump cannot erase unrelated valid entries.
    Incoming bars replace the same symbol+timeframe key; other keys are preserved.
    """
    out: dict[str, Any] = {}
    if isinstance(existing, dict):
        for sym, tfs in existing.items():
            if isinstance(sym, str) and isinstance(tfs, dict):
                out[sym] = dict(tfs)
    if not isinstance(incoming, dict):
        return out
    for sym, tfs in incoming.items():
        if not isinstance(sym, str) or not isinstance(tfs, dict):
            continue
        base = dict(out.get(sym) or {})
        for tf, bars in tfs.items():
            if isinstance(tf, str):
                base[tf] = bars
        out[sym] = base
    return out


def snapshot_is_well_formed(candles_by_symbol: Any) -> bool:
    if not isinstance(candles_by_symbol, dict) or not candles_by_symbol:
        return False
    for sym, tfs in candles_by_symbol.items():
        if not isinstance(sym, str) or not sym:
            return False
        if not isinstance(tfs, dict) or not tfs:
            continue
        for tf, bars in tfs.items():
            if not isinstance(tf, str) or not tf:
                return False
            if bars is None:
                return False
            if isinstance(bars, list):
                for bar in bars[:3]:
                    if not isinstance(bar, dict):
                        return False
                    for k in ("time", "open", "high", "low", "close"):
                        if k not in bar:
                            return False
    return True
