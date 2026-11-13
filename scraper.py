"""
DIXPIX QUANTITATIVE ENGINE — PHASE 6: FULL 32-TEAM TELEMETRY & LIVE ODDS SCRAPER (scraper.py)
Maps The Odds API full team names to stadium physics, Haversine travel mileage,
time-zone shifts, and team EPA/DVOA baselines to calculate true fair-value edges.
"""

import json
import csv
import math
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
import requests

DATA_FILE = "data.json"
POLL_INTERVAL_SECONDS = 14400  # 4 hours to protect free 500-credit monthly quota

# Paste your 32-character key from https://the-odds-api.com inside the quotes below:
ODDS_API_KEY = os.environ.get("DIXPIX_ODDS_API_KEY", "44660163df1724ea28bfc8022e66f9e1")
API_KEY = ODDS_API_KEY

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DixPixQuantEngine/2.0",
    "Accept": "application/json"
}

GOLDEN_PLAY_SCALER = 38.5145
MODEL_TOTAL_INTERCEPT = 42.986
PI_OVER_PHI_HFA = 1.9416110252
LOGISTIC_K_TIGHT = 0.128759

# ==============================================================================
# 1. MASTER 32-TEAM NFL TELEMETRY, STADIUM BAROMETRICS & POWER RATING REGISTRY
# ==============================================================================
NFL_TEAM_REGISTRY = {
    "Arizona Cardinals":     {"code": "ARI", "lat": 33.5276, "lon": -112.2626, "elev_m": 328,  "is_dome": True,  "tz": -7, "epa": -0.015, "qb_delta": 0.0,  "to_reg": 0.1,  "close_pct": 0.480, "streak": 1, "rz_dvoa": 0.02},
    "Atlanta Falcons":       {"code": "ATL", "lat": 33.7554, "lon": -84.4010,  "elev_m": 305,  "is_dome": True,  "tz": -5, "epa": 0.035,  "qb_delta": 0.0,  "to_reg": -0.2, "close_pct": 0.610, "streak": 2, "rz_dvoa": -0.05},
    "Baltimore Ravens":      {"code": "BAL", "lat": 39.2780, "lon": -76.6227,  "elev_m": 10,   "is_dome": False, "tz": -5, "epa": 0.145,  "qb_delta": 0.0,  "to_reg": -0.3, "close_pct": 0.890, "streak": 3, "rz_dvoa": -0.18},
    "Buffalo Bills":         {"code": "BUF", "lat": 42.7738, "lon": -78.7870,  "elev_m": 182,  "is_dome": False, "tz": -5, "epa": 0.125,  "qb_delta": 0.0,  "to_reg": -0.4, "close_pct": 0.865, "streak": 4, "rz_dvoa": -0.16},
    "Carolina Panthers":     {"code": "CAR", "lat": 35.2258, "lon": -80.8528,  "elev_m": 215,  "is_dome": False, "tz": -5, "epa": -0.110, "qb_delta": -2.5, "to_reg": 0.6,  "close_pct": 0.220, "streak": 0, "rz_dvoa": 0.14},
    "Chicago Bears":         {"code": "CHI", "lat": 41.8623, "lon": -87.6167,  "elev_m": 181,  "is_dome": False, "tz": -6, "epa": 0.012,  "qb_delta": 0.0,  "to_reg": 0.5,  "close_pct": 0.450, "streak": 0, "rz_dvoa": 0.04},
    "Cincinnati Bengals":    {"code": "CIN", "lat": 39.0955, "lon": -84.5161,  "elev_m": 148,  "is_dome": False, "tz": -5, "epa": 0.068,  "qb_delta": 0.0,  "to_reg": -0.1, "close_pct": 0.640, "streak": 1, "rz_dvoa": -0.08},
    "Cleveland Browns":      {"code": "CLE", "lat": 41.5061, "lon": -81.6995,  "elev_m": 177,  "is_dome": False, "tz": -5, "epa": -0.075, "qb_delta": -3.0, "to_reg": 0.4,  "close_pct": 0.350, "streak": 0, "rz_dvoa": 0.09},
    "Dallas Cowboys":        {"code": "DAL", "lat": 32.7473, "lon": -97.0945,  "elev_m": 184,  "is_dome": True,  "tz": -6, "epa": -0.020, "qb_delta": -3.5, "to_reg": 0.3,  "close_pct": 0.490, "streak": 0, "rz_dvoa": 0.06},
    "Denver Broncos":        {"code": "DEN", "lat": 39.7439, "lon": -105.0201, "elev_m": 1609, "is_dome": False, "tz": -7, "epa": 0.042,  "qb_delta": 0.0,  "to_reg": 0.2,  "close_pct": 0.781, "streak": 2, "rz_dvoa": -0.18},
    "Detroit Lions":         {"code": "DET", "lat": 42.3400, "lon": -83.0456,  "elev_m": 183,  "is_dome": True,  "tz": -5, "epa": 0.155,  "qb_delta": 0.0,  "to_reg": -0.5, "close_pct": 0.920, "streak": 5, "rz_dvoa": -0.21},
    "Green Bay Packers":     {"code": "GB",  "lat": 44.5013, "lon": -88.0622,  "elev_m": 195,  "is_dome": False, "tz": -6, "epa": 0.078,  "qb_delta": 0.0,  "to_reg": -0.2, "close_pct": 0.740, "streak": 1, "rz_dvoa": -0.11},
    "Houston Texans":        {"code": "HOU", "lat": 29.6847, "lon": -95.4107,  "elev_m": 15,   "is_dome": True,  "tz": -6, "epa": 0.052,  "qb_delta": 0.0,  "to_reg": -0.3, "close_pct": 0.710, "streak": 1, "rz_dvoa": -0.09},
    "Indianapolis Colts":    {"code": "IND", "lat": 39.7601, "lon": -86.1639,  "elev_m": 218,  "is_dome": True,  "tz": -5, "epa": -0.010, "qb_delta": 0.0,  "to_reg": 0.1,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.01},
    "Jacksonville Jaguars":  {"code": "JAX", "lat": 30.3240, "lon": -81.6373,  "elev_m": 5,    "is_dome": False, "tz": -5, "epa": -0.045, "qb_delta": -1.5, "to_reg": 0.4,  "close_pct": 0.380, "streak": 0, "rz_dvoa": 0.08},
    "Kansas City Chiefs":    {"code": "KC",  "lat": 39.0489, "lon": -94.4839,  "elev_m": 250,  "is_dome": False, "tz": -6, "epa": 0.115,  "qb_delta": 0.0,  "to_reg": -0.1, "close_pct": 0.906, "streak": 4, "rz_dvoa": -0.14},
    "Las Vegas Raiders":     {"code": "LV",  "lat": 36.0909, "lon": -115.1833, "elev_m": 610,  "is_dome": True,  "tz": -8, "epa": -0.085, "qb_delta": -2.0, "to_reg": 0.5,  "close_pct": 0.290, "streak": 0, "rz_dvoa": 0.11},
    "Los Angeles Chargers":  {"code": "LAC", "lat": 33.9535, "lon": -118.3390, "elev_m": 40,   "is_dome": True,  "tz": -8, "epa": 0.048,  "qb_delta": 0.0,  "to_reg": -0.4, "close_pct": 0.760, "streak": 3, "rz_dvoa": -0.15},
    "Los Angeles Rams":      {"code": "LAR", "lat": 33.9535, "lon": -118.3390, "elev_m": 40,   "is_dome": True,  "tz": -8, "epa": 0.038,  "qb_delta": 0.0,  "to_reg": 0.0,  "close_pct": 0.620, "streak": 2, "rz_dvoa": -0.04},
    "Miami Dolphins":        {"code": "MIA", "lat": 25.9580, "lon": -80.2389,  "elev_m": 3,    "is_dome": False, "tz": -5, "epa": 0.025,  "qb_delta": 0.0,  "to_reg": 0.1,  "close_pct": 0.550, "streak": 1, "rz_dvoa": -0.03},
    "Minnesota Vikings":     {"code": "MIN", "lat": 44.9736, "lon": -93.2575,  "elev_m": 255,  "is_dome": True,  "tz": -6, "epa": 0.092,  "qb_delta": 0.0,  "to_reg": -0.3, "close_pct": 0.830, "streak": 2, "rz_dvoa": -0.17},
    "New England Patriots":  {"code": "NE",  "lat": 42.0909, "lon": -71.2643,  "elev_m": 78,   "is_dome": False, "tz": -5, "epa": -0.095, "qb_delta": 0.0,  "to_reg": 0.2,  "close_pct": 0.310, "streak": 0, "rz_dvoa": 0.10},
    "New Orleans Saints":    {"code": "NO",  "lat": 29.9511, "lon": -90.0812,  "elev_m": 2,    "is_dome": True,  "tz": -6, "epa": -0.055, "qb_delta": 0.0,  "to_reg": 0.2,  "close_pct": 0.410, "streak": 0, "rz_dvoa": 0.05},
    "New York Giants":       {"code": "NYG", "lat": 40.8128, "lon": -74.0742,  "elev_m": 2,    "is_dome": False, "tz": -5, "epa": -0.088, "qb_delta": -1.5, "to_reg": 0.3,  "close_pct": 0.280, "streak": 0, "rz_dvoa": 0.09},
    "New York Jets":         {"code": "NYJ", "lat": 40.8128, "lon": -74.0742,  "elev_m": 2,    "is_dome": False, "tz": -5, "epa": -0.030, "qb_delta": 0.0,  "to_reg": 0.1,  "close_pct": 0.460, "streak": 0, "rz_dvoa": 0.02},
    "Philadelphia Eagles":   {"code": "PHI", "lat": 39.9008, "lon": -75.1675,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.118,  "qb_delta": 0.0,  "to_reg": -0.2, "close_pct": 0.850, "streak": 4, "rz_dvoa": -0.15},
    "Pittsburgh Steelers":   {"code": "PIT", "lat": 40.4468, "lon": -80.0158,  "elev_m": 223,  "is_dome": False, "tz": -5, "epa": 0.065,  "qb_delta": 0.0,  "to_reg": -0.6, "close_pct": 0.840, "streak": 3, "rz_dvoa": -0.19},
    "San Francisco 49ers":   {"code": "SF",  "lat": 37.4032, "lon": -121.9698, "elev_m": 7,    "is_dome": False, "tz": -8, "epa": 0.105,  "qb_delta": 0.0,  "to_reg": 0.1,  "close_pct": 0.790, "streak": 2, "rz_dvoa": -0.12},
    "Seattle Seahawks":      {"code": "SEA", "lat": 47.5952, "lon": -122.3316, "elev_m": 4,    "is_dome": False, "tz": -8, "epa": 0.015,  "qb_delta": 0.0,  "to_reg": 0.2,  "close_pct": 0.560, "streak": 1, "rz_dvoa": 0.01},
    "Tampa Bay Buccaneers":  {"code": "TB",  "lat": 27.9759, "lon": -82.5033,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.085,  "qb_delta": 0.0,  "to_reg": -0.4, "close_pct": 0.812, "streak": 2, "rz_dvoa": -0.12},
    "Tennessee Titans":      {"code": "TEN", "lat": 36.1665, "lon": -86.7713,  "elev_m": 130,  "is_dome": False, "tz": -6, "epa": -0.090, "qb_delta": -2.0, "to_reg": 0.5,  "close_pct": 0.260, "streak": 0, "rz_dvoa": 0.12},
    "Washington Commanders": {"code": "WAS", "lat": 38.9076, "lon": -76.8645,  "elev_m": 60,   "is_dome": False, "tz": -5, "epa": 0.110,  "qb_delta": 0.0,  "to_reg": -0.3, "close_pct": 0.805, "streak": 3, "rz_dvoa": -0.13}
}

