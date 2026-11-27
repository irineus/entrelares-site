"""L-45 (PR 2) — records the Reels' clips, one per beat of reels.mjs, from the real app.

NEVER against dev or production. Prerequisites (the T-103 recipe, app repo memory
"auditoria-ao-vivo-adb-stack-local"):
  - app worktree from origin/main, supabase/config.toml on free ports (583xx), `supabase start`;
  - Env.dev pointed LOCALLY (uncommitted) at http://127.0.0.1:58321 + the local publishable key,
    usesCleartextTraffic in the debug manifest, debugShowCheckedModeBanner: false;
  - dev APK (x64) installed on the emulator, `adb reverse tcp:58321 tcp:58321`,
    `adb shell wm density 480`, the app signed in as Ana, in Portuguese, push strip dismissed;
  - the demo family seeded: Ana Martins (admin) and Bruno Costa, child Lia, alternating weeks
    Monday to Sunday from 02/11/2026 with handoff 18:00 on Mondays (24/12 Bruno, 31/12 Ana).
    The demo accounts' password is whatever the seed used; pass it as L45_DEMO_PASSWORD (it is
    never written here: a password-shaped literal trips the repository's secret scanner).

    L45_DEMO_PASSWORD=... python -I assets-src/social/record_reels.py <out-dir> [r01 r03 r02 r04]

The coordinates are the emulator's (1080x2400 at density 480) as read with `uiautomator dump`
on 27/11/2026; a redesign of these screens means reading them again. Run order matters: r02
creates the swap that r04 shows in the Histórico.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
ENV = dict(os.environ, MSYS_NO_PATHCONV="1")
BASE = "http://127.0.0.1:58321"
PUB = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"  # local CLI default
assert BASE.startswith("http://127.0.0.1")


def adb(*args):
    subprocess.run(["adb", *args], check=True, env=ENV, capture_output=True)


def tap(x, y):
    adb("shell", "input", "tap", str(x), str(y))


def home():
    adb("shell", "input", "keyevent", "3")


def resume():
    adb("shell", "monkey", "-p", "com.entrelares.flutter", "-c", "android.intent.category.LAUNCHER", "1")


def relaunch():
    adb("shell", "am", "force-stop", "com.entrelares.flutter")
    adb("shell", "monkey", "-p", "com.entrelares.flutter", "-c", "android.intent.category.LAUNCHER", "1")


def bruno_approves_all():
    """Bruno answers yes to every open request, through the same RPC his app calls (S-25)."""
    def call(path, body, token=None):
        req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST",
                                     headers={"apikey": PUB, "Authorization": f"Bearer {token or PUB}",
                                              "Content-Type": "application/json"})
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    jwt = call("/auth/v1/token?grant_type=password",
               {"email": "bruno@exemplo.com", "password": os.environ["L45_DEMO_PASSWORD"]})["access_token"]
    req = urllib.request.Request(BASE + "/rest/v1/swap_requests?status=eq.pending&select=id",
                                 headers={"apikey": PUB, "Authorization": f"Bearer {jwt}"})
    with urllib.request.urlopen(req) as r:
        ids = [row["id"] for row in json.loads(r.read())]
    for i in ids:
        call("/rest/v1/rpc/approve_swap_request", {"p_id": i, "p_note": None, "p_notifications": []}, jwt)
    return ids


NEXT, PREV = (1020, 694), (60, 694)          # month arrows, calendar at rest (push strip dismissed)
MENU, MULTI = (816, 208), (468, 400)          # calendar overflow menu, "Selecionar vários dias"
SEL_24, SEL_31 = (689, 1625), (689, 1824)     # December cells while selecting (the month stays)
TROCAR, CONFIRMAR = (798, 2046), (288, 2040)  # selection bar, swap sheet
DAY_24, DAY_28 = (689, 1824), (241, 2023)     # December cells at rest (Dec 2026 spans five rows)
CLOSE_SHEET = (996, 513)
TAB_REPORTS, TAB_HISTORY = (972, 2232), (540, 415)

# Each beat: (seconds, [(delay before the action, callable), ...]). Delays are cumulative waits.
REELS = {
    "r01": dict(prep=[relaunch, lambda: time.sleep(9), home, lambda: time.sleep(2)], beats=[
        (5, [(0.4, resume)]),
        (4, [(1.0, lambda: tap(*NEXT))]),
        (5, [(1.0, lambda: tap(*DAY_24))]),
    ]),
    "r03": dict(prep=[relaunch, lambda: time.sleep(9)], beats=[
        (5, [(1.2, lambda: tap(*NEXT))]),
        (5, [(1.0, lambda: tap(*DAY_28))]),
    ]),
    "r02": dict(prep=[relaunch, lambda: time.sleep(9), lambda: tap(*NEXT), lambda: time.sleep(2)], beats=[
        (4, []),
        (6, [(0.8, lambda: tap(*MENU)), (0.9, lambda: tap(*MULTI)),
             (1.2, lambda: tap(*SEL_24)), (0.9, lambda: tap(*SEL_31))]),
        (5, [(0.8, lambda: tap(*TROCAR))]),
        (7, [(1.0, lambda: tap(*CONFIRMAR))]),
        (6, [(0.5, bruno_approves_all), (1.0, lambda: tap(*PREV)), (1.2, lambda: tap(*NEXT))]),
    ]),
    "r04": dict(prep=[relaunch, lambda: time.sleep(9)], beats=[
        (4, [(0.8, lambda: tap(*TAB_REPORTS))]),
        (6, [(1.0, lambda: tap(*TAB_HISTORY))]),
    ]),
}


def record(name, seconds, actions):
    remote = f"/sdcard/{name}.mp4"
    proc = subprocess.Popen(["adb", "shell", "screenrecord", "--time-limit", str(seconds),
                             "--bit-rate", "12000000", remote], env=ENV)
    time.sleep(0.4)
    for delay, act in actions:
        time.sleep(delay)
        act()
    proc.wait()
    time.sleep(0.8)
    adb("pull", remote, os.path.join(OUT, f"{name}.mp4"))
    adb("shell", "rm", remote)


for reel in sys.argv[2:] or ["r01", "r03", "r02", "r04"]:
    spec = REELS[reel]
    for step in spec["prep"]:
        step()
    for i, (seconds, actions) in enumerate(spec["beats"], start=1):
        record(f"{reel}-b{i}", seconds, actions)
        print(f"recorded {reel}-b{i}", flush=True)
