"""
Phase 58.3 — DEMO-only ForexConnect mutation helpers.

Uses documented ForexConnect 1.6 APIs:
  fx.create_order_request(...) + fx.send_request(request)
  TRUE_MARKET_OPEN / TRUE_MARKET_CLOSE (Gehtsoft samples OpenPosition.py / ClosePosition.py)
  RATE_STOP / RATE_LIMIT attached to opening orders (TradingCommandsCreateOrder_A)
  STOP / LIMIT with TRADE_ID for post-fill protective attach
  DELETE_ORDER cancel (Gehtsoft RemoveOrder.py)
  Partial TRUE_MARKET_CLOSE via amount <= trade.amount

LIVE sessions are always rejected. Mutations remain disabled unless
KWIZERA_FOREXCONNECT_ALLOW_DEMO_MUTATION=1 and a shared secret is presented.
"""
from __future__ import annotations

import os
import threading
from typing import Any, Optional


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
        "stopOrder": None,
        "limitOrder": None,
        "supportsAttachedRateStopLimit": True,  # documented for OM/O/OR/SE/LE
        "supportsPostFillStopLimitTradeId": True,  # documented STOP/LIMIT + TRADE_ID
        "ordersConstants": [],
        "mutationEnvEnabled": mutation_enabled(),
        "mutationSecretConfigured": bool(_env("KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET")),
        "phase": "58.3",
        "supportsDeleteOrder": True,
        "supportsPartialClose": True,
        "note": "Probe only — no broker request sent.",
    }
    try:
        from forexconnect import ForexConnect, fxcorepy  # type: ignore

        out["sdkImportOk"] = True
        out["hasCreateOrderRequest"] = callable(getattr(ForexConnect, "create_order_request", None))
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
                if name == "STOP":
                    out["stopOrder"] = getattr(orders, name, None)
                if name == "LIMIT":
                    out["limitOrder"] = getattr(orders, name, None)
            out["ordersConstants"] = sorted(names)[:80]
            out["hasCreateOrderRequest"] = True
            out["hasSendRequest"] = True
        # Phase 59.0.7 — list TIF constants when present (probe only; no request sent).
        tif = getattr(getattr(fxcorepy, "Constants", None), "TIF", None)
        if tif is not None:
            tif_names = [n for n in dir(tif) if not n.startswith("_")]
            out["tifConstants"] = sorted(tif_names)[:40]
            out["documentedOmDefaultTif"] = "IOC"
            out["documentedOmSupportedTif"] = ["GTC", "IOC", "FOK", "DAY"]
            out["tifNote"] = (
                "FXCM Open Market docs: TimeInForce optional; OM defaults to IOC. "
                "GTD may exist on Constants.TIF but needs expiry — treat as unsupported until modelled."
            )
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
            "LIVE/Real ForexConnect sessions cannot mutate in Phase 58.3.",
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


def _parse_rate(value: Any, field: str) -> tuple[Optional[float], Optional[dict[str, Any]]]:
    if value is None or value == "":
        return None, None
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return None, _reject("INVALID_RATE", f"{field} must be a finite number.")
    if not (rate == rate) or rate <= 0:  # NaN check
        return None, _reject("INVALID_RATE", f"{field} must be a positive finite number.")
    return rate, None


