"""
DIXPIX QUANTITATIVE ENGINE — DUAL-LEAGUE NFL + NCAA LIVE TELEMETRY MASTER SCRAPER (v215)
Zero-MD5-Hash, Zero-Vegas-Crutch Live Data Architecture:
  1. The Odds API: Live NFL (2 credits) & NCAA (2 credits) spreads & totals (4 credits/run).
  2. Live 2026 NFL EPA/Play & Turnovers: Pulls real 2026 weekly team stats CSV directly from nflverse-data
     (true Offensive EPA/play - Defensive EPA/play allowed, turnover regression, red-zone defense proxy).
  3. Live 2026 NCAA FBS & NFL FPI: Pulls ESPN Power Index (fitt/v3) + ESPN Standings (PPG For/Against,
     active win streaks, closing win%) + True FCS Tiering (eliminates random MD5 hash EPA bugs).
  4. Live 2026 AP/CFP Top-25 Rankings: Pulls real weekly poll_rank for M13 divergence & Ranked NCAA filter.
  5. Live 2026 NFL Injury Reports: Pulls ESPN game summary injuries to populate qb_replacement_delta,
     lt_or_rb_pass_pro_out, and injuries_summary automatically.
  6. 3-Strike Open-Meteo Synoptic Weather + Zero-Credit ESPN Scoreboard Auto-Grader (NFL + NCAA).
"""

import csv
import io
import json
import math
import os
import re
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import requests

DATA_FILE = "data.json"
POLL_INTERVAL_SECONDS = 14400  # 4 hours

ODDS_API_KEY = os.environ.get("DIXPIX_ODDS_API_KEY", "44660163df1724ea28bfc8022e66f9e1")
API_KEY = ODDS_API_KEY

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DixPixQuantEngine/4.0",
    "Accept": "application/json"
}

GOLDEN_RATIO_PHI = 1.6180339887
GOLDEN_PLAY_SCALER = 38.5145
MODEL_TOTAL_INTERCEPT = 42.986
NCAA_TOTAL_INTERCEPT = 51.450
PI_OVER_PHI_HFA = 1.9416110252
NCAA_HFA_BASE = 2.6180339887  # Phi + 1.0 for College Campus Hostile Environments
LOGISTIC_K_TIGHT = GOLDEN_RATIO_PHI / (4.0 * math.pi)  # ~0.12875903
SMASH_EV_THRESHOLD = 10.0  # +10.0% EV cutoff (~57.62% Win Prob at -110)

# ==============================================================================
# 1. MASTER 32-TEAM NFL STADIUM & BASELINE FALLBACK REGISTRY
#    (Live nflverse 2026 EPA/Turnovers + ESPN Standings/FPI override baseline stats)
# ==============================================================================
NFL_TEAM_REGISTRY = {
    "Arizona Cardinals":     {"code": "ARI", "lat": 33.5276, "lon": -112.2626, "elev_m": 328,  "is_dome": True,  "tz": -7, "epa": -0.015, "to_reg": 0.1,  "close_pct": 0.480, "streak": 1, "rz_dvoa": 0.02},
    "Atlanta Falcons":       {"code": "ATL", "lat": 33.7554, "lon": -84.4010,  "elev_m": 305,  "is_dome": True,  "tz": -5, "epa": 0.035,  "to_reg": -0.2, "close_pct": 0.610, "streak": 2, "rz_dvoa": -0.05},
    "Baltimore Ravens":      {"code": "BAL", "lat": 39.2780, "lon": -76.6227,  "elev_m": 10,   "is_dome": False, "tz": -5, "epa": 0.145,  "to_reg": -0.3, "close_pct": 0.890, "streak": 3, "rz_dvoa": -0.18},
    "Buffalo Bills":         {"code": "BUF", "lat": 42.7738, "lon": -78.7870,  "elev_m": 182,  "is_dome": False, "tz": -5, "epa": 0.125,  "to_reg": -0.4, "close_pct": 0.865, "streak": 4, "rz_dvoa": -0.16},
    "Carolina Panthers":     {"code": "CAR", "lat": 35.2258, "lon": -80.8528,  "elev_m": 215,  "is_dome": False, "tz": -5, "epa": -0.110, "to_reg": 0.6,  "close_pct": 0.220, "streak": 0, "rz_dvoa": 0.14},
    "Chicago Bears":         {"code": "CHI", "lat": 41.8623, "lon": -87.6167,  "elev_m": 181,  "is_dome": False, "tz": -6, "epa": 0.012,  "to_reg": 0.5,  "close_pct": 0.450, "streak": 0, "rz_dvoa": 0.04},
    "Cincinnati Bengals":    {"code": "CIN", "lat": 39.0955, "lon": -84.5161,  "elev_m": 148,  "is_dome": False, "tz": -5, "epa": 0.068,  "to_reg": -0.1, "close_pct": 0.640, "streak": 1, "rz_dvoa": -0.08},
    "Cleveland Browns":      {"code": "CLE", "lat": 41.5061, "lon": -81.6995,  "elev_m": 177,  "is_dome": False, "tz": -5, "epa": -0.075, "to_reg": 0.4,  "close_pct": 0.350, "streak": 0, "rz_dvoa": 0.09},
    "Dallas Cowboys":        {"code": "DAL", "lat": 32.7473, "lon": -97.0945,  "elev_m": 184,  "is_dome": True,  "tz": -6, "epa": -0.020, "to_reg": 0.3,  "close_pct": 0.490, "streak": 0, "rz_dvoa": 0.06},
    "Denver Broncos":        {"code": "DEN", "lat": 39.7439, "lon": -105.0201, "elev_m": 1609, "is_dome": False, "tz": -7, "epa": 0.042,  "to_reg": 0.2,  "close_pct": 0.781, "streak": 2, "rz_dvoa": -0.18},
    "Detroit Lions":         {"code": "DET", "lat": 42.3400, "lon": -83.0456,  "elev_m": 183,  "is_dome": True,  "tz": -5, "epa": 0.155,  "to_reg": -0.5, "close_pct": 0.920, "streak": 5, "rz_dvoa": -0.21},
    "Green Bay Packers":     {"code": "GB",  "lat": 44.5013, "lon": -88.0622,  "elev_m": 195,  "is_dome": False, "tz": -6, "epa": 0.078,  "to_reg": -0.2, "close_pct": 0.740, "streak": 1, "rz_dvoa": -0.11},
    "Houston Texans":        {"code": "HOU", "lat": 29.6847, "lon": -95.4107,  "elev_m": 15,   "is_dome": True,  "tz": -6, "epa": 0.052,  "to_reg": -0.3, "close_pct": 0.710, "streak": 1, "rz_dvoa": -0.09},
    "Indianapolis Colts":    {"code": "IND", "lat": 39.7601, "lon": -86.1639,  "elev_m": 218,  "is_dome": True,  "tz": -5, "epa": -0.010, "to_reg": 0.1,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.01},
    "Jacksonville Jaguars":  {"code": "JAX", "lat": 30.3240, "lon": -81.6373,  "elev_m": 5,    "is_dome": False, "tz": -5, "epa": -0.045, "to_reg": 0.4,  "close_pct": 0.380, "streak": 0, "rz_dvoa": 0.08},
    "Kansas City Chiefs":    {"code": "KC",  "lat": 39.0489, "lon": -94.4839,  "elev_m": 250,  "is_dome": False, "tz": -6, "epa": 0.115,  "to_reg": -0.1, "close_pct": 0.906, "streak": 4, "rz_dvoa": -0.14},
    "Las Vegas Raiders":     {"code": "LV",  "lat": 36.0909, "lon": -115.1833, "elev_m": 610,  "is_dome": True,  "tz": -8, "epa": -0.085, "to_reg": 0.5,  "close_pct": 0.290, "streak": 0, "rz_dvoa": 0.11},
    "Los Angeles Chargers":  {"code": "LAC", "lat": 33.9535, "lon": -118.3390, "elev_m": 40,   "is_dome": True,  "tz": -8, "epa": 0.048,  "to_reg": -0.4, "close_pct": 0.760, "streak": 3, "rz_dvoa": -0.15},
    "Los Angeles Rams":      {"code": "LAR", "lat": 33.9535, "lon": -118.3390, "elev_m": 40,   "is_dome": True,  "tz": -8, "epa": 0.038,  "to_reg": 0.0,  "close_pct": 0.620, "streak": 2, "rz_dvoa": -0.04},
    "Miami Dolphins":        {"code": "MIA", "lat": 25.9580, "lon": -80.2389,  "elev_m": 3,    "is_dome": False, "tz": -5, "epa": 0.025,  "to_reg": 0.1,  "close_pct": 0.550, "streak": 1, "rz_dvoa": -0.03},
    "Minnesota Vikings":     {"code": "MIN", "lat": 44.9736, "lon": -93.2575,  "elev_m": 255,  "is_dome": True,  "tz": -6, "epa": 0.092,  "to_reg": -0.3, "close_pct": 0.830, "streak": 2, "rz_dvoa": -0.17},
    "New England Patriots":  {"code": "NE",  "lat": 42.0909, "lon": -71.2643,  "elev_m": 78,   "is_dome": False, "tz": -5, "epa": -0.095, "to_reg": 0.2,  "close_pct": 0.310, "streak": 0, "rz_dvoa": 0.10},
    "New Orleans Saints":    {"code": "NO",  "lat": 29.9511, "lon": -90.0812,  "elev_m": 2,    "is_dome": True,  "tz": -6, "epa": -0.055, "to_reg": 0.2,  "close_pct": 0.410, "streak": 0, "rz_dvoa": 0.05},
    "New York Giants":       {"code": "NYG", "lat": 40.8128, "lon": -74.0742,  "elev_m": 2,    "is_dome": False, "tz": -5, "epa": -0.088, "to_reg": 0.3,  "close_pct": 0.280, "streak": 0, "rz_dvoa": 0.09},
    "New York Jets":         {"code": "NYJ", "lat": 40.8128, "lon": -74.0742,  "elev_m": 2,    "is_dome": False, "tz": -5, "epa": -0.030, "to_reg": 0.1,  "close_pct": 0.460, "streak": 0, "rz_dvoa": 0.02},
    "Philadelphia Eagles":   {"code": "PHI", "lat": 39.9008, "lon": -75.1675,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.118,  "to_reg": -0.2, "close_pct": 0.850, "streak": 4, "rz_dvoa": -0.15},
    "Pittsburgh Steelers":   {"code": "PIT", "lat": 40.4468, "lon": -80.0158,  "elev_m": 223,  "is_dome": False, "tz": -5, "epa": 0.065,  "to_reg": -0.6, "close_pct": 0.840, "streak": 3, "rz_dvoa": -0.19},
    "San Francisco 49ers":   {"code": "SF",  "lat": 37.4032, "lon": -121.9698, "elev_m": 7,    "is_dome": False, "tz": -8, "epa": 0.105,  "to_reg": 0.1,  "close_pct": 0.790, "streak": 2, "rz_dvoa": -0.12},
    "Seattle Seahawks":      {"code": "SEA", "lat": 47.5952, "lon": -122.3316, "elev_m": 4,    "is_dome": False, "tz": -8, "epa": 0.015,  "to_reg": 0.2,  "close_pct": 0.560, "streak": 1, "rz_dvoa": 0.01},
    "Tampa Bay Buccaneers":  {"code": "TB",  "lat": 27.9759, "lon": -82.5033,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.085,  "to_reg": -0.4, "close_pct": 0.812, "streak": 2, "rz_dvoa": -0.12},
    "Tennessee Titans":      {"code": "TEN", "lat": 36.1665, "lon": -86.7713,  "elev_m": 130,  "is_dome": False, "tz": -6, "epa": -0.090, "to_reg": 0.5,  "close_pct": 0.260, "streak": 0, "rz_dvoa": 0.12},
    "Washington Commanders": {"code": "WAS", "lat": 38.9076, "lon": -76.8645,  "elev_m": 60,   "is_dome": False, "tz": -5, "epa": 0.110,  "to_reg": -0.3, "close_pct": 0.805, "streak": 3, "rz_dvoa": -0.13}
}

