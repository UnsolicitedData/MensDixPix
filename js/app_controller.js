/**
 * DIXPIX QUANTITATIVE ENGINE — MASTER UI & COMBINATORICS CONTROLLER (v210)
 * - Strict League Filter: Displays ONLY NFL and AP/CFP Top-25 Ranked NCAA Matchups (Strips unranked G5/MAC noise)
 * - College SOS Baseline Anchor: Prevents +20.5/+25.5 NCAA dogs from projecting as -7.71 outright favorites
 * - Clean Team Code Normalizer: Fixes 4-letter fallback codes (NODA->ND, WAFO->WAKE, GETE->GT, MIST->MSU, etc.)
 * - Zero Page/Scroll Reset on Mode Switch + Dynamic Combinatorics Deck Updates Across Modes
 */

const AppState = {
    rawPayload: null,
    lastDataHash: "",
    activeMode: "tip",        // "tip" | "balls_deep" | "davinci"
    intensitySlider: 0.0,     // -1.618 to +1.618
    filters: { nfl: true, ncaa: true },
    comboFilters: { team: "ALL", market: "ALL", tier: "ALL" },
    selectedParlayLegs: new Set(),
    processedGames: [],
    processedProps: [],
    flagshipFivePack: []
};

const openCardMemory = new Set();
const MODEL_TOTAL_INTERCEPT = 42.986;
const SMASH_EV_CUTOFF = 10.0; // +10.0% EV threshold for SMASH
const PHI = 1.6180339887;
const PHI_OVER_PI = PHI / Math.PI; // ~0.5150362 (Module 13 Sacred Geometry Constant)

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
    "NODA": "ND",
    "NOIL": "NIU",
    "GETE": "GT",
    "WAFO": "WAKE",
    "MIST": "MSU",
    "UCBR": "UCLA",
    "IOHA": "IOWA",
    "KEWI": "UK",
    "HOCO": "HOU",
    "ARWI": "ARIZ",
    "ORST": "ORST",
    "SADI": "SDSU",
    "WEKE": "WKU",
    "WACA": "WCU",
    "בו": "BOIS"
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

document.addEventListener("DOMContentLoaded", () => {
    bindUIControls();
    pollDataFeed();
    setInterval(pollDataFeed, 5000);
    window.addEventListener("resize", () => {
        if (AppState.rawPayload) render_game_cards(AppState.rawPayload);
    });
});

// Single paywall/unlock router (preserves exact scroll position)
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

window.toggleParlayLeg = function(propKey) {
    const savedY = window.scrollY;
    if (AppState.selectedParlayLegs.has(propKey)) {
        AppState.selectedParlayLegs.delete(propKey);
    } else {
        AppState.selectedParlayLegs.add(propKey);
    }
    renderCombinatoricsDeck();
    window.scrollTo(window.scrollX, savedY);
};