def _trade_protection_snapshot(fx: Any, trade_id: str) -> dict[str, Any]:
    """Read broker-reported stop/limit on a trade and matching open orders."""
    from forexconnect import ForexConnect  # type: ignore

    trade_id = str(trade_id or "").strip()
    out: dict[str, Any] = {
        "tradeId": trade_id,
        "found": False,
        "stop": None,
        "limit": None,
        "stopOrderId": None,
        "limitOrderId": None,
        "protectiveOrders": [],
        "brokerProtected": False,
    }
    if not trade_id:
        return out

    trades_table = fx.get_table(ForexConnect.TRADES)
    target = None
    for row in trades_table:
        if str(getattr(row, "trade_id", "")) == trade_id:
            target = row
            break
    if target is None:
        return out

    stop_val = getattr(target, "stop", None)
    limit_val = getattr(target, "limit", None)
    try:
        stop_f = float(stop_val) if stop_val not in (None, "", 0, 0.0) else None
    except (TypeError, ValueError):
        stop_f = None
    try:
        limit_f = float(limit_val) if limit_val not in (None, "", 0, 0.0) else None
    except (TypeError, ValueError):
        limit_f = None

    # Zero often means "no protective order" on FXCM rows.
    if stop_f is not None and stop_f <= 0:
        stop_f = None
    if limit_f is not None and limit_f <= 0:
        limit_f = None

    protective_orders: list[dict[str, Any]] = []
    try:
        orders_table = fx.get_table(ForexConnect.ORDERS)
        for order in orders_table:
            try:
                if str(getattr(order, "trade_id", "") or "") != trade_id:
                    continue
                otype = str(getattr(order, "type", "") or "")
                oid = str(getattr(order, "order_id", "") or "")
                rate = float(getattr(order, "rate", 0) or 0)
                snap = {
                    "orderId": oid,
                    "type": otype,
                    "rate": rate,
                    "buySell": str(getattr(order, "buy_sell", "")),
                    "amount": int(getattr(order, "amount", 0) or 0),
                }
                protective_orders.append(snap)
                upper = otype.upper()
                if upper in ("S", "ST", "STOP") or "STOP" in upper:
                    out["stopOrderId"] = oid
                    if stop_f is None and rate > 0:
                        stop_f = rate
                if upper in ("L", "LIMIT") or "LIMIT" in upper:
                    out["limitOrderId"] = oid
                    if limit_f is None and rate > 0:
                        limit_f = rate
            except Exception:
                continue
    except Exception:
        pass

    out["found"] = True
    out["stop"] = stop_f
    out["limit"] = limit_f
    out["protectiveOrders"] = protective_orders
    out["brokerProtected"] = bool(stop_f and limit_f)
    out["instrument"] = str(getattr(target, "instrument", "") or "")
    out["amount"] = int(getattr(target, "amount", 0) or 0)
    out["openRate"] = float(getattr(target, "open_rate", 0) or 0)
    out["buySell"] = str(getattr(target, "buy_sell", "") or "")
    return out


def reconcile_trade_protection(fx: Any, *, trade_id: str) -> dict[str, Any]:
    snap = _trade_protection_snapshot(fx, trade_id)
    return {
        "ok": True,
        "code": "PROTECTED" if snap.get("brokerProtected") else (
            "PROTECTION_PARTIAL" if (snap.get("stop") or snap.get("limit")) else "PROTECTION_MISSING"
        ),
        "mutatesBroker": False,
        "environment": "demo",
        "protection": snap,
        "brokerProtected": bool(snap.get("brokerProtected")),
    }