# ==============================================================================
# 2. NCAA STADIUM COORDINATES, ALTITUDE & TIMEZONE REGISTRY
#    (Live ESPN FPI + ESPN Standings override performance metrics; zero MD5 hashes!)
# ==============================================================================
NCAA_TEAM_REGISTRY = {
    # High-Altitude Mountain West / Big 12 Venues (Zones 7-10)
    "Wyoming Cowboys":            {"code": "WYO",  "lat": 41.3119, "lon": -105.5681, "elev_m": 2200, "is_dome": False, "tz": -7, "epa": -0.025, "to_reg": 0.2,  "close_pct": 0.460, "streak": 1, "rz_dvoa": 0.02},
    "Air Force Falcons":          {"code": "AFA",  "lat": 38.9969, "lon": -104.8436, "elev_m": 2026, "is_dome": False, "tz": -7, "epa": 0.015,  "to_reg": -0.2, "close_pct": 0.580, "streak": 2, "rz_dvoa": -0.06},
    "Colorado Buffaloes":         {"code": "COLO", "lat": 40.0094, "lon": -105.2669, "elev_m": 1634, "is_dome": False, "tz": -7, "epa": 0.095,  "to_reg": -0.4, "close_pct": 0.790, "streak": 3, "rz_dvoa": -0.14},
    "New Mexico Lobos":           {"code": "UNM",  "lat": 35.0672, "lon": -106.6283, "elev_m": 1554, "is_dome": False, "tz": -7, "epa": -0.010, "to_reg": 0.3,  "close_pct": 0.490, "streak": 1, "rz_dvoa": 0.05},
    "Colorado State Rams":        {"code": "CSU",  "lat": 40.5700, "lon": -105.0886, "elev_m": 1525, "is_dome": False, "tz": -7, "epa": 0.032,  "to_reg": -0.1, "close_pct": 0.620, "streak": 2, "rz_dvoa": -0.05},
    "Utah State Aggies":          {"code": "USU",  "lat": 41.7516, "lon": -111.8116, "elev_m": 1435, "is_dome": False, "tz": -7, "epa": -0.040, "to_reg": 0.3,  "close_pct": 0.390, "streak": 0, "rz_dvoa": 0.08},
    "Utah Utes":                  {"code": "UTAH", "lat": 40.7600, "lon": -111.8489, "elev_m": 1420, "is_dome": False, "tz": -7, "epa": 0.045,  "to_reg": -0.2, "close_pct": 0.680, "streak": 1, "rz_dvoa": -0.11},
    "BYU Cougars":                {"code": "BYU",  "lat": 40.2575, "lon": -111.6545, "elev_m": 1417, "is_dome": False, "tz": -7, "epa": 0.110,  "to_reg": -0.4, "close_pct": 0.840, "streak": 3, "rz_dvoa": -0.15},
    "Nevada Wolf Pack":           {"code": "NEV",  "lat": 39.5469, "lon": -119.8175, "elev_m": 1405, "is_dome": False, "tz": -8, "epa": -0.055, "to_reg": 0.2,  "close_pct": 0.360, "streak": 0, "rz_dvoa": 0.07},
    "New Mexico State Aggies":    {"code": "NMSU", "lat": 32.2797, "lon": -106.7411, "elev_m": 1190, "is_dome": False, "tz": -7, "epa": -0.120, "to_reg": 0.2,  "close_pct": 0.350, "streak": 0, "rz_dvoa": 0.08},
    "UTEP Miners":                {"code": "UTEP", "lat": 31.7733, "lon": -106.5078, "elev_m": 1189, "is_dome": False, "tz": -7, "epa": -0.075, "to_reg": 0.4,  "close_pct": 0.310, "streak": 0, "rz_dvoa": 0.10},
    "Appalachian State Mountaineers": {"code": "APP", "lat": 36.2114, "lon": -81.6856, "elev_m": 1016, "is_dome": False, "tz": -5, "epa": 0.025, "to_reg": 0.0, "close_pct": 0.590, "streak": 1, "rz_dvoa": -0.03},
    "Texas Tech Red Raiders":     {"code": "TTU",  "lat": 33.5911, "lon": -101.8728, "elev_m": 976,  "is_dome": False, "tz": -6, "epa": 0.048,  "to_reg": -0.1, "close_pct": 0.650, "streak": 1, "rz_dvoa": -0.04},
    "Boise State Broncos":        {"code": "BSU",  "lat": 43.6028, "lon": -116.1958, "elev_m": 823,  "is_dome": False, "tz": -7, "epa": 0.142,  "to_reg": -0.4, "close_pct": 0.885, "streak": 5, "rz_dvoa": -0.18},
    "Arizona Wildcats":           {"code": "ARIZ", "lat": 32.2289, "lon": -110.9489, "elev_m": 738,  "is_dome": False, "tz": -7, "epa": 0.060,  "to_reg": 0.0,  "close_pct": 0.600, "streak": 1, "rz_dvoa": -0.05},
    "Arizona State Sun Devils":   {"code": "ASU",  "lat": 33.4264, "lon": -111.9325, "elev_m": 355,  "is_dome": False, "tz": -7, "epa": 0.050,  "to_reg": 0.0,  "close_pct": 0.620, "streak": 1, "rz_dvoa": -0.05},
    # Power-4 & Major FBS Programs
    "Ohio State Buckeyes":        {"code": "OSU",  "lat": 40.0017, "lon": -83.0197,  "elev_m": 217,  "is_dome": False, "tz": -5, "epa": 0.185,  "to_reg": -0.4, "close_pct": 0.945, "streak": 4, "rz_dvoa": -0.22},
    "Oregon Ducks":               {"code": "ORE",  "lat": 44.0583, "lon": -123.0686, "elev_m": 130,  "is_dome": False, "tz": -8, "epa": 0.178,  "to_reg": -0.4, "close_pct": 0.935, "streak": 6, "rz_dvoa": -0.20},
    "Texas Longhorns":            {"code": "TEX",  "lat": 30.2836, "lon": -97.7325,  "elev_m": 165,  "is_dome": False, "tz": -6, "epa": 0.168,  "to_reg": -0.3, "close_pct": 0.915, "streak": 3, "rz_dvoa": -0.19},
    "Georgia Bulldogs":           {"code": "UGA",  "lat": 33.9497, "lon": -83.3733,  "elev_m": 214,  "is_dome": False, "tz": -5, "epa": 0.162,  "to_reg": -0.3, "close_pct": 0.910, "streak": 2, "rz_dvoa": -0.18},
    "Alabama Crimson Tide":       {"code": "ALA",  "lat": 33.2083, "lon": -87.5503,  "elev_m": 68,   "is_dome": False, "tz": -6, "epa": 0.155,  "to_reg": -0.3, "close_pct": 0.895, "streak": 3, "rz_dvoa": -0.17},
    "Penn State Nittany Lions":   {"code": "PSU",  "lat": 40.8122, "lon": -77.8561,  "elev_m": 354,  "is_dome": False, "tz": -5, "epa": 0.148,  "to_reg": -0.3, "close_pct": 0.880, "streak": 2, "rz_dvoa": -0.17},
    "Notre Dame Fighting Irish":  {"code": "ND",   "lat": 41.6983, "lon": -86.2339,  "elev_m": 222,  "is_dome": False, "tz": -5, "epa": 0.152,  "to_reg": -0.5, "close_pct": 0.890, "streak": 5, "rz_dvoa": -0.19},
    "Indiana Hoosiers":           {"code": "IND",  "lat": 39.1808, "lon": -86.5256,  "elev_m": 235,  "is_dome": False, "tz": -5, "epa": 0.145,  "to_reg": -0.4, "close_pct": 0.870, "streak": 4, "rz_dvoa": -0.16},
    "Tennessee Volunteers":       {"code": "TENN", "lat": 35.9550, "lon": -83.9250,  "elev_m": 271,  "is_dome": False, "tz": -5, "epa": 0.138,  "to_reg": -0.3, "close_pct": 0.860, "streak": 2, "rz_dvoa": -0.16},
    "Ole Miss Rebels":            {"code": "MISS", "lat": 34.3619, "lon": -89.5342,  "elev_m": 152,  "is_dome": False, "tz": -6, "epa": 0.144,  "to_reg": -0.3, "close_pct": 0.865, "streak": 3, "rz_dvoa": -0.15},
    "Miami Hurricanes":           {"code": "MIA",  "lat": 25.9580, "lon": -80.2389,  "elev_m": 3,    "is_dome": False, "tz": -5, "epa": 0.135,  "to_reg": -0.2, "close_pct": 0.845, "streak": 2, "rz_dvoa": -0.13},
    "SMU Mustangs":               {"code": "SMU",  "lat": 32.8369, "lon": -96.7828,  "elev_m": 168,  "is_dome": False, "tz": -6, "epa": 0.122,  "to_reg": -0.3, "close_pct": 0.825, "streak": 4, "rz_dvoa": -0.12},
    "Clemson Tigers":             {"code": "CLEM", "lat": 34.6786, "lon": -82.8431,  "elev_m": 205,  "is_dome": False, "tz": -5, "epa": 0.108,  "to_reg": -0.2, "close_pct": 0.795, "streak": 2, "rz_dvoa": -0.11},
    "Texas A&M Aggies":           {"code": "TAMU", "lat": 30.6103, "lon": -96.3397,  "elev_m": 103,  "is_dome": False, "tz": -6, "epa": 0.105,  "to_reg": -0.2, "close_pct": 0.790, "streak": 2, "rz_dvoa": -0.12},
    "Iowa State Cyclones":        {"code": "ISU",  "lat": 42.0140, "lon": -93.6358,  "elev_m": 282,  "is_dome": False, "tz": -6, "epa": 0.088,  "to_reg": -0.2, "close_pct": 0.750, "streak": 1, "rz_dvoa": -0.10},
    "Kansas State Wildcats":      {"code": "KSU",  "lat": 39.2019, "lon": -96.5939,  "elev_m": 330,  "is_dome": False, "tz": -6, "epa": 0.085,  "to_reg": -0.1, "close_pct": 0.740, "streak": 1, "rz_dvoa": -0.09},
    "LSU Tigers":                 {"code": "LSU",  "lat": 30.4119, "lon": -91.1836,  "elev_m": 15,   "is_dome": False, "tz": -6, "epa": 0.092,  "to_reg": 0.1,  "close_pct": 0.755, "streak": 1, "rz_dvoa": -0.08},
    "South Carolina Gamecocks":   {"code": "SCAR", "lat": 33.9731, "lon": -81.0192,  "elev_m": 55,   "is_dome": False, "tz": -5, "epa": 0.112,  "to_reg": -0.4, "close_pct": 0.815, "streak": 3, "rz_dvoa": -0.15},
    "Louisville Cardinals":       {"code": "LOU",  "lat": 38.2058, "lon": -85.7589,  "elev_m": 142,  "is_dome": False, "tz": -5, "epa": 0.090,  "to_reg": -0.1, "close_pct": 0.735, "streak": 1, "rz_dvoa": -0.09},
    "Pittsburgh Panthers":        {"code": "PITT", "lat": 40.4468, "lon": -80.0158,  "elev_m": 223,  "is_dome": False, "tz": -5, "epa": 0.042,  "to_reg": 0.1,  "close_pct": 0.640, "streak": 0, "rz_dvoa": -0.05},
    "West Virginia Mountaineers": {"code": "WVU",  "lat": 39.6503, "lon": -79.9547,  "elev_m": 325,  "is_dome": False, "tz": -5, "epa": 0.028,  "to_reg": 0.1,  "close_pct": 0.595, "streak": 1, "rz_dvoa": -0.03},
    "Michigan Wolverines":        {"code": "MICH", "lat": 42.2658, "lon": -83.7486,  "elev_m": 268,  "is_dome": False, "tz": -5, "epa": 0.018,  "to_reg": 0.1,  "close_pct": 0.610, "streak": 1, "rz_dvoa": -0.06},
    "Michigan State Spartans":    {"code": "MSU",  "lat": 42.7281, "lon": -84.4847,  "elev_m": 258,  "is_dome": False, "tz": -5, "epa": 0.005,  "to_reg": 0.0,  "close_pct": 0.500, "streak": 0, "rz_dvoa": 0.00},
    "USC Trojans":                {"code": "USC",  "lat": 34.0142, "lon": -118.2878, "elev_m": 52,   "is_dome": False, "tz": -8, "epa": 0.065,  "to_reg": 0.1,  "close_pct": 0.680, "streak": 1, "rz_dvoa": -0.07},
    "UCLA Bruins":                {"code": "UCLA", "lat": 34.1613, "lon": -118.1676, "elev_m": 251,  "is_dome": False, "tz": -8, "epa": -0.010, "to_reg": 0.0,  "close_pct": 0.480, "streak": 0, "rz_dvoa": 0.02},
    "Washington Huskies":         {"code": "WASH", "lat": 47.6503, "lon": -122.3017, "elev_m": 12,   "is_dome": False, "tz": -8, "epa": 0.040,  "to_reg": 0.0,  "close_pct": 0.630, "streak": 1, "rz_dvoa": -0.05},
    "Nebraska Cornhuskers":       {"code": "NEB",  "lat": 40.8206, "lon": -96.7056,  "elev_m": 358,  "is_dome": False, "tz": -6, "epa": 0.045,  "to_reg": 0.0,  "close_pct": 0.580, "streak": 1, "rz_dvoa": -0.04},
    "Iowa Hawkeyes":              {"code": "IOWA", "lat": 41.6586, "lon": -91.5511,  "elev_m": 204,  "is_dome": False, "tz": -6, "epa": 0.060,  "to_reg": -0.1, "close_pct": 0.680, "streak": 1, "rz_dvoa": -0.10},
    "Illinois Fighting Illini":   {"code": "ILL",  "lat": 40.0992, "lon": -88.2359,  "elev_m": 225,  "is_dome": False, "tz": -6, "epa": 0.055,  "to_reg": 0.0,  "close_pct": 0.650, "streak": 1, "rz_dvoa": -0.05},
    "Wisconsin Badgers":          {"code": "WIS",  "lat": 43.0700, "lon": -89.4128,  "elev_m": 265,  "is_dome": False, "tz": -6, "epa": 0.030,  "to_reg": 0.0,  "close_pct": 0.550, "streak": 0, "rz_dvoa": -0.03},
    "Minnesota Golden Gophers":   {"code": "MINN", "lat": 44.9765, "lon": -93.2246,  "elev_m": 255,  "is_dome": False, "tz": -6, "epa": 0.035,  "to_reg": 0.0,  "close_pct": 0.560, "streak": 0, "rz_dvoa": -0.04},
    "Purdue Boilermakers":        {"code": "PUR",  "lat": 40.4344, "lon": -86.9184,  "elev_m": 195,  "is_dome": False, "tz": -5, "epa": -0.080, "to_reg": 0.2,  "close_pct": 0.350, "streak": 0, "rz_dvoa": 0.08},
    "Maryland Terrapins":         {"code": "MD",   "lat": 38.9903, "lon": -76.9475,  "elev_m": 41,   "is_dome": False, "tz": -5, "epa": -0.015, "to_reg": 0.1,  "close_pct": 0.480, "streak": 0, "rz_dvoa": 0.02},
    "Rutgers Scarlet Knights":    {"code": "RUTG", "lat": 40.5138, "lon": -74.4649,  "elev_m": 26,   "is_dome": False, "tz": -5, "epa": 0.010,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.00},
    "Northwestern Wildcats":      {"code": "NW",   "lat": 42.0653, "lon": -87.6924,  "elev_m": 182,  "is_dome": False, "tz": -6, "epa": -0.025, "to_reg": 0.1,  "close_pct": 0.450, "streak": 0, "rz_dvoa": 0.03},
    "Oklahoma Sooners":           {"code": "OU",   "lat": 35.2059, "lon": -97.4424,  "elev_m": 357,  "is_dome": False, "tz": -6, "epa": 0.065,  "to_reg": 0.0,  "close_pct": 0.660, "streak": 1, "rz_dvoa": -0.07},
    "Missouri Tigers":            {"code": "MIZZ", "lat": 38.9358, "lon": -92.3332,  "elev_m": 225,  "is_dome": False, "tz": -6, "epa": 0.075,  "to_reg": -0.1, "close_pct": 0.700, "streak": 1, "rz_dvoa": -0.08},
    "Florida Gators":             {"code": "FLA",  "lat": 29.6500, "lon": -82.3486,  "elev_m": 48,   "is_dome": False, "tz": -5, "epa": 0.045,  "to_reg": 0.0,  "close_pct": 0.580, "streak": 1, "rz_dvoa": -0.04},
    "Auburn Tigers":              {"code": "AUB",  "lat": 32.6023, "lon": -85.4892,  "elev_m": 216,  "is_dome": False, "tz": -6, "epa": 0.040,  "to_reg": 0.0,  "close_pct": 0.560, "streak": 0, "rz_dvoa": -0.04},
    "Arkansas Razorbacks":        {"code": "ARK",  "lat": 36.0681, "lon": -94.1789,  "elev_m": 408,  "is_dome": False, "tz": -6, "epa": 0.025,  "to_reg": 0.0,  "close_pct": 0.530, "streak": 0, "rz_dvoa": -0.02},
    "Kentucky Wildcats":          {"code": "UK",   "lat": 38.0227, "lon": -84.5053,  "elev_m": 298,  "is_dome": False, "tz": -5, "epa": 0.015,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": -0.02},
    "Vanderbilt Commodores":      {"code": "VAN",  "lat": 36.1440, "lon": -86.8087,  "elev_m": 173,  "is_dome": False, "tz": -6, "epa": 0.020,  "to_reg": 0.0,  "close_pct": 0.540, "streak": 0, "rz_dvoa": -0.02},
    "Mississippi State Bulldogs": {"code": "MSST", "lat": 33.4563, "lon": -88.7934,  "elev_m": 115,  "is_dome": False, "tz": -6, "epa": -0.030, "to_reg": 0.1,  "close_pct": 0.420, "streak": 0, "rz_dvoa": 0.04},
    "Kansas Jayhawks":            {"code": "KAN",  "lat": 38.9628, "lon": -95.2464,  "elev_m": 265,  "is_dome": False, "tz": -6, "epa": 0.040,  "to_reg": 0.0,  "close_pct": 0.550, "streak": 0, "rz_dvoa": -0.03},
    "TCU Horned Frogs":           {"code": "TCU",  "lat": 32.7097, "lon": -97.3681,  "elev_m": 185,  "is_dome": False, "tz": -6, "epa": 0.035,  "to_reg": 0.0,  "close_pct": 0.560, "streak": 0, "rz_dvoa": -0.03},
    "Baylor Bears":               {"code": "BAY",  "lat": 31.5582, "lon": -97.1157,  "elev_m": 122,  "is_dome": False, "tz": -6, "epa": 0.025,  "to_reg": 0.0,  "close_pct": 0.540, "streak": 0, "rz_dvoa": -0.02},
    "Houston Cougars":            {"code": "HOU",  "lat": 29.7219, "lon": -95.3491,  "elev_m": 15,   "is_dome": False, "tz": -6, "epa": 0.030,  "to_reg": 0.0,  "close_pct": 0.550, "streak": 0, "rz_dvoa": -0.02},
    "Oklahoma State Cowboys":     {"code": "OKST", "lat": 36.1257, "lon": -97.0665,  "elev_m": 295,  "is_dome": False, "tz": -6, "epa": 0.015,  "to_reg": 0.0,  "close_pct": 0.500, "streak": 0, "rz_dvoa": 0.00},
    "UCF Knights":                {"code": "UCF",  "lat": 28.6080, "lon": -81.1924,  "elev_m": 20,   "is_dome": False, "tz": -5, "epa": 0.020,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": -0.01},
    "Cincinnati Bearcats":        {"code": "CIN",  "lat": 39.1312, "lon": -84.5162,  "elev_m": 250,  "is_dome": False, "tz": -5, "epa": 0.030,  "to_reg": 0.0,  "close_pct": 0.540, "streak": 0, "rz_dvoa": -0.02},
    "Georgia Tech Yellow Jackets":{"code": "GT",   "lat": 33.7724, "lon": -84.3928,  "elev_m": 286,  "is_dome": False, "tz": -5, "epa": 0.040,  "to_reg": 0.0,  "close_pct": 0.580, "streak": 1, "rz_dvoa": -0.03},
    "Wake Forest Demon Deacons":  {"code": "WAKE", "lat": 36.1306, "lon": -80.2553,  "elev_m": 272,  "is_dome": False, "tz": -5, "epa": 0.000,  "to_reg": 0.0,  "close_pct": 0.480, "streak": 0, "rz_dvoa": 0.01},
    "Duke Blue Devils":           {"code": "DUKE", "lat": 35.9953, "lon": -78.9417,  "elev_m": 115,  "is_dome": False, "tz": -5, "epa": 0.045,  "to_reg": -0.1, "close_pct": 0.620, "streak": 1, "rz_dvoa": -0.05},
    "North Carolina Tar Heels":   {"code": "UNC",  "lat": 35.9069, "lon": -79.0479,  "elev_m": 146,  "is_dome": False, "tz": -5, "epa": 0.020,  "to_reg": 0.0,  "close_pct": 0.530, "streak": 0, "rz_dvoa": -0.01},
    "NC State Wolfpack":          {"code": "NCST", "lat": 35.8008, "lon": -78.7195,  "elev_m": 122,  "is_dome": False, "tz": -5, "epa": 0.020,  "to_reg": 0.0,  "close_pct": 0.530, "streak": 0, "rz_dvoa": -0.01},
    "Virginia Tech Hokies":       {"code": "VT",   "lat": 37.2200, "lon": -80.4180,  "elev_m": 627,  "is_dome": False, "tz": -5, "epa": 0.035,  "to_reg": 0.0,  "close_pct": 0.560, "streak": 0, "rz_dvoa": -0.03},
    "Virginia Cavaliers":         {"code": "UVA",  "lat": 38.0311, "lon": -78.5137,  "elev_m": 168,  "is_dome": False, "tz": -5, "epa": 0.005,  "to_reg": 0.0,  "close_pct": 0.500, "streak": 0, "rz_dvoa": 0.00},
    "Boston College Eagles":      {"code": "BC",   "lat": 42.3351, "lon": -71.1664,  "elev_m": 56,   "is_dome": False, "tz": -5, "epa": 0.010,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.00},
    "Florida State Seminoles":    {"code": "FSU",  "lat": 30.4381, "lon": -84.3044,  "elev_m": 32,   "is_dome": False, "tz": -5, "epa": 0.020,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": -0.01},
    "California Golden Bears":    {"code": "CAL",  "lat": 37.8710, "lon": -122.2508, "elev_m": 135,  "is_dome": False, "tz": -8, "epa": 0.025,  "to_reg": 0.0,  "close_pct": 0.540, "streak": 0, "rz_dvoa": -0.02},
    "Stanford Cardinal":          {"code": "STAN", "lat": 37.4345, "lon": -122.1611, "elev_m": 25,   "is_dome": False, "tz": -8, "epa": -0.045, "to_reg": 0.1,  "close_pct": 0.400, "streak": 0, "rz_dvoa": 0.04},
    "Tulane Green Wave":          {"code": "TULN", "lat": 29.9447, "lon": -90.1167,  "elev_m": 2,    "is_dome": False, "tz": -6, "epa": 0.118,  "to_reg": -0.4, "close_pct": 0.835, "streak": 4, "rz_dvoa": -0.14},
    "Army Black Knights":         {"code": "ARMY", "lat": 41.3875, "lon": -73.9642,  "elev_m": 102,  "is_dome": False, "tz": -5, "epa": 0.115,  "to_reg": -0.5, "close_pct": 0.840, "streak": 4, "rz_dvoa": -0.15},
    "Navy Midshipmen":            {"code": "NAVY", "lat": 38.9847, "lon": -76.5072,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.060,  "to_reg": -0.2, "close_pct": 0.700, "streak": 2, "rz_dvoa": -0.06},
    "UNLV Rebels":                {"code": "UNLV", "lat": 36.0909, "lon": -115.1833, "elev_m": 610,  "is_dome": True,  "tz": -8, "epa": 0.098,  "to_reg": -0.3, "close_pct": 0.805, "streak": 2, "rz_dvoa": -0.12},
    "Syracuse Orange":            {"code": "SYR",  "lat": 43.0361, "lon": -76.1364,  "elev_m": 165,  "is_dome": True,  "tz": -5, "epa": 0.038,  "to_reg": 0.1,  "close_pct": 0.625, "streak": 1, "rz_dvoa": -0.04},
    "San Diego State Aztecs":     {"code": "SDSU", "lat": 32.7844, "lon": -117.1228, "elev_m": 14,   "is_dome": False, "tz": -8, "epa": -0.025, "to_reg": 0.1,  "close_pct": 0.450, "streak": 0, "rz_dvoa": 0.02},
    "Fresno State Bulldogs":      {"code": "FRES", "lat": 36.8143, "lon": -119.7580, "elev_m": 99,   "is_dome": False, "tz": -8, "epa": 0.030,  "to_reg": 0.0,  "close_pct": 0.560, "streak": 0, "rz_dvoa": -0.02},
    "San Jose State Spartans":    {"code": "SJSU", "lat": 37.3197, "lon": -121.8683, "elev_m": 29,   "is_dome": False, "tz": -8, "epa": 0.010,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.00},
    "Hawaii Rainbow Warriors":    {"code": "HAW",  "lat": 21.2943, "lon": -157.8160, "elev_m": 12,   "is_dome": False, "tz": -10,"epa": -0.050, "to_reg": 0.1,  "close_pct": 0.400, "streak": 0, "rz_dvoa": 0.05},
    "Oregon State Beavers":       {"code": "ORST", "lat": 44.5594, "lon": -123.2814, "elev_m": 72,   "is_dome": False, "tz": -8, "epa": 0.010,  "to_reg": 0.0,  "close_pct": 0.500, "streak": 0, "rz_dvoa": 0.00},
    "Washington State Cougars":   {"code": "WSU",  "lat": 46.7319, "lon": -117.1604, "elev_m": 775,  "is_dome": False, "tz": -8, "epa": 0.045,  "to_reg": -0.1, "close_pct": 0.620, "streak": 1, "rz_dvoa": -0.04},
    "Memphis Tigers":             {"code": "MEM",  "lat": 35.1209, "lon": -89.9771,  "elev_m": 85,   "is_dome": False, "tz": -6, "epa": 0.070,  "to_reg": -0.1, "close_pct": 0.720, "streak": 1, "rz_dvoa": -0.06},
    "South Florida Bulls":        {"code": "USF",  "lat": 27.9759, "lon": -82.5033,  "elev_m": 12,   "is_dome": False, "tz": -5, "epa": 0.015,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": -0.01},
    "East Carolina Pirates":      {"code": "ECU",  "lat": 35.5964, "lon": -77.3652,  "elev_m": 17,   "is_dome": False, "tz": -5, "epa": 0.005,  "to_reg": 0.0,  "close_pct": 0.500, "streak": 0, "rz_dvoa": 0.00},
    "UTSA Roadrunners":           {"code": "UTSA", "lat": 29.4169, "lon": -98.4789,  "elev_m": 198,  "is_dome": True,  "tz": -6, "epa": 0.025,  "to_reg": 0.0,  "close_pct": 0.550, "streak": 0, "rz_dvoa": -0.02},
    "UConn Huskies":              {"code": "CONN", "lat": 41.7596, "lon": -72.6188,  "elev_m": 17,   "is_dome": False, "tz": -5, "epa": 0.010,  "to_reg": 0.0,  "close_pct": 0.520, "streak": 0, "rz_dvoa": 0.00},
    "UMass Minutemen":            {"code": "MASS", "lat": 42.3774, "lon": -72.5361,  "elev_m": 58,   "is_dome": False, "tz": -5, "epa": -0.180, "to_reg": 0.2,  "close_pct": 0.250, "streak": 0, "rz_dvoa": 0.14},
    "Liberty Flames":             {"code": "LIB",  "lat": 37.3544, "lon": -79.1753,  "elev_m": 286,  "is_dome": False, "tz": -5, "epa": 0.055,  "to_reg": -0.1, "close_pct": 0.680, "streak": 1, "rz_dvoa": -0.05},
    "James Madison Dukes":        {"code": "JMU",  "lat": 38.4354, "lon": -78.8732,  "elev_m": 412,  "is_dome": False, "tz": -5, "epa": 0.075,  "to_reg": -0.2, "close_pct": 0.740, "streak": 2, "rz_dvoa": -0.08},
    "North Dakota State Bison":   {"code": "NDSU", "lat": 46.9033, "lon": -96.8017,  "elev_m": 275,  "is_dome": True,  "tz": -6, "epa": -0.220, "to_reg": 0.0,  "close_pct": 0.750, "streak": 3, "rz_dvoa": -0.04},
    "Wofford Terriers":           {"code": "WOF",  "lat": 34.9616, "lon": -81.9333,  "elev_m": 245,  "is_dome": False, "tz": -5, "epa": -0.600, "to_reg": 0.2,  "close_pct": 0.300, "streak": 0, "rz_dvoa": 0.15},
    "Chattanooga Mocs":           {"code": "UTC",  "lat": 35.0365, "lon": -85.3156,  "elev_m": 206,  "is_dome": False, "tz": -5, "epa": -0.580, "to_reg": 0.2,  "close_pct": 0.350, "streak": 0, "rz_dvoa": 0.14},
    "Samford Bulldogs":           {"code": "SAM",  "lat": 33.4658, "lon": -86.7950,  "elev_m": 215,  "is_dome": False, "tz": -6, "epa": -0.600, "to_reg": 0.2,  "close_pct": 0.300, "streak": 0, "rz_dvoa": 0.15},
    "Tennessee Tech Golden Eagles":{"code": "TNTC","lat": 36.1783, "lon": -85.5078,  "elev_m": 340,  "is_dome": False, "tz": -6, "epa": -0.580, "to_reg": 0.2,  "close_pct": 0.320, "streak": 0, "rz_dvoa": 0.14}
}

# Known elite FCS programs (when playing FBS opponents, closer to -12 FPI than generic -23 FPI)
ELITE_FCS_KEYWORDS = {
    "north dakota state", "south dakota state", "montana state", "montana grizzlies",
    "south dakota coyotes", "villanova", "idaho vandals", "uc davis", "tarleton", "mercer"
}

ESPN_CODE_MAP = {"WSH": "WAS", "JAC": "JAX", "LA": "LAR"}
WEATHER_CACHE = {}

# Name aliases for matching Odds API team names to ESPN FPI / Standings names
TEAM_NAME_ALIASES = {
    "ole miss rebels": "ole miss rebels",
    "mississippi rebels": "ole miss rebels",
    "uconn huskies": "uconn huskies",
    "connecticut huskies": "uconn huskies",
    "umass minutemen": "umass minutemen",
    "massachusetts minutemen": "umass minutemen",
    "pitt panthers": "pittsburgh panthers",
    "nc state wolfpack": "nc state wolfpack",
    "north carolina state wolfpack": "nc state wolfpack",
    "app state mountaineers": "appalachian state mountaineers",
    "appalachian state mountaineers": "appalachian state mountaineers",
    "ul monroe warhawks": "louisiana monroe warhawks",
    "louisiana monroe warhawks": "louisiana monroe warhawks",
    "ulm warhawks": "louisiana monroe warhawks",
    "louisiana ragin cajuns": "louisiana ragin cajuns",
    "fiu panthers": "florida international panthers",
    "florida international golden panthers": "florida international panthers",
    "fau owls": "florida atlantic owls",
    "usf bulls": "south florida bulls",
    "ucf knights": "ucf knights",
    "central florida knights": "ucf knights",
    "uab blazers": "uab blazers",
    "utsa roadrunners": "utsa roadrunners",
    "utep miners": "utep miners",
    "unlv rebels": "unlv rebels",
    "smu mustangs": "smu mustangs",
    "tcu horned frogs": "tcu horned frogs",
    "byu cougars": "byu cougars",
    "lsu tigers": "lsu tigers",
    "usc trojans": "usc trojans",
    "ucla bruins": "ucla bruins",
    "miami hurricanes": "miami hurricanes",
    "miami (fl) hurricanes": "miami hurricanes",
    "miami oh redhawks": "miami oh redhawks",
    "miami (oh) redhawks": "miami oh redhawks",
    "hawaii rainbow warriors": "hawaii rainbow warriors",
    "san jose state spartans": "san jose state spartans",
    "sam houston bearkats": "sam houston state bearkats",
    "sam houston state bearkats": "sam houston state bearkats",
    "southern miss golden eagles": "southern mississippi golden eagles",
    "southern mississippi golden eagles": "southern mississippi golden eagles",
    "ut martin skyhawks": "tennessee martin skyhawks"
}

def normalize_team_key(name):
    if not name:
        return ""
    cleaned = name.lower().replace("é", "e").replace("'", "").replace("’", "").replace(".", "").replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned in TEAM_NAME_ALIASES:
        cleaned = TEAM_NAME_ALIASES[cleaned]
    return cleaned

def lookup_by_name(lookup_dict, full_name, code="", allow_code=True):
    """Strict exact-match lookup ONLY (normalized full team name or verified team code).
    ZERO prefix or first-word fuzzy matching so 'Florida Atlantic' / 'Florida International' /
    'Texas State' / 'Georgia State' can NEVER falsely inherit 'Florida' / 'Texas' / 'Georgia'.
    """
    if not lookup_dict:
        return None
    norm = normalize_team_key(full_name)
    if norm in lookup_dict:
        return lookup_dict[norm]
    if allow_code and code and f"code:{code.upper()}" in lookup_dict:
        return lookup_dict[f"code:{code.upper()}"]
    return None

# ==============================================================================
# 3. LIVE 2026 DATA FEEDS (NFLVERSE + ESPN FPI + ESPN STANDINGS + RANKINGS + INJURIES)
# ==============================================================================
def fetch_nflverse_live_team_epa(season_year=2026):
    """
    Pulls real 2026 NFL weekly team stats directly from nflverse-data releases (zero API key).
    Computes true Net EPA/play = (Off EPA/play - Def EPA/play allowed), turnover regression,
    red-zone defense proxy, and league EPA rank (1..32).
    """
    url = f"https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_{season_year}.csv"
    team_stats = {}
    try:
        resp = requests.get(url, headers=HEADERS, timeout=18)
        if resp.status_code != 200:
            print(f"[nflverse Notice] HTTP {resp.status_code} for {season_year} weekly team stats.")
            return {}

        reader = csv.DictReader(io.StringIO(resp.text))
        agg = {}

        def ensure(t):
            if t not in agg:
                agg[t] = {
                    "games": 0, "off_plays": 0.0, "off_epa": 0.0,
                    "def_plays": 0.0, "def_epa_allowed": 0.0,
                    "giveaways": 0.0, "takeaways": 0.0
                }
            return agg[t]

        def fval(row, *keys):
            for k in keys:
                v = row.get(k)
                if v not in (None, "", "NA", "NaN"):
                    try:
                        return float(v)
                    except ValueError:
                        pass
            return 0.0

        for row in reader:
            stype = (row.get("season_type") or "REG").upper()
            if stype not in ("REG", "POST"):
                continue
            raw_t = (row.get("team") or "").strip().upper()
            raw_opp = (row.get("opponent_team") or "").strip().upper()
            if not raw_t:
                continue
            t = ESPN_CODE_MAP.get(raw_t, raw_t)
            opp = ESPN_CODE_MAP.get(raw_opp, raw_opp)

            att = fval(row, "attempts")
            car = fval(row, "carries")
            sacks = fval(row, "sacks_suffered", "sacks")
            plays = att + car + sacks
            pass_epa = fval(row, "passing_epa")
            rush_epa = fval(row, "rushing_epa")
            tot_epa = pass_epa + rush_epa

            giveaways = (
                fval(row, "passing_interceptions", "interceptions")
                + fval(row, "rushing_fumbles_lost")
                + fval(row, "receiving_fumbles_lost")
                + fval(row, "sack_fumbles_lost")
            )

            rec = ensure(t)
            rec["games"] += 1
            rec["off_plays"] += plays
            rec["off_epa"] += tot_epa
            rec["giveaways"] += giveaways

            if opp:
                opp_rec = ensure(opp)
                opp_rec["def_plays"] += plays
                opp_rec["def_epa_allowed"] += tot_epa
                opp_rec["takeaways"] += giveaways

        ranked_list = []
        for t, d in agg.items():
            if d["games"] == 0 or d["off_plays"] <= 0 or d["def_plays"] <= 0:
                continue
            off_epa_pp = d["off_epa"] / d["off_plays"]
            def_epa_pp = d["def_epa_allowed"] / d["def_plays"]
            net_epa_pp = off_epa_pp - def_epa_pp
            to_margin_pg = (d["takeaways"] - d["giveaways"]) / d["games"]
            # Positive turnover margin implies slight mean-reversion penalty (negative to_reg)
            to_reg = max(-0.85, min(0.85, -0.35 * to_margin_pg))
            # Negative opp_rz_dvoa = stronger defense (lower defensive EPA allowed)
            rz_dvoa = max(-0.25, min(0.25, def_epa_pp * 1.45))

            team_stats[f"code:{t}"] = {
                "net_epa_per_play": round(net_epa_pp, 4),
                "off_epa_per_play": round(off_epa_pp, 4),
                "def_epa_per_play": round(def_epa_pp, 4),
                "to_reg": round(to_reg, 2),
                "rz_dvoa": round(rz_dvoa, 3),
                "games_played": d["games"]
            }
            ranked_list.append((net_epa_pp, f"code:{t}"))

        ranked_list.sort(reverse=True)
        for rank_idx, (_, key) in enumerate(ranked_list, start=1):
            team_stats[key]["epa_rank"] = rank_idx

        print(f"[nflverse Live {season_year}] Loaded real Net EPA/play & turnovers for {len(ranked_list)} NFL teams.")
    except Exception as e:
        print(f"[nflverse Notice] Live fetch skipped ({e}); falling back to ESPN FPI/registry.")
    return team_stats

def fetch_espn_fpi(league="NCAA"):
    """
    Pulls live ESPN Football Power Index (fitt/v3) for NCAA FBS (~134 teams) or NFL (32 teams).
    Returns dict keyed by normalized displayName AND 'code:ABBR'.
    FPI is predictive neutral-field points above league average.
    """
    sport_path = "college-football" if league == "NCAA" else "nfl"
    limit = 160 if league == "NCAA" else 40
    url = f"https://site.web.api.espn.com/apis/fitt/v3/sports/football/{sport_path}/powerindex?limit={limit}"
    fpi_map = {}

    try:
        resp = requests.get(url, headers=HEADERS, timeout=14)
        if resp.status_code != 200:
            print(f"[ESPN FPI {league} Notice] HTTP {resp.status_code}")
            return {}
        payload = resp.json()

        # Build category name -> stat index map from top-level categories metadata
        cat_stat_names = {}
        for cat in payload.get("categories", []):
            cname = cat.get("name", "")
            cat_stat_names[cname] = cat.get("names", [])

        teams_arr = payload.get("teams", [])
        ranked_entries = []

        for item in teams_arr:
            team_obj = item.get("team", {})
            dname = team_obj.get("displayName") or team_obj.get("name") or ""
            abbr = ESPN_CODE_MAP.get((team_obj.get("abbreviation") or "").upper(), (team_obj.get("abbreviation") or "").upper())
            if not dname:
                continue

            stats_dict = {}
            for cat in item.get("categories", []):
                cname = cat.get("name", "")
                names = cat.get("names") or cat_stat_names.get(cname, [])
                vals = cat.get("totals") or cat.get("values") or []
                for idx, val in enumerate(vals):
                    stat_key = names[idx].lower() if idx < len(names) else f"{cname}_{idx}"
                    try:
                        stats_dict[stat_key] = float(val)
                    except (ValueError, TypeError):
                        pass

            fpi_val = None
            for k in ("fpi", "overall", "powerindex"):
                if k in stats_dict:
                    fpi_val = stats_dict[k]
                    break
            if fpi_val is None:
                continue

            fpi_rk = None
            for k in ("fpirank", "rank", "fpi_rk"):
                if k in stats_dict:
                    fpi_rk = int(round(stats_dict[k]))
                    break

            off_eff = stats_dict.get("offefficiency", stats_dict.get("off", 50.0))
            def_eff = stats_dict.get("defefficiency", stats_dict.get("def", 50.0))

            # Convert FPI (predictive neutral-field points vs avg) cleanly into GOLDEN_PLAY_SCALER EPA units
            epa_equiv = round(fpi_val / GOLDEN_PLAY_SCALER, 4)
            # Defensive efficiency (0..100, higher=better) -> opp_rz_dvoa (-0.22..+0.22, negative=better)
            rz_proxy = round(max(-0.22, min(0.22, -(def_eff - 50.0) / 220.0)), 3)

            entry = {
                "fpi": round(fpi_val, 2),
                "epa_equiv": epa_equiv,
                "epa_rank": fpi_rk,
                "off_eff": round(off_eff, 1),
                "def_eff": round(def_eff, 1),
                "rz_dvoa": rz_proxy,
                "is_fbs": True,
                "espn_abbr": abbr
            }
            ranked_entries.append((fpi_val, entry))
            fpi_map[normalize_team_key(dname)] = entry
            if abbr:
                fpi_map[f"code:{abbr}"] = entry

        # Fill epa_rank cleanly if not explicitly present
        ranked_entries.sort(key=lambda x: x[0], reverse=True)
        for idx, (_, ent) in enumerate(ranked_entries, start=1):
            if not ent.get("epa_rank"):
                ent["epa_rank"] = idx

        print(f"[ESPN FPI {league}] Loaded live FPI ratings for {len(ranked_entries)} teams.")
    except Exception as e:
        print(f"[ESPN FPI {league} Notice] {e}")

    return fpi_map

def parse_record_games(record_str):
    """Parses an ESPN W-L or W-L-T string (e.g. '8-2', '7-2-1') into (wins, losses, ties, gp)."""
    if not record_str or not isinstance(record_str, str):
        return None
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?\s*$", record_str)
    if not m:
        return None
    w = int(m.group(1))
    l = int(m.group(2))
    t = int(m.group(3)) if m.group(3) else 0
    return (w, l, t, w + l + t)

def fetch_espn_standings(league="NFL"):
    """
    Pulls live 2026 ESPN Standings (avgPointsFor/Against, overall record W-L, gamesPlayed, winPercent, streak).
    Safeguards against ESPN college-football duplicate stat names (where conference/home/road splits share
    'wins'/'losses' or omit 'gamesPlayed') and enforces strict physical PPG bounds [8.0, 55.0].
    """
    if league == "NFL":
        url = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings"
    else:
        url = "https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group=80"

    standings_map = {}

    def walk_node(node):
        if not isinstance(node, dict):
            return
        st = node.get("standings", {})
        for ent in st.get("entries", []):
            team = ent.get("team", {})
            dname = team.get("displayName") or team.get("name") or ""
            abbr = ESPN_CODE_MAP.get((team.get("abbreviation") or "").upper(), (team.get("abbreviation") or "").upper())
            if not dname:
                continue

            # Keep FIRST occurrence per stat name (ESPN lists overall before conference/split duplicates)
            # and also parse explicit overall record string ('overall' / type=='total') for true full-season GP
            smap = {}
            overall_parsed = None
            max_record_gp = 0
            for s in ent.get("stats", []):
                sname = s.get("name", "")
                stype = (s.get("type") or "").lower()
                disp = s.get("summary") or s.get("displayValue") or ""

                if sname.lower() == "overall" or stype == "total":
                    parsed = parse_record_games(disp)
                    if parsed and parsed[3] > 0:
                        overall_parsed = parsed

                # Track largest W-L string as a secondary lower bound on games played
                if sname.lower() in ("overall", "total"):
                    p2 = parse_record_games(disp)
                    if p2:
                        max_record_gp = max(max_record_gp, p2[3])

                if sname and sname not in smap and s.get("value") is not None:
                    try:
                        smap[sname] = float(s["value"])
                    except (ValueError, TypeError):
                        pass

            if overall_parsed:
                wins, losses, ties, rec_gp = overall_parsed
            else:
                wins = smap.get("wins", 0.0)
                losses = smap.get("losses", 0.0)
                ties = smap.get("ties", 0.0)
                rec_gp = wins + losses + ties

            gp = max(1.0, float(smap.get("gamesPlayed", 0.0)), float(rec_gp), float(max_record_gp))
            pf = smap.get("pointsFor", 0.0)
            pa = smap.get("pointsAgainst", 0.0)

            # Prefer ESPN's direct per-game averages when present; otherwise divide season totals by true overall GP
            raw_avg_pf = smap.get("avgPointsFor")
            raw_avg_pa = smap.get("avgPointsAgainst")

            if raw_avg_pf is not None and 8.0 <= raw_avg_pf <= 55.0:
                ppg_for = round(raw_avg_pf, 2)
            elif pf > 0 and gp >= 3:
                cand_pf = round(pf / gp, 2)
                ppg_for = cand_pf if (8.0 <= cand_pf <= 55.0) else None
            else:
                ppg_for = None

            if raw_avg_pa is not None and 8.0 <= raw_avg_pa <= 55.0:
                ppg_against = round(raw_avg_pa, 2)
            elif pa > 0 and gp >= 3:
                cand_pa = round(pa / gp, 2)
                ppg_against = cand_pa if (8.0 <= cand_pa <= 55.0) else None
            else:
                ppg_against = None

            # Final sanity pair check: never emit half-valid PPG or impossible scoring paces
            if ppg_for is None or ppg_against is None:
                ppg_for = None
                ppg_against = None

            win_pct = smap.get("winPercent", wins / gp)
            if overall_parsed and gp > 0:
                win_pct = wins / gp
            streak_val = smap.get("streak", 0.0)
            active_win_streak = int(streak_val) if streak_val > 0 else 0

            point_diff_pg = round(ppg_for - ppg_against, 2) if (ppg_for is not None and ppg_against is not None) else (
                round((pf - pa) / gp, 2) if (gp >= 3 and (pf > 0 or pa > 0)) else 0.0
            )

            rec = {
                "games_played": int(gp),
                "win_pct": round(max(0.05, min(0.95, win_pct)), 3),
                "active_win_streak": active_win_streak,
                "ppg_for": ppg_for,
                "ppg_against": ppg_against,
                "point_diff_pg": point_diff_pg,
                "is_fbs": True
            }
            standings_map[normalize_team_key(dname)] = rec
            if abbr:
                standings_map[f"code:{abbr}"] = rec

        for child in node.get("children", []):
            walk_node(child)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=14)
        if resp.status_code == 200:
            walk_node(resp.json())
            valid_ppg = sum(1 for k, v in standings_map.items() if not k.startswith("code:") and v.get("ppg_for") is not None)
            total_tm = sum(1 for k in standings_map if not k.startswith("code:"))
            print(f"[ESPN Standings {league}] Loaded {total_tm} teams ({valid_ppg} with verified PPG in [8, 55]).")
    except Exception as e:
        print(f"[ESPN Standings {league} Notice] {e}")

    return standings_map

def fetch_espn_ncaa_rankings():
    """Pulls live weekly CFP / AP Top-25 poll_rank for NCAA M13 divergence & Ranked board filter."""
    url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings"
    poll_map = {}
    ranked_names = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return poll_map, ranked_names
        rankings = resp.json().get("rankings", [])
        if not rankings:
            return poll_map, ranked_names

        # Prefer CFP Poll if active in November, else AP Top 25
        chosen = next((r for r in rankings if "playoff" in (r.get("name", "").lower())), None) or \
                 next((r for r in rankings if "ap" in (r.get("name", "").lower())), rankings[0])

        for item in chosen.get("ranks", []):
            rk = int(item.get("current", 0) or 0)
            team = item.get("team", {})
            loc = team.get("location", "")
            nick = team.get("name", "")
            full_nm = f"{loc} {nick}".strip() if loc and nick else (team.get("displayName") or loc or nick)
            abbr = (team.get("abbreviation") or "").upper()
            if rk > 0 and full_nm:
                ranked_names.append(full_nm)
                poll_map[normalize_team_key(full_nm)] = rk
                if abbr:
                    poll_map[f"code:{abbr}"] = rk
        print(f"[ESPN Rankings NCAA] Loaded {len(ranked_names)} live Top-25 teams ({chosen.get('name', 'Poll')}).")
    except Exception as e:
        print(f"[ESPN Rankings Notice] {e}")
    return poll_map, ranked_names

def fetch_espn_game_injuries(event_id, league="NFL"):
    """
    Pulls live ESPN game summary injury report for an upcoming game.
    Computes realistic qb_replacement_delta (negative pts = missing starters),
    lt_or_rb_pass_pro_out flag (for M5 Sack-Trauma), and human-readable injuries_summary.
    """
    sport_path = "nfl" if league == "NFL" else "college-football"
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/{sport_path}/summary?event={event_id}"
    out_by_abbr = {}

    POS_WEIGHTS = {
        "QB": 3.50,
        "OT": 0.90, "LT": 1.00, "RT": 0.85, "T": 0.85,
        "OG": 0.45, "G": 0.45, "C": 0.55, "OL": 0.50,
        "CB": 0.70, "DB": 0.45, "S": 0.45, "FS": 0.45, "SS": 0.45,
        "DE": 0.65, "EDGE": 0.75, "OLB": 0.55, "LB": 0.45, "ILB": 0.45, "DT": 0.45, "DL": 0.45,
        "WR": 0.60, "TE": 0.45, "RB": 0.50
    }

    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        if resp.status_code != 200:
            return out_by_abbr
        data = resp.json()
        for team_block in data.get("injuries", []):
            t_info = team_block.get("team", {})
            abbr = ESPN_CODE_MAP.get((t_info.get("abbreviation") or "").upper(), (t_info.get("abbreviation") or "").upper())
            if not abbr:
                continue

            total_impact = 0.0
            pass_pro_compromised = False
            qb_out_count = 0
            key_outs = []

            for inj in team_block.get("injuries", []):
                status = (inj.get("status") or "").strip().lower()
                if status not in ("out", "doubtful", "injured reserve", "ir", "suspended"):
                    continue
                status_mult = 0.75 if status == "doubtful" else 1.0
                athlete = inj.get("athlete", {})
                pname = athlete.get("displayName") or athlete.get("shortName") or ""
                pos_obj = athlete.get("position") or {}
                pos = (pos_obj.get("abbreviation") or "").upper()

                weight = POS_WEIGHTS.get(pos, 0.25) * status_mult
                # Only count meaningful active-roster outs (skip deep practice-squad/unknown)
                if pos in ("OT", "LT", "RT", "T"):
                    pass_pro_compromised = True
                if pos == "QB":
                    qb_out_count += 1
                total_impact += weight
                if pos in ("QB", "OT", "LT", "RT", "T", "CB", "WR", "RB", "DE", "EDGE", "LB") and len(key_outs) < 5:
                    key_outs.append(f"{pname} ({pos}, {status.upper()})")

            # Cap total team injury impact cleanly at -5.5 pts so deep IR lists never blow up spreads
            capped_delta = round(-min(5.5, total_impact), 2)
            out_by_abbr[abbr] = {
                "qb_replacement_delta": capped_delta,
                "lt_or_rb_pass_pro_out": pass_pro_compromised,
                "is_third_string_qb": (qb_out_count >= 2),
                "injuries_summary": key_outs
            }
    except Exception:
        pass
    return out_by_abbr

def get_team_meta(full_name, league="NFL", nflverse_map=None, fpi_map=None, standings_map=None, poll_map=None):
    # 1. Start from Stadium/Geography Registry (or clean regional neutral fallback — ZERO MD5 HASHES!)
    is_verified_code = False
    if league == "NFL" and full_name in NFL_TEAM_REGISTRY:
        meta = dict(NFL_TEAM_REGISTRY[full_name])
        is_verified_code = True
    elif league == "NCAA" and full_name in NCAA_TEAM_REGISTRY:
        meta = dict(NCAA_TEAM_REGISTRY[full_name])
        is_verified_code = True
    else:
        words = [w for w in full_name.replace("&", "").replace("(", "").replace(")", "").split() if w]
        code = (words[0][:2] + words[1][:2]).upper() if len(words) >= 2 else full_name[:4].upper()
        meta = {
            "code": code,
            "lat": 37.5,
            "lon": -88.0,
            "elev_m": 220,
            "is_dome": False,
            "tz": -6,
            "epa": 0.0,
            "to_reg": 0.0,
            "close_pct": 0.500,
            "streak": 0,
            "rz_dvoa": 0.0
        }

    code = meta["code"]
    meta["epa_rank"] = None
    meta["poll_rank"] = None
    meta["off_eff"] = None
    meta["def_eff"] = None
    meta["off_epa_per_play"] = None
    meta["def_epa_per_play"] = None
    meta["is_fcs"] = False
    meta["telemetry_source"] = "registry_fallback"

    # 2. Overlay Live Standings ONLY for verified full-season win streak / NFL win_pct (NEVER broken CFB PPG!)
    st_hit = lookup_by_name(standings_map, full_name, code, allow_code=is_verified_code) if standings_map else None
    if st_hit and st_hit.get("games_played", 0) >= 3:
        meta["streak"] = st_hit["active_win_streak"]
        if league == "NFL":
            meta["close_pct"] = st_hit["win_pct"]

    # 3. Overlay Live Performance Efficiency (ZERO MD5 HASHES, ZERO BROKEN STANDINGS PPG)
    if league == "NFL":
        nv_hit = nflverse_map.get(f"code:{code}") if nflverse_map else None
        fpi_hit = lookup_by_name(fpi_map, full_name, code, allow_code=is_verified_code) if fpi_map else None

        if fpi_hit:
            meta["off_eff"] = fpi_hit.get("off_eff")
            meta["def_eff"] = fpi_hit.get("def_eff")

        if nv_hit:
            if fpi_hit:
                meta["epa"] = round((0.80 * nv_hit["net_epa_per_play"]) + (0.20 * fpi_hit["epa_equiv"]), 4)
            else:
                meta["epa"] = nv_hit["net_epa_per_play"]
            meta["off_epa_per_play"] = nv_hit.get("off_epa_per_play")
            meta["def_epa_per_play"] = nv_hit.get("def_epa_per_play")
            meta["to_reg"] = nv_hit["to_reg"]
            meta["rz_dvoa"] = nv_hit["rz_dvoa"]
            meta["epa_rank"] = nv_hit.get("epa_rank")
            if meta["epa_rank"]:
                meta["close_pct"] = round(max(0.10, min(0.95, 1.0 - ((meta["epa_rank"] - 1) / 31.0))), 3)
            meta["telemetry_source"] = "nflverse_2026_live"
        elif fpi_hit:
            meta["epa"] = fpi_hit["epa_equiv"]
            meta["rz_dvoa"] = fpi_hit["rz_dvoa"]
            meta["epa_rank"] = fpi_hit.get("epa_rank")
            if meta["epa_rank"]:
                meta["close_pct"] = round(max(0.10, min(0.95, 1.0 - ((meta["epa_rank"] - 1) / 31.0))), 3)
            meta["telemetry_source"] = "espn_fpi_2026_live"
    else:
        fpi_hit = lookup_by_name(fpi_map, full_name, code, allow_code=is_verified_code) if fpi_map else None
        if fpi_hit:
            meta["epa"] = fpi_hit["epa_equiv"]
            meta["rz_dvoa"] = fpi_hit["rz_dvoa"]
            meta["epa_rank"] = fpi_hit.get("epa_rank")
            meta["off_eff"] = fpi_hit.get("off_eff")
            meta["def_eff"] = fpi_hit.get("def_eff")
            # Derive closing_rank_pct cleanly across ALL 136 FBS teams (fixes 0.05 bug!)
            if meta["epa_rank"]:
                meta["close_pct"] = round(max(0.10, min(0.95, 1.0 - ((meta["epa_rank"] - 1) / 135.0))), 3)
            meta["telemetry_source"] = "espn_fpi_2026_live"
        else:
            # If ESPN FPI (all ~136 FBS teams) loaded and this team isn't in FPI, it is an FCS opponent
            if fpi_map and len(fpi_map) >= 80:
                meta["is_fcs"] = True
                norm_nm = normalize_team_key(full_name)
                is_elite_fcs = any(kw in norm_nm for kw in ELITE_FCS_KEYWORDS)
                fcs_fpi = -12.5 if is_elite_fcs else -23.5
                meta["epa"] = round(fcs_fpi / GOLDEN_PLAY_SCALER, 4)
                meta["off_eff"] = 38.0 if is_elite_fcs else 20.0
                meta["def_eff"] = 38.0 if is_elite_fcs else 20.0
                meta["rz_dvoa"] = 0.06 if is_elite_fcs else 0.15
                meta["close_pct"] = 0.650 if is_elite_fcs else 0.250
                meta["telemetry_source"] = "fcs_calibrated_tier"

        # Overlay live Top-25 poll rank
        if poll_map:
            prk = lookup_by_name(poll_map, full_name, code, allow_code=is_verified_code)
            if prk:
                meta["poll_rank"] = prk

    return meta

def calc_haversine_miles(lat1, lon1, lat2, lon2):
    r_miles = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    return round(2.0 * r_miles * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)), 1)

def prefetch_all_stadium_weather(metas_list):
    """Batches all unique outdoor stadium coordinates into multi-location Open-Meteo requests (~2s total)."""
    coords = []
    seen = set()
    for m in metas_list:
        if m.get("is_dome"):
            continue
        lat = round(float(m.get("lat", 40.0)), 2)
        lon = round(float(m.get("lon", -80.0)), 2)
        ck = f"{lat}_{lon}"
        if ck not in WEATHER_CACHE and ck not in seen:
            seen.add(ck)
            coords.append((lat, lon, ck))

    # Open-Meteo supports comma-separated multi-location queries (chunk by 40 coords)
    for start in range(0, len(coords), 40):
        chunk = coords[start:start + 40]
        lats_str = ",".join(str(c[0]) for c in chunk)
        lons_str = ",".join(str(c[1]) for c in chunk)
        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lats_str}&longitude={lons_str}"
            f"&current=temperature_2m,wind_speed_10m,surface_pressure"
            f"&temperature_unit=fahrenheit&wind_speed_unit=mph"
        )
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                payload = resp.json()
                items = payload if isinstance(payload, list) else [payload]
                for idx, item in enumerate(items):
                    if idx >= len(chunk):
                        break
                    cur = item.get("current", {}) if isinstance(item, dict) else {}
                    _, _, ck = chunk[idx]
                    WEATHER_CACHE[ck] = {
                        "temperature_f": cur.get("temperature_2m", 54.0),
                        "wind_mph": cur.get("wind_speed_10m", 6.5),
                        "pressure_hpa": cur.get("surface_pressure", 1013.25),
                        "is_dome": False,
                        "elevation_m": 0
                    }
        except Exception as e:
            print(f"[Open-Meteo Batch Notice] {e}")

