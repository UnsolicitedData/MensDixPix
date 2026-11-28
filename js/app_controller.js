/**
 * DIXPIX QUANTITATIVE ENGINE — MASTER UI & RESEARCH CONTROLLER (v264 — WEEK-SCOPED LEDGER + W13+ STRIP + 60FPS DAVINCI SLIDERS + ESPN LIVE SYNC + 58.7% NCAA ML FLOOR + 13-MODULE ML CLARITY)
 * Synced 1:1 with math_engine.js (v324) & scraper.py (v240)
 *  - Pure OG M1–M9 Firewall in Just the Tip | Full M11–M13 Physics, 2-Key-Rung Alts, Always-On Wong Teasers & Regime Safe Totals in Balls Deep / DaVinci
 *  - PickFinder-Style Scannable Picks Feed + Split Research Inspector (Weather & Ballistic Physics Moat)
 *  - Flagship 5-Pack (Ménage à Trois) & Porky's Safe Floor Fades + Weather Lab + 13 Modules (Home-Team Frame) + FAGquestions + 6 Ledger Vaults + Slide-Over Bet Slip
 */

const AppState = {
    rawPayload: null,
    lastDataHash: "",
    activeView: "picks",              // "picks" | "fivepack" | "weather" | "ledger" | "modules" | "faq"
    activeMode: "tip",                // "tip" | "balls_deep" | "davinci"
    intensitySlider: 0.0,             // Legacy compatibility (0.0 default)
    daVinciScripts: {},               // { [gameId]: { spreadDelta: 0.0, totalDelta: 0.0 } }
    filters: { nfl: true, ncaa: true },
    leagueFilter: "ALL",              // "ALL" | "NFL" | "NCAA"
    marketFilter: "ALL",              // "ALL" | "spread" | "total" | "moneyline"
    smashOnly: false,
    weatherOnly: false,
    searchQuery: "",
    sortOrder: "kickoff",             // Default chronological kickoff order (Upgrade #2)
    selectedPropKey: null,
    ledgerWeekFilter: "CURRENT",      // Default Active Week; W13+ Overall Strip always visible; Legacy Beta W10-W12 on demand
    ledgerOutcomeFilter: "ALL",       // "ALL" | "HIT" | "BLUE_BALLS" | "MISS"
    ledgerMarketFilter: "ALL",        // "ALL" | "SPREAD" | "TOTAL" | "ML"
    ledgerSearchQuery: "",
    activeDossier: null,              // { kind: "live" | "ledger", id: string }
    fivePackView: "main_stage",       // "main_stage" | "porkys"
    weatherLabView: "cards",          // "cards" | "table"
    modulesSubView: "compendium",     // "compendium" | "telemetry"
    showModuleGuide: false,
    showHorseCocks: false,
    ledgerFivePackView: "flagship",   // "flagship" | "porkys"
    activeLedgerVault: "flagship_5pack",
    selectedFivePackWeek: "ALL",
    selectedPorkysWeek: "ALL",
    ledgerShowAllCompleted: false,
    selectedParlayLegs: new Set(),
    safeFloorParlayLegs: new Set(),
    wongTeaserParlayLegs: new Set(),
    openFaq: new Set([0, 2, 4]),
    mnfCutoffMs: Infinity,
    processedGames: [],
    processedProps: [],
    flagshipFivePack: [],
    porkysFivePack: []
};

const MODEL_TOTAL_INTERCEPT = 42.986;
const SMASH_EV_CUTOFF = 10.0;         // >= +10.0% EV threshold for SMASH
const PASS_EV_CUTOFF = -19.0;         // <= -19.0% EV threshold for definitive PASS (exact -110 mirror of +10.0% SMASH)
const BLUE_BALLS_MARGIN = 3.0;        // <= 3.0 pts miss from Vegas line = BLUE BALLS
const NCAA_ML_UPSET_FLOOR = 0.587;    // 58.7% minimum outright win prob required for NCAA ML dog upset
const PROD_ENGINE_MIN_WEEK = 13;      // Production calibrated engine starts Week 13 (W10-W12 tucked in Legacy Beta)
const PHI = (typeof GOLDEN_RATIO_PHI !== "undefined") ? GOLDEN_RATIO_PHI : 1.6180339887;
let sliderDragTimer = null;
let dvRafPending = false;

// Official AP / CFP Top-25 Ranked NCAA Programs (Fallback if slate_info.ranked_ncaa_teams is empty)
const RANKED_NCAA_FULL_NAMES = [
    "Georgia Bulldogs", "Utah Utes", "Notre Dame Fighting Irish", "UCLA Bruins",
    "Miami Hurricanes", "Indiana Hoosiers", "Alabama Crimson Tide", "Texas Longhorns",
    "Tennessee Volunteers", "Wake Forest Demon Deacons", "BYU Cougars", "Texas Tech Red Raiders",
    "Kentucky Wildcats", "Houston Cougars", "Iowa Hawkeyes", "USC Trojans",
    "Oregon Ducks", "Ole Miss Rebels", "Ohio State Buckeyes", "LSU Tigers",
    "Boise State Broncos", "South Carolina Gamecocks", "Arizona Wildcats",
    "New Mexico Lobos", "SMU Mustangs", "Oklahoma State Cowboys"
];

const RANKED_NCAA_CODES = new Set([
    "UGA", "UTAH", "ND", "UCLA", "UCBR", "MIA", "IND", "ALA", "TEX",
    "TENN", "WAKE", "WAFO", "BYU", "TTU", "UK", "KEWI", "HOU", "HOCO", "IOWA",
    "IOHA", "USC", "ORE", "MISS", "OSU", "LSU", "BSU", "SCAR", "ARI", "ARWI",
    "UNM", "SMU", "OKST", "FLA", "TAMU", "OU", "LOU", "PSU", "MIZZ"
]);

const CLEAN_CODE_OVERRIDES = {
    "TCHO": "TCU", "KAJA": "KAN", "KAST": "KSU", "OKST": "OKST", "IOST": "ISU",
    "WEVI": "WVU", "BABE": "BAY", "TETE": "TTU", "BYCO": "BYU", "UTUT": "UTAH",
    "ARWI": "ARIZ", "COBU": "COLO", "UCKN": "UCF", "CIBE": "CIN", "HOCO": "HOU",
    "NECO": "NEB", "IOHA": "IOWA", "ILFI": "ILL", "NOWI": "NW", "WIBA": "WIS",
    "MIGO": "MINN", "PUBO": "PUR", "INHO": "IND", "OHST": "OSU", "MIWO": "MICH",
    "PEST": "PSU", "RUSC": "RUTG", "MATE": "MD", "ORDU": "ORE", "WAHU": "WASH",
    "USTR": "USC", "UCBR": "UCLA", "ALCR": "ALA", "GEBU": "UGA", "TELO": "TEX",
    "OKSO": "OU", "TEVO": "TENN", "OLMI": "MISS", "LSTI": "LSU", "TEA&": "TAMU",
    "TEAG": "TAMU", "MITI": "MIZZ", "KEWI": "UK", "SOCA": "SCAR", "FLGA": "FLA",
    "AUTI": "AUB", "ARRA": "ARK", "VACO": "VAN", "NODA": "NDSU", "MIHU": "MIA",
    "CLTI": "CLEM", "SMMU": "SMU", "PIPA": "PITT", "LOCA": "LOU", "GETE": "GT",
    "WAFO": "WAKE", "DUBL": "DUKE", "NOCA": "UNC", "NCST": "NCST", "VATE": "VT",
    "VICA": "UVA", "BOCO": "BC", "SYOR": "SYR", "FLST": "FSU", "CAGO": "CAL",
    "STCA": "STAN", "UCHU": "CONN", "UMMI": "MASS", "WOTE": "WOF", "CHMO": "UTC",
    "NOIL": "NIU", "WYCO": "WYO", "NEME": "UNM", "BOST": "BSU", "UNRE": "UNLV",
    "COST": "CSU", "FRST": "FRES", "SADI": "SDSU", "SAJO": "SJSU", "AIFO": "AFA",
    "UTST": "USU", "NEWO": "NEV", "HARA": "HAW", "ORST": "ORST", "WAST": "WSU",
    "ARBL": "ARMY", "NAMI": "NAVY", "TUGR": "TULN", "METI": "MEM", "USBU": "USF",
    "EACA": "ECU", "UTRO": "UTSA", "LIBL": "LIB", "JAMA": "JMU", "APST": "APP",
    "COCH": "CCU", "GESO": "GASO", "GEST": "GAST", "MAHE": "MRSH", "WEKE": "WKU",
    "WACA": "WCU", "MEME": "MERC", "THCI": "CIT", "EAMI": "EMU", "KEST": "KENT",
    "WEMI": "WMU", "AKZI": "AKR", "BAST": "BALL", "CEMI": "CMU", "DEBL": "DEL",
    "NOTE": "UNT", "TEOW": "TEM", "SOMI": "USM", "ULMO": "ULM", "LORA": "ULL",
    "SAHO": "SHSU",
    "TA&M": "TAMU", "MIZ": "MIZZ", "SC": "SCAR", "KU": "KAN", "WSH": "WAS",
    "JAC": "JAX", "LA": "LAR", "M-OH": "MIOH", "UL": "ULL", "BOIS": "BSU",
    "BUFF": "UB", "UCONN": "CONN", "UMASS": "MASS", "TLS": "TLSA", "OKLA": "OU",
    "BAMA": "ALA", "SFLA": "USF", "SMISS": "USM", "LATECH": "LT", "SACST": "SAC", "CSUS": "SAC"
};

