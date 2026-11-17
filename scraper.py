"""
DIXPIX QUANTITATIVE ENGINE — PURE EPA BASELINE & ZERO-CREDIT ESPN AUTO-GRADER (v200)
- Pulls live spreads & totals from The Odds API (player props disabled to protect 500-credit limit).
- Uses Pure EPA + 38.5145 Play Scaler + Pi/Phi HFA (1.9416110252) without QB Delta double-counting.
- Tags SMASH at >= +10.0% EV and auto-grades completed games via ESPN's free scoreboard API.
"""

import json
import math
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
import requests

DATA_FILE = "data.json"
POLL_INTERVAL_SECONDS = 14400  # 4 hours

ODDS_API_KEY = os.environ.get("DIXPIX_ODDS_API_KEY", "44660163df1724ea28bfc8022e66f9e1")
API_KEY = ODDS_API_KEY

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DixPixQuantEngine/3.2",
    "Accept": "application/json"
}

GOLDEN_RATIO_PHI = 1.6180339887
GOLDEN_PLAY_SCALER = 38.5145
MODEL_TOTAL_INTERCEPT = 42.986
PI_OVER_PHI_HFA = 1.9416110252
LOGISTIC_K_TIGHT = GOLDEN_RATIO_PHI / (4.0 * math.pi)  # ~0.12875903
SMASH_EV_THRESHOLD = 10.0  # +10.0% EV cutoff (~57.62% Win Prob at -110)