def attach_protective_orders(
    fx: Any,
    *,
    trade_id: str,
    stop_rate: Optional[float] = None,
    limit_rate: Optional[float] = None,
    account_id: Optional[str] = None,
    wait_seconds: float = 15.0,
) -> dict[str, Any]:
    """
    Post-fill protective attach using documented STOP / LIMIT + TRADE_ID.
    BUY_SELL for protective close is the opposite of the open trade side.
    """
    from forexconnect import ForexConnect, Common, fxcorepy  # type: ignore

    trade_id = str(trade_id or "").strip()
    if not trade_id:
        return _reject("TRADE_ID_REQUIRED", "tradeId is required for protective attach.")

    stop_f, err = _parse_rate(stop_rate, "stopRate")
    if err:
        return err
    limit_f, err = _parse_rate(limit_rate, "limitRate")
    if err:
        return err
    if stop_f is None and limit_f is None:
        return _reject("PROTECTION_RATES_REQUIRED", "At least one of stopRate or limitRate is required.")

    account = Common.get_account(fx, account_id) if account_id else Common.get_account(fx, None)
    if not account:
        return _reject("ACCOUNT_NOT_FOUND", "No valid ForexConnect account for protective attach.")
    str_account = str(account.account_id)

    trades_table = fx.get_table(ForexConnect.TRADES)
    target = None
    for row in trades_table:
        if str(getattr(row, "trade_id", "")) == trade_id:
            target = row
            break
    if target is None:
        return _reject("TRADE_NOT_FOUND", f"Open trade '{trade_id}' not found for protective attach.")

    offer_instrument = str(getattr(target, "instrument", "") or "").strip()
    offer = Common.get_offer(fx, offer_instrument) if offer_instrument else None
    if not offer:
        offer_id = getattr(target, "offer_id", None)
        for o in fx.get_table(ForexConnect.OFFERS):
            if str(getattr(o, "offer_id", "")) == str(offer_id):
                offer = o
                break
    if not offer:
        return _reject("INSTRUMENT_NOT_FOUND", "Cannot resolve offer for protective attach.")

    buy = fxcorepy.Constants.BUY
    sell = fxcorepy.Constants.SELL
    trade_side = getattr(target, "buy_sell", None)
    close_side = sell if trade_side == buy else buy
    amount = int(getattr(target, "amount", 0) or 0)
    if amount <= 0:
        return _reject("INVALID_AMOUNT", "Trade amount is not positive.")

    open_rate = float(getattr(target, "open_rate", 0) or 0)
    if stop_f is not None and open_rate > 0:
        if trade_side == buy and not (stop_f < open_rate):
            return _reject("STOP_LOSS_GEOMETRY_INVALID", "BUY stop must be below open rate.")
        if trade_side == sell and not (stop_f > open_rate):
            return _reject("STOP_LOSS_GEOMETRY_INVALID", "SELL stop must be above open rate.")
    if limit_f is not None and open_rate > 0:
        if trade_side == buy and not (limit_f > open_rate):
            return _reject("TAKE_PROFIT_GEOMETRY_INVALID", "BUY limit must be above open rate.")
        if trade_side == sell and not (limit_f < open_rate):
            return _reject("TAKE_PROFIT_GEOMETRY_INVALID", "SELL limit must be below open rate.")

    submitted: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    def _submit(order_type: Any, rate: float, kind: str) -> None:
        request = fx.create_order_request(
            order_type=order_type,
            OFFER_ID=offer.offer_id,
            ACCOUNT_ID=str_account,
            BUY_SELL=close_side,
            AMOUNT=amount,
            RATE=rate,
            TRADE_ID=trade_id,
        )
        if request is None:
            errors.append({"kind": kind, "code": "REQUEST_CREATE_FAILED"})
            return
        try:
            resp = fx.send_request(request)
            oid = str(getattr(resp, "order_id", "") or "")
            submitted.append({"kind": kind, "brokerOrderId": oid or None, "rate": rate, "ok": bool(oid)})
        except Exception as exc:
            errors.append({"kind": kind, "code": "BROKER_SUBMIT_FAILED", "message": str(exc)[:240]})

    if stop_f is not None:
        _submit(fxcorepy.Constants.Orders.STOP, stop_f, "STOP")
    if limit_f is not None:
        _submit(fxcorepy.Constants.Orders.LIMIT, limit_f, "LIMIT")

    # Brief settle then reconcile broker state (do not trust HTTP alone).
    event = threading.Event()
    event.wait(min(2.0, max(0.5, float(wait_seconds) * 0.1)))
    protection = _trade_protection_snapshot(fx, trade_id)
    broker_protected = bool(protection.get("brokerProtected"))
    ok = broker_protected and not errors
    return {
        "ok": ok,
        "code": "PROTECTED" if broker_protected else (
            "PROTECTION_SUBMITTED_UNVERIFIED" if submitted and not errors else "PROTECTION_ATTACH_FAILED"
        ),
        "mutatesBroker": True,
        "environment": "demo",
        "tradeId": trade_id,
        "submitted": submitted,
        "errors": errors,
        "protection": protection,
        "brokerProtected": broker_protected,
        "note": (
            "Post-fill STOP/LIMIT submitted; "
            + ("broker trade shows stop+limit." if broker_protected else "reconcile required — stop+limit not both confirmed on trade.")
        ),
    }