def fetch_live_stadium_weather(home_meta):
    lat = round(float(home_meta.get("lat", 40.0)), 2)
    lon = round(float(home_meta.get("lon", -80.0)), 2)
    is_dome = bool(home_meta.get("is_dome", False))
    elev_m = home_meta.get("elev_m", 0)

    weather_payload = {
        "temperature_f": 72.0 if is_dome else 54.0,
        "wind_mph": 0.0 if is_dome else 6.5,
        "pressure_hpa": 1013.25,
        "is_dome": is_dome,
        "elevation_m": elev_m
    }

    if is_dome:
        return weather_payload

    cache_key = f"{lat}_{lon}"
    if cache_key in WEATHER_CACHE:
        cached = dict(WEATHER_CACHE[cache_key])
        cached["elevation_m"] = elev_m
        cached["is_dome"] = is_dome
        return cached

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,wind_speed_10m,surface_pressure"
            f"&temperature_unit=fahrenheit&wind_speed_unit=mph"
        )
        resp = requests.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            data = resp.json().get("current", {})
            weather_payload["temperature_f"] = data.get("temperature_2m", 54.0)
            weather_payload["wind_mph"] = data.get("wind_speed_10m", 6.5)
            weather_payload["pressure_hpa"] = data.get("surface_pressure", 1013.25)
            WEATHER_CACHE[cache_key] = dict(weather_payload)
    except Exception:
        pass

    return weather_payload