# ==============================================================================
# 2. GEODESIC TRAVEL DISTANCE & SYNOPTIC WEATHER FUNCTIONS
# ==============================================================================
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

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,wind_speed_10m,surface_pressure"
            f"&temperature_unit=fahrenheit&wind_speed_unit=mph"
        )
        resp = requests.get(url, headers=HEADERS, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json().get("current", {})
            weather_payload["temperature_f"] = 72.0 if is_dome else data.get("temperature_2m", 58.0)
            weather_payload["wind_mph"] = 0.0 if is_dome else data.get("wind_speed_10m", 6.5)
            weather_payload["pressure_hpa"] = data.get("surface_pressure", 1013.25)
            
    except Exception:
        print(f"[Telemetry] Warning: Weather API timeout for {lat},{lon}")

    return weather_payload

# ==============================================================================
# 3. LIVE ODDS API FETCHER & TRUE-MARGIN PAYLOAD BUILDER
# ==============================================================================
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

def build_master_payload():
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    raw_odds = fetch_live_odds()
    raw_odds.sort(key=lambda g: g.get("commence_time", ""))

    # LOCKED OUT: Prevents 3-credit burn on player props.
    target_event_id = None
    target_props_data = None

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

        # --- Calculate True Model Spread (Module 8 + Module 9 Synthesis) ---
        epa_diff = away_meta["epa"] - home_meta["epa"]
        delta_qb = away_meta["qb_delta"] - home_meta["qb_delta"]
        delta_to = away_meta["to_reg"] - home_meta["to_reg"]
        
        phi_circ = (0.35 * abs(tz_shift)) + (0.25 * (travel_miles / 1000.0))
        fair_home_spread = round((GOLDEN_PLAY_SCALER * epa_diff) + delta_qb + delta_to - PI_OVER_PHI_HFA - phi_circ, 2)

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

                    model_team_spread = round(-fair_home_spread if is_away else fair_home_spread, 2)
                    spread_edge_pts = point - model_team_spread
                    
                    win_prob = 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * spread_edge_pts))
                    win_prob = max(0.05, min(0.95, win_prob))
                    
                    props_board.append({
                        "player": f"{t_code} Spread ({'+' if point > 0 else ''}{point}) ({t_code} {prefix} {opp_code})",
                        "market_type": "spread",
                        "model_win_prob": round(win_prob, 4),
                        "projected_mean_mu": model_team_spread,
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
                    
                    epa_total_pts = (home_meta["epa"] + away_meta["epa"]) * GOLDEN_PLAY_SCALER
                    qb_total_pts = home_meta["qb_delta"] + away_meta["qb_delta"]
                    rz_total_pts = (home_meta["rz_dvoa"] + away_meta["rz_dvoa"]) * 10.0
                    wind_penalty = max(0.0, (wind_mph - 10.0) * 0.25)

                    proj_total = MODEL_TOTAL_INTERCEPT + epa_total_pts + qb_total_pts + rz_total_pts - wind_penalty
                    is_under = proj_total < t_point
                    
                    total_diff = abs(proj_total - t_point)
                    calc_prob = 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * total_diff))
                    calc_prob = max(0.50, min(0.95, calc_prob))
                    
                    props_board.append({
                        "player": f"{away_code}@{home_code} Total ({'U' if is_under else 'O'} {t_point}) ({away_code} @ {home_code})",
                        "market_type": "total",
                        "model_win_prob": round(calc_prob, 4),
                        "projected_mean_mu": round(proj_total, 1),
                        "projected_variance_sigma2": 0,
                        "base_line": t_point,
                        "base_odds_over": u_price if is_under else o_price,
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
                "home": {"net_epa_per_play": home_meta["epa"], "qb_replacement_delta": home_meta["qb_delta"], "turnover_reg_delta": home_meta["to_reg"], "closing_rank_pct": home_meta["close_pct"], "active_win_streak": home_meta["streak"], "opp_rz_dvoa": home_meta["rz_dvoa"]},
                "away": {"net_epa_per_play": away_meta["epa"], "qb_replacement_delta": away_meta["qb_delta"], "turnover_reg_delta": away_meta["to_reg"], "closing_rank_pct": away_meta["close_pct"], "active_win_streak": away_meta["streak"], "opp_rz_dvoa": away_meta["rz_dvoa"]}
            },
            "props_board": props_board
        })
    return {
        "slate_info": {"league": "NFL", "week": 10, "last_updated": now_iso},
        "games": games_slate
    }

# ==============================================================================
# 4. ATOMIC DISK WRITE & EXECUTION LOOP
# ==============================================================================
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
            print(f"[{timestamp}] Synced {len(payload['games'])} live NFL matchups with full telemetry to {DATA_FILE}")
        except Exception as err:
            print(f"[Scraper Error] {err}")
        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    if os.environ.get("GITHUB_ACTIONS") == "true":
        payload = build_master_payload()
        write_atomic_json(payload, DATA_FILE)
        print(f"[Cloud Scraper] Successfully synced {len(payload['games'])} games to {DATA_FILE}")
    else:
        run_daemon()
