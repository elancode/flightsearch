"""Vercel serverless function: POST /api/search — run a live Duffel search.

Receives the query-builder state as JSON, builds a TripSpec, prices it through
the shared core (`flightcore`), and returns ranked results the web UI renders.

The Duffel token is read from the DUFFEL_ACCESS_TOKEN environment variable
(set in the Vercel project settings) and NEVER leaves the server — the browser
only ever sees prices, never the token.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler

# flightcore.py is bundled alongside this file (via `includeFiles` in
# vercel.json). Put its directory on the path and import it, guarded so a load
# failure surfaces as JSON instead of a raw FUNCTION_INVOCATION_FAILED.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
IMPORT_ERROR: str | None = None
try:
    from flightcore import (
        CABIN_ORDER, DuffelProvider, LegSpec, MockProvider, TripSpec,
        plan_searches, run_trip_result,
    )
except Exception as _exc:  # noqa: BLE001
    IMPORT_ERROR = f"{type(_exc).__name__}: {_exc}"

# Guard rails so a pathological spec can't blow the serverless time budget.
MAX_LEGS = 6
MAX_CALLS = 40
# Tightened vs. the CLI default (15s) so fanned-out live calls fit in time.
SUPPLIER_TIMEOUT_MS = 8000


def _leg_from_json(l: dict) -> LegSpec:
    cabins_flags = l.get("cabins") or {}
    cabins = [c for c in CABIN_ORDER if cabins_flags.get(c)]
    comfort = {}
    for k, v in (l.get("comfort") or {}).items():
        key = str(k).upper()
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if fv:
            comfort[key] = fv
    via = [str(x).upper().strip() for x in (l.get("via") or []) if str(x).strip()]
    return LegSpec(
        origin=str(l.get("origin", "")).upper().strip(),
        destination=str(l.get("destination", "")).upper().strip(),
        date=str(l.get("date", "")).strip(),
        cabins_acceptable=cabins,
        comfort_value=comfort,
        via=via,
    )


def _trip_from_json(payload: dict) -> TripSpec:
    legs = [_leg_from_json(l) for l in (payload.get("legs") or [])]
    con = payload.get("constraints") or {}
    return TripSpec(
        name=str(payload.get("name") or "Untitled trip"),
        legs=legs,
        passengers=int(con.get("passengers", 1) or 1),
        max_stops=int(con.get("maxStops", 1) or 0),
        max_layover_minutes=int(con.get("maxLayover", 240) or 0),
        currency=str(con.get("currency", "USD") or "USD"),
    )


def _validate(trip: TripSpec) -> str | None:
    if not trip.legs:
        return "No legs provided."
    if len(trip.legs) > MAX_LEGS:
        return f"Too many legs (max {MAX_LEGS})."
    for i, leg in enumerate(trip.legs, 1):
        if not leg.origin or not leg.destination:
            return f"Leg {i} route incomplete."
        if not leg.date:
            return f"Leg {i} date missing."
        if not leg.cabins_acceptable:
            return f"Leg {i} needs at least one cabin."
    calls = len(plan_searches(trip))
    if calls > MAX_CALLS:
        return f"Search too large ({calls} calls > {MAX_CALLS} cap)."
    return None


def run_search(payload: dict) -> tuple[int, dict]:
    """Pure handler logic — returns (status_code, json_body)."""
    mode = str(payload.get("mode") or "live")
    trip = _trip_from_json(payload)

    err = _validate(trip)
    if err:
        return 400, {"ok": False, "error": err}

    if mode == "dry":
        return 200, {"ok": True, "dry": True,
                     "plan_total": len(plan_searches(trip))}

    if mode == "mock":
        provider = MockProvider()
    else:
        token = os.environ.get("DUFFEL_ACCESS_TOKEN", "")
        if not token:
            return 500, {"ok": False,
                         "error": "Server is missing DUFFEL_ACCESS_TOKEN. "
                                  "Set it in the Vercel project settings."}
        provider = DuffelProvider(
            token=token, sleep_s=0.0, supplier_timeout_ms=SUPPLIER_TIMEOUT_MS)

    # run_trip_result sets a diagnostic `warning` when nothing ranks.
    result = run_trip_result(trip, provider, parallel=True, mode=mode)
    return 200, result


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:  # CORS preflight
        self._send(204, {})

    def do_POST(self) -> None:
        if IMPORT_ERROR:
            self._send(500, {"ok": False,
                             "error": f"Backend failed to load: {IMPORT_ERROR}"})
            return
        try:
            length = int(self.headers.get("content-length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"ok": False, "error": "Invalid JSON body."})
            return
        try:
            status, body = run_search(payload)
            self._send(status, body)
        except Exception as exc:  # noqa: BLE001 — surface a clean error to UI
            traceback.print_exc()
            self._send(502, {"ok": False,
                             "error": f"Search failed: {exc}"})
