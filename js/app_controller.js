/**
 * DIXPIX QUANTITATIVE ENGINE — MASTER UI & COMBINATORICS CONTROLLER (v221)
 * - Added 6th Clickable Ledger Vault Card: "🛡️ SAFE FLOORS (-2φ) & 🎯 CEILINGS (+φ)" tracking Floor & Alt-Line Escalator hit rates
 * - Removed "Click card to view..." footer clutter from all 6 Ledger Cards for a tighter, cleaner card grid
 * - Auto-Sweeps FINAL games off Tab 1 Master Pick Board into Clickable Historical Ledger Card Vaults
 * - Flagship 5-Pack Week Dropdown ("Week X — Y/5") right on the 5-Pack Ledger Card to filter weekly 5-Pack receipts
 * - Updated Money Shot Decoder ("Covered the Vegas closing number, walked out, and left the money on the dresser.")
 * - Responsive Mobile & Desktop 5-Pack Header + Porky's Safe Floor Counter-Strike (-2φ at -175) + Grenades Dodged + 300s Live Wire Ticker
 */

const AppState = {
    rawPayload: null,
    lastDataHash: "",
    activeMode: "tip",                // "tip" | "balls_deep" | "davinci"
    fivePackView: "main_stage",       // "main_stage" | "porkys"
    activeLedgerVault: null,          // null | "flagship_5pack" | "overall_smash" | "all_tease" | "grenades_dodged" | "floors_ceilings" | "tip_vs_bd"
    selectedFivePackWeek: "ALL",      // "ALL" | "Week 10" | "Week 11" ...
    intensitySlider: 0.0,             // -3.236 (-2φ) to +3.236 (+2φ)
    filters: { nfl: true, ncaa: true },
    comboFilters: { team: "ALL", market: "ALL", tier: "ALL" },
    selectedParlayLegs: new Set(),
    safeFloorParlayLegs: new Set(),   // Tracks legs loaded at -2φ Safe Floor (-175) odds
    mnfCutoffMs: Infinity,
    processedGames: [],
    processedProps: [],
    flagshipFivePack: [],
    porkysFivePack: []
};

const openCardMemory = new Set();
const MODEL_TOTAL_INTERCEPT = 42.986;
const M9_HOME_INTERCEPT_OFFSET = 3.20;
const SMASH_EV_CUTOFF = 10.0;          // >= +10.0% EV threshold for SMASH
const PASS_EV_CUTOFF = -10.0;          // <= -10.0% EV threshold for definitive PASS
const PHI = 1.6180339887;
const PHI_OVER_PI = PHI / Math.PI;     // ~0.5150362 (Module 13 Sacred Geometry Constant)

// Official AP / CFP Top-25 Ranked NCAA Programs (Full-Name & Code Matchers)
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
    "UGA", "UTAH", "ND", "NODA", "UCLA", "UCBR", "MIA", "IND", "ALA", "TEX",
    "TENN", "WAKE", "WAFO", "BYU", "TTU", "UK", "KEWI", "HOU", "HOCO", "IOWA",
    "IOHA", "USC", "ORE", "MISS", "OSU", "LSU", "BSU", "SCAR", "ARI", "ARWI",
    "UNM", "SMU", "OKST"
]);

const CLEAN_CODE_OVERRIDES = {
    // Big 12
    "TCHO": "TCU",
    "KAJA": "KAN",
    "KAST": "KSU",
    "OKST": "OKST",
    "IOST": "ISU",
    "WEVI": "WVU",
    "BABE": "BAY",
    "TETE": "TTU",
    "BYCO": "BYU",
    "UTUT": "UTAH",
    "ARWI": "ARIZ",
    "ARST": "ASU",
    "COBU": "COLO",
    "UCKN": "UCF",
    "CIBE": "CIN",
    "HOCO": "HOU",

    // Big Ten
    "NECO": "NEB",
    "IOHA": "IOWA",
    "ILFI": "ILL",
    "NOWI": "NW",
    "WIBA": "WIS",
    "MIGO": "MINN",
    "PUBO": "PUR",
    "INHO": "IND",
    "OHST": "OSU",
    "MIWO": "MICH",
    "MIST": "MSU",
    "PEST": "PSU",
    "RUSC": "RUTG",
    "MATE": "MD",
    "ORDU": "ORE",
    "WAHU": "WASH",
    "USTR": "USC",
    "UCBR": "UCLA",

    // SEC
    "ALCR": "ALA",
    "GEBU": "UGA",
    "TELO": "TEX",
    "OKSO": "OU",
    "TEVO": "TENN",
    "OLMI": "MISS",
    "LSTI": "LSU",
    "TEA&": "TAMU",
    "TEAG": "TAMU",
    "MITI": "MIZZ",
    "KEWI": "UK",
    "SOCA": "SCAR",
    "FLGA": "FLA",
    "AUTI": "AUB",
    "ARRA": "ARK",
    "VACO": "VAN",

    // ACC & Independents
    "NODA": "ND",
    "MIHU": "MIA",
    "CLTI": "CLEM",
    "SMMU": "SMU",
    "PIPA": "PITT",
    "LOCA": "LOU",
    "GETE": "GT",
    "WAFO": "WAKE",
    "DUBL": "DUKE",
    "NOCA": "UNC",
    "NCST": "NCST",
    "VATE": "VT",
    "VICA": "UVA",
    "BOCO": "BC",
    "SYOR": "SYR",
    "FLST": "FSU",
    "CAGO": "CAL",
    "STCA": "STAN",
    "UCHU": "CONN",
    "UMMI": "MASS",

    // Mountain West, Pac-12, AAC, Sun Belt, MAC & FCS Opponents
    "WOTE": "WOF",
    "CHMO": "UTC",
    "NOIL": "NIU",
    "WYCO": "WYO",
    "NEME": "UNM",
    "BOST": "BSU",
    "UNRE": "UNLV",
    "COST": "CSU",
    "FRST": "FRES",
    "SADI": "SDSU",
    "SAJO": "SJSU",
    "AIFO": "AFA",
    "UTST": "USU",
    "NEWO": "NEV",
    "HARA": "HAW",
    "ORST": "ORST",
    "WAST": "WSU",
    "ARBL": "ARMY",
    "NAMI": "NAVY",
    "TUGR": "TULN",
    "METI": "MEM",
    "USBU": "USF",
    "EACA": "ECU",
    "UTRO": "UTSA",
    "LIBL": "LIB",
    "JAMA": "JMU",
    "APST": "APP",
    "COCH": "CCU",
    "GESO": "GASO",
    "GEST": "GAST",
    "MAHE": "MRSH",
    "WEKE": "WKU",
    "WACA": "WCU",
    "MEME": "MERC",
    "THCI": "CIT"
};

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

function getTierFromEv(evPct) {
    const ev = Number(evPct);
    if (ev >= SMASH_EV_CUTOFF) return "SMASH";
    if (ev <= PASS_EV_CUTOFF) return "PASS";
    return "TOO_CLOSE"; // -9.99% to +9.99% EV
}

function getTierColor(tierBadge, useHex = false) {
    if (tierBadge === "SMASH") return useHex ? "#22c55e" : "var(--accent-emerald)";
    if (tierBadge === "PASS") return useHex ? "#ef4444" : "var(--accent-danger)";
    return useHex ? "#94a3b8" : "var(--text-secondary)"; // Neutral slate for TOO_CLOSE
}

function renderTierBadgeHTML(tierBadge) {
    if (tierBadge === "SMASH") {
        return `<span class="badge-smash">SMASH</span>`;
    }
    if (tierBadge === "PASS") {
        return `<span class="badge-pass" style="background: rgba(239, 68, 68, 0.16); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.45); font-weight: 800;">PASS</span>`;
    }
    return "";
}

function isRankedNCAAGame(game) {
    const hFull = game.home_full_name || "";
    const aFull = game.away_full_name || "";
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

// Calculates Tuesday 5:00 AM cutoff right after Monday Night Football for the active week
function computeUpcomingMnfCutoffMs(gamesList) {
    const validTimes = (gamesList || [])
        .map(g => g.commence_time || g.commenceTime)
        .filter(Boolean)
        .map(t => new Date(t).getTime())
        .filter(ms => !isNaN(ms));

    const anchorMs = validTimes.length > 0 ? Math.min(...validTimes) : Date.now();
    const anchorDate = new Date(anchorMs);
    const day = anchorDate.getDay();
    const daysUntilTueAfterMnf = (day === 2) ? 7 : ((9 - day) % 7 || 7);

    const cutoffDate = new Date(anchorDate);
    cutoffDate.setDate(anchorDate.getDate() + daysUntilTueAfterMnf);
    cutoffDate.setHours(5, 0, 0, 0);
    return cutoffDate.getTime();
}

function isGameInCurrentWeek(commenceTimeStr, cutoffMs) {
    if (!commenceTimeStr) return true;
    const ms = new Date(commenceTimeStr).getTime();
    if (isNaN(ms)) return true;
    return ms <= cutoffMs;
}

// Infers football Week label (e.g., "Week 10", "Week 11") from timestamp or entry metadata
function inferFootballWeekLabel(entryOrGame, fallbackLabel = "Week 10") {
    if (!entryOrGame) return fallbackLabel;
    if (entryOrGame.week_label) return entryOrGame.week_label;
    if (entryOrGame.week) return `Week ${entryOrGame.week}`;
    const timeStr = entryOrGame.commence_time || entryOrGame.commenceTime || entryOrGame.timestamp;
    if (timeStr) {
        const ms = new Date(timeStr).getTime();
        if (!isNaN(ms)) {
            const week1StartMs = new Date("2026-09-02T00:00:00Z").getTime();
            const diffDays = Math.floor((ms - week1StartMs) / (1000 * 60 * 60 * 24));
            const weekNum = Math.max(1, Math.min(18, Math.floor(diffDays / 7) + 1));
            return `Week ${weekNum}`;
        }
    }
    return fallbackLabel;
}

// Checks if a game on Tab 1 has already finished (FINAL) so it can be swept into the Ledger vaults
function isGameCompletedFinal(game) {
    if (!game) return false;
    if (game.status === "FINAL") return true;
    const cleanHome = cleanTeamCode(game.home_team || game.homeTeam || "");
    const cleanAway = cleanTeamCode(game.away_team || game.awayTeam || "");
    const matchupKey = game.matchup || `${cleanAway} @ ${cleanHome}`;
    const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[matchupKey];
    if (espnMatch && espnMatch.state === "post") return true;
    return false;
}

document.addEventListener("DOMContentLoaded", () => {
    ensureTickerStylesInjected();
    bindUIControls();
    pollDataFeed();
    setInterval(pollDataFeed, 5000);
    window.addEventListener("resize", () => {
        if (AppState.rawPayload) render_game_cards(AppState.rawPayload);
    });
});

window.unlockBallsDeepMode = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const bdRadio = document.getElementById("mode-balls-deep");
    if (bdRadio) {
        bdRadio.checked = true;
    }
    AppState.activeMode = "balls_deep";
    recalculateAndRenderAll();
};

// Pinned Corner Toggle between Main Stage 5-Pack and "Wednesday Night at Porky's" Top 5 Safe Floor Fades
window.toggleFivePackView = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const savedY = window.scrollY;
    AppState.fivePackView = (AppState.fivePackView === "main_stage") ? "porkys" : "main_stage";
    openCardMemory.add("FLAGSHIP_5_PACK_DRAWER");
    renderFlagshipFivePack();
    window.scrollTo(window.scrollX, savedY);
};

// Toggles the 6 Clickable Historical Ledger Vault Cards open/closed
window.toggleLedgerVault = function(vaultKey, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const savedY = window.scrollY;
    AppState.activeLedgerVault = (AppState.activeLedgerVault === vaultKey) ? null : vaultKey;
    renderHistoricalLedger();
    window.scrollTo(window.scrollX, savedY);
};

// Changes the Selected Week inside the Flagship 5-Pack Ledger Card Dropdown and opens the 5-Pack Vault
window.setFivePackVaultWeek = function(weekVal, event) {
    if (event) {
        event.stopPropagation();
    }
    const savedY = window.scrollY;
    AppState.selectedFivePackWeek = weekVal || "ALL";
    AppState.activeLedgerVault = "flagship_5pack";
    renderHistoricalLedger();
    window.scrollTo(window.scrollX, savedY);
};

window.toggleLegendDrawer = function(memoryKey, targetRenderFnName, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const savedY = window.scrollY;
    if (openCardMemory.has(memoryKey)) {
        openCardMemory.delete(memoryKey);
    } else {
        openCardMemory.add(memoryKey);
    }
    if (targetRenderFnName === "fivePack") {
        renderFlagshipFivePack();
    } else if (targetRenderFnName === "ledger") {
        renderHistoricalLedger();
    }
    window.scrollTo(window.scrollX, savedY);
};

window.toggleParlayLeg = function(propKey) {
    const savedY = window.scrollY;
    if (!AppState.safeFloorParlayLegs) AppState.safeFloorParlayLegs = new Set();
    if (AppState.selectedParlayLegs.has(propKey)) {
        AppState.selectedParlayLegs.delete(propKey);
        AppState.safeFloorParlayLegs.delete(propKey);
    } else {
        AppState.selectedParlayLegs.add(propKey);
    }
    renderCombinatoricsDeck();
    window.scrollTo(window.scrollX, savedY);
};

window.loadFlagshipPreset = function(onlyMenage = false) {
    const savedY = window.scrollY;
    if (!AppState.safeFloorParlayLegs) AppState.safeFloorParlayLegs = new Set();
    AppState.selectedParlayLegs.clear();
    AppState.safeFloorParlayLegs.clear();
    AppState.flagshipFivePack.forEach(p => {
        if (!onlyMenage || (p.flagshipSlot && p.flagshipSlot.includes("MÉNAGE"))) {
            AppState.selectedParlayLegs.add(p.propKey);
        }
    });
    renderCombinatoricsDeck();
    window.scrollTo(window.scrollX, savedY);
};

window.loadPorkysPreset = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const savedY = window.scrollY;
    if (!AppState.safeFloorParlayLegs) AppState.safeFloorParlayLegs = new Set();
    AppState.selectedParlayLegs.clear();
    AppState.safeFloorParlayLegs.clear();
    AppState.porkysFivePack.forEach(item => {
        if (item.fadeProp && item.fadeProp.propKey) {
            AppState.selectedParlayLegs.add(item.fadeProp.propKey);
            AppState.safeFloorParlayLegs.add(item.fadeProp.propKey);
        }
    });
    renderCombinatoricsDeck();
    window.scrollTo(window.scrollX, savedY);
};

window.clearParlaySlip = function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const savedY = window.scrollY;
    if (AppState.safeFloorParlayLegs) AppState.safeFloorParlayLegs.clear();
    AppState.selectedParlayLegs.clear();
    renderCombinatoricsDeck();
    window.scrollTo(window.scrollX, savedY);
};

window.setComboFilter = function(filterType, value) {
    const savedY = window.scrollY;
    AppState.comboFilters[filterType] = value;
    renderCombinatoricsDeck();
    window.scrollTo(window.scrollX, savedY);
};

function bindUIControls() {
    const modeRadios = {
        "mode-tip": "tip",
        "mode-balls-deep": "balls_deep",
        "mode-unsolicited": "balls_deep",
        "mode-davinci": "davinci"
    };

    Object.keys(modeRadios).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", (e) => {
                if (e.target.checked) {
                    AppState.activeMode = modeRadios[id];
                    recalculateAndRenderAll();
                }
            });
        }
    });

    document.addEventListener("input", (e) => {
        if (e.target && e.target.id === "davinci-intensity-slider") {
            const readout = document.getElementById("davinci-readout");
            const val = parseFloat(e.target.value) || 0.0;
            if (readout) readout.textContent = val > 0 ? "+" + val : val;
            AppState.intensitySlider = val;
            recalculateAndRenderAll();
        }
    });

    const nflCheck = document.getElementById("filter-nfl");
    const ncaaCheck = document.getElementById("filter-ncaa");
    if (nflCheck) {
        nflCheck.addEventListener("change", (e) => {
            AppState.filters.nfl = e.target.checked;
            recalculateAndRenderAll();
        });
    }
    if (ncaaCheck) {
        ncaaCheck.addEventListener("change", (e) => {
            AppState.filters.ncaa = e.target.checked;
            recalculateAndRenderAll();
        });
    }
}

async function pollDataFeed() {
    try {
        const response = await fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const textData = await response.text();
        if (textData !== AppState.lastDataHash) {
            AppState.lastDataHash = textData;
            AppState.rawPayload = JSON.parse(textData);
            recalculateAndRenderAll();
        }
    } catch (err) {
        console.warn("DixPix Polling Notice: Waiting for data.json feed...", err.message);
    }
}