def open_true_market(
    fx: Any,
    *,
    instrument: str,
    buy_sell: str,
    lots: int,
    account_id: Optional[str],
    wait_seconds: float = 30.0,
    rate_stop: Optional[float] = None,
    rate_limit: Optional[float] = None,
    attach_protective_after_fill: bool = False,
) -> dict[str, Any]:
    """TRUE_MARKET_OPEN per Gehtsoft OpenPosition.py; optional RATE_STOP/RATE_LIMIT attach."""
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

    stop_f, err = _parse_rate(rate_stop, "rateStop")
    if err:
        return err
    limit_f, err = _parse_rate(rate_limit, "rateLimit")
    if err:
        return err

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

    # Soft geometry check vs current bid/ask when protective rates provided.
    try:
        bid = float(getattr(offer, "bid", 0) or 0)
        ask = float(getattr(offer, "ask", 0) or 0)
        ref = ask if direction_out == "BUY" else bid
        if ref > 0 and stop_f is not None:
            if direction_out == "BUY" and not (stop_f < ref):
                return _reject("STOP_LOSS_GEOMETRY_INVALID", "BUY stop must be below current ask.")
            if direction_out == "SELL" and not (stop_f > ref):
                return _reject("STOP_LOSS_GEOMETRY_INVALID", "SELL stop must be above current bid.")
        if ref > 0 and limit_f is not None:
            if direction_out == "BUY" and not (limit_f > ref):
                return _reject("TAKE_PROFIT_GEOMETRY_INVALID", "BUY limit must be above current ask.")
            if direction_out == "SELL" and not (limit_f < ref):
                return _reject("TAKE_PROFIT_GEOMETRY_INVALID", "SELL limit must be below current bid.")
    except Exception:
        pass

    market_open = fxcorepy.Constants.Orders.TRUE_MARKET_OPEN
    request_kwargs: dict[str, Any] = {
        "order_type": market_open,
        "ACCOUNT_ID": str_account,
        "BUY_SELL": buy_sell_const,
        "AMOUNT": amount,
        "SYMBOL": offer.instrument,
    }
    # Documented attached protective parameters for opening orders (OM family).
    if stop_f is not None:
        request_kwargs["RATE_STOP"] = stop_f
    if limit_f is not None:
        request_kwargs["RATE_LIMIT"] = limit_f

    request = fx.create_order_request(**request_kwargs)
    if request is None:
        return _reject("REQUEST_CREATE_FAILED", "create_order_request returned None.")

    order_id: Optional[str] = None
    trade_snapshot: Optional[dict[str, Any]] = None
    event = threading.Event()

    def on_added_trade(_a: Any, _b: Any, trade_row: Any) -> None:
        nonlocal trade_snapshot
        try:
            if order_id and str(getattr(trade_row, "open_order_id", "")) == str(order_id):
                stop_v = getattr(trade_row, "stop", None)
                limit_v = getattr(trade_row, "limit", None)
                try:
                    stop_out = float(stop_v) if stop_v not in (None, "", 0, 0.0) else None
                except (TypeError, ValueError):
                    stop_out = None
                try:
                    limit_out = float(limit_v) if limit_v not in (None, "", 0, 0.0) else None
                except (TypeError, ValueError):
                    limit_out = None
                if stop_out is not None and stop_out <= 0:
                    stop_out = None
                if limit_out is not None and limit_out <= 0:
                    limit_out = None
                trade_snapshot = {
                    "tradeId": str(getattr(trade_row, "trade_id", "")),
                    "amount": int(getattr(trade_row, "amount", 0) or 0),
                    "openRate": float(getattr(trade_row, "open_rate", 0) or 0),
                    "buySell": str(getattr(trade_row, "buy_sell", "")),
                    "instrument": str(getattr(trade_row, "instrument", instrument)),
                    "openOrderId": str(getattr(trade_row, "open_order_id", "")),
                    "stop": stop_out,
                    "limit": limit_out,
                }
                event.set()
        except Exception:
            pass

    trades_table = fx.get_table(ForexConnect.TRADES)
    listener = Common.subscribe_table_updates(trades_table, on_add_callback=on_added_trade)
    attach_result: Optional[dict[str, Any]] = None
    protection: Optional[dict[str, Any]] = None
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

        if trade_snapshot and trade_snapshot.get("tradeId"):
            protection = _trade_protection_snapshot(fx, str(trade_snapshot["tradeId"]))
            needs_attach = attach_protective_after_fill or (
                (stop_f is not None or limit_f is not None)
                and not protection.get("brokerProtected")
            )
            if needs_attach and (stop_f is not None or limit_f is not None):
                attach_result = attach_protective_orders(
                    fx,
                    trade_id=str(trade_snapshot["tradeId"]),
                    stop_rate=stop_f,
                    limit_rate=limit_f,
                    account_id=str_account,
                    wait_seconds=min(15.0, float(wait_seconds)),
                )
                protection = attach_result.get("protection") or _trade_protection_snapshot(
                    fx, str(trade_snapshot["tradeId"])
                )

        broker_protected = bool(protection and protection.get("brokerProtected"))
        code = "SUBMITTED" if trade_snapshot else "ACCEPTED_PENDING_OR_TIMEOUT"
        if trade_snapshot and (stop_f is not None or limit_f is not None):
            code = "PROTECTED" if broker_protected else "FILLED_PROTECTION_UNVERIFIED"

        return {
            "ok": True,
            "code": code,
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
            "requestedStop": stop_f,
            "requestedLimit": limit_f,
            "protection": protection,
            "attachResult": attach_result,
            "brokerProtected": broker_protected,
            "note": (
                "Broker TRUE_MARKET_OPEN submitted. "
                + ("Trade row observed. " if trade_snapshot else "Trade row not observed before wait timeout — reconcile via /trades. ")
                + (
                    "Broker stop+limit confirmed."
                    if broker_protected
                    else (
                        "Protective rates requested but not both confirmed on broker trade."
                        if (stop_f is not None or limit_f is not None)
                        else "No protective rates requested."
                    )
                )
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


def read_offer_quote(fx: Any, *, instrument: str) -> dict[str, Any]:
    """Read-only Offers snapshot for DEMO preflight quote checks (no mutation)."""
    from forexconnect import Common  # type: ignore

    instrument = str(instrument or "").strip()
    if not instrument:
        return _reject("INVALID_INSTRUMENT", "instrument is required.")
    offer = Common.get_offer(fx, instrument)
    if not offer:
        return _reject("INSTRUMENT_NOT_FOUND", f"Instrument '{instrument}' not found in Offers.")
    try:
        bid = float(getattr(offer, "bid", 0) or 0)
        ask = float(getattr(offer, "ask", 0) or 0)
    except (TypeError, ValueError):
        bid, ask = 0.0, 0.0
    time_raw = getattr(offer, "time", None) or getattr(offer, "Time", None)
    return {
        "ok": True,
        "code": "OFFER_QUOTE",
        "mutatesBroker": False,
        "environment": "demo",
        "instrument": str(getattr(offer, "instrument", instrument)),
        "bid": bid if bid > 0 else None,
        "ask": ask if ask > 0 else None,
        "mid": ((bid + ask) / 2.0) if bid > 0 and ask > 0 else None,
        "offerTime": str(time_raw) if time_raw is not None else None,
        "quotePresent": bool(bid > 0 and ask > 0),
    }


def cancel_pending_order(
    fx: Any,
    *,
    broker_order_id: str,
    account_id: Optional[str] = None,
    wait_seconds: float = 30.0,
) -> dict[str, Any]:
    """DELETE_ORDER for an exact waiting order (Gehtsoft RemoveOrder.py)."""
    from forexconnect import ForexConnect, Common, fxcorepy  # type: ignore

    broker_order_id = str(broker_order_id or "").strip()
    if not broker_order_id:
        return _reject("ORDER_ID_REQUIRED", "brokerOrderId is required for cancel.")

    account = Common.get_account(fx, account_id) if account_id else Common.get_account(fx, None)
    if not account:
        return _reject("ACCOUNT_NOT_FOUND", "No valid ForexConnect account for cancel.")
    str_account = str(account.account_id)

    orders_table = fx.get_table(ForexConnect.ORDERS)
    target = None
    for row in orders_table:
        if str(getattr(row, "order_id", "")) == broker_order_id:
            target = row
            break
    if target is None:
        return _reject(
            "ORDER_NOT_FOUND",
            f"Pending order '{broker_order_id}' not found — reconcile before retrying cancel.",
        )

    row_account = str(getattr(target, "account_id", str_account) or str_account)
    if row_account and row_account != str_account:
        return _reject("ACCOUNT_MISMATCH", "Order account does not match session account.")

    # Prefer create_request(DELETE_ORDER) per RemoveOrder.py; fall back to create_order_request.
    request = None
    try:
        request = fx.create_request({
            fxcorepy.O2GRequestParamsEnum.COMMAND: fxcorepy.Constants.Commands.DELETE_ORDER,
            fxcorepy.O2GRequestParamsEnum.ACCOUNT_ID: str_account,
            fxcorepy.O2GRequestParamsEnum.ORDER_ID: broker_order_id,
        })
    except Exception:
        request = None
    if request is None:
        try:
            request = fx.create_order_request(
                command=fxcorepy.Constants.Commands.DELETE_ORDER,
                ORDER_ID=broker_order_id,
                ACCOUNT_ID=str_account,
            )
        except Exception as exc:
            return _reject("REQUEST_CREATE_FAILED", str(exc)[:400])
    if request is None:
        return _reject("REQUEST_CREATE_FAILED", "DELETE_ORDER request could not be created.")

    deleted = False
    event = threading.Event()

    def on_deleted(_a: Any, _b: Any, order_row: Any) -> None:
        nonlocal deleted
        try:
            if str(getattr(order_row, "order_id", "")) == broker_order_id:
                deleted = True
                event.set()
        except Exception:
            pass

    listener = Common.subscribe_table_updates(orders_table, on_delete_callback=on_deleted)
    try:
        fx.send_request(request)
        event.wait(max(1.0, float(wait_seconds)))
        still_present = False
        for row in fx.get_table(ForexConnect.ORDERS):
            if str(getattr(row, "order_id", "")) == broker_order_id:
                still_present = True
                break
        cancel_confirmed = deleted or not still_present
        return {
            "ok": True,
            "code": "CANCELLED" if cancel_confirmed else "CANCEL_PENDING_OR_TIMEOUT",
            "mutatesBroker": True,
            "environment": "demo",
            "brokerOrderId": broker_order_id,
            "stillPresent": still_present,
            "cancelConfirmed": cancel_confirmed,
            "note": (
                "DELETE_ORDER submitted. "
                + ("Cancel confirmed — order gone from Orders table." if cancel_confirmed
                   else "Reconcile /orders — cancel not confirmed before timeout.")
            ),
        }
    except Exception as exc:
        return _reject(
            "BROKER_CANCEL_FAILED",
            str(exc)[:400],
            mutatesBroker=True,
            brokerOrderId=broker_order_id,
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
    amount: Optional[int] = None,
) -> dict[str, Any]:
    """TRUE_MARKET_CLOSE for an exact trade_id (Gehtsoft ClosePosition.py). Optional partial amount."""
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
    open_amount = int(getattr(target, "amount", 0) or 0)
    if open_amount <= 0:
        return _reject("INVALID_AMOUNT", "Trade amount is not positive.")
    close_amount = open_amount if amount is None else int(amount)
    if close_amount <= 0 or close_amount > open_amount:
        return _reject(
            "INVALID_CLOSE_AMOUNT",
            f"close amount must be 1..{open_amount} (open trade amount).",
        )
    partial = close_amount < open_amount

    request = fx.create_order_request(
        order_type=fxcorepy.Constants.Orders.TRUE_MARKET_CLOSE,
        OFFER_ID=offer.offer_id,
        ACCOUNT_ID=str_account,
        BUY_SELL=buy_sell,
        AMOUNT=close_amount,
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
        remaining = 0
        still_open = False
        for row in fx.get_table(ForexConnect.TRADES):
            if str(getattr(row, "trade_id", "")) == trade_id:
                still_open = True
                remaining = int(getattr(row, "amount", 0) or 0)
                break
        close_confirmed = bool(closed_snapshot) or (not still_open) or (
            partial and still_open and remaining == open_amount - close_amount
        )
        if not still_open:
            code = "CLOSED"
        elif partial and close_confirmed:
            code = "PARTIALLY_CLOSED"
        elif close_confirmed:
            code = "CLOSED"
        else:
            code = "CLOSE_PENDING_OR_TIMEOUT"
        return {
            "ok": True,
            "code": code,
            "mutatesBroker": True,
            "environment": "demo",
            "brokerOrderId": close_order_id,
            "tradeId": trade_id,
            "requestedCloseAmount": close_amount,
            "openAmountBefore": open_amount,
            "remainingAmount": remaining if still_open else 0,
            "partial": partial,
            "closedTrade": closed_snapshot,
            "stillOpen": still_open,
            "closeConfirmed": close_confirmed,
            "note": (
                "TRUE_MARKET_CLOSE submitted. "
                + (
                    "Full close confirmed."
                    if not still_open
                    else (
                        f"Partial close confirmed; remaining={remaining}."
                        if partial and close_confirmed
                        else "Reconcile /trades — close not confirmed before timeout."
                    )
                )
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