def fetch_espn_scores():
    score_lookup = {}
    now_utc = datetime.now(timezone.utc)
    start_str = (now_utc - timedelta(days=10)).strftime("%Y%m%d")
    end_str = (now_utc + timedelta(days=7)).strftime("%Y%m%d")

    endpoints = [
        ("NFL", f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates={start_str}-{end_str}"),
        ("NFL", "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"),
        ("NCAA", f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=200&dates={start_str}-{end_str}"),
        ("NCAA", "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=150")
    ]

    for lg, url in endpoints:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=8)
            if resp.status_code == 200:
                events = resp.json().get("events", [])
                for ev in events:
                    event_id = ev.get("id")
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
                        "event_id": event_id,
                        "league": lg,
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
    # Negative favors Home Team in spread notation (matches app_controller.js)
    return round(max(-2.85, min(2.85, -(sign * math.sqrt(abs(phi_bio * net_tov))))), 4)

def calc_independent_total_tip(home_meta, away_meta, game_league, wind_mph):
    """
    100% Vegas-independent Total projection:
      - NFL: Real nflverse Offensive EPA/play + Defensive EPA/play allowed (pure EPA physics)
      - NCAA: Real ESPN FPI Offensive Efficiency (0-100) minus Defensive Efficiency (0-100)
      - Hard physical guardrail [28.0, 78.0] guarantees zero corrupted totals.
    """
    wind_penalty = max(0.0, (wind_mph - 10.0) * 0.25)
    total_intercept = NCAA_TOTAL_INTERCEPT if game_league == "NCAA" else MODEL_TOTAL_INTERCEPT

    if game_league == "NFL":
        h_off = home_meta.get("off_epa_per_play")
        h_def = home_meta.get("def_epa_per_play")
        a_off = away_meta.get("off_epa_per_play")
        a_def = away_meta.get("def_epa_per_play")
        if all(v is not None for v in (h_off, h_def, a_off, a_def)):
            delta = (GOLDEN_PLAY_SCALER * 0.5) * (h_off + h_def + a_off + a_def)
            return round(max(28.0, min(65.0, total_intercept + delta - wind_penalty)), 1)

    h_oe = home_meta.get("off_eff")
    h_de = home_meta.get("def_eff")
    a_oe = away_meta.get("off_eff")
    a_de = away_meta.get("def_eff")
    if all(v is not None for v in (h_oe, h_de, a_oe, a_de)):
        scaler = 0.16 if game_league == "NCAA" else 0.12
        eff_delta = scaler * ((h_oe - 50.0) + (a_oe - 50.0) - (h_de - 50.0) - (a_de - 50.0))
        return round(max(28.0, min(78.0, total_intercept + eff_delta - wind_penalty)), 1)

    # Pure OG fallback
    epa_sum = max(-0.20, min(0.20, home_meta["epa"] + away_meta["epa"]))
    epa_total_pts = epa_sum * GOLDEN_PLAY_SCALER
    rz_total_pts = (home_meta["rz_dvoa"] + away_meta["rz_dvoa"]) * 10.0
    return round(max(28.0, min(78.0, total_intercept + epa_total_pts + rz_total_pts - wind_penalty)), 1)

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

def fetch_live_odds_for_sport(sport_key, league_label):
    if not ODDS_API_KEY or ODDS_API_KEY == "PASTE_YOUR_API_KEY_HERE":
        print("[Notice] No valid ODDS_API_KEY set.")
        return []
    url = (
        f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
        f"?apiKey={ODDS_API_KEY}&regions=us&markets=spreads,totals&oddsFormat=american"
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            remaining = resp.headers.get("x-requests-remaining", "Unknown")
            data = json.loads(resp.read().decode("utf-8"))
            print(f"[Odds API - {league_label}] Pulled {len(data)} matchups | Credits Remaining: {remaining}")
            for item in data:
                item["_league"] = league_label
            return data
    except Exception as e:
        print(f"[Odds API Error - {league_label}] {e}")
        return []

def update_and_grade_ledger(ledger, games_slate, espn_scores, now_utc, porkys_by_gid=None):
    entries = ledger.get("entries", {})
    porkys_by_gid = porkys_by_gid or {}

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
                "league": g.get("league", "NFL"),
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

        if not existing.get("is_locked", False):
            if gid in porkys_by_gid:
                existing["porkys_record"] = porkys_by_gid[gid]
            elif "porkys_record" in existing:
                existing.pop("porkys_record", None)

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
            if s_rec and (s_rec.get("result_tip") == "PENDING" or s_rec.get("miss_by_pts") is None):
                pick_team = s_rec["pick_team"]
                line = float(s_rec["vegas_closing_line"])
                team_margin = (h_pts - a_pts) if pick_team == entry["home_team"] else (a_pts - h_pts)
                cover_diff = team_margin + line
                miss_pts = round(abs(cover_diff), 1) if cover_diff < 0 else 0.0
                if cover_diff > 0:
                    grade = "HIT"
                elif cover_diff == 0:
                    grade = "PUSH"
                elif miss_pts <= 3.0:
                    grade = "BLUE_BALLS"
                else:
                    grade = "MISS"
                s_rec["result_tip"] = grade
                s_rec["miss_by_pts"] = miss_pts

                bd_proj = float(s_rec.get("balls_deep_proj", s_rec["tip_proj"]))
                bd_same_side = (line - bd_proj) >= 0
                if bd_same_side:
                    s_rec["result_balls_deep"] = grade
                else:
                    s_rec["result_balls_deep"] = "MISS" if grade == "HIT" else ("HIT" if grade in ("MISS", "BLUE_BALLS") else "PUSH")

            t_rec = entry.get("total_record")
            if t_rec and (t_rec.get("result_tip") == "PENDING" or t_rec.get("miss_by_pts") is None):
                total_pts = h_pts + a_pts
                t_line = float(t_rec["vegas_closing_line"])
                for mode_key, dir_key in [("result_tip", "tip_direction"), ("result_balls_deep", "balls_deep_direction")]:
                    direction = t_rec.get(dir_key, "O")
                    if total_pts == t_line:
                        t_rec[mode_key] = "PUSH"
                        if mode_key == "result_tip":
                            t_rec["miss_by_pts"] = 0.0
                    else:
                        c_diff = (total_pts - t_line) if direction == "O" else (t_line - total_pts)
                        t_miss = round(abs(c_diff), 1) if c_diff < 0 else 0.0
                        if c_diff > 0:
                            t_rec[mode_key] = "HIT"
                        elif t_miss <= 3.0:
                            t_rec[mode_key] = "BLUE_BALLS"
                        else:
                            t_rec[mode_key] = "MISS"
                        if mode_key == "result_tip":
                            t_rec["miss_by_pts"] = t_miss

            p_rec = entry.get("porkys_record")
            if p_rec and (p_rec.get("result_floor") == "PENDING" or p_rec.get("result_straight") == "PENDING"):
                fade_team = p_rec.get("fade_team", entry["home_team"])
                team_margin = (h_pts - a_pts) if fade_team == entry["home_team"] else (a_pts - h_pts)
                floor_hook = float(p_rec.get("safe_floor_hook", float(p_rec.get("fade_line", 0.0)) + 3.5))
                straight_line = float(p_rec.get("fade_line", 0.0))

                fl_diff = team_margin + floor_hook
                fl_miss = round(abs(fl_diff), 1) if fl_diff < 0 else 0.0
                p_rec["result_floor"] = "HIT" if fl_diff > 0 else ("PUSH" if fl_diff == 0 else ("BLUE_BALLS" if fl_miss <= 3.0 else "MISS"))
                p_rec["floor_miss_by"] = fl_miss

                st_diff = team_margin + straight_line
                st_miss = round(abs(st_diff), 1) if st_diff < 0 else 0.0
                p_rec["result_straight"] = "HIT" if st_diff > 0 else ("PUSH" if st_diff == 0 else ("BLUE_BALLS" if st_miss <= 3.0 else "MISS"))
                p_rec["straight_miss_by"] = st_miss
                p_rec["trap_dodged"] = (p_rec["result_straight"] == "HIT")

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
        if result_str in ("HIT", "MISS", "BLUE_BALLS"):
            counters[bucket]["total"] += 1
            if result_str == "HIT":
                counters[bucket]["hits"] += 1

    for entry in entries.values():
        for m_type, rec in [("spread", entry.get("spread_record")), ("total", entry.get("total_record"))]:
            if not rec:
                continue
            res_tip = rec.get("result_tip", "PENDING")
            res_bd = rec.get("result_balls_deep", "PENDING")
            if res_tip not in ("HIT", "MISS", "BLUE_BALLS"):
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
    season_year = now_utc.year if now_utc.month >= 8 else (now_utc.year - 1)

    # Pull all live 2026 telemetry feeds + Odds API concurrently (~4 seconds total)
    with ThreadPoolExecutor(max_workers=9) as pool:
        f_nv = pool.submit(fetch_nflverse_live_team_epa, season_year)
        f_nfpi = pool.submit(fetch_espn_fpi, "NFL")
        f_cfpi = pool.submit(fetch_espn_fpi, "NCAA")
        f_nst = pool.submit(fetch_espn_standings, "NFL")
        f_cst = pool.submit(fetch_espn_standings, "NCAA")
        f_rk = pool.submit(fetch_espn_ncaa_rankings)
        f_sc = pool.submit(fetch_espn_scores)
        f_nodd = pool.submit(fetch_live_odds_for_sport, "americanfootball_nfl", "NFL")
        f_codd = pool.submit(fetch_live_odds_for_sport, "americanfootball_ncaaf", "NCAA")

        nflverse_epa = f_nv.result()
        nfl_fpi = f_nfpi.result()
        ncaa_fpi = f_cfpi.result()
        nfl_standings = f_nst.result()
        ncaa_standings = f_cst.result()
        ncaa_poll_map, live_ranked_ncaa = f_rk.result()
        espn_scores = f_sc.result()
        nfl_odds = f_nodd.result()
        ncaa_odds = f_codd.result()

    combined_odds = nfl_odds + ncaa_odds
    combined_odds.sort(key=lambda g: g.get("commence_time", ""))

    # Prefetch all outdoor stadium weather in 2 batched calls + upcoming NFL injuries concurrently
    home_metas_for_weather = []
    nfl_injury_event_ids = []
    for game in combined_odds:
        lg = game.get("_league", "NFL")
        h_full = game.get("home_team", "")
        a_full = game.get("away_team", "")
        hm = get_team_meta(h_full, lg, nflverse_epa if lg == "NFL" else None, nfl_fpi if lg == "NFL" else ncaa_fpi, nfl_standings if lg == "NFL" else ncaa_standings, None if lg == "NFL" else ncaa_poll_map)
        home_metas_for_weather.append(hm)
        if lg == "NFL":
            am = get_team_meta(a_full, "NFL", nflverse_epa, nfl_fpi, nfl_standings, None)
            c_str = game.get("commence_time", "")
            try:
                dt_u = datetime.strptime(c_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                if -timedelta(hours=4) <= (dt_u - now_utc) <= timedelta(days=8):
                    ev = espn_scores.get(f"{am['code']}_{hm['code']}")
                    if ev and ev.get("event_id"):
                        nfl_injury_event_ids.append((f"{am['code']}_{hm['code']}", ev["event_id"]))
            except Exception:
                pass

    prefetch_all_stadium_weather(home_metas_for_weather)
    prefetched_nfl_injuries = {}
    if nfl_injury_event_ids:
        with ThreadPoolExecutor(max_workers=8) as inj_pool:
            fut_map = {k: inj_pool.submit(fetch_espn_game_injuries, eid, "NFL") for k, eid in nfl_injury_event_ids}
            for k, fut in fut_map.items():
                try:
                    prefetched_nfl_injuries[k] = fut.result()
                except Exception:
                    prefetched_nfl_injuries[k] = {}

    games_slate = []
    seen_matchups = set()

    for game in combined_odds:
        game_league = game.get("_league", "NFL")
        home_full = game.get("home_team", "Unknown Home")
        away_full = game.get("away_team", "Unknown Away")

        if game_league == "NFL":
            home_meta = get_team_meta(home_full, "NFL", nflverse_epa, nfl_fpi, nfl_standings, None)
            away_meta = get_team_meta(away_full, "NFL", nflverse_epa, nfl_fpi, nfl_standings, None)
        else:
            home_meta = get_team_meta(home_full, "NCAA", None, ncaa_fpi, ncaa_standings, ncaa_poll_map)
            away_meta = get_team_meta(away_full, "NCAA", None, ncaa_fpi, ncaa_standings, ncaa_poll_map)

        home_code, away_code = home_meta["code"], away_meta["code"]

        matchup_pair = (game_league, tuple(sorted([home_code, away_code])))
        if matchup_pair in seen_matchups:
            continue
        seen_matchups.add(matchup_pair)
        game_id = f"{game_league}_{away_code}_{home_code}_{season_year}"

        travel_miles = calc_haversine_miles(away_meta["lat"], away_meta["lon"], home_meta["lat"], home_meta["lon"])
        tz_shift = home_meta["tz"] - away_meta["tz"]

        commence_str = game.get("commence_time", "")
        kickoff_local_hour = 13
        is_upcoming_soon = False
        if commence_str:
            try:
                dt_utc = datetime.strptime(commence_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                dt_local = dt_utc + timedelta(hours=home_meta["tz"])
                kickoff_local_hour = dt_local.hour
                is_upcoming_soon = (-timedelta(hours=4) <= (dt_utc - now_utc) <= timedelta(days=8))
            except Exception:
                pass

        # Pull live NFL injury reports for upcoming week's games via ESPN event summary
        home_inj = {"qb_replacement_delta": 0.0, "lt_or_rb_pass_pro_out": False, "is_third_string_qb": False, "injuries_summary": []}
        away_inj = {"qb_replacement_delta": 0.0, "lt_or_rb_pass_pro_out": False, "is_third_string_qb": False, "injuries_summary": []}
        if game_league == "NFL" and is_upcoming_soon:
            inj_map = prefetched_nfl_injuries.get(f"{away_code}_{home_code}", {})
            if home_code in inj_map:
                home_inj = inj_map[home_code]
            if away_code in inj_map:
                away_inj = inj_map[away_code]

        env_weather = fetch_live_stadium_weather(home_meta)
        wind_mph = 0.0 if env_weather.get("is_dome") else float(env_weather.get("wind_mph", 0.0))

        abs_tz = abs(tz_shift)
        omega_dir = 1.35 if tz_shift > 0 else (0.85 if tz_shift < 0 else 1.0)
        body_clock = kickoff_local_hour - tz_shift
        trough_pen = max(0.0, 13.0 - body_clock)
        phi_circ = round(0.45 * (abs_tz * omega_dir * math.exp(-0.35 * 1.0)) + (0.30 * trough_pen), 3)

        hfa_base = NCAA_HFA_BASE if game_league == "NCAA" else PI_OVER_PHI_HFA

        # PURE OG M1–M9 FAIR SPREAD (100% INDEPENDENT OF VEGAS — SYNCED 1:1 WITH onlinemath_engine.js v313)
        epa_diff = away_meta["epa"] - home_meta["epa"]
        delta_rz = (home_meta["rz_dvoa"] - away_meta["rz_dvoa"]) * 4.0
        delta_to = away_meta["to_reg"] - home_meta["to_reg"]
        injury_diff = away_inj["qb_replacement_delta"] - home_inj["qb_replacement_delta"]
        psi_11_12 = calc_coupled_balls_deep_psi(home_meta, away_meta, env_weather)

        fair_home_tip = round((GOLDEN_PLAY_SCALER * epa_diff) + delta_rz + delta_to + injury_diff - hfa_base - phi_circ, 2)
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
                    badge = "SMASH" if ev_tip >= SMASH_EV_THRESHOLD else ("PASS" if ev_tip <= -19.0 else "TOO_CLOSE")

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
                        "alt_odds_over": 145
                    })

            total_market = next((m for m in book.get("markets", []) if m["key"] == "totals"), None)
            if total_market:
                over_out = next((o for o in total_market.get("outcomes", []) if o.get("name") == "Over"), None)
                under_out = next((o for o in total_market.get("outcomes", []) if o.get("name") == "Under"), None)
                if over_out and under_out:
                    t_point = float(over_out.get("point", 0.0))
                    o_price = int(over_out.get("price", -110))
                    u_price = int(under_out.get("price", -110))

                    proj_total_tip = calc_independent_total_tip(home_meta, away_meta, game_league, wind_mph)
                    proj_total_bd = round(proj_total_tip + (psi_11_12 * 0.35), 1)

                    is_under = proj_total_tip < t_point
                    active_price = u_price if is_under else o_price

                    total_diff_tip = abs(proj_total_tip - t_point)
                    total_diff_bd = abs(proj_total_bd - t_point)

                    calc_prob_tip = max(0.50, min(0.99, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * total_diff_tip))))
                    calc_prob_bd = max(0.50, min(0.99, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * total_diff_bd))))

                    ev_tip = calc_ev_pct(calc_prob_tip, active_price)
                    ev_bd = calc_ev_pct(calc_prob_bd, active_price)
                    badge = "SMASH" if ev_tip >= SMASH_EV_THRESHOLD else ("PASS" if ev_tip <= -19.0 else "TOO_CLOSE")

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
                        "alt_line": t_point - 3.5 if is_under else t_point + 3.5,
                        "alt_odds_over": 155
                    })

        if not props_board:
            continue

        home_tel_obj = {
            "net_epa_per_play": home_meta["epa"],
            "qb_replacement_delta": home_inj["qb_replacement_delta"],
            "turnover_reg_delta": home_meta["to_reg"],
            "closing_rank_pct": home_meta["close_pct"],
            "active_win_streak": home_meta["streak"],
            "opp_rz_dvoa": home_meta["rz_dvoa"],
            "lt_or_rb_pass_pro_out": home_inj["lt_or_rb_pass_pro_out"],
            "is_third_string_qb": home_inj["is_third_string_qb"],
            "injuries_summary": home_inj["injuries_summary"],
            "telemetry_source": home_meta["telemetry_source"]
        }
        away_tel_obj = {
            "net_epa_per_play": away_meta["epa"],
            "qb_replacement_delta": away_inj["qb_replacement_delta"],
            "turnover_reg_delta": away_meta["to_reg"],
            "closing_rank_pct": away_meta["close_pct"],
            "active_win_streak": away_meta["streak"],
            "opp_rz_dvoa": away_meta["rz_dvoa"],
            "lt_or_rb_pass_pro_out": away_inj["lt_or_rb_pass_pro_out"],
            "is_third_string_qb": away_inj["is_third_string_qb"],
            "injuries_summary": away_inj["injuries_summary"],
            "telemetry_source": away_meta["telemetry_source"]
        }

        for tel_obj, meta_obj in ((home_tel_obj, home_meta), (away_tel_obj, away_meta)):
            if meta_obj.get("epa_rank") is not None:
                tel_obj["epa_rank"] = meta_obj["epa_rank"]
            if meta_obj.get("poll_rank") is not None:
                tel_obj["poll_rank"] = meta_obj["poll_rank"]
            if meta_obj.get("off_eff") is not None:
                tel_obj["off_eff"] = meta_obj["off_eff"]
            if meta_obj.get("def_eff") is not None:
                tel_obj["def_eff"] = meta_obj["def_eff"]
            if meta_obj.get("off_epa_per_play") is not None:
                tel_obj["off_epa_per_play"] = meta_obj["off_epa_per_play"]
            if meta_obj.get("def_epa_per_play") is not None:
                tel_obj["def_epa_per_play"] = meta_obj["def_epa_per_play"]
            if meta_obj.get("is_fcs"):
                tel_obj["is_fcs"] = True

        games_slate.append({
            "game_id": game_id,
            "league": game_league,
            "home_team": home_code,
            "away_team": away_code,
            "home_full_name": home_full,
            "away_full_name": away_full,
            "commence_time": commence_str,
            "kickoff_local_hour": kickoff_local_hour,
            "expected_plays": 134 if game_league == "NCAA" else 126,
            "hfa_base": hfa_base,
            "environmental_payload": env_weather,
            "circadian_payload": {
                "away_travel_miles": travel_miles,
                "away_tz_shift": tz_shift,
                "away_elev_m": away_meta.get("elev_m", 150),
                "rest_differential_days": 0,
                "short_week_flag": 0
            },
            "team_telemetry": {
                "home": home_tel_obj,
                "away": away_tel_obj
            },
            "props_board": props_board
        })

    # Blended Top-5 Flagship Selection (Strict 1-pick-per-game, max 3 per market)
    best_per_game = []
    for g in games_slate:
        cands = []
        g_spreads = [p for p in g["props_board"] if p["market_type"] == "spread" and abs(p["base_line"]) <= 28.5]
        g_totals = [p for p in g["props_board"] if p["market_type"] == "total"]
        if g_spreads:
            cands.append(max(g_spreads, key=lambda x: x["ev_pct"]))
        if g_totals:
            cands.append(max(g_totals, key=lambda x: x["ev_pct"]))
        if cands:
            best_per_game.append((g["game_id"], max(cands, key=lambda x: x["ev_pct"])))

    best_per_game.sort(key=lambda x: x[1]["ev_pct"], reverse=True)
    selected_five = []
    sp_cnt = tot_cnt = 0
    for gid, p in best_per_game:
        if len(selected_five) >= 5:
            break
        if p["market_type"] == "spread" and sp_cnt >= 3:
            continue
        if p["market_type"] == "total" and tot_cnt >= 3:
            continue
        selected_five.append(p)
        if p["market_type"] == "spread":
            sp_cnt += 1
        else:
            tot_cnt += 1

    for idx, p in enumerate(selected_five[:3], start=1):
        p["flagship_slot"] = f"MÉNAGE À TROIS #{idx}"
    for idx, p in enumerate(selected_five[3:5], start=4):
        p["flagship_slot"] = f"5-PACK FLEX #{idx}"

    # Build Porky's 5-Pack (3 Core Day-Shift Traps + 2 Keep-It-In-Your-Pants Flex) for permanent Ledger audit
    porkys_candidates = []
    for g in games_slate:
        g_spreads = [p for p in g["props_board"] if p["market_type"] == "spread" and abs(p["base_line"]) <= 28.5]
        if len(g_spreads) >= 2:
            g_spreads_sorted = sorted(g_spreads, key=lambda x: x["ev_pct"], reverse=True)
            best_side = g_spreads_sorted[0]
            worst_side = g_spreads_sorted[-1]
            if worst_side["ev_pct"] <= -19.0:
                porkys_candidates.append((worst_side["ev_pct"], g, worst_side, best_side))

    porkys_candidates.sort(key=lambda x: x[0])
    porkys_by_gid = {}
    for idx, (_, g, trap_p, fade_p) in enumerate(porkys_candidates[:5], start=1):
        slot_lbl = f"DAY-SHIFT TRAP #{idx}" if idx <= 3 else f"KEEP IT IN YOUR PANTS #{idx}"
        trap_p["porkys_slot"] = slot_lbl
        fade_line = float(fade_p["base_line"])
        floor_hook = math.floor(fade_line + 3.5) + 0.5
        floor_gap = floor_hook - float(fade_p["projected_mean_mu"])
        floor_prob = max(0.05, min(0.96, 1.0 / (1.0 + math.exp(-LOGISTIC_K_TIGHT * floor_gap))))
        fade_team = g["home_team"] if fade_p["player"].startswith(f"{g['home_team']} ") else g["away_team"]
        porkys_by_gid[g["game_id"]] = {
            "porkys_slot": slot_lbl,
            "is_core_three": (idx <= 3),
            "trap_label": trap_p["player"],
            "trap_line": float(trap_p["base_line"]),
            "trap_proj": float(trap_p["projected_mean_mu"]),
            "trap_ev_pct": float(trap_p["ev_pct"]),
            "fade_label": fade_p["player"],
            "fade_team": fade_team,
            "fade_line": fade_line,
            "fade_proj": float(fade_p["projected_mean_mu"]),
            "fade_ev_pct": float(fade_p["ev_pct"]),
            "safe_floor_hook": floor_hook,
            "safe_floor_label": f"Alt {'+' if floor_hook > 0 else ''}{floor_hook:.1f} (-175)",
            "safe_floor_win_pct": round(floor_prob * 100.0, 1),
            "result_floor": "PENDING",
            "result_straight": "PENDING",
            "floor_miss_by": 0.0,
            "straight_miss_by": 0.0,
            "trap_dodged": None
        }

    existing_ledger = load_existing_ledger()
    updated_ledger = update_and_grade_ledger(existing_ledger, games_slate, espn_scores, now_utc, porkys_by_gid)

    return {
        "slate_info": {
            "league": "NFL_NCAA",
            "week": 12,
            "last_updated": now_iso,
            "telemetry_version": "v215_live_feeds",
            "ranked_ncaa_teams": live_ranked_ncaa
        },
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
    print(" DIXPIX QUANTITATIVE ENGINE — DUAL-LEAGUE LIVE DAEMON (v215)")
    print(f" Target Feed: ./{DATA_FILE} | Refresh Cadence: {POLL_INTERVAL_SECONDS}s")
    print("=========================================================")

    while True:
        try:
            payload = build_master_payload()
            write_atomic_json(payload, DATA_FILE)
            timestamp = payload["slate_info"]["last_updated"]
            print(f"[{timestamp}] Synced {len(payload['games'])} NFL/NCAA matchups + graded ledger to {DATA_FILE}")
        except Exception as err:
            print(f"[Scraper Error] {err}")
        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    if os.environ.get("GITHUB_ACTIONS") == "true":
        payload = build_master_payload()
        write_atomic_json(payload, DATA_FILE)
        print(f"[Cloud Scraper] Successfully synced {len(payload['games'])} NFL + NCAA games to {DATA_FILE}")
    else:
        run_daemon()