NFL_TEAM_REGISTRY = {
    "Arizona Cardinals":     {"code": "ARI", "lat": 33.5276, "lon": -112.2626, "elev_m": 328,  "is_dome": True,  "tz": -7, "epa": -0.015, "qb_delta": 0.0, "to_reg": 0.1,  "close_pct": 0.480, "streak": 1, "rz_dvoa": 0.02},
    "Atlanta Falcons":       {"code": "ATL", "lat": 33.7554, "lon": -84.4010,  "elev_m": 305,  "is_dome": True,  "tz": -5, "epa": 0.035,  "qb_delta": 0.0, "to_reg": -0.2, "close_pct": 0.610, "streak": 2, "rz_dvoa": -0.05},
    "Baltimore Ravens":      {"code": "BAL", "lat": 39.2780, "lon": -76.6227,  "elev_m": 10,   "is_dome": False, "tz": -5, "epa": 0.145,  "qb_delta": 0.0, "to_reg": -0.3, "close_pct": 0.890, "streak": 3, "rz_dvoa": -0.18},
    "Buffalo Bills":         {"code": "BUF", "lat": 42.7738, "lon": -78.7870,  "elev_m": 182,  "is_dome": False, "tz": -5, "epa": 0.125,  "qb_delta": 0.0, "to_reg": -0.4, "close_pct": 0.865, "streak": 4, "rz_dvoa": -0.16},
    "Carolina Panthers":     {"code": "CAR", "lat": 35.2258, "lon": -80.8528,  "elev_m": 215,  "is_dome": False, "tz": -5, "epa": -0.110, "qb_delta": 0.0, "to_reg": 0.6,  "close_pct": 0.220, "streak": 0, "rz_dvoa": 0.14},
    "Chicago Bears":         {"code": "CHI", "lat": 41.8623, "lon": -87.6167,  "elev_m": 181,  "is_dome": False, "tz": -6, "epa": 0.012,  "qb_delta": 0.0, "to_reg": 0.5,  "close_pct": 0.450, "streak": 0, "rz_dvoa": 0.04},
    "Cincinnati Bengals":    {"code": "CIN", "lat": 39.0955, "lon": -84.5161,  "elev_m": 148,  "is_dome": False, "tz": -5, "epa": 0.068,  "qb_delta": 0.0, "to_reg": -0.1, "close_pct": 0.640, "streak": 1, "rz_dvoa": -0.08},
    "Cleveland Browns":      {"code": "CLE", "lat": 41.5061, "lon": -81.6995,  "elev_m": 177,  "is_dome": False, "tz": -5, "epa": -0.075, "qb_delta": 0.0, "to_reg": 0.4,  "close_pct": 0.350, "streak": 0, "rz_dvoa": 0.09},
    "Dallas Cowboys":        {"code": "DAL", "lat": 32.7473, "lon": -97.0945,  "elev_m": 184,  "is_dome": True,  "tz": -6, "epa": -0.020, "qb_delta": 0.0, "to_reg": 0.3,  "close_pct": 0.490, "streak": 0, "rz_dvoa": 0.06},
    "Denver Broncos":        {"code": "DEN", "lat": 39.7439, "lon": -105.0201, "elev_m": 1609, "is_dome": False, "tz": -7, "epa": 0.042,  "qb_delta": 0.0, "to_reg": 0.2,  "close_pct": 0.781, "streak": 2, "rz_dvoa": -0.18},
    "Detroit Lions":         {"code": "DET", "lat": 42.3400, "lon": -83.0456,  "elev_m": 183,  "is_dome": True,  "tz": -5, "epa": 0.155,  "qb_delta": 0.0, "to_reg": -0.5, "close_pct": 0.920, "streak": 5, "rz_dvoa": -0.21},
    "Green Bay Packers":     {"code": "GB",  "lat": 44.5013, "lon": -88.0622,  "elev_m": 195,  "is_dome": False, "tz": -6, "epa": 0.078,  "qb_delta": 0.0, "to_reg": -0.2, "close_pct": 0.740, "streak": 1, "rz_dvoa": -0.11},
    "Houston Texans":        {"code": "HOU", "lat": 29.6847, "lon": -95.4107,  "elev_m": 15,   "is_dome": True,  "tz": -6, "epa": 0.052,  "qb_delta": 0.0, "to_reg": -0.3, "close_pct": 0.710, "streak": 1, "rz_dvoa": -0.09},
    "Indianapolis Colts":    {"code": "IND", "lat": 39.7601, "lon": -86.1639,  "elev_m": 218,  "is_dome": True,  "tz": -5, "epa": -0.010, "qb_delta": 0.0, "to_reg": 0.1,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.01},
    "Jacksonville Jaguars":  {"code": "JAX", "lat": 30.3240, "lon": -81.6373,  "elev_m": 5,    "is_dome": False, "tz": -5, "epa": -0.045, "qb_delta": 0.0, "to_reg": 0.4,  "close_pct": 0.380, "streak": 0, "rz_dvoa": 0.08},
    "Kansas City Chiefs":    {"code": "KC",  "lat": 39.0489, "lon": -94.4839,  "elev_m": 250,  "is_dome": False, "tz": -6, "epa": 0.115,  "qb_delta": 0.0, "to_reg": -0.1, "close_pct": 0.906, "streak": 4, "rz_dvoa": -0.14},
    "Las Vegas Raiders":     {"code": "LV",  "lat": 36.0909, "lon": -115.1833, "elev_m": 610,  "is_dome": True,  "tz": -8, "epa": -0.085, "qb_delta": 0.0, "to_reg": 0.5,  "close_pct": 0.290, "streak": 0, "rz_dvoa": 0.11},
    "Los Angeles Chargers":  {"code": "LAC", "lat": 33.9535, "lon": -118.3390, "elev_m": 40,   "is_dome": True,  "tz": -8, "epa": 0.048,  "qb_delta": 0.0, "to_reg": -0.4, "close_pct": 0.760, "streak": 3, "rz_dvoa": -0.15},
    "Los Angeles Rams":      {"code": "LAR", "lat": 33.9535, "lon": -118.3390, "elev_m": 40,   "is_dome": True,  "tz": -8, "epa": 0.038,  "qb_delta": 0.0, "to_reg": 0.0,  "close_pct": 0.620, "streak": 2, "rz_dvoa": -0.04},
    "Miami Dolphins":        {"code": "MIA", "lat": 25.9580, "lon": -80.2389,  "elev_m": 3,    "is_dome": False, "tz": -5, "epa": 0.025,  "qb_delta": 0.0, "to_reg": 0.1,  "close_pct": 0.550, "streak": 1, "rz_dvoa": -0.03},
    "Minnesota Vikings":     {"code": "MIN", "lat": 44.9736, "lon": -93.2575,  "elev_m": 255,  "is_dome": True,  "tz": -6, "epa": 0.092,  "qb_delta": 0.0, "to_reg": -0.3, "close_pct": 0.830, "streak": 2, "rz_dvoa": -0.17},
    "New England Patriots":  {"code": "NE",  "lat": 42.0909, "lon": -71.2643,  "elev_m": 78,   "is_dome": False, "tz": -5, "epa": -0.095, "qb_delta": 0.0, "to_reg": 0.2,  "close_pct": 0.310, "streak": 0, "rz_dvoa": 0.10},
    "New Orleans Saints":    {"code": "NO",  "lat": 29.9511, "lon": -90.0812,  "elev_m": 2,    "is_dome": True,  "tz": -6, "epa": -0.055, "qb_delta": 0.0, "to_reg": 0.2,  "close_pct": 0.410, "streak": 0, "rz_dvoa": 0.05},
    "New York Giants":       {"code": "NYG", "lat": 40.8128, "lon": -74.0742,  "elev_m": 2,    "is_dome": False, "tz": -5, "epa": -0.088, "qb_delta": 0.0, "to_reg": 0.3,  "close_pct": 0.280, "streak": 0, "rz_dvoa": 0.09},
    "New York Jets":         {"code": "NYJ", "lat": 40.8128, "lon": -74.0742,  "elev_m": 2,    "is_dome": False, "tz": -5, "epa": -0.030, "qb_delta": 0.0, "to_reg": 0.1,  "close_pct": 0.460, "streak": 0, "rz_dvoa": 0.02},
    "Philadelphia Eagles":   {"code": "PHI", "lat": 39.9008, "lon": -75.1675,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.118,  "qb_delta": 0.0, "to_reg": -0.2, "close_pct": 0.850, "streak": 4, "rz_dvoa": -0.15},
    "Pittsburgh Steelers":   {"code": "PIT", "lat": 40.4468, "lon": -80.0158,  "elev_m": 223,  "is_dome": False, "tz": -5, "epa": 0.065,  "qb_delta": 0.0, "to_reg": -0.6, "close_pct": 0.840, "streak": 3, "rz_dvoa": -0.19},
    "San Francisco 49ers":   {"code": "SF",  "lat": 37.4032, "lon": -121.9698, "elev_m": 7,    "is_dome": False, "tz": -8, "epa": 0.105,  "qb_delta": 0.0, "to_reg": 0.1,  "close_pct": 0.790, "streak": 2, "rz_dvoa": -0.12},
    "Seattle Seahawks":      {"code": "SEA", "lat": 47.5952, "lon": -122.3316, "elev_m": 4,    "is_dome": False, "tz": -8, "epa": 0.015,  "qb_delta": 0.0, "to_reg": 0.2,  "close_pct": 0.560, "streak": 1, "rz_dvoa": 0.01},
    "Tampa Bay Buccaneers":  {"code": "TB",  "lat": 27.9759, "lon": -82.5033,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.085,  "qb_delta": 0.0, "to_reg": -0.4, "close_pct": 0.812, "streak": 2, "rz_dvoa": -0.12},
    "Tennessee Titans":      {"code": "TEN", "lat": 36.1665, "lon": -86.7713,  "elev_m": 130,  "is_dome": False, "tz": -6, "epa": -0.090, "qb_delta": 0.0, "to_reg": 0.5,  "close_pct": 0.260, "streak": 0, "rz_dvoa": 0.12},
    "Washington Commanders": {"code": "WAS", "lat": 38.9076, "lon": -76.8645,  "elev_m": 60,   "is_dome": False, "tz": -5, "epa": 0.110,  "qb_delta": 0.0, "to_reg": -0.3, "close_pct": 0.805, "streak": 3, "rz_dvoa": -0.13}
}