// ==========================================
// 10-ZONE FIBONACCI ELEVATION & MODULE 13 SACRED GEOMETRY (COMPENDIUM SPEC)
// ==========================================
function calcTenZoneElevationPsi(elevMeters, airDensityRho) {
    const elevFeet = elevMeters * 3.28084;
    const fibZones = [
        { maxFt: 100, w: 0.1 },
        { maxFt: 200, w: 0.2 },
        { maxFt: 300, w: 0.3 },
        { maxFt: 500, w: 0.5 },
        { maxFt: 800, w: 0.8 },
        { maxFt: 1300, w: 1.3 },
        { maxFt: 2100, w: 2.1 },
        { maxFt: 3400, w: 3.4 },
        { maxFt: 5500, w: 5.5 },
        { maxFt: 99999, w: 8.9 }
    ];
    const zone = fibZones.find(z => elevFeet <= z.maxFt) || fibZones[fibZones.length - 1];
    const qAvgAscent = (0.382 + 0.618 + 1.618 + 1.618) / 4.0; // 1.059
    const pO2DropRatio = 1.0 - Math.exp(-elevMeters / 8500.0);
    const rhoShiftRatio = Math.abs(1.225 - airDensityRho) / 1.225;
    const omegaAtm = Math.max(0.04, (pO2DropRatio * 0.65) + (rhoShiftRatio * 0.35));
    return Number((zone.w * qAvgAscent * omegaAtm).toFixed(4));
}

// Compendium Module 13: Bidirectional Underdog Spoiler Lift (+M_rise,dog) & Inverse Favorite Trap Suppression (-M_rise,fav)
function calcSacredGeometryM13(homeTel, awayTel, m12NetTov, vegasHomeSpread) {
    const homeIsDog = vegasHomeSpread > 0;
    const dogTel = homeIsDog ? homeTel : awayTel;
    const favTel = homeIsDog ? awayTel : homeTel;

    const dogEpaResilience = (dogTel.net_epa_per_play || 0) - (favTel.net_epa_per_play || 0) + (Math.abs(vegasHomeSpread) * 0.012);
    const dogRankLift = (dogTel.closing_rank_pct || 0.5) - ((favTel.closing_rank_pct || 0.5) - 0.18);
    const tovForDog = homeIsDog ? (m12NetTov || 0) : -(m12NetTov || 0);

    const fibTierWeight = Math.abs(vegasHomeSpread) <= 7.5 ? 34.0 : 21.0;
    const deltaContext = Math.max(-1.618, Math.min(1.618, (dogEpaResilience * 3.2) + (dogRankLift * 1.4) + (tovForDog * 0.45)));
    const mRiseSignedForDog = PHI_OVER_PI * (fibTierWeight / 76.0) * deltaContext;

    const homeMarginShiftFactor = homeIsDog ? -mRiseSignedForDog : mRiseSignedForDog;
    return Number(homeMarginShiftFactor.toFixed(4));
}

function snapToHalfPointHook(lineVal, deltaPts) {
    const rawTarget = lineVal + deltaPts;
    return Math.floor(rawTarget) + 0.5;
}

// Clean bare lock icon (no border or background)
function renderLockCellHTML() {
    return `<span onclick="window.unlockBallsDeepMode(event)" title="Click to unlock Balls Deep Telemetry" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:15px; user-select:none;">🔒</span>`;
}

// ==========================================
// MASTER CALCULATION PIPELINE (STRICT COMPENDIUM M1-M9 vs M11-M13 FIREWALL)
// ==========================================
function recalculateAndRenderAll() {
    if (!AppState.rawPayload || !AppState.rawPayload.games) return;

    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;

    const defaultLeague = (AppState.rawPayload.slate_info && AppState.rawPayload.slate_info.league) || "NFL";
    const mode = AppState.activeMode;
    const sliderVal = (mode === "davinci") ? AppState.intensitySlider : 0.0;
    const playScaler = (typeof GOLDEN_PLAY_SCALER !== "undefined") ? GOLDEN_PLAY_SCALER : 38.5145;

    const eligibleGamesForCutoff = AppState.rawPayload.games.filter(g => shouldIncludeGame(g, defaultLeague));
    AppState.mnfCutoffMs = computeUpcomingMnfCutoffMs(eligibleGamesForCutoff);

    AppState.processedGames = [];
    AppState.processedProps = [];

    AppState.rawPayload.games.forEach(game => {
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

        const m11Bd = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, "balls_deep", 0.0);
        const m12Bd = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, "balls_deep", 0.0);
        const psiElev = calcTenZoneElevationPsi(envPayload.elevation_m || 0, m7.airDensityRho);
        const m13Rise = calcSacredGeometryM13(homeTel, awayTel, m12Bd.netTurnoverEPA, vegasHomeSpread);

        const m11 = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, mode, sliderVal);
        const m12 = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, mode, sliderVal);

        // =========================================================================
        // MODE 1: JUST THE TIP (I_flow = 0.000) — STRICTLY MODULES 1 THROUGH 9 ONLY
        // =========================================================================
        const rawM9Base = calcFullGameFairMargin(game, m8.phiCircadianPenalty, 0, "tip");
        const windMph = envPayload.is_dome ? 0 : (envPayload.wind_mph || 0);
        const windPenalty = Math.max(0, (windMph - 10.0) * 0.25);

        const actualCenteredM9 = rawM9Base.fairHomeSpread + M9_HOME_INTERCEPT_OFFSET;
        const marketImpliedM9 = Math.max(-9.5, Math.min(9.5, vegasHomeSpread * 0.42));
        const unpricedM9Residual = (actualCenteredM9 - marketImpliedM9) * 0.68;

        const rzMismatch = ((awayTel.opp_rz_dvoa || 0) - (homeTel.opp_rz_dvoa || 0)) * 9.5;
        const m8AwayFatigueShift = -((m8.circadianStrainIndex - 0.52) * 2.15);
        const m7WeatherCompression = (windPenalty > 0.4)
            ? (vegasHomeSpread < 0 ? Math.min(2.1, windPenalty * 0.85) : -Math.min(2.1, windPenalty * 0.85))
            : -(m7.passGameModifierYards * 0.14);

        let blowoutBackdoorDrag = 0;
        if (Math.abs(vegasHomeSpread) >= 24.0) {
            const excessPts = Math.abs(vegasHomeSpread) - 22.0;
            const dragMag = Math.min(4.2, 1.65 + (excessPts * 0.095));
            blowoutBackdoorDrag = (vegasHomeSpread < 0) ? dragMag : -dragMag;
        }

        const rawTipDelta = unpricedM9Residual + rzMismatch + m8AwayFatigueShift + m7WeatherCompression + blowoutBackdoorDrag;
        const boundedTipDelta = Math.max(-4.25, Math.min(4.25, rawTipDelta));
        const fairHomeTip = Number((vegasHomeSpread + boundedTipDelta).toFixed(2));

        const m9Base = {
            fairHomeSpread: fairHomeTip,
            epaContribution: rawM9Base.epaContribution,
            activeCoupledOverlay: 0
        };

        // =========================================================================
        // MODE 2 & 3: BALLS DEEP & DAVINCI — COUPLED M11, M12 & M13 OVERLAY (Ψ_11,12)
        // =========================================================================
        const tovVector = -(m12Bd.netTurnoverEPA || 0) * PHI * 0.85;
        const bioElevVector = -((m11Bd.phiBioScore + psiElev) - 0.018) * PHI * 1.45;
        const m13Vector = m13Rise * 9.2;
        const rawPsiBd = tovVector + bioElevVector + m13Vector;
        const psiBd = Number(Math.max(-3.65, Math.min(3.65, rawPsiBd)).toFixed(2));

        const psi11_12 = (mode === "tip")
            ? 0
            : Number((psiBd * (mode === "davinci" ? (1.0 + sliderVal * 0.5) : 1.0)).toFixed(2));

        const m9Bd = {
            fairHomeSpread: Number((fairHomeTip + psiBd).toFixed(2)),
            epaContribution: rawM9Base.epaContribution,
            activeCoupledOverlay: psiBd
        };
        const m9 = {
            fairHomeSpread: Number((fairHomeTip + psi11_12).toFixed(2)),
            epaContribution: rawM9Base.epaContribution,
            activeCoupledOverlay: psi11_12
        };

        const totalIntercept = (gameLeague === "NCAA") ? 51.450 : MODEL_TOTAL_INTERCEPT;
        const epaTotalPts = ((homeTel.net_epa_per_play || 0) + (awayTel.net_epa_per_play || 0)) * playScaler;
        const rzTotalPts = ((homeTel.opp_rz_dvoa || 0) + (awayTel.opp_rz_dvoa || 0)) * 10.0;
        const rawTelemetryTotal = totalIntercept + epaTotalPts + rzTotalPts - windPenalty;

        let baseTelemetryTotal = Number(rawTelemetryTotal.toFixed(1));
        if (gameLeague === "NCAA") {
            const envTotalShift = -windPenalty + (m7.passGameModifierYards * 0.25) + ((psiElev > 0.3 ? 1.8 : 0));
            const boundedTotalDelta = Math.max(-3.8, Math.min(3.8, ((rawTelemetryTotal - vegasTotalLine) * 0.22) + envTotalShift));
            baseTelemetryTotal = Number((vegasTotalLine + boundedTotalDelta).toFixed(1));
        }

        const gameRecord = {
            gameId: game.game_id,
            league: gameLeague,
            isCurrentWeek,
            weekLabel: inferFootballWeekLabel(game, "Week 11"),
            matchup: `${cleanAway} @ ${cleanHome}`,
            homeTeam: cleanHome,
            awayTeam: cleanAway,
            commenceTime: game.commence_time,
            elevationM: envPayload.elevation_m || 0,
            tempK: envPayload.temp_kelvin || 288.15,
            windMph,
            m7, m8, m9Base, m9Bd, m9, m11, m12,
            psiElev,
            m11CombinedDisplay: Number((m11.phiBioScore + psiElev).toFixed(4)),
            m13Rise: Number((-m13Rise).toFixed(4)),
            psiBd,
            psi11_12,
            baseTelemetryTotal
        };

        AppState.processedGames.push(gameRecord);

        if (Array.isArray(game.props_board)) {
            game.props_board.forEach((prop, idx) => {
                const propKey = `${game.game_id}_${prop.market_type}_${idx}`;
                const m1 = calcVigFreeProbability(prop.base_odds_over || -110, prop.base_odds_under || -110);
                const vigFreeOver = m1.trueProbA;
                const vegasLine = (prop.base_line !== undefined && prop.base_line !== null) ? Number(prop.base_line) : 0;
                const isHomeSpread = prop.market_type === "spread" && prop.player.startsWith(`${game.home_team} `);

                let baseProjectedLine = vegasLine;
                let tipModelProb = 0.50;
                let bdProjectedLine = vegasLine;
                let bdModelProb = 0.50;
                let finalCalculatedLine = vegasLine;
                let activeModelProb = 0.50;

                let safeFloorHookNum = vegasLine;
                let safeFloorLabel = "";
                let safeFloorWinPct = 82.0;
                let ceilingHookNum = vegasLine;
                let bdAltLineLabel = "";
                let bdLongerOdds = 145;
                let bdReachProb = 0.50;

                if (prop.market_type === "spread") {
                    baseProjectedLine = isHomeSpread ? m9Base.fairHomeSpread : Number((-m9Base.fairHomeSpread).toFixed(2));
                    const tipGap = vegasLine - baseProjectedLine;
                    tipModelProb = calcPointGapWinProb(tipGap);

                    bdProjectedLine = isHomeSpread ? m9Bd.fairHomeSpread : Number((-m9Bd.fairHomeSpread).toFixed(2));
                    const bdGap = vegasLine - bdProjectedLine;
                    bdModelProb = calcPointGapWinProb(bdGap);

                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        finalCalculatedLine = isHomeSpread ? m9.fairHomeSpread : Number((-m9.fairHomeSpread).toFixed(2));
                        activeModelProb = calcPointGapWinProb(vegasLine - finalCalculatedLine);
                    } else {
                        finalCalculatedLine = baseProjectedLine;
                        activeModelProb = tipModelProb;
                    }

                    const safeSpreadHook = snapToHalfPointHook(vegasLine, +3.5);
                    safeFloorHookNum = safeSpreadHook;
                    const safeCoverGap = safeSpreadHook - finalCalculatedLine;
                    const safeProbRaw = Math.min(0.96, Math.max(0.68, calcPointGapWinProb(safeCoverGap)));
                    safeFloorWinPct = Number((safeProbRaw * 100).toFixed(1));
                    safeFloorLabel = `Alt ${safeSpreadHook > 0 ? '+' + safeSpreadHook.toFixed(1) : safeSpreadHook.toFixed(1)} (-175)`;

                    const altSpreadHook = snapToHalfPointHook(vegasLine, -3.0);
                    ceilingHookNum = altSpreadHook;
                    bdAltLineLabel = `Alt ${altSpreadHook > 0 ? '+' + altSpreadHook.toFixed(1) : altSpreadHook.toFixed(1)} (+145)`;
                    bdLongerOdds = 145;
                    const altCoverGap = altSpreadHook - finalCalculatedLine;
                    bdReachProb = calcPointGapWinProb(altCoverGap);

                } else if (prop.market_type === "total") {
                    baseProjectedLine = baseTelemetryTotal;
                    const tipTotalDiff = baseProjectedLine - vegasLine;
                    tipModelProb = calcPointGapWinProb(Math.abs(tipTotalDiff));

                    const dirSign = tipTotalDiff >= 0 ? 1 : -1;
                    const bdTotalShift = dirSign * Math.min(3.8, (Math.abs(psiBd) * 0.42 + Math.abs(m7.passGameModifierYards) * 0.20 + 1.1));
                    bdProjectedLine = Number((baseProjectedLine + bdTotalShift).toFixed(1));
                    bdModelProb = calcPointGapWinProb(Math.abs(bdProjectedLine - vegasLine));

                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        const dvTotal = bdProjectedLine + (sliderVal * PHI * 1.25);
                        finalCalculatedLine = Number(dvTotal.toFixed(1));
                        activeModelProb = calcPointGapWinProb(Math.abs(finalCalculatedLine - vegasLine));
                    } else {
                        finalCalculatedLine = baseProjectedLine;
                        activeModelProb = tipModelProb;
                    }

                    const isUnderTip = baseProjectedLine < vegasLine;

                    const safeTotalHook = isUnderTip
                        ? (Math.floor(vegasLine + 3.5) + 0.5)
                        : (Math.floor(vegasLine - 3.5) + 0.5);
                    safeFloorHookNum = safeTotalHook;
                    const safeTotalEdge = isUnderTip
                        ? (safeTotalHook - finalCalculatedLine)
                        : (finalCalculatedLine - safeTotalHook);
                    const safeTotalProb = Math.min(0.96, Math.max(0.70, calcPointGapWinProb(safeTotalEdge)));
                    safeFloorWinPct = Number((safeTotalProb * 100).toFixed(1));
                    safeFloorLabel = `Alt ${isUnderTip ? 'U' : 'O'} ${safeTotalHook.toFixed(1)} (-175)`;

                    const altTotalHook = isUnderTip
                        ? (Math.floor(vegasLine - 3.0) + 0.5)
                        : (Math.floor(vegasLine + 3.0) + 0.5);
                    ceilingHookNum = altTotalHook;
                    bdAltLineLabel = `Alt ${isUnderTip ? 'U' : 'O'} ${altTotalHook.toFixed(1)} (+155)`;
                    bdLongerOdds = 155;
                    const altTotalEdge = isUnderTip
                        ? (altTotalHook - finalCalculatedLine)
                        : (finalCalculatedLine - altTotalHook);
                    bdReachProb = calcPointGapWinProb(altTotalEdge);

                } else {
                    baseProjectedLine = prop.projected_mean_mu || vegasLine || 50;
                    const varianceSigma2 = prop.projected_variance_sigma2 || 225;
                    const gammaRes = calcGammaSurvivalProb(baseProjectedLine, varianceSigma2, vegasLine || 45.5);
                    tipModelProb = gammaRes.trueOverProb;
                    bdModelProb = Math.max(0.01, Math.min(0.99, tipModelProb + (psiBd * 0.04)));
                    bdProjectedLine = Number((baseProjectedLine * 1.10).toFixed(1));
                    finalCalculatedLine = (mode === "tip") ? baseProjectedLine : bdProjectedLine;
                    activeModelProb = (mode === "tip") ? tipModelProb : bdModelProb;

                    const safeFloorMilestone = Math.max(5, Math.round((baseProjectedLine * 0.70) / 5) * 5);
                    safeFloorHookNum = safeFloorMilestone;
                    const gammaFloorRes = calcGammaSurvivalProb(finalCalculatedLine, varianceSigma2, safeFloorMilestone);
                    safeFloorWinPct = Number((Math.min(0.97, Math.max(0.82, gammaFloorRes.trueOverProb)) * 100).toFixed(1));
                    safeFloorLabel = `${safeFloorMilestone}+ Safe Floor (-190)`;

                    const ceilingMilestone = Math.max(10, Math.round((baseProjectedLine * 1.25) / 5) * 5);
                    ceilingHookNum = ceilingMilestone;
                    bdAltLineLabel = `${ceilingMilestone}+ Escalator (+160)`;
                    bdLongerOdds = 160;
                    bdReachProb = Math.max(0.05, activeModelProb - 0.10);
                }

                let tipDisplayLabel = cleanLabelCodes(prop.player);
                let activeDisplayLabel = cleanLabelCodes(prop.player);
                if (prop.market_type === "total") {
                    const isUnderTip = baseProjectedLine < vegasLine;
                    const isUnderActive = finalCalculatedLine < vegasLine;
                    tipDisplayLabel = `${cleanAway}@${cleanHome} Total (${isUnderTip ? "U" : "O"} ${vegasLine})`;
                    activeDisplayLabel = `${cleanAway}@${cleanHome} Total (${isUnderActive ? "U" : "O"} ${vegasLine})`;
                }

                const m2Tip = calcExpectedValueAndKelly(tipModelProb, prop.base_odds_over || -110);
                const m2Bd = calcExpectedValueAndKelly(bdModelProb, prop.base_odds_over || -110);
                const m2BdAlt = calcExpectedValueAndKelly(bdReachProb, bdLongerOdds);
                const m2Active = calcExpectedValueAndKelly(activeModelProb, prop.base_odds_over || -110);

                const tipWinPct = Number((tipModelProb * 100).toFixed(2));
                const tipEvPct = Number(m2Tip.evPercentage.toFixed(2));
                const tipBadge = getTierFromEv(tipEvPct);

                const activeWinPct = Number((activeModelProb * 100).toFixed(2));
                const activeEvPct = Number(m2Active.evPercentage.toFixed(2));
                const activeBadge = getTierFromEv(activeEvPct);

                AppState.processedProps.push({
                    propKey,
                    commenceTime: game.commence_time,
                    isCurrentWeek,
                    weekLabel: gameRecord.weekLabel,
                    gameId: game.game_id,
                    league: gameLeague,
                    matchup: gameRecord.matchup,
                    homeTeam: cleanHome,
                    awayTeam: cleanAway,
                    player: tipDisplayLabel,
                    activePlayerLabel: activeDisplayLabel,
                    marketType: prop.market_type,
                    baseLine: vegasLine,
                    baseOdds: prop.base_odds_over || -110,
                    isHomeSpread,
                    tipProjectedMean: baseProjectedLine,
                    tipModelPct: tipWinPct,
                    tipEvPct: tipEvPct,
                    tipBadge: tipBadge,
                    projectedMean: finalCalculatedLine,
                    bdProjectedMean: bdProjectedLine,
                    vigFreePct: Number((vigFreeOver * 100).toFixed(2)),
                    bdModelPct: Number((bdModelProb * 100).toFixed(2)),
                    bdEvPct: Number(m2Bd.evPercentage.toFixed(2)),
                    safeFloorHookNum,
                    safeFloorLabel,
                    safeFloorWinPct,
                    ceilingHookNum,
                    bdAltLabel: bdAltLineLabel,
                    bdAltEvPct: Number(m2BdAlt.evPercentage.toFixed(2)),
                    activeModelPct: activeWinPct,
                    activeModelProbRaw: activeModelProb,
                    evPct: activeEvPct,
                    quarterKellyPct: Number(m2Active.quarterKellyStakePct.toFixed(2)),
                    tierBadge: activeBadge,
                    flagshipSlot: "",
                    porkysSlot: "",
                    psiBd,
                    psiActive: psi11_12
                });
            });
        }
    });

    // 1. Lock Main Stage Flagship 5-Pack Selection STRICTLY to THIS WEEK'S active/upcoming games (thru MNF)
    AppState.processedProps.forEach(p => {
        p.flagshipSlot = "";
        p.porkysSlot = "";
    });
    const bestSpreadPerGame = [];
    const remainingPool = [];
    const trapPairsPool = [];

    const currentWeekGames = AppState.processedGames.filter(g => g.isCurrentWeek);
    const activeWeekPool = currentWeekGames.length > 0 ? currentWeekGames : AppState.processedGames;

    activeWeekPool.forEach(g => {
        const gameSpreads = AppState.processedProps.filter(
            p => p.gameId === g.gameId && p.marketType === "spread" && Math.abs(p.baseLine) <= 28.5
        );
        if (gameSpreads.length > 0) {
            gameSpreads.sort((a, b) => b.tipEvPct - a.tipEvPct);
            const bestSide = gameSpreads[0];
            const worstSide = gameSpreads[gameSpreads.length - 1];
            bestSpreadPerGame.push(bestSide);

            if (gameSpreads.length > 1 && worstSide.tipEvPct <= PASS_EV_CUTOFF) {
                trapPairsPool.push({
                    trapProp: worstSide,
                    fadeProp: bestSide
                });
            }
        }
        const gameTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType !== "spread");
        remainingPool.push(...gameTotals);
    });

    bestSpreadPerGame.sort((a, b) => b.tipEvPct - a.tipEvPct);
    const menageTop3 = bestSpreadPerGame.slice(0, 3);
    menageTop3.forEach((p, idx) => { p.flagshipSlot = `MÉNAGE À TROIS #${idx + 1}`; });

    const leftoverSpreads = bestSpreadPerGame.slice(3);
    const flexCandidates = [...leftoverSpreads, ...remainingPool].sort((a, b) => b.tipEvPct - a.tipEvPct);
    const flexTop2 = flexCandidates.slice(0, 2);
    flexTop2.forEach((p, idx) => { p.flagshipSlot = `5-PACK FLEX #${idx + 4}`; });

    AppState.flagshipFivePack = [...menageTop3, ...flexTop2];

    // 2. Build "Wednesday Night at Porky's" Top 5 Public Traps & Safe Floor Fades
    trapPairsPool.sort((a, b) => a.trapProp.tipEvPct - b.trapProp.tipEvPct);
    AppState.porkysFivePack = trapPairsPool.slice(0, 5).map((pair, idx) => {
        const slotLabel = idx < 3
            ? `DAY-SHIFT TRAP #${idx + 1}`
            : `KEEP IT IN YOUR PANTS #${idx + 1}`;
        pair.trapProp.porkysSlot = slotLabel;
        return {
            slotLabel,
            isTopThreeTrap: idx < 3,
            trapProp: pair.trapProp,
            fadeProp: pair.fadeProp
        };
    });

    renderFlagshipFivePack();
    render_game_cards(AppState.rawPayload);
    renderCombinatoricsDeck();
    renderCompendiumBoard();
    renderTelemetryInspector();
    renderBioWeatherLab();
    renderHistoricalLedger();
    renderLiveBottomTicker();

    window.scrollTo(savedScrollX, savedScrollY);
    requestAnimationFrame(() => {
        window.scrollTo(savedScrollX, savedScrollY);
    });
}

