"""
Phase 58.1 — DEMO-only ForexConnect mutation helpers.

Uses documented ForexConnect 1.6 APIs:
  fx.create_order_request(...) + fx.send_request(request)
  TRUE_MARKET_OPEN / TRUE_MARKET_CLOSE (Gehtsoft samples OpenPosition.py / ClosePosition.py)

LIVE sessions are always rejected. Mutations remain disabled unless
KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 and a shared secret is presented.
"""
from __future__ import annotations

import os
import threading
from typing import Any, Callable, Optional


def _env(name: str, default: str = "") -> str:
    return str(os.environ.get(name, default) or "").strip()


def mutation_enabled() -> bool:
    return _env("KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION", "").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def verify_mutation_secret(header_value: Optional[str]) -> bool:
    expected = _env("KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET")
    if not expected:
        return False
    provided = str(header_value or "").strip()
    return bool(provided) and provided == expected


def sdk_capability_probe() -> dict[str, Any]:
    """Read-only introspection of installed forexconnect mutation surface."""
    out: dict[str, Any] = {
        "ok": True,
        "sdkImportOk": False,
        "hasCreateOrderRequest": False,
        "hasSendRequest": False,
        "trueMarketOpen": None,
        "trueMarketClose": None,
        "ordersConstants": [],
        "mutationEnvEnabled": mutation_enabled(),
        "mutationSecretConfigured": bool(_env("KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET")),
        "note": "Probe only — no broker request sent.",
    }
    try:
        from forexconnect import ForexConnect, fxcorepy  # type: ignore

        out["sdkImportOk"] = True
        out["hasCreateOrderRequest"] = callable(getattr(ForexConnect, "create_order_request", None))
        # Instance methods exist on ForexConnect instances; check class/dict too.
        sample = getattr(ForexConnect, "send_request", None)
        out["hasSendRequest"] = sample is not None or hasattr(ForexConnect, "send_request")
        orders = getattr(getattr(fxcorepy, "Constants", None), "Orders", None)
        if orders is not None:
            names = []
            for name in dir(orders):
                if name.startswith("_"):
                    continue
                names.append(name)
                if name == "TRUE_MARKET_OPEN":
                    out["trueMarketOpen"] = getattr(orders, name, None)
                if name == "TRUE_MARKET_CLOSE":
                    out["trueMarketClose"] = getattr(orders, name, None)
            out["ordersConstants"] = sorted(names)[:80]
            out["hasCreateOrderRequest"] = True  # documented on ForexConnect instances
            out["hasSendRequest"] = True
    except Exception as exc:
        out["ok"] = False
        out["error"] = str(exc)[:240]
    return out


def _reject(code: str, message: str, **extra: Any) -> dict[str, Any]:
    return {
        "ok": False,
        "code": code,
        "error": {"code": code, "message": message},
        "mutatesBroker": False,
        "environment": "demo",
        **extra,
    }


def gate_demo_mutation(
    *,
    session_environment: Optional[str],
    status: str,
    secret_header: Optional[str],
) -> Optional[dict[str, Any]]:
    if not mutation_enabled():
        return _reject(
            "DEMO_MUTATION_DISABLED",
            "Sidecar DEMO mutation is disabled. Set KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 to enable.",
        )
    if not verify_mutation_secret(secret_header):
        return _reject(
            "DEMO_MUTATION_UNAUTHORIZED",
            "Missing or invalid DEMO mutation secret.",
        )
    env = str(session_environment or "").strip().lower()
    if env in ("real", "live", "production", "prod"):
        return _reject(
            "LIVE_MUTATION_FORBIDDEN",
            "LIVE/Real ForexConnect sessions cannot mutate in Phase 58.1.",
            environment=env,
        )
    if env != "demo":
        return _reject(
            "ENVIRONMENT_UNVERIFIED",
            "Session environment must be verified DEMO before mutation.",
            environment=env or None,
        )
    if status != "CONNECTED":
        return _reject(
            "SESSION_NOT_CONNECTED",
            f"ForexConnect status is {status}; CONNECTED DEMO session required.",
        )
    return None