ESPN_CODE_MAP = {"WSH": "WAS", "JAC": "JAX"}

def calc_haversine_miles(lat1, lon1, lat2, lon2):
    r_miles = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    return round(2.0 * r_miles * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)), 1)

def fetch_live_stadium_weather(home_meta):
    lat = home_meta.get("lat", 40.0)
    lon = home_meta.get("lon", -80.0)
    is_dome = home_meta.get("is_dome", False)
    elev_m = home_meta.get("elev_m", 0)

    weather_payload = {
        "temperature_f": 72.0 if is_dome else 58.0,
        "wind_mph": 0.0 if is_dome else 6.5,
        "pressure_hpa": 1013.25,
        "is_dome": is_dome,
        "elevation_m": elev_m
    }

    if is_dome:
        return weather_payload

    # 3-Strike Retry Loop: Prioritizes absolute accuracy over scraper speed
    for attempt in range(3):
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,wind_speed_10m,surface_pressure"
                f"&temperature_unit=fahrenheit&wind_speed_unit=mph"
            )
            # Full 10-second window to let the weather API respond
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                weather_payload["temperature_f"] = data.get("temperature_2m", 58.0)
                weather_payload["wind_mph"] = data.get("wind_speed_10m", 6.5)
                weather_payload["pressure_hpa"] = data.get("surface_pressure", 1013.25)
                break  # Success! Exit the loop immediately.
        except Exception:
            time.sleep(2)  # Wait 2 seconds and try again if the API is jammed
            
    return weather_payload

def fetch_espn_scores():
    score_lookup = {}
    now_utc = datetime.now(timezone.utc)
    start_str = (now_utc - timedelta(days=10)).strftime("%Y%m%d")
    end_str = (now_utc + timedelta(days=7)).strftime("%Y%m%d")
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates={start_str}-{end_str}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            events = resp.json().get("events", [])
            for ev in events:
                comps = ev.get("competitions", [])
                if not comps:
                    continue
                comp = comps[0]
                status_type = comp.get("status", {}).get("type", {})
                state = status_type.get("state", "pre")
                completed = bool(status_type.get("completed", False))

                competitors = comp.get("competitors", [])
                home_c = next((c for c in competitors if c.get("homeAway") == "home"), None)
                away_c = next((c for c in competitors if c.get("homeAway") == "away"), None)
                if not home_c or not away_c:
                    continue

                h_abbr = ESPN_CODE_MAP.get(home_c.get("team", {}).get("abbreviation", ""), home_c.get("team", {}).get("abbreviation", ""))
                a_abbr = ESPN_CODE_MAP.get(away_c.get("team", {}).get("abbreviation", ""), away_c.get("team", {}).get("abbreviation", ""))
                h_score = int(float(home_c.get("score", 0) or 0))
                a_score = int(float(away_c.get("score", 0) or 0))

                score_lookup[f"{a_abbr}_{h_abbr}"] = {
                    "state": state,
                    "completed": completed,
                    "home_score": h_score,
                    "away_score": a_score
                }
    except Exception as e:
        print(f"[ESPN Scoreboard Notice] {e}")
    return score_lookup