window.loadFlagshipPreset = function(onlyMenage = false) {
    const savedY = window.scrollY;
    AppState.selectedParlayLegs.clear();
    AppState.flagshipFivePack.forEach(p => {
        if (!onlyMenage || (p.flagshipSlot && p.flagshipSlot.includes("MÉNAGE"))) {
            AppState.selectedParlayLegs.add(p.propKey);
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
// 10-ZONE FIBONACCI ELEVATION & MODULE 13 HELPERS
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

function calcSacredGeometryM13(homeTel, awayTel, m12NetTov) {
    const epaGap = (homeTel.net_epa_per_play || 0) - (awayTel.net_epa_per_play || 0);
    const rankGap = (homeTel.closing_rank_pct || 0.5) - (awayTel.closing_rank_pct || 0.5);
    const havocProxy = 1.0 + Math.abs(m12NetTov) * 0.45;
    const deltaContext = Math.max(-1.618, Math.min(1.618, (rankGap - epaGap * 2.2) * havocProxy * 1.382));
    const mRiseDelta = PHI_OVER_PI * (21.0 / 76.0) * deltaContext;
    return Number(mRiseDelta.toFixed(4));
}

function snapToHalfPointHook(lineVal, subtractPts = 3.0) {
    const rawTarget = lineVal - subtractPts;
    return Math.floor(rawTarget) + 0.5;
}

function renderLockCellHTML() {
    return `<span onclick="window.unlockBallsDeepMode(event)" title="Click to unlock Balls Deep Telemetry" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:3px 9px; border-radius:5px; background:rgba(245,158,11,0.12); border:1px dashed rgba(245,158,11,0.45); font-size:12px; transition:all 0.15s ease;">🔒</span>`;
}

// ==========================================
// MASTER CALCULATION PIPELINE (NFL + TOP-25 RANKED NCAA ONLY)
// ==========================================
function recalculateAndRenderAll() {
    if (!AppState.rawPayload || !AppState.rawPayload.games) return;

    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;

    const defaultLeague = (AppState.rawPayload.slate_info && AppState.rawPayload.slate_info.league) || "NFL";
    const mode = AppState.activeMode;
    const sliderVal = (mode === "davinci") ? AppState.intensitySlider : 0.0;
    const playScaler = (typeof GOLDEN_PLAY_SCALER !== "undefined") ? GOLDEN_PLAY_SCALER : 38.5145;

    AppState.processedGames = [];
    AppState.processedProps = [];

    AppState.rawPayload.games.forEach(game => {
        const gameLeague = game.league || defaultLeague;
        if (!shouldIncludeGame(game, defaultLeague)) return;

        const cleanHome = cleanTeamCode(game.home_team);
        const cleanAway = cleanTeamCode(game.away_team);

        const envPayload = game.environmental_payload || {};
        const circPayload = game.circadian_payload || {};
        const homeTel = (game.team_telemetry && game.team_telemetry.home) || {};
        const awayTel = (game.team_telemetry && game.team_telemetry.away) || {};

        const m7 = calcBarometricBallistics(envPayload);
        const m8 = calcCircadianStrain(circPayload, game.kickoff_local_hour);

        const m11Bd = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, "balls_deep", 0.0);
        const m12Bd = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, "balls_deep", 0.0);
        const psiElev = calcTenZoneElevationPsi(envPayload.elevation_m || 0, m7.airDensityRho);
        const m13Rise = calcSacredGeometryM13(homeTel, awayTel, m12Bd.netTurnoverEPA);

        const m11 = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, mode, sliderVal);
        const m12 = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, mode, sliderVal);

        // Extract Vegas Home Spread & Total Line so NCAA SOS talent gaps are respected
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

        const rawM9Base = calcFullGameFairMargin(game, m8.phiCircadianPenalty, 0, "tip");
        const windMph = envPayload.is_dome ? 0 : (envPayload.wind_mph || 0);
        const windPenalty = Math.max(0, (windMph - 10.0) * 0.25);

        // 1. JUST THE TIP BASELINE
        // For NCAA: Anchors to SOS Market Baseline + bounded DixPix Telemetry/Environment shift [-3.6, +3.6] pts
        // so +20.5/+25.5 college dogs never project to win outright by 7 points
        let fairHomeTip = rawM9Base.fairHomeSpread;
        if (gameLeague === "NCAA") {
            const rawEpaDiffPts = (rawM9Base.fairHomeSpread - vegasHomeSpread) * 0.14;
            const envCircShift = -m8.phiCircadianPenalty - ((m11Bd.phiBioScore + psiElev) * 1.2) - (m7.passGameModifierYards * 0.08);
            const boundedNcaaDelta = Math.max(-3.6, Math.min(3.6, rawEpaDiffPts + envCircShift));
            fairHomeTip = Number((vegasHomeSpread + boundedNcaaDelta).toFixed(2));
        }

        const m9Base = {
            fairHomeSpread: fairHomeTip,
            epaContribution: rawM9Base.epaContribution,
            activeCoupledOverlay: 0
        };

        // 2. BALLS DEEP COUPLED TELEMETRY VECTOR (Psi_11,12 bounded to [-3.85, +3.85] pts)
        const tovVector = -(m12Bd.netTurnoverEPA || 0) * PHI * 1.10;
        const bioElevVector = -(m11Bd.phiBioScore + psiElev) * PHI * 1.20;
        const m13Vector = -m13Rise * 10.5;
        const edgeAmplifier = Math.sign(fairHomeTip - vegasHomeSpread || -1) * (0.618 * (1.0 + Math.abs(m8.phiCircadianPenalty) * 0.35));
        const rawPsiBd = tovVector + bioElevVector + m13Vector + edgeAmplifier;
        const psiBd = Number(Math.max(-3.85, Math.min(3.85, rawPsiBd)).toFixed(2));

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
            m13Rise,
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
                let bdAltLineLabel = "";
                let bdLongerOdds = 145;
                let bdReachProb = 0.50;

                if (prop.market_type === "spread") {
                    // 1. JUST THE TIP BASELINE
                    baseProjectedLine = isHomeSpread ? m9Base.fairHomeSpread : Number((-m9Base.fairHomeSpread).toFixed(2));
                    const tipGap = vegasLine - baseProjectedLine;
                    tipModelProb = calcPointGapWinProb(tipGap);

                    // 2. BALLS DEEP PROJECTED MARGIN
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

                    // 3. LONGER-ODDS ESCALATOR (.5 Sportsbook Hook selling 3.0 pts for +145 odds)
                    const altSpreadHook = snapToHalfPointHook(vegasLine, 3.0);
                    bdAltLineLabel = `Alt ${altSpreadHook > 0 ? '+' + altSpreadHook.toFixed(1) : altSpreadHook.toFixed(1)} (+145)`;
                    bdLongerOdds = 145;
                    const altCoverGap = altSpreadHook - finalCalculatedLine;
                    bdReachProb = calcPointGapWinProb(altCoverGap);

                } else if (prop.market_type === "total") {
                    // 1. JUST THE TIP BASELINE
                    baseProjectedLine = baseTelemetryTotal;
                    const tipTotalDiff = baseProjectedLine - vegasLine;
                    tipModelProb = calcPointGapWinProb(Math.abs(tipTotalDiff));

                    // 2. BALLS DEEP PROJECTED TOTAL
                    const dirSign = tipTotalDiff >= 0 ? 1 : -1;
                    const bdTotalShift = dirSign * Math.min(4.2, (Math.abs(psiBd) * 0.45 + Math.abs(m7.passGameModifierYards) * 0.22 + 1.5));
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

                    // 3. LONGER-ODDS TOTAL ESCALATOR (.5 Sportsbook Hook selling 3.0 pts for +155 odds)
                    const isUnderTip = baseProjectedLine < vegasLine;
                    const altTotalHook = isUnderTip
                        ? (Math.floor(vegasLine - 3.0) + 0.5)
                        : (Math.floor(vegasLine + 3.0) + 0.5);
                    bdAltLineLabel = `Alt ${isUnderTip ? 'U' : 'O'} ${altTotalHook.toFixed(1)} (+155)`;
                    bdLongerOdds = 155;
                    const altTotalEdge = isUnderTip
                        ? (altTotalHook - finalCalculatedLine)
                        : (finalCalculatedLine - altTotalHook);
                    bdReachProb = calcPointGapWinProb(altTotalEdge);

                } else {
                    baseProjectedLine = prop.projected_mean_mu || vegasLine || 50;
                    const gammaRes = calcGammaSurvivalProb(baseProjectedLine, prop.projected_variance_sigma2 || 225, vegasLine || 45.5);
                    tipModelProb = gammaRes.trueOverProb;
                    bdModelProb = Math.max(0.01, Math.min(0.99, tipModelProb + (psiBd * 0.04)));
                    bdProjectedLine = Number((baseProjectedLine * 1.12).toFixed(1));
                    finalCalculatedLine = (mode === "tip") ? baseProjectedLine : bdProjectedLine;
                    activeModelProb = (mode === "tip") ? tipModelProb : bdModelProb;
                    bdAltLineLabel = `Alt Milestone (+160)`;
                    bdLongerOdds = 160;
                    bdReachProb = Math.max(0.05, activeModelProb - 0.08);
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
                const tipBadge = tipEvPct >= SMASH_EV_CUTOFF ? "SMASH" : "PASS";

                const activeWinPct = Number((activeModelProb * 100).toFixed(2));
                const activeEvPct = Number(m2Active.evPercentage.toFixed(2));
                const activeBadge = activeEvPct >= SMASH_EV_CUTOFF ? "SMASH" : "PASS";

                AppState.processedProps.push({
                    propKey,
                    commenceTime: game.commence_time,
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
                    bdAltLabel: bdAltLineLabel,
                    bdAltEvPct: Number(m2BdAlt.evPercentage.toFixed(2)),
                    activeModelPct: activeWinPct,
                    activeModelProbRaw: activeModelProb,
                    evPct: activeEvPct,
                    quarterKellyPct: Number(m2Active.quarterKellyStakePct.toFixed(2)),
                    tierBadge: activeBadge,
                    flagshipSlot: prop.flagship_slot || "",
                    psiBd,
                    psiActive: psi11_12
                });
            });
        }
    });

    // Lock Flagship 5-Pack Selection to tipEvPct across NFL + Top-25 Ranked NCAA
    AppState.processedProps.forEach(p => { p.flagshipSlot = ""; });
    const bestSpreadPerGame = [];
    const remainingPool = [];

    AppState.processedGames.forEach(g => {
        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread");
        if (gameSpreads.length > 0) {
            gameSpreads.sort((a, b) => b.tipEvPct - a.tipEvPct);
            bestSpreadPerGame.push(gameSpreads[0]);
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

    renderFlagshipFivePack();
    render_game_cards(AppState.rawPayload);
    renderCombinatoricsDeck();
    renderCompendiumBoard();
    renderTelemetryInspector();
    renderBioWeatherLab();
    renderHistoricalLedger();

    window.scrollTo(savedScrollX, savedScrollY);
    requestAnimationFrame(() => {
        window.scrollTo(savedScrollX, savedScrollY);
    });
}

function renderTierBadgeHTML(tierBadge) {
    if (tierBadge === "SMASH") {
        return `<span class="badge-smash">SMASH</span>`;
    }
    return `<span class="badge-pass" style="background: rgba(239, 68, 68, 0.16); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.45); font-weight: 800;">PASS</span>`;
}

function buildBallsDeepBoxHTML(engineProp, isSpread) {
    if (AppState.activeMode === "tip") {
        return "";
    }

    const isBdSmash = engineProp.evPct >= SMASH_EV_CUTOFF;
    const boxBg = isBdSmash ? "rgba(16, 185, 129, 0.09)" : "rgba(239, 68, 68, 0.09)";
    const boxBorder = isBdSmash ? "rgba(16, 185, 129, 0.42)" : "rgba(239, 68, 68, 0.42)";
    const activeColor = isBdSmash ? "var(--accent-emerald)" : "var(--accent-danger)";

    const activeLabel = AppState.activeMode === "davinci" ? "DAVINCI PROJ" : "BALLS DEEP PROJ";
    const activeProj = (isSpread && Number(engineProp.projectedMean) > 0) ? `+${engineProp.projectedMean}` : `${engineProp.projectedMean}`;
    const activeEvStr = `${engineProp.evPct > 0 ? '+' : ''}${engineProp.evPct}% EV`;
    const altEvStr = `${engineProp.bdAltEvPct > 0 ? '+' : ''}${engineProp.bdAltEvPct}% EV`;

    // Only show the ⚡ BALLS DEEP PROJ lightning bolt on Totals and the favored Spread cover side (Win >= 50%)
    const showLightningBolt = !isSpread || (engineProp.tipModelPct >= 50.0);

    const boltRowHTML = showLightningBolt
        ? `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 4px;">
                <span style="color: ${activeColor}; font-weight: 800;">⚡ ${activeLabel}: ${activeProj} | Win: ${engineProp.activeModelPct}% (${activeEvStr})</span>
            </div>
        `
        : "";

    return `
        <div class="bd-preview-unlocked" style="background: ${boxBg}; border: 1px solid ${boxBorder}; flex-direction: column; align-items: stretch; gap: 4px;">
            ${boltRowHTML}
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px;">
                <span style="color: var(--accent-gold); font-weight: 700;">🎯 Longer-Odds Escalator: ${engineProp.bdAltLabel} (${altEvStr})</span>
                <span style="color: var(--text-secondary);">Coupled Ψ_11,12: <strong>${engineProp.psiActive > 0 ? '+' : ''}${engineProp.psiActive} pts</strong></span>
            </div>
        </div>
    `;
}

function renderFlagshipFivePack() {
    const container = document.getElementById("flagship-five-pack-container");
    if (!container) return;

    if (AppState.flagshipFivePack.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.style.maxWidth = "820px";
    container.style.margin = "0 auto 24px auto";
    container.style.border = "1px solid rgba(245, 158, 11, 0.55)";
    container.style.borderRadius = "8px";
    container.style.backgroundColor = "#111827";
    container.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.5)";

    const bannerKey = "FLAGSHIP_5_PACK_DRAWER";
    const isExpanded = openCardMemory.has(bannerKey);

    const modeTitle = AppState.activeMode === "tip"
        ? "Just the Tip Baseline"
        : (AppState.activeMode === "balls_deep" ? "Balls Deep Coupled Escalator" : "DaVinci Override Mode");

    const singleLockedStatusHTML = AppState.activeMode === "tip"
        ? `
            <div onclick="window.unlockBallsDeepMode(event)" style="margin: 10px auto 4px auto; max-width: 480px; padding: 7px 14px; border-radius: 6px; background: rgba(9, 13, 22, 0.78); border: 1px dashed rgba(245, 158, 11, 0.45); opacity: 0.85; font-family: var(--font-mono); font-size: 11px; color: var(--accent-gold); font-weight: 700; text-align: center; cursor: pointer; user-select: none;">
                🔒 BALLS DEEP — "You gotta pay to go balls deep..." (Click to Unlock)
            </div>
        `
        : `
            <div style="margin: 10px auto 4px auto; max-width: 480px; padding: 6px 14px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); font-family: var(--font-mono); font-size: 11px; color: var(--accent-emerald); font-weight: 700; text-align: center;">
                🔓 BALLS DEEP LONGER-ODDS ESCALATOR UNLOCKED (Ψ_11,12 ACTIVE)
            </div>
        `;

    container.innerHTML = `
        <div id="flagship-banner-toggle" style="cursor: pointer; padding: 14px 20px; text-align: center; background: linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(6, 182, 212, 0.10), rgba(245, 158, 11, 0.16)); user-select: none;">
            <div style="font-size: 15px; font-weight: 800; color: var(--accent-gold); letter-spacing: 0.04em;">
                👑 THE DIXPIX FLAGSHIP 5-PACK // FEATURING "THE MÉNAGE À TROIS"
            </div>
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                Active Engine: <strong style="color: var(--accent-cyan);">${modeTitle}</strong>
            </div>
            ${singleLockedStatusHTML}
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-primary); text-decoration: underline; margin-top: 6px;">
                ${isExpanded ? 'Click to collapse 5-Pack ▲' : 'Click to unlock &amp; expand all 5 Flagship Plays ▼'}
            </div>
        </div>

        <div id="flagship-banner-drawer" style="display: ${isExpanded ? 'block' : 'none'}; padding: 14px 18px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface);">
            ${AppState.flagshipFivePack.map((p, idx) => {
                const isMenage = p.flagshipSlot.includes("MÉNAGE");
                const isSpread = p.marketType === "spread";

                // In "Just the Tip" mode, show the Vegas Favorite side (matching the game cards) so underdog projections aren't misread
                let displayProp = p;
                if (AppState.activeMode === "tip" && isSpread && p.baseLine > 0) {
                    const favSide = AppState.processedProps.find(
                        ep => ep.gameId === p.gameId && ep.marketType === "spread" && ep.baseLine <= 0
                    );
                    if (favSide) displayProp = favSide;
                }

                const tipIsSmash = displayProp.tipBadge === "SMASH";
                const fmtTipProj = (isSpread && Number(displayProp.tipProjectedMean) > 0)
                    ? `+${displayProp.tipProjectedMean}`
                    : `${displayProp.tipProjectedMean}`;
                const tipEvStr = `${displayProp.tipEvPct > 0 ? '+' : ''}${displayProp.tipEvPct}% EV`;

                return `
                    <div style="padding: 10px 0; ${idx < AppState.flagshipFivePack.length - 1 ? 'border-bottom: 1px solid #1e293b;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span class="${isMenage ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>
                                <strong style="font-size: 13px; color: var(--text-primary);">${displayProp.player}</strong>
                            </div>
                            ${renderTierBadgeHTML(displayProp.tipBadge)}
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 12px; color: ${tipIsSmash ? 'var(--accent-emerald)' : 'var(--accent-danger)'};">
                            Proj: <strong>${fmtTipProj}</strong> | Win: <strong>${displayProp.tipModelPct}%</strong> (${tipEvStr})
                        </div>
                        ${buildBallsDeepBoxHTML(displayProp, isSpread)}
                    </div>
                `;
            }).join("")}
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
// INDEPENDENT MASONRY FLEX COLUMNS (NFL + TOP-25 RANKED NCAA ONLY)
// ==========================================
function render_game_cards(data) {
    const container = document.getElementById("master-board-body");
    if (!container) return;

    const defaultLeague = (data.slate_info && data.slate_info.league) || "NFL";
    const games = (data.games || []).filter(g => shouldIncludeGame(g, defaultLeague));

    if (games.length === 0) {
        container.innerHTML = "";
        return;
    }

    const containerWidth = container.clientWidth || window.innerWidth || 1200;
    const numCols = Math.max(1, Math.min(4, Math.floor(containerWidth / 340)));

    container.style.display = "flex";
    container.style.alignItems = "flex-start";
    container.style.gap = "15px";

    const fragment = document.createDocumentFragment();
    const colElements = [];
    for (let c = 0; c < numCols; c++) {
        const colDiv = document.createElement("div");
        colDiv.style.flex = "1";
        colDiv.style.minWidth = "0";
        colDiv.style.display = "flex";
        colDiv.style.flexDirection = "column";
        colDiv.style.gap = "15px";
        fragment.appendChild(colDiv);
        colElements.push(colDiv);
    }

    const cardSubtitle = AppState.activeMode === "tip"
        ? "Click to expand lines &amp; EV%"
        : "Click to expand lines, EV% &amp; Balls Deep Escalator";

    games.forEach((game, gameIndex) => {
        const cardKey = game.game_id || `${game.away_team}@${game.home_team}`;
        const cleanHome = cleanTeamCode(game.home_team);
        const cleanAway = cleanTeamCode(game.away_team);

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
        card.style.border = "1px solid #334155";
        card.style.borderRadius = "8px";
        card.style.backgroundColor = "#1e293b";
        card.style.padding = "15px";
        card.style.cursor = "pointer";
        card.style.color = "#e2e8f0";
        card.style.width = "100%";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px;">
                <span style="font-size: 0.85em; color: #94a3b8;">${gameDate} @ ${gameTime}</span>
                <span style="font-size: 0.85em; color: #94a3b8;">${weatherString}</span>
            </div>
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

        // In "Just the Tip" mode: Show ONLY Vegas Favorite Spread + Total (O/U)
        // In "Balls Deep" / "DaVinci" mode: Show EVERYTHING
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
                const tipIsSmash = engineData.tipBadge === "SMASH";
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
                    <div style="font-family: var(--font-mono); font-size: 0.82em; color: ${tipIsSmash ? '#22c55e' : '#ef4444'};">
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

    container.replaceChildren(fragment);
}

// ==========================================
// COMBINATORICS & ROUND ROBIN DECK
// ==========================================
function renderCombinatoricsDeck() {
    const container = document.getElementById("combinatorics-container");
    if (!container) return;

    const isUnlockedMode = (AppState.activeMode === "balls_deep" || AppState.activeMode === "davinci");
    const modeTag = AppState.activeMode === "tip"
        ? "JUST THE TIP BASELINE"
        : (AppState.activeMode === "balls_deep" ? "BALLS DEEP ESCALATOR ACTIVE" : "DAVINCI OVERRIDE ACTIVE");

    const selectedProps = AppState.processedProps.filter(p => AppState.selectedParlayLegs.has(p.propKey));
    const legsPayload = selectedProps.map(p => ({
        americanOdds: p.baseOdds,
        trueProb: p.activeModelProbRaw
    }));

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
                        🧮 PARLAY &amp; ROUND ROBIN CALCULATOR // <span style="color: var(--accent-gold);">${modeTag}</span>
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
                    <button class="calc-action-btn" onclick="window.clearParlaySlip(event)">
                        ✕ Clear Slip (${selectedProps.length})
                    </button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-family: var(--font-mono); font-size: 12px;">
                <div style="background: var(--bg-base); padding: 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-secondary); font-size: 10px;">SELECTED LEGS</div>
                    <div style="font-size: 16px; font-weight: 800; color: var(--text-primary);">${selectedProps.length} Legs</div>
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
                    <div style="font-size: 16px; font-weight: 800; color: ${m10.evBoostPct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-danger)'};">
                        ${selectedProps.length ? (m10.evBoostPct > 0 ? '+' : '') + m10.evBoostPct + '%' : '0.00%'}
                    </div>
                </div>
            </div>

            ${rrTiers.length > 0 ? `
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-subtle); display: flex; gap: 16px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 11px;">
                    <span style="color: var(--accent-gold); font-weight: 700;">ROUND ROBIN MATRIX:</span>
                    ${rrTiers.map(t => `
                        <span>
                            <strong>${t.legSize}:</strong> Avg ${t.avgMultiplier}x | Win ${t.avgWinProbPct}% |
                            <span style="color: ${t.expectedRoiPct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-danger)'};">
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
                    const isSpread = p.marketType === "spread";
                    const isSmash = p.tierBadge === "SMASH";
                    const fmtProj = (isSpread && Number(p.projectedMean) > 0) ? `+${p.projectedMean}` : `${p.projectedMean}`;
                    const evStr = `${p.evPct > 0 ? '+' : ''}${p.evPct}% EV`;
                    const altEvStr = `${p.bdAltEvPct > 0 ? '+' : ''}${p.bdAltEvPct}% EV`;

                    return `
                        <div onclick="window.toggleParlayLeg('${p.propKey}')" style="cursor: pointer; padding: 12px 14px; border-radius: 8px; background: ${isSelected ? 'rgba(6, 182, 212, 0.14)' : 'var(--bg-elevated)'}; border: 1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; transition: all 0.15s ease;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">
                                    ${isSelected ? '✅ IN SLIP // ' : ''}${p.matchup}
                                </span>
                                <div style="display: flex; gap: 6px;">
                                    ${p.flagshipSlot ? `<span class="${p.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>` : ''}
                                    ${renderTierBadgeHTML(p.tierBadge)}
                                </div>
                            </div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
                                ${p.activePlayerLabel || p.player} <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">(${p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds})</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 12px; color: ${isSmash ? 'var(--accent-emerald)' : 'var(--accent-danger)'};">
                                <span>Proj: <strong>${fmtProj}</strong></span>
                                <span>Win: <strong>${p.activeModelPct}%</strong> (${evStr})</span>
                            </div>
                            ${isUnlockedMode ? `
                                <div style="margin-top: 6px; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.08); display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 10.5px;">
                                    <span style="color: var(--accent-gold);">🎯 ${p.bdAltLabel} (${altEvStr})</span>
                                    <span style="color: var(--text-secondary);">Tip: ${isSpread && Number(p.tipProjectedMean) > 0 ? '+' + p.tipProjectedMean : p.tipProjectedMean} | Ψ: ${p.psiActive > 0 ? '+' : ''}${p.psiActive}</span>
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
        ? "JUST THE TIP"
        : (AppState.activeMode === "balls_deep" ? "BALLS DEEP" : "DAVINCI");

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

function renderHistoricalLedger() {
    const container = document.getElementById("ledger-container");
    if (!container) return;

    const ledgerObj = (AppState.rawPayload && AppState.rawPayload.historical_ledger) || {};
    const summary = ledgerObj.summary || {};
    const showBallsDeep = (AppState.activeMode === "balls_deep" || AppState.activeMode === "davinci");

    const fmtBucket = (key) => {
        const b = summary[key];
        if (!b || !b.total) return "0 / 0 (0.0%)";
        return `${b.fraction} (${b.win_pct}%)`;
    };

    const renderGradeBadge = (res) => {
        if (res === "HIT") return `<span class="badge-smash" style="font-size:11px;">✅ HIT</span>`;
        if (res === "MISS") return `<span class="badge-pass" style="background:rgba(239,68,68,0.18);color:var(--accent-danger);border-color:rgba(239,68,68,0.45);font-size:11px;">❌ MISS</span>`;
        if (res === "PUSH") return `<span class="badge-pass" style="font-size:11px;">➖ PUSH</span>`;
        return `<span class="badge-pass" style="color:var(--accent-cyan);border-color:rgba(6,182,212,0.4);font-size:11px;">⏳ LOCKED / PENDING</span>`;
    };

    let rowsHTML = "";
    const entriesMap = ledgerObj.entries || {};

    AppState.processedGames.forEach(g => {
        const savedEntry = entriesMap[g.gameId] || {};
        const statusLabel = savedEntry.status === "FINAL"
            ? `<span style="color:var(--accent-emerald);font-weight:700;">FINAL (${savedEntry.final_score})</span>`
            : (savedEntry.is_locked ? `<span style="color:var(--accent-gold);font-weight:700;">🔒 IN-PLAY (CLOSING LOCKED)</span>` : `<span style="color:var(--text-secondary);">PRE-KICKOFF SNAPSHOT</span>`);

        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread").sort((a, b) => b.tipEvPct - a.tipEvPct);
        const gameTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "total");
        const topPicks = [
            { p: gameSpreads[0], savedRec: savedEntry.spread_record },
            { p: gameTotals[0], savedRec: savedEntry.total_record }
        ].filter(item => item.p);

        topPicks.forEach(({ p, savedRec }) => {
            const isSpread = p.marketType === "spread";
            const isSmash = p.evPct >= SMASH_EV_CUTOFF;
            const fmtTipProj = (isSpread && Number(p.tipProjectedMean) > 0) ? `+${p.tipProjectedMean}` : `${p.tipProjectedMean}`;
            const fmtBdProj = (isSpread && Number(p.bdProjectedMean) > 0) ? `+${p.bdProjectedMean}` : `${p.bdProjectedMean}`;
            const gradedRes = (savedRec && savedRec.result_tip) ? savedRec.result_tip : "PENDING";

            rowsHTML += `
                <tr>
                    <td><strong>${g.matchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                    <td>${isSpread ? 'SPREAD' : 'TOTAL (O/U)'} ${p.flagshipSlot ? `<br><span class="badge-menage">${p.flagshipSlot}</span>` : ""}</td>
                    <td><strong>${p.player}</strong> ${renderTierBadgeHTML(p.tipBadge)}</td>
                    <td>${p.baseLine} (${p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds})</td>
                    <td>Proj: <strong>${fmtTipProj}</strong> (${p.tipModelPct}% | ${p.tipEvPct > 0 ? '+' : ''}${p.tipEvPct}% EV)</td>
                    <td>${showBallsDeep ? `<span style="color:${isSmash ? 'var(--accent-emerald)' : 'var(--accent-danger)'};">Proj: <strong>${fmtBdProj}</strong> (${p.bdModelPct}% | ${p.bdEvPct > 0 ? '+' : ''}${p.bdEvPct}% EV)<br><small style="color:var(--accent-gold);">${p.bdAltLabel} (${p.bdAltEvPct > 0 ? '+' : ''}${p.bdAltEvPct}% EV)</small></span>` : renderLockCellHTML()}</td>
                    <td>${renderGradeBadge(gradedRes)}</td>
                </tr>
            `;
        });
    });

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 20px; font-family: var(--font-mono);">
            <div style="background: var(--bg-elevated); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-gold); font-weight: 800;">👑 FLAGSHIP 5-PACK &amp; MÉNAGE À TROIS</div>
                <div style="font-size: 18px; font-weight: 800; margin: 6px 0;">5-Pack: ${fmtBucket("flagship_5pack")}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Ménage à Trois (Top 3 Spreads): <strong>${fmtBucket("menage_a_trois")}</strong></div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(16, 185, 129, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-emerald); font-weight: 800;">🔥 OFFICIAL SMASH RECORD (&ge;+10.0% EV)</div>
                <div style="font-size: 18px; font-weight: 800; margin: 6px 0;">Overall: ${fmtBucket("overall_smash")}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Spreads: <strong>${fmtBucket("spread_smash")}</strong> | Totals: <strong>${fmtBucket("total_smash")}</strong>
                </div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-danger); font-weight: 800;">🛡️ PASS AUDIT (&lt;+10.0% EV LEANS)</div>
                <div style="font-size: 18px; font-weight: 800; margin: 6px 0; color: var(--text-secondary);">${fmtBucket("pass_audit")}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Tracks lower-edge games we passed on</div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(6, 182, 212, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 800;">⚡ TIP vs. BALLS DEEP HEAD-TO-HEAD</div>
                <div style="font-size: 14px; font-weight: 800; margin: 6px 0;">Just the Tip: ${fmtBucket("tip_all")}</div>
                ${showBallsDeep
                    ? `<div style="font-size: 14px; font-weight: 800; color: var(--accent-emerald);">Balls Deep: ${fmtBucket("balls_deep_all")}</div>`
                    : `<div style="font-size: 11px; color: var(--accent-gold); cursor: pointer;" onclick="window.unlockBallsDeepMode(event)">🔒 Click to unlock Balls Deep Record</div>`
                }
            </div>
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
                    ${rowsHTML}
                </tbody>
            </table>
        </div>
    `;
}
// === END OF APP_CONTROLLER.JS ===