def open_true_market(
    fx: Any,
    *,
    instrument: str,
    buy_sell: str,
    lots: int,
    account_id: Optional[str],
    wait_seconds: float = 30.0,
) -> dict[str, Any]:
    """TRUE_MARKET_OPEN per Gehtsoft OpenPosition.py sample."""
    from forexconnect import ForexConnect, Common, fxcorepy  # type: ignore

    instrument = str(instrument or "").strip()
    direction = str(buy_sell or "").strip().upper()
    if direction in ("BUY", "B"):
        buy_sell_const = fxcorepy.Constants.BUY
        direction_out = "BUY"
    elif direction in ("SELL", "S"):
        buy_sell_const = fxcorepy.Constants.SELL
        direction_out = "SELL"
    else:
        return _reject("INVALID_DIRECTION", "buySell must be BUY or SELL.")

    if not instrument:
        return _reject("INVALID_INSTRUMENT", "instrument is required.")
    if not isinstance(lots, int) or lots < 1 or lots > 50:
        return _reject("INVALID_LOTS", "lots must be an integer between 1 and 50 for DEMO tests.")

    account = Common.get_account(fx, account_id) if account_id else Common.get_account(fx, None)
    if not account:
        return _reject("ACCOUNT_NOT_FOUND", "No valid ForexConnect account for mutation.")
    str_account = str(account.account_id)

    offer = Common.get_offer(fx, instrument)
    if not offer:
        return _reject("INSTRUMENT_NOT_FOUND", f"Instrument '{instrument}' not found in Offers.")

    trading_settings_provider = fx.login_rules.trading_settings_provider
    base_unit_size = int(trading_settings_provider.get_base_unit_size(instrument, account))
    amount = int(base_unit_size) * int(lots)
    if amount <= 0:
        return _reject("INVALID_AMOUNT", "Computed amount must be positive.")

    market_open = fxcorepy.Constants.Orders.TRUE_MARKET_OPEN
    request = fx.create_order_request(
        order_type=market_open,
        ACCOUNT_ID=str_account,
        BUY_SELL=buy_sell_const,
        AMOUNT=amount,
        SYMBOL=offer.instrument,
    )
    if request is None:
        return _reject("REQUEST_CREATE_FAILED", "create_order_request returned None.")

    order_id: Optional[str] = None
    trade_snapshot: Optional[dict[str, Any]] = None
    event = threading.Event()

    def on_added_trade(_a: Any, _b: Any, trade_row: Any) -> None:
        nonlocal trade_snapshot
        try:
            if order_id and str(getattr(trade_row, "open_order_id", "")) == str(order_id):
                trade_snapshot = {
                    "tradeId": str(getattr(trade_row, "trade_id", "")),
                    "amount": int(getattr(trade_row, "amount", 0) or 0),
                    "openRate": float(getattr(trade_row, "open_rate", 0) or 0),
                    "buySell": str(getattr(trade_row, "buy_sell", "")),
                    "instrument": str(getattr(trade_row, "instrument", instrument)),
                    "openOrderId": str(getattr(trade_row, "open_order_id", "")),
                }
                event.set()
        except Exception:
            pass

    trades_table = fx.get_table(ForexConnect.TRADES)
    listener = Common.subscribe_table_updates(trades_table, on_add_callback=on_added_trade)
    try:
        resp = fx.send_request(request)
        order_id = str(getattr(resp, "order_id", "") or "")
        if not order_id:
            return _reject(
                "BROKER_ACK_MISSING_ORDER_ID",
                "send_request returned without order_id.",
                mutatesBroker=True,
            )
        event.wait(max(1.0, float(wait_seconds)))
        return {
            "ok": True,
            "code": "SUBMITTED" if trade_snapshot else "ACCEPTED_PENDING_OR_TIMEOUT",
            "mutatesBroker": True,
            "environment": "demo",
            "brokerOrderId": order_id,
            "accountIdMasked": "***" + str_account[-4:] if len(str_account) > 4 else "***",
            "instrument": instrument,
            "direction": direction_out,
            "lots": lots,
            "amount": amount,
            "baseUnitSize": base_unit_size,
            "trade": trade_snapshot,
            "fillConfirmed": bool(trade_snapshot),
            "note": (
                "Broker TRUE_MARKET_OPEN submitted. "
                + ("Trade row observed." if trade_snapshot else "Trade row not observed before wait timeout — reconcile via /trades.")
            ),
        }
    except Exception as exc:
        return _reject(
            "BROKER_SUBMIT_FAILED",
            str(exc)[:400],
            mutatesBroker=True,
            brokerOrderId=order_id,
        )
    finally:
        try:
            listener.unsubscribe()
        except Exception:
            pass