def calc_coupled_balls_deep_psi(home_meta, away_meta, env_weather):
    h = float(env_weather.get("elevation_m", 0))
    re = 6371000.0
    g_sea = 9.80665
    g_alt = g_sea * ((re / (re + h)) ** 2)
    delta_g = g_alt - g_sea

    temp_f = float(env_weather.get("temperature_f", 72.0))
    temp_k = ((temp_f - 32.0) * 5.0 / 9.0) + 273.15
    p_pa = float(env_weather.get("pressure_hpa", 1013.25)) * 100.0
    pv_pa = 1000.0
    pd_pa = max(0.0, p_pa - pv_pa)
    rho_air = 1.204 if env_weather.get("is_dome") else ((pd_pa / (287.058 * temp_k)) + (pv_pa / (461.495 * temp_k)))

    f_h2o = 0.62
    f_lean = 1.0 - f_h2o - 0.015
    trace_sum = (0.00006 / 7874) + (0.0005 / 1738) + (0.012 / 1550) + (0.002 / 862) + (0.0015 / 968)
    inv_base = (f_h2o / 997.0) + (f_lean / 1100.0) + trace_sum
    rho_player_h = (1.0 / inv_base) - rho_air
    rho_player_0 = (1.0 / inv_base) - 1.225

    delta_fg_bio = 95.0 * (f_h2o + 0.014) * delta_g
    po2_drop = 1.0 - math.exp(-h / 8500.0)
    phi_bio_raw = (100.0 * (delta_fg_bio / (95.0 * g_sea))) + (10.0 * ((rho_player_h / rho_player_0) - 1.0)) + (2.5 * 1.45 * po2_drop)

    close_mult = 0.786 if home_meta["close_pct"] >= 0.53 else 0.618
    phi_bio = phi_bio_raw * close_mult

    h_rank = home_meta["close_pct"]
    a_rank = away_meta["close_pct"]
    h_4q = 0.786 if h_rank >= 0.53 else 0.618
    a_4q = 0.786 if a_rank >= 0.53 else 0.618

    h_tov = 3.85 * (1.0 - away_meta["rz_dvoa"]) * ((0.382 + h_4q) * h_rank)
    a_tov = 3.85 * (1.0 - home_meta["rz_dvoa"]) * ((0.382 + a_4q) * a_rank)
    net_tov = h_tov - a_tov

    sum_val = phi_bio + net_tov
    sign = 1.0 if sum_val > 0 else (-1.0 if sum_val < 0 else 0.0)
    return round(sign * math.sqrt(abs(phi_bio * net_tov)), 4)

def calc_ev_pct(win_prob, american_odds=-110):
    dec = (american_odds / 100.0) + 1.0 if american_odds > 0 else (100.0 / abs(american_odds)) + 1.0
    b = dec - 1.0
    return round(((win_prob * b) - (1.0 - win_prob)) * 100.0, 2)

def load_existing_ledger():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                if "historical_ledger" in old_data and isinstance(old_data["historical_ledger"], dict):
                    return old_data["historical_ledger"]
        except Exception:
            pass
    return {"entries": {}, "summary": {}}

