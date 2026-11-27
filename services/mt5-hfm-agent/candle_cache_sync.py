"""
Bounded candle-cache ordering helpers for HFM MT5 Agent.

Pure functions (no Wine I/O) so unit tests can validate stale/duplicate rejection
without a live terminal.
"""
from __future__ import annotations

from typing import Any


def coerce_seq(value: Any) -> int | None:
    if value is None:
        return None
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


def should_accept_incoming_snapshot(
    *,
    incoming_seq: Any,
    existing_seq: Any,
    incoming_mtime: float | None = None,
    existing_mtime: float | None = None,
) -> tuple[bool, str]:
    """
    Decide whether an incoming periodic dump may replace the Agent candle cache.

    Rules:
    - Higher seq always wins.
    - Equal seq is idempotent accept (refresh cachedAt / rewrite ok).
    - Lower seq is rejected (stale / out-of-order).
    - If either seq is missing, fall back to mtime (newer or equal wins).
    - If neither seq nor mtime is usable, accept (bootstrap).
    """
    inc = coerce_seq(incoming_seq)
    cur = coerce_seq(existing_seq)
    if inc is not None and cur is not None:
        if inc < cur:
            return False, "REJECT_OLDER_SEQ"
        if inc == cur:
            return True, "ACCEPT_SAME_SEQ_IDEMPOTENT"
        return True, "ACCEPT_NEWER_SEQ"
    if inc is not None and cur is None:
        return True, "ACCEPT_BOOTSTRAP_SEQ"
    if inc is None and cur is not None:
        # Incoming without seq must not clobber a sequenced cache unless clearly newer by mtime.
        if (
            isinstance(incoming_mtime, (int, float))
            and isinstance(existing_mtime, (int, float))
            and incoming_mtime > existing_mtime
        ):
            return True, "ACCEPT_NEWER_MTIME_NO_SEQ"
        return False, "REJECT_UNSEQUENCED_OVER_SEQUENCED"
    if (
        isinstance(incoming_mtime, (int, float))
        and isinstance(existing_mtime, (int, float))
    ):
        if incoming_mtime < existing_mtime:
            return False, "REJECT_OLDER_MTIME"
        return True, "ACCEPT_MTIME"
    return True, "ACCEPT_BOOTSTRAP"


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