def close_true_market(
    fx: Any,
    *,
    trade_id: str,
    instrument: Optional[str] = None,
    account_id: Optional[str] = None,
    wait_seconds: float = 30.0,
) -> dict[str, Any]:
    """TRUE_MARKET_CLOSE for an exact trade_id (Gehtsoft ClosePosition.py)."""
    from forexconnect import ForexConnect, Common, fxcorepy  # type: ignore

    trade_id = str(trade_id or "").strip()
    if not trade_id:
        return _reject("TRADE_ID_REQUIRED", "tradeId is required for close.")

    account = Common.get_account(fx, account_id) if account_id else Common.get_account(fx, None)
    if not account:
        return _reject("ACCOUNT_NOT_FOUND", "No valid ForexConnect account for close.")
    str_account = str(account.account_id)

    trades_table = fx.get_table(ForexConnect.TRADES)
    target = None
    for row in trades_table:
        if str(getattr(row, "trade_id", "")) == trade_id:
            target = row
            break
    if target is None:
        return _reject(
            "TRADE_NOT_FOUND",
            f"Open trade '{trade_id}' not found — reconcile before retrying close.",
        )

    row_account = str(getattr(target, "account_id", str_account))
    if row_account and row_account != str_account:
        return _reject("ACCOUNT_MISMATCH", "Trade account does not match session account.")

    offer_instrument = str(instrument or getattr(target, "instrument", "") or "").strip()
    offer = Common.get_offer(fx, offer_instrument) if offer_instrument else None
    if not offer:
        # Fallback: match by offer_id on trade
        offer_id = getattr(target, "offer_id", None)
        offers = fx.get_table(ForexConnect.OFFERS)
        for o in offers:
            if str(getattr(o, "offer_id", "")) == str(offer_id):
                offer = o
                break
    if not offer:
        return _reject("INSTRUMENT_NOT_FOUND", "Cannot resolve offer for close.")

    buy = fxcorepy.Constants.BUY
    sell = fxcorepy.Constants.SELL
    trade_side = getattr(target, "buy_sell", None)
    buy_sell = sell if trade_side == buy else buy
    amount = int(getattr(target, "amount", 0) or 0)
    if amount <= 0:
        return _reject("INVALID_AMOUNT", "Trade amount is not positive.")

    request = fx.create_order_request(
        order_type=fxcorepy.Constants.Orders.TRUE_MARKET_CLOSE,
        OFFER_ID=offer.offer_id,
        ACCOUNT_ID=str_account,
        BUY_SELL=buy_sell,
        AMOUNT=amount,
        TRADE_ID=trade_id,
    )
    if request is None:
        return _reject("REQUEST_CREATE_FAILED", "create_order_request returned None for close.")

    close_order_id: Optional[str] = None
    closed_snapshot: Optional[dict[str, Any]] = None
    event = threading.Event()

    def on_added_closed(_a: Any, _b: Any, closed_row: Any) -> None:
        nonlocal closed_snapshot
        try:
            if close_order_id and str(getattr(closed_row, "close_order_id", "")) == str(close_order_id):
                closed_snapshot = {
                    "tradeId": str(getattr(closed_row, "trade_id", trade_id)),
                    "amount": int(getattr(closed_row, "amount", 0) or 0),
                    "closeRate": float(getattr(closed_row, "close_rate", 0) or 0),
                    "closeOrderId": str(getattr(closed_row, "close_order_id", "")),
                }
                event.set()
        except Exception:
            pass

    closed_table = fx.get_table(ForexConnect.CLOSED_TRADES)
    listener = Common.subscribe_table_updates(closed_table, on_add_callback=on_added_closed)
    try:
        resp = fx.send_request(request)
        close_order_id = str(getattr(resp, "order_id", "") or "")
        if not close_order_id:
            return _reject(
                "BROKER_ACK_MISSING_ORDER_ID",
                "close send_request returned without order_id.",
                mutatesBroker=True,
            )
        event.wait(max(1.0, float(wait_seconds)))
        # Confirm trade gone from open trades
        still_open = False
        for row in fx.get_table(ForexConnect.TRADES):
            if str(getattr(row, "trade_id", "")) == trade_id:
                still_open = True
                break
        return {
            "ok": True,
            "code": "CLOSED" if (closed_snapshot or not still_open) else "CLOSE_PENDING_OR_TIMEOUT",
            "mutatesBroker": True,
            "environment": "demo",
            "brokerOrderId": close_order_id,
            "tradeId": trade_id,
            "closedTrade": closed_snapshot,
            "stillOpen": still_open,
            "closeConfirmed": bool(closed_snapshot) or not still_open,
            "note": (
                "TRUE_MARKET_CLOSE submitted. "
                + ("Close confirmed." if (closed_snapshot or not still_open) else "Reconcile /trades — close not confirmed before timeout.")
            ),
        }
    except Exception as exc:
        return _reject(
            "BROKER_CLOSE_FAILED",
            str(exc)[:400],
            mutatesBroker=True,
            brokerOrderId=close_order_id,
            tradeId=trade_id,
        )
    finally:
        try:
            listener.unsubscribe()
        except Exception:
            pass