def fetch_live_odds():
    if not ODDS_API_KEY or ODDS_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        print("[Notice] No valid ODDS_API_KEY set.")
        return []
    url = (
        f"https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/"
        f"?apiKey={ODDS_API_KEY}&regions=us&markets=spreads,totals&oddsFormat=american"
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            remaining = resp.headers.get("x-requests-remaining", "Unknown")
            print(f"[Odds API] Connected! Credits Remaining This Month: {remaining}")
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[Odds API Error] {e}")
        return []

def update_and_grade_ledger(ledger, games_slate, espn_scores, now_utc):
    entries = ledger.get("entries", {})

    for g in games_slate:
        gid = g["game_id"]
        commence_str = g.get("commence_time", "")
        is_past_kickoff = False
        if commence_str:
            try:
                dt_kick = datetime.strptime(commence_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                is_past_kickoff = (now_utc >= dt_kick)
            except Exception:
                pass

        spread_props = [p for p in g.get("props_board", []) if p.get("market_type") == "spread"]
        total_props = [p for p in g.get("props_board", []) if p.get("market_type") == "total"]
        if not spread_props:
            continue

        best_spread = max(spread_props, key=lambda x: x.get("ev_pct", -100.0))
        best_total = total_props[0] if total_props else None

        existing = entries.get(gid)
        if not existing:
            existing = {
                "game_id": gid,
                "matchup": f"{g['away_team']} @ {g['home_team']}",
                "home_team": g["home_team"],
                "away_team": g["away_team"],
                "commence_time": commence_str,
                "is_locked": is_past_kickoff,
                "status": "IN_PLAY" if is_past_kickoff else "PRE_GAME",
                "final_score": None,
                "spread_record": None,
                "total_record": None
            }

        if not existing.get("is_locked", False):
            existing["commence_time"] = commence_str
            existing["is_locked"] = is_past_kickoff
            existing["status"] = "IN_PLAY" if is_past_kickoff else "PRE_GAME"
            existing["spread_record"] = {
                "pick_label": best_spread["player"],
                "pick_team": g["home_team"] if best_spread["player"].startswith(f"{g['home_team']} ") else g["away_team"],
                "vegas_closing_line": best_spread["base_line"],
                "odds": best_spread["base_odds_over"],
                "tip_proj": best_spread["projected_mean_mu"],
                "tip_win_pct": round(best_spread["model_win_prob"] * 100, 2),
                "tip_ev_pct": best_spread.get("ev_pct", 0.0),
                "balls_deep_proj": best_spread.get("balls_deep_proj", best_spread["projected_mean_mu"]),
                "balls_deep_win_pct": round(best_spread.get("balls_deep_win_prob", best_spread["model_win_prob"]) * 100, 2),
                "balls_deep_ev_pct": best_spread.get("balls_deep_ev_pct", best_spread.get("ev_pct", 0.0)),
                "tier_badge": best_spread.get("tier_badge", "PASS"),
                "flagship_slot": best_spread.get("flagship_slot", ""),
                "result_tip": "PENDING",
                "result_balls_deep": "PENDING"
            }
            if best_total:
                existing["total_record"] = {
                    "pick_label": best_total["player"],
                    "vegas_closing_line": best_total["base_line"],
                    "odds": best_total["base_odds_over"],
                    "tip_proj": best_total["projected_mean_mu"],
                    "tip_direction": "U" if best_total["projected_mean_mu"] < best_total["base_line"] else "O",
                    "tip_win_pct": round(best_total["model_win_prob"] * 100, 2),
                    "tip_ev_pct": best_total.get("ev_pct", 0.0),
                    "balls_deep_proj": best_total.get("balls_deep_proj", best_total["projected_mean_mu"]),
                    "balls_deep_direction": "U" if best_total.get("balls_deep_proj", best_total["projected_mean_mu"]) < best_total["base_line"] else "O",
                    "balls_deep_win_pct": round(best_total.get("balls_deep_win_prob", best_total["model_win_prob"]) * 100, 2),
                    "balls_deep_ev_pct": best_total.get("balls_deep_ev_pct", best_total.get("ev_pct", 0.0)),
                    "tier_badge": best_total.get("tier_badge", "PASS"),
                    "flagship_slot": best_total.get("flagship_slot", ""),
                    "result_tip": "PENDING",
                    "result_balls_deep": "PENDING"
                }

        entries[gid] = existing

    for gid, entry in entries.items():
        match_key = f"{entry['away_team']}_{entry['home_team']}"
        espn_info = espn_scores.get(match_key)
        if not espn_info:
            continue

        if espn_info["state"] == "in" and entry["status"] == "PRE_GAME":
            entry["is_locked"] = True
            entry["status"] = "IN_PLAY"

        if espn_info["completed"] or espn_info["state"] == "post":
            h_pts = espn_info["home_score"]
            a_pts = espn_info["away_score"]
            entry["is_locked"] = True
            entry["status"] = "FINAL"
            entry["final_score"] = f"{entry['away_team']} {a_pts} - {entry['home_team']} {h_pts}"

            s_rec = entry.get("spread_record")
            if s_rec and s_rec.get("result_tip") == "PENDING":
                pick_team = s_rec["pick_team"]
                line = float(s_rec["vegas_closing_line"])
                team_margin = (h_pts - a_pts) if pick_team == entry["home_team"] else (a_pts - h_pts)
                cover_diff = team_margin + line
                grade = "HIT" if cover_diff > 0 else ("MISS" if cover_diff < 0 else "PUSH")
                s_rec["result_tip"] = grade

                bd_proj = float(s_rec.get("balls_deep_proj", s_rec["tip_proj"]))
                bd_same_side = (line - bd_proj) >= 0
                if bd_same_side:
                    s_rec["result_balls_deep"] = grade
                else:
                    s_rec["result_balls_deep"] = "MISS" if grade == "HIT" else ("HIT" if grade == "MISS" else "PUSH")

            t_rec = entry.get("total_record")
            if t_rec and t_rec.get("result_tip") == "PENDING":
                total_pts = h_pts + a_pts
                t_line = float(t_rec["vegas_closing_line"])
                for mode_key, dir_key in [("result_tip", "tip_direction"), ("result_balls_deep", "balls_deep_direction")]:
                    direction = t_rec.get(dir_key, "O")
                    if total_pts == t_line:
                        t_rec[mode_key] = "PUSH"
                    elif direction == "O":
                        t_rec[mode_key] = "HIT" if total_pts > t_line else "MISS"
                    else:
                        t_rec[mode_key] = "HIT" if total_pts < t_line else "MISS"

    counters = {
        "overall_smash": {"hits": 0, "total": 0},
        "spread_smash": {"hits": 0, "total": 0},
        "total_smash": {"hits": 0, "total": 0},
        "flagship_5pack": {"hits": 0, "total": 0},
        "menage_a_trois": {"hits": 0, "total": 0},
        "pass_audit": {"hits": 0, "total": 0},
        "tip_all": {"hits": 0, "total": 0},
        "balls_deep_all": {"hits": 0, "total": 0}
    }

    def tally(bucket, result_str):
        if result_str in ("HIT", "MISS"):
            counters[bucket]["total"] += 1
            if result_str == "HIT":
                counters[bucket]["hits"] += 1

    for entry in entries.values():
        for m_type, rec in [("spread", entry.get("spread_record")), ("total", entry.get("total_record"))]:
            if not rec:
                continue
            res_tip = rec.get("result_tip", "PENDING")
            res_bd = rec.get("result_balls_deep", "PENDING")
            if res_tip not in ("HIT", "MISS"):
                continue

            tally("tip_all", res_tip)
            tally("balls_deep_all", res_bd)

            if rec.get("tier_badge") == "SMASH":
                tally("overall_smash", res_tip)
                tally("spread_smash" if m_type == "spread" else "total_smash", res_tip)
            else:
                tally("pass_audit", res_tip)

            slot = rec.get("flagship_slot", "")
            if slot:
                tally("flagship_5pack", res_tip)
                if "MÉNAGE" in slot.upper():
                    tally("menage_a_trois", res_tip)

    summary_out = {}
    for k, v in counters.items():
        h, t = v["hits"], v["total"]
        pct = round((h / t) * 100.0, 1) if t > 0 else 0.0
        summary_out[k] = {"hits": h, "total": t, "fraction": f"{h} / {t}", "win_pct": pct}

    return {"entries": entries, "summary": summary_out}

def build_master_payload():
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    espn_scores = fetch_espn_scores()
    raw_odds = fetch_live_odds()
    raw_odds.sort(key=lambda g: g.get("commence_time", ""))

    target_event_id = None  # Locked to None to conserve 500-credit monthly budget

    games_slate = []
    seen_matchups = set()
    default_meta = {
        "code": "NFL", "lat": 40.0, "lon": -80.0, "elev_m": 100, "is_dome": False,
        "tz": -5, "epa": 0.0, "qb_delta": 0.0, "to_reg": 0.0, "close_pct": 0.500, "streak": 0, "rz_dvoa": 0.0
    }

    for game in raw_odds:
        home_full = game.get("home_team", "Unknown Home")
        away_full = game.get("away_team", "Unknown Away")

        home_meta = NFL_TEAM_REGISTRY.get(home_full, default_meta)
        away_meta = NFL_TEAM_REGISTRY.get(away_full, default_meta)
        home_code, away_code = home_meta["code"], away_meta["code"]

        matchup_pair = tuple(sorted([home_code, away_code]))
        if matchup_pair in seen_matchups:
            continue
        seen_matchups.add(matchup_pair)
        game_id = f"{away_code}_{home_code}_2026"

        travel_miles = calc_haversine_miles(away_meta["lat"], away_meta["lon"], home_meta["lat"], home_meta["lon"])
        tz_shift = home_meta["tz"] - away_meta["tz"]

        commence_str = game.get("commence_time", "")
        kickoff_local_hour = 13
        if commence_str:
            try:
                dt_utc = datetime.strptime(commence_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                dt_local = dt_utc + timedelta(hours=home_meta["tz"])
                kickoff_local_hour = dt_local.hour
            except Exception:
                pass

        env_weather = fetch_live_stadium_weather(home_meta)
        wind_mph = 0.0 if env_weather.get("is_dome") else float(env_weather.get("wind_mph", 0.0))

        abs_tz = abs(tz_shift)
        omega_dir = 1.35 if tz_shift > 0 else (0.85 if tz_shift < 0 else 1.0)
        body_clock = kickoff_local_hour - tz_shift
        trough_pen = max(0.0, 13.0 - body_clock)
        phi_circ = round(0.45 * (abs_tz * omega_dir * math.exp(-0.35 * 1.0)) + (0.30 * trough_pen), 3)

        # Pure EPA + Turnover Regression + Pi/Phi HFA + Circadian (No QB Delta double-counting)
        epa_diff = away_meta["epa"] - home_meta["epa"]
        delta_to = away_meta["to_reg"] - home_meta["to_reg"]
        psi_11_12 = calc_coupled_balls_deep_psi(home_meta, away_meta, env_weather)

        fair_home_tip = round((GOLDEN_PLAY_SCALER * epa_diff) + delta_to - PI_OVER_PHI_HFA - phi_circ, 2)
        fair_home_bd = round(fair_home_tip + psi_11_12, 2)

        props_board = []
        book = next((b for b in game.get("bookmakers", []) if b["key"] == "fanduel"), None) or \
               next((b for b in game.get("bookmakers", []) if b["key"] == "draftkings"), None) or \
               (game.get("bookmakers")[0] if game.get("bookmakers") else None)

        if book:
            spread_market = next((m for m in book.get("markets", []) if m["key"] == "spreads"), None)
            if spread_market:
                for out in spread_market.get("outcomes", []):
                    point = float(out.get("point", 0.0))
                    price = int(out.get("price", -110))
                    team_name = out.get("name")
                    is_away = (team_name == away_full)
                    t_code = away_code if is_away else home_code
                    opp_code = home_code if is_away else away_code
                    prefix = "@" if is_away else "vs"

                    model_tip_spread = round(-fair_home_tip if is_away else fair_home_tip, 2)
                    model_bd_spread = round(-fair_home_bd if is_away else fair_home_bd, 2)

                    tip_edge_pts = point - model_tip_spread
                    bd_edge_pts = point - model_bd_spread

                    win_prob_tip = max(0.01, min(0.99, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * tip_edge_pts))))
                    win_prob_bd = max(0.01, min(0.99, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * bd_edge_pts))))

                    ev_tip = calc_ev_pct(win_prob_tip, price)
                    ev_bd = calc_ev_pct(win_prob_bd, price)
                    badge = "SMASH" if ev_tip >= SMASH_EV_THRESHOLD else "PASS"

                    props_board.append({
                        "player": f"{t_code} Spread ({'+' if point > 0 else ''}{point}) ({t_code} {prefix} {opp_code})",
                        "market_type": "spread",
                        "model_win_prob": round(win_prob_tip, 4),
                        "projected_mean_mu": model_tip_spread,
                        "balls_deep_proj": model_bd_spread,
                        "balls_deep_win_prob": round(win_prob_bd, 4),
                        "ev_pct": ev_tip,
                        "balls_deep_ev_pct": ev_bd,
                        "tier_badge": badge,
                        "flagship_slot": "",
                        "projected_variance_sigma2": 0,
                        "base_line": point,
                        "base_odds_over": price,
                        "base_odds_under": -110,
                        "alt_line": point - 2.5,
                        "alt_odds_over": -165
                    })

            total_market = next((m for m in book.get("markets", []) if m["key"] == "totals"), None)
            if total_market:
                over_out = next((o for o in total_market.get("outcomes", []) if o.get("name") == "Over"), None)
                under_out = next((o for o in total_market.get("outcomes", []) if o.get("name") == "Under"), None)
                if over_out and under_out:
                    t_point = float(over_out.get("point", 0.0))
                    o_price = int(over_out.get("price", -110))
                    u_price = int(under_out.get("price", -110))

                    # Pure EPA + Red-Zone DVOA + Wind Penalty (No QB Delta double-counting)
                    epa_total_pts = (home_meta["epa"] + away_meta["epa"]) * GOLDEN_PLAY_SCALER
                    rz_total_pts = (home_meta["rz_dvoa"] + away_meta["rz_dvoa"]) * 10.0
                    wind_penalty = max(0.0, (wind_mph - 10.0) * 0.25)

                    proj_total_tip = round(MODEL_TOTAL_INTERCEPT + epa_total_pts + rz_total_pts - wind_penalty, 1)
                    proj_total_bd = round(proj_total_tip + (psi_11_12 * 0.45), 1)

                    is_under = proj_total_tip < t_point
                    active_price = u_price if is_under else o_price

                    total_diff_tip = abs(proj_total_tip - t_point)
                    total_diff_bd = abs(proj_total_bd - t_point)

                    calc_prob_tip = max(0.50, min(0.99, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * total_diff_tip))))
                    calc_prob_bd = max(0.50, min(0.99, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * total_diff_bd))))

                    ev_tip = calc_ev_pct(calc_prob_tip, active_price)
                    ev_bd = calc_ev_pct(calc_prob_bd, active_price)
                    badge = "SMASH" if ev_tip >= SMASH_EV_THRESHOLD else "PASS"

                    props_board.append({
                        "player": f"{away_code}@{home_code} Total ({'U' if is_under else 'O'} {t_point}) ({away_code} @ {home_code})",
                        "market_type": "total",
                        "model_win_prob": round(calc_prob_tip, 4),
                        "projected_mean_mu": proj_total_tip,
                        "balls_deep_proj": proj_total_bd,
                        "balls_deep_win_prob": round(calc_prob_bd, 4),
                        "ev_pct": ev_tip,
                        "balls_deep_ev_pct": ev_bd,
                        "tier_badge": badge,
                        "flagship_slot": "",
                        "projected_variance_sigma2": 0,
                        "base_line": t_point,
                        "base_odds_over": active_price,
                        "base_odds_under": o_price if is_under else u_price,
                        "alt_line": t_point + 4.5 if is_under else t_point - 4.5,
                        "alt_odds_over": -165
                    })

        games_slate.append({
            "game_id": game_id,
            "league": "NFL",
            "home_team": home_code,
            "away_team": away_code,
            "commence_time": commence_str,
            "kickoff_local_hour": kickoff_local_hour,
            "expected_plays": 126,
            "environmental_payload": env_weather,
            "circadian_payload": {
                "away_travel_miles": travel_miles,
                "away_tz_shift": tz_shift,
                "rest_differential_days": 0,
                "short_week_flag": 0
            },
            "team_telemetry": {
                "home": {"net_epa_per_play": home_meta["epa"], "qb_replacement_delta": 0.0, "turnover_reg_delta": home_meta["to_reg"], "closing_rank_pct": home_meta["close_pct"], "active_win_streak": home_meta["streak"], "opp_rz_dvoa": home_meta["rz_dvoa"]},
                "away": {"net_epa_per_play": away_meta["epa"], "qb_replacement_delta": 0.0, "turnover_reg_delta": away_meta["to_reg"], "closing_rank_pct": away_meta["close_pct"], "active_win_streak": away_meta["streak"], "opp_rz_dvoa": away_meta["rz_dvoa"]}
            },
            "props_board": props_board
        })

    all_spreads = []
    all_props = []
    for g in games_slate:
        game_spreads = [p for p in g["props_board"] if p["market_type"] == "spread"]
        if game_spreads:
            best_s = max(game_spreads, key=lambda x: x["ev_pct"])
            all_spreads.append(best_s)
            all_props.append(best_s)
        for p in g["props_board"]:
            if p["market_type"] != "spread":
                all_props.append(p)

    all_spreads.sort(key=lambda x: x["ev_pct"], reverse=True)
    menage_picks = all_spreads[:3]
    for idx, p in enumerate(menage_picks, start=1):
        p["flagship_slot"] = f"MÉNAGE À TROIS #{idx}"

    remaining_pool = [p for p in all_props if not p.get("flagship_slot")]
    remaining_pool.sort(key=lambda x: x["ev_pct"], reverse=True)
    for idx, p in enumerate(remaining_pool[:2], start=4):
        p["flagship_slot"] = f"5-PACK FLEX #{idx}"

    existing_ledger = load_existing_ledger()
    updated_ledger = update_and_grade_ledger(existing_ledger, games_slate, espn_scores, now_utc)

    return {
        "slate_info": {"league": "NFL", "week": 11, "last_updated": now_iso},
        "games": games_slate,
        "historical_ledger": updated_ledger
    }

def write_atomic_json(payload, filepath=DATA_FILE):
    temp_path = f"{filepath}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    os.replace(temp_path, filepath)

def run_daemon():
    print("=========================================================")
    print(" DIXPIX QUANTITATIVE ENGINE — LOCAL DAEMON MODE")
    print(f" Target Feed: ./{DATA_FILE} | Refresh Cadence: {POLL_INTERVAL_SECONDS}s")
    print("==========================================================")

    while True:
        try:
            payload = build_master_payload()
            write_atomic_json(payload, DATA_FILE)
            timestamp = payload["slate_info"]["last_updated"]
            print(f"[{timestamp}] Synced {len(payload['games'])} live NFL matchups + graded ledger to {DATA_FILE}")
        except Exception as err:
            print(f"[Scraper Error] {err}")
        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    if os.environ.get("GITHUB_ACTIONS") == "true":
        payload = build_master_payload()
        write_atomic_json(payload, DATA_FILE)
        print(f"[Cloud Scraper] Successfully synced {len(payload['games'])} games & graded ledger to {DATA_FILE}")
    else:
        run_daemon()