function normNameKey(str) {
    return String(str || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanTeamCode(code) {
    return CLEAN_CODE_OVERRIDES[code] || code;
}

function cleanLabelCodes(labelStr) {
    if (!labelStr) return "";
    let out = labelStr;
    Object.keys(CLEAN_CODE_OVERRIDES).forEach(bad => {
        const good = CLEAN_CODE_OVERRIDES[bad];
        out = out.replace(new RegExp(`\\b${bad}\\b`, "g"), good);
    });
    return out;
}

function fmtSigned(val, decimals = 1) {
    const n = Number(val || 0);
    const s = n.toFixed(decimals);
    return n > 0 ? `+${s}` : s;
}

function getTierFromEv(evPct) {
    const ev = Number(evPct);
    if (ev >= SMASH_EV_CUTOFF) return "SMASH";
    if (ev <= PASS_EV_CUTOFF) return "PASS";
    return "TOO_CLOSE";
}

function getTierColor(tierBadge) {
    if (tierBadge === "SMASH") return "var(--emerald)";
    if (tierBadge === "PASS") return "var(--red)";
    return "var(--text-2)";
}

function renderTierBadgeHTML(tierBadge) {
    if (tierBadge === "SMASH") return `<span class="badge b-smash">SMASH</span>`;
    if (tierBadge === "PASS") return `<span class="badge b-pass">PASS</span>`;
    return `<span class="badge b-muted">TEASE</span>`;
}

function renderGatekeeperPillsHTML(flags, action = "ALLOW") {
    if (!Array.isArray(flags) || flags.length === 0) return "";
    const isHard = (action === "PASS" || action === "PIVOT_TEAM_TOTAL_UNDER" || action === "PIVOT_SAFE_FLOOR");
    const icon = action === "PIVOT_TEAM_TOTAL_UNDER" ? "🔄" : (isHard ? "🛑" : "⚠️");
    return flags.map(flagText => `
        <div class="guardrail-alert ${isHard ? "hard" : "warn"}">${icon} ${flagText}</div>
    `).join("");
}

function renderGameGuardrailChipsHTML(gameRecord) {
    if (!gameRecord) return "";
    const chips = [];
    const isUnlocked = (AppState.activeMode !== "tip");

    if (isUnlocked && gameRecord.elevMatrix && gameRecord.elevMatrix.hypoxicOverrideM13) {
        chips.push(`<span class="badge b-gold">🏔️ M11&gt;M13 ZONE ${gameRecord.elevMatrix.zoneNumber} HYPOXIA</span>`);
    }
    if (isUnlocked && gameRecord.m13Details && gameRecord.m13Details.coachSyncBlocked) {
        chips.push(`<span class="badge b-pass">🔒 M13 COACH/QB LOCK</span>`);
    }
    if (gameRecord.thirdStringQbAlert) {
        chips.push(`<span class="badge b-cyan">🔄 3RD-STRING QB → ${gameRecord.thirdStringTeam} TT UNDER</span>`);
    }
    if (gameRecord.m8 && gameRecord.m8.charterDelayShock > 0) {
        chips.push(`<span class="badge b-purple">✈️ FAA DELAY (${gameRecord.m8.delayTotalDragPts} TOT)</span>`);
    }
    if (gameRecord.m9Base && Math.abs(gameRecord.m9Base.injurySpreadDiff || 0) >= 0.75) {
        const injPts = gameRecord.m9Base.injurySpreadDiff;
        const favTeam = injPts < 0 ? gameRecord.homeTeam : gameRecord.awayTeam;
        chips.push(`<span class="badge b-pass">🚑 INJURY WIRE (${favTeam} +${Math.abs(injPts).toFixed(1)} pts)</span>`);
    }
    if (gameRecord.divergenceAlert) {
        chips.push(`<span class="badge b-gold">⚠️ MARKET DIVERGENCE (${Number(gameRecord.spreadDivergencePts || 0).toFixed(1)} pts)</span>`);
    }
    if (chips.length === 0) return "";
    return `<div class="chip-group" style="gap:5px;">${chips.join("")}</div>`;
}

function isRankedNCAAGame(game) {
    const hFull = game.home_full_name || "";
    const aFull = game.away_full_name || "";
    const homeTel = (game.team_telemetry && game.team_telemetry.home) || {};
    const awayTel = (game.team_telemetry && game.team_telemetry.away) || {};
    if ((homeTel.poll_rank && homeTel.poll_rank <= 25) || (awayTel.poll_rank && awayTel.poll_rank <= 25)) {
        return true;
    }
    const hasLivePoll = Boolean(
        AppState.rawPayload &&
        AppState.rawPayload.slate_info &&
        Array.isArray(AppState.rawPayload.slate_info.ranked_ncaa_teams) &&
        AppState.rawPayload.slate_info.ranked_ncaa_teams.length >= 20
    );
    if (hasLivePoll) {
        const liveRanked = AppState.rawPayload.slate_info.ranked_ncaa_teams;
        return liveRanked.includes(hFull) || liveRanked.includes(aFull);
    }
    if (RANKED_NCAA_FULL_NAMES.includes(hFull) || RANKED_NCAA_FULL_NAMES.includes(aFull)) {
        return true;
    }
    return RANKED_NCAA_CODES.has(game.home_team) || RANKED_NCAA_CODES.has(game.away_team);
}

function shouldIncludeGame(game, defaultLeague = "NFL") {
    const lg = game.league || defaultLeague;
    if (lg === "NFL") return AppState.filters.nfl;
    if (lg === "NCAA") return AppState.filters.ncaa && isRankedNCAAGame(game);
    return true;
}

function computeUpcomingMnfCutoffMs(gamesList) {
    const validTimes = (gamesList || [])
        .map(g => g.commence_time || g.commenceTime)
        .filter(Boolean)
        .map(t => new Date(t).getTime())
        .filter(ms => !isNaN(ms));

    const anchorMs = validTimes.length > 0 ? Math.min(...validTimes) : Date.now();
    const EST_OFFSET_MS = 5 * 60 * 60 * 1000;
    const estAnchor = new Date(anchorMs - EST_OFFSET_MS);
    const day = estAnchor.getUTCDay();
    const daysUntilTueAfterMnf = (day === 2) ? 7 : ((9 - day) % 7 || 7);

    const cutoffEstMs = Date.UTC(
        estAnchor.getUTCFullYear(),
        estAnchor.getUTCMonth(),
        estAnchor.getUTCDate() + daysUntilTueAfterMnf,
        5, 0, 0, 0
    );
    return cutoffEstMs + EST_OFFSET_MS;
}

function isGameInCurrentWeek(commenceTimeStr, cutoffMs) {
    if (!commenceTimeStr) return true;
    const ms = new Date(commenceTimeStr).getTime();
    if (isNaN(ms)) return true;
    return ms <= cutoffMs;
}

function inferFootballWeekLabel(entryOrGame, fallbackLabel = "Week 11") {
    if (!entryOrGame) return fallbackLabel;
    if (entryOrGame.week_label) return entryOrGame.week_label;
    if (entryOrGame.week) return `Week ${entryOrGame.week}`;
    const timeStr = entryOrGame.commence_time || entryOrGame.commenceTime || entryOrGame.timestamp;
    if (timeStr) {
        const ms = new Date(timeStr).getTime();
        if (!isNaN(ms)) {
            const week1StartMs = new Date("2026-09-02T00:00:00Z").getTime();
            const diffDays = Math.floor((ms - week1StartMs) / (1000 * 60 * 60 * 24));
            const weekNum = Math.max(1, Math.min(22, Math.floor(diffDays / 7) + 1));
            if (weekNum === 19) return "Wild Card";
            if (weekNum === 20) return "Divisional";
            if (weekNum === 21) return "Conf Champ";
            if (weekNum >= 22) return "Super Bowl";
            return `Week ${weekNum}`;
        }
    }
    return fallbackLabel;
}

function formatKickoffShort(commenceTimeStr) {
    if (!commenceTimeStr) return "TBD";
    const dt = new Date(commenceTimeStr);
    if (isNaN(dt.getTime())) return "TBD";
    const day = dt.toLocaleDateString("en-US", { weekday: "short" });
    const tm = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${day} ${tm}`;
}

const ESPN_SCORE_CACHE = {
    lastFetchMs: 0,
    gamesByMatchup: {}
};

function getEspnScoreMatch(league, matchupKey, awayFull = "", homeFull = "") {
    const lg = String(league || "NFL").toUpperCase();
    if (matchupKey) {
        const direct = ESPN_SCORE_CACHE.gamesByMatchup[`${lg}_${matchupKey}`] || ESPN_SCORE_CACHE.gamesByMatchup[matchupKey];
        if (direct) return direct;
    }
    if (awayFull && homeFull) {
        const nk = `${lg}:name:${normNameKey(awayFull)}__${normNameKey(homeFull)}`;
        if (ESPN_SCORE_CACHE.gamesByMatchup[nk]) return ESPN_SCORE_CACHE.gamesByMatchup[nk];
    }
    return null;
}

function isGameCompletedFinal(game) {
    if (!game) return false;
    if (game.status === "FINAL") return true;
    const cleanHome = cleanTeamCode(game.home_team || game.homeTeam || "");
    const cleanAway = cleanTeamCode(game.away_team || game.awayTeam || "");
    const matchupKey = game.matchup || `${cleanAway} @ ${cleanHome}`;
    const gameLeague = game.league || "NFL";
    const espnMatch = getEspnScoreMatch(
        gameLeague, matchupKey,
        game.awayFullName || game.away_full_name || "",
        game.homeFullName || game.home_full_name || ""
    );
    return Boolean(espnMatch && espnMatch.state === "post");
}

function computeWeatherImpact(envPayload, m7, elevObj) {
    const isDome = Boolean(envPayload && envPayload.is_dome);
    const tempF = isDome ? 72 : Number(envPayload.temperature_f !== undefined ? envPayload.temperature_f : 58);
    const windMph = isDome ? 0 : Number(envPayload.wind_mph !== undefined ? envPayload.wind_mph : 5);
    const rho = Number((m7 && m7.airDensityRho) || 1.225);
    const fgShift = Number((m7 && m7.fgRangeShiftYards) || 0);
    const zone = Number((elevObj && elevObj.zoneNumber) || 1);
    const elevFt = Math.round(Number((envPayload && envPayload.elevation_m) || 0) * 3.28084);

    if (isDome) {
        return {
            score: 3.5,
            isEdge: false,
            summary: `Controlled 72°F dome air (ρ ${rho}) removes wind friction and adds +${Math.abs(fgShift).toFixed(1)} yds FG carry.`
        };
    }

    let score = 0;
    score += Math.min(4.8, Math.max(0, (windMph - 6) * 0.38));
    score += Math.min(2.6, Math.max(0, (46 - tempF) * 0.14));
    score += Math.min(2.4, Math.abs(rho - 1.225) * 35.0);
    if (zone >= 7) score = Math.max(score, 8.2 + (zone - 7) * 0.55);
    score = Number(Math.min(10.0, Math.max(1.0, score)).toFixed(1));

    const rawBadges = Array.isArray(envPayload && envPayload.weather_badges) ? envPayload.weather_badges : [];
    const badges = [...rawBadges];
    if (!isDome) {
        if (windMph >= 12 && !badges.includes("WIND")) badges.push("WIND");
        if (tempF <= 32 && !badges.includes("FREEZE")) badges.push("FREEZE");
    }
    const isEdge = (zone >= 7 || windMph >= 12 || tempF <= 40 || Math.abs(fgShift) >= 2.2 || badges.includes("SNOW") || badges.includes("RAIN") || badges.includes("FREEZE"));
    let summary = "";
    if (zone >= 7) {
        summary = `Zone ${zone} ${elevObj.direction} (${elevFt.toLocaleString()} ft, Δ${elevObj.deltaFeet > 0 ? "+" : ""}${elevObj.deltaFeet} ft) triggers mountain air & 4Q hypoxic stamina drag.`;
    } else if (windMph >= 12 && tempF <= 42) {
        summary = `Heavy ${windMph} mph wind + cold ${tempF}°F air (ρ ${rho}) drags kicks ${fmtSigned(fgShift)} yds and suppresses downfield passing.`;
    } else if (windMph >= 12) {
        summary = `Sustained ${windMph} mph wind shifts FG range ${fmtSigned(fgShift)} yds and tightens deep passing efficiency.`;
    } else if (tempF <= 40) {
        summary = `Cold ${tempF}°F dense air (ρ ${rho}) increases ballistic drag (${fmtSigned(fgShift)} yds FG shift).`;
    } else {
        summary = `Mild outdoor conditions (${tempF}°F · ${windMph} mph · ρ ${rho}); efficiency & matchup physics lead.`;
    }

    return { score, isEdge, summary, badges };
}

function renderWeatherPillHTML(gameRecord) {
    if (!gameRecord) return "";
    const env = gameRecord.envPayload || {};
    const em = gameRecord.elevActive || gameRecord.elevMatrix || { zoneNumber: 1, venueElevFeet: 0 };
    if (env.is_dome) return `<span class="weather-pill">🏟️ Dome 72°F</span>`;

    const pills = [];
    const badges = (gameRecord.weatherImpact && Array.isArray(gameRecord.weatherImpact.badges))
        ? gameRecord.weatherImpact.badges
        : (Array.isArray(env.weather_badges) ? env.weather_badges : []);

    if (em.zoneNumber >= 7) {
        pills.push(`<span class="weather-pill edge">🏔️ ${(em.venueElevFeet || 0).toLocaleString()}ft Z${em.zoneNumber}</span>`);
    }
    if (badges.includes("SNOW")) pills.push(`<span class="weather-pill snow">❄️ Snow</span>`);
    if (badges.includes("RAIN")) pills.push(`<span class="weather-pill rain">🌧️ Rain</span>`);
    if (badges.includes("FREEZE")) pills.push(`<span class="weather-pill freeze">🥶 ${Math.round(env.temperature_f || 32)}°F</span>`);

    const tempDisp = env.temperature_f !== undefined ? `${Math.round(env.temperature_f)}°F` : "--°F";
    const windDisp = `${Math.round(gameRecord.windMph || 0)}mph`;
    const gusts = Number(env.wind_gusts_mph || 0);
    if (badges.includes("WIND")) {
        pills.push(`<span class="weather-pill wind">💨 ${windDisp}${gusts >= 20 ? ` (G${Math.round(gusts)})` : ""}</span>`);
    } else if (pills.length === 0) {
        const edgeCls = gameRecord.weatherImpact && gameRecord.weatherImpact.isEdge ? "edge" : "";
        pills.push(`<span class="weather-pill ${edgeCls}">🌬️ ${tempDisp} · ${windDisp}</span>`);
    }
    return pills.join(" ");
}

function renderLockSpanHTML(text = "🔒 Balls Deep") {
    return `<span onclick="window.unlockBallsDeepMode(event)" title="Click to unlock Balls Deep Telemetry" style="cursor:pointer; color:var(--gold); font-weight:700; user-select:none;">${text}</span>`;
}

// ==========================================
// LIFECYCLE & LIVE POLLING
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    bindUIControls();
    syncModeButtonsUI();
    pollDataFeed();
    syncEspnLiveScores();
    setInterval(pollDataFeed, 5000);
    setInterval(syncEspnLiveScores, 60000);
});

function bindUIControls() {
    const sortSel = document.getElementById("sort-select");
    if (sortSel) sortSel.value = AppState.sortOrder;
}

function updateDaVinciCustomCountBadge() {
    const badge = document.getElementById("davinci-custom-count");
    if (!badge) return;
    const cnt = Object.values(AppState.daVinciScripts).filter(
        s => s && (Math.abs(s.spreadDelta || 0) >= 0.05 || Math.abs(s.totalDelta || 0) >= 0.05)
    ).length;
    badge.textContent = `${cnt} Custom Script${cnt === 1 ? "" : "s"}`;
}

function syncModeButtonsUI() {
    const m = AppState.activeMode;
    const bTip = document.getElementById("btn-mode-tip");
    const bBd = document.getElementById("btn-mode-bd");
    const bDv = document.getElementById("btn-mode-dv");
    const dvBar = document.getElementById("davinci-bar");
    if (bTip) bTip.className = `mode-btn ${m === "tip" ? "active-tip" : ""}`;
    if (bBd) bBd.className = `mode-btn ${m === "balls_deep" ? "active-bd" : ""}`;
    if (bDv) bDv.className = `mode-btn ${m === "davinci" ? "active-dv" : ""}`;
    if (dvBar) dvBar.classList.toggle("open", m === "davinci");
    updateDaVinciCustomCountBadge();
}

// ==========================================
// GLOBAL WINDOW HANDLERS (MATCHING index.html 1:1)
// ==========================================
window.setAppView = function(viewName) {
    AppState.activeView = viewName;
    document.querySelectorAll(".view-section").forEach(sec => {
        sec.classList.toggle("active", sec.id === `view-${viewName}`);
    });
    document.querySelectorAll(".nav-btn, .mob-tab, .mob-faq-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === viewName);
    });
    const filterBar = document.getElementById("picks-filter-bar");
    if (filterBar) filterBar.style.display = (viewName === "picks") ? "flex" : "none";
    window.closeMobileInspector();
    window.scrollTo({ top: 0, behavior: "smooth" });
};

window.setEngineMode = function(modeName) {
    AppState.activeMode = modeName;
    syncModeButtonsUI();
    recalculateAndRenderAll({ isSliderDrag: false });
};

window.unlockBallsDeepMode = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    window.setEngineMode("balls_deep");
};

function patchInspectorDaVinciLive(gameId) {
    const p = AppState.processedProps.find(x => x.propKey === AppState.selectedPropKey);
    if (!p || !p.gameRecord || p.gameRecord.gameId !== gameId) return;
    const g = p.gameRecord;
    const rawSc = AppState.daVinciScripts[gameId] || { spreadDelta: 0.0, totalDelta: 0.0 };
    const sc = (typeof calcDaVinciGameScript === "function")
        ? calcDaVinciGameScript(g.m9Bd.fairHomeSpread, g.baseTelemetryTotal, rawSc.spreadDelta, rawSc.totalDelta, g.league)
        : { isCustom: false, spreadDelta: rawSc.spreadDelta || 0, totalDelta: rawSc.totalDelta || 0, simHomeSpread: g.m9Bd.fairHomeSpread + (rawSc.spreadDelta || 0), simTotal: g.baseTelemetryTotal + (rawSc.totalDelta || 0), simHomePts: 21, simAwayPts: 21 };

    const spLbl = document.getElementById("insp-dv-spread-lbl");
    const totLbl = document.getElementById("insp-dv-total-lbl");
    const scLeft = document.getElementById("insp-dv-score-left");
    const scRight = document.getElementById("insp-dv-score-right");
    const stEl = document.getElementById("insp-dv-status");
    if (spLbl) spLbl.textContent = `${sc.spreadDelta > 0 ? "+" : ""}${sc.spreadDelta.toFixed(1)} pts`;
    if (totLbl) totLbl.textContent = `${sc.totalDelta > 0 ? "+" : ""}${sc.totalDelta.toFixed(1)} pts`;
    if (scLeft) scLeft.textContent = `Script: ${g.awayTeam} ${sc.simAwayPts} – ${g.homeTeam} ${sc.simHomePts}`;
    if (scRight) scRight.textContent = `${g.homeTeam} ${fmtSigned(sc.simHomeSpread, 1)} · O/U ${sc.simTotal}`;
    if (stEl) {
        stEl.innerHTML = sc.isCustom
            ? `<button type="button" class="chip" style="padding:2px 8px; font-size:10.5px;" onclick="window.resetDaVinciGameScript('${g.gameId}')">Reset Game</button>`
            : `<span class="mono" style="font-size:10px; color:var(--text-3);">Model Baseline</span>`;
    }

    // Live-recalculate selected prop Proj, Win%, EV%, and Badge without rebuilding the slider DOM
    const lgE = (typeof getLeagueEngine === "function") ? getLeagueEngine(g.league) : null;
    const spProbFn = (gap) => (lgE && g.league === "NCAA") ? lgE.winProb(gap) : calcPointGapWinProb(gap);
    const totProbFn = (gap) => (lgE && g.league === "NCAA" && lgE.totalWinProb) ? lgE.totalWinProb(gap) : calcPointGapWinProb(gap);

    let projVal = p.projectedMean;
    let winProb = p.activeModelProbRaw;
    if (p.marketType === "spread") {
        const dvSp = p.isHomeSpread ? sc.spreadDelta : -sc.spreadDelta;
        projVal = Number((p.bdProjectedMean + dvSp).toFixed(2));
        winProb = spProbFn(p.baseLine - projVal);
    } else if (p.marketType === "total") {
        projVal = Number(Math.max(17.5, Math.min(99.5, p.bdProjectedMean + sc.totalDelta)).toFixed(1));
        winProb = Math.max(0.50, totProbFn(Math.abs(projVal - p.baseLine)));
    } else if (p.marketType === "moneyline") {
        const isHomeMl = (p.pickTeamCode === g.homeTeam);
        const dvSp = isHomeMl ? sc.spreadDelta : -sc.spreadDelta;
        projVal = Number((p.bdProjectedMean + dvSp).toFixed(2));
        winProb = spProbFn(0.0 - projVal);
    }

    const evRes = calcExpectedValueAndKelly(winProb, p.baseOdds || -110);
    const evPct = Number(evRes.evPercentage.toFixed(1));
    const winPct = Number((winProb * 100.0).toFixed(1));
    const tier = p.gatekeeperBlocked ? "PASS" : getTierFromEv(evPct);
    const col = getTierColor(tier);

    const projEl = document.getElementById("insp-proj-val");
    const evEl = document.getElementById("insp-ev-val");
    const badgeWrap = document.getElementById("insp-tier-badge-wrap");
    const sigMeta = document.getElementById("insp-sig-meta");
    if (projEl) {
        projEl.style.color = col;
        projEl.textContent = (p.marketType === "moneyline")
            ? `${winPct.toFixed(1)}%`
            : (p.marketType === "spread" ? fmtSigned(projVal, 1) : Number(projVal).toFixed(1));
    }
    if (evEl) {
        evEl.style.color = col;
        evEl.textContent = `${evPct > 0 ? "+" : ""}${evPct.toFixed(1)}%`;
    }
    if (badgeWrap) badgeWrap.innerHTML = renderTierBadgeHTML(tier);
    if (sigMeta) {
        const kStr = evRes.quarterKellyStakePct > 0
            ? `f*: ${evRes.quarterKellyStakePct.toFixed(2)}%${evRes.isKellyCapped ? " (4% CAP)" : ""}`
            : "0% Kelly";
        sigMeta.textContent = `Win ${winPct.toFixed(1)}% · ${kStr}`;
    }

    // Also update Outright Winner callout live
    const mlWrap = document.getElementById("insp-ml-winner-txt");
    if (mlWrap) {
        const simWinner = (sc.simHomeSpread <= 0) ? g.homeTeam : g.awayTeam;
        const simWp = Number((spProbFn(Math.abs(sc.simHomeSpread)) * 100.0).toFixed(1));
        mlWrap.innerHTML = `🏆 Outright Winner: <strong style="color:var(--text-1);">${simWinner}</strong> (${simWp}%)`;
    }
}

window.updateDaVinciGameScript = function(gameId, field, rawVal) {
    if (!gameId) return;
    const val = parseFloat(rawVal) || 0.0;
    if (!AppState.daVinciScripts[gameId]) {
        AppState.daVinciScripts[gameId] = { spreadDelta: 0.0, totalDelta: 0.0 };
    }
    AppState.daVinciScripts[gameId][field] = val;
    updateDaVinciCustomCountBadge();
    if (dvRafPending) return;
    dvRafPending = true;
    requestAnimationFrame(() => {
        dvRafPending = false;
        patchInspectorDaVinciLive(gameId);
    });
};

window.commitDaVinciGameScript = function() {
    recalculateAndRenderAll({ isSliderDrag: false });
};

window.resetDaVinciGameScript = function(gameId) {
    if (gameId && AppState.daVinciScripts[gameId]) {
        delete AppState.daVinciScripts[gameId];
    }
    updateDaVinciCustomCountBadge();
    recalculateAndRenderAll({ isSliderDrag: false });
};

window.resetAllDaVinciScripts = function() {
    AppState.daVinciScripts = {};
    AppState.intensitySlider = 0.0;
    updateDaVinciCustomCountBadge();
    recalculateAndRenderAll({ isSliderDrag: false });
};

window.setLeagueFilter = function(lg) {
    AppState.leagueFilter = lg;
    AppState.filters.nfl = (lg === "ALL" || lg === "NFL");
    AppState.filters.ncaa = (lg === "ALL" || lg === "NCAA");
    ["ALL", "NFL", "NCAA"].forEach(k => {
        const el = document.getElementById(`f-lg-${k}`);
        if (el) el.classList.toggle("active", k === lg);
    });
    recalculateAndRenderAll({ isSliderDrag: false });
};

window.setMarketFilter = function(mk) {
    AppState.marketFilter = mk;
    ["ALL", "spread", "total", "moneyline"].forEach(k => {
        const el = document.getElementById(`f-mk-${k}`);
        if (el) el.classList.toggle("active", k === mk);
    });
    renderPicksFeed();
};

window.toggleSmashFilter = function() {
    AppState.smashOnly = !AppState.smashOnly;
    const el = document.getElementById("f-smash");
    if (el) el.classList.toggle("active-smash", AppState.smashOnly);
    renderPicksFeed();
};

window.toggleWeatherFilter = function() {
    AppState.weatherOnly = !AppState.weatherOnly;
    const el = document.getElementById("f-weather");
    if (el) el.classList.toggle("active-weather", AppState.weatherOnly);
    renderPicksFeed();
};

window.setSearchFilter = function(val) {
    AppState.searchQuery = String(val || "").trim().toLowerCase();
    renderPicksFeed();
};

window.setSortOrder = function(val) {
    AppState.sortOrder = val || "ev";
    renderPicksFeed();
};

window.selectPick = function(propKey, openMobileSheet = false) {
    AppState.selectedPropKey = propKey;
    renderPicksFeed();
    renderPickInspector();
    if (openMobileSheet && window.innerWidth <= 960) {
        const wrap = document.getElementById("inspector-wrap");
        const bd = document.getElementById("drawer-backdrop");
        if (wrap) wrap.classList.add("mobile-open");
        if (bd) bd.classList.add("open");
    }
};

window.closeMobileInspector = function() {
    const wrap = document.getElementById("inspector-wrap");
    const slip = document.getElementById("slip-drawer");
    const bd = document.getElementById("drawer-backdrop");
    if (wrap) wrap.classList.remove("mobile-open");
    if (bd && (!slip || !slip.classList.contains("open"))) {
        bd.classList.remove("open");
    }
};

window.toggleSlipDrawer = function(open) {
    const drawer = document.getElementById("slip-drawer");
    const bd = document.getElementById("drawer-backdrop");
    const wrap = document.getElementById("inspector-wrap");
    if (wrap && open) wrap.classList.remove("mobile-open");
    if (drawer) drawer.classList.toggle("open", Boolean(open));
    if (bd) bd.classList.toggle("open", Boolean(open));
};

window.closeModuleDossier = function() {
    AppState.activeDossier = null;
    const drawer = document.getElementById("dossier-drawer");
    const slip = document.getElementById("slip-drawer");
    const wrap = document.getElementById("inspector-wrap");
    const bd = document.getElementById("drawer-backdrop");
    if (drawer) drawer.classList.remove("open");
    if (bd && (!slip || !slip.classList.contains("open")) && (!wrap || !wrap.classList.contains("mobile-open"))) {
        bd.classList.remove("open");
    }
};

window.closeAllOverlays = function() {
    window.toggleSlipDrawer(false);
    window.closeMobileInspector();
    window.closeModuleDossier();
};

window.setFivePackView = function(view) {
    AppState.fivePackView = view || "main_stage";
    const mainBtn = document.getElementById("fp-tab-main");
    const porkyBtn = document.getElementById("fp-tab-porkys");
    if (mainBtn) mainBtn.classList.toggle("active", AppState.fivePackView === "main_stage");
    if (porkyBtn) porkyBtn.classList.toggle("active", AppState.fivePackView === "porkys");
    renderFlagshipFivePack();
};

window.setWeatherLabView = function(mode) {
    AppState.weatherLabView = mode || "cards";
    const cBtn = document.getElementById("wl-view-cards");
    const tBtn = document.getElementById("wl-view-table");
    const grid = document.getElementById("weather-lab-grid");
    const tbl = document.getElementById("biolab-container");
    if (cBtn) cBtn.classList.toggle("active", AppState.weatherLabView === "cards");
    if (tBtn) tBtn.classList.toggle("active", AppState.weatherLabView === "table");
    if (grid) grid.style.display = (AppState.weatherLabView === "cards") ? "grid" : "none";
    if (tbl) tbl.style.display = (AppState.weatherLabView === "table") ? "block" : "none";
};

window.setModulesSubView = function(sub) {
    AppState.modulesSubView = sub || "compendium";
    const compBtn = document.getElementById("mod-tab-comp");
    const telBtn = document.getElementById("mod-tab-tel");
    const compPanel = document.getElementById("modules-compendium-panel");
    const telPanel = document.getElementById("modules-telemetry-panel");
    if (compBtn) compBtn.classList.toggle("active", AppState.modulesSubView === "compendium");
    if (telBtn) telBtn.classList.toggle("active", AppState.modulesSubView === "telemetry");
    if (compPanel) compPanel.style.display = (AppState.modulesSubView === "compendium") ? "block" : "none";
    if (telPanel) telPanel.style.display = (AppState.modulesSubView === "telemetry") ? "block" : "none";
};

window.toggleModuleGuide = function() {
    AppState.showModuleGuide = !AppState.showModuleGuide;
    const box = document.getElementById("module-reader-guide");
    const btn = document.getElementById("mod-tab-guide");
    if (box) box.style.display = AppState.showModuleGuide ? "grid" : "none";
    if (btn) {
        btn.classList.toggle("active", AppState.showModuleGuide);
        btn.textContent = AppState.showModuleGuide ? "How to Read ▲" : "How to Read ▼";
    }
};

window.toggleHorseCocks = function() {
    AppState.showHorseCocks = !AppState.showHorseCocks;
    const box = document.getElementById("horsecocks-stage-wrap");
    const btn = document.getElementById("mod-tab-horse");
    if (box) box.style.display = AppState.showHorseCocks ? "block" : "none";
    if (btn) btn.classList.toggle("active-gold", AppState.showHorseCocks);
};

window.toggleParlayLeg = function(propKey, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (AppState.selectedParlayLegs.has(propKey)) {
        AppState.selectedParlayLegs.delete(propKey);
        AppState.safeFloorParlayLegs.delete(propKey);
        AppState.wongTeaserParlayLegs.delete(propKey);
    } else {
        AppState.selectedParlayLegs.add(propKey);
    }
    renderPicksFeed();
    renderPickInspector();
    renderFlagshipFivePack();
    if (typeof renderCombinatoricsDeck === "function") renderCombinatoricsDeck();
};

window.loadFlagshipPreset = function(onlyMenage = false, useKeyAlts = false, useWongTeaser = false) {
    AppState.selectedParlayLegs.clear();
    AppState.safeFloorParlayLegs.clear();
    AppState.wongTeaserParlayLegs.clear();
    AppState.flagshipFivePack.forEach(p => {
        if (!onlyMenage || (p.flagshipSlot && p.flagshipSlot.includes("MÉNAGE"))) {
            AppState.selectedParlayLegs.add(p.propKey);
            if (useWongTeaser) AppState.wongTeaserParlayLegs.add(p.propKey);
            else if (useKeyAlts) AppState.safeFloorParlayLegs.add(p.propKey);
        }
    });
    renderPicksFeed();
    renderPickInspector();
    renderFlagshipFivePack();
    if (typeof renderCombinatoricsDeck === "function") renderCombinatoricsDeck();
    window.toggleSlipDrawer(true);
};

window.loadPorkysPreset = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    AppState.selectedParlayLegs.clear();
    AppState.safeFloorParlayLegs.clear();
    AppState.wongTeaserParlayLegs.clear();
    AppState.porkysFivePack.forEach(item => {
        if (item.fadeProp && item.fadeProp.propKey) {
            AppState.selectedParlayLegs.add(item.fadeProp.propKey);
            AppState.safeFloorParlayLegs.add(item.fadeProp.propKey);
        }
    });
    renderPicksFeed();
    renderPickInspector();
    renderFlagshipFivePack();
    if (typeof renderCombinatoricsDeck === "function") renderCombinatoricsDeck();
    window.toggleSlipDrawer(true);
};

window.clearParlaySlip = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    AppState.selectedParlayLegs.clear();
    AppState.safeFloorParlayLegs.clear();
    AppState.wongTeaserParlayLegs.clear();
    renderPicksFeed();
    renderPickInspector();
    renderFlagshipFivePack();
    if (typeof renderCombinatoricsDeck === "function") renderCombinatoricsDeck();
};

// ==========================================
// DATA FEED POLLING & MATH SAFE WRAPPERS
// ==========================================
async function pollDataFeed() {
    let textData = "";
    try {
        const response = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        textData = await response.text();
    } catch (err) {
        console.warn("DixPix Polling Notice: Waiting for data.json feed...", err.message);
        return;
    }
    if (textData !== AppState.lastDataHash) {
        try {
            AppState.rawPayload = JSON.parse(textData);
            AppState.lastDataHash = textData;
        } catch (parseErr) {
            console.error("DixPix data.json Parse Error:", parseErr);
            return;
        }
        recalculateAndRenderAll({ isSliderDrag: false });
    }
}

function snapToHalfPointHook(lineVal, deltaPts) {
    return Math.floor(lineVal + deltaPts) + 0.5;
}

function calcMomentumArc(sliderVal, scale = 1.0) {
    if (!sliderVal) return 0.0;
    const norm = Math.max(-1.0, Math.min(1.0, sliderVal / (2.0 * PHI)));
    const exponent = 2.0 / PHI;
    const arc = Math.sign(norm) * Math.pow(Math.abs(norm), exponent) * (PHI * PHI) * scale;
    return Number(arc.toFixed(3));
}

function getVerifiedQbDeltaSafe(teamTel) {
    if (typeof getVerifiedQbDelta === "function") return getVerifiedQbDelta(teamTel);
    if (!teamTel) return 0.0;
    const raw = Number(teamTel.qb_replacement_delta || 0);
    if (raw === 0) return 0.0;
    if (Array.isArray(teamTel.injuries_summary) && teamTel.injuries_summary.length > 0) {
        if (!teamTel.injuries_summary.some(s => String(s).toUpperCase().includes("(QB,"))) return 0.0;
    }
    return Number(Math.max(-3.5, Math.min(0.0, raw)).toFixed(2));
}

function calcKeyNumberAltSpreadSafe(baseLine, modelFairLine, baseOdds = -110) {
    if (typeof calcKeyNumberAltSpread === "function") {
        return calcKeyNumberAltSpread(baseLine, modelFairLine, baseOdds);
    }
    const line = Number(baseLine || 0);
    const fair = Number(modelFairLine !== undefined ? modelFairLine : line);
    const altLine = snapToHalfPointHook(line, +3.5);
    const altProb = Math.min(0.95, Math.max(0.05, calcPointGapWinProb(altLine - fair)));
    const evObj = calcExpectedValueAndKelly(altProb, -185);
    return {
        altLine, altOdds: -185, altProb, altProbPct: Number((altProb * 100).toFixed(1)),
        merRatio: 1.2, isMerApproved: true, altEvPct: Number(evObj.evPercentage.toFixed(2)),
        keyLabel: "2-Key Alt Buy", altStr: `Alt ${altLine > 0 ? "+" : ""}${altLine.toFixed(1)} (-185)`,
        tier2Line: null, tier2Mode: null, tier2Approved: false, tier2Label: ""
    };
}

function calcReportCalibratedTotalSafe(vegasTotal, ogTipTotal, envPayload = {}, circPayload = {}, elevMatrix = null, gameLeague = "NFL", hasBackupQb = false) {
    if (typeof calcReportCalibratedTotal === "function") {
        const res = calcReportCalibratedTotal(vegasTotal, ogTipTotal, envPayload, circPayload, elevMatrix, gameLeague, hasBackupQb);
        if (res && res.regime) return res;
    }
    const vTot = Number(vegasTotal || ogTipTotal || 45.0);
    const tipTot = Number(ogTipTotal !== undefined && ogTipTotal !== null ? ogTipTotal : vTot);
    const safeDir = tipTot < vTot ? "U" : "O";
    const safeLine = safeDir === "U" ? (Math.floor(vTot + 4.0) + 0.5) : (Math.floor(vTot - 4.0) + 0.5);
    return {
        regime: "TIP_ALIGNED_SAFE",
        ballsDeepTotal: Number(tipTot.toFixed(1)),
        safeDir, safeLine, safeOdds: -175, safeProb: 0.75, safeProbPct: 75.0, safeEvPct: 17.8,
        safeLabel: `Alt ${safeDir} ${safeLine.toFixed(1)} (-175)`
    };
}

// ==========================================
// MASTER CALCULATION PIPELINE (1:1 WITH math_engine.js v323)
// ==========================================
function recalculateAndRenderAll(opts = {}) {
    const isSliderDrag = Boolean(opts && opts.isSliderDrag);
    if (!AppState.rawPayload || !AppState.rawPayload.games) return;

    const defaultLeague = (AppState.rawPayload.slate_info && AppState.rawPayload.slate_info.league) || "NFL";
    const mode = AppState.activeMode;
    const sliderVal = (mode === "davinci") ? AppState.intensitySlider : 0.0;
    const isActiveMomentumArc = (mode === "davinci" && sliderVal !== 0);
    const playScaler = (typeof GOLDEN_PLAY_SCALER !== "undefined") ? GOLDEN_PLAY_SCALER : 38.5145;

    const eligibleGamesForCutoff = AppState.rawPayload.games.filter(g => shouldIncludeGame(g, defaultLeague));
    AppState.mnfCutoffMs = computeUpcomingMnfCutoffMs(eligibleGamesForCutoff);

    AppState.processedGames = [];
    AppState.processedProps = [];

    AppState.rawPayload.games.forEach(game => {
        try {
            const gameLeague = game.league || defaultLeague;
            if (!shouldIncludeGame(game, defaultLeague)) return;

            const isCurrentWeek = isGameInCurrentWeek(game.commence_time, AppState.mnfCutoffMs);
            const cleanHome = cleanTeamCode(game.home_team);
            const cleanAway = cleanTeamCode(game.away_team);

            const envPayload = game.environmental_payload || {};
            const circPayload = game.circadian_payload || {};
            const homeTel = (game.team_telemetry && game.team_telemetry.home) || {};
            const awayTel = (game.team_telemetry && game.team_telemetry.away) || {};

            const m7 = calcBarometricBallistics(envPayload);
            const m8 = calcCircadianStrain(circPayload, game.kickoff_local_hour);

            let vegasHomeSpread = 0;
            let vegasTotalLine = (gameLeague === "NCAA") ? 51.5 : 43.5;
            if (Array.isArray(game.props_board)) {
                const homeSpreadObj = game.props_board.find(
                    p => p.market_type === "spread" && p.player.startsWith(`${game.home_team} `)
                );
                const awaySpreadObj = game.props_board.find(
                    p => p.market_type === "spread" && p.player.startsWith(`${game.away_team} `)
                );
                if (homeSpreadObj && homeSpreadObj.base_line !== undefined) {
                    vegasHomeSpread = Number(homeSpreadObj.base_line);
                } else if (awaySpreadObj && awaySpreadObj.base_line !== undefined) {
                    vegasHomeSpread = -Number(awaySpreadObj.base_line);
                }
                const totalObj = game.props_board.find(p => p.market_type === "total");
                if (totalObj && totalObj.base_line !== undefined) {
                    vegasTotalLine = Number(totalObj.base_line);
                }
            }

            const elevTip = calcTenZoneElevationMatrix(envPayload, circPayload, "tip", 0.0);
            const elevBd = calcTenZoneElevationMatrix(envPayload, circPayload, "balls_deep", 0.0);
            const elevActive = calcTenZoneElevationMatrix(envPayload, circPayload, mode, sliderVal);

            const m11Bd = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, "balls_deep", 0.0);
            const m12Bd = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, "balls_deep", 0.0);

            const m11 = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, mode, sliderVal);
            const m12 = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, mode, sliderVal);

            const rawCoupledBd = -calcCoupledInteractionPsi(m11Bd.phiBioScore, m12Bd.netTurnoverEPA, 0.0);
            const psiCoupledBd = Number(Math.max(-2.85, Math.min(2.85, rawCoupledBd)).toFixed(3));

            const rawCoupledActive = (mode === "tip")
                ? 0.0
                : -calcCoupledInteractionPsi(m11.phiBioScore, m12.netTurnoverEPA, sliderVal);
            const psiCoupledActive = Number(Math.max(-3.65, Math.min(3.65, rawCoupledActive)).toFixed(3));

            const gameWithLeague = Object.assign({}, game, { league: gameLeague });

            const m9Base = calcFullGameFairMargin(
                gameWithLeague, m8.phiCircadianPenalty, 0, "tip", vegasHomeSpread, 0, elevTip, 0.0
            );
            const m9Bd = calcFullGameFairMargin(
                gameWithLeague, m8.phiCircadianPenalty, psiCoupledBd, "balls_deep", vegasHomeSpread, elevBd.psiElevPts, elevBd, 0.0
            );
            const m9 = (mode === "tip")
                ? m9Base
                : ((mode === "balls_deep")
                    ? m9Bd
                    : calcFullGameFairMargin(
                        gameWithLeague, m8.phiCircadianPenalty, psiCoupledActive, "davinci", vegasHomeSpread, elevActive.psiElevPts, elevActive, sliderVal
                    ));

            const psiBd = Number((m9Bd.fairHomeSpread - m9Base.fairHomeSpread).toFixed(2));
            const psi11_12 = (mode === "tip") ? 0 : Number((m9.fairHomeSpread - m9Base.fairHomeSpread).toFixed(2));

            const windMph = envPayload.is_dome ? 0 : (envPayload.wind_mph || 0);
            const windPenalty = Math.max(0, (windMph - 10.0) * 0.25);
            const totalIntercept = (gameLeague === "NCAA") ? 51.450 : MODEL_TOTAL_INTERCEPT;

            let baseTelemetryTotal;
            if (typeof calcIndependentTotalTip === "function") {
                baseTelemetryTotal = calcIndependentTotalTip(homeTel, awayTel, gameLeague, windMph, m8.delayTotalDragPts);
            } else {
                const epaSum = Math.max(-0.20, Math.min(0.20, (homeTel.net_epa_per_play || 0) + (awayTel.net_epa_per_play || 0)));
                baseTelemetryTotal = Number(Math.max(28.0, Math.min(78.0, totalIntercept + (epaSum * playScaler) - windPenalty)).toFixed(1));
            }

            const m13Details = (mode === "davinci" ? m9.m13Details : m9Bd.m13Details) || {
                mRiseMultiplier: 1.0, mRiseDog: 1.0, mRiseFav: 1.0, mRiseSignedHomeDelta: 0.0,
                deltaContext: 0.0, dogHavocRatio: 1.0, riseHomeSpreadAdj: 0.0,
                propMeanMultDog: 1.0, propMeanMultFav: 1.0, m11OverrideApplied: false, coachSyncBlocked: false
            };

            const thirdStringTeamClean = m9Base.thirdStringTeam ? cleanTeamCode(m9Base.thirdStringTeam) : null;
            const weatherImpact = computeWeatherImpact(envPayload, m7, elevBd);

            const gameRecord = {
                gameId: game.game_id,
                league: gameLeague,
                isCurrentWeek,
                weekLabel: inferFootballWeekLabel(game, "Week 11"),
                matchup: `${cleanAway} @ ${cleanHome}`,
                homeTeam: cleanHome,
                awayTeam: cleanAway,
                homeFullName: game.home_full_name || cleanHome,
                awayFullName: game.away_full_name || cleanAway,
                commenceTime: game.commence_time,
                kickoffShort: formatKickoffShort(game.commence_time),
                envPayload,
                circPayload,
                elevationM: envPayload.elevation_m || 0,
                windMph,
                vegasHomeSpread,
                vegasTotalLine,
                m7, m8, m9Base, m9Bd, m9, m11, m12,
                elevMatrix: elevBd,
                elevActive,
                psiElev: elevActive.psiElevPts,
                m11CombinedDisplay: Number((m11.phiBioScore + Math.abs(elevActive.psiElevPts)).toFixed(4)),
                m13Details,
                m13Rise: m13Details.mRiseSignedHomeDelta,
                thirdStringQbAlert: m9Base.thirdStringQbAlert,
                thirdStringTeam: thirdStringTeamClean,
                psiBd,
                psi11_12,
                baseTelemetryTotal,
                weatherImpact,
                spreadDivergencePts: Number(game.spread_divergence_pts || 0),
                divergenceAlert: Boolean(game.divergence_alert),
                homeTel,
                awayTel,
                daVinciScript: (() => {
                    const rawSc = (mode === "davinci" && AppState.daVinciScripts[game.game_id]) || { spreadDelta: 0, totalDelta: 0 };
                    const baseSp = m9Bd.fairHomeSpread;
                    const baseTot = baseTelemetryTotal;
                    if (typeof calcDaVinciGameScript === "function") {
                        return calcDaVinciGameScript(baseSp, baseTot, rawSc.spreadDelta, rawSc.totalDelta, gameLeague);
                    }
                    return { isCustom: false, spreadDelta: 0, totalDelta: 0, simHomeSpread: baseSp, simTotal: baseTot, simHomePts: 21, simAwayPts: 21, simHomeMlPct: 50, simAwayMlPct: 50 };
                })(),
                ...(() => {
                    const rawSc = (mode === "davinci" && AppState.daVinciScripts[game.game_id]) || null;
                    const effHomeSp = (rawSc && (rawSc.spreadDelta || 0) !== 0) ? (m9Bd.fairHomeSpread + rawSc.spreadDelta) : m9.fairHomeSpread;
                    const lgE = (typeof getLeagueEngine === "function") ? getLeagueEngine(gameLeague) : null;
                    const pFn = (gap) => (lgE && gameLeague === "NCAA") ? lgE.winProb(gap) : calcPointGapWinProb(gap);
                    let pickHome = (effHomeSp <= 0);
                    let winProb = pFn(Math.abs(effHomeSp));
                    let isDog = Boolean((pickHome && vegasHomeSpread > 0) || (!pickHome && vegasHomeSpread < 0));
                    // v264 NCAA 58.7% ML Upset Floor: stay aligned with Vegas favorite unless NCAA dog clears >=58.7%
                    if (gameLeague === "NCAA" && isDog && winProb < NCAA_ML_UPSET_FLOOR) {
                        pickHome = (vegasHomeSpread <= 0);
                        winProb = 1.0 - winProb;
                        isDog = false;
                    }
                    return {
                        mlWinnerTeam: pickHome ? cleanHome : cleanAway,
                        mlTipWinnerTeam: (m9Base.fairHomeSpread <= 0) ? cleanHome : cleanAway,
                        mlWinnerProbPct: Number((winProb * 100.0).toFixed(1)),
                        mlIsUpset: isDog
                    };
                })(),
                mlHomeOdds: (() => {
                    const m = Array.isArray(game.props_board) && game.props_board.find(x => x.market_type === "moneyline" && !x.is_away_player);
                    return m ? Number(m.base_odds_over) : null;
                })(),
                mlAwayOdds: (() => {
                    const m = Array.isArray(game.props_board) && game.props_board.find(x => x.market_type === "moneyline" && x.is_away_player);
                    return m ? Number(m.base_odds_over) : null;
                })()
            };

            AppState.processedGames.push(gameRecord);

            if (Array.isArray(game.props_board)) {
                game.props_board.forEach((prop, idx) => {
                    const propKey = `${game.game_id}_${prop.market_type}_${idx}`;
                    const m1 = calcVigFreeProbability(prop.base_odds_over || -110, prop.base_odds_under || -110);
                    const vigFreeOver = m1.trueProbA;
                    const vegasLine = (prop.base_line !== undefined && prop.base_line !== null) ? Number(prop.base_line) : 0;
                    const isHomeSpread = prop.market_type === "spread" && prop.player.startsWith(`${game.home_team} `);
                    const isAwayPlayer = Boolean(
                        prop.is_away_player ||
                        (prop.team && cleanTeamCode(prop.team) === cleanAway) ||
                        (prop.player && prop.player.startsWith(`${game.away_team} `))
                    );
                    const playerTeamSpread = isAwayPlayer ? -vegasHomeSpread : vegasHomeSpread;
                    const isUnderdogPlayer = playerTeamSpread > 0;

                    const gatekeeper = evaluatePropGatekeepers(prop, {
                        playerTeamSpread,
                        isRoadPlayer: isAwayPlayer,
                        elevMatrix: (mode === "tip") ? null : elevActive,
                        teamTelemetry: isAwayPlayer ? awayTel : homeTel,
                        oppTelemetry: isAwayPlayer ? homeTel : awayTel,
                        thirdStringQbAlert: m9Base.thirdStringQbAlert,
                        thirdStringTeam: thirdStringTeamClean,
                        isUnderLean: (prop.market_type === "total" && baseTelemetryTotal < vegasLine)
                    });

                    let baseProjectedLine = vegasLine, tipModelProb = 0.50;
                    let bdProjectedLine = vegasLine, bdModelProb = 0.50;
                    let finalCalculatedLine = vegasLine, activeModelProb = 0.50;

                    let safeFloorHookNum = vegasLine, safeFloorLabel = "", safeFloorOdds = -175;
                    let safeFloorWinPct = 82.0, safeFloorEvPct = 0.0, keyAltMer = 1.0, keyAltNote = "";
                    let tier2Line = null, tier2ProbPct = 78.0, tier2Approved = false, tier2Mode = null, tier2Label = "";
                    let totalRegime = "", ceilingHookNum = vegasLine, bdAltLineLabel = "", bdLongerOdds = 145, bdReachProb = 0.50;
                    const hasBackupQb = Boolean(getVerifiedQbDeltaSafe(homeTel) < 0 || getVerifiedQbDeltaSafe(awayTel) < 0);

                    if (prop.market_type === "spread") {
                        baseProjectedLine = isHomeSpread ? m9Base.fairHomeSpread : Number((-m9Base.fairHomeSpread).toFixed(2));
                        bdProjectedLine = isHomeSpread ? m9Bd.fairHomeSpread : Number((-m9Bd.fairHomeSpread).toFixed(2));
                        const dvSpDelta = (mode === "davinci" && gameRecord.daVinciScript && gameRecord.daVinciScript.isCustom)
                            ? (isHomeSpread ? gameRecord.daVinciScript.spreadDelta : -gameRecord.daVinciScript.spreadDelta)
                            : 0.0;
                        finalCalculatedLine = (mode === "balls_deep")
                            ? bdProjectedLine
                            : ((mode === "davinci")
                                ? Number((bdProjectedLine + dvSpDelta).toFixed(2))
                                : baseProjectedLine);

                        const lgEng = (typeof getLeagueEngine === "function") ? getLeagueEngine(gameLeague) : null;
                        const probFn = (gap) => (lgEng && gameLeague === "NCAA") ? lgEng.winProb(gap) : calcPointGapWinProb(gap);
                        tipModelProb = probFn(vegasLine - baseProjectedLine);
                        bdModelProb = probFn(vegasLine - bdProjectedLine);
                        activeModelProb = (mode === "balls_deep") ? bdModelProb : ((mode === "davinci") ? probFn(vegasLine - finalCalculatedLine) : tipModelProb);

                        const keyAltObj = (lgEng && gameLeague === "NCAA")
                            ? lgEng.keyAlt(vegasLine, bdProjectedLine, prop.base_odds_over || -110)
                            : calcKeyNumberAltSpreadSafe(vegasLine, bdProjectedLine, prop.base_odds_over || -110);
                        const baseAltSpread = snapToHalfPointHook(vegasLine, -3.0);
                        const spreadArc = isActiveMomentumArc ? calcMomentumArc(sliderVal, 1.0) : 0.0;

                        const safeSpreadVal = isActiveMomentumArc ? Number((keyAltObj.altLine - spreadArc).toFixed(2)) : keyAltObj.altLine;
                        safeFloorHookNum = safeSpreadVal;
                        safeFloorOdds = keyAltObj.altOdds;
                        keyAltMer = keyAltObj.merRatio;
                        keyAltNote = keyAltObj.keyLabel;
                        tier2Line = keyAltObj.tier2Line;
                        tier2ProbPct = keyAltObj.tier2ProbPct || 78.0;
                        tier2Approved = Boolean(keyAltObj.tier2Approved);
                        tier2Mode = keyAltObj.tier2Mode || null;
                        tier2Label = keyAltObj.tier2Label || "";

                        if (isActiveMomentumArc) {
                            const safeProbRaw = Math.min(0.96, Math.max(0.05, probFn(safeSpreadVal - finalCalculatedLine)));
                            safeFloorWinPct = Number((safeProbRaw * 100).toFixed(1));
                            safeFloorEvPct = Number(calcExpectedValueAndKelly(safeProbRaw, safeFloorOdds).evPercentage.toFixed(2));
                            safeFloorLabel = `Alt ${safeSpreadVal > 0 ? "+" : ""}${safeSpreadVal.toFixed(2)} (${safeFloorOdds})`;
                        } else {
                            safeFloorWinPct = keyAltObj.altProbPct;
                            safeFloorEvPct = keyAltObj.altEvPct;
                            safeFloorLabel = keyAltObj.altStr;
                        }

                        const altSpreadVal = isActiveMomentumArc ? Number((baseAltSpread - spreadArc).toFixed(2)) : baseAltSpread;
                        ceilingHookNum = altSpreadVal;
                        const altFmt = isActiveMomentumArc ? altSpreadVal.toFixed(2) : altSpreadVal.toFixed(1);
                        bdAltLineLabel = `Alt ${altSpreadVal > 0 ? "+" : ""}${altFmt} (+145)`;
                        bdLongerOdds = 145;
                        bdReachProb = probFn(altSpreadVal - finalCalculatedLine);

                    } else if (prop.market_type === "total") {
                        baseProjectedLine = baseTelemetryTotal;
                        const lgTotEng = (typeof getLeagueEngine === "function") ? getLeagueEngine(gameLeague) : null;
                        const totProbFn = (gap) => lgTotEng ? (lgTotEng.totalWinProb ? lgTotEng.totalWinProb(gap) : lgTotEng.winProb(gap)) : calcPointGapWinProb(gap);
                        tipModelProb = Math.max(0.50, totProbFn(Math.abs(baseProjectedLine - vegasLine)));

                        const bdTotObj = (lgTotEng && gameLeague === "NCAA")
                            ? lgTotEng.safeTotal(vegasLine, baseProjectedLine, envPayload, circPayload, elevBd, hasBackupQb)
                            : calcReportCalibratedTotalSafe(vegasLine, baseProjectedLine, envPayload, circPayload, elevBd, gameLeague, hasBackupQb);
                        bdProjectedLine = bdTotObj.ballsDeepTotal;
                        totalRegime = bdTotObj.regime || "TIP_ALIGNED_SAFE";
                        bdModelProb = Math.max(0.50, totProbFn(Math.abs(bdProjectedLine - vegasLine)));

                        const bdDirSign = (bdTotObj.safeDir === "U") ? -1 : 1;
                        const totalArc = isActiveMomentumArc ? calcMomentumArc(sliderVal, 1.15) : 0.0;
                        if (mode === "balls_deep") {
                            finalCalculatedLine = bdProjectedLine;
                            activeModelProb = bdModelProb;
                        } else if (mode === "davinci") {
                            const dvTotDelta = (gameRecord.daVinciScript && gameRecord.daVinciScript.isCustom) ? gameRecord.daVinciScript.totalDelta : 0.0;
                            finalCalculatedLine = Number(Math.max(17.5, Math.min(99.5, bdProjectedLine + dvTotDelta)).toFixed(1));
                            activeModelProb = Math.max(0.50, totProbFn(Math.abs(finalCalculatedLine - vegasLine)));
                        } else {
                            finalCalculatedLine = baseProjectedLine;
                            activeModelProb = tipModelProb;
                        }

                        const isUnderActive = (mode === "tip") ? (finalCalculatedLine < vegasLine) : (bdTotObj.safeDir === "U");
                        safeFloorOdds = bdTotObj.safeOdds || -175;
                        keyAltNote = (totalRegime === "SHOOTOUT_SAFE_OVER")
                            ? "Shootout Safe Over"
                            : (totalRegime === "GRIND_SAFE_UNDER" ? "Grind Safe Under" : "Tip-Aligned Safe Alt");

                        const safeTotalVal = isActiveMomentumArc
                            ? Number((isUnderActive ? (bdTotObj.safeLine - totalArc) : (bdTotObj.safeLine + totalArc)).toFixed(1))
                            : bdTotObj.safeLine;
                        safeFloorHookNum = safeTotalVal;
                        if (isActiveMomentumArc) {
                            const safeTotalEdge = isUnderActive ? (safeTotalVal - finalCalculatedLine) : (finalCalculatedLine - safeTotalVal);
                            const safeTotalProb = Math.min(0.96, Math.max(0.05, totProbFn(safeTotalEdge)));
                            safeFloorWinPct = Number((safeTotalProb * 100).toFixed(1));
                            safeFloorEvPct = Number(calcExpectedValueAndKelly(safeTotalProb, safeFloorOdds).evPercentage.toFixed(2));
                            safeFloorLabel = `Alt ${isUnderActive ? "U" : "O"} ${safeTotalVal.toFixed(1)} (${safeFloorOdds})`;
                        } else {
                            safeFloorWinPct = bdTotObj.safeProbPct;
                            safeFloorEvPct = bdTotObj.safeEvPct;
                            safeFloorLabel = bdTotObj.safeLabel;
                        }

                        const baseAltTotal = isUnderActive ? (Math.floor(vegasLine - 3.0) + 0.5) : (Math.floor(vegasLine + 3.0) + 0.5);
                        const altTotalVal = isActiveMomentumArc
                            ? Number((isUnderActive ? (baseAltTotal - totalArc) : (baseAltTotal + totalArc)).toFixed(1))
                            : baseAltTotal;
                        ceilingHookNum = altTotalVal;
                        bdAltLineLabel = `Alt ${isUnderActive ? "U" : "O"} ${altTotalVal.toFixed(1)} (+155)`;
                        bdLongerOdds = 155;
                        const altTotalEdge = isUnderActive ? (altTotalVal - finalCalculatedLine) : (finalCalculatedLine - altTotalVal);
                        bdReachProb = totProbFn(altTotalEdge);

                    } else if (prop.market_type === "moneyline") {
                        const isHomeMl = !isAwayPlayer;
                        baseProjectedLine = isHomeMl ? m9Base.fairHomeSpread : Number((-m9Base.fairHomeSpread).toFixed(2));
                        bdProjectedLine = isHomeMl ? m9Bd.fairHomeSpread : Number((-m9Bd.fairHomeSpread).toFixed(2));
                        const dvMlDelta = (mode === "davinci" && gameRecord.daVinciScript && gameRecord.daVinciScript.isCustom)
                            ? (isHomeMl ? gameRecord.daVinciScript.spreadDelta : -gameRecord.daVinciScript.spreadDelta)
                            : 0.0;
                        finalCalculatedLine = (mode === "balls_deep")
                            ? bdProjectedLine
                            : ((mode === "davinci")
                                ? Number((bdProjectedLine + dvMlDelta).toFixed(2))
                                : baseProjectedLine);

                        const lgMlEng = (typeof getLeagueEngine === "function") ? getLeagueEngine(gameLeague) : null;
                        const mlProbFn = (gap) => (lgMlEng && gameLeague === "NCAA") ? lgMlEng.winProb(gap) : calcPointGapWinProb(gap);
                        tipModelProb = mlProbFn(0.0 - baseProjectedLine);
                        bdModelProb = mlProbFn(0.0 - bdProjectedLine);
                        activeModelProb = (mode === "balls_deep") ? bdModelProb : ((mode === "davinci") ? mlProbFn(0.0 - finalCalculatedLine) : tipModelProb);

                        const mlPx = Number(prop.base_odds_over || -110);
                        const mlPxStr = `${mlPx > 0 ? "+" : ""}${mlPx}`;
                        safeFloorHookNum = 0.0;
                        safeFloorOdds = mlPx;
                        safeFloorWinPct = Number((activeModelProb * 100.0).toFixed(1));
                        safeFloorEvPct = Number(calcExpectedValueAndKelly(activeModelProb, mlPx).evPercentage.toFixed(2));
                        keyAltNote = (mlPx > 0) ? "Underdog ML Ambush" : "Straight-Up Favorite ML";
                        safeFloorLabel = `ML ${mlPxStr}`;
                        bdAltLineLabel = `${isHomeMl ? cleanHome : cleanAway} -3.5 (+145)`;
                        bdLongerOdds = 145;
                        bdReachProb = mlProbFn(-3.5 - finalCalculatedLine);

                    } else {
                        const gatedMu = gatekeeper.adjustedMu > 0 ? gatekeeper.adjustedMu : (prop.projected_mean_mu || vegasLine || 50);
                        baseProjectedLine = Number(gatedMu.toFixed(1));
                        const varianceSigma2 = prop.projected_variance_sigma2 || 225;
                        tipModelProb = calcGammaSurvivalProb(baseProjectedLine, varianceSigma2, vegasLine || 45.5).trueOverProb;

                        const m13PropMult = isUnderdogPlayer ? (m13Details.propMeanMultDog || 1.0) : (m13Details.propMeanMultFav || 1.0);
                        bdProjectedLine = Number((baseProjectedLine * m13PropMult).toFixed(1));
                        bdModelProb = Math.max(0.01, Math.min(0.99, calcGammaSurvivalProb(bdProjectedLine, varianceSigma2, vegasLine || 45.5).trueOverProb));

                        const propArcPct = isActiveMomentumArc ? calcMomentumArc(sliderVal, 0.085) : 0.0;
                        if (mode === "tip") {
                            finalCalculatedLine = baseProjectedLine;
                            activeModelProb = tipModelProb;
                        } else if (mode === "balls_deep") {
                            finalCalculatedLine = bdProjectedLine;
                            activeModelProb = bdModelProb;
                        } else {
                            finalCalculatedLine = Math.max(1, Number((bdProjectedLine * (1.0 + propArcPct)).toFixed(1)));
                            activeModelProb = calcGammaSurvivalProb(finalCalculatedLine, varianceSigma2, vegasLine || 45.5).trueOverProb;
                        }

                        const baseFloorMilestone = Math.max(5, Math.round((baseProjectedLine * 0.70) / 5) * 5);
                        const safeFloorMilestone = isActiveMomentumArc ? Math.max(1, Number((finalCalculatedLine * 0.70).toFixed(1))) : baseFloorMilestone;
                        safeFloorHookNum = safeFloorMilestone;
                        safeFloorOdds = -190;
                        safeFloorWinPct = Number((Math.min(0.97, Math.max(0.05, calcGammaSurvivalProb(finalCalculatedLine, varianceSigma2, safeFloorMilestone).trueOverProb)) * 100).toFixed(1));
                        safeFloorLabel = `${safeFloorMilestone}+ Safe Floor (-190)`;

                        const baseCeilMilestone = Math.max(10, Math.round((baseProjectedLine * 1.25) / 5) * 5);
                        const ceilingMilestone = isActiveMomentumArc ? Math.max(5, Number((finalCalculatedLine * 1.25).toFixed(1))) : baseCeilMilestone;
                        ceilingHookNum = ceilingMilestone;
                        bdAltLineLabel = `${ceilingMilestone}+ Escalator (+160)`;
                        bdLongerOdds = 160;
                        bdReachProb = Math.max(0.05, calcGammaSurvivalProb(finalCalculatedLine, varianceSigma2, ceilingMilestone).trueOverProb);
                    }

                    const pickTeamCode = (prop.market_type === "spread")
                        ? (isHomeSpread ? cleanHome : cleanAway)
                        : (prop.market_type === "moneyline" ? (isAwayPlayer ? cleanAway : cleanHome) : `${cleanAway}/${cleanHome}`);
                    let shortTitle = cleanLabelCodes(prop.player);
                    let tipDisplayLabel = cleanLabelCodes(prop.player);
                    let activeDisplayLabel = cleanLabelCodes(prop.player);
                    let lineDisplay = fmtSigned(vegasLine);
                    const mlOddsVal = Number(prop.base_odds_over || -110);
                    const isUnderdogMl = Boolean(prop.market_type === "moneyline" && (prop.is_underdog || mlOddsVal > 0));
                    const mlUpsetFloor = (gameLeague === "NCAA") ? NCAA_ML_UPSET_FLOOR : 0.5001;
                    const mlCredFloor = (gameLeague === "NCAA" && isUnderdogMl) ? NCAA_ML_UPSET_FLOOR : 0.48;
                    const mlCredible = Boolean(prop.market_type !== "moneyline" || (activeModelProb >= mlCredFloor && mlOddsVal <= 300));
                    const isUpsetMlPick = Boolean(prop.market_type === "moneyline" && isUnderdogMl && activeModelProb >= mlUpsetFloor && mlOddsVal <= 300);

                    if (prop.market_type === "spread") {
                        shortTitle = `${pickTeamCode} ${fmtSigned(vegasLine)}`;
                        lineDisplay = fmtSigned(vegasLine);
                    } else if (prop.market_type === "moneyline") {
                        const mlPx = Number(prop.base_odds_over || -110);
                        const mlPxStr = `${mlPx > 0 ? "+" : ""}${mlPx}`;
                        shortTitle = `${pickTeamCode} ML (${mlPxStr})`;
                        lineDisplay = `ML ${mlPxStr}`;
                    } else if (prop.market_type === "total") {
                        const isUnderTip = baseProjectedLine < vegasLine;
                        const isUnderActive = finalCalculatedLine < vegasLine;
                        shortTitle = `${cleanAway}/${cleanHome} ${isUnderActive ? "U" : "O"} ${vegasLine}`;
                        lineDisplay = `${isUnderActive ? "U" : "O"} ${vegasLine}`;
                        tipDisplayLabel = `${cleanAway}@${cleanHome} Total (${isUnderTip ? "U" : "O"} ${vegasLine})`;
                        activeDisplayLabel = `${cleanAway}@${cleanHome} Total (${isUnderActive ? "U" : "O"} ${vegasLine})`;
                    }

                    let bdSideOdds = prop.base_odds_over || -110;
                    let activeSideOdds = prop.base_odds_over || -110;
                    if (prop.market_type === "total") {
                        const tipIsUnder = baseProjectedLine < vegasLine;
                        if ((bdProjectedLine < vegasLine) !== tipIsUnder && prop.base_odds_under) bdSideOdds = prop.base_odds_under;
                        if ((finalCalculatedLine < vegasLine) !== tipIsUnder && prop.base_odds_under) activeSideOdds = prop.base_odds_under;
                    }

                    const m2Tip = calcExpectedValueAndKelly(tipModelProb, prop.base_odds_over || -110);
                    const m2Bd = calcExpectedValueAndKelly(bdModelProb, bdSideOdds);
                    const m2BdAlt = calcExpectedValueAndKelly(bdReachProb, bdLongerOdds);
                    const m2Active = calcExpectedValueAndKelly(activeModelProb, activeSideOdds);

                    const tipEvPct = Number(m2Tip.evPercentage.toFixed(2));
                    const activeEvPct = Number(m2Active.evPercentage.toFixed(2));
                    const rawTipTier = getTierFromEv(tipEvPct);
                    const rawActiveTier = getTierFromEv(activeEvPct);
                    const tipCredible = (prop.market_type !== "moneyline") || (tipModelProb >= mlCredFloor && mlOddsVal <= 300);
                    const tipBadge = gatekeeper.blocked ? "PASS" : ((rawTipTier === "SMASH" && !tipCredible) ? "TOO_CLOSE" : rawTipTier);
                    const activeBadge = gatekeeper.blocked ? "PASS" : ((rawActiveTier === "SMASH" && !mlCredible) ? "TOO_CLOSE" : rawActiveTier);

                    AppState.processedProps.push({
                        propKey,
                        gameRecord,
                        commenceTime: game.commence_time,
                        commenceMs: game.commence_time ? (new Date(game.commence_time).getTime() || 0) : 0,
                        isCurrentWeek,
                        weekLabel: gameRecord.weekLabel,
                        gameId: game.game_id,
                        league: gameLeague,
                        matchup: gameRecord.matchup,
                        homeTeam: cleanHome,
                        awayTeam: cleanAway,
                        pickTeamCode,
                        shortTitle,
                        lineDisplay,
                        player: tipDisplayLabel,
                        activePlayerLabel: activeDisplayLabel,
                        marketType: prop.market_type,
                        baseLine: vegasLine,
                        baseOdds: activeSideOdds,
                        isHomeSpread,
                        tipProjectedMean: baseProjectedLine,
                        tipModelPct: Number((tipModelProb * 100).toFixed(2)),
                        tipEvPct,
                        tipBadge,
                        projectedMean: finalCalculatedLine,
                        bdProjectedMean: bdProjectedLine,
                        vigFreePct: Number((vigFreeOver * 100).toFixed(2)),
                        bdModelPct: Number((bdModelProb * 100).toFixed(2)),
                        bdEvPct: Number(m2Bd.evPercentage.toFixed(2)),
                        safeFloorHookNum,
                        safeFloorLabel,
                        safeFloorOdds,
                        safeFloorWinPct,
                        safeFloorEvPct,
                        keyAltMer,
                        keyAltNote,
                        tier2Line,
                        tier2ProbPct,
                        tier2Approved,
                        tier2Mode,
                        tier2Label,
                        totalRegime,
                        ceilingHookNum,
                        bdAltLabel: bdAltLineLabel,
                        bdAltEvPct: Number(m2BdAlt.evPercentage.toFixed(2)),
                        activeModelPct: Number((activeModelProb * 100).toFixed(2)),
                        activeModelProbRaw: activeModelProb,
                        evPct: activeEvPct,
                        quarterKellyPct: gatekeeper.blocked ? 0.0 : Number(m2Active.quarterKellyStakePct.toFixed(2)),
                        isKellyCapped: Boolean(m2Active.isKellyCapped && !gatekeeper.blocked),
                        tierBadge: activeBadge,
                        gatekeeperBlocked: gatekeeper.blocked,
                        gatekeeperAction: gatekeeper.action,
                        gatekeeperFlags: gatekeeper.flags,
                        isUnderdogMl,
                        isUpsetMlPick,
                        flagshipSlot: "",
                        porkysSlot: "",
                        psiBd,
                        psiActive: psi11_12
                    });
                });
            }
        } catch (gameErr) {
            console.error("DixPix Game Render Skip:", game && game.game_id, gameErr);
        }
    });

    // Lock Main Stage Flagship 5-Pack & Porky's 5-Pack to pre-kickoff current-week games
    const nowMs = Date.now();
    const isPreKickoffGame = (g) => {
        if (!g.commenceTime) return true;
        const kickMs = new Date(g.commenceTime).getTime();
        return isNaN(kickMs) || kickMs > nowMs;
    };
    const currentWeekGames = AppState.processedGames.filter(g => g.isCurrentWeek && isPreKickoffGame(g));
    const activeWeekPool = currentWeekGames.length > 0 ? currentWeekGames : AppState.processedGames.filter(isPreKickoffGame);

    const bestPlayPerGame = [];
    const trapPairsPool = [];

    activeWeekPool.forEach(g => {
        const isExtremeNcaaOutlier = Boolean(g.league === "NCAA" && Number(g.spreadDivergencePts || 0) >= 14.0);
        const gameSpreads = isExtremeNcaaOutlier ? [] : AppState.processedProps.filter(
            p => p.gameId === g.gameId && p.marketType === "spread" && Math.abs(p.baseLine) <= 28.5 && Math.abs(p.baseOdds || -110) < 220
        );
        const gameTotals = AppState.processedProps.filter(
            p => p.gameId === g.gameId && p.marketType === "total" && !p.gatekeeperBlocked && Math.abs(p.baseOdds || -110) < 220
        );

        const gameCandidates = [];
        if (gameSpreads.length > 0) {
            gameSpreads.sort((a, b) => b.tipEvPct - a.tipEvPct);
            const bestSide = gameSpreads[0];
            const worstSide = gameSpreads[gameSpreads.length - 1];
            if (!bestSide.gatekeeperBlocked) gameCandidates.push(bestSide);
            if (gameSpreads.length > 1 && worstSide.tipEvPct <= PASS_EV_CUTOFF) {
                trapPairsPool.push({ trapProp: worstSide, fadeProp: bestSide });
            }
        }
        if (gameTotals.length > 0) {
            gameTotals.sort((a, b) => b.tipEvPct - a.tipEvPct);
            gameCandidates.push(gameTotals[0]);
        }
        if (gameCandidates.length > 0) {
            gameCandidates.sort((a, b) => b.tipEvPct - a.tipEvPct);
            bestPlayPerGame.push(gameCandidates[0]);
        }
    });

    bestPlayPerGame.sort((a, b) => b.tipEvPct - a.tipEvPct);
    const selectedFive = [];
    const usedGameIds = new Set();
    let spreadCount = 0, totalCount = 0;

    for (const p of bestPlayPerGame) {
        if (selectedFive.length >= 5) break;
        if (usedGameIds.has(p.gameId)) continue;
        if (p.marketType === "spread" && spreadCount >= 3) continue;
        if (p.marketType === "total" && totalCount >= 3) continue;
        selectedFive.push(p);
        usedGameIds.add(p.gameId);
        if (p.marketType === "spread") spreadCount++;
        else if (p.marketType === "total") totalCount++;
    }
    if (selectedFive.length < 5) {
        for (const p of bestPlayPerGame) {
            if (selectedFive.length >= 5) break;
            if (usedGameIds.has(p.gameId)) continue;
            selectedFive.push(p);
            usedGameIds.add(p.gameId);
        }
    }
    selectedFive.sort((a, b) => b.tipEvPct - a.tipEvPct);
    selectedFive.slice(0, 3).forEach((p, i) => { p.flagshipSlot = `MÉNAGE À TROIS #${i + 1}`; });
    selectedFive.slice(3, 5).forEach((p, i) => { p.flagshipSlot = `5-PACK FLEX #${i + 4}`; });
    AppState.flagshipFivePack = selectedFive;

    trapPairsPool.sort((a, b) => a.trapProp.tipEvPct - b.trapProp.tipEvPct);
    AppState.porkysFivePack = trapPairsPool.slice(0, 5).map((pair, idx) => {
        const slotLabel = idx < 3 ? `DAY-SHIFT TRAP #${idx + 1}` : `KEEP IT IN YOUR PANTS #${idx + 1}`;
        pair.trapProp.porkysSlot = slotLabel;
        return { slotLabel, isTopThreeTrap: idx < 3, trapProp: pair.trapProp, fadeProp: pair.fadeProp };
    });

    // Ensure a valid active pick is selected for the Research Inspector
    const activeNonFinalProps = AppState.processedProps.filter(p => !isGameCompletedFinal(p.gameRecord));
    if (!AppState.selectedPropKey || !activeNonFinalProps.some(p => p.propKey === AppState.selectedPropKey)) {
        AppState.selectedPropKey = (AppState.flagshipFivePack[0] && AppState.flagshipFivePack[0].propKey)
            || (activeNonFinalProps[0] && activeNonFinalProps[0].propKey)
            || null;
    }

    if (isSliderDrag) {
        if (AppState.activeView === "picks") {
            renderPicksFeed();
            renderPickInspector();
        } else if (AppState.activeView === "fivepack") {
            renderFlagshipFivePack();
        } else if (AppState.activeView === "weather") {
            renderWeatherLab();
        } else if (AppState.activeView === "modules") {
            if (typeof renderCompendiumBoard === "function") renderCompendiumBoard();
            if (typeof renderTelemetryInspector === "function") renderTelemetryInspector();
        }
        if (typeof renderCombinatoricsDeck === "function") renderCombinatoricsDeck();
    } else {
        renderPicksFeed();
        renderPickInspector();
        renderFlagshipFivePack();
        renderWeatherLab();
        if (typeof renderCompendiumBoard === "function") renderCompendiumBoard();
        if (typeof renderTelemetryInspector === "function") renderTelemetryInspector();
        if (typeof renderCombinatoricsDeck === "function") renderCombinatoricsDeck();
        if (typeof renderHistoricalLedger === "function") renderHistoricalLedger();
        if (typeof renderFaqAccordion === "function") renderFaqAccordion();
        if (typeof renderLiveBottomTicker === "function") renderLiveBottomTicker();
    }
}

// ==========================================
// VIEW 1A: 1-TILE-PER-GAME MATCHUP CARDS (ALL MARKETS) + SINGLE-MARKET LEADERBOARD
// ==========================================
function getConfidenceScore(p) {
    if (!p) return -999;
    return Number((p.evPct * Math.pow(Math.max(0.05, p.activeModelProbRaw || 0.5), 1.5)).toFixed(3));
}

function getVisibleFeedProps() {
    const activeGames = AppState.processedGames.filter(g => !isGameCompletedFinal(g));
    const activeGameIds = new Set(activeGames.map(g => g.gameId));
    const pool = [];

    activeGames.forEach(g => {
        const gSpreads = AppState.processedProps
            .filter(p => p.gameId === g.gameId && p.marketType === "spread")
            .sort((a, b) => b.tipEvPct - a.tipEvPct);
        const gTotals = AppState.processedProps
            .filter(p => p.gameId === g.gameId && p.marketType === "total");
        const gMls = AppState.processedProps
            .filter(p => p.gameId === g.gameId && p.marketType === "moneyline")
            .sort((a, b) => b.activeModelPct - a.activeModelPct);

        if (gSpreads[0]) pool.push(gSpreads[0]);
        if (gTotals[0]) pool.push(gTotals[0]);
        if (gMls.length > 0) {
            if (AppState.marketFilter === "moneyline") {
                gMls.forEach(m => pool.push(m));
            } else {
                let chosenMl = gMls[0];
                if (g.league === "NCAA" && chosenMl.isUnderdogMl && (chosenMl.activeModelProbRaw || 0) < NCAA_ML_UPSET_FLOOR) {
                    const favMl = gMls.find(m => !m.isUnderdogMl);
                    if (favMl) chosenMl = favMl;
                }
                pool.push(chosenMl);
            }
        }
        AppState.processedProps
            .filter(p => p.gameId === g.gameId && p.marketType !== "spread" && p.marketType !== "total" && p.marketType !== "moneyline")
            .forEach(p => pool.push(p));
    });

    return pool.filter(p => {
        if (!activeGameIds.has(p.gameId)) return false;
        if (AppState.marketFilter !== "ALL" && p.marketType !== AppState.marketFilter) return false;
        if (AppState.smashOnly && p.tierBadge !== "SMASH") return false;
        if (AppState.weatherOnly && !(p.gameRecord && p.gameRecord.weatherImpact && p.gameRecord.weatherImpact.isEdge)) return false;
        if (AppState.searchQuery) {
            const hay = `${p.matchup} ${p.shortTitle} ${p.player} ${p.gameRecord.homeFullName} ${p.gameRecord.awayFullName}`.toLowerCase();
            if (!hay.includes(AppState.searchQuery)) return false;
        }
        return true;
    });
}

function sortFeedProps(list) {
    const arr = [...list];
    if (AppState.sortOrder === "prob") {
        arr.sort((a, b) => b.activeModelPct - a.activeModelPct);
    } else if (AppState.sortOrder === "weather") {
        arr.sort((a, b) => ((b.gameRecord && b.gameRecord.weatherImpact.score) || 0) - ((a.gameRecord && a.gameRecord.weatherImpact.score) || 0));
    } else if (AppState.sortOrder === "ev") {
        arr.sort((a, b) => getConfidenceScore(b) - getConfidenceScore(a));
    } else {
        // Default: Chronological Kickoff Order (Live in-play games pinned first, then earliest kickoff, tie-break confidence edge)
        arr.sort((a, b) => {
            const aLive = Boolean(getEspnScoreMatch(a.league, a.matchup) && getEspnScoreMatch(a.league, a.matchup).state === "in") ? 0 : 1;
            const bLive = Boolean(getEspnScoreMatch(b.league, b.matchup) && getEspnScoreMatch(b.league, b.matchup).state === "in") ? 0 : 1;
            if (aLive !== bLive) return aLive - bLive;
            const timeDiff = (a.commenceMs || 0) - (b.commenceMs || 0);
            if (timeDiff !== 0) return timeDiff;
            return getConfidenceScore(b) - getConfidenceScore(a);
        });
    }
    return arr;
}

function buildMarketCellHTML(p, labelTag) {
    if (!p) {
        return `<div class="market-cell" style="opacity:0.45; cursor:default;"><div class="mc-top"><span>${labelTag}</span></div><div class="mc-line" style="color:var(--text-3);">N/A</div><div class="mc-foot"><span style="color:var(--text-3);">--</span></div></div>`;
    }
    const isSel = (p.propKey === AppState.selectedPropKey);
    const inSlip = AppState.selectedParlayLegs.has(p.propKey);
    const col = getTierColor(p.tierBadge);
    const isMl = (p.marketType === "moneyline");
    const projTxt = isMl
        ? `${p.activeModelPct.toFixed(0)}% Win`
        : `Proj ${p.marketType === "spread" ? fmtSigned(p.projectedMean, 1) : Number(p.projectedMean).toFixed(1)}`;
    const cellTitle = isMl
        ? `${p.pickTeamCode} ${p.baseOdds > 0 ? "+" : ""}${p.baseOdds}`
        : (p.marketType === "spread" ? p.shortTitle : p.lineDisplay);

    return `
        <div class="market-cell ${isSel ? "selected" : ""}" onclick="window.selectPick('${p.propKey}', true)">
            <div class="mc-top">
                <span>${labelTag}</span>
                ${renderTierBadgeHTML(p.tierBadge)}
            </div>
            <div class="mc-line">${cellTitle}</div>
            <div class="mc-foot">
                <span style="color:${col}; font-weight:700;">${projTxt} · ${p.evPct > 0 ? "+" : ""}${p.evPct.toFixed(0)}%</span>
                <button type="button" class="mini-add-btn ${inSlip ? "in-slip" : ""}" title="${inSlip ? "Remove from Slip" : "Add to Slip"}" onclick="window.toggleParlayLeg('${p.propKey}', event)">${inSlip ? "✓" : "+"}</button>
            </div>
        </div>
    `;
}

function buildUnifiedMatchupCardHTML(gameBundle) {
    const { g, spreadProp, totalProp, mlProp } = gameBundle;
    const espnMatch = getEspnScoreMatch(g.league, g.matchup, g.awayFullName, g.homeFullName);
    const isLive = Boolean(espnMatch && espnMatch.state === "in");
    const hasSelected = [spreadProp, totalProp, mlProp].some(p => p && p.propKey === AppState.selectedPropKey);
    const slotProp = [spreadProp, totalProp].find(p => p && p.flagshipSlot);
    const slotBadge = slotProp
        ? `<span class="badge ${slotProp.flagshipSlot.includes("MÉNAGE") ? "b-gold" : "b-cyan"}">${slotProp.flagshipSlot.replace("MÉNAGE À TROIS", "MÉNAGE").replace("5-PACK ", "")}</span>`
        : "";
    const upsetBadge = (mlProp && mlProp.isUpsetMlPick)
        ? (AppState.activeMode === "tip" ? `<span class="badge b-gold">🔒 DOG UPSET</span>` : `<span class="badge b-gold">🐶 UPSET ALERT</span>`)
        : "";
    const customBadge = (AppState.activeMode === "davinci" && g.daVinciScript && g.daVinciScript.isCustom)
        ? `<span class="badge b-gold">🎨 CUSTOM</span>`
        : "";

    return `
        <div class="matchup-card ${hasSelected ? "selected" : ""} ${isLive ? "is-live" : ""}">
            <div class="matchup-head">
                <div class="matchup-title-row">
                    <span class="mono" style="font-size:11px; color:var(--text-3);">${g.league}</span>
                    <span>${g.matchup}</span>
                    <span class="mono" style="font-size:11px; color:var(--text-2); font-weight:600;">
                        ${isLive ? `<strong style="color:var(--gold);">🔴 ${espnMatch.shortDetail || "LIVE"} · ${espnMatch.scoreStr}</strong>` : g.kickoffShort}
                    </span>
                    ${slotBadge}${upsetBadge}${customBadge}
                </div>
                <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    ${renderWeatherPillHTML(g)}
                </div>
            </div>
            <div class="market-strip">
                ${buildMarketCellHTML(spreadProp, "SPREAD")}
                ${buildMarketCellHTML(totalProp, "TOTAL")}
                ${buildMarketCellHTML(mlProp, "MONEYLINE")}
            </div>
        </div>
    `;
}

function buildPickRowHTML(p) {
    const g = p.gameRecord;
    const isSelected = (p.propKey === AppState.selectedPropKey);
    const inSlip = AppState.selectedParlayLegs.has(p.propKey);
    const espnMatch = getEspnScoreMatch(p.league, p.matchup, g.awayFullName, g.homeFullName);
    const isLive = Boolean(espnMatch && espnMatch.state === "in");
    const col = getTierColor(p.tierBadge);
    const isMl = (p.marketType === "moneyline");
    const projDisp = isMl
        ? `${p.activeModelPct.toFixed(0)}% Win`
        : ((p.marketType === "spread") ? fmtSigned(p.projectedMean, 1) : Number(p.projectedMean).toFixed(1));
    const upsetBadge = (isMl && p.isUpsetMlPick)
        ? (AppState.activeMode === "tip"
            ? `<span class="badge b-gold">🔒 DOG UPSET</span>`
            : `<span class="badge b-gold">🐶 UPSET ALERT</span>`)
        : (isMl ? `<span class="badge b-muted">ML</span>` : "");
    const slotBadge = p.flagshipSlot
        ? `<span class="badge ${p.flagshipSlot.includes("MÉNAGE") ? "b-gold" : "b-cyan"}">${p.flagshipSlot.replace("MÉNAGE À TROIS", "MÉNAGE").replace("5-PACK ", "")}</span>`
        : upsetBadge;

    return `
        <div class="pick-row ${isSelected ? "selected" : ""} ${isLive ? "is-live" : ""}" onclick="window.selectPick('${p.propKey}', true)">
            <div class="pick-id-col">
                <div class="pick-top-meta">
                    <span class="mono" style="font-weight:700; color:var(--text-2);">${p.league}</span>
                    <span>•</span>
                    <span>${isLive ? `<strong style="color:var(--gold);">🔴 ${espnMatch.shortDetail || "LIVE"} · ${espnMatch.scoreStr}</strong>` : g.kickoffShort}</span>
                    ${slotBadge}
                </div>
                <div class="pick-title">
                    <span>${p.shortTitle}</span>
                    ${renderWeatherPillHTML(g)}
                </div>
            </div>

            <div class="pick-line-col">
                <div class="line-main">${isMl ? projDisp : `Proj ${projDisp}`}</div>
                <div class="line-sub">${isMl ? `Imp ${p.vigFreePct.toFixed(0)}%` : `Vegas ${p.lineDisplay}`}</div>
            </div>

            <div class="prob-col">
                <div class="prob-nums">
                    <span style="color:${col};">${p.activeModelPct.toFixed(1)}%</span>
                    <span style="font-size:10.5px; color:${col};">${p.evPct > 0 ? "+" : ""}${p.evPct.toFixed(1)}%</span>
                </div>
                <div class="meter-track">
                    <div class="meter-fill" style="width:${Math.min(100, Math.max(5, p.activeModelPct))}%; background:${col};"></div>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
                ${renderTierBadgeHTML(p.tierBadge)}
                <button type="button" class="add-btn ${inSlip ? "in-slip" : ""}" title="${inSlip ? "Remove from Slip" : "Add to Slip"}" onclick="window.toggleParlayLeg('${p.propKey}', event)">
                    ${inSlip ? "✓" : "+"}
                </button>
            </div>
        </div>
    `;
}

function renderPicksFeed() {
    const container = document.getElementById("picks-feed-list");
    if (!container) return;

    const visible = getVisibleFeedProps();
    if (visible.length === 0) {
        const rawGames = (AppState.rawPayload && Array.isArray(AppState.rawPayload.games)) ? AppState.rawPayload.games : [];
        const updatedAt = (AppState.rawPayload && AppState.rawPayload.slate_info && AppState.rawPayload.slate_info.last_updated) || "Waiting for feed";
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-weight:800; color:var(--gold); margin-bottom:6px;">No active picks match the current filters</div>
                <div>Loaded ${rawGames.length} raw slate games · Last sync: ${updatedAt}</div>
            </div>
        `;
        return;
    }

    // Upgrade #1: Unified 1-Tile-Per-Game Matchup Cards when viewing "All Markets"
    if (AppState.marketFilter === "ALL") {
        const byGame = new Map();
        visible.forEach(p => {
            if (!byGame.has(p.gameId)) {
                byGame.set(p.gameId, { g: p.gameRecord, spreadProp: null, totalProp: null, mlProp: null, bestScore: -999, maxProb: 0 });
            }
            const b = byGame.get(p.gameId);
            if (p.marketType === "spread" && !b.spreadProp) b.spreadProp = p;
            else if (p.marketType === "total" && !b.totalProp) b.totalProp = p;
            else if (p.marketType === "moneyline" && !b.mlProp) b.mlProp = p;
            b.bestScore = Math.max(b.bestScore, getConfidenceScore(p));
            b.maxProb = Math.max(b.maxProb, p.activeModelPct || 0);
        });

        const sortBundles = (list) => {
            const arr = [...list];
            if (AppState.sortOrder === "prob") arr.sort((a, b) => b.maxProb - a.maxProb);
            else if (AppState.sortOrder === "weather") arr.sort((a, b) => ((b.g.weatherImpact && b.g.weatherImpact.score) || 0) - ((a.g.weatherImpact && a.g.weatherImpact.score) || 0));
            else if (AppState.sortOrder === "ev") arr.sort((a, b) => b.bestScore - a.bestScore);
            else {
                arr.sort((a, b) => {
                    const aLive = Boolean(getEspnScoreMatch(a.g.league, a.g.matchup) && getEspnScoreMatch(a.g.league, a.g.matchup).state === "in") ? 0 : 1;
                    const bLive = Boolean(getEspnScoreMatch(b.g.league, b.g.matchup) && getEspnScoreMatch(b.g.league, b.g.matchup).state === "in") ? 0 : 1;
                    if (aLive !== bLive) return aLive - bLive;
                    const aMs = a.g.commenceTime ? (new Date(a.g.commenceTime).getTime() || 0) : 0;
                    const bMs = b.g.commenceTime ? (new Date(b.g.commenceTime).getTime() || 0) : 0;
                    if (aMs !== bMs) return aMs - bMs;
                    return b.bestScore - a.bestScore;
                });
            }
            return arr;
        };

        const allBundles = Array.from(byGame.values());
        const currBundles = sortBundles(allBundles.filter(b => b.g.isCurrentWeek));
        const lookBundles = sortBundles(allBundles.filter(b => !b.g.isCurrentWeek));

        let html = currBundles.map(buildUnifiedMatchupCardHTML).join("");
        if (lookBundles.length > 0) {
            const cutoffDt = new Date(AppState.mnfCutoffMs);
            const cutoffLabel = isNaN(cutoffDt.getTime()) ? "Post-MNF" : cutoffDt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            html += `
                <div class="lookahead-divider">
                    <span style="color:var(--gold); font-weight:800;">🔭 POST-MNF LOOKAHEAD SLATE (${cutoffLabel})</span>
                    <span style="color:var(--text-2);">${lookBundles.length} Early Matchups · Excluded from this week's 5-Pack</span>
                </div>
                ${lookBundles.map(buildUnifiedMatchupCardHTML).join("")}
            `;
        }
        container.innerHTML = html;
        return;
    }

    // Single-Market Leaderboard (Spreads / Totals / Moneyline)
    const currentWeekPicks = sortFeedProps(visible.filter(p => p.isCurrentWeek));
    const lookaheadPicks = sortFeedProps(visible.filter(p => !p.isCurrentWeek));

    let html = currentWeekPicks.map(buildPickRowHTML).join("");
    if (lookaheadPicks.length > 0) {
        const cutoffDt = new Date(AppState.mnfCutoffMs);
        const cutoffLabel = isNaN(cutoffDt.getTime()) ? "Post-MNF" : cutoffDt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        html += `
            <div class="lookahead-divider">
                <span style="color:var(--gold); font-weight:800;">🔭 POST-MNF LOOKAHEAD SLATE (${cutoffLabel})</span>
                <span style="color:var(--text-2);">${lookaheadPicks.length} Early Lines · Excluded from this week's 5-Pack</span>
            </div>
            ${lookaheadPicks.map(buildPickRowHTML).join("")}
        `;
    }
    container.innerHTML = html;
}

// ==========================================
// VIEW 1B: SPLIT RESEARCH INSPECTOR (WEATHER & BALLISTIC MOAT + TIP PAYWALL)
// ==========================================
function renderPickInspector() {
    const container = document.getElementById("pick-inspector");
    if (!container) return;

    const p = AppState.processedProps.find(x => x.propKey === AppState.selectedPropKey)
        || AppState.flagshipFivePack[0]
        || AppState.processedProps[0];
    if (!p) {
        container.innerHTML = `<div class="empty-state" style="border:none;">Select any pick to inspect Weather &amp; Model telemetry.</div>`;
        return;
    }

    const g = p.gameRecord;
    const locked = (AppState.activeMode === "tip");
    const inSlip = AppState.selectedParlayLegs.has(p.propKey);
    const col = getTierColor(p.tierBadge);
    const isMlPick = (p.marketType === "moneyline");
    const projDisp = isMlPick
        ? `${p.activeModelPct.toFixed(1)}%`
        : ((p.marketType === "spread") ? fmtSigned(p.projectedMean, 1) : Number(p.projectedMean).toFixed(1));
    const em = g.elevActive || g.elevMatrix || { zoneNumber: 1, venueElevFeet: 0, direction: "ASCENT", psiElevPts: 0 };
    const env = g.envPayload || {};
    const csiVal = Number((g.m8 && g.m8.circadianStrainIndex) || 0);
    const wScore = Number((g.weatherImpact && g.weatherImpact.score) || 2.0);
    const fgShift = Number((g.m7 && g.m7.fgRangeShiftYards) || 0);
    const passMod = Number((g.m7 && g.m7.passGameModifierYards) || 0);

    const signalBars = [
        { label: "M9 EPA Edge", val: Math.min(96, Math.max(15, p.tipModelPct)), txt: `${p.tipModelPct.toFixed(1)}%`, color: getTierColor(p.tipBadge) },
        { label: "M7 Weather", val: Math.min(96, Math.max(12, wScore * 10)), txt: `${wScore.toFixed(1)}/10`, color: g.weatherImpact.isEdge ? "var(--cyan)" : "var(--text-2)" },
        { label: "M8 Travel CSI", val: Math.min(96, Math.max(10, Math.abs(csiVal) * 65)), txt: `CSI ${csiVal.toFixed(2)}`, color: csiVal > 0.8 ? "var(--red)" : "var(--text-2)" },
        { label: "M11 Altitude", val: Math.min(96, Math.max(10, em.zoneNumber * 10)), txt: `Zone ${em.zoneNumber}`, color: em.zoneNumber >= 7 ? "var(--gold)" : "var(--text-2)" }
    ];

    const floorBadgeHTML = (!p.gatekeeperBlocked && p.safeFloorEvPct >= SMASH_EV_CUTOFF && p.totalRegime !== "NEUTRAL_PASS")
        ? `<span class="badge b-cyan">KEY SMASH +${p.safeFloorEvPct.toFixed(1)}%</span>`
        : "";

    const modeHeading = AppState.activeMode === "davinci" ? "🔓 DaVinci Flow Execution" : "🔓 Balls Deep Execution";
    const kellyStr = p.quarterKellyPct > 0
        ? `f*: ${p.quarterKellyPct}%${p.isKellyCapped ? " (4% CAP)" : ""}`
        : "0% Kelly";

    container.innerHTML = `
        <div class="insp-head">
            <div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:4px;">
                    <span class="mono" style="font-size:11px; color:var(--text-2);">${p.league} • ${p.matchup} • ${g.kickoffShort}</span>
                    ${p.flagshipSlot ? `<span class="badge ${p.flagshipSlot.includes("MÉNAGE") ? "b-gold" : "b-cyan"}">${p.flagshipSlot}</span>` : ""}
                </div>
                <div style="font-size:18px; font-weight:800; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span>${p.shortTitle}</span>
                    <span id="insp-tier-badge-wrap">${renderTierBadgeHTML(p.tierBadge)}</span>
                </div>
            </div>
            <button type="button" class="chip mobile-close-btn" onclick="window.closeMobileInspector()">✕</button>
        </div>

        <div class="insp-body">
            ${renderGameGuardrailChipsHTML(g)}
            ${renderGatekeeperPillsHTML(p.gatekeeperFlags, p.gatekeeperAction)}

            <div class="stat-trio">
                <div class="stat-box">
                    <div class="stat-k">${isMlPick ? "Vegas ML" : "Vegas Line"}</div>
                    <div class="stat-v">${p.lineDisplay}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-k">${isMlPick ? "DixPix Win %" : "DixPix Proj"}</div>
                    <div class="stat-v" id="insp-proj-val" style="color:${col};">${projDisp}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-k">Model EV</div>
                    <div class="stat-v" id="insp-ev-val" style="color:${col};">${p.evPct > 0 ? "+" : ""}${p.evPct.toFixed(1)}%</div>
                </div>
            </div>

            <!-- STRAIGHT-UP OUTRIGHT ML WINNER CALLOUT -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:9px 12px; border-radius:var(--r-sm); background:var(--bg-input); border:1px solid ${g.mlIsUpset && !locked ? "var(--gold-bd)" : "var(--border)"}; font-family:var(--font-mono); font-size:11.5px;">
                <span id="insp-ml-winner-txt">
                    🏆 Outright Winner: <strong style="color:var(--text-1);">${g.mlWinnerTeam}</strong> (${g.mlWinnerProbPct}%)
                    ${isMlPick ? ` · <span style="color:var(--text-2);">Mkt Imp ${p.vigFreePct.toFixed(1)}%</span>` : ""}
                </span>
                ${g.mlIsUpset
                    ? (locked
                        ? renderLockSpanHTML("🔒 Dog Upset Alert")
                        : `<span class="badge b-gold">🐶 OUTRIGHT UPSET ALERT</span>`)
                    : `<span style="color:var(--text-3); font-size:10.5px;">Fair Margin ${fmtSigned(g.m9.fairHomeSpread, 1)}</span>`
                }
            </div>

            <!-- DIXPIX WEATHER & BALLISTIC PHYSICS MOAT -->
            <div class="weather-edge-box">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="font-weight:800; font-size:12.5px; color:var(--cyan);">🌬️ Weather &amp; Ballistic Edge</span>
                    <span class="mono" style="font-size:11px; color:var(--text-2);">
                        ${env.is_dome ? "Dome 72°F" : `${env.temperature_f !== undefined ? Math.round(env.temperature_f) : "--"}°F · ${Math.round(g.windMph || 0)} mph`}
                    </span>
                </div>
                <p style="font-size:12px; color:var(--text-2); margin-top:6px;">${g.weatherImpact.summary}</p>
                <div class="weather-grid">
                    <div class="w-metric">
                        <div class="w-metric-k">AIR DENSITY (&rho;)</div>
                        <div class="w-metric-v">${g.m7.airDensityRho} kg/m³</div>
                    </div>
                    <div class="w-metric">
                        <div class="w-metric-k">FG RANGE SHIFT</div>
                        <div class="w-metric-v" style="color:${locked ? "var(--gold)" : (fgShift < 0 ? "var(--red)" : "var(--emerald)")};">
                            ${locked ? renderLockSpanHTML("🔒 Balls Deep") : `${fmtSigned(fgShift, 1)} yds`}
                        </div>
                    </div>
                    <div class="w-metric">
                        <div class="w-metric-k">PASS GAME MOD</div>
                        <div class="w-metric-v">${locked ? renderLockSpanHTML("🔒 Balls Deep") : `${fmtSigned(passMod, 1)} yds`}</div>
                    </div>
                    <div class="w-metric">
                        <div class="w-metric-k">10-ZONE ALTITUDE</div>
                        <div class="w-metric-v" style="color:${em.zoneNumber >= 7 ? "var(--gold)" : "var(--text-1)"};">
                            ${locked ? `${g.elevationM}m` : `Z${em.zoneNumber} ${em.direction} (${(em.venueElevFeet || 0).toLocaleString()} ft)`}
                        </div>
                    </div>
                </div>
            </div>

            <!-- SIGNAL DRIVERS CHART -->
            <div class="chart-box">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700; font-size:12.5px;">Signal Drivers</span>
                    <span class="mono" id="insp-sig-meta" style="font-size:11px; color:var(--text-3);">Win ${p.activeModelPct.toFixed(1)}% · ${kellyStr}</span>
                </div>
                <div class="bar-chart">
                    ${signalBars.map(b => `
                        <div class="bar-row">
                            <span style="color:var(--text-2);">${b.label}</span>
                            <div class="bar-track"><div class="bar-fill" style="width:${b.val}%; background:${b.color};"></div></div>
                            <span style="text-align:right; font-weight:700; color:${b.color};">${b.txt}</span>
                        </div>
                    `).join("")}
                </div>
            </div>

            <!-- UPGRADE #8: DUAL-SLIDER DAVINCI GAME-SCRIPT SIMULATOR (ACTIVE ONLY IN DAVINCI MODE) -->
            ${AppState.activeMode === "davinci" ? (() => {
                const sc = g.daVinciScript || { isCustom: false, spreadDelta: 0, totalDelta: 0, simHomeSpread: g.m9Bd.fairHomeSpread, simTotal: g.baseTelemetryTotal, simHomePts: 22, simAwayPts: 21, simHomeMlPct: 50, simAwayMlPct: 50 };
                return `
                    <div class="dv-script-box">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <span class="mono" style="font-size:11px; font-weight:800; color:var(--gold);">🎨 DAVINCI GAME-SCRIPT SIMULATOR</span>
                            <span id="insp-dv-status">${sc.isCustom ? `<button type="button" class="chip" style="padding:2px 8px; font-size:10.5px;" onclick="window.resetDaVinciGameScript('${g.gameId}')">Reset Game</button>` : `<span class="mono" style="font-size:10px; color:var(--text-3);">Model Baseline</span>`}</span>
                        </div>
                        <div class="dv-score-banner">
                            <span id="insp-dv-score-left">Script: ${g.awayTeam} ${sc.simAwayPts} – ${g.homeTeam} ${sc.simHomePts}</span>
                            <span id="insp-dv-score-right" style="color:var(--cyan);">${g.homeTeam} ${fmtSigned(sc.simHomeSpread, 1)} · O/U ${sc.simTotal}</span>
                        </div>
                        <div class="dv-slider-row">
                            <div class="dv-slider-meta">
                                <span>Margin Shift (${g.homeTeam} Spread)</span>
                                <strong id="insp-dv-spread-lbl" style="color:var(--gold);">${sc.spreadDelta > 0 ? "+" : ""}${sc.spreadDelta.toFixed(1)} pts</strong>
                            </div>
                            <input type="range" class="dv-range" min="-30" max="30" step="0.5" value="${sc.spreadDelta}" oninput="window.updateDaVinciGameScript('${g.gameId}', 'spreadDelta', this.value)" onchange="window.commitDaVinciGameScript()" />
                        </div>
                        <div class="dv-slider-row">
                            <div class="dv-slider-meta">
                                <span>Total / Pace Shift</span>
                                <strong id="insp-dv-total-lbl" style="color:var(--cyan);">${sc.totalDelta > 0 ? "+" : ""}${sc.totalDelta.toFixed(1)} pts</strong>
                            </div>
                            <input type="range" class="dv-range" min="-20" max="20" step="0.5" value="${sc.totalDelta}" oninput="window.updateDaVinciGameScript('${g.gameId}', 'totalDelta', this.value)" onchange="window.commitDaVinciGameScript()" />
                        </div>
                    </div>
                `;
            })() : ""}

            <!-- BALLS DEEP EXECUTION PANEL (STRICT PAYWALL IN JUST THE TIP MODE) -->
            ${locked ? `
                <div class="bd-panel locked">
                    <div class="mono" style="font-size:11px; font-weight:800; color:var(--gold); margin-bottom:5px;">🔒 BALLS DEEP EXECUTION LOCKED</div>
                    <div style="font-size:12px; color:var(--text-2); margin-bottom:12px;">
                        Unlock 2-Key-Rung Perpetuity Alts, Always-On Wong Teasers, Regime Safe Totals, Ceiling (+&phi;) &amp; M11–M13 Telemetry.
                    </div>
                    <button type="button" class="primary-btn gold" onclick="window.unlockBallsDeepMode(event)">Unlock Balls Deep Mode</button>
                </div>
            ` : `
                <div class="bd-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
                        <span style="font-weight:800; font-size:12.5px; color:var(--emerald);">${modeHeading}</span>
                        <span class="mono" style="font-size:10.5px; color:var(--text-2);">&Psi;_11,12: <strong>${fmtSigned(p.psiActive, 2)} pts</strong></span>
                    </div>
                    <div class="exec-row">
                        <span style="color:var(--cyan);">🔑 ${p.keyAltNote || "2-Key / Safe Floor"}</span>
                        <span style="text-align:right;"><strong>${p.safeFloorLabel}</strong> · ${p.safeFloorWinPct}% ${floorBadgeHTML}</span>
                    </div>
                    ${(p.marketType === "spread" && p.tier2Approved && p.tier2Label) ? `
                        <div class="exec-row">
                            <span style="color:var(--emerald);">🎯 Always-On Wong</span>
                            <strong style="color:var(--emerald); text-align:right;">${p.tier2Line > 0 ? "+" : ""}${Number(p.tier2Line).toFixed(1)} (${p.tier2Mode === "WONG_7PT" ? "7-pt" : "6-pt"} · ${p.tier2ProbPct}%)</strong>
                        </div>
                    ` : ""}
                    <div class="exec-row">
                        <span style="color:var(--gold);">🎯 Ceiling (+&phi;)</span>
                        <strong>${p.bdAltLabel} (${p.bdAltEvPct > 0 ? "+" : ""}${p.bdAltEvPct.toFixed(1)}% EV)</strong>
                    </div>
                </div>
            `}

            <button type="button" class="primary-btn ${inSlip ? "cyan" : ""}" onclick="window.toggleParlayLeg('${p.propKey}', event)">
                ${inSlip ? "✓ In Slip (Click to Remove)" : "+ Add to Bet Slip"}
            </button>
        </div>
    `;
}

// ==========================================
// VIEW 2: FLAGSHIP 5-PACK & PORKY'S SAFE FLOOR FADES
// ==========================================
function renderFlagshipFivePack() {
    const container = document.getElementById("flagship-five-pack-container");
    if (!container) return;

    const locked = (AppState.activeMode === "tip");
    const isPorkys = (AppState.fivePackView === "porkys");

    if (!isPorkys) {
        if (AppState.flagshipFivePack.length === 0) {
            container.innerHTML = `<div class="empty-state">No pre-kickoff Flagship 5-Pack plays available for the current filter.</div>`;
            return;
        }
        container.innerHTML = AppState.flagshipFivePack.map(p => {
            const inSlip = AppState.selectedParlayLegs.has(p.propKey);
            const isMenage = p.flagshipSlot.includes("MÉNAGE");
            const col = getTierColor(p.tierBadge);
            const projDisp = (p.marketType === "spread") ? fmtSigned(p.projectedMean, 1) : Number(p.projectedMean).toFixed(1);

            return `
                <div class="clean-card" style="display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; cursor:pointer;" onclick="window.setAppView('picks'); window.selectPick('${p.propKey}', true);">
                    <div style="flex:1; min-width:240px;">
                        <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:6px;">
                            <span class="badge ${isMenage ? "b-gold" : "b-cyan"}">${p.flagshipSlot}</span>
                            <span class="mono" style="font-size:11px; color:var(--text-3);">${p.league} • ${p.matchup} • ${p.gameRecord.kickoffShort}</span>
                            ${renderWeatherPillHTML(p.gameRecord)}
                        </div>
                        <div style="font-size:15.5px; font-weight:800; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span>${p.shortTitle}</span>
                            ${renderTierBadgeHTML(p.tierBadge)}
                        </div>
                        <div class="mono" style="font-size:11.5px; color:var(--text-2); margin-top:5px;">
                            Proj <strong style="color:${col};">${projDisp}</strong> · Win <strong style="color:${col};">${p.activeModelPct.toFixed(1)}%</strong> (${p.evPct > 0 ? "+" : ""}${p.evPct.toFixed(1)}% EV)
                            ${p.quarterKellyPct > 0 ? ` · f* ${p.quarterKellyPct}%` : ""}
                        </div>
                        <div class="mono" style="font-size:11px; margin-top:6px;">
                            ${locked
                                ? renderLockSpanHTML("🔒 Unlock Balls Deep for 2-Key Alt, Wong Teaser & Ceiling (+φ)")
                                : `<span style="color:var(--cyan);">🔑 ${p.safeFloorLabel} (${p.safeFloorWinPct}%)</span>${p.tier2Approved && p.tier2Line !== null ? ` · <span style="color:var(--emerald);">🎯 Wong ${fmtSigned(p.tier2Line, 1)}</span>` : ""} · <span style="color:var(--gold);">🎯 ${p.bdAltLabel}</span>`
                            }
                        </div>
                    </div>
                    <button type="button" class="add-btn ${inSlip ? "in-slip" : ""}" onclick="window.toggleParlayLeg('${p.propKey}', event)">
                        ${inSlip ? "✓" : "+"}
                    </button>
                </div>
            `;
        }).join("");
        return;
    }

    // Wednesday Night at Porky's Safe Floor Fades
    if (AppState.porkysFivePack.length === 0) {
        container.innerHTML = `<div class="empty-state">No &le;-19.0% EV public traps flagged on this week's board yet.</div>`;
        return;
    }

    container.innerHTML = AppState.porkysFivePack.map(item => {
        const trap = item.trapProp;
        const fade = item.fadeProp;
        const inSlip = AppState.selectedParlayLegs.has(fade.propKey);
        const porkyFloorOdds = fade.safeFloorOdds || -175;
        const floorEv = calcExpectedValueAndKelly((fade.safeFloorWinPct || 82.0) / 100.0, porkyFloorOdds).evPercentage;

        return `
            <div class="clean-card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="badge b-pass">🐷 ${item.slotLabel}</span>
                        <span class="mono" style="font-size:11px; color:var(--text-3);">${fade.league} • ${fade.matchup}</span>
                        ${renderWeatherPillHTML(fade.gameRecord)}
                    </div>
                    <button type="button" class="add-btn ${inSlip ? "in-slip" : ""}" title="Add Fade to Slip" onclick="window.toggleParlayLeg('${fade.propKey}', event)">
                        ${inSlip ? "✓" : "+"}
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
                    <div style="padding:10px 12px; border-radius:8px; background:var(--red-bg); border:1px solid var(--red-bd);">
                        <div class="mono" style="font-size:10px; font-weight:800; color:var(--red);">🚫 1:45 AM PUBLIC TRAP (PASS)</div>
                        <div style="font-weight:800; font-size:14px; margin-top:3px;">${trap.shortTitle}</div>
                        <div class="mono" style="font-size:11.5px; color:var(--red); margin-top:2px;">
                            Proj ${fmtSigned(trap.tipProjectedMean, 1)} · Win ${trap.tipModelPct.toFixed(1)}% (${trap.tipEvPct.toFixed(1)}% EV)
                        </div>
                    </div>
                    <div style="padding:10px 12px; border-radius:8px; background:var(--cyan-bg); border:1px solid var(--cyan-bd);">
                        <div class="mono" style="font-size:10px; font-weight:800; color:var(--cyan);">🛡️ COUNTER-STRIKE SAFE FLOOR FADE</div>
                        <div style="font-weight:800; font-size:14px; margin-top:3px;">
                            ${locked ? `${fade.shortTitle} · ${renderLockSpanHTML("🔒 Floor Locked")}` : `${fade.pickTeamCode} ${fade.safeFloorLabel}`}
                        </div>
                        <div class="mono" style="font-size:11.5px; color:var(--cyan); margin-top:2px;">
                            ${locked
                                ? `Straight Fade Win: ${fade.tipModelPct.toFixed(1)}% (+${fade.tipEvPct.toFixed(1)}% EV)`
                                : `Floor Win ${fade.safeFloorWinPct}% (${floorEv > 0 ? "+" : ""}${floorEv.toFixed(1)}% EV) · Base ${fade.lineDisplay}`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// ==========================================
// VIEW 3: SYNOPTIC WEATHER & BIOPHYSICAL LAB (CARDS + FULL TABLE)
// ==========================================
function renderWeatherLab() {
    const grid = document.getElementById("weather-lab-grid");
    const tblContainer = document.getElementById("biolab-container");
    const games = AppState.processedGames.filter(g => !isGameCompletedFinal(g));
    const locked = (AppState.activeMode === "tip");
    const modeScale = AppState.activeMode === "davinci" ? (1.0 + AppState.intensitySlider * 0.382) : 1.0;

    if (grid) {
        if (games.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No active slate stadiums loaded.</div>`;
        } else {
            const sortedByWeather = [...games].sort((a, b) => (b.weatherImpact.score || 0) - (a.weatherImpact.score || 0));
            grid.innerHTML = sortedByWeather.map(g => {
                const em = g.elevActive || g.elevMatrix || { zoneNumber: 1, direction: "ASCENT", psiElevPts: 0, venueElevFeet: 0, qCurve: [0.382, 0.618, 1.618, 1.618] };
                const fgShift = Number((g.m7.fgRangeShiftYards * modeScale).toFixed(2));
                const passMod = Number((g.m7.passGameModifierYards * modeScale).toFixed(2));

                return `
                    <div class="clean-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                            <div>
                                <span class="mono" style="font-size:10.5px; color:var(--text-3);">${g.league} · ${g.kickoffShort}</span>
                                <div style="font-size:16px; font-weight:800;">${g.matchup}</div>
                            </div>
                            ${renderWeatherPillHTML(g)}
                        </div>
                        <p style="font-size:12px; color:var(--text-2); margin-bottom:10px;">${g.weatherImpact.summary}</p>
                        <div class="weather-grid">
                            <div class="w-metric">
                                <div class="w-metric-k">AIR DENSITY &rho;</div>
                                <div class="w-metric-v">${g.m7.airDensityRho} kg/m³</div>
                            </div>
                            <div class="w-metric">
                                <div class="w-metric-k">FG SHIFT (&Delta;D_FG)</div>
                                <div class="w-metric-v" style="color:${locked ? "var(--gold)" : (fgShift < 0 ? "var(--red)" : "var(--emerald)")};">
                                    ${locked ? renderLockSpanHTML() : `${fmtSigned(fgShift, 2)} yds`}
                                </div>
                            </div>
                            <div class="w-metric">
                                <div class="w-metric-k">PASS MOD (&Delta;Y)</div>
                                <div class="w-metric-v">${locked ? renderLockSpanHTML() : `${fmtSigned(passMod, 2)} yds`}</div>
                            </div>
                            <div class="w-metric">
                                <div class="w-metric-k">10-ZONE ALTITUDE</div>
                                <div class="w-metric-v" style="color:${em.zoneNumber >= 7 ? "var(--gold)" : "var(--cyan)"};">
                                    ${locked ? `${g.elevationM}m` : `Z${em.zoneNumber} ${em.direction} (${em.psiElevPts} pts)`}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    if (tblContainer) {
        const fmtShiftCell = (val) => {
            if (locked) return renderLockSpanHTML("🔒");
            const scaled = Number((val * modeScale).toFixed(2));
            const col = scaled > 0 ? "var(--emerald)" : (scaled < 0 ? "var(--red)" : "var(--text-2)");
            return `<span style="color:${col}; font-weight:700;">${fmtSigned(scaled, 2)} yds</span>`;
        };
        tblContainer.innerHTML = `
            <table class="pf-table">
                <thead>
                    <tr>
                        <th>Matchup</th>
                        <th>10-Zone Elevation (&Delta;h / Q1–Q4)</th>
                        <th>Gravity g(h)</th>
                        <th>Air Density &rho;</th>
                        <th>FG Shift</th>
                        <th>Pass Carry</th>
                        <th>Pass Mod</th>
                        <th>Somatic &rho;</th>
                        <th>Bio + 10-Zone</th>
                    </tr>
                </thead>
                <tbody>
                    ${games.map(g => {
                        const em = g.elevActive || g.elevMatrix || { zoneNumber: 1, wzWeight: 0.1, deltaFeet: 0, direction: "ASCENT", qCurve: [0.382, 0.618, 1.618, 1.618], psiElevPts: 0, hypoxicOverrideM13: false };
                        const bioColor = em.hypoxicOverrideM13 ? "var(--gold)" : "var(--cyan)";
                        return `
                            <tr>
                                <td><strong>${g.matchup}</strong></td>
                                <td>${locked ? `${g.elevationM}m` : `Z${em.zoneNumber} (0.1×F=${em.wzWeight}) ${em.direction}<br><small style="color:var(--text-2);">${em.deltaFeet > 0 ? "+" : ""}${em.deltaFeet} ft · ${em.qCurve.join("→")}</small>`}</td>
                                <td>${g.m11.localGravityG} m/s²</td>
                                <td>${g.m7.airDensityRho}</td>
                                <td>${fmtShiftCell(g.m7.fgRangeShiftYards)}</td>
                                <td>${fmtShiftCell(g.m7.deepPassShiftYards)}</td>
                                <td>${fmtShiftCell(g.m7.passGameModifierYards)}</td>
                                <td>${locked ? renderLockSpanHTML("🔒") : `${g.m11.rhoPlayerDensity} kg/m³`}</td>
                                <td>${locked ? renderLockSpanHTML("🔒") : `<span style="color:${bioColor}; font-weight:700;">&Psi;: ${em.psiElevPts} · &Phi;: ${g.m11.phiBioScore}</span>`}</td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }
}
// ==========================================
// SLIDE-OVER BET SLIP & ROUND ROBIN DRAWER (M10 COMBINATORICS)
// ==========================================
function renderCombinatoricsDeck() {
    const countBadge = document.getElementById("slip-count-badge");
    const mobCount = document.getElementById("mob-slip-n");
    const triggerBtn = document.getElementById("slip-trigger-btn");
    const modeSub = document.getElementById("slip-mode-sub");
    const body = document.getElementById("slip-drawer-body");
    const foot = document.getElementById("slip-drawer-foot");

    const selectedProps = AppState.processedProps.filter(p => AppState.selectedParlayLegs.has(p.propKey));
    const hasWong = AppState.wongTeaserParlayLegs.size > 0;
    const hasFloor = AppState.safeFloorParlayLegs.size > 0;

    if (countBadge) countBadge.textContent = String(selectedProps.length);
    if (mobCount) mobCount.textContent = String(selectedProps.length);
    if (triggerBtn) triggerBtn.classList.toggle("has-legs", selectedProps.length > 0);
    if (modeSub) {
        modeSub.textContent = hasWong
            ? "🎯 ALWAYS-ON WONG TEASER SLIP (6/7-PT)"
            : (hasFloor
                ? "🔑 2-KEY-RUNG / SAFE FLOOR ALT SLIP"
                : `STANDARD PARLAY & ROUND ROBIN (${AppState.activeMode.toUpperCase()})`);
    }

    if (!body || !foot) return;

    const legsPayload = selectedProps.map(p => {
        const useWong = AppState.wongTeaserParlayLegs.has(p.propKey);
        const useSafeFloor = AppState.safeFloorParlayLegs.has(p.propKey);
        if (useWong) {
            const is7Pt = (p.tier2Mode === "WONG_7PT");
            const perLegAm = is7Pt ? -313 : -282;
            const wProb = (p.marketType === "spread" && p.tier2ProbPct) ? (p.tier2ProbPct / 100.0) : ((p.safeFloorWinPct || 76.0) / 100.0);
            return { americanOdds: perLegAm, trueProb: wProb };
        }
        return {
            americanOdds: useSafeFloor ? (p.safeFloorOdds || -185) : (p.baseOdds || -110),
            trueProb: useSafeFloor ? ((p.safeFloorWinPct || 75.0) / 100.0) : p.activeModelProbRaw
        };
    });

    const m10 = calcProfitBoostParlayEV(legsPayload, 1.30);
    const rrTiers = (typeof calcRoundRobinMatrix === "function") ? calcRoundRobinMatrix(legsPayload) : [];
    const baseStake = 10.0;
    const rawPayout = (baseStake * m10.dRaw).toFixed(2);
    const boostedPayout = (baseStake * m10.dBoost).toFixed(2);
    const locked = (AppState.activeMode === "tip");

    const presetsHTML = `
        <div class="chip-group">
            <button type="button" class="chip" onclick="window.loadFlagshipPreset(true, false, false)">👑 Ménage (3)</button>
            <button type="button" class="chip" onclick="window.loadFlagshipPreset(false, false, false)">🔥 5-Pack</button>
            <button type="button" class="chip" onclick="${locked ? "window.unlockBallsDeepMode(event)" : "window.loadFlagshipPreset(false, true, false)"}">${locked ? "🔒" : "🔑"} 2-Key Alts</button>
            <button type="button" class="chip" onclick="${locked ? "window.unlockBallsDeepMode(event)" : "window.loadFlagshipPreset(false, false, true)"}">${locked ? "🔒" : "🎯"} Wong Teasers</button>
            <button type="button" class="chip" onclick="window.loadPorkysPreset(event)">🐷 Porky's Fades</button>
        </div>
    `;

    const legsHTML = selectedProps.length === 0
        ? `<div class="empty-state" style="padding:28px 14px;">Tap <strong>+</strong> on any pick row or choose a 1-tap preset above to calculate Parlay, 30% Profit Boost, and Round Robin EV.</div>`
        : selectedProps.map(p => {
            const isWong = AppState.wongTeaserParlayLegs.has(p.propKey);
            const isFloor = AppState.safeFloorParlayLegs.has(p.propKey);
            const fmtWongLine = (p.tier2Line !== null && p.tier2Line !== undefined) ? fmtSigned(p.tier2Line, 1) : "";
            const legTitle = isWong
                ? (p.marketType === "spread" && fmtWongLine
                    ? `🎯 ${p.pickTeamCode} ${fmtWongLine} (${p.tier2Mode === "WONG_7PT" ? "7-pt" : "6-pt"} Wong)`
                    : `🎯 ${p.matchup} ${p.safeFloorLabel}`)
                : (isFloor
                    ? `🔑 ${p.marketType === "spread" ? p.pickTeamCode : p.matchup} ${p.safeFloorLabel}`
                    : p.shortTitle);
            const effOdds = isWong
                ? (p.tier2Mode === "WONG_7PT" ? "7pt -135" : "6pt -120")
                : (isFloor ? `${p.safeFloorOdds > 0 ? "+" : ""}${p.safeFloorOdds}` : `${p.baseOdds > 0 ? "+" : ""}${p.baseOdds}`);
            const effWin = isWong
                ? (p.marketType === "spread" && p.tier2ProbPct ? p.tier2ProbPct : p.safeFloorWinPct)
                : (isFloor ? p.safeFloorWinPct : p.activeModelPct.toFixed(1));

            return `
                <div class="slip-leg-item">
                    <div style="min-width:0;">
                        <div class="mono" style="font-size:10.5px; color:var(--text-3);">${p.league} · ${p.matchup}</div>
                        <div style="font-weight:700; font-size:13px; margin-top:2px;">${legTitle}</div>
                        <div class="mono" style="font-size:11px; color:var(--cyan); margin-top:2px;">Win ${effWin}% · ${effOdds}</div>
                    </div>
                    <button type="button" class="chip" style="padding:3px 8px;" onclick="window.toggleParlayLeg('${p.propKey}', event)">✕</button>
                </div>
            `;
        }).join("");

    const rrHTML = rrTiers.length > 0 ? `
        <div class="rr-matrix-box">
            <div style="color:var(--gold); font-weight:800; font-size:10.5px; letter-spacing:0.04em;">ROUND ROBIN MATRIX</div>
            ${rrTiers.map(t => `
                <div style="display:flex; justify-content:space-between; gap:8px;">
                    <span><strong>${t.legSize}</strong> · ${t.avgMultiplier}x (${t.avgWinProbPct}%)</span>
                    <span style="color:${getTierColor(getTierFromEv(t.expectedRoiPct))}; font-weight:800;">${t.expectedRoiPct > 0 ? "+" : ""}${t.expectedRoiPct}% EV</span>
                </div>
            `).join("")}
        </div>
    ` : "";

    body.innerHTML = `${presetsHTML}${legsHTML}${rrHTML}`;

    const evCol = getTierColor(getTierFromEv(m10.evBoostPct));
    foot.innerHTML = `
        <div class="stat-trio" style="margin-bottom:10px;">
            <div class="stat-box">
                <div class="stat-k">Win %</div>
                <div class="stat-v" style="font-size:14px; color:var(--cyan);">${selectedProps.length ? m10.trueParlayProb + "%" : "0.0%"}</div>
            </div>
            <div class="stat-box">
                <div class="stat-k">$10 +30%</div>
                <div class="stat-v" style="font-size:14px; color:var(--gold);">${selectedProps.length ? "$" + boostedPayout : "--"}</div>
                <div class="mono" style="font-size:9.5px; color:var(--text-3);">${selectedProps.length ? "Raw $" + rawPayout : "M10 Boost"}</div>
            </div>
            <div class="stat-box">
                <div class="stat-k">Boost EV</div>
                <div class="stat-v" style="font-size:14px; color:${evCol};">${selectedProps.length ? (m10.evBoostPct > 0 ? "+" : "") + m10.evBoostPct + "%" : "0.0%"}</div>
            </div>
        </div>
        <div style="display:flex; gap:8px;">
            <button type="button" class="chip" style="flex:1; justify-content:center;" onclick="window.clearParlaySlip(event)">Clear (${selectedProps.length})</button>
            <button type="button" class="primary-btn cyan" style="flex:2;" onclick="window.toggleSlipDrawer(false)">Done</button>
        </div>
    `;
}

// ==========================================
// VIEW 5A: 13-MODULE COMPENDIUM BOARD (HOME-TEAM PERSPECTIVE)
// ==========================================
function renderCompendiumBoard() {
    const tbody = document.getElementById("compendium-board-body");
    if (!tbody) return;

    const games = AppState.processedGames;
    if (games.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-2); padding:20px;">No active slate matchups loaded.</td></tr>`;
        return;
    }

    const isLocked = (AppState.activeMode === "tip");
    const sliderForAgg = (AppState.activeMode === "davinci") ? AppState.intensitySlider : 0.618;

    tbody.innerHTML = games.map(g => {
        if (isLocked) {
            return `
                <tr class="clickable-row" title="Click to open M1–M9 Dossier" onclick="window.openModuleDossier('live', '${g.gameId}')">
                    <td><strong>${g.matchup}</strong> <span style="color:var(--cyan); font-size:10px;">↗</span><br><small style="color:var(--text-3);">${g.league} · 🏆 ${g.mlWinnerTeam} ML ${g.mlWinnerProbPct}%</small></td>
                    <td colspan="7" style="cursor:pointer;" onclick="window.unlockBallsDeepMode(event)">
                        ${renderLockSpanHTML("🔒 Unlock Balls Deep to view M7–M13 Home-Team Compendium & Unified P_agg →")}
                    </td>
                </tr>
            `;
        }

        const em = g.elevActive || g.elevMatrix || { zoneNumber: 1, direction: "ASCENT", psiElevPts: 0, hypoxicOverrideM13: false };
        const m13 = g.m13Details || { mRiseMultiplier: 1.0, mRiseSignedHomeDelta: 0, m11OverrideApplied: false, coachSyncBlocked: false };
        const tovVal = g.m12.netTurnoverEPA || 0;

        const fibRes = calcMasterFibonacciAggregate({
            m1: (g.vegasHomeSpread - g.m9Base.fairHomeSpread) * 0.08,
            m5: -(g.m9Base.epaContribution || 0) * 0.05,
            m7: (1.225 - g.m7.airDensityRho) * 2.0,
            m6: (g.m9Base.deltaRzFin || 0) * -0.08,
            m10: 0,
            m12: tovVal * 0.12,
            m2: 0,
            m3: 0,
            m11: (g.m11.phiBioScore - em.psiElevPts) * 0.25,
            m4: 0,
            m8: g.m8.circadianStrainIndex * 0.12
        }, 13, sliderForAgg, m13.mRiseMultiplier);

        const m12Color = tovVal >= 0 ? "var(--emerald)" : "var(--red)";
        const m13Color = (m13.m11OverrideApplied || m13.coachSyncBlocked)
            ? "var(--gold)"
            : (m13.mRiseSignedHomeDelta >= 0 ? "var(--emerald)" : "var(--red)");
        const omegaColor = fibRes.omegaFibScore >= 0 ? "var(--emerald)" : "var(--red)";
        const probColor = fibRes.liveAdjustedProb >= 52.4 ? "var(--emerald)" : "var(--red)";

        const overrideTag = m13.m11OverrideApplied
            ? `<br><small style="color:var(--gold);">🏔️ M11&gt;M13 ZEROED</small>`
            : (m13.coachSyncBlocked ? `<br><small style="color:var(--red);">🔒 COACH LOCK</small>` : "");
        const delayTag = g.m8.charterDelayShock > 0
            ? `<br><small style="color:var(--purple);">✈️ Delay: ${g.m8.delayTotalDragPts} tot</small>` : "";

        return `
            <tr class="clickable-row" title="Click to open full 13-Module Dossier" onclick="window.openModuleDossier('live', '${g.gameId}')">
                <td><strong>${g.matchup}</strong> <span style="color:var(--cyan); font-size:10px;">↗</span><br><small style="color:var(--text-3);">${g.league} · Home: ${g.homeTeam}</small><br><small style="color:var(--gold); font-weight:700;">🏆 ${g.mlWinnerTeam} ML ${g.mlWinnerProbPct}%</small></td>
                <td>${g.m7.airDensityRho} kg/m³</td>
                <td style="color:${g.m8.circadianStrainIndex > 0.8 ? "var(--red)" : "var(--text-1)"};">${g.m8.circadianStrainIndex}${delayTag}</td>
                <td style="color:var(--cyan); font-weight:700;">Z${em.zoneNumber} ${em.direction.slice(0, 4)} (${em.psiElevPts} pts)<br><small style="color:var(--text-2);">&Phi;_bio: ${g.m11.phiBioScore}</small></td>
                <td style="color:${m12Color}; font-weight:700;">${tovVal > 0 ? "+" : ""}${tovVal}</td>
                <td style="color:${m13Color}; font-weight:700;">${m13.mRiseMultiplier.toFixed(4)}x (${m13.mRiseSignedHomeDelta > 0 ? "+" : ""}${m13.mRiseSignedHomeDelta})${overrideTag}</td>
                <td style="font-weight:700; color:${omegaColor};">${fibRes.omegaFibScore > 0 ? "+" : ""}${fibRes.omegaFibScore.toFixed(4)}</td>
                <td style="font-weight:800; color:${probColor};">${fibRes.liveAdjustedProb.toFixed(1)}%</td>
            </tr>
        `;
    }).join("");
}

// ==========================================
// VIEW 5B: SPREAD TELEMETRY INSPECTOR
// ==========================================
function renderTelemetryInspector() {
    const container = document.getElementById("telemetry-container");
    if (!container) return;

    const games = AppState.processedGames;
    if (games.length === 0) {
        container.innerHTML = `<div class="empty-state" style="border:none;">No active telemetry games loaded.</div>`;
        return;
    }

    const showCoupledPsi = (AppState.activeMode !== "tip");
    const modeDisplay = AppState.activeMode === "tip"
        ? "JUST THE TIP (M1–M9)"
        : (AppState.activeMode === "balls_deep" ? "BALLS DEEP (M1–M13)" : "DAVINCI FLOW");

    container.innerHTML = `
        <table class="pf-table">
            <thead>
                <tr>
                    <th>Matchup</th>
                    <th>Mode Active</th>
                    <th>M8 Circadian</th>
                    <th>M9 Red-Zone (&Delta;RZ_fin)</th>
                    <th>M12 Turnover EPA</th>
                    <th>Coupled (&Psi;_11,12)</th>
                    <th>Model Fair Home Spread (M9)</th>
                </tr>
            </thead>
            <tbody>
                ${games.map(g => {
                    const tipSpreadStr = `${g.homeTeam} ${fmtSigned(g.m9Base.fairHomeSpread, 2)}`;
                    const activeSpreadStr = `${g.homeTeam} ${fmtSigned(g.m9.fairHomeSpread, 2)}`;
                    const tovColor = g.m12.netTurnoverEPA >= 0 ? "var(--emerald)" : "var(--red)";
                    const rzVal = g.m9Base.deltaRzFin || 0;
                    const rzColor = rzVal <= 0 ? "var(--emerald)" : "var(--red)";
                    const qbTag = g.thirdStringQbAlert ? `<br><small style="color:var(--cyan);">🔄 3rd-QB: ${g.thirdStringTeam} TT Under</small>` : "";

                    return `
                        <tr class="clickable-row" title="Click to open full 13-Module Dossier" onclick="window.openModuleDossier('live', '${g.gameId}')">
                            <td><strong>${g.matchup}</strong> <span style="color:var(--cyan); font-size:10px;">↗</span>${qbTag}</td>
                            <td style="color:var(--cyan); font-weight:700;">${modeDisplay}</td>
                            <td>CSI: ${g.m8.circadianStrainIndex} (&Phi;: ${g.m8.phiCircadianPenalty})</td>
                            <td style="color:${rzColor}; font-weight:700;">${rzVal > 0 ? "+" : ""}${rzVal} pts</td>
                            <td style="color:${tovColor}; font-weight:700;">${g.m12.netTurnoverEPA > 0 ? "+" : ""}${g.m12.netTurnoverEPA}</td>
                            <td>${showCoupledPsi ? `<span style="color:var(--gold); font-weight:700;">${fmtSigned(g.psi11_12, 2)} pts</span>` : renderLockSpanHTML("🔒")}</td>
                            <td>
                                ${showCoupledPsi
                                    ? `<span style="color:var(--text-2); margin-right:8px;">Tip: ${tipSpreadStr}</span><strong style="color:var(--emerald);">Active: ${activeSpreadStr}</strong>`
                                    : `<strong>${tipSpreadStr}</strong>`
                                }
                            </td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
    `;
}

// ==========================================
// VIEW 6: FAGQUESTIONS (FREQUENTLY ASKED GAMBLING QUESTIONS)
// ==========================================
const FAG_QUESTIONS_LIST = [
    {
        q: "How do I read a pick row and the Research Inspector?",
        a: "Every row on <strong>Picks</strong> shows four things at a glance: the <strong>bold title</strong> is the Vegas sportsbook line you actually bet, <strong>Proj</strong> is what DixPix says the true fair line is, the <strong>Weather/Altitude pill</strong> highlights stadium physics, and the right-hand meter shows our <strong>Win Probability &amp; Expected Value (EV%)</strong>. Tap any pick to open the Research Inspector with live weather drag, visual Signal Drivers, and execution lines. Single-bet Quarter-Kelly sizing (<strong>f*</strong>) is hard-capped at <strong>4.0%</strong> of bankroll."
    },
    {
        q: "What do the SMASH, TEASE, and PASS badges mean?",
        a: "<span class='badge b-smash'>SMASH</span> flags <strong>&ge; +10.0% EV</strong> (57.6%+ win probability at -110)—green-light value.<br><br><span class='badge b-muted'>TEASE</span> sits in the tight <strong>-18.9% to +9.9% EV</strong> buffer where sportsbook juice eats the edge—quarantined off the card.<br><br><span class='badge b-pass'>PASS</span> marks <strong>&le; -19.0% EV</strong> public traps (or v313 guardrail-blocked spots like 3rd-string QB unders or compromised pass-pro) that we avoid or fade in Porky's."
    },
    {
        q: "What is the difference between Just the Tip, Balls Deep, and DaVinci?",
        a: "<strong>Just the Tip:</strong> Runs our pure Vegas-independent <strong>M1–M9</strong> baseline (efficiency, snap-by-snap EPA, turnover regression, weather ballistics, and travel strain) with zero M11–M13 leakage.<br><br><strong>Balls Deep:</strong> Unlocks <strong>M11–M13</strong> (10-Zone Elevation Hypoxia, Turnover EPA, Sacred Geometry M_rise), verified QB-only injury adjustments, the <strong>2-Key-Rung Perpetuity Alt Ladder</strong>, <strong>Always-On Wong Teasers</strong>, <strong>Regime Safe Totals</strong>, and <strong>Ceiling (+&phi;)</strong> escalators—and Balls Deep never overrules Just the Tip's side.<br><br><strong>DaVinci Mode:</strong> Opens the continuous <strong>Eye-Test Flow Slider (-3.236 to +3.236)</strong> so you can layer your own conviction on top of the model and watch spreads, totals, floors, and ceilings bend organically in real time."
    },
    {
        q: "Why does DixPix emphasize Weather & Altitude Physics?",
        a: "Standard sports research apps only look backward at box scores and hit rates. DixPix pulls live stadium temperature, wind speed, barometric pressure, and elevation to compute real <strong>Air Density (&rho;)</strong>, <strong>Field Goal Range Shifts (&Delta;D_FG)</strong>, <strong>Pass Game Modifiers (&Delta;Y)</strong>, and <strong>10-Zone Altitude Hypoxia</strong>. Tap the <strong>🌬️ Weather Edge</strong> filter on Picks or visit the <strong>Weather Lab</strong> tab to spot outdoor wind/cold Unders and mountain altitude fatigue spots before the market adjusts."
    },
    {
        q: "How do I read and use all 13 Modules on the 13 Modules tab?",
        a: "<strong>Golden Rule: Every column on the 13 Modules table feeds directly into the Home Team's Unified Win &amp; Cover Probability (P_agg).</strong><br><br>• <strong>Tier 1 (Weight 34 — Core Efficiency):</strong> <strong>M1</strong> strips Vegas vig; <strong>M5</strong> models continuous yardage via Gamma survival curves; <strong>M7</strong> computes Air Density (&rho; vs 1.225 kg/m&sup3; sea level—lower = thinner air/Overs, higher = heavy cold air/Unders).<br>• <strong>Tier 2 (Weight 21 — High Leverage):</strong> <strong>M6</strong> checks prop alt efficiency (MER &gt; 1.15); <strong>M10</strong> computes 30% Profit Boost &amp; Round Robin EV; <strong>M12</strong> measures net 4Q-weighted Turnover EPA (<strong>Green +</strong> favors Home, <strong>Red -</strong> favors Away).<br>• <strong>Tier 3 (Weight 13 — Tempo, Sizing &amp; Altitude):</strong> <strong>M2</strong> enforces Quarter-Kelly sizing (4.0% cap); <strong>M3</strong> runs our 2-Key-Rung Alt &amp; Wong Teaser ladder; <strong>M11</strong> tracks somatic load (&Phi;_bio) and 10-Zone elevation climbs/drops (&Psi;_elev—uses spread sign, so <strong>negative points like -1.52 favor the Home Team</strong>, and Zone 7+ climbs override M13 hype).<br>• <strong>Tier 4 (Weight 8 — Friction &amp; Travel):</strong> <strong>M4</strong> models discrete counts (Poisson/NegBin); <strong>M8</strong> tracks the <strong>away team's</strong> jet lag &amp; travel CSI—so <strong>Red (&gt; 0.80) helps the Home Team</strong>.<br>• <strong>M9 (Fair Margin Hub) &amp; M13 (Sacred Geometry):</strong> <strong>M9</strong> combines pure EPA, turnovers, HFA, and travel into the independent fair spread; <strong>M13</strong> multiplies poll/market hype divergence by underdog defensive havoc (first number is the underdog's multiplier; the signed number in parentheses is the Home Team delta).<br>• <strong>Final Readout:</strong> <strong>&Omega;_fib</strong> combines all active modules into <strong>Home P_agg</strong>—<strong>&gt; 52.4% (Green)</strong> clears -110 break-even for the Home Team; <strong>&lt; 52.4% (Red)</strong> leans Away."
    },
    {
        q: "How do 2-Key-Rung Alts, Always-On Wong Teasers, and Regime Safe Totals work?",
        a: "Football games cluster heavily on key scoring margins (3, 7, 10, 14, 17, 21)—and a push doesn't pay. In Balls Deep, every spread gets two disciplined execution routes: a <strong>2-Key-Rung Alt</strong> that buys cleanly across two full scoring rungs with a .5 hook (e.g., -8.5 &rarr; -2.5 or +5.5 &rarr; +10.5), and an <strong>Always-On Wong Teaser</strong> (6-pt at -120 or 7-pt at -135) built for 2-leg teasers without eating heavy standalone alt juice. Totals route into <strong>Regime Safe Totals</strong>—dropping 4 points into Safe Alt Overs in confirmed dome/high-pace shootouts, or buying 4 points up into Safe Alt Unders in cold/wind/backup-QB grind games."
    },
    {
        q: "How do I use the Flagship 5-Pack, Porky's Fades, and the Bet Slip?",
        a: "The <strong>Flagship 5-Pack</strong> locks in our top 5 pre-kickoff plays of the current week (strictly 1 pick per game, blended Spread + O/U for clean uncorrelated Round Robins), led by our top 3 plays—the <strong>Ménage à Trois</strong>. Flip to <strong>Porky's Safe Floor Fades</strong> to see the 5 ugliest public traps (&le; -19.0% EV) paired with counter-strike Safe Floor fades. Tap <strong>+</strong> on any pick or open the slide-over <strong>Slip</strong> from any page to load 1-tap presets and inspect 30% Profit Boost payouts plus 2-Leg/3-Leg Round Robin ROI."
    },
    {
        q: "How do Moneyline (ML) Winners, Outright Dog Upsets, and ML Parlays work?",
        a: "Every game's independent fair spread feeds directly into our NFL/NCAA Dual-Engine logistic curve at zero margin (<code>0 - Fair Spread</code>) to project the <strong>Straight-Up Outright Winner (ML Win %)</strong> and compare it against live sportsbook Moneyline odds (<code>h2h</code>).<br><br>• Filter by <strong>Moneyline</strong> on the Picks tab to shop priced MLs, compare DixPix Win% against Vig-Free Implied %, and add ML legs directly into the slide-over <strong>Slip</strong> for parlays or Round Robins.<br>• In <strong>Balls Deep</strong> mode, anytime DixPix projects a Vegas underdog to win outright, it triggers a <strong>🐶 UPSET ALERT</strong>.<br>• On the <strong>Ledger</strong> tab, click the <strong>🏆 ML WINNERS &amp; UPSETS</strong> vault card to track our overall straight-up winner record and outright underdog upsets called."
    },
    {
        q: "How does the Historical Ledger grade picks—and what is 'Blue Balls'?",
        a: "Every game locks its closing line automatically at kickoff and grades live against ESPN final scores.<br><br>• <strong>✅ HIT:</strong> Cleared the closing line (or won outright on ML).<br>• <strong>🔵 BLUE BALLS (BB):</strong> Brutal spread/total beat missed by <strong>&le; 3.0 points</strong> (a single field goal or less).<br>• <strong>❌ MISS:</strong> Missed by more than 3.0 points.<br>• <strong>💣 Grenades Dodged:</strong> Counts every public trap we stamped PASS (&le; -19.0% EV) that failed to cover. Click any of the 7 Ledger Vault cards to inspect every completed receipt."
    }
];

window.toggleFaqItem = function(idx) {
    if (AppState.openFaq.has(idx)) AppState.openFaq.delete(idx);
    else AppState.openFaq.add(idx);
    renderFaqAccordion();
};

function renderFaqAccordion() {
    const el = document.getElementById("faq-accordion-list");
    if (!el) return;
    el.innerHTML = FAG_QUESTIONS_LIST.map((item, idx) => {
        const isOpen = AppState.openFaq.has(idx);
        return `
            <div class="faq-item ${isOpen ? "open" : ""}">
                <button type="button" class="faq-q" onclick="window.toggleFaqItem(${idx})">
                    <span>${item.q}</span>
                    <span class="faq-chev">▼</span>
                </button>
                <div class="faq-a">${item.a}</div>
            </div>
        `;
    }).join("");
}


// ==========================================
// UPGRADE #3: UNIFIED LEDGER FILTER HANDLERS
// ==========================================
function parseWeekNum(wkLabel) {
    if (!wkLabel) return 0;
    const s = String(wkLabel).toLowerCase();
    if (s.includes("wild card")) return 19;
    if (s.includes("divisional")) return 20;
    if (s.includes("conf")) return 21;
    if (s.includes("super")) return 22;
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

window.setLedgerWeekFilter = function(wk) {
    AppState.ledgerWeekFilter = wk || "CURRENT";
    renderHistoricalLedger();
};

window.toggleProdOverallStrip = function() {
    AppState.ledgerWeekFilter = (AppState.ledgerWeekFilter === "PROD_OVERALL") ? "CURRENT" : "PROD_OVERALL";
    renderHistoricalLedger();
};
window.setLedgerOutcomeFilter = function(out) {
    AppState.ledgerOutcomeFilter = out || "ALL";
    renderHistoricalLedger();
};
window.setLedgerMarketFilter = function(mk) {
    AppState.ledgerMarketFilter = mk || "ALL";
    renderHistoricalLedger();
};
window.setLedgerSearchQuery = function(q) {
    AppState.ledgerSearchQuery = String(q || "").trim().toLowerCase();
    renderHistoricalLedger();
};

// ==========================================
// UPGRADES #4 & #5: UNIFIED 13-MODULE GAME DOSSIER & PRE-KICK RECEIPT DRAWER
// ==========================================
function build13ModuleDossierFromInputs(meta) {
    const locked = (AppState.activeMode === "tip");
    const env = meta.envPayload || {};
    const circ = meta.circPayload || {};
    const homeTel = meta.homeTel || {};
    const awayTel = meta.awayTel || {};
    const lg = meta.league || "NFL";
    const m7 = calcBarometricBallistics(env);
    const m8 = calcCircadianStrain(circ, meta.kickoffLocalHour || 13);
    const elev = calcTenZoneElevationMatrix(env, circ, locked ? "tip" : "balls_deep", 0.0);
    const m11 = calcBiophysicalMassLoad(env, homeTel, 95.0, 0.62, locked ? "tip" : "balls_deep", 0.0);
    const m12 = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, lg, locked ? "tip" : "balls_deep", 0.0);
    const psiCoupled = locked ? 0 : Number(Math.max(-2.85, Math.min(2.85, -calcCoupledInteractionPsi(m11.phiBioScore, m12.netTurnoverEPA, 0.0))).toFixed(3));
    const synthGame = {
        league: lg, home_team: meta.homeTeam, away_team: meta.awayTeam,
        hfa_base: meta.hfaBase || (lg === "NCAA" ? 2.6180339887 : 1.9416110252),
        kickoff_local_hour: meta.kickoffLocalHour || 13,
        team_telemetry: { home: homeTel, away: awayTel }
    };
    const vHome = (meta.vegasHomeSpread !== null && meta.vegasHomeSpread !== undefined) ? Number(meta.vegasHomeSpread) : 0.0;
    const m9Tip = calcFullGameFairMargin(synthGame, m8.phiCircadianPenalty, 0, "tip", vHome, 0, elev, 0.0);
    const m9Bd = calcFullGameFairMargin(synthGame, m8.phiCircadianPenalty, psiCoupled, "balls_deep", vHome, elev.psiElevPts, elev, 0.0);
    const m13 = m9Bd.m13Details || { mRiseMultiplier: 1.0, mRiseSignedHomeDelta: 0.0, dogHavocRatio: 1.0, m11OverrideApplied: false, coachSyncBlocked: false };

    const fibRes = calcMasterFibonacciAggregate({
        m1: (vHome - m9Tip.fairHomeSpread) * 0.08,
        m5: -(m9Tip.epaContribution || 0) * 0.05,
        m7: (1.225 - m7.airDensityRho) * 2.0,
        m6: (m9Tip.deltaRzFin || 0) * -0.08,
        m10: 0,
        m12: (m12.netTurnoverEPA || 0) * 0.12,
        m2: 0, m3: 0,
        m11: (m11.phiBioScore - elev.psiElevPts) * 0.25,
        m4: 0,
        m8: (m8.circadianStrainIndex || 0) * 0.12
    }, 13, 0.618, m13.mRiseMultiplier);

    const hTier = homeTel.fbs_tier_label ? ` (${homeTel.fbs_tier_label})` : "";
    const aTier = awayTel.fbs_tier_label ? ` (${awayTel.fbs_tier_label})` : "";
    const probCol = fibRes.liveAdjustedProb >= 52.4 ? "var(--emerald)" : "var(--red)";

    return `
        <div class="stat-trio">
            <div class="stat-box">
                <div class="stat-k">Home Fair (Tip)</div>
                <div class="stat-v">${meta.homeTeam} ${fmtSigned(m9Tip.fairHomeSpread, 1)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-k">Home Fair (BD)</div>
                <div class="stat-v" style="color:${locked ? "var(--gold)" : "var(--cyan)"};">${locked ? renderLockSpanHTML("🔒 BD") : `${meta.homeTeam} ${fmtSigned(m9Bd.fairHomeSpread, 1)}`}</div>
            </div>
            <div class="stat-box">
                <div class="stat-k">Home ATS P_agg</div>
                <div class="stat-v" style="color:${locked ? "var(--gold)" : probCol};">${locked ? renderLockSpanHTML("🔒 BD") : `${fibRes.liveAdjustedProb.toFixed(1)}%`}</div>
            </div>
        </div>

        <div class="dossier-tier-card">
            <div class="dossier-tier-head"><span>TIER 1 — CORE EFFICIENCY (WEIGHT 34)</span><span>M1 · M5 · M7</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M1 Vegas Closing</span><span class="dossier-mod-v">${meta.homeTeam} ${fmtSigned(vHome, 1)} · O/U ${meta.vegasTotalLine || "--"}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M5 Trench / Pass-Pro</span><span class="dossier-mod-v">${(homeTel.lt_or_rb_pass_pro_out || awayTel.lt_or_rb_pass_pro_out) ? "⚠️ Compromised OL" : "✅ Healthy Pass-Pro"}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M7 Air Density (&rho;)</span><span class="dossier-mod-v">${env.is_dome ? "Dome 72°F · 1.204" : `${Math.round(env.temperature_f || 58)}°F · ${Math.round(env.wind_mph || 0)}mph · ${m7.airDensityRho}`}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M7 Ballistics (&Delta;FG / &Delta;Y)</span><span class="dossier-mod-v">${locked ? renderLockSpanHTML() : `${fmtSigned(m7.fgRangeShiftYards, 1)} yds / ${fmtSigned(m7.passGameModifierYards, 1)} yds`}</span></div>
        </div>

        <div class="dossier-tier-card">
            <div class="dossier-tier-head"><span>TIER 2 — HIGH LEVERAGE (WEIGHT 21)</span><span>M6 · M10 · M12</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M6 / M9 Red-Zone (&Delta;RZ)</span><span class="dossier-mod-v">${fmtSigned(m9Tip.deltaRzFin, 2)} pts</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M10 Combinatorics Fit</span><span class="dossier-mod-v">30% Boost &amp; Round Robin Eligible</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M12 Net Turnover EPA</span><span class="dossier-mod-v" style="color:${locked ? "var(--gold)" : (m12.netTurnoverEPA >= 0 ? "var(--emerald)" : "var(--red)")};">${locked ? renderLockSpanHTML() : `${fmtSigned(m12.netTurnoverEPA, 3)} (Ψ ${fmtSigned(psiCoupled, 2)})`}</span></div>
        </div>

        <div class="dossier-tier-card">
            <div class="dossier-tier-head"><span>TIER 3 — SIZING &amp; ALTITUDE (WEIGHT 13)</span><span>M2 · M3 · M11</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M2 Quarter-Kelly Cap</span><span class="dossier-mod-v">4.0% Hard Single-Bet Ceiling</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M3 2-Key &amp; Wong Engine</span><span class="dossier-mod-v">${locked ? renderLockSpanHTML() : "Active 2-Key Perpetuity + 6/7pt Wong"}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M11 10-Zone Elevation</span><span class="dossier-mod-v">${locked ? renderLockSpanHTML() : `Z${elev.zoneNumber} ${elev.direction} (${elev.deltaFeet > 0 ? "+" : ""}${elev.deltaFeet} ft · Ψ ${elev.psiElevPts} pts)`}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M11 Gravity / &Phi;_bio</span><span class="dossier-mod-v">${locked ? renderLockSpanHTML() : `${m11.localGravityG} m/s² · &Phi; ${m11.phiBioScore}`}</span></div>
        </div>

        <div class="dossier-tier-card">
            <div class="dossier-tier-head"><span>TIER 4, M9 HUB &amp; M13 SACRED GEO</span><span>M4 · M8 · M9 · M13</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M4 TOP Starvation Check</span><span class="dossier-mod-v">${Math.abs(vHome) >= 10 ? "⚠️ Active on ≥+10 Dog" : "✅ Clear"}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M8 Road Travel CSI</span><span class="dossier-mod-v">${Math.round(circ.away_travel_miles || 0)} mi · TZ ${circ.away_tz_shift || 0} · CSI ${m8.circadianStrainIndex}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M9 Team EPA &amp; Tiers</span><span class="dossier-mod-v">${meta.awayTeam}${aTier}: ${Number(awayTel.net_epa_per_play || 0).toFixed(3)} | ${meta.homeTeam}${hTier}: ${Number(homeTel.net_epa_per_play || 0).toFixed(3)}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M9 Verified QB Wire</span><span class="dossier-mod-v">${Math.abs(m9Tip.injurySpreadDiff || 0) > 0 ? `ΔQB ${fmtSigned(m9Tip.injurySpreadDiff, 2)} pts` : "No Starting QB Out"}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">M13 Sacred Geo (M_rise)</span><span class="dossier-mod-v">${locked ? renderLockSpanHTML() : `${m13.mRiseMultiplier.toFixed(4)}x (Home ${fmtSigned(m13.mRiseSignedHomeDelta, 4)})`}</span></div>
            <div class="dossier-mod-row"><span class="dossier-mod-k">Home Master &Omega;_fib</span><span class="dossier-mod-v" style="color:${locked ? "var(--gold)" : probCol};">${locked ? renderLockSpanHTML() : `${fmtSigned(fibRes.omegaFibScore, 4)} → ${fibRes.liveAdjustedProb.toFixed(1)}%`}</span></div>
        </div>
    `;
}

window.openModuleDossier = function(kind, id, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const drawer = document.getElementById("dossier-drawer");
    const bd = document.getElementById("drawer-backdrop");
    const titleEl = document.getElementById("dossier-drawer-title");
    const subEl = document.getElementById("dossier-drawer-sub");
    const bodyEl = document.getElementById("dossier-drawer-body");
    const footEl = document.getElementById("dossier-drawer-foot");
    if (!drawer || !bodyEl) return;

    AppState.activeDossier = { kind, id };
    window.toggleSlipDrawer(false);
    window.closeMobileInspector();

    if (kind === "live") {
        const g = AppState.processedGames.find(x => x.gameId === id);
        if (!g) return;
        if (titleEl) titleEl.textContent = `${g.matchup} — 13-Module Dossier`;
        if (subEl) subEl.textContent = `${g.league} · ${g.kickoffShort} · HOME-TEAM P_AGG FRAME`;
        bodyEl.innerHTML = build13ModuleDossierFromInputs({
            league: g.league, homeTeam: g.homeTeam, awayTeam: g.awayTeam,
            vegasHomeSpread: g.vegasHomeSpread, vegasTotalLine: g.vegasTotalLine,
            kickoffLocalHour: 13, hfaBase: g.league === "NCAA" ? 2.6180339887 : 1.9416110252,
            envPayload: g.envPayload, circPayload: g.circPayload,
            homeTel: g.homeTel, awayTel: g.awayTel
        });
        const topSpread = AppState.processedProps.find(p => p.gameId === g.gameId && p.marketType === "spread");
        if (footEl) {
            footEl.innerHTML = `
                <div style="display:flex; gap:8px;">
                    ${topSpread ? `<button type="button" class="primary-btn cyan" style="flex:2;" onclick="window.closeModuleDossier(); window.setAppView('picks'); window.selectPick('${topSpread.propKey}', true);">Open in Research Inspector</button>` : ""}
                    <button type="button" class="chip" style="flex:1; justify-content:center;" onclick="window.closeModuleDossier()">Close</button>
                </div>
            `;
        }
    } else {
        const ledgerObj = (AppState.rawPayload && AppState.rawPayload.historical_ledger) || {};
        const rawEntries = ledgerObj.entries || {};
        const entriesMap = Object.assign({}, rawEntries, PERMANENT_LEDGER_ARCHIVE);
        const entry = entriesMap[id];
        if (!entry) return;
        const cleanMatchup = cleanLabelCodes(entry.matchup || "");
        const snap = entry.pre_kick_snapshot || null;
        if (titleEl) titleEl.textContent = `${cleanMatchup} — Pre-Kick Receipt`;
        if (subEl) subEl.textContent = `${entry.league || "NFL"} · FINAL: ${entry.final_score || "GRADED"}${snap && snap.locked_at_utc ? ` · LOCKED ${snap.locked_at_utc}` : ""}`;

        const sr = entry.spread_record;
        const tr = entry.total_record;
        const mr = entry.ml_record;
        const summaryBadges = `
            <div class="dossier-tier-card" style="border-color:var(--emerald-bd);">
                <div class="dossier-tier-head" style="color:var(--emerald);"><span>LOCKED CLOSING RECEIPT &amp; FINAL GRADE</span><span>${entry.final_score || "FINAL"}</span></div>
                ${sr ? `<div class="dossier-mod-row"><span class="dossier-mod-k">Spread: ${cleanLabelCodes(sr.pick_label || "")}</span><span class="dossier-mod-v">Proj ${sr.tip_proj} · ${sr.result_tip || "GRADED"}</span></div>` : ""}
                ${tr ? `<div class="dossier-mod-row"><span class="dossier-mod-k">Total: ${cleanLabelCodes(tr.pick_label || "")}</span><span class="dossier-mod-v">Proj ${tr.tip_proj} · ${tr.result_tip || "GRADED"}</span></div>` : ""}
                ${mr ? `<div class="dossier-mod-row"><span class="dossier-mod-k">ML Winner: ${cleanTeamCode(mr.pick_team || "")} ML</span><span class="dossier-mod-v">${Number(mr.tip_win_pct || 50).toFixed(1)}% · ${mr.result_tip || "GRADED"}</span></div>` : ""}
            </div>
        `;

        if (snap) {
            bodyEl.innerHTML = summaryBadges + build13ModuleDossierFromInputs({
                league: entry.league || "NFL",
                homeTeam: cleanTeamCode(entry.home_team || ""),
                awayTeam: cleanTeamCode(entry.away_team || ""),
                vegasHomeSpread: snap.vegas_home_spread,
                vegasTotalLine: snap.vegas_total_line,
                kickoffLocalHour: snap.kickoff_local_hour || 13,
                hfaBase: snap.hfa_base,
                envPayload: snap.environmental_payload || {},
                circPayload: snap.circadian_payload || {},
                homeTel: (snap.team_telemetry && snap.team_telemetry.home) || {},
                awayTel: (snap.team_telemetry && snap.team_telemetry.away) || {}
            });
        } else {
            bodyEl.innerHTML = summaryBadges + `
                <div class="empty-state" style="padding:22px 14px;">
                    <div style="font-weight:800; color:var(--gold); margin-bottom:6px;">Archived Before Full 13-Module Snapshot Rollout</div>
                    <div>Full pre-kick weather, EPA, injury, and 13-module receipt replay automatically activates on all newly locked games starting with scraper v239.</div>
                </div>
            `;
        }
        if (footEl) {
            footEl.innerHTML = `<button type="button" class="primary-btn cyan" onclick="window.closeModuleDossier()">Close Receipt</button>`;
        }
    }

    drawer.classList.add("open");
    if (bd) bd.classList.add("open");
};

// ==========================================
// PERMANENT ARCHIVE + ZERO-TOKEN ESPN SCOREBOARD SYNC & 6 CLICKABLE LEDGER VAULTS
// ==========================================
const PERMANENT_LEDGER_ARCHIVE = {
    "nfl_mnf_lac_bal_2026_w10": {
        league: "NFL",
        week_label: "Week 10",
        matchup: "LAC @ BAL",
        status: "FINAL",
        final_score: "LAC 23 - BAL 20",
        is_locked: true,
        trap_avoided: true,
        trap_pick_label: "LAC Spread (-6.5) (LAC @ BAL)",
        trap_vegas_line: -6.5,
        trap_tip_proj: -2.1,
        trap_tip_ev_pct: -27.62,
        porkys_record: {
            porkys_slot: "DAY-SHIFT TRAP #1",
            is_core_three: true,
            trap_label: "LAC Spread (-6.5) (LAC @ BAL)",
            trap_line: -6.5,
            trap_proj: -2.1,
            trap_ev_pct: -27.62,
            fade_label: "BAL Spread (+6.5) (BAL vs LAC)",
            fade_team: "BAL",
            fade_line: 6.5,
            fade_proj: 2.1,
            fade_ev_pct: 27.62,
            safe_floor_hook: 10.5,
            safe_floor_label: "Alt +10.5 (-185)",
            safe_floor_win_pct: 88.4,
            result_floor: "HIT",
            result_straight: "HIT",
            floor_miss_by: 0,
            straight_miss_by: 0,
            trap_dodged: true
        },
        spread_record: {
            pick_label: "BAL Spread (+6.5) (BAL vs LAC)",
            vegas_line: 6.5,
            odds: -110,
            tip_proj: 2.1,
            tip_win_pct: 66.85,
            tip_ev_pct: 27.62,
            tip_badge: "SMASH",
            bd_proj: 1.4,
            bd_win_pct: 69.25,
            bd_ev_pct: 32.20,
            key_alt_line: 10.5,
            safe_floor_label: "Alt +10.5 (-185)",
            safe_floor_win_pct: 84.9,
            bd_alt_label: "Alt +3.5 (+145)",
            bd_alt_ev_pct: 41.80,
            flagship_slot: "MÉNAGE À TROIS #2",
            result_tip: "HIT",
            result_bd: "HIT",
            result_floor: "HIT",
            result_ceiling: "HIT",
            miss_by_pts: 0
        },
        total_record: {
            pick_label: "LAC@BAL Total (O 44.5)",
            vegas_line: 44.5,
            odds: -110,
            tip_proj: 46.1,
            tip_win_pct: 55.80,
            tip_ev_pct: 6.53,
            tip_badge: "TOO_CLOSE",
            bd_proj: 46.8,
            bd_win_pct: 58.10,
            bd_ev_pct: 10.92,
            safe_floor_label: "Alt O 40.5 (-175)",
            safe_floor_win_pct: 84.2,
            bd_alt_label: "Alt O 47.5 (+155)",
            bd_alt_ev_pct: 14.20,
            flagship_slot: "",
            result_tip: "BLUE_BALLS",
            result_bd: "BLUE_BALLS",
            result_floor: "HIT",
            result_ceiling: "MISS",
            miss_by_pts: 1.5
        },
        ml_record: {
            pick_label: "LAC ML (-265) (LAC @ BAL)",
            pick_team: "LAC",
            ml_odds: -265,
            is_underdog: false,
            is_upset_pick: false,
            tip_win_pct: 56.7,
            tip_ev_pct: -21.9,
            balls_deep_win_pct: 54.5,
            balls_deep_ev_pct: -24.9,
            result_tip: "HIT",
            result_balls_deep: "HIT"
        }
    }
};

async function syncEspnLiveScores() {
    const now = Date.now();
    if (now - ESPN_SCORE_CACHE.lastFetchMs < 60000) return;
    ESPN_SCORE_CACHE.lastFetchMs = now;

    const endpoints = [
        { league: "NFL", url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard" },
        { league: "NCAA", url: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=100" }
    ];

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url, { cache: "no-store" });
            if (!res.ok) continue;
            const data = await res.json();
            (data.events || []).forEach(ev => {
                const comp = (ev.competitions && ev.competitions[0]) || {};
                const competitors = comp.competitors || [];
                const homeObj = competitors.find(c => c.homeAway === "home");
                const awayObj = competitors.find(c => c.homeAway === "away");
                if (!homeObj || !awayObj) return;

                const homeCode = cleanTeamCode((homeObj.team && homeObj.team.abbreviation) || "");
                const awayCode = cleanTeamCode((awayObj.team && awayObj.team.abbreviation) || "");
                const homeScore = parseFloat(homeObj.score || "0");
                const awayScore = parseFloat(awayObj.score || "0");
                const state = (ev.status && ev.status.type && ev.status.type.state) || "pre";
                const shortDetail = (ev.status && ev.status.type && ev.status.type.shortDetail) || "";
                const key = `${awayCode} @ ${homeCode}`;
                const scoreObj = {
                    league: ep.league, homeCode, awayCode, homeScore, awayScore,
                    state, shortDetail, scoreStr: `${awayCode} ${awayScore} - ${homeCode} ${homeScore}`
                };
                ESPN_SCORE_CACHE.gamesByMatchup[`${ep.league}_${key}`] = scoreObj;
                if (!ESPN_SCORE_CACHE.gamesByMatchup[key] || ep.league === "NFL") {
                    ESPN_SCORE_CACHE.gamesByMatchup[key] = scoreObj;
                }
                const hDisp = normNameKey((homeObj.team && (homeObj.team.displayName || homeObj.team.name)) || "");
                const aDisp = normNameKey((awayObj.team && (awayObj.team.displayName || awayObj.team.name)) || "");
                if (hDisp && aDisp) {
                    ESPN_SCORE_CACHE.gamesByMatchup[`${ep.league}:name:${aDisp}__${hDisp}`] = scoreObj;
                }
            });
        } catch (e) {
            // Silent fallback
        }
    }

    renderPicksFeed();
    renderHistoricalLedger();
    renderLiveBottomTicker();
}

window.toggleLedgerVault = function(vaultKey, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (AppState.activeMode === "tip" && (vaultKey === "floors_ceilings" || vaultKey === "tip_vs_bd")) {
        window.unlockBallsDeepMode(event);
        return;
    }
    AppState.activeLedgerVault = (AppState.activeLedgerVault === vaultKey) ? null : vaultKey;
    renderHistoricalLedger();
};

window.toggleLedgerFivePackView = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    AppState.ledgerFivePackView = (AppState.ledgerFivePackView === "flagship") ? "porkys" : "flagship";
    if (AppState.activeLedgerVault === "flagship_5pack" || AppState.activeLedgerVault === "porkys_5pack") {
        AppState.activeLedgerVault = (AppState.ledgerFivePackView === "porkys") ? "porkys_5pack" : "flagship_5pack";
    }
    renderHistoricalLedger();
};

window.setFivePackVaultWeek = function(weekVal, event) {
    if (event) event.stopPropagation();
    AppState.selectedFivePackWeek = weekVal || "ALL";
    AppState.ledgerFivePackView = "flagship";
    AppState.activeLedgerVault = "flagship_5pack";
    renderHistoricalLedger();
};

window.setPorkysVaultWeek = function(weekVal, event) {
    if (event) event.stopPropagation();
    AppState.selectedPorkysWeek = weekVal || "ALL";
    AppState.ledgerFivePackView = "porkys";
    AppState.activeLedgerVault = "porkys_5pack";
    renderHistoricalLedger();
};

window.toggleLedgerAllCompleted = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    AppState.ledgerShowAllCompleted = !AppState.ledgerShowAllCompleted;
    renderHistoricalLedger();
};

function isRankedLedgerEntry(matchupStr, league, entryObj = null) {
    if (league === "NFL") return AppState.filters.nfl;
    if (league === "NCAA") {
        if (!AppState.filters.ncaa) return false;
        if (AppState.ledgerShowAllCompleted) return true;
        if (AppState.processedGames.some(g => g.league === "NCAA" && g.matchup === matchupStr)) return true;
        const liveRanked = (AppState.rawPayload && AppState.rawPayload.slate_info && Array.isArray(AppState.rawPayload.slate_info.ranked_ncaa_teams))
            ? AppState.rawPayload.slate_info.ranked_ncaa_teams
            : [];
        if (entryObj && liveRanked.length >= 20) {
            const hFull = entryObj.home_full_name || "";
            const aFull = entryObj.away_full_name || "";
            if (hFull || aFull) return liveRanked.includes(hFull) || liveRanked.includes(aFull);
        }
        if (AppState.rawPayload && Array.isArray(AppState.rawPayload.games)) {
            const rawMatch = AppState.rawPayload.games.find(g => g.league === "NCAA" && `${cleanTeamCode(g.away_team)} @ ${cleanTeamCode(g.home_team)}` === matchupStr);
            if (rawMatch) return isRankedNCAAGame(rawMatch);
        }
        const parts = (matchupStr || "").split("@").map(s => cleanTeamCode(s.trim()));
        return parts.some(code => RANKED_NCAA_CODES.has(code) && code !== "UNM" && code !== "SMU" && code !== "OKST" && code !== "LSU");
    }
    return true;
}

function gradeSpreadPick(isHomeSpread, baseLine, homeScore, awayScore) {
    const teamMargin = isHomeSpread ? (homeScore - awayScore) : (awayScore - homeScore);
    const coverDiff = teamMargin + Number(baseLine);
    if (coverDiff > 0) return { outcome: "HIT", missBy: 0 };
    if (coverDiff === 0) return { outcome: "PUSH", missBy: 0 };
    const missPts = Number(Math.abs(coverDiff).toFixed(1));
    if (missPts <= BLUE_BALLS_MARGIN) return { outcome: "BLUE_BALLS", missBy: missPts };
    return { outcome: "MISS", missBy: missPts };
}

function gradeTotalByDirection(directionChar, targetLine, homeScore, awayScore) {
    const actualTotal = homeScore + awayScore;
    const line = Number(targetLine);
    if (actualTotal === line) return { outcome: "PUSH", missBy: 0 };
    const takingUnder = (String(directionChar || "O").toUpperCase() === "U");
    const coverDiff = takingUnder ? (line - actualTotal) : (actualTotal - line);
    if (coverDiff > 0) return { outcome: "HIT", missBy: 0 };
    const missPts = Number(Math.abs(coverDiff).toFixed(1));
    if (missPts <= BLUE_BALLS_MARGIN) return { outcome: "BLUE_BALLS", missBy: missPts };
    return { outcome: "MISS", missBy: missPts };
}

function renderHistoricalLedger() {
    const container = document.getElementById("ledger-container");
    if (!container) return;

    if (Date.now() - ESPN_SCORE_CACHE.lastFetchMs >= 60000) {
        syncEspnLiveScores();
    }

    const ledgerObj = (AppState.rawPayload && AppState.rawPayload.historical_ledger) || {};
    const rawEntries = ledgerObj.entries || {};
    const showBallsDeep = (AppState.activeMode !== "tip");

    const entriesMap = Object.assign({}, rawEntries, PERMANENT_LEDGER_ARCHIVE);
    Object.keys(rawEntries).forEach(k => {
        const rawE = rawEntries[k];
        if (!rawE) return;
        const cleanM = cleanLabelCodes(rawE.matchup || "");
        if (cleanM === "LAC @ BAL" && rawE.spread_record && rawE.spread_record.flagship_slot) {
            if (entriesMap["nfl_mnf_lac_bal_2026_w10"] && entriesMap["nfl_mnf_lac_bal_2026_w10"].spread_record) {
                entriesMap["nfl_mnf_lac_bal_2026_w10"].spread_record.flagship_slot = rawE.spread_record.flagship_slot;
            }
        }
    });

    const renderGradeBadge = (res, missBy = 0) => {
        if (res === "HIT") return `<span class="badge b-smash">✅ HIT</span>`;
        if (res === "BLUE_BALLS") return `<span class="badge b-blue">🔵 BB${missBy > 0 ? ` (-${missBy})` : ""}</span>`;
        if (res === "MISS") return `<span class="badge b-pass">❌ MISS</span>`;
        if (res === "PUSH") return `<span class="badge b-muted">➖ PUSH</span>`;
        return `<span class="badge b-cyan">⏳ PENDING</span>`;
    };

    const makeBucket = () => ({ hits: 0, misses: 0, blueBalls: 0, total: 0 });
    const buckets = {
        flagship_5pack: makeBucket(), menage_a_trois: makeBucket(),
        porkys_5pack: makeBucket(), porkys_core3: makeBucket(), porkys_flex2: makeBucket(),
        overall_smash: makeBucket(), smash_key_exec: makeBucket(),
        spread_smash: makeBucket(), total_smash: makeBucket(),
        all_tease: makeBucket(),
        champagne_room: { dodged: 0, total: 0 },
        safe_floors: makeBucket(), ceilings: makeBucket(),
        wong_teasers: makeBucket(),
        tip_all: makeBucket(), balls_deep_all: makeBucket(),
        ml_winners: makeBucket(), ml_upsets: makeBucket()
    };
    // Persistent Production Engine Overall (W13+) rolling summary — always visible above the 7 Vault Cards
    const prodOverall = {
        spread: makeBucket(), keyAlt: makeBucket(),
        total: makeBucket(), safeTotal: makeBucket(),
        ml: makeBucket(), mlUpsets: makeBucket()
    };
    const activeWeekNum = Number((AppState.rawPayload && AppState.rawPayload.slate_info && AppState.rawPayload.slate_info.week) || 13);
    const activeWeekLabel = `Week ${activeWeekNum}`;
    const selectedScope = AppState.ledgerWeekFilter || "CURRENT";
    const matchesSelectedScope = (wkLabel) => {
        const wNum = parseWeekNum(wkLabel);
        if (selectedScope === "CURRENT") return wkLabel === activeWeekLabel;
        if (selectedScope === "PROD_OVERALL") return wNum >= PROD_ENGINE_MIN_WEEK;
        if (selectedScope === "LEGACY_BETA") return wNum > 0 && wNum < PROD_ENGINE_MIN_WEEK;
        if (selectedScope === "ALL_TIME" || selectedScope === "ALL") return true;
        return wkLabel === selectedScope;
    };

    const fivePackByWeek = {};
    const ensureWeekFivePackBucket = (wk) => {
        if (!fivePackByWeek[wk]) fivePackByWeek[wk] = { hits: 0, misses: 0, blueBalls: 0, total: 0, menage: makeBucket(), rows: [] };
        return fivePackByWeek[wk];
    };

    const porkysByWeek = {};
    const ensureWeekPorkysBucket = (wk) => {
        if (!porkysByWeek[wk]) porkysByWeek[wk] = { hits: 0, misses: 0, blueBalls: 0, total: 0, core3: makeBucket(), flex2: makeBucket(), coreLegs: [], flexLegs: [], rows: [] };
        return porkysByWeek[wk];
    };

    const vaultRows = {
        flagship_5pack: [], porkys_5pack: [], overall_smash: [],
        all_tease: [], grenades_dodged: [], floors_ceilings: [], tip_vs_bd: [], ml_winners: []
    };

    const tallyObj = (obj, res) => {
        if (res !== "HIT" && res !== "MISS" && res !== "BLUE_BALLS") return;
        obj.total += 1;
        if (res === "HIT") obj.hits += 1;
        else if (res === "BLUE_BALLS") obj.blueBalls += 1;
        else obj.misses += 1;
    };
    const tally = (key, res) => tallyObj(buckets[key], res);

    let upcomingRowsHTML = "";
    const renderedMatchups = new Set();
    const activeSlateMatchups = new Set(AppState.processedGames.map(g => `${g.league}_${g.matchup}_${g.weekLabel || "Week 11"}`));
    const recordedPorkysMatchups = new Set();

    const buildStandardRow = (archId, weekLabel, cleanMatchup, statusLabel, type, slot, pickLabel, ledgerTier, vegasLine, baseOdds, tipColor, fmtTipProj, tipWinPct, tipEvPct, bdColor, fmtBdProj, bdWinPct, bdEvPct, safeFloorLabel, safeFloorWinPct, bdAltLabel, bdAltEvPct, gradedTip, missByPts) => `
        <tr class="clickable-row" title="Click to replay Pre-Kick 13-Module Receipt" onclick="window.openModuleDossier('ledger', '${archId}', event)">
            <td><span style="color:var(--gold); font-size:10px; font-weight:800;">${weekLabel}</span>${parseWeekNum(weekLabel) > 0 && parseWeekNum(weekLabel) < PROD_ENGINE_MIN_WEEK ? `<span class="beta-tag">BETA</span>` : ""}<br><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
            <td>${type}${slot ? `<br><span class="badge ${slot.includes("MÉNAGE") ? "b-gold" : "b-cyan"}" style="margin-top:3px;">${slot}</span>` : ""}</td>
            <td><strong>${pickLabel}</strong> ${renderTierBadgeHTML(ledgerTier)}</td>
            <td>${vegasLine} (${baseOdds > 0 ? "+" : ""}${baseOdds})</td>
            <td style="color:${tipColor};">Proj <strong>${fmtTipProj}</strong> (${tipWinPct}% · ${tipEvPct > 0 ? "+" : ""}${tipEvPct}%)</td>
            <td>${showBallsDeep
                ? `<span style="color:${bdColor};">Proj <strong>${fmtBdProj}</strong> (${bdWinPct}% · ${bdEvPct > 0 ? "+" : ""}${bdEvPct}%)<br><small style="color:var(--cyan);">🔑 ${safeFloorLabel} (${safeFloorWinPct}%)</small> · <small style="color:var(--gold);">🎯 ${bdAltLabel}</small></span>`
                : renderLockSpanHTML("🔒 Balls Deep")
            }</td>
            <td>${renderGradeBadge(gradedTip, missByPts)}</td>
        </tr>
    `;

    const buildFloorCeilingRow = (weekLabel, cleanMatchup, statusLabel, type, pickLabel, vegasLine, safeFloorLabel, safeFloorWinPct, gradedFloor, floorMissBy, bdAltLabel, bdAltEvPct, gradedCeiling, ceilingMissBy) => `
        <tr>
            <td><span style="color:var(--gold); font-size:10px; font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
            <td>${type}</td>
            <td><strong>${pickLabel}</strong><br><small style="color:var(--text-3);">Base: ${vegasLine}</small></td>
            <td style="color:var(--cyan); font-weight:700;">🔑 ${safeFloorLabel}<br><small style="color:var(--text-2);">Win Prob: ${safeFloorWinPct}%</small></td>
            <td>${renderGradeBadge(gradedFloor, floorMissBy)}</td>
            <td style="color:var(--gold); font-weight:700;">🎯 ${bdAltLabel}<br><small style="color:var(--text-2);">Alt EV: ${bdAltEvPct > 0 ? "+" : ""}${bdAltEvPct}%</small></td>
            <td>${renderGradeBadge(gradedCeiling, ceilingMissBy)}</td>
        </tr>
    `;

    const buildPorkysRow = (weekLabel, cleanMatchup, statusLabel, slotLabel, isCore3, trapLabel, trapLine, trapProj, trapEvPct, fadeTeam, safeFloorLabel, safeFloorWinPct, fadeBaseLine, gradedFloor, floorMissBy, gradedStraight, straightMissBy) => `
        <tr>
            <td><span style="color:var(--red); font-size:10px; font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
            <td><span class="badge b-pass">🐷 ${slotLabel}</span><br><small style="color:var(--text-3);">${isCore3 ? "3-PICK CORE" : "2-PICK FLEX"}</small></td>
            <td><strong style="color:var(--red);">🚫 ${trapLabel}</strong><br><small style="color:var(--text-3);">Line ${fmtSigned(trapLine, 1)} · Proj ${trapProj} (${trapEvPct}%)</small></td>
            <td style="color:var(--cyan); font-weight:700;">${showBallsDeep ? `🛡️ ${fadeTeam} ${safeFloorLabel}<br><small style="color:var(--text-2);">Base ${fmtSigned(fadeBaseLine, 1)} · ${safeFloorWinPct}%</small>` : renderLockSpanHTML("🔒 Floor Locked")}</td>
            <td>${showBallsDeep ? renderGradeBadge(gradedFloor, floorMissBy) : renderLockSpanHTML("🔒")}</td>
            <td>${renderGradeBadge(gradedStraight, straightMissBy)}</td>
        </tr>
    `;

    const parseFinalScores = (entryObj, espnObj) => {
        if (espnObj && espnObj.state === "post" && !isNaN(espnObj.homeScore) && !isNaN(espnObj.awayScore)) {
            return { awayScore: Number(espnObj.awayScore), homeScore: Number(espnObj.homeScore) };
        }
        if (entryObj && typeof entryObj.final_score === "string") {
            const m = entryObj.final_score.match(/\s(\d+)\s*-\s*[A-Za-z0-9()]+\s+(\d+)/);
            if (m) return { awayScore: Number(m[1]), homeScore: Number(m[2]) };
        }
        return null;
    };

    const sortedArchiveIds = Object.keys(entriesMap).sort((a, b) => {
        const scoreEntry = (id, e) => {
            let s = 0;
            if (PERMANENT_LEDGER_ARCHIVE[id]) s += 100;
            const sOdds = Math.abs(Number((e.spread_record && e.spread_record.odds) || -110));
            const tOdds = Math.abs(Number((e.total_record && e.total_record.odds) || -110));
            if (sOdds < 220 && tOdds < 220) s += 50;
            if (e.status === "FINAL") s += 30;
            if (e.spread_record && e.spread_record.result_tip && e.spread_record.result_tip !== "PENDING") s += 20;
            if (id.startsWith("NFL_") || id.startsWith("NCAA_")) s += 10;
            return s;
        };
        return scoreEntry(b, entriesMap[b] || {}) - scoreEntry(a, entriesMap[a] || {});
    });

    // 1. Completed Archive Entries -> Scorecard Vaults
    sortedArchiveIds.forEach(archId => {
        const entry = entriesMap[archId];
        if (!entry) return;
        const cleanMatchup = cleanLabelCodes(entry.matchup || "");
        const entryLeague = entry.league || "NFL";
        const weekLabel = inferFootballWeekLabel(entry, "Week 11");
        const rematchKey = `${entryLeague}_${cleanMatchup}_${weekLabel}`;
        if (!cleanMatchup || renderedMatchups.has(rematchKey)) return;
        if (!isRankedLedgerEntry(cleanMatchup, entryLeague, entry)) return;

        const espnMatch = getEspnScoreMatch(entryLeague, cleanMatchup, entry.away_full_name || '', entry.home_full_name || '');
        const parsedScores = parseFinalScores(entry, espnMatch);
        const isFinal = entry.status === "FINAL" || Boolean(espnMatch && espnMatch.state === "post");
        if (activeSlateMatchups.has(rematchKey) && !isFinal) return;

        const hasGraded = entry.spread_record && ["HIT", "MISS", "BLUE_BALLS", "PUSH"].includes(entry.spread_record.result_tip);
        if (!isFinal && !hasGraded) return;

        renderedMatchups.add(rematchKey);
        const wkNum = parseWeekNum(weekLabel);
        const isProdEra = (wkNum >= PROD_ENGINE_MIN_WEEK);
        const inActiveScope = matchesSelectedScope(weekLabel);

        // Always update persistent Production Engine Overall (W13+) rolling strip
        if (isProdEra) {
            if (entry.spread_record && ["HIT", "MISS", "BLUE_BALLS"].includes(entry.spread_record.result_tip)) {
                tallyObj(prodOverall.spread, entry.spread_record.result_tip);
                if (entry.spread_record.result_key_alt) tallyObj(prodOverall.keyAlt, entry.spread_record.result_key_alt);
            }
            if (entry.total_record && ["HIT", "MISS", "BLUE_BALLS"].includes(entry.total_record.result_tip)) {
                tallyObj(prodOverall.total, entry.total_record.result_tip);
                if (entry.total_record.result_safe_total) tallyObj(prodOverall.safeTotal, entry.total_record.result_safe_total);
            }
            if (entry.ml_record && ["HIT", "MISS"].includes(entry.ml_record.result_tip)) {
                tallyObj(prodOverall.ml, entry.ml_record.result_tip);
                const mlWinP = Number(entry.ml_record.tip_win_pct || 0) / 100.0;
                const isQualifiedUpset = Boolean(entry.ml_record.is_upset_pick) && (entryLeague !== "NCAA" || mlWinP >= NCAA_ML_UPSET_FLOOR);
                if (isQualifiedUpset) tallyObj(prodOverall.mlUpsets, entry.ml_record.result_tip);
            }
        }

        if (!inActiveScope) return;
        const scoreDisplay = entry.final_score || (espnMatch ? espnMatch.scoreStr : "FINAL");
        const statusLabel = `<span style="color:var(--emerald); font-weight:700;">${scoreDisplay}</span>`;

        const parts = cleanMatchup.split("@").map(s => cleanTeamCode(s.trim()));
        const entryAwayCode = cleanTeamCode(entry.away_team || parts[0] || "");
        const entryHomeCode = cleanTeamCode(entry.home_team || parts[1] || "");

        // Grenades Dodged Audit
        if (entry.trap_avoided) {
            buckets.champagne_room.total += 1;
            buckets.champagne_room.dodged += 1;
            vaultRows.grenades_dodged.push(`
                <tr>
                    <td><span style="color:var(--gold); font-size:10px; font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br>${statusLabel}</td>
                    <td><span class="badge b-pass">PASS TRAP</span></td>
                    <td style="color:var(--red);"><strong>🚫 ${cleanLabelCodes(entry.trap_pick_label || `${cleanMatchup} Trap`)}</strong></td>
                    <td>${entry.trap_vegas_line !== undefined ? entry.trap_vegas_line : "--"} (-110)</td>
                    <td style="color:var(--red);">Proj ${entry.trap_tip_proj !== undefined ? entry.trap_tip_proj : "--"} (${entry.trap_tip_ev_pct !== undefined ? entry.trap_tip_ev_pct + "%" : "≤-19%"})</td>
                    <td style="color:var(--emerald);">✅ ${cleanLabelCodes((entry.spread_record && entry.spread_record.pick_label) || "Counter-Strike Fade")}</td>
                    <td><span class="badge b-smash">💣 DODGED</span></td>
                </tr>
            `);
        } else if (isFinal && entry.spread_record) {
            const sr = entry.spread_record;
            const fadeWinProb = Number(sr.tip_win_pct !== undefined ? sr.tip_win_pct : 50) / 100.0;
            const oppWinProb = Math.max(0.01, Math.min(0.99, 1.0 - fadeWinProb));
            const derivedTrapEv = Number((((oppWinProb * (100.0 / 110.0)) - (1.0 - oppWinProb)) * 100.0).toFixed(2));
            const trapEvNum = (entry.porkys_record && entry.porkys_record.trap_ev_pct !== undefined) ? Number(entry.porkys_record.trap_ev_pct) : derivedTrapEv;

            if (trapEvNum <= PASS_EV_CUTOFF) {
                const fadeLineNum = Number(sr.vegas_line !== undefined ? sr.vegas_line : (sr.vegas_closing_line || 0));
                const fadeTeamClean = cleanTeamCode(sr.pick_team || "");
                const fadeIsHome = (fadeTeamClean && fadeTeamClean === entryHomeCode) || cleanLabelCodes(sr.pick_label || "").startsWith(`${entryHomeCode} `);
                const trapTeamCode = fadeIsHome ? entryAwayCode : entryHomeCode;
                const trapLineNum = -fadeLineNum;
                let trapOutcome = null;
                if (parsedScores) trapOutcome = gradeSpreadPick(!fadeIsHome, trapLineNum, parsedScores.homeScore, parsedScores.awayScore).outcome;
                else if (sr.result_tip && sr.result_tip !== "PENDING") trapOutcome = (sr.result_tip === "HIT" || sr.result_tip === "PUSH") ? "MISS" : "HIT";

                if (trapOutcome) {
                    buckets.champagne_room.total += 1;
                    if (trapOutcome !== "HIT") {
                        buckets.champagne_room.dodged += 1;
                        vaultRows.grenades_dodged.push(`
                            <tr>
                                <td><span style="color:var(--gold); font-size:10px; font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br>${statusLabel}</td>
                                <td><span class="badge b-pass">PASS TRAP</span></td>
                                <td style="color:var(--red);"><strong>🚫 ${trapTeamCode} ${fmtSigned(trapLineNum, 1)}</strong></td>
                                <td>${fmtSigned(trapLineNum, 1)} (-110)</td>
                                <td style="color:var(--red);">${trapEvNum}% EV</td>
                                <td style="color:var(--emerald);">✅ ${cleanLabelCodes(sr.pick_label || fadeTeamClean)}</td>
                                <td><span class="badge b-smash">💣 DODGED</span></td>
                            </tr>
                        `);
                    }
                }
            }
        }

        // Porky's Audit
        if (entry.porkys_record && !recordedPorkysMatchups.has(rematchKey)) {
            recordedPorkysMatchups.add(rematchKey);
            const pr = entry.porkys_record;
            const pSlot = pr.porkys_slot || "DAY-SHIFT TRAP #1";
            const isCore3 = pr.is_core_three !== undefined ? Boolean(pr.is_core_three) : pSlot.toUpperCase().includes("DAY-SHIFT");
            const pFadeTeam = cleanTeamCode(pr.fade_team || entryHomeCode);
            const isHomeFade = (pFadeTeam === entryHomeCode);
            const pFadeLine = Number(pr.fade_line || 0);
            const pFloorHook = pr.safe_floor_hook !== undefined ? Number(pr.safe_floor_hook) : snapToHalfPointHook(pFadeLine, +3.5);
            const pFloorLabel = pr.safe_floor_label || `Alt ${fmtSigned(pFloorHook, 1)} (-185)`;
            let pFloorRes = pr.result_floor || "PENDING", pFloorMiss = Number(pr.floor_miss_by || 0);
            let pStraightRes = pr.result_straight || "PENDING", pStraightMiss = Number(pr.straight_miss_by || 0);

            if (parsedScores && (pFloorRes === "PENDING" || pStraightRes === "PENDING")) {
                const fl = gradeSpreadPick(isHomeFade, pFloorHook, parsedScores.homeScore, parsedScores.awayScore);
                const st = gradeSpreadPick(isHomeFade, pFadeLine, parsedScores.homeScore, parsedScores.awayScore);
                if (pFloorRes === "PENDING") { pFloorRes = fl.outcome; pFloorMiss = fl.missBy; }
                if (pStraightRes === "PENDING") { pStraightRes = st.outcome; pStraightMiss = st.missBy; }
            }

            const pRow = buildPorkysRow(
                weekLabel, cleanMatchup, statusLabel, pSlot, isCore3,
                cleanLabelCodes(pr.trap_label || `${cleanMatchup} Trap`),
                pr.trap_line !== undefined ? pr.trap_line : -pFadeLine,
                pr.trap_proj !== undefined ? pr.trap_proj : "--",
                pr.trap_ev_pct !== undefined ? pr.trap_ev_pct : "--",
                pFadeTeam, pFloorLabel, pr.safe_floor_win_pct || 85.0, pFadeLine,
                pFloorRes, pFloorMiss, pStraightRes, pStraightMiss
            );
            const pWk = ensureWeekPorkysBucket(weekLabel);
            if (["HIT", "MISS", "BLUE_BALLS"].includes(pFloorRes)) {
                tally("porkys_5pack", pFloorRes);
                tally(isCore3 ? "porkys_core3" : "porkys_flex2", pFloorRes);
                tallyObj(pWk, pFloorRes);
                tallyObj(isCore3 ? pWk.core3 : pWk.flex2, pFloorRes);
            }
            if (isCore3) pWk.coreLegs.push({ outcome: pFloorRes });
            else pWk.flexLegs.push({ outcome: pFloorRes });
            pWk.rows.push(pRow);
            vaultRows.porkys_5pack.push({ weekLabel, rowHTML: pRow });
        }

        // Straight-Up Moneyline (ML) Winners & Outright Dog Upsets Audit (explicit ml_record or retroactive from spread_record)
        let mlRec = entry.ml_record || null;
        if (!mlRec && entry.spread_record && entry.spread_record.tip_proj !== undefined) {
            const sr = entry.spread_record;
            const srTeam = cleanTeamCode(sr.pick_team || "");
            const srIsHome = (srTeam && srTeam === entryHomeCode) || cleanLabelCodes(sr.pick_label || "").startsWith(`${entryHomeCode} `);
            const srTipProj = Number(sr.tip_proj || 0);
            const srLine = Number(sr.vegas_line !== undefined ? sr.vegas_line : (sr.vegas_closing_line || 0));
            const fairHome = srIsHome ? srTipProj : -srTipProj;
            const vegasHome = srIsHome ? srLine : -srLine;
            const pickHomeMl = (fairHome <= 0);
            const mlTeam = pickHomeMl ? entryHomeCode : entryAwayCode;
            const isDogMl = Boolean((vegasHome > 0) ? pickHomeMl : (vegasHome < 0 ? !pickHomeMl : false));
            const lgEng = (typeof getLeagueEngine === "function") ? getLeagueEngine(entryLeague) : null;
            const mlProb = lgEng && entryLeague === "NCAA" ? lgEng.winProb(Math.abs(fairHome)) : calcPointGapWinProb(Math.abs(fairHome));
            mlRec = {
                pick_label: `${mlTeam} ML`,
                pick_team: mlTeam,
                ml_odds: null,
                is_underdog: isDogMl,
                is_upset_pick: isDogMl,
                tip_win_pct: Number((mlProb * 100.0).toFixed(1)),
                tip_ev_pct: 0.0,
                result_tip: "PENDING"
            };
        }
        if (mlRec) {
            const mlTeam = cleanTeamCode(mlRec.pick_team || entryHomeCode);
            let mlOutcome = mlRec.result_tip || "PENDING";
            if (parsedScores && (mlOutcome === "PENDING" || !mlOutcome)) {
                if (parsedScores.homeScore === parsedScores.awayScore) mlOutcome = "PUSH";
                else {
                    const actualWinner = (parsedScores.homeScore > parsedScores.awayScore) ? entryHomeCode : entryAwayCode;
                    mlOutcome = (mlTeam === actualWinner) ? "HIT" : "MISS";
                }
            }
            if (mlOutcome === "HIT" || mlOutcome === "MISS") {
                tally("ml_winners", mlOutcome);
                const mlWpDec = Number(mlRec.tip_win_pct || 0) / 100.0;
                const isUpsetCall = Boolean(mlRec.is_upset_pick) && (entryLeague !== "NCAA" || mlWpDec >= NCAA_ML_UPSET_FLOOR);
                if (isUpsetCall) tally("ml_upsets", mlOutcome);
                const oddsText = (mlRec.ml_odds !== null && mlRec.ml_odds !== undefined)
                    ? `${Number(mlRec.ml_odds) > 0 ? "+" : ""}${mlRec.ml_odds}`
                    : (isUpsetCall ? "Vegas Dog" : "Vegas Fav");
                const upsetPill = isUpsetCall
                    ? (showBallsDeep ? `<span class="badge b-gold">🐶 DOG UPSET</span>` : renderLockSpanHTML("🔒 Dog Upset"))
                    : `<span class="badge b-muted">FAV</span>`;
                vaultRows.ml_winners.push(`
                    <tr class="clickable-row" title="Click to replay Pre-Kick 13-Module Receipt" onclick="window.openModuleDossier('ledger', '${archId}', event)">
                        <td><span style="color:var(--gold); font-size:10px; font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br>${statusLabel}</td>
                        <td>${upsetPill}</td>
                        <td><strong>${mlTeam} ML</strong></td>
                        <td>${oddsText}</td>
                        <td>Win ${Number(mlRec.tip_win_pct || 50).toFixed(1)}%</td>
                        <td>${mlOutcome === "HIT" ? `<span class="badge b-smash">✅ WIN</span>` : `<span class="badge b-pass">❌ LOSS</span>`}</td>
                    </tr>
                `);
            }
        }

        // Spread + Total Records
        [{ type: "SPREAD", rec: entry.spread_record }, { type: "TOTAL", rec: entry.total_record }]
            .filter(x => x.rec)
            .forEach(({ type, rec }) => {
                const isSpread = (type === "SPREAD");
                const pickLabel = cleanLabelCodes(rec.pick_label || rec.player || cleanMatchup);
                const vegasLine = Number(rec.vegas_line !== undefined ? rec.vegas_line : (rec.vegas_closing_line !== undefined ? rec.vegas_closing_line : 0));
                const baseOdds = Number(rec.odds || -110);
                const tipProj = Number(rec.tip_proj !== undefined ? rec.tip_proj : vegasLine);
                const tipWinPct = Number(rec.tip_win_pct !== undefined ? rec.tip_win_pct : 50);
                const tipEvPct = Number(rec.tip_ev_pct !== undefined ? rec.tip_ev_pct : 0);
                const ledgerTier = getTierFromEv(tipEvPct);
                const tipColor = getTierColor(ledgerTier);

                const archEng = (typeof getLeagueEngine === "function") ? getLeagueEngine(entryLeague) : null;
                const archWinProb = (gap) => !archEng ? calcPointGapWinProb(gap) : (!isSpread && archEng.totalWinProb ? archEng.totalWinProb(gap) : archEng.winProb(gap));

                let bdProj = Number(rec.bd_proj !== undefined ? rec.bd_proj : (rec.balls_deep_proj !== undefined ? rec.balls_deep_proj : tipProj));
                const tipDirChar = !isSpread ? (tipProj < vegasLine ? "U" : "O") : "";
                if (isSpread && (vegasLine - tipProj) >= 0 && (vegasLine - bdProj) < 0) {
                    bdProj = Number((vegasLine - Math.min(0.25, Math.abs(vegasLine - tipProj))).toFixed(2));
                } else if (!isSpread) {
                    if (tipDirChar === "U" && bdProj >= vegasLine) bdProj = Number((vegasLine - 0.2).toFixed(1));
                    if (tipDirChar === "O" && bdProj <= vegasLine) bdProj = Number((vegasLine + 0.2).toFixed(1));
                }
                const isUnderSafe = (tipDirChar === "U");
                const archBdProbRaw = isSpread ? archWinProb(vegasLine - bdProj) : Math.max(0.50, archWinProb(Math.abs(bdProj - vegasLine)));
                const bdWinPct = Number((archBdProbRaw * 100.0).toFixed(1));
                const bdEvPct = Number(calcExpectedValueAndKelly(archBdProbRaw, isSpread ? baseOdds : -110).evPercentage.toFixed(1));
                const bdColor = getTierColor(getTierFromEv(bdEvPct));

                const pickTeamClean = cleanTeamCode(rec.pick_team || "");
                const isHomeSpreadPick = isSpread && ((pickTeamClean && pickTeamClean === entryHomeCode) || pickLabel.startsWith(`${entryHomeCode} `));
                const keyAltFallback = isSpread
                    ? (archEng && entryLeague === "NCAA" ? archEng.keyAlt(vegasLine, bdProj, baseOdds) : calcKeyNumberAltSpreadSafe(vegasLine, bdProj, baseOdds))
                    : null;

                const defaultFloorHook = isSpread
                    ? keyAltFallback.altLine
                    : (rec.safe_total_line !== undefined && rec.safe_total_line !== null ? Number(rec.safe_total_line) : (isUnderSafe ? Math.floor(vegasLine + 4) + 0.5 : Math.floor(vegasLine - 4) + 0.5));
                const defaultCeilHook = isSpread
                    ? snapToHalfPointHook(vegasLine, -3.0)
                    : (isUnderSafe ? Math.floor(vegasLine - 3) + 0.5 : Math.floor(vegasLine + 3) + 0.5);

                const wongSubStr = (isSpread && keyAltFallback && keyAltFallback.tier2Line !== null)
                    ? ` · 🎯 Wong ${fmtSigned(keyAltFallback.tier2Line, 1)}` : "";
                const safeFloorLabel = isSpread ? `${keyAltFallback.altStr}${wongSubStr}` : (rec.safe_total_label || rec.safe_floor_label || `Alt ${tipDirChar} ${defaultFloorHook.toFixed(1)} (-175)`);
                const safeFloorWinPct = isSpread ? keyAltFallback.altProbPct : (rec.safe_total_win_pct || rec.safe_floor_win_pct || 75.0);
                const bdAltLabel = isSpread
                    ? (rec.bd_alt_label || `Alt ${fmtSigned(defaultCeilHook, 1)} (+145)`)
                    : `Alt ${tipDirChar} ${defaultCeilHook.toFixed(1)} (+155)`;
                const ceilGap = isSpread ? (defaultCeilHook - bdProj) : (isUnderSafe ? (defaultCeilHook - bdProj) : (bdProj - defaultCeilHook));
                const bdAltEvPct = Number(calcExpectedValueAndKelly(archWinProb(ceilGap), isSpread ? 145 : 155).evPercentage.toFixed(1));
                const slot = rec.flagship_slot || "";

                let gradedTip = rec.result_tip || "PENDING";
                let gradedBd = rec.result_bd || rec.result_balls_deep || gradedTip;
                let missByPts = Number(rec.miss_by_pts || 0);
                let gradedFloor = rec.result_key_alt || rec.result_safe_total || rec.result_floor || "";
                let floorMissBy = 0;
                let gradedCeiling = rec.result_ceiling || "";
                let ceilingMissBy = 0;
                let gradedWong = "";

                if (parsedScores) {
                    const { homeScore, awayScore } = parsedScores;
                    const liveTip = isSpread ? gradeSpreadPick(isHomeSpreadPick, vegasLine, homeScore, awayScore) : gradeTotalByDirection(tipDirChar, vegasLine, homeScore, awayScore);
                    const liveFloor = isSpread ? gradeSpreadPick(isHomeSpreadPick, defaultFloorHook, homeScore, awayScore) : gradeTotalByDirection(tipDirChar, defaultFloorHook, homeScore, awayScore);
                    const liveCeil = isSpread ? gradeSpreadPick(isHomeSpreadPick, defaultCeilHook, homeScore, awayScore) : gradeTotalByDirection(tipDirChar, defaultCeilHook, homeScore, awayScore);
                    if (gradedTip === "PENDING" || (gradedTip === "MISS" && missByPts === 0)) { gradedTip = liveTip.outcome; missByPts = liveTip.missBy; }
                    if (gradedBd === "PENDING") gradedBd = liveTip.outcome;
                    gradedFloor = liveFloor.outcome; floorMissBy = liveFloor.missBy;
                    gradedCeiling = liveCeil.outcome; ceilingMissBy = liveCeil.missBy;
                    if (isSpread && keyAltFallback && keyAltFallback.tier2Line !== null) {
                        gradedWong = gradeSpreadPick(isHomeSpreadPick, keyAltFallback.tier2Line, homeScore, awayScore).outcome;
                    }
                } else {
                    if (!gradedFloor) gradedFloor = (gradedTip === "HIT" || gradedTip === "BLUE_BALLS") ? "HIT" : "MISS";
                    if (!gradedCeiling) gradedCeiling = (gradedTip === "HIT") ? "HIT" : "MISS";
                }

                const fmtTipProj = isSpread ? fmtSigned(tipProj, 1) : tipProj.toFixed(1);
                const fmtBdProj = isSpread ? fmtSigned(bdProj, 1) : bdProj.toFixed(1);
                const rowHTML = buildStandardRow(
                    archId, weekLabel, cleanMatchup, statusLabel, type, slot, pickLabel, ledgerTier,
                    vegasLine, baseOdds, tipColor, fmtTipProj, tipWinPct, tipEvPct,
                    bdColor, fmtBdProj, bdWinPct, bdEvPct, safeFloorLabel, safeFloorWinPct,
                    bdAltLabel, bdAltEvPct, gradedTip, missByPts
                );

                if (["HIT", "MISS", "BLUE_BALLS", "PUSH"].includes(gradedTip)) {
                    if (gradedTip !== "PUSH") {
                        tally("tip_all", gradedTip);
                        tally("balls_deep_all", gradedBd);
                        tally("safe_floors", gradedFloor);
                        tally("ceilings", gradedCeiling);
                        if (gradedWong && gradedWong !== "PUSH") tally("wong_teasers", gradedWong);
                    }
                    vaultRows.tip_vs_bd.push(rowHTML);
                    vaultRows.floors_ceilings.push(buildFloorCeilingRow(
                        weekLabel, cleanMatchup, statusLabel, type, pickLabel, vegasLine,
                        safeFloorLabel, safeFloorWinPct, gradedFloor, floorMissBy,
                        bdAltLabel, bdAltEvPct, gradedCeiling, ceilingMissBy
                    ));
                    if (slot) {
                        if (gradedTip !== "PUSH") {
                            tally("flagship_5pack", gradedTip);
                            if (slot.includes("MÉNAGE")) tally("menage_a_trois", gradedTip);
                        }
                        const wkObj = ensureWeekFivePackBucket(weekLabel);
                        if (gradedTip !== "PUSH") {
                            tallyObj(wkObj, gradedTip);
                            if (slot.includes("MÉNAGE")) tallyObj(wkObj.menage, gradedTip);
                        }
                        wkObj.rows.push(rowHTML);
                        vaultRows.flagship_5pack.push({ weekLabel, rowHTML });
                    }
                    if (ledgerTier === "SMASH") {
                        if (gradedTip !== "PUSH") {
                            tally("overall_smash", gradedTip);
                            tally(isSpread ? "spread_smash" : "total_smash", gradedTip);
                        }
                        if (gradedFloor && gradedFloor !== "PUSH") tally("smash_key_exec", gradedFloor);
                        vaultRows.overall_smash.push(rowHTML);
                    } else if (ledgerTier === "TOO_CLOSE") {
                        if (gradedTip !== "PUSH") tally("all_tease", gradedTip);
                        vaultRows.all_tease.push(rowHTML);
                    }
                } else {
                    upcomingRowsHTML += rowHTML;
                }
            });
    });

    // 2. Current-Week Active / In-Play Slate Rows
    AppState.processedGames.filter(g => g.isCurrentWeek).forEach(g => {
        const weekLabel = g.weekLabel || activeWeekLabel;
        if (!matchesSelectedScope(weekLabel)) return;
        const currKey = `${g.league}_${g.matchup}_${weekLabel}`;
        if (renderedMatchups.has(currKey)) return;
        if (!isRankedLedgerEntry(g.matchup, g.league)) return;
        renderedMatchups.add(currKey);

        const espnMatch = getEspnScoreMatch(g.league, g.matchup, g.awayFullName, g.homeFullName);
        const kickedOff = g.commenceTime ? (new Date(g.commenceTime).getTime() <= Date.now()) : false;
        const isFinal = Boolean(espnMatch && espnMatch.state === "post");
        const isLocked = isFinal || kickedOff || Boolean(espnMatch && espnMatch.state === "in");
        const statusLabel = isFinal
            ? `<span style="color:var(--emerald); font-weight:700;">FINAL (${espnMatch.scoreStr})</span>`
            : (isLocked
                ? `<span style="color:var(--gold); font-weight:700;">🔒 IN-PLAY (${espnMatch ? espnMatch.scoreStr : "LOCKED"})</span>`
                : `<span style="color:var(--text-3);">${g.kickoffShort}</span>`);

        const gSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread").sort((a, b) => b.tipEvPct - a.tipEvPct);
        const gTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "total");
        [gSpreads[0], gTotals[0]].filter(Boolean).forEach(p => {
            const isSpread = p.marketType === "spread";
            const ledgerTier = p.gatekeeperBlocked ? "PASS" : getTierFromEv(p.tipEvPct);
            const fmtTip = isSpread ? fmtSigned(p.tipProjectedMean, 1) : Number(p.tipProjectedMean).toFixed(1);
            const fmtBd = isSpread ? fmtSigned(p.bdProjectedMean, 1) : Number(p.bdProjectedMean).toFixed(1);
            let gradedTip = "PENDING", missBy = 0;
            if (isFinal && espnMatch) {
                const res = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.baseLine, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalByDirection(p.tipProjectedMean < p.baseLine ? "U" : "O", p.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                gradedTip = res.outcome; missBy = res.missBy;
            }
            upcomingRowsHTML += buildStandardRow(
                g.gameId, weekLabel, g.matchup, statusLabel, isSpread ? "SPREAD" : "TOTAL", p.flagshipSlot,
                p.shortTitle, ledgerTier, p.baseLine, p.baseOdds, getTierColor(ledgerTier),
                fmtTip, p.tipModelPct.toFixed(1), p.tipEvPct.toFixed(1),
                getTierColor(getTierFromEv(p.bdEvPct)), fmtBd, p.bdModelPct.toFixed(1), p.bdEvPct.toFixed(1),
                p.safeFloorLabel, p.safeFloorWinPct, p.bdAltLabel, p.bdAltEvPct, gradedTip, missBy
            );
        });
    });

    const fmtBucketObj = (b) => {
        if (!b || !b.total) return "0W - 0L - 0BB (0.0%)";
        const pct = ((b.hits / b.total) * 100).toFixed(1);
        return `${b.hits}W - ${b.misses}L - <span style="color:var(--blue);">${b.blueBalls}BB</span> (${pct}%)`;
    };
    const fmtBucket = (k) => fmtBucketObj(buckets[k]);

    const fivePackWeeks = Object.keys(fivePackByWeek).sort((a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0));
    if (AppState.selectedFivePackWeek !== "ALL" && !fivePackByWeek[AppState.selectedFivePackWeek]) AppState.selectedFivePackWeek = "ALL";
    const activeFpBucket = AppState.selectedFivePackWeek === "ALL" ? buckets.flagship_5pack : fivePackByWeek[AppState.selectedFivePackWeek];
    const activeMenageBucket = AppState.selectedFivePackWeek === "ALL" ? buckets.menage_a_trois : fivePackByWeek[AppState.selectedFivePackWeek].menage;

    const porkysWeeks = Object.keys(porkysByWeek).sort((a, b) => (parseInt(b.replace(/\D/g, ""), 10) || 0) - (parseInt(a.replace(/\D/g, ""), 10) || 0));
    if (AppState.selectedPorkysWeek !== "ALL" && !porkysByWeek[AppState.selectedPorkysWeek]) AppState.selectedPorkysWeek = "ALL";
    const activePorkysCore = AppState.selectedPorkysWeek === "ALL" ? buckets.porkys_core3 : porkysByWeek[AppState.selectedPorkysWeek].core3;
    const activePorkysFlex = AppState.selectedPorkysWeek === "ALL" ? buckets.porkys_flex2 : porkysByWeek[AppState.selectedPorkysWeek].flex2;

    const fpWeekSelect = `
        <select class="search-select" style="padding:2px 6px; font-size:10.5px;" onchange="window.setFivePackVaultWeek(this.value, event)" onclick="event.stopPropagation()">
            <option value="ALL" ${AppState.selectedFivePackWeek === "ALL" ? "selected" : ""}>All (${buckets.flagship_5pack.hits}/${buckets.flagship_5pack.total})</option>
            ${fivePackWeeks.map(wk => `<option value="${wk}" ${AppState.selectedFivePackWeek === wk ? "selected" : ""}>${wk} (${fivePackByWeek[wk].hits}/${fivePackByWeek[wk].total})</option>`).join("")}
        </select>
    `;
    const porkyWeekSelect = `
        <select class="search-select" style="padding:2px 6px; font-size:10.5px;" onchange="window.setPorkysVaultWeek(this.value, event)" onclick="event.stopPropagation()">
            <option value="ALL" ${AppState.selectedPorkysWeek === "ALL" ? "selected" : ""}>All (${buckets.porkys_5pack.hits}/${buckets.porkys_5pack.total})</option>
            ${porkysWeeks.map(wk => `<option value="${wk}" ${AppState.selectedPorkysWeek === wk ? "selected" : ""}>${wk} (${porkysByWeek[wk].hits}/${porkysByWeek[wk].total})</option>`).join("")}
        </select>
    `;

    const isPorkysCard = (AppState.ledgerFivePackView === "porkys");
    const teasePct = buckets.all_tease.total > 0 ? ((buckets.all_tease.hits / buckets.all_tease.total) * 100) : 0;
    const tipPct = buckets.tip_all.total > 0 ? ((buckets.tip_all.hits / buckets.tip_all.total) * 100) : 0;
    const floorPct = buckets.safe_floors.total > 0 ? ((buckets.safe_floors.hits / buckets.safe_floors.total) * 100) : 0;
    const execLift = Number((floorPct - tipPct).toFixed(1));
    const nDodged = buckets.champagne_room.dodged || 0;

    // Active Vault Drawer
    let activeVaultHTML = "";
    if (AppState.activeLedgerVault) {
        let title = "", rowsHTML = "";
        let colsHead = `<tr><th>Week &amp; Final</th><th>Market</th><th>Official Pick</th><th>Vegas</th><th>Tip Closing</th><th>Balls Deep</th><th>Result</th></tr>`;

        if (AppState.activeLedgerVault === "flagship_5pack") {
            title = `👑 FLAGSHIP 5-PACK VAULT (${AppState.selectedFivePackWeek})`;
            rowsHTML = vaultRows.flagship_5pack.filter(x => AppState.selectedFivePackWeek === "ALL" || x.weekLabel === AppState.selectedFivePackWeek).map(x => x.rowHTML).join("");
        } else if (AppState.activeLedgerVault === "porkys_5pack") {
            title = `🐷 PORKY'S 5-PACK FADES VAULT (${AppState.selectedPorkysWeek})`;
            colsHead = `<tr><th>Week &amp; Final</th><th>Slot</th><th>🚫 Public Trap</th><th>🛡️ Safe Floor Fade</th><th>Floor Result</th><th>Straight Fade</th></tr>`;
            rowsHTML = vaultRows.porkys_5pack.filter(x => AppState.selectedPorkysWeek === "ALL" || x.weekLabel === AppState.selectedPorkysWeek).map(x => x.rowHTML).join("");
        } else if (AppState.activeLedgerVault === "overall_smash") {
            title = `🔥 OFFICIAL SMASH VAULT (≥+10.0% EV)`;
            rowsHTML = vaultRows.overall_smash.join("");
        } else if (AppState.activeLedgerVault === "all_tease") {
            title = `🔵 ALL TEASE, NO SQUEEZE (NO-BET QUARANTINE)`;
            rowsHTML = vaultRows.all_tease.join("");
        } else if (AppState.activeLedgerVault === "grenades_dodged") {
            title = `💣 GRENADES DODGED VAULT (≤-19.0% EV TRAPS AVOIDED)`;
            rowsHTML = vaultRows.grenades_dodged.join("");
        } else if (AppState.activeLedgerVault === "floors_ceilings") {
            title = `🔑 2-KEY ALTS, WONG TEASERS & CEILINGS (+φ)`;
            colsHead = `<tr><th>Week &amp; Final</th><th>Market</th><th>Base Pick</th><th>🔑 2-Key / Safe Floor</th><th>Floor Result</th><th>🎯 Ceiling (+φ)</th><th>Ceiling Result</th></tr>`;
            rowsHTML = vaultRows.floors_ceilings.join("");
        } else if (AppState.activeLedgerVault === "tip_vs_bd") {
            title = `⚡ TIP RAW vs. BALLS DEEP MASTER ARCHIVE`;
            rowsHTML = vaultRows.tip_vs_bd.join("");
        } else if (AppState.activeLedgerVault === "ml_winners") {
            title = `🏆 STRAIGHT-UP ML WINNERS & OUTRIGHT DOG UPSETS VAULT`;
            colsHead = `<tr><th>Week &amp; Final</th><th>Spot</th><th>Projected ML Winner</th><th>ML Price</th><th>Model Win %</th><th>Result</th></tr>`;
            rowsHTML = vaultRows.ml_winners.join("");
        }

        activeVaultHTML = `
            <div class="vault-drawer">
                <div class="vault-drawer-head">
                    <span class="mono" style="font-size:12px; font-weight:800; color:var(--text-1);">${title}</span>
                    <button type="button" class="chip" style="padding:3px 9px; font-size:11px;" onclick="window.toggleLedgerVault('${AppState.activeLedgerVault}', event)">Close ▲</button>
                </div>
                <div class="table-box" style="border:none; border-radius:0;">
                    <table class="pf-table">
                        <thead>${colsHead}</thead>
                        <tbody>${rowsHTML || `<tr><td colspan="7" style="text-align:center; color:var(--text-2); padding:18px;">Completed games move into this vault automatically once FINAL.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    const allLedgerWeeks = Array.from(new Set(
        Object.values(entriesMap).map(e => inferFootballWeekLabel(e, activeWeekLabel)).filter(Boolean)
    )).sort((a, b) => parseWeekNum(b) - parseWeekNum(a));
    const prodWeeks = allLedgerWeeks.filter(wk => parseWeekNum(wk) >= PROD_ENGINE_MIN_WEEK && wk !== activeWeekLabel);
    const betaWeeks = allLedgerWeeks.filter(wk => parseWeekNum(wk) > 0 && parseWeekNum(wk) < PROD_ENGINE_MIN_WEEK);

    const filterRowHTML = (rawStr) => {
        if (!rawStr) return false;
        const txt = rawStr.toLowerCase();
        if (AppState.ledgerOutcomeFilter === "HIT" && !txt.includes("✅ hit") && !txt.includes("✅ win") && !txt.includes("💣 dodged")) return false;
        if (AppState.ledgerOutcomeFilter === "BLUE_BALLS" && !txt.includes("🔵 bb")) return false;
        if (AppState.ledgerOutcomeFilter === "MISS" && !txt.includes("❌ miss") && !txt.includes("❌ loss")) return false;
        if (AppState.ledgerMarketFilter === "SPREAD" && !txt.includes("spread")) return false;
        if (AppState.ledgerMarketFilter === "TOTAL" && !txt.includes("total")) return false;
        if (AppState.ledgerMarketFilter === "ML" && !txt.includes(" ml")) return false;
        if (AppState.ledgerSearchQuery && !txt.includes(AppState.ledgerSearchQuery)) return false;
        return true;
    };

    if (activeVaultHTML && (AppState.ledgerOutcomeFilter !== "ALL" || AppState.ledgerMarketFilter !== "ALL" || AppState.ledgerSearchQuery)) {
        const bodyMatch = activeVaultHTML.match(/<tbody>([\s\S]*?)<\/tbody>/);
        if (bodyMatch) {
            const trs = bodyMatch[1].match(/<tr[\s\S]*?<\/tr>/g) || [];
            const kept = trs.filter(filterRowHTML);
            const replacement = kept.length > 0
                ? kept.join("")
                : `<tr><td colspan="7" style="text-align:center; color:var(--text-2); padding:18px;">No graded receipts match the active Ledger filters.</td></tr>`;
            activeVaultHTML = activeVaultHTML.replace(bodyMatch[1], replacement);
        }
    }

    const fmtPctShort = (b) => b && b.total ? `${b.hits}/${b.total} (${((b.hits / b.total) * 100).toFixed(1)}%)` : "0/0 (0.0%)";
    const prodOverallStripHTML = `
        <div class="engine-overall-strip ${selectedScope === "PROD_OVERALL" ? "active" : ""}" onclick="window.toggleProdOverallStrip()" title="Click to toggle all 7 Vault Cards between Active Week (${activeWeekLabel}) and Production Engine Overall (W${PROD_ENGINE_MIN_WEEK}+)">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge b-smash">⚡ PRODUCTION ENGINE OVERALL (W${PROD_ENGINE_MIN_WEEK}+)</span>
                <span class="mono" style="font-size:11px; color:var(--text-2);">${selectedScope === "PROD_OVERALL" ? "Viewing Full W13+ · Click for Active Week" : `Viewing ${selectedScope === "CURRENT" ? activeWeekLabel : selectedScope} · Click for W13+ Overall`}</span>
            </div>
            <div class="eos-metrics">
                <span class="eos-pill"><span style="color:var(--text-3);">Spread</span> <strong style="color:var(--text-1);">${fmtPctShort(prodOverall.spread)}</strong></span>
                <span class="eos-pill"><span style="color:var(--cyan);">2-Key Alt</span> <strong style="color:var(--cyan);">${fmtPctShort(prodOverall.keyAlt)}</strong></span>
                <span class="eos-pill"><span style="color:var(--text-3);">Totals</span> <strong style="color:var(--emerald);">${fmtPctShort(prodOverall.total)}</strong></span>
                <span class="eos-pill"><span style="color:var(--cyan);">Safe O/U</span> <strong style="color:var(--cyan);">${fmtPctShort(prodOverall.safeTotal)}</strong></span>
                <span class="eos-pill"><span style="color:var(--gold);">ML</span> <strong style="color:var(--gold);">${fmtPctShort(prodOverall.ml)}</strong></span>
            </div>
        </div>
    `;

    const ledgerFilterBarHTML = `
        <div class="ledger-filter-bar">
            <div class="chip-group">
                <select class="search-select" onchange="window.setLedgerWeekFilter(this.value)">
                    <option value="CURRENT" ${selectedScope === "CURRENT" ? "selected" : ""}>${activeWeekLabel} (Active Week)</option>
                    <option value="PROD_OVERALL" ${selectedScope === "PROD_OVERALL" ? "selected" : ""}>Production Engine Overall (W${PROD_ENGINE_MIN_WEEK}+)</option>
                    ${prodWeeks.map(wk => `<option value="${wk}" ${selectedScope === wk ? "selected" : ""}>${wk}</option>`).join("")}
                    <option value="LEGACY_BETA" ${selectedScope === "LEGACY_BETA" ? "selected" : ""}>Legacy Beta Archive (W10–W12)</option>
                    <option value="ALL_TIME" ${selectedScope === "ALL_TIME" ? "selected" : ""}>All-Time (Incl. Beta)</option>
                    ${betaWeeks.map(wk => `<option value="${wk}" ${selectedScope === wk ? "selected" : ""}>${wk} (Beta)</option>`).join("")}
                </select>
                <span class="chip-divider"></span>
                <button type="button" class="chip ${AppState.ledgerOutcomeFilter === "ALL" ? "active" : ""}" onclick="window.setLedgerOutcomeFilter('ALL')">All Outcomes</button>
                <button type="button" class="chip ${AppState.ledgerOutcomeFilter === "HIT" ? "active-smash" : ""}" onclick="window.setLedgerOutcomeFilter('HIT')">✅ Hits</button>
                <button type="button" class="chip ${AppState.ledgerOutcomeFilter === "BLUE_BALLS" ? "active-weather" : ""}" onclick="window.setLedgerOutcomeFilter('BLUE_BALLS')">🔵 Blue Balls</button>
                <button type="button" class="chip ${AppState.ledgerOutcomeFilter === "MISS" ? "active-red" : ""}" onclick="window.setLedgerOutcomeFilter('MISS')">❌ Misses</button>
            </div>
            <div class="chip-group">
                <button type="button" class="chip ${AppState.ledgerMarketFilter === "ALL" ? "active" : ""}" onclick="window.setLedgerMarketFilter('ALL')">All Markets</button>
                <button type="button" class="chip ${AppState.ledgerMarketFilter === "SPREAD" ? "active" : ""}" onclick="window.setLedgerMarketFilter('SPREAD')">Spread</button>
                <button type="button" class="chip ${AppState.ledgerMarketFilter === "TOTAL" ? "active" : ""}" onclick="window.setLedgerMarketFilter('TOTAL')">Total</button>
                <button type="button" class="chip ${AppState.ledgerMarketFilter === "ML" ? "active" : ""}" onclick="window.setLedgerMarketFilter('ML')">ML</button>
                <input type="text" class="search-input" placeholder="Filter team..." value="${AppState.ledgerSearchQuery || ""}" oninput="window.setLedgerSearchQuery(this.value)" />
            </div>
        </div>
    `;

    container.innerHTML = `
        ${prodOverallStripHTML}
        ${ledgerFilterBarHTML}
        <div class="vault-grid">
            <div class="vault-tile ${AppState.activeLedgerVault === (isPorkysCard ? "porkys_5pack" : "flagship_5pack") ? "active" : ""}" onclick="window.toggleLedgerVault('${isPorkysCard ? "porkys_5pack" : "flagship_5pack"}', event)">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <span class="mono" style="font-size:10.5px; font-weight:800; color:${isPorkysCard ? "var(--red)" : "var(--gold)"};">${isPorkysCard ? "🐷 PORKY'S 5-PACK" : "👑 FLAGSHIP 5-PACK"}</span>
                    <button type="button" class="chip" style="padding:2px 7px; font-size:10px;" onclick="window.toggleLedgerFivePackView(event)">${isPorkysCard ? "👑 Flagship" : "🐷 Porky's"}</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:8px;">
                    <span class="mono" style="font-size:13.5px; font-weight:800;">${isPorkysCard ? `Core 3: ${fmtBucketObj(activePorkysCore)}` : fmtBucketObj(activeFpBucket)}</span>
                    ${isPorkysCard ? porkyWeekSelect : fpWeekSelect}
                </div>
                <div style="font-size:11px; color:var(--text-2); margin-top:4px;">
                    ${isPorkysCard ? `Flex 2: <strong>${fmtBucketObj(activePorkysFlex)}</strong>` : `Ménage à Trois: <strong>${fmtBucketObj(activeMenageBucket)}</strong>`}
                </div>
            </div>

            <div class="vault-tile ${AppState.activeLedgerVault === "overall_smash" ? "active" : ""}" onclick="window.toggleLedgerVault('overall_smash', event)">
                <div class="mono" style="font-size:10.5px; font-weight:800; color:var(--emerald);">🔥 OFFICIAL SMASH (&ge;+10.0% EV)</div>
                <div class="mono" style="font-size:14px; font-weight:800; margin:7px 0 4px 0;">${showBallsDeep ? `Key Exec: ${fmtBucket("smash_key_exec")}` : `Raw -110: ${fmtBucket("overall_smash")}`}</div>
                <div style="font-size:11px; color:var(--text-2);">
                    Spreads: <strong>${fmtBucket("spread_smash")}</strong> · Totals: <strong>${fmtBucket("total_smash")}</strong>
                </div>
            </div>

            <div class="vault-tile ${AppState.activeLedgerVault === "all_tease" ? "active" : ""}" onclick="window.toggleLedgerVault('all_tease', event)">
                <div class="mono" style="font-size:10.5px; font-weight:800; color:var(--blue);">🔵 ALL TEASE, NO SQUEEZE</div>
                <div class="mono" style="font-size:15px; font-weight:800; margin:7px 0 4px 0;">${buckets.all_tease.total} Coin-Flips Skipped</div>
                <div style="font-size:11px; color:var(--text-2);">Skipped Raw: ${teasePct.toFixed(1)}% (${teasePct < 52.4 ? "Below 52.4% BE — Good Skip" : "Tight Buffer"})</div>
            </div>

            <div class="vault-tile ${AppState.activeLedgerVault === "grenades_dodged" ? "active" : ""}" onclick="window.toggleLedgerVault('grenades_dodged', event)">
                <div class="mono" style="font-size:10.5px; font-weight:800; color:var(--red);">💣 GRENADES DODGED (&le;-19% EV)</div>
                <div class="mono" style="font-size:16px; font-weight:800; margin:7px 0 4px 0; color:var(--emerald);">${nDodged} Grenade${nDodged === 1 ? "" : "s"} Dodged</div>
                <div style="font-size:11px; color:var(--text-2);">Public traps stamped PASS that failed to cover</div>
            </div>

            <div class="vault-tile ${AppState.activeLedgerVault === "floors_ceilings" ? "active" : ""}" onclick="window.toggleLedgerVault('floors_ceilings', event)">
                <div class="mono" style="font-size:10.5px; font-weight:800; color:var(--cyan);">🔑 2-KEY ALTS &amp; WONG TEASERS</div>
                ${showBallsDeep
                    ? `<div class="mono" style="font-size:13.5px; font-weight:800; margin:7px 0 4px 0; color:var(--cyan);">2-Key / Safe: ${fmtBucket("safe_floors")}</div>
                       <div style="font-size:11px; color:var(--text-2);">Wong: <strong>${fmtBucket("wong_teasers")}</strong> · Ceilings: <strong>${fmtBucket("ceilings")}</strong></div>`
                    : `<div class="mono" style="font-size:14px; font-weight:800; margin:7px 0 4px 0; color:var(--gold);">🔒 Balls Deep Locked</div>
                       <div style="font-size:11px; color:var(--text-2);">Click to unlock 2-Key Alt &amp; Wong Teaser receipts</div>`
                }
            </div>

            <div class="vault-tile ${AppState.activeLedgerVault === "tip_vs_bd" ? "active" : ""}" onclick="window.toggleLedgerVault('tip_vs_bd', event)">
                <div class="mono" style="font-size:10.5px; font-weight:800; color:var(--emerald);">⚡ TIP RAW vs. BALLS DEEP LIFT</div>
                <div class="mono" style="font-size:13.5px; font-weight:800; margin:7px 0 4px 0;">Tip (-110): ${fmtBucket("tip_all")}</div>
                ${showBallsDeep
                    ? `<div style="font-size:11.5px; color:var(--emerald); font-weight:700;">BD Exec Lift: ${execLift >= 0 ? "+" : ""}${execLift}% (${floorPct.toFixed(1)}% vs ${tipPct.toFixed(1)}%)</div>`
                    : `<div style="font-size:11px; color:var(--gold);">🔒 Click to unlock Balls Deep Execution Lift</div>`
                }
            </div>

            <div class="vault-tile ${AppState.activeLedgerVault === "ml_winners" ? "active" : ""}" onclick="window.toggleLedgerVault('ml_winners', event)">
                <div class="mono" style="font-size:10.5px; font-weight:800; color:var(--gold);">🏆 ML WINNERS &amp; UPSETS</div>
                <div class="mono" style="font-size:14px; font-weight:800; margin:7px 0 4px 0; color:var(--emerald);">
                    ${buckets.ml_winners.total ? `${buckets.ml_winners.hits}W - ${buckets.ml_winners.misses}L (${((buckets.ml_winners.hits / buckets.ml_winners.total) * 100).toFixed(1)}%)` : "0W - 0L (0.0%)"}
                </div>
                <div style="font-size:11px; color:var(--text-2);">
                    ${showBallsDeep
                        ? `🐶 Dog Upsets Called: <strong style="color:var(--gold);">${buckets.ml_upsets.hits}W - ${buckets.ml_upsets.misses}L</strong>`
                        : `Straight-Up Record · ${renderLockSpanHTML("🔒 Dog Upsets")}`
                    }
                </div>
            </div>
        </div>

        ${activeVaultHTML}

        <div class="section-head" style="margin-top:8px;">
            <span class="mono" style="font-size:12px; font-weight:800; color:var(--text-1);">🕒 ACTIVE WEEK // UPCOMING &amp; IN-PLAY CLOSING LINES</span>
            <button type="button" class="chip" style="font-size:11px;" onclick="window.toggleLedgerAllCompleted(event)">
                ${AppState.ledgerShowAllCompleted ? "📋 Showing ALL FBS + NFL" : "🏆 Top-25 NCAA + NFL Only"}
            </button>
        </div>

        <div class="table-box">
            <table class="pf-table">
                <thead>
                    <tr>
                        <th>Matchup &amp; Status</th><th>Market</th><th>Official Pick</th><th>Vegas</th><th>Tip Closing</th><th>Balls Deep</th><th>Result</th>
                    </tr>
                </thead>
                <tbody>
                    ${upcomingRowsHTML || `<tr><td colspan="7" style="text-align:center; color:var(--text-2); padding:18px;">No upcoming current-week closing lines pending.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================
// SLIM LIVE WIRE BOTTOM TICKER
// ==========================================
function renderLiveBottomTicker() {
    const track = document.getElementById("dixpix-live-wire-track");
    if (!track) return;

    const tickerItems = [
        `<span style="color:var(--emerald); font-weight:800;">🟢 FINAL: LAC 23 - BAL 20</span> <span style="color:var(--text-1);">[BAL +6.5 ✅ HIT (+27.6% EV) · O 44.5 🔵 BB (-1.5)]</span>`
    ];

    AppState.processedGames.filter(g => g.isCurrentWeek).forEach(g => {
        const espnMatch = getEspnScoreMatch(g.league, g.matchup, g.awayFullName, g.homeFullName);
        const topSpread = AppState.processedProps
            .filter(p => p.gameId === g.gameId && p.marketType === "spread")
            .sort((a, b) => b.tipEvPct - a.tipEvPct)[0];
        if (!topSpread) return;

        const pickTag = `${topSpread.shortTitle} (${topSpread.tipEvPct > 0 ? "+" : ""}${topSpread.tipEvPct.toFixed(1)}% EV)`;
        const tierCol = getTierColor(topSpread.tipBadge);

        if (espnMatch && espnMatch.state === "in") {
            tickerItems.push(`<span style="color:var(--red); font-weight:800;">🔴 LIVE (${espnMatch.shortDetail || "IN-PLAY"}): ${espnMatch.scoreStr}</span> <span style="color:${tierCol};">[${pickTag}]</span>`);
        } else if (espnMatch && espnMatch.state === "post") {
            tickerItems.push(`<span style="color:var(--emerald); font-weight:800;">🟢 FINAL: ${espnMatch.scoreStr}</span> <span style="color:${tierCol};">[${pickTag}]</span>`);
        } else {
            const badgeStr = topSpread.tipBadge === "SMASH" ? "🔥 SMASH" : (topSpread.tipBadge === "PASS" ? "💣 PASS" : "⚖️ TEASE");
            tickerItems.push(`<span style="color:var(--cyan); font-weight:700;">${g.kickoffShort}: ${g.matchup}</span> <span style="color:${tierCol};">[${badgeStr}: ${pickTag}]</span>`);
        }
    });

    const sep = `<span style="color:var(--border-strong); margin:0 16px;">//</span>`;
    const joined = tickerItems.join(sep);
    const durSec = Math.max(20, Math.min(180, tickerItems.length * 10));
    track.style.animationDuration = `${durSec}s`;
    track.innerHTML = `<span>${joined}</span>${sep}<span>${joined}</span>`;
}
// === END OF APP_CONTROLLER.JS (v264) ===