// Single Lightning Bolt Rule + Restored Compendium Safe Floor (-2φ) & Ceiling Escalator (+φ) Bracket
function buildBallsDeepBoxHTML(engineProp, isSpread) {
    if (AppState.activeMode === "tip") {
        return "";
    }

    const activeTier = getTierFromEv(engineProp.evPct);
    let boxBg = "rgba(148, 163, 184, 0.08)";
    let boxBorder = "rgba(148, 163, 184, 0.35)";
    let activeColor = "var(--text-secondary)";

    if (activeTier === "SMASH") {
        boxBg = "rgba(16, 185, 129, 0.09)";
        boxBorder = "rgba(16, 185, 129, 0.42)";
        activeColor = "var(--accent-emerald)";
    } else if (activeTier === "PASS") {
        boxBg = "rgba(239, 68, 68, 0.09)";
        boxBorder = "rgba(239, 68, 68, 0.42)";
        activeColor = "var(--accent-danger)";
    }

    const activeLabel = AppState.activeMode === "davinci" ? "DAVINCI PROJ" : "BALLS DEEP PROJ";
    const activeProj = (isSpread && Number(engineProp.projectedMean) > 0) ? `+${engineProp.projectedMean}` : `${engineProp.projectedMean}`;
    const activeEvStr = `${engineProp.evPct > 0 ? '+' : ''}${engineProp.evPct}% EV`;
    const altEvStr = `${engineProp.bdAltEvPct > 0 ? '+' : ''}${engineProp.bdAltEvPct}% EV`;

    const showLightningBolt = !isSpread || (engineProp.tipModelPct >= 50.0);

    const boltRowHTML = showLightningBolt
        ? `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
                <span style="color: ${activeColor}; font-weight: 800;">⚡ ${activeLabel}: ${activeProj} | Win: ${engineProp.activeModelPct}% (${activeEvStr})</span>
                <span style="color: var(--text-secondary); font-size: 10.5px;">Ψ_11,12: <strong>${engineProp.psiActive > 0 ? '+' : ''}${engineProp.psiActive} pts</strong></span>
            </div>
        `
        : "";

    return `
        <div class="bd-preview-unlocked" style="background: ${boxBg}; border: 1px solid ${boxBorder}; flex-direction: column; align-items: stretch; gap: 4px;">
            ${boltRowHTML}
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 10.5px;">
                <span style="color: var(--accent-cyan); font-weight: 700;">🛡️ Safe Floor (-2&phi;): ${engineProp.safeFloorLabel} (${engineProp.safeFloorWinPct}% Win)</span>
                <span style="color: var(--accent-gold); font-weight: 700;">🎯 Ceiling (+&phi;): ${engineProp.bdAltLabel} (${altEvStr})</span>
            </div>
        </div>
    `;
}

