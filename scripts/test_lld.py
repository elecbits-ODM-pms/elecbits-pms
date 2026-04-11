#!/usr/bin/env python3
"""
test_lld.py — End-to-end self-test for the LLD generation pipeline.

Runs automated checks against your live Supabase Edge Function and
diagnoses exactly what is broken if anything fails.

Usage:
    python3 scripts/test_lld.py
    python3 scripts/test_lld.py --verbose         # show full LLD output
    python3 scripts/test_lld.py --skip-live       # skip the real API call
    python3 scripts/test_lld.py --env path/to/.env.local

Exit codes:
    0  all checks passed
    1  one or more checks failed
    2  configuration / setup error (env vars missing, etc.)

No third-party packages required — uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# Pretty printing
# ─────────────────────────────────────────────────────────────────────────────

class C:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    GRAY = "\033[90m"
    BOLD = "\033[1m"
    END = "\033[0m"

PASS = f"{C.GREEN}✓ PASS{C.END}"
FAIL = f"{C.RED}✗ FAIL{C.END}"
WARN = f"{C.YELLOW}⚠ WARN{C.END}"
INFO = f"{C.BLUE}ℹ INFO{C.END}"

results: list[tuple[str, bool, str]] = []

def check(name: str, ok: bool, detail: str = "") -> bool:
    label = PASS if ok else FAIL
    print(f"  {label}  {name}" + (f"  {C.GRAY}— {detail}{C.END}" if detail else ""))
    results.append((name, ok, detail))
    return ok

def section(title: str) -> None:
    print(f"\n{C.BOLD}{C.BLUE}━━ {title} ━━{C.END}")

# ─────────────────────────────────────────────────────────────────────────────
# Env loader (.env.local parser, no python-dotenv dep)
# ─────────────────────────────────────────────────────────────────────────────

def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        print(f"{FAIL}  .env file not found at {path}")
        sys.exit(2)
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env

# ─────────────────────────────────────────────────────────────────────────────
# HTTP helper (urllib only)
# ─────────────────────────────────────────────────────────────────────────────

def http_post(url: str, headers: dict[str, str], body: dict[str, Any], timeout: int = 120) -> tuple[int, dict[str, str], str]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, dict(resp.headers), resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        return 0, {}, f"URLError: {e.reason}"
    except TimeoutError:
        return 0, {}, "TimeoutError: request exceeded timeout"

# ─────────────────────────────────────────────────────────────────────────────
# Sample payload — realistic 30-question answer set
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_ANSWERS = [
    "Smart soil moisture sensor for precision agriculture",
    "Agritech / IoT",
    "Farmers waste 30% of irrigation water by over-watering",
    "Small-to-medium farm operators in India",
    "Netafim wireless soil sensors, Rachio controllers",
    "Real-time soil moisture, temperature, EC; LoRaWAN uplink; solar charging",
    "Capacitive moisture sensor, DS18B20 temperature, EC probe",
    "LED status, buzzer alert",
    "OLED 0.96\" display + 2 buttons",
    "Edge ML for anomaly detection",
    "LoRaWAN long range",
    "LoRaWAN 868MHz",
    "USB-C for config",
    "AWS IoT Core via LoRaWAN gateway",
    "Solar + Li-ion 18650",
    "2 years",
    "<50uA sleep, <80mA active",
    "Deep sleep between readings",
    "React Native companion app",
    "Yes via LoRaWAN FUOTA",
    "Yes — soil trends, yield predictions",
    "80 x 60 x 25 mm",
    "Outdoor IP67, -20 to +60C",
    "UV-resistant ABS",
    "CE, FCC, IC",
    "RoHS compliant",
    "$45 BOM target",
    "10000 units year 1",
    "Q3 2026",
    "Must survive monsoon flooding",
]

REQUIRED_LLD_KEYWORDS = [
    "LLD", "Document", "BOM", "Power", "Connectivity",
]

# ─────────────────────────────────────────────────────────────────────────────
# Test stages
# ─────────────────────────────────────────────────────────────────────────────

def stage_env(env: dict[str, str]) -> tuple[str, str]:
    section("Stage 1 — Environment")
    url = env.get("VITE_SUPABASE_URL", "")
    key = env.get("VITE_SUPABASE_ANON_KEY", "")
    check("VITE_SUPABASE_URL is set", bool(url), url if url else "missing")
    check("VITE_SUPABASE_ANON_KEY is set", bool(key), f"{key[:8]}…{key[-4:]}" if key else "missing")
    if not (url and key):
        sys.exit(2)
    return url, key

def stage_function_exists(url: str, key: str) -> bool:
    section("Stage 2 — Edge Function reachability")
    endpoint = f"{url}/functions/v1/generate-lld"
    print(f"  {INFO}  Probing {endpoint}")

    # Send a deliberately bad payload to confirm the function exists & validates
    status, _, body = http_post(
        endpoint,
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        {"projectName": ""},
    )

    if status == 0:
        check("Network reachable", False, body)
        return False
    if status == 404:
        check("Function deployed", False, "404 Not Found — run: supabase functions deploy generate-lld")
        return False
    if status == 401:
        check("Auth accepted", False, "401 Unauthorized — anon key wrong or function requires JWT")
        return False
    if status == 400:
        check("Function deployed", True, "responded 400 to invalid payload (correct behaviour)")
        return True
    if status == 500:
        # Could be missing API key — that's still a deployed function
        check("Function deployed", True, f"responded 500 — {body[:120]}")
        return True
    check("Function deployed", True, f"unexpected status {status} but server responded")
    return True

def stage_real_call(url: str, key: str, verbose: bool) -> bool:
    section("Stage 3 — Live LLD generation (calls Anthropic)")
    endpoint = f"{url}/functions/v1/generate-lld"
    payload = {
        "projectName": "AgriSense Pro (test_lld.py)",
        "clientName": "DiagnosticCo",
        "projectId": "Eb-TEST-001",
        "answers": SAMPLE_ANSWERS,
    }
    print(f"  {INFO}  POST with full 30-answer payload (this may take 30-90s)…")
    t0 = time.time()
    status, _, body = http_post(
        endpoint,
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        payload,
        timeout=180,
    )
    elapsed = time.time() - t0
    print(f"  {INFO}  Response in {elapsed:.1f}s, status={status}, body={len(body)} bytes")

    if status != 200:
        # Diagnose
        snippet = body[:300]
        if "ANTHROPIC_API_KEY" in body:
            check("API key configured in Supabase", False,
                  "edge function reports ANTHROPIC_API_KEY not set — "
                  "run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...")
        elif status == 502:
            check("Anthropic API call", False, f"502 from edge function — Anthropic error: {snippet}")
        else:
            check("Edge function returned 200", False, f"status={status} body={snippet}")
        return False

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        check("Response is JSON", False, body[:200])
        return False
    check("Response is JSON", True)

    # Validate response shape
    lld = data.get("lldContent", "")
    check("Response contains lldContent field", bool(lld), f"{len(lld)} chars")
    check("Response contains model field", bool(data.get("model")), str(data.get("model", "")))
    check("Response contains usage field", bool(data.get("usage")), str(data.get("usage", "")))

    # Validate content quality
    check("LLD is at least 1000 chars", len(lld) >= 1000, f"{len(lld)} chars")
    check("LLD is at least 5000 chars (target)", len(lld) >= 5000, f"{len(lld)} chars")

    missing = [k for k in REQUIRED_LLD_KEYWORDS if k.lower() not in lld.lower()]
    check("LLD mentions required sections (LLD/BOM/Power/Connectivity)",
          not missing, f"missing: {missing}" if missing else "")

    check("LLD references the project name", "AgriSense" in lld, "")
    check("LLD references the client", "DiagnosticCo" in lld, "")

    if verbose:
        print(f"\n{C.GRAY}── LLD preview (first 1500 chars) ──{C.END}")
        print(lld[:1500])
        print(f"{C.GRAY}── …{len(lld) - 1500} more chars ──{C.END}\n")

    return True

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser(description="End-to-end LLD generation self-test")
    p.add_argument("--env", default=".env.local", help="path to .env file")
    p.add_argument("--verbose", action="store_true", help="print LLD preview")
    p.add_argument("--skip-live", action="store_true", help="skip the real Anthropic call")
    args = p.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    env_path = (repo_root / args.env).resolve()
    print(f"{C.BOLD}LLD Pipeline Self-Test{C.END}")
    print(f"  env file: {env_path}")

    env = load_env(env_path)
    url, key = stage_env(env)

    if not stage_function_exists(url, key):
        print(f"\n{FAIL}  Edge function check failed — aborting before live call.")
        summarise()
        return 1

    if not args.skip_live:
        stage_real_call(url, key, args.verbose)
    else:
        print(f"\n  {INFO}  Skipping live Anthropic call (--skip-live)")

    return summarise()

def summarise() -> int:
    print(f"\n{C.BOLD}━━ Summary ━━{C.END}")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"  {passed} passed, {failed} failed")
    if failed:
        print(f"\n{C.RED}Failed checks:{C.END}")
        for name, ok, detail in results:
            if not ok:
                print(f"  • {name}  {C.GRAY}— {detail}{C.END}")
        return 1
    print(f"\n{C.GREEN}All checks passed.{C.END}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