// Collapsible Master Pick Board Decoder Ring & Betting Guide (VIP Club & Wingman Edition)
function buildMasterBoardLegendHTML() {
    const legendKey = "MASTER_BOARD_LEGEND_DRAWER";
    const isLegendOpen = openCardMemory.has(legendKey);

    return `
        <div style="margin-bottom: 14px; border: 1px solid rgba(6, 182, 212, 0.45); border-radius: 8px; background: #0f172a; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); overflow: hidden;">
            <div onclick="window.toggleLegendDrawer('${legendKey}', 'fivePack', event)" style="cursor: pointer; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(6, 182, 212, 0.14), rgba(15, 23, 42, 0.9)); user-select: none;">
                <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.03em;">
                    👙 NEW TO THE CLUB? THE DIXPIX HOUSE RULES &amp; 15-SECOND BETTING GUIDE
                </span>
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); text-decoration: underline;">
                    ${isLegendOpen ? 'Hide House Rules ▲' : 'Click to Expand ▼'}
                </span>
            </div>

            <div style="display: ${isLegendOpen ? 'block' : 'none'}; padding: 14px 18px; border-top: 1px solid var(--border-subtle); font-size: 12px; line-height: 1.55; color: var(--text-secondary);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px;">
                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">1. COVER CHARGE vs. REAL MEASUREMENTS</div>
                        <div>• <strong>Bold Top Line</strong> (e.g. <em>OSU Spread -3.5</em> or <em>Total U 54.5</em>) is the <strong>Vegas Sportsbook Line</strong>—the cover charge on your betting slip.</div>
                        <div style="margin-top: 4px;">• <strong>Proj:</strong> is what our 13-Module Engine says is <em>actually</em> under the hood once the stage lights come on. When Vegas pads its number and our <strong>Proj</strong> exposes the gap, that spread is where we print your Win % and EV%.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">2. THE VIP FLOOR CODE (3-TIER EV)</div>
                        <div>• <span class="badge-smash" style="font-size:10px;">SMASH</span> <strong style="color:var(--accent-emerald);">(&ge;+10.0% EV):</strong> <em>Green-Light Money Shot.</em> Full-contact value (57.6%+ win rate). Pull your stack out and make it rain.</div>
                        <div style="margin-top: 4px;">• <strong style="color:#94a3b8;">Neutral Slate / No Badge (&plusmn;10% EV):</strong> <em>All Tease, No Squeeze.</em> She's winking from the stage, but Vegas priced it too tight to drop cash on. Enjoy the view, keep your wallet holstered.</div>
                        <div style="margin-top: 4px;">• <span class="badge-pass" style="background:rgba(239,68,68,0.16);color:#ef4444;border:1px solid rgba(239,68,68,0.45);font-size:10px;font-weight:800;">PASS</span> <strong style="color:var(--accent-danger);">(&le;-10.0% EV):</strong> <em>Grenades Dodged.</em> You were a little too drunk to make that call last night—a 1:45 AM beer-goggle public trap trying to wreck your bankroll.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-gold); margin-bottom: 4px;">3. FLOOR-TO-CEILING VIP PASS (TOP RIGHT)</div>
                        <div>• <strong style="color:var(--accent-cyan);">Just the Tip:</strong> Pure M1–M9 baseline efficiency, weather ballistics, and circadian travel drag.</div>
                        <div style="margin-top: 4px;">• <strong style="color:var(--accent-emerald);">Balls Deep:</strong> Unleashes M11–M13 (&Psi;_11,12 + Sacred Geometry $M_{rise}$), exposing every Underdog spread plus our <strong>🛡️ Safe Floor Anchor (-2&phi;, ~85% Win)</strong> and <strong>🎯 Ceiling Escalator (+&phi;, +145/+155)</strong> bracket.</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Flagship 5-Pack Banner with Responsive Mobile/Desktop Corner Toggle for "Wednesday Night at Porky's"
function renderFlagshipFivePack() {
    ensureTickerStylesInjected();

    const container = document.getElementById("flagship-five-pack-container");
    if (!container) return;

    if (AppState.flagshipFivePack.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.style.maxWidth = "920px";
    container.style.margin = "0 auto 24px auto";
    container.style.border = "none";
    container.style.backgroundColor = "transparent";
    container.style.boxShadow = "none";

    const bannerKey = "FLAGSHIP_5_PACK_DRAWER";
    const isExpanded = openCardMemory.has(bannerKey);
    const isPorkys = (AppState.fivePackView === "porkys");

    const modeTitle = AppState.activeMode === "tip"
        ? "Just the Tip Baseline (M1–M9)"
        : (AppState.activeMode === "balls_deep" ? "Balls Deep Floor & Ceiling Escalator (M1–M13)" : "DaVinci Continuous Flow Mode");

    const singleLockedStatusHTML = AppState.activeMode === "tip"
        ? `
            <div onclick="window.unlockBallsDeepMode(event)" style="margin: 10px auto 4px auto; max-width: 480px; padding: 7px 14px; border-radius: 6px; background: rgba(9, 13, 22, 0.78); border: 1px solid rgba(245, 158, 11, 0.45); opacity: 0.85; font-family: var(--font-mono); font-size: 11px; color: var(--accent-gold); font-weight: 700; text-align: center; cursor: pointer; user-select: none;">
                🔒 BALLS DEEP — "You gotta pay to go balls deep..." (Click to Unlock)
            </div>
        `
        : `
            <div style="margin: 10px auto 4px auto; max-width: 520px; padding: 6px 14px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); font-family: var(--font-mono); font-size: 11px; color: var(--accent-emerald); font-weight: 700; text-align: center;">
                🔓 BALLS DEEP FLOOR (-2&phi;) &amp; CEILING (+&phi;) BRACKET UNLOCKED (Ψ_11,12 ACTIVE)
            </div>
        `;

    const outerBorderColor = isPorkys ? "rgba(239, 68, 68, 0.65)" : "rgba(245, 158, 11, 0.55)";
    const headerGradient = isPorkys
        ? "linear-gradient(90deg, rgba(239, 68, 68, 0.22), rgba(236, 72, 153, 0.14), rgba(239, 68, 68, 0.22))"
        : "linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(6, 182, 212, 0.10), rgba(245, 158, 11, 0.16))";

    const cornerToggleHTML = isPorkys
        ? `
            <button class="five-pack-corner-btn" onclick="window.toggleFivePackView(event)" title="Back to Flagship 5-Pack" style="cursor:pointer; font-family:var(--font-mono); font-size:10.5px; font-weight:800; padding:4px 10px; border-radius:6px; background:rgba(15,23,42,0.88); color:var(--accent-gold); border:1px solid rgba(245,158,11,0.65); box-shadow:0 2px 8px rgba(0,0,0,0.4); transition:all 0.15s ease;">
                👑 Main Stage ➔
            </button>
        `
        : `
            <button class="five-pack-corner-btn" onclick="window.toggleFivePackView(event)" title="Flip to Wednesday Night at Porky's (Top 5 Fades)" style="cursor:pointer; font-family:var(--font-mono); font-size:10.5px; font-weight:800; padding:4px 10px; border-radius:6px; background:rgba(15,23,42,0.88); color:#f87171; border:1px solid rgba(239,68,68,0.65); box-shadow:0 2px 8px rgba(0,0,0,0.4); transition:all 0.15s ease;">
                🐷 Porky's Fades ➔
            </button>
        `;

    const mainStageRowsHTML = AppState.flagshipFivePack.map((p, idx) => {
        const isMenage = p.flagshipSlot.includes("MÉNAGE");
        const isSpread = p.marketType === "spread";
        const fmtTipProj = (isSpread && Number(p.tipProjectedMean) > 0) ? `+${p.tipProjectedMean}` : `${p.tipProjectedMean}`;
        const tipEvStr = `${p.tipEvPct > 0 ? '+' : ''}${p.tipEvPct}% EV`;

        return `
            <div style="padding: 10px 0; ${idx < AppState.flagshipFivePack.length - 1 ? 'border-bottom: 1px solid #1e293b;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="${isMenage ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>
                        <strong style="font-size: 13px; color: var(--text-primary);">${p.player}</strong>
                        ${renderTierBadgeHTML(p.tipBadge)}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 12px;">
                        <span style="color: ${getTierColor(p.tipBadge)};">
                            Proj: <strong>${fmtTipProj}</strong> | Win: <strong>${p.tipModelPct}%</strong> (${tipEvStr})
                        </span>
                    </div>
                </div>
                ${buildBallsDeepBoxHTML(p, isSpread)}
            </div>
        `;
    }).join("");

    const porkysRowsHTML = AppState.porkysFivePack.map((item, idx) => {
        const trap = item.trapProp;
        const fade = item.fadeProp;
        const fmtTrapProj = Number(trap.tipProjectedMean) > 0 ? `+${trap.tipProjectedMean}` : `${trap.tipProjectedMean}`;
        const fmtFadeProj = Number(fade.tipProjectedMean) > 0 ? `+${fade.tipProjectedMean}` : `${fade.tipProjectedMean}`;
        const trapEvStr = `${trap.tipEvPct > 0 ? '+' : ''}${trap.tipEvPct}% EV`;

        // Safe Floor (-2φ) Counter-Strike Fade metrics
        const fadeTeamCode = fade.isHomeSpread ? fade.homeTeam : fade.awayTeam;
        const safeFloorProbRaw = (fade.safeFloorWinPct || 82.0) / 100.0;
        const m2SafeFloor = calcExpectedValueAndKelly(safeFloorProbRaw, -175);
        const safeFloorEvPct = Number(m2SafeFloor.evPercentage.toFixed(2));
        const safeFloorEvStr = `${safeFloorEvPct > 0 ? '+' : ''}${safeFloorEvPct}% EV`;
        const safeFloorTier = getTierFromEv(safeFloorEvPct);
        const fmtBaseSpread = fade.baseLine > 0 ? `+${fade.baseLine}` : `${fade.baseLine}`;

        const slotBadgeStyle = item.isTopThreeTrap
            ? "background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.55);"
            : "background:rgba(236,72,153,0.16); color:#f472b6; border:1px solid rgba(236,72,153,0.5);";

        return `
            <div style="padding: 12px 0; ${idx < AppState.porkysFivePack.length - 1 ? 'border-bottom: 1px solid #1e293b;' : ''}">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; align-items: center;">
                    <div style="background: rgba(239, 68, 68, 0.07); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; padding: 8px 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
                            <span style="font-family:var(--font-mono); font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; ${slotBadgeStyle}">
                                🐷 ${item.slotLabel}
                            </span>
                            ${renderTierBadgeHTML("PASS")}
                        </div>
                        <div style="font-size: 12.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">
                            🚫 TRAP: ${trap.player}
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 11.5px; color: var(--accent-danger);">
                            Proj: <strong>${fmtTrapProj}</strong> | Win: <strong>${trap.tipModelPct}%</strong> (${trapEvStr})
                        </div>
                    </div>

                    <div style="background: rgba(6, 182, 212, 0.09); border: 1px solid rgba(16, 185, 129, 0.45); border-radius: 6px; padding: 8px 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
                            <span style="font-family:var(--font-mono); font-size:10px; font-weight:800; color:var(--accent-cyan);">
                                🛡️ RECOMMENDED SAFE FLOOR FADE (-2&phi;)
                            </span>
                            ${renderTierBadgeHTML(safeFloorTier)}
                        </div>
                        <div style="font-size: 12.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">
                            ✅ FADE TO FLOOR: ${fadeTeamCode} ${fade.safeFloorLabel} <span style="font-weight:600; font-size:11px; color:var(--text-secondary);">[Base: ${fmtBaseSpread}]</span>
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 11.5px; color: ${getTierColor(safeFloorTier)};">
                            Proj: <strong>${fmtFadeProj}</strong> | Floor Win: <strong>${fade.safeFloorWinPct}%</strong> (${safeFloorEvStr})
                        </div>
                    </div>
                </div>
                ${buildBallsDeepBoxHTML(fade, true)}
            </div>
        `;
    }).join("");

    container.innerHTML = `
        ${buildMasterBoardLegendHTML()}

        <div style="border: 1px solid ${outerBorderColor}; border-radius: 8px; background-color: #111827; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); overflow: hidden;">
            <div id="flagship-banner-toggle" style="background: ${headerGradient};">
                ${cornerToggleHTML}

                <div style="font-size: 15px; font-weight: 800; color: ${isPorkys ? '#f87171' : 'var(--accent-gold)'}; letter-spacing: 0.03em; line-height: 1.35;">
                    ${isPorkys
                        ? '🐷 WEDNESDAY NIGHT AT PORKY\'S // TOP 5 B-SQUAD TRAPS &amp; SAFE FLOOR FADES'
                        : '👑 THE DIXPIX FLAGSHIP 5-PACK // FEATURING "THE MÉNAGE À TROIS"'}
                </div>

                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                    ${isPorkys
                        ? '💣 Wingman Grenade Alert: <strong style="color:#f87171;">1:45 AM Public Grenade on Left</strong> ➔ <strong style="color:var(--accent-cyan);">🛡️ Safe Floor Counter-Strike (-2&phi;) on Right</strong>'
                        : `Active Engine: <strong style="color: var(--accent-cyan);">${modeTitle}</strong> • <span style="color: var(--accent-emerald);">Current Week Slate (Thru MNF)</span>`}
                </div>

                ${singleLockedStatusHTML}

                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-primary); text-decoration: underline; margin-top: 6px;">
                    ${isExpanded
                        ? (isPorkys ? 'Click to collapse Porky\'s Safe Floor Fades ▲' : 'Click to collapse 5-Pack ▲')
                        : (isPorkys ? 'Click to expand all 5 Porky\'s Traps &amp; Safe Floor Fades ▼' : 'Click to unlock &amp; expand all 5 Flagship Plays ▼')}
                </div>
            </div>

            <div id="flagship-banner-drawer" style="display: ${isExpanded ? 'block' : 'none'}; padding: 14px 18px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface);">
                ${isPorkys ? porkysRowsHTML : mainStageRowsHTML}
            </div>
        </div>
    `;

    const toggleHeader = document.getElementById("flagship-banner-toggle");
    const drawer = document.getElementById("flagship-banner-drawer");
    if (toggleHeader && drawer) {
        toggleHeader.addEventListener("click", () => {
            const savedY = window.scrollY;
            const closing = drawer.style.display === "block";
            drawer.style.display = closing ? "none" : "block";
            if (closing) openCardMemory.delete(bannerKey);
            else openCardMemory.add(bannerKey);
            renderFlagshipFivePack();
            window.scrollTo(window.scrollX, savedY);
        });
    }
}

// ==========================================
// INDEPENDENT MASONRY FLEX COLUMNS WITH AUTO-SWEEP FOR COMPLETED GAMES
// ==========================================
function buildMasonryGridForGames(gamesSlice, numCols, cardSubtitle) {
    const rowWrapper = document.createElement("div");
    rowWrapper.style.display = "flex";
    rowWrapper.style.alignItems = "flex-start";
    rowWrapper.style.gap = "15px";
    rowWrapper.style.width = "100%";

    const colElements = [];
    for (let c = 0; c < numCols; c++) {
        const colDiv = document.createElement("div");
        colDiv.style.flex = "1";
        colDiv.style.minWidth = "0";
        colDiv.style.display = "flex";
        colDiv.style.flexDirection = "column";
        colDiv.style.gap = "15px";
        rowWrapper.appendChild(colDiv);
        colElements.push(colDiv);
    }

    gamesSlice.forEach((game, gameIndex) => {
        const cardKey = game.game_id || `${game.away_team}@${game.home_team}`;
        const cleanHome = cleanTeamCode(game.home_team);
        const cleanAway = cleanTeamCode(game.away_team);
        const matchupKey = `${cleanAway} @ ${cleanHome}`;
        const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[matchupKey];
        const isLiveInPlay = Boolean(espnMatch && espnMatch.state === "in");

        let gameDate = "TBD", gameTime = "TBD";
        if (game.commence_time) {
            const dt = new Date(game.commence_time);
            gameDate = dt.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
            gameTime = dt.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
        }

        const env = game.environmental_payload || {};
        const weatherString = env.is_dome 
            ? "Dome (72°F)" 
            : `${env.temperature_f || "--"}°F | Wind: ${env.wind_mph || "--"} mph`;

        const card = document.createElement("div");
        card.className = "game-card";
        card.style.border = isLiveInPlay ? "1px solid rgba(245, 158, 11, 0.75)" : "1px solid #334155";
        card.style.borderRadius = "8px";
        card.style.backgroundColor = "#1e293b";
        card.style.padding = "15px";
        card.style.cursor = "pointer";
        card.style.color = "#e2e8f0";
        card.style.width = "100%";

        const liveScoreBanner = isLiveInPlay
            ? `<div style="font-family:var(--font-mono); font-size:0.8em; color:var(--accent-gold); font-weight:800; text-align:center; margin-bottom:6px;">🔴 LIVE (${espnMatch.shortDetail || 'IN-PLAY'}): ${espnMatch.scoreStr}</div>`
            : "";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px;">
                <span style="font-size: 0.85em; color: #94a3b8;">${gameDate} @ ${gameTime}</span>
                <span style="font-size: 0.85em; color: #94a3b8;">${weatherString}</span>
            </div>
            ${liveScoreBanner}
            <div style="font-size: 1.25em; font-weight: bold; text-align: center; margin-bottom: 10px;">
                ${cleanAway} @ ${cleanHome}
            </div>
            <div style="font-size: 0.85em; text-align: center; color: #cbd5e1;">
                ${cardSubtitle}
            </div>
        `;

        const drawer = document.createElement("div");
        drawer.style.display = openCardMemory.has(cardKey) ? "block" : "none";
        drawer.style.marginTop = "15px";
        drawer.style.borderTop = "1px solid #334155";
        drawer.style.paddingTop = "10px";

        const allGameProps = AppState.processedProps.filter(ep => ep.gameId === game.game_id);

        const visibleGameProps = (AppState.activeMode === "tip")
            ? allGameProps.filter(ep => {
                if (ep.marketType !== "spread") return true;
                if (ep.baseLine < 0) return true;
                if (ep.baseLine === 0 && ep.isHomeSpread) return true;
                return false;
            })
            : allGameProps;

        if (visibleGameProps.length === 0) {
            drawer.innerHTML = `<div style="font-size: 0.85em; color: #94a3b8;">No active lines available yet.</div>`;
        } else {
            visibleGameProps.forEach((engineData) => {
                const isSpread = engineData.marketType === "spread";
                const lineColorHex = getTierColor(engineData.tipBadge, true);
                const displayTipProj = (isSpread && Number(engineData.tipProjectedMean) > 0)
                    ? `+${engineData.tipProjectedMean}`
                    : `${engineData.tipProjectedMean}`;
                const tipEvStr = `${engineData.tipEvPct > 0 ? '+' : ''}${engineData.tipEvPct}% EV`;
                const slotBadge = (AppState.activeMode !== "tip" && engineData.flagshipSlot)
                    ? `<span class="${engineData.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}" style="margin-right:6px;">${engineData.flagshipSlot}</span>`
                    : (engineData.flagshipSlot && engineData.baseLine <= 0 ? `<span class="${engineData.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}" style="margin-right:6px;">${engineData.flagshipSlot}</span>` : "");

                const propBlock = document.createElement("div");
                propBlock.style.padding = "8px 0";
                propBlock.style.borderBottom = "1px solid #0f172a";

                propBlock.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.85em; margin-bottom: 4px;">
                        <span>${slotBadge}<strong>${engineData.player}</strong></span>
                        ${renderTierBadgeHTML(engineData.tipBadge)}
                    </div>
                    <div style="font-family: var(--font-mono); font-size: 0.82em; color: ${lineColorHex};">
                        Proj: ${displayTipProj} | Win: ${engineData.tipModelPct}% (${tipEvStr})
                    </div>
                    ${buildBallsDeepBoxHTML(engineData, isSpread)}
                `;
                drawer.appendChild(propBlock);
            });
        }

        card.appendChild(drawer);
        card.addEventListener("click", () => {
            const isClosing = drawer.style.display === "block";
            drawer.style.display = isClosing ? "none" : "block";
            if (isClosing) openCardMemory.delete(cardKey);
            else openCardMemory.add(cardKey);
        });

        colElements[gameIndex % numCols].appendChild(card);
    });

    return rowWrapper;
}

function render_game_cards(data) {
    const container = document.getElementById("master-board-body");
    if (!container) return;

    const defaultLeague = (data.slate_info && data.slate_info.league) || "NFL";
    // Auto-sweep any game that has already ended (FINAL) off Tab 1 into the Historical Ledger Card Vaults
    const games = (data.games || []).filter(g => shouldIncludeGame(g, defaultLeague) && !isGameCompletedFinal(g));

    if (games.length === 0) {
        container.innerHTML = "";
        return;
    }

    const containerWidth = container.clientWidth || window.innerWidth || 1200;
    const numCols = Math.max(1, Math.min(4, Math.floor(containerWidth / 340)));

    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "20px";

    const cardSubtitle = AppState.activeMode === "tip"
        ? "Click to expand lines &amp; EV%"
        : "Click to expand lines, Safe Floor (-2&phi;) &amp; Ceiling Escalator (+&phi;)";

    const currentWeekGames = games.filter(g => isGameInCurrentWeek(g.commence_time, AppState.mnfCutoffMs));
    const lookaheadGames = games.filter(g => !isGameInCurrentWeek(g.commence_time, AppState.mnfCutoffMs));

    const fragment = document.createDocumentFragment();

    if (currentWeekGames.length > 0) {
        fragment.appendChild(buildMasonryGridForGames(currentWeekGames, numCols, cardSubtitle));
    }

    if (lookaheadGames.length > 0) {
        const cutoffDt = new Date(AppState.mnfCutoffMs);
        const cutoffLabel = cutoffDt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

        const dividerBanner = document.createElement("div");
        dividerBanner.style.width = "100%";
        dividerBanner.style.margin = "12px 0 4px 0";
        dividerBanner.style.padding = "12px 18px";
        dividerBanner.style.borderRadius = "8px";
        dividerBanner.style.border = "1px solid rgba(245, 158, 11, 0.55)";
        dividerBanner.style.background = "linear-gradient(90deg, rgba(245, 158, 11, 0.14), rgba(15, 23, 42, 0.95), rgba(245, 158, 11, 0.14))";
        dividerBanner.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.35)";
        dividerBanner.style.textAlign = "center";
        dividerBanner.innerHTML = `
            <div style="font-family: var(--font-mono); font-size: 13px; font-weight: 800; color: var(--accent-gold); letter-spacing: 0.04em;">
                🔭 AFTER MONDAY NIGHT FOOTBALL CUTOFF (${cutoffLabel}) // NEXT WEEK'S EARLY LOOKAHEAD SLATE (${lookaheadGames.length} GAMES)
            </div>
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); margin-top: 3px;">
                Available for early browsing &amp; parlay building • Excluded from this week's Flagship 5-Pack until Tuesday morning
            </div>
        `;
        fragment.appendChild(dividerBanner);
        fragment.appendChild(buildMasonryGridForGames(lookaheadGames, numCols, cardSubtitle));
    }

    container.replaceChildren(fragment);
}

// ==========================================
// COMBINATORICS & ROUND ROBIN DECK (WITH SAFE FLOOR PORKY'S FADE LOADER)
// ==========================================
function renderCombinatoricsDeck() {
    const container = document.getElementById("combinatorics-container");
    if (!container) return;

    if (!AppState.safeFloorParlayLegs) AppState.safeFloorParlayLegs = new Set();

    const isUnlockedMode = (AppState.activeMode === "balls_deep" || AppState.activeMode === "davinci");
    const hasFloorLegs = AppState.safeFloorParlayLegs.size > 0;
    const modeTag = hasFloorLegs
        ? "🐷 PORKY'S SAFE FLOOR (-2φ) FADE SLIP ACTIVE (-175 ALT LINES)"
        : (AppState.activeMode === "tip"
            ? "JUST THE TIP BASELINE (M1–M9)"
            : (AppState.activeMode === "balls_deep" ? "BALLS DEEP FLOOR & CEILING ACTIVE" : "DAVINCI OVERRIDE ACTIVE"));

    const selectedProps = AppState.processedProps.filter(p => AppState.selectedParlayLegs.has(p.propKey));
    const legsPayload = selectedProps.map(p => {
        const useSafeFloor = AppState.safeFloorParlayLegs.has(p.propKey);
        return {
            americanOdds: useSafeFloor ? -175 : p.baseOdds,
            trueProb: useSafeFloor ? ((p.safeFloorWinPct || 82.0) / 100.0) : p.activeModelProbRaw
        };
    });

    const m10 = calcProfitBoostParlayEV(legsPayload, 1.30);
    const rrTiers = (typeof calcRoundRobinMatrix === "function") ? calcRoundRobinMatrix(legsPayload) : [];
    const baseStake = 10.00;
    const rawPayout = (baseStake * m10.dRaw).toFixed(2);
    const boostedPayout = (baseStake * m10.dBoost).toFixed(2);

    const uniqueMatchups = Array.from(new Set(AppState.processedGames.map(g => g.matchup)));

    const filteredPool = AppState.processedProps.filter(p => {
        if (AppState.comboFilters.team !== "ALL" && p.matchup !== AppState.comboFilters.team) return false;
        if (AppState.comboFilters.market !== "ALL" && p.marketType !== AppState.comboFilters.market) return false;
        if (AppState.comboFilters.tier === "SMASH" && p.tierBadge !== "SMASH") return false;
        return true;
    });

    container.innerHTML = `
        <div class="combinatorics-embedded-calc">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
                <div>
                    <span style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-cyan); font-size: 14px;">
                        🧮 PARLAY &amp; ROUND ROBIN CALCULATOR // <span style="color: ${hasFloorLegs ? '#f87171' : 'var(--accent-gold)'};">${modeTag}</span>
                    </span>
                    <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); margin-left: 10px;">
                        Tap any pick below to stack legs
                    </span>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="calc-action-btn" onclick="window.loadFlagshipPreset(true)" style="border-color: var(--accent-gold); color: var(--accent-gold);">
                        👑 Load Ménage à Trois (3)
                    </button>
                    <button class="calc-action-btn" onclick="window.loadFlagshipPreset(false)" style="border-color: var(--accent-emerald); color: var(--accent-emerald);">
                        🔥 Load Flagship 5-Pack (5)
                    </button>
                    <button class="calc-action-btn" onclick="window.loadPorkysPreset(event)" style="border-color: #f87171; color: #f87171;">
                        🐷 Load Porky's Safe Floor Fades (5)
                    </button>
                    <button class="calc-action-btn" onclick="window.clearParlaySlip(event)">
                        ✕ Clear Slip (${selectedProps.length})
                    </button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-family: var(--font-mono); font-size: 12px;">
                <div style="background: var(--bg-base); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 10px;">SELECTED LEGS</div>
                    <div style="font-size: 16px; font-weight: 800; color: var(--text-primary);">${selectedProps.length} Legs ${hasFloorLegs ? '<span style="font-size:11px;color:var(--accent-cyan);">(-2&phi; Floor)</span>' : ''}</div>
                </div>
                <div style="background: var(--bg-base); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 10px;">JOINT WIN PROBABILITY</div>
                    <div style="font-size: 16px; font-weight: 800; color: var(--accent-cyan);">${selectedProps.length ? m10.trueParlayProb : '0.00'}%</div>
                </div>
                <div style="background: var(--bg-base); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 10px;">RAW PARLAY ($10 STAKE)</div>
                    <div style="font-size: 16px; font-weight: 800; color: var(--text-primary);">${selectedProps.length ? m10.dRaw + 'x ($' + rawPayout + ')' : '--'}</div>
                </div>
                <div style="background: var(--bg-base); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 10px;">30% BOOSTED PAYOUT</div>
                    <div style="font-size: 16px; font-weight: 800; color: var(--accent-gold);">${selectedProps.length ? m10.dBoost + 'x ($' + boostedPayout + ')' : '--'}</div>
                </div>
                <div style="background: var(--bg-base); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 10px;">COMPOUND PARLAY EV%</div>
                    <div style="font-size: 16px; font-weight: 800; color: ${getTierColor(getTierFromEv(m10.evBoostPct))};">
                        ${selectedProps.length ? (m10.evBoostPct > 0 ? '+' : '') + m10.evBoostPct + '%' : '0.00%'}
                    </div>
                </div>
            </div>

            ${rrTiers.length > 0 ? `
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-subtle); display: flex; gap: 16px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 11px;">
                    <span style="color: var(--accent-gold); font-weight: 700;">ROUND ROBIN MATRIX:</span>
                    ${rrTiers.map(t => `
                        <span>
                            <strong>${t.legSize}:</strong> Avg ${t.avgMultiplier}x | Win ${t.avgWinProbPct}% |
                            <span style="color: ${getTierColor(getTierFromEv(t.expectedRoiPct))};">
                                EV ${t.expectedRoiPct > 0 ? '+' : ''}${t.expectedRoiPct}%
                            </span>
                        </span>
                    `).join(" • ")}
                </div>
            ` : ""}
        </div>

        <div class="panel-card">
            <div class="panel-header">
                <h2 class="panel-title">Interactive Parlay &amp; Round Robin Pick Builder</h2>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <select onchange="window.setComboFilter('team', this.value)" style="background: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 6px 10px; border-radius: 5px; font-family: var(--font-mono); font-size: 11px;">
                        <option value="ALL" ${AppState.comboFilters.team === 'ALL' ? 'selected' : ''}>All Matchups (${AppState.processedGames.length})</option>
                        ${uniqueMatchups.map(m => `<option value="${m}" ${AppState.comboFilters.team === m ? 'selected' : ''}>${m}</option>`).join("")}
                    </select>

                    <button class="calc-action-btn" onclick="window.setComboFilter('market', 'ALL')" style="${AppState.comboFilters.market === 'ALL' ? 'border-color:var(--accent-cyan);color:var(--accent-cyan);' : ''}">All Markets</button>
                    <button class="calc-action-btn" onclick="window.setComboFilter('market', 'spread')" style="${AppState.comboFilters.market === 'spread' ? 'border-color:var(--accent-cyan);color:var(--accent-cyan);' : ''}">Spreads</button>
                    <button class="calc-action-btn" onclick="window.setComboFilter('market', 'total')" style="${AppState.comboFilters.market === 'total' ? 'border-color:var(--accent-cyan);color:var(--accent-cyan);' : ''}">Totals (O/U)</button>
                    <button class="calc-action-btn" onclick="window.setComboFilter('tier', AppState.comboFilters.tier === 'SMASH' ? 'ALL' : 'SMASH')" style="${AppState.comboFilters.tier === 'SMASH' ? 'border-color:var(--accent-emerald);color:var(--accent-emerald);' : ''}">
                        SMASH Only (&ge;+10% EV)
                    </button>
                </div>
            </div>

            <div style="padding: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px;">
                ${filteredPool.map(p => {
                    const isSelected = AppState.selectedParlayLegs.has(p.propKey);
                    const isFloorSelected = AppState.safeFloorParlayLegs.has(p.propKey);
                    const isSpread = p.marketType === "spread";
                    const tierColor = getTierColor(p.tierBadge);
                    const fmtProj = (isSpread && Number(p.projectedMean) > 0) ? `+${p.projectedMean}` : `${p.projectedMean}`;
                    const evStr = `${p.evPct > 0 ? '+' : ''}${p.evPct}% EV`;
                    const altEvStr = `${p.bdAltEvPct > 0 ? '+' : ''}${p.bdAltEvPct}% EV`;

                    return `
                        <div onclick="window.toggleParlayLeg('${p.propKey}')" style="cursor: pointer; padding: 12px 14px; border-radius: 8px; background: ${isSelected ? 'rgba(6, 182, 212, 0.14)' : 'var(--bg-elevated)'}; border: 1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; transition: all 0.15s ease;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-family: var(--font-mono); font-size: 11px; color: ${isFloorSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)'}; font-weight: ${isFloorSelected ? '800' : '400'};">
                                    ${isFloorSelected ? '🛡️ SAFE FLOOR IN SLIP // ' : (isSelected ? '✅ IN SLIP // ' : '')}${p.matchup} ${!p.isCurrentWeek ? '🔭' : ''}
                                </span>
                                <div style="display: flex; gap: 6px;">
                                    ${p.flagshipSlot ? `<span class="${p.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>` : ''}
                                    ${renderTierBadgeHTML(p.tierBadge)}
                                </div>
                            </div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
                                ${isFloorSelected ? `${p.isHomeSpread ? p.homeTeam : p.awayTeam} ${p.safeFloorLabel}` : (p.activePlayerLabel || p.player)}
                                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">(${isFloorSelected ? '-175' : (p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds)})</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 12px; color: ${isFloorSelected ? 'var(--accent-cyan)' : tierColor};">
                                <span>Proj: <strong>${fmtProj}</strong></span>
                                <span>Win: <strong>${isFloorSelected ? p.safeFloorWinPct : p.activeModelPct}%</strong> (${isFloorSelected ? 'Safe Floor -2φ' : evStr})</span>
                            </div>
                            ${(isUnlockedMode || isFloorSelected) ? `
                                <div style="margin-top: 6px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; font-family: var(--font-mono); font-size: 10.5px;">
                                    <span style="color: var(--accent-cyan);">🛡️ ${p.safeFloorLabel} (${p.safeFloorWinPct}%)</span>
                                    <span style="color: var(--accent-gold);">🎯 ${p.bdAltLabel} (${altEvStr})</span>
                                </div>
                            ` : ""}
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

// ==========================================
// 13-MODULE COMPENDIUM BOARD
// ==========================================
function renderCompendiumBoard() {
    const tbody = document.getElementById("compendium-board-body");
    if (!tbody || AppState.processedGames.length === 0) return;

    const tableEl = tbody.closest("table");
    if (tableEl) {
        const thead = tableEl.querySelector("thead");
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th>Matchup</th>
                    <th>M7 Air Density (&rho;)</th>
                    <th>M8 Circadian (CSI)</th>
                    <th>M11 Bio + 10-Zone (&Psi;_elev)</th>
                    <th>M12 Turnover EPA</th>
                    <th>M13 Sacred Geometry (M_rise)</th>
                    <th>Master Score (&Omega;_fib,rise)</th>
                    <th>Unified Home Win &amp; Cover Prob (P_agg)</th>
                </tr>
            `;
        }
    }

    const isLocked = (AppState.activeMode === "tip");
    const modeFlow = AppState.activeMode === "tip"
        ? 0.0
        : (AppState.activeMode === "balls_deep" ? 1.0 : (1.0 + AppState.intensitySlider * 0.618));

    tbody.innerHTML = AppState.processedGames.map(g => {
        if (isLocked) {
            const lockHTML = renderLockCellHTML();
            return `
                <tr>
                    <td><strong>${g.matchup}</strong></td>
                    <td>${lockHTML}</td>
                    <td>${lockHTML}</td>
                    <td>${lockHTML}</td>
                    <td>${lockHTML}</td>
                    <td>${lockHTML}</td>
                    <td>${lockHTML}</td>
                    <td>${lockHTML}</td>
                </tr>
            `;
        }

        const scaledM11 = Number((g.m11CombinedDisplay * modeFlow).toFixed(4));
        const scaledM12 = Number(((g.m12.netTurnoverEPA || 0) * modeFlow).toFixed(3));
        const scaledM13Delta = Number((g.m13Rise * modeFlow).toFixed(4));
        const mRiseFactor = 1.0 + scaledM13Delta;

        const baseOmega = (
            (34 * (scaledM12 * 0.1)) +
            (21 * (-g.m8.circadianStrainIndex * 0.1)) +
            (13 * (scaledM11 * 0.15)) +
            (8 * ((1.225 - g.m7.airDensityRho) * 2)) +
            (13 * (g.psi11_12 * 0.08))
        ) / 76;

        const omegaFibRise = baseOmega * mRiseFactor;
        const baseLogistic = 1.0 / (1.0 + Math.exp(-PHI * omegaFibRise));
        const flowMult = 1.0 + ((13 / 76) * (AppState.activeMode === "davinci" ? AppState.intensitySlider : 0.618));
        const aggProb = Math.max(1.0, Math.min(99.0, baseLogistic * flowMult * 100));

        const m12Color = scaledM12 >= 0 ? "var(--accent-emerald)" : "var(--accent-danger)";
        const m13Color = scaledM13Delta >= 0 ? "var(--accent-emerald)" : "var(--accent-danger)";
        const omegaColor = omegaFibRise >= 0 ? "var(--accent-emerald)" : "var(--accent-danger)";
        const probColor = aggProb >= 52.4 ? "var(--accent-emerald)" : "var(--accent-danger)";

        return `
            <tr>
                <td><strong>${g.matchup}</strong></td>
                <td>${g.m7.airDensityRho} kg/m³</td>
                <td style="color:${g.m8.circadianStrainIndex > 0.8 ? 'var(--accent-danger)' : 'var(--text-primary)'};">${g.m8.circadianStrainIndex}</td>
                <td style="color:var(--accent-cyan); font-weight:700;">${scaledM11 > 0 ? '+' : ''}${scaledM11}</td>
                <td style="color:${m12Color}; font-weight:700;">${scaledM12 > 0 ? '+' : ''}${scaledM12}</td>
                <td style="color:${m13Color}; font-weight:700;">${mRiseFactor.toFixed(4)}x (${scaledM13Delta > 0 ? '+' : ''}${scaledM13Delta})</td>
                <td style="font-family:var(--font-mono); font-weight:700; color:${omegaColor};">${omegaFibRise > 0 ? '+' : ''}${omegaFibRise.toFixed(4)}</td>
                <td style="font-weight:800; color:${probColor};">${aggProb.toFixed(1)}%</td>
            </tr>
        `;
    }).join("");
}

function renderTelemetryInspector() {
    const container = document.getElementById("telemetry-container");
    if (!container || AppState.processedGames.length === 0) return;

    const showCoupledPsi = (AppState.activeMode === "balls_deep" || AppState.activeMode === "davinci");
    const modeDisplay = AppState.activeMode === "tip"
        ? "JUST THE TIP (M1–M9)"
        : (AppState.activeMode === "balls_deep" ? "BALLS DEEP (M1–M13)" : "DAVINCI");

    container.className = "table-responsive";
    container.innerHTML = `
        <table class="quant-table">
            <thead>
                <tr>
                    <th>Matchup</th>
                    <th>Mode Active</th>
                    <th>Circadian Strain (CSI)</th>
                    <th>Turnover EPA Diff (M12)</th>
                    <th>Coupled Escalator (&Psi;_11,12)</th>
                    <th>Model Fair Home Spread (M9)</th>
                </tr>
            </thead>
            <tbody>
                ${AppState.processedGames.map(g => {
                    const tipSpreadStr = `${g.homeTeam} ${g.m9Base.fairHomeSpread > 0 ? '+' + g.m9Base.fairHomeSpread : g.m9Base.fairHomeSpread}`;
                    const activeSpreadStr = `${g.homeTeam} ${g.m9.fairHomeSpread > 0 ? '+' + g.m9.fairHomeSpread : g.m9.fairHomeSpread}`;
                    const tovColor = g.m12.netTurnoverEPA >= 0 ? "var(--accent-emerald)" : "var(--accent-danger)";

                    return `
                        <tr>
                            <td><strong>${g.matchup}</strong></td>
                            <td style="color:var(--accent-cyan); font-weight:700;">${modeDisplay}</td>
                            <td>${g.m8.circadianStrainIndex} (&Phi;_circ: ${g.m8.phiCircadianPenalty})</td>
                            <td style="color:${tovColor}; font-weight:700;">${g.m12.netTurnoverEPA > 0 ? '+' : ''}${g.m12.netTurnoverEPA}</td>
                            <td>${showCoupledPsi ? `<span style="color:var(--accent-gold); font-weight:700;">${g.psi11_12 > 0 ? '+' : ''}${g.psi11_12} pts</span>` : renderLockCellHTML()}</td>
                            <td>
                                ${showCoupledPsi
                                    ? `<span style="color:var(--text-secondary); margin-right:10px;">Tip: ${tipSpreadStr}</span> <strong style="color:var(--accent-emerald);">Active: ${activeSpreadStr}</strong>`
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
// BIOPHYSICAL & WEATHER LAB
// ==========================================
function renderBioWeatherLab() {
    const container = document.getElementById("biolab-container");
    if (!container || AppState.processedGames.length === 0) return;

    const isLocked = (AppState.activeMode === "tip");
    const modeScale = AppState.activeMode === "davinci"
        ? (1.0 + AppState.intensitySlider * 0.382)
        : 1.0;

    const fmtShiftCell = (val, unit = "yds") => {
        if (isLocked) return renderLockCellHTML();
        const scaled = Number((val * modeScale).toFixed(2));
        const color = scaled > 0 ? "var(--accent-emerald)" : (scaled < 0 ? "var(--accent-danger)" : "var(--text-secondary)");
        return `<span style="color:${color}; font-weight:700;">${scaled > 0 ? '+' : ''}${scaled} ${unit}</span>`;
    };

    container.className = "table-responsive";
    container.innerHTML = `
        <table class="quant-table">
            <thead>
                <tr>
                    <th>Matchup</th>
                    <th>Elevation (m)</th>
                    <th>Local Gravity g(h)</th>
                    <th>Air Density &rho; (kg/m³)</th>
                    <th>FG Shift (&Delta;D_FG)</th>
                    <th>Pass Carry (&Delta;D_Pass)</th>
                    <th>Pass Mod (&Delta;Y_Total)</th>
                    <th>Somatic Density (&rho;_player)</th>
                    <th>Bio + 10-Zone (&Phi;_bio + &Psi;_elev)</th>
                </tr>
            </thead>
            <tbody>
                ${AppState.processedGames.map(g => {
                    const scaledBio = Number((g.m11CombinedDisplay * modeScale).toFixed(4));
                    const bioColor = scaledBio >= 0.025 ? "var(--accent-emerald)" : "var(--accent-cyan)";

                    return `
                        <tr>
                            <td><strong>${g.matchup}</strong></td>
                            <td>${g.elevationM}m</td>
                            <td>${g.m11.localGravityG} m/s²</td>
                            <td>${g.m7.airDensityRho}</td>
                            <td>${fmtShiftCell(g.m7.fgRangeShiftYards, "yds")}</td>
                            <td>${fmtShiftCell(g.m7.deepPassShiftYards, "yds")}</td>
                            <td>${fmtShiftCell(g.m7.passGameModifierYards, "yds")}</td>
                            <td>${isLocked ? renderLockCellHTML() : `${g.m11.rhoPlayerDensity} kg/m³`}</td>
                            <td>${isLocked ? renderLockCellHTML() : `<span style="color:${bioColor}; font-weight:700;">${scaledBio} (x${g.m11.closingMultiplier})</span>`}</td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
    `;
}

// ==========================================
// PERMANENT ARCHIVE SEED + ZERO-TOKEN ESPN SCOREBOARD SYNC & 6 CLICKABLE VAULT CARDS
// ==========================================
const BLUE_BALLS_MARGIN = 3.0; // <= 3.0 pts miss from Vegas line = BLUE BALLS

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
            safe_floor_label: "Alt +10.5 (-175)",
            safe_floor_win_pct: 88.4,
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
        }
    }
};

const ESPN_SCORE_CACHE = {
    lastFetchMs: 0,
    gamesByMatchup: {}
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
                ESPN_SCORE_CACHE.gamesByMatchup[key] = {
                    league: ep.league,
                    homeCode,
                    awayCode,
                    homeScore,
                    awayScore,
                    state,
                    shortDetail,
                    scoreStr: `${awayCode} ${awayScore} - ${homeCode} ${homeScore}`
                };
            });
        } catch (e) {
            // Silent fallback
        }
    }

    if (AppState.rawPayload) {
        render_game_cards(AppState.rawPayload);
    }
    renderHistoricalLedger();
    renderLiveBottomTicker();
}

function isRankedLedgerEntry(matchupStr, league) {
    if (league === "NFL") return AppState.filters.nfl;
    if (league === "NCAA") {
        if (!AppState.filters.ncaa) return false;
        const parts = (matchupStr || "").split("@").map(s => cleanTeamCode(s.trim()));
        return parts.some(code => RANKED_NCAA_CODES.has(code));
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

function gradeTotalPick(projectedTotal, vegasTotal, homeScore, awayScore) {
    const actualTotal = homeScore + awayScore;
    const line = Number(vegasTotal);
    if (actualTotal === line) return { outcome: "PUSH", missBy: 0 };
    const takingUnder = Number(projectedTotal) < line;
    const coverDiff = takingUnder ? (line - actualTotal) : (actualTotal - line);
    if (coverDiff > 0) return { outcome: "HIT", missBy: 0 };
    const missPts = Number(Math.abs(coverDiff).toFixed(1));
    if (missPts <= BLUE_BALLS_MARGIN) return { outcome: "BLUE_BALLS", missBy: missPts };
    return { outcome: "MISS", missBy: missPts };
}

// Collapsible Ledger Legend Drawer (VIP Club & Wingman Edition — "left the money on the dresser")
function buildLedgerLegendHTML() {
    const legendKey = "LEDGER_LEGEND_DRAWER";
    const isLegendOpen = openCardMemory.has(legendKey);

    return `
        <div style="margin-bottom: 16px; border: 1px solid rgba(59, 130, 246, 0.45); border-radius: 8px; background: #0f172a; overflow: hidden;">
            <div onclick="window.toggleLegendDrawer('${legendKey}', 'ledger', event)" style="cursor: pointer; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(59, 130, 246, 0.16), rgba(15, 23, 42, 0.9)); user-select: none;">
                <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 800; color: #60a5fa; letter-spacing: 0.03em;">
                    💣 LEDGER DECODER: HOW WE GRADE MONEY SHOTS (W), BLUE BALLS (BB) &amp; GRENADES DODGED
                </span>
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); text-decoration: underline;">
                    ${isLegendOpen ? 'Hide Decoder ▲' : 'Click to Expand ▼'}
                </span>
            </div>

            <div style="display: ${isLegendOpen ? 'block' : 'none'}; padding: 14px 18px; border-top: 1px solid var(--border-subtle); font-size: 12px; line-height: 1.55; color: var(--text-secondary);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">THE MORNING-AFTER SCORECARD (W - L - BB)</div>
                        <div>• <strong style="color:var(--accent-emerald);">✅ HIT (W):</strong> <em>The Money Shot.</em> Covered the Vegas closing number, got dressed, and left the money on the dresser.</div>
                        <div style="margin-top: 4px;">• <strong style="color:#60a5fa;">🔵 BLUE BALLS (BB):</strong> <em>Robbed at the Two-Minute Warning.</em> Missed the Vegas line by <strong>&le;3.0 points (one field goal or less)</strong>—when she had you 99% of the way to the finish line and then Mom walks in.</div>
                        <div style="margin-top: 4px;">• <strong style="color:var(--accent-danger);">❌ MISS (L):</strong> <em>Walk of Shame.</em> Missed the closing line by more than 3.0 points. No excuses—we post every receipt.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">MAIN STAGE vs. LAP-DANCE COIN FLIPS</div>
                        <div>• <strong style="color:var(--accent-emerald);">🔥 Official SMASH (&ge;+10.0% EV):</strong> Our headline earners that clear the +10% EV velvet rope, tracked alongside the <strong>Flagship 5-Pack</strong> and <strong>Ménage à Trois</strong>.</div>
                        <div style="margin-top: 4px;">• <strong style="color:#60a5fa;">🔵 All Tease, No Squeeze (&plusmn;10% EV):</strong> Tight toss-ups inside the -9.9% to +9.9% EV buffer—quarantined in their own booth so 50/50 bar-bet variance never waters down our Official SMASH record.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-danger); margin-bottom: 4px;">💣 GRENADES DODGED (&le;-10% EV)</div>
                        <div>• <strong>Wingman Intervention:</strong> <em>You were a little too drunk to make that call last night.</em> Tracks the 1:45 AM beer-goggle public favorites we stamped with a red <strong>PASS (&le;-10.0% EV)</strong>—the ones that look like a 10 on TV after six drinks, right before they wreck your life.</div>
                        <div style="margin-top: 4px;">• Every time a casual-bait favorite blows up and fails to cover, <strong>Grenades Dodged</strong> ticks up—counting how many times your wingman jumped on the grenade so you didn't wake up chewing your own arm off on Monday morning.</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderHistoricalLedger() {
    const container = document.getElementById("ledger-container");
    if (!container) return;

    if (Date.now() - ESPN_SCORE_CACHE.lastFetchMs >= 60000) {
        syncEspnLiveScores();
    }

    const ledgerObj = (AppState.rawPayload && AppState.rawPayload.historical_ledger) || {};
    const rawEntries = ledgerObj.entries || {};
    const showBallsDeep = (AppState.activeMode === "balls_deep" || AppState.activeMode === "davinci");

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
        if (res === "HIT") {
            return `<span class="badge-smash" style="font-size:11px;">✅ HIT</span>`;
        }
        if (res === "BLUE_BALLS") {
            const marginTag = missBy > 0 ? ` (-${missBy} pts)` : "";
            return `<span class="badge-pass" style="background:rgba(59,130,246,0.18);color:#60a5fa;border:1px solid rgba(59,130,246,0.55);font-size:11px;font-weight:800;">🔵 BLUE BALLS${marginTag}</span>`;
        }
        if (res === "MISS") {
            return `<span class="badge-pass" style="background:rgba(239,68,68,0.18);color:var(--accent-danger);border-color:rgba(239,68,68,0.45);font-size:11px;">❌ MISS</span>`;
        }
        if (res === "PUSH") {
            return `<span class="badge-pass" style="font-size:11px;">➖ PUSH</span>`;
        }
        return `<span class="badge-pass" style="color:var(--accent-cyan);border-color:rgba(6,182,212,0.4);font-size:11px;">⏳ LOCKED / PENDING</span>`;
    };

    const makeBucket = () => ({ hits: 0, misses: 0, blueBalls: 0, total: 0 });
    const buckets = {
        flagship_5pack: makeBucket(),
        menage_a_trois: makeBucket(),
        overall_smash:  makeBucket(),
        spread_smash:   makeBucket(),
        total_smash:    makeBucket(),
        all_tease:      makeBucket(),
        champagne_room: { dodged: 0, total: 0 },
        safe_floors:    makeBucket(),
        ceilings:       makeBucket(),
        tip_all:        makeBucket(),
        balls_deep_all: makeBucket()
    };

    const fivePackByWeek = {};
    const ensureWeekFivePackBucket = (wk) => {
        if (!fivePackByWeek[wk]) {
            fivePackByWeek[wk] = {
                hits: 0,
                misses: 0,
                blueBalls: 0,
                total: 0,
                menage: makeBucket(),
                rows: []
            };
        }
        return fivePackByWeek[wk];
    };

    const vaultRows = {
        flagship_5pack: [],
        overall_smash: [],
        all_tease: [],
        grenades_dodged: [],
        floors_ceilings: [],
        tip_vs_bd: []
    };

    const tallyGradeToObj = (targetObj, res) => {
        if (res !== "HIT" && res !== "MISS" && res !== "BLUE_BALLS") return;
        targetObj.total += 1;
        if (res === "HIT") targetObj.hits += 1;
        else if (res === "BLUE_BALLS") targetObj.blueBalls += 1;
        else if (res === "MISS") targetObj.misses += 1;
    };

    const tallyGrade = (bucketKey, res) => {
        tallyGradeToObj(buckets[bucketKey], res);
    };

    let upcomingRowsHTML = "";
    const renderedMatchups = new Set();
    const activeSlateMatchups = new Set(AppState.processedGames.map(g => g.matchup));

    const buildStandardVaultRowHTML = (weekLabel, cleanMatchup, statusLabel, type, slot, pickLabel, ledgerTier, vegasLine, baseOdds, tipColor, fmtTipProj, tipWinPct, tipEvPct, showBallsDeepFlag, bdColor, fmtBdProj, bdWinPct, bdEvPct, safeFloorLabel, safeFloorWinPct, bdAltLabel, bdAltEvPct, gradedTip, missByPts) => {
        const floorInfoHTML = safeFloorLabel
            ? `<small style="color:var(--accent-cyan);">🛡️ ${safeFloorLabel} (${safeFloorWinPct}%)</small> • `
            : "";
        return `
            <tr>
                <td><span style="font-family:var(--font-mono); font-size:10px; color:var(--accent-gold); font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                <td>${type} ${slot ? `<br><span class="${slot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}">${slot}</span>` : ""}</td>
                <td><strong>${pickLabel}</strong> ${renderTierBadgeHTML(ledgerTier)}</td>
                <td>${vegasLine} (${baseOdds > 0 ? '+' + baseOdds : baseOdds})</td>
                <td style="color:${tipColor};">Proj: <strong>${fmtTipProj}</strong> (${tipWinPct}% | ${tipEvPct > 0 ? '+' : ''}${tipEvPct}% EV)</td>
                <td>${showBallsDeepFlag ? `<span style="color:${bdColor};">Proj: <strong>${fmtBdProj}</strong> (${bdWinPct}% | ${bdEvPct > 0 ? '+' : ''}${bdEvPct}% EV)<br>${floorInfoHTML}<small style="color:var(--accent-gold);">🎯 ${bdAltLabel} (${bdAltEvPct > 0 ? '+' : ''}${bdAltEvPct}% EV)</small></span>` : renderLockCellHTML()}</td>
                <td>${renderGradeBadge(gradedTip, missByPts)}</td>
            </tr>
        `;
    };

    const buildFloorCeilingVaultRowHTML = (weekLabel, cleanMatchup, statusLabel, type, pickLabel, vegasLine, safeFloorLabel, safeFloorWinPct, gradedFloor, floorMissBy, bdAltLabel, bdAltEvPct, gradedCeiling, ceilingMissBy) => {
        return `
            <tr>
                <td><span style="font-family:var(--font-mono); font-size:10px; color:var(--accent-gold); font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                <td>${type}</td>
                <td><strong>${pickLabel}</strong><br><span style="font-size:11px; color:var(--text-secondary);">Base Line: ${vegasLine}</span></td>
                <td style="color:var(--accent-cyan); font-weight:700;">🛡️ ${safeFloorLabel || 'Safe Floor (-2φ)'}<br><small style="color:var(--text-secondary);">Floor Win Prob: ${safeFloorWinPct || 85.0}%</small></td>
                <td>${renderGradeBadge(gradedFloor, floorMissBy)}</td>
                <td style="color:var(--accent-gold); font-weight:700;">🎯 ${bdAltLabel || 'Ceiling Escalator (+φ)'}<br><small style="color:var(--text-secondary);">Alt EV: ${bdAltEvPct > 0 ? '+' : ''}${bdAltEvPct || 0}% EV</small></td>
                <td>${renderGradeBadge(gradedCeiling, ceilingMissBy)}</td>
            </tr>
        `;
    };

    // 1. Process COMPLETED/FINAL archived games and store them in their respective Clickable Card Vaults
    Object.keys(entriesMap).forEach(archId => {
        const entry = entriesMap[archId];
        if (!entry) return;

        const cleanMatchup = cleanLabelCodes(entry.matchup || "");
        if (!cleanMatchup || renderedMatchups.has(cleanMatchup)) return;

        const entryLeague = entry.league || "NFL";
        if (!isRankedLedgerEntry(cleanMatchup, entryLeague)) return;

        const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[cleanMatchup];
        const isFinal = entry.status === "FINAL" || (espnMatch && espnMatch.state === "post");

        if (activeSlateMatchups.has(cleanMatchup) && !isFinal) return;

        const hasGradedResult = entry.spread_record && (
            entry.spread_record.result_tip === "HIT" ||
            entry.spread_record.result_tip === "MISS" ||
            entry.spread_record.result_tip === "BLUE_BALLS"
        );
        if (!isFinal && !hasGradedResult) return;

        renderedMatchups.add(cleanMatchup);

        const weekLabel = inferFootballWeekLabel(entry, "Week 10");
        const scoreDisplay = entry.final_score || (espnMatch ? espnMatch.scoreStr : "COMPLETED");
        const statusLabel = `<span style="color:var(--accent-emerald);font-weight:700;">FINAL (${scoreDisplay})</span>`;

        if (entry.trap_avoided) {
            buckets.champagne_room.total += 1;
            buckets.champagne_room.dodged += 1;
            const trapLabel = cleanLabelCodes(entry.trap_pick_label || `${cleanMatchup} Public Favorite Trap`);
            const trapLine = entry.trap_vegas_line !== undefined ? entry.trap_vegas_line : "--";
            const trapProj = entry.trap_tip_proj !== undefined ? entry.trap_tip_proj : "--";
            const trapEv = entry.trap_tip_ev_pct !== undefined ? `${entry.trap_tip_ev_pct}% EV` : "&le;-10% EV";
            const fadeSideLabel = (entry.spread_record && entry.spread_record.pick_label) ? cleanLabelCodes(entry.spread_record.pick_label) : "Counter-Strike Dog";

            vaultRows.grenades_dodged.push(`
                <tr>
                    <td><span style="font-family:var(--font-mono); font-size:10px; color:var(--accent-gold); font-weight:800;">${weekLabel}</span><br><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                    <td>PUBLIC GRENADE<br><span class="badge-pass" style="background:rgba(239,68,68,0.16);color:#ef4444;border:1px solid rgba(239,68,68,0.45);font-size:10px;font-weight:800;">PASS</span></td>
                    <td><strong style="color:var(--accent-danger);">🚫 TRAP: ${trapLabel}</strong></td>
                    <td>${trapLine} (-110)</td>
                    <td style="color:var(--accent-danger);">Proj: <strong>${trapProj}</strong> (${trapEv})</td>
                    <td style="color:var(--accent-emerald);"><strong>✅ FADE HIT:</strong> ${fadeSideLabel}</td>
                    <td><span class="badge-smash" style="font-size:11px;">💣 GRENADE DODGED</span></td>
                </tr>
            `);
        }

        const archivedRecords = [
            { type: "SPREAD", rec: entry.spread_record },
            { type: "TOTAL (O/U)", rec: entry.total_record }
        ].filter(x => x.rec);

        archivedRecords.forEach(({ type, rec }) => {
            const isSpread = type === "SPREAD";
            const pickLabel = cleanLabelCodes(rec.pick_label || rec.player || cleanMatchup);
            const vegasLine = rec.vegas_line !== undefined ? Number(rec.vegas_line) : (rec.line !== undefined ? Number(rec.line) : Number(rec.baseLine || 0));
            const baseOdds = rec.odds !== undefined ? rec.odds : (rec.baseOdds || -110);
            const tipProj = rec.tip_proj !== undefined ? Number(rec.tip_proj) : Number(rec.tipProjectedMean || vegasLine);
            const tipWinPct = rec.tip_win_pct !== undefined ? rec.tip_win_pct : (rec.tipModelPct || 50);
            const tipEvPct = rec.tip_ev_pct !== undefined ? rec.tip_ev_pct : (rec.tipEvPct || 0);
            const ledgerTier = getTierFromEv(tipEvPct);
            const tipColor = getTierColor(ledgerTier);

            const bdProj = rec.bd_proj !== undefined ? Number(rec.bd_proj) : Number(rec.bdProjectedMean || tipProj);
            const bdWinPct = rec.bd_win_pct !== undefined ? rec.bd_win_pct : (rec.bdModelPct || tipWinPct);
            const bdEvPct = rec.bd_ev_pct !== undefined ? rec.bd_ev_pct : (rec.bdEvPct || tipEvPct);
            const bdTier = getTierFromEv(bdEvPct);
            const bdColor = getTierColor(bdTier);

            const isUnderTip = !isSpread && (tipProj < vegasLine);
            const defaultFloorHook = isSpread
                ? snapToHalfPointHook(vegasLine, +3.5)
                : (isUnderTip ? (Math.floor(vegasLine + 3.5) + 0.5) : (Math.floor(vegasLine - 3.5) + 0.5));
            const safeFloorLabel = rec.safe_floor_label || rec.safeFloorLabel || (isSpread
                ? `Alt ${defaultFloorHook > 0 ? '+' + defaultFloorHook.toFixed(1) : defaultFloorHook.toFixed(1)} (-175)`
                : `Alt ${isUnderTip ? 'U' : 'O'} ${defaultFloorHook.toFixed(1)} (-175)`);
            const safeFloorWinPct = rec.safe_floor_win_pct || rec.safeFloorWinPct || 84.5;

            const bdAltLabel = rec.bd_alt_label || rec.bdAltLabel || "Alt Escalator";
            const bdAltEvPct = rec.bd_alt_ev_pct !== undefined ? rec.bd_alt_ev_pct : (rec.bdAltEvPct || 0);
            const slot = rec.flagship_slot || rec.flagshipSlot || "";

            let gradedTip = rec.result_tip || rec.result || "PENDING";
            let gradedBd = rec.result_bd || gradedTip;
            const missByPts = Number(rec.miss_by_pts || 0);

            // Derive Safe Floor (-2φ) & Ceiling (+φ) grades if not explicitly hardcoded
            let gradedFloor = rec.result_floor || "";
            let floorMissBy = 0;
            if (!gradedFloor) {
                if (gradedTip === "HIT" || gradedTip === "BLUE_BALLS") {
                    // +3.5 pts of Safe Floor cushion turns any HIT or <=3.0 pt BLUE_BALLS into a Safe Floor HIT
                    gradedFloor = "HIT";
                } else if (gradedTip === "MISS") {
                    const remMiss = Number((missByPts - 3.5).toFixed(1));
                    if (remMiss <= 0) gradedFloor = "HIT";
                    else if (remMiss <= BLUE_BALLS_MARGIN) { gradedFloor = "BLUE_BALLS"; floorMissBy = remMiss; }
                    else { gradedFloor = "MISS"; floorMissBy = remMiss; }
                }
            }

            let gradedCeiling = rec.result_ceiling || "";
            let ceilingMissBy = 0;
            if (!gradedCeiling) {
                if (gradedTip === "BLUE_BALLS" || gradedTip === "MISS") {
                    gradedCeiling = "MISS";
                    ceilingMissBy = Number((missByPts + 3.0).toFixed(1));
                } else if (gradedTip === "HIT") {
                    gradedCeiling = "HIT";
                }
            }

            const fmtTipProj = (isSpread && Number(tipProj) > 0) ? `+${tipProj}` : `${tipProj}`;
            const fmtBdProj = (isSpread && Number(bdProj) > 0) ? `+${bdProj}` : `${bdProj}`;

            const rowHTML = buildStandardVaultRowHTML(
                weekLabel, cleanMatchup, statusLabel, type, slot, pickLabel, ledgerTier,
                vegasLine, baseOdds, tipColor, fmtTipProj, tipWinPct, tipEvPct,
                showBallsDeep, bdColor, fmtBdProj, bdWinPct, bdEvPct,
                safeFloorLabel, safeFloorWinPct, bdAltLabel, bdAltEvPct, gradedTip, missByPts
            );

            if (gradedTip === "HIT" || gradedTip === "MISS" || gradedTip === "BLUE_BALLS") {
                tallyGrade("tip_all", gradedTip);
                tallyGrade("balls_deep_all", gradedBd);
                vaultRows.tip_vs_bd.push(rowHTML);

                tallyGrade("safe_floors", gradedFloor);
                tallyGrade("ceilings", gradedCeiling);
                vaultRows.floors_ceilings.push(
                    buildFloorCeilingVaultRowHTML(
                        weekLabel, cleanMatchup, statusLabel, type, pickLabel, vegasLine,
                        safeFloorLabel, safeFloorWinPct, gradedFloor, floorMissBy,
                        bdAltLabel, bdAltEvPct, gradedCeiling, ceilingMissBy
                    )
                );

                if (slot) {
                    tallyGrade("flagship_5pack", gradedTip);
                    if (slot.includes("MÉNAGE")) tallyGrade("menage_a_trois", gradedTip);

                    const wkObj = ensureWeekFivePackBucket(weekLabel);
                    tallyGradeToObj(wkObj, gradedTip);
                    if (slot.includes("MÉNAGE")) tallyGradeToObj(wkObj.menage, gradedTip);
                    wkObj.rows.push(rowHTML);
                    vaultRows.flagship_5pack.push({ weekLabel, rowHTML });
                }

                if (ledgerTier === "SMASH") {
                    tallyGrade("overall_smash", gradedTip);
                    tallyGrade(isSpread ? "spread_smash" : "total_smash", gradedTip);
                    vaultRows.overall_smash.push(rowHTML);
                } else if (ledgerTier === "TOO_CLOSE") {
                    tallyGrade("all_tease", gradedTip);
                    vaultRows.all_tease.push(rowHTML);
                }
            }
        });
    });

    // 2. Process current week's slate:
    //    - If a game has finished (FINAL via ESPN), route it into the Clickable Card Vaults above!
    //    - If a game is UPCOMING or IN-PLAY, render it in the open Upcoming & In-Play table below!
    AppState.processedGames.filter(g => g.isCurrentWeek).forEach(g => {
        if (renderedMatchups.has(g.matchup)) return;
        if (!isRankedLedgerEntry(g.matchup, g.league)) return;
        renderedMatchups.add(g.matchup);

        const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[g.matchup];
        const kickedOffByClock = g.commenceTime ? (new Date(g.commenceTime).getTime() <= Date.now()) : false;

        const isFinal = Boolean(espnMatch && espnMatch.state === "post");
        const isLocked = isFinal || kickedOffByClock || Boolean(espnMatch && espnMatch.state === "in");
        const scoreDisplay = espnMatch ? espnMatch.scoreStr : "";
        const weekLabel = g.weekLabel || "Week 11";

        const statusLabel = isFinal
            ? `<span style="color:var(--accent-emerald);font-weight:700;">FINAL (${scoreDisplay})</span>`
            : (isLocked
                ? `<span style="color:var(--accent-gold);font-weight:700;">🔒 IN-PLAY (${scoreDisplay || 'CLOSING LOCKED'})</span>`
                : `<span style="color:var(--text-secondary);">PRE-KICKOFF SNAPSHOT</span>`);

        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread").sort((a, b) => b.tipEvPct - a.tipEvPct);
        const gameTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "total");

        if (isFinal && espnMatch && gameSpreads.length > 1) {
            const trapSide = gameSpreads[gameSpreads.length - 1];
            const bestSide = gameSpreads[0];
            if (trapSide && trapSide.tipEvPct <= PASS_EV_CUTOFF) {
                const trapGrade = gradeSpreadPick(trapSide.isHomeSpread, trapSide.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                buckets.champagne_room.total += 1;
                const dodgedSuccess = (trapGrade.outcome !== "HIT");
                if (dodgedSuccess) {
                    buckets.champagne_room.dodged += 1;
                }
                const fmtTrapProj = Number(trapSide.tipProjectedMean) > 0 ? `+${trapSide.tipProjectedMean}` : `${trapSide.tipProjectedMean}`;
                vaultRows.grenades_dodged.push(`
                    <tr>
                        <td><span style="font-family:var(--font-mono); font-size:10px; color:var(--accent-gold); font-weight:800;">${weekLabel}</span><br><strong>${g.matchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                        <td>PUBLIC GRENADE<br>${renderTierBadgeHTML("PASS")}</td>
                        <td><strong style="color:var(--accent-danger);">🚫 TRAP: ${trapSide.player}</strong></td>
                        <td>${trapSide.baseLine} (${trapSide.baseOdds})</td>
                        <td style="color:var(--accent-danger);">Proj: <strong>${fmtTrapProj}</strong> (${trapSide.tipEvPct}% EV)</td>
                        <td style="color:var(--accent-emerald);"><strong>${dodgedSuccess ? '✅ FADE HIT:' : '💥 TRAP COVERED:'}</strong> ${bestSide ? bestSide.player : ''}</td>
                        <td>${dodgedSuccess ? `<span class="badge-smash" style="font-size:11px;">💣 GRENADE DODGED</span>` : `<span class="badge-pass" style="background:rgba(239,68,68,0.18);color:var(--accent-danger);font-size:11px;">💥 BLEW UP</span>`}</td>
                    </tr>
                `);
            }
        }

        const topPicks = [gameSpreads[0], gameTotals[0]].filter(Boolean);

        topPicks.forEach((p) => {
            const isSpread = p.marketType === "spread";
            const fmtTipProj = (isSpread && Number(p.tipProjectedMean) > 0) ? `+${p.tipProjectedMean}` : `${p.tipProjectedMean}`;
            const fmtBdProj = (isSpread && Number(p.bdProjectedMean) > 0) ? `+${p.bdProjectedMean}` : `${p.bdProjectedMean}`;
            const ledgerTier = getTierFromEv(p.tipEvPct);
            const tipColor = getTierColor(ledgerTier);
            const bdTier = getTierFromEv(p.bdEvPct);
            const bdColor = getTierColor(bdTier);

            let gradedTip = "PENDING";
            let gradedBd = "PENDING";
            let missByPts = 0;
            let gradedFloor = "PENDING";
            let floorMissBy = 0;
            let gradedCeiling = "PENDING";
            let ceilingMissBy = 0;

            if (isFinal && espnMatch) {
                const tipResObj = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.baseLine, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalPick(p.tipProjectedMean, p.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                const bdResObj = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.baseLine, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalPick(p.bdProjectedMean, p.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                const floorResObj = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.safeFloorHookNum, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalPick(p.tipProjectedMean, p.safeFloorHookNum, espnMatch.homeScore, espnMatch.awayScore);
                const ceilingResObj = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.ceilingHookNum, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalPick(p.tipProjectedMean, p.ceilingHookNum, espnMatch.homeScore, espnMatch.awayScore);

                gradedTip = tipResObj.outcome;
                gradedBd = bdResObj.outcome;
                missByPts = tipResObj.missBy;
                gradedFloor = floorResObj.outcome;
                floorMissBy = floorResObj.missBy;
                gradedCeiling = ceilingResObj.outcome;
                ceilingMissBy = ceilingResObj.missBy;
            }

            if (isFinal && (gradedTip === "HIT" || gradedTip === "MISS" || gradedTip === "BLUE_BALLS")) {
                const rowHTML = buildStandardVaultRowHTML(
                    weekLabel, g.matchup, statusLabel, isSpread ? "SPREAD" : "TOTAL (O/U)", p.flagshipSlot,
                    p.player, ledgerTier, p.baseLine, p.baseOdds, tipColor, fmtTipProj, p.tipModelPct, p.tipEvPct,
                    showBallsDeep, bdColor, fmtBdProj, p.bdModelPct, p.bdEvPct,
                    p.safeFloorLabel, p.safeFloorWinPct, p.bdAltLabel, p.bdAltEvPct, gradedTip, missByPts
                );

                tallyGrade("tip_all", gradedTip);
                tallyGrade("balls_deep_all", gradedBd);
                vaultRows.tip_vs_bd.push(rowHTML);

                tallyGrade("safe_floors", gradedFloor);
                tallyGrade("ceilings", gradedCeiling);
                vaultRows.floors_ceilings.push(
                    buildFloorCeilingVaultRowHTML(
                        weekLabel, g.matchup, statusLabel, isSpread ? "SPREAD" : "TOTAL (O/U)", p.player, p.baseLine,
                        p.safeFloorLabel, p.safeFloorWinPct, gradedFloor, floorMissBy,
                        p.bdAltLabel, p.bdAltEvPct, gradedCeiling, ceilingMissBy
                    )
                );

                if (p.flagshipSlot) {
                    tallyGrade("flagship_5pack", gradedTip);
                    if (p.flagshipSlot.includes("MÉNAGE")) tallyGrade("menage_a_trois", gradedTip);

                    const wkObj = ensureWeekFivePackBucket(weekLabel);
                    tallyGradeToObj(wkObj, gradedTip);
                    if (p.flagshipSlot.includes("MÉNAGE")) tallyGradeToObj(wkObj.menage, gradedTip);
                    wkObj.rows.push(rowHTML);
                    vaultRows.flagship_5pack.push({ weekLabel, rowHTML });
                }

                if (ledgerTier === "SMASH") {
                    tallyGrade("overall_smash", gradedTip);
                    tallyGrade(isSpread ? "spread_smash" : "total_smash", gradedTip);
                    vaultRows.overall_smash.push(rowHTML);
                } else if (ledgerTier === "TOO_CLOSE") {
                    tallyGrade("all_tease", gradedTip);
                    vaultRows.all_tease.push(rowHTML);
                }
            } else {
                // Game has NOT ended yet -> Keep it open and visible in the Upcoming & In-Play table!
                upcomingRowsHTML += `
                    <tr>
                        <td><strong>${g.matchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                        <td>${isSpread ? 'SPREAD' : 'TOTAL (O/U)'} ${p.flagshipSlot ? `<br><span class="${p.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>` : ""}</td>
                        <td><strong>${p.player}</strong> ${renderTierBadgeHTML(ledgerTier)}</td>
                        <td>${p.baseLine} (${p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds})</td>
                        <td style="color:${tipColor};">Proj: <strong>${fmtTipProj}</strong> (${p.tipModelPct}% | ${p.tipEvPct > 0 ? '+' : ''}${p.tipEvPct}% EV)</td>
                        <td>${showBallsDeep ? `<span style="color:${bdColor};">Proj: <strong>${fmtBdProj}</strong> (${p.bdModelPct}% | ${p.bdEvPct > 0 ? '+' : ''}${p.bdEvPct}% EV)<br><small style="color:var(--accent-cyan);">🛡️ ${p.safeFloorLabel} (${p.safeFloorWinPct}%)</small> • <small style="color:var(--accent-gold);">🎯 ${p.bdAltLabel} (${p.bdAltEvPct > 0 ? '+' : ''}${p.bdAltEvPct}% EV)</small></span>` : renderLockCellHTML()}</td>
                        <td>${renderGradeBadge(gradedTip, missByPts)}</td>
                    </tr>
                `;
            }
        });
    });

    const fmtBucketObj = (b) => {
        if (!b || !b.total) return "0W - 0L - 0BB (0.0%)";
        const pct = ((b.hits / b.total) * 100).toFixed(1);
        return `${b.hits}W - ${b.misses}L - <span style="color:#60a5fa;">${b.blueBalls}BB</span> (${pct}%)`;
    };

    const fmtBucket = (key) => fmtBucketObj(buckets[key]);

    const fmtTraps = () => {
        const c = buckets.champagne_room;
        if (!c || !c.total) return "0 / 0 Dodged (0.0%)";
        const pct = ((c.dodged / c.total) * 100).toFixed(1);
        return `${c.dodged} / ${c.total} Dodged (${pct}%)`;
    };

    // Build Flagship 5-Pack Week Dropdown Options with "X/5" score next to each week
    const availableFivePackWeeks = Object.keys(fivePackByWeek).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numB - numA;
    });

    if (AppState.selectedFivePackWeek !== "ALL" && !fivePackByWeek[AppState.selectedFivePackWeek]) {
        AppState.selectedFivePackWeek = "ALL";
    }

    const activeFivePackRecordBucket = (AppState.selectedFivePackWeek === "ALL")
        ? buckets.flagship_5pack
        : fivePackByWeek[AppState.selectedFivePackWeek];

    const activeMenageRecordBucket = (AppState.selectedFivePackWeek === "ALL")
        ? buckets.menage_a_trois
        : fivePackByWeek[AppState.selectedFivePackWeek].menage;

    const totalFivePackWeeksCount = Math.max(1, availableFivePackWeeks.length) * 5;
    const weekDropdownHTML = `
        <select onchange="window.setFivePackVaultWeek(this.value, event)" onclick="event.stopPropagation()" style="background:#0f172a; color:var(--accent-gold); border:1px solid rgba(245,158,11,0.55); border-radius:4px; padding:2px 6px; font-family:var(--font-mono); font-size:10.5px; font-weight:800; cursor:pointer;">
            <option value="ALL" ${AppState.selectedFivePackWeek === "ALL" ? "selected" : ""}>All Weeks (${buckets.flagship_5pack.hits}/${totalFivePackWeeksCount})</option>
            ${availableFivePackWeeks.map(wk => {
                const wObj = fivePackByWeek[wk];
                return `<option value="${wk}" ${AppState.selectedFivePackWeek === wk ? "selected" : ""}>${wk} (${wObj.hits}/5)</option>`;
            }).join("")}
        </select>
    `;

    // Build the Active Clickable Vault Drawer HTML (opens directly below the 6 scorecard cards when clicked)
    let activeVaultDrawerHTML = "";
    if (AppState.activeLedgerVault) {
        let vaultTitle = "";
        let vaultAccentColor = "var(--accent-cyan)";
        let selectedRowsHTML = "";
        const isFloorsCeilingsVault = (AppState.activeLedgerVault === "floors_ceilings");

        if (AppState.activeLedgerVault === "flagship_5pack") {
            const wkFilter = AppState.selectedFivePackWeek;
            const wkScoreTag = wkFilter === "ALL"
                ? `ALL WEEKS (${buckets.flagship_5pack.hits}/${totalFivePackWeeksCount} HIT)`
                : `${wkFilter.toUpperCase()} (${fivePackByWeek[wkFilter].hits}/5 HIT)`;
            vaultTitle = `👑 FLAGSHIP 5-PACK &amp; MÉNAGE À TROIS VAULT // ${wkScoreTag}`;
            vaultAccentColor = "var(--accent-gold)";
            const matchingRows = vaultRows.flagship_5pack
                .filter(item => wkFilter === "ALL" || item.weekLabel === wkFilter)
                .map(item => item.rowHTML);
            selectedRowsHTML = matchingRows.join("");
        } else if (AppState.activeLedgerVault === "overall_smash") {
            vaultTitle = `🔥 OFFICIAL SMASH VAULT (&ge;+10.0% EV COMPLETED RECEIPTS) // ${fmtBucket("overall_smash")}`;
            vaultAccentColor = "var(--accent-emerald)";
            selectedRowsHTML = vaultRows.overall_smash.join("");
        } else if (AppState.activeLedgerVault === "all_tease") {
            vaultTitle = `🔵 ALL TEASE, NO SQUEEZE VAULT (&plusmn;10% EV COMPLETED RECEIPTS) // ${fmtBucket("all_tease")}`;
            vaultAccentColor = "#60a5fa";
            selectedRowsHTML = vaultRows.all_tease.join("");
        } else if (AppState.activeLedgerVault === "grenades_dodged") {
            vaultTitle = `💣 GRENADES DODGED VAULT (&le;-10% EV PUBLIC TRAPS AVOIDED) // ${fmtTraps()}`;
            vaultAccentColor = "var(--accent-danger)";
            selectedRowsHTML = vaultRows.grenades_dodged.join("");
        } else if (isFloorsCeilingsVault) {
            vaultTitle = `🛡️ SAFE FLOORS (-2&phi;) &amp; 🎯 CEILING ESCALATORS (+&phi;) VAULT // Floors: ${fmtBucket("safe_floors")} • Ceilings: ${fmtBucket("ceilings")}`;
            vaultAccentColor = "var(--accent-gold)";
            selectedRowsHTML = vaultRows.floors_ceilings.join("");
        } else if (AppState.activeLedgerVault === "tip_vs_bd") {
            vaultTitle = `⚡ TIP vs. BALLS DEEP MASTER ARCHIVE (ALL COMPLETED GAMES)`;
            vaultAccentColor = "var(--accent-cyan)";
            selectedRowsHTML = vaultRows.tip_vs_bd.join("");
        }

        const vaultTableHeadHTML = isFloorsCeilingsVault
            ? `
                <tr>
                    <th>Week &amp; Final Score</th>
                    <th>Market</th>
                    <th>Base Model Pick</th>
                    <th>🛡️ Safe Floor (-2&phi; / -175)</th>
                    <th>Floor Result</th>
                    <th>🎯 Ceiling Escalator (+&phi;)</th>
                    <th>Ceiling Result</th>
                </tr>
            `
            : `
                <tr>
                    <th>Week &amp; Final Score</th>
                    <th>Market &amp; Slot</th>
                    <th>Official Model Pick</th>
                    <th>Vegas Closing</th>
                    <th>Just the Tip Closing</th>
                    <th>${AppState.activeLedgerVault === "grenades_dodged" ? "Counter-Strike Fade Outcome" : "Balls Deep Closing"}</th>
                    <th>Graded Result</th>
                </tr>
            `;

        activeVaultDrawerHTML = `
            <div style="margin-bottom: 22px; border: 1px solid ${vaultAccentColor}; border-radius: 8px; background: #0f172a; box-shadow: 0 8px 24px rgba(0,0,0,0.5); overflow: hidden;">
                <div style="padding: 12px 16px; background: rgba(30, 41, 59, 0.85); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <span style="font-family: var(--font-mono); font-size: 12.5px; font-weight: 800; color: ${vaultAccentColor};">
                        📂 ${vaultTitle}
                    </span>
                    <button class="calc-action-btn" onclick="window.toggleLedgerVault('${AppState.activeLedgerVault}', event)" style="font-size: 11px; padding: 4px 10px;">
                        ✕ Close Vault ▲
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="quant-table">
                        <thead>
                            ${vaultTableHeadHTML}
                        </thead>
                        <tbody>
                            ${selectedRowsHTML || `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); padding:18px;">No completed games in this vault yet—active games move here automatically as soon as they hit FINAL.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    const cardActiveStyle = (key, defaultBorder) => (AppState.activeLedgerVault === key)
        ? `border: 2px solid var(--accent-cyan); box-shadow: 0 0 16px rgba(6, 182, 212, 0.35);`
        : `border: 1px solid ${defaultBorder};`;

    container.innerHTML = `
        ${buildLedgerLegendHTML()}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 20px; font-family: var(--font-mono);">
            <div onclick="window.toggleLedgerVault('flagship_5pack', event)" style="cursor: pointer; background: var(--bg-elevated); ${cardActiveStyle('flagship_5pack', 'rgba(245, 158, 11, 0.5)')} border-radius: 8px; padding: 14px; transition: all 0.15s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 11px; color: var(--accent-gold); font-weight: 800;">👑 FLAGSHIP 5-PACK</span>
                    ${weekDropdownHTML}
                </div>
                <div style="font-size: 14.5px; font-weight: 800; margin: 6px 0;">5-Pack: ${fmtBucketObj(activeFivePackRecordBucket)}</div>
                <div style="font-size: 11.5px; color: var(--text-secondary);">Ménage à Trois: <strong>${fmtBucketObj(activeMenageRecordBucket)}</strong></div>
            </div>

            <div onclick="window.toggleLedgerVault('overall_smash', event)" style="cursor: pointer; background: var(--bg-elevated); ${cardActiveStyle('overall_smash', 'rgba(16, 185, 129, 0.45)')} border-radius: 8px; padding: 14px; transition: all 0.15s ease;">
                <div style="font-size: 11px; color: var(--accent-emerald); font-weight: 800;">🔥 OFFICIAL SMASH (&ge;+10.0% EV)</div>
                <div style="font-size: 14.5px; font-weight: 800; margin: 6px 0;">${fmtBucket("overall_smash")}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    Spreads: <strong>${fmtBucket("spread_smash")}</strong><br>Totals: <strong>${fmtBucket("total_smash")}</strong>
                </div>
            </div>

            <div onclick="window.toggleLedgerVault('all_tease', event)" style="cursor: pointer; background: var(--bg-elevated); ${cardActiveStyle('all_tease', 'rgba(59, 130, 246, 0.45)')} border-radius: 8px; padding: 14px; transition: all 0.15s ease;">
                <div style="font-size: 11px; color: #60a5fa; font-weight: 800;">🔵 ALL TEASE, NO SQUEEZE (&plusmn;10% EV)</div>
                <div style="font-size: 14.5px; font-weight: 800; margin: 6px 0; color: var(--text-primary);">${fmtBucket("all_tease")}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Coin-flip zone | BB = Missed line by &le;3 pts</div>
            </div>

            <div onclick="window.toggleLedgerVault('grenades_dodged', event)" style="cursor: pointer; background: var(--bg-elevated); ${cardActiveStyle('grenades_dodged', 'rgba(239, 68, 68, 0.45)')} border-radius: 8px; padding: 14px; transition: all 0.15s ease;">
                <div style="font-size: 11px; color: var(--accent-danger); font-weight: 800;">💣 GRENADES DODGED (&le;-10% EV)</div>
                <div style="font-size: 15.5px; font-weight: 800; margin: 6px 0; color: var(--accent-emerald);">${fmtTraps()}</div>
                <div style="font-size: 11px; color: var(--text-muted);">You were a little too drunk to make that call last night</div>
            </div>

            <div onclick="window.toggleLedgerVault('floors_ceilings', event)" style="cursor: pointer; background: var(--bg-elevated); ${cardActiveStyle('floors_ceilings', 'rgba(245, 158, 11, 0.45)')} border-radius: 8px; padding: 14px; transition: all 0.15s ease;">
                <div style="font-size: 11px; color: var(--accent-gold); font-weight: 800;">🛡️ SAFE FLOORS &amp; 🎯 CEILINGS</div>
                <div style="font-size: 13px; font-weight: 800; margin: 6px 0; color: var(--accent-cyan);">🛡️ Floors (-2&phi;): ${fmtBucket("safe_floors")}</div>
                <div style="font-size: 12.5px; font-weight: 800; color: var(--accent-gold);">🎯 Ceilings (+&phi;): ${fmtBucket("ceilings")}</div>
            </div>

            <div onclick="window.toggleLedgerVault('tip_vs_bd', event)" style="cursor: pointer; background: var(--bg-elevated); ${cardActiveStyle('tip_vs_bd', 'rgba(6, 182, 212, 0.45)')} border-radius: 8px; padding: 14px; transition: all 0.15s ease;">
                <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 800;">⚡ TIP vs. BALLS DEEP HEAD-TO-HEAD</div>
                <div style="font-size: 13px; font-weight: 800; margin: 6px 0;">Tip: ${fmtBucket("tip_all")}</div>
                ${showBallsDeep
                    ? `<div style="font-size: 13px; font-weight: 800; color: var(--accent-emerald);">Balls Deep: ${fmtBucket("balls_deep_all")}</div>`
                    : `<div style="font-size: 11px; color: var(--accent-gold); cursor: pointer;" onclick="window.unlockBallsDeepMode(event)">🔒 Click to unlock Balls Deep Record</div>`
                }
            </div>
        </div>

        ${activeVaultDrawerHTML}

        <div style="margin-bottom: 10px; padding: 8px 14px; border-radius: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-family: var(--font-mono);">
            <span style="font-size: 12px; font-weight: 800; color: var(--accent-cyan);">
                🕒 ACTIVE WEEK // UPCOMING &amp; IN-PLAY CLOSING LINE LEDGER
            </span>
            <span style="font-size: 11px; color: var(--text-secondary);">
                Completed games move automatically into the 6 Scorecard Vaults above upon hitting FINAL
            </span>
        </div>

        <div class="table-responsive">
            <table class="quant-table">
                <thead>
                    <tr>
                        <th>Matchup &amp; Status</th>
                        <th>Market &amp; Slot</th>
                        <th>Official Model Pick</th>
                        <th>Vegas Closing</th>
                        <th>Just the Tip Closing</th>
                        <th>Balls Deep Closing</th>
                        <th>Graded Result</th>
                    </tr>
                </thead>
                <tbody>
                    ${upcomingRowsHTML}
                </tbody>
            </table>
        </div>
    `;
}

// ==========================================
// RESPONSIVE 5-PACK CSS & FIXED-BOTTOM ZERO-TOKEN ESPN LIVE WIRE TICKER (300s CRAWL)
// ==========================================
function ensureTickerStylesInjected() {
    if (document.getElementById("dixpix-ticker-keyframes")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "dixpix-ticker-keyframes";
    styleEl.textContent = `
        @keyframes dixpixMarqueeScroll {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
        }
        #dixpix-live-wire-track:hover {
            animation-play-state: paused !important;
        }
        #flagship-banner-toggle {
            position: relative;
            cursor: pointer;
            padding: 14px 145px;
            text-align: center;
            user-select: none;
        }
        .five-pack-corner-btn {
            position: absolute;
            top: 12px;
            right: 14px;
        }
        @media (max-width: 720px) {
            #flagship-banner-toggle {
                padding: 12px 14px !important;
            }
            .five-pack-corner-btn {
                position: static !important;
                display: inline-block !important;
                margin-bottom: 8px !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
    document.body.style.paddingBottom = "46px";
}

function renderLiveBottomTicker() {
    ensureTickerStylesInjected();

    let tickerBar = document.getElementById("dixpix-live-wire-bar");
    if (!tickerBar) {
        tickerBar = document.createElement("div");
        tickerBar.id = "dixpix-live-wire-bar";
        tickerBar.style.cssText = "position:fixed; bottom:0; left:0; right:0; height:36px; background:rgba(9,13,22,0.96); border-top:1px solid rgba(245,158,11,0.55); box-shadow:0 -4px 16px rgba(0,0,0,0.65); z-index:9999; display:flex; align-items:center; overflow:hidden; font-family:var(--font-mono); font-size:11.5px;";
        document.body.appendChild(tickerBar);
    }

    const tickerItems = [];

    // 1. Add Permanent Graded Archive Highlights
    tickerItems.push(`<span style="color:var(--accent-emerald);font-weight:800;">🟢 FINAL: LAC 23 - BAL 20</span> <span style="color:var(--text-primary);">[BAL +6.5 ✅ HIT (+27.6% EV) • O 44.5 🔵 BLUE BALLS (-1.5 pts)]</span>`);

    // 2. Add Live / Final ESPN Feed Games + Current Week Slate Picks
    const currentWeekGames = AppState.processedGames.filter(g => g.isCurrentWeek);
    currentWeekGames.forEach(g => {
        const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[g.matchup];
        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread").sort((a, b) => b.tipEvPct - a.tipEvPct);
        const topSpread = gameSpreads[0];
        if (!topSpread) return;

        const pickTag = `${topSpread.player} (${topSpread.tipEvPct > 0 ? '+' : ''}${topSpread.tipEvPct}% EV)`;
        const tierColor = getTierColor(topSpread.tipBadge, true);

        if (espnMatch && espnMatch.state === "in") {
            tickerItems.push(`<span style="color:#ef4444;font-weight:800;">🔴 LIVE (${espnMatch.shortDetail || 'IN-PLAY'}): ${espnMatch.scoreStr}</span> <span style="color:${tierColor};">[Model: ${pickTag}]</span>`);
        } else if (espnMatch && espnMatch.state === "post") {
            tickerItems.push(`<span style="color:var(--accent-emerald);font-weight:800;">🟢 FINAL: ${espnMatch.scoreStr}</span> <span style="color:${tierColor};">[Model: ${pickTag}]</span>`);
        } else {
            let kickStr = "UPCOMING";
            if (g.commenceTime) {
                const dt = new Date(g.commenceTime);
                kickStr = dt.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase() + " " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            }
            const badgeStr = topSpread.tipBadge === "SMASH" ? "🔥 SMASH" : (topSpread.tipBadge === "PASS" ? "💣 PASS" : "⚖️ TEASE");
            tickerItems.push(`<span style="color:var(--accent-cyan);font-weight:700;">🕒 ${kickStr}: ${g.matchup}</span> <span style="color:${tierColor};">[${badgeStr}: ${pickTag}]</span>`);
        }
    });

    const joinedStrip = tickerItems.join(` <span style="color:rgba(245,158,11,0.55);margin:0 18px;">//</span> `);

    tickerBar.innerHTML = `
        <div style="flex-shrink:0; height:100%; padding:0 12px; background:linear-gradient(90deg, rgba(245,158,11,0.25), rgba(15,23,42,0.98)); border-right:1px solid rgba(245,158,11,0.55); display:flex; align-items:center; gap:7px; color:var(--accent-gold); font-weight:800; letter-spacing:0.03em; z-index:2;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent-emerald); box-shadow:0 0 8px var(--accent-emerald);"></span>
            📡 DIXPIX LIVE WIRE
        </div>
        <div style="flex:1; overflow:hidden; white-space:nowrap; position:relative;">
            <div id="dixpix-live-wire-track" style="display:inline-block; white-space:nowrap; padding-left:24px; animation: dixpixMarqueeScroll 300s linear infinite;">
                <span>${joinedStrip}</span>
                <span style="color:rgba(245,158,11,0.55);margin:0 18px;">//</span>
                <span>${joinedStrip}</span>
            </div>
        </div>
    `;
}
// === END OF APP_CONTROLLER.JS ===
