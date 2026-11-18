/**
 * DIXPIX QUANTITATIVE ENGINE — MASTER UI & COMBINATORICS CONTROLLER (v213)
 * - Clean Bare Lock Icons (no dashed border or opaque orange fill)
 * - Collapsible Decoder Ring & Betting Guide Drawer on Master Pick Board
 * - Collapsible Ledger Legend Drawer on Historical Ledger Tab
 * - 3-Tier EV System: SMASH (>= +10% EV), TOO CLOSE (-9.9% to +9.9% EV, blank badge + neutral slate), PASS (<= -10% EV)
 * - W - L - BB (Blue Balls <= 3.0 pts miss) + Champagne Room Rules Traps Avoided Counter
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
const SMASH_EV_CUTOFF = 10.0;  // >= +10.0% EV threshold for SMASH
const PASS_EV_CUTOFF = -10.0;  // <= -10.0% EV threshold for definitive PASS
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
    "ILFI": "ILL",
    "ARRA": "ARK",
    "BABE": "BAY",
    "ORST": "ORST",
    "SADI": "SDSU",
    "WEKE": "WKU",
    "WACA": "WCU"
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
    // Blank (no badge) for TOO_CLOSE (-9.99% to +9.99% EV)
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

// Clean bare lock icon (no dashed border or opaque orange background)
function renderLockCellHTML() {
    return `<span onclick="window.unlockBallsDeepMode(event)" title="Click to unlock Balls Deep Telemetry" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:15px; user-select:none;">🔒</span>`;
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

                    const altSpreadHook = snapToHalfPointHook(vegasLine, 3.0);
                    bdAltLineLabel = `Alt ${altSpreadHook > 0 ? '+' + altSpreadHook.toFixed(1) : altSpreadHook.toFixed(1)} (+145)`;
                    bdLongerOdds = 145;
                    const altCoverGap = altSpreadHook - finalCalculatedLine;
                    bdReachProb = calcPointGapWinProb(altCoverGap);

                } else if (prop.market_type === "total") {
                    baseProjectedLine = baseTelemetryTotal;
                    const tipTotalDiff = baseProjectedLine - vegasLine;
                    tipModelProb = calcPointGapWinProb(Math.abs(tipTotalDiff));

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
                const tipBadge = getTierFromEv(tipEvPct);

                const activeWinPct = Number((activeModelProb * 100).toFixed(2));
                const activeEvPct = Number(m2Active.evPercentage.toFixed(2));
                const activeBadge = getTierFromEv(activeEvPct);

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

    // Lock Flagship 5-Pack Selection to top SMASH plays across NFL + Top-25 Ranked NCAA
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

// Single Lightning Bolt Rule + 3-Tier Styling (Emerald SMASH / Neutral Slate TOO_CLOSE / Crimson PASS)
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

// Collapsible Master Pick Board Decoder Ring & Betting Guide (VIP Club Edition)
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
                        <div>• <strong>Bold Top Line</strong> (e.g. <em>MIA Spread +16.5</em> or <em>Total U 54.5</em>) is the <strong>Vegas Sportsbook Line</strong>—the cover charge on your betting slip.</div>
                        <div style="margin-top: 4px;">• <strong>Proj:</strong> is what our 13-Module Engine says is <em>actually</em> under the hood once the stage lights come on. When Vegas pads its number and our <strong>Proj</strong> exposes the gap, that spread is where we print your Win % and EV%.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">2. THE VIP FLOOR CODE (3-TIER EV)</div>
                        <div>• <span class="badge-smash" style="font-size:10px;">SMASH</span> <strong style="color:var(--accent-emerald);">(&ge;+10.0% EV):</strong> <em>Green-Light Money Shot.</em> Full-contact value (57.6%+ win rate). Pull your stack out and make it rain.</div>
                        <div style="margin-top: 4px;">• <strong style="color:#94a3b8;">Neutral Slate / No Badge (&plusmn;10% EV):</strong> <em>All Tease, No Squeeze.</em> She's winking from the stage, but Vegas priced it too tight to drop cash on. Enjoy the view, keep your wallet holstered.</div>
                        <div style="margin-top: 4px;">• <span class="badge-pass" style="background:rgba(239,68,68,0.16);color:#ef4444;border:1px solid rgba(239,68,68,0.45);font-size:10px;font-weight:800;">PASS</span> <strong style="color:var(--accent-danger);">(&le;-10.0% EV):</strong> <em>Champagne Room Rules.</em> Look, don't touch—a glitter-covered public trap trying to hustle your bankroll with zero happy ending.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-gold); margin-bottom: 4px;">3. PICK YOUR PLEASURE (TOP RIGHT)</div>
                        <div>• <strong style="color:var(--accent-cyan);">Just the Tip:</strong> Free window-shopping from the main floor. Shows Vegas Favorite spreads, Totals, and baseline M7–M9 projections.</div>
                        <div style="margin-top: 4px;">• <strong style="color:var(--accent-emerald);">Balls Deep:</strong> Full backstage VIP pass. Strips off the training wheels to expose every Underdog spread, our coupled Biophysical/Turnover/Sacred Geometry climax (&Psi;_11,12), <strong>⚡ BALLS DEEP PROJ</strong>, and <strong>🎯 Longer-Odds Escalator</strong> alt-lines (+145/+155).</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Flagship 5-Pack: All 5 Green SMASH plays with SMASH badge right next to the Vegas spread
function renderFlagshipFivePack() {
    const container = document.getElementById("flagship-five-pack-container");
    if (!container) return;

    if (AppState.flagshipFivePack.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.style.maxWidth = "820px";
    container.style.margin = "0 auto 24px auto";
    container.style.border = "none";
    container.style.backgroundColor = "transparent";
    container.style.boxShadow = "none";

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
        ${buildMasterBoardLegendHTML()}

        <div style="border: 1px solid rgba(245, 158, 11, 0.55); border-radius: 8px; background-color: #111827; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); overflow: hidden;">
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
                }).join("")}
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
                    <div style="font-size: 16px; font-weight: 800; color: ${getTierColor(getTierFromEv(m10.evBoostPct))};">
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
                    const isSpread = p.marketType === "spread";
                    const tierColor = getTierColor(p.tierBadge);
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
                            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 12px; color: ${tierColor};">
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

// ==========================================
// PERMANENT ARCHIVE SEED + ZERO-TOKEN ESPN SCOREBOARD SYNC & LEDGER
// ==========================================
const BLUE_BALLS_MARGIN = 3.0; // <= 3.0 pts miss from Vegas line = BLUE BALLS

const PERMANENT_LEDGER_ARCHIVE = {
    "nfl_mnf_lac_bal_2026_w10": {
        league: "NFL",
        matchup: "LAC @ BAL",
        status: "FINAL",
        final_score: "LAC 23 - BAL 20",
        is_locked: true,
        trap_avoided: true, // LAC -6.5 (-27.6% EV PASS) failed to cover -> Bankroll saved
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
            bd_alt_label: "Alt +3.5 (+145)",
            bd_alt_ev_pct: 41.80,
            flagship_slot: "",
            result_tip: "HIT",
            result_bd: "HIT",
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
            bd_alt_label: "Alt O 47.5 (+155)",
            bd_alt_ev_pct: 14.20,
            flagship_slot: "",
            result_tip: "BLUE_BALLS",
            result_bd: "BLUE_BALLS",
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
                const key = `${awayCode} @ ${homeCode}`;
                ESPN_SCORE_CACHE.gamesByMatchup[key] = {
                    league: ep.league,
                    homeCode,
                    awayCode,
                    homeScore,
                    awayScore,
                    state,
                    scoreStr: `${awayCode} ${awayScore} - ${homeCode} ${homeScore}`
                };
            });
        } catch (e) {
            // Silent fallback
        }
    }

    renderHistoricalLedger();
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

// Grades Spread with <= 3.0 pt Blue Balls detection
function gradeSpreadPick(isHomeSpread, baseLine, homeScore, awayScore) {
    const teamMargin = isHomeSpread ? (homeScore - awayScore) : (awayScore - homeScore);
    const coverDiff = teamMargin + Number(baseLine);
    if (coverDiff > 0) return { outcome: "HIT", missBy: 0 };
    if (coverDiff === 0) return { outcome: "PUSH", missBy: 0 };
    const missPts = Number(Math.abs(coverDiff).toFixed(1));
    if (missPts <= BLUE_BALLS_MARGIN) return { outcome: "BLUE_BALLS", missBy: missPts };
    return { outcome: "MISS", missBy: missPts };
}

// Grades Total (O/U) with <= 3.0 pt Blue Balls detection
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

// Collapsible Ledger Legend Drawer (VIP Club Edition)
function buildLedgerLegendHTML() {
    const legendKey = "LEDGER_LEGEND_DRAWER";
    const isLegendOpen = openCardMemory.has(legendKey);

    return `
        <div style="margin-bottom: 16px; border: 1px solid rgba(59, 130, 246, 0.45); border-radius: 8px; background: #0f172a; overflow: hidden;">
            <div onclick="window.toggleLegendDrawer('${legendKey}', 'ledger', event)" style="cursor: pointer; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(59, 130, 246, 0.16), rgba(15, 23, 42, 0.9)); user-select: none;">
                <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 800; color: #60a5fa; letter-spacing: 0.03em;">
                    🍾 LEDGER DECODER: HOW WE GRADE MONEY SHOTS (W), BLUE BALLS (BB) &amp; BOUNCER SAVES
                </span>
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); text-decoration: underline;">
                    ${isLegendOpen ? 'Hide Decoder ▲' : 'Click to Expand ▼'}
                </span>
            </div>

            <div style="display: ${isLegendOpen ? 'block' : 'none'}; padding: 14px 18px; border-top: 1px solid var(--border-subtle); font-size: 12px; line-height: 1.55; color: var(--text-secondary);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">THE MORNING-AFTER SCORECARD (W - L - BB)</div>
                        <div>• <strong style="color:var(--accent-emerald);">✅ HIT (W):</strong> <em>The Money Shot.</em> Covered the Vegas closing number and walked out with the bookie's cash.</div>
                        <div style="margin-top: 4px;">• <strong style="color:#60a5fa;">🔵 BLUE BALLS (BB):</strong> <em>Robbed at the Two-Minute Warning.</em> Missed the Vegas line by <strong>&le;3.0 points (one field goal or less)</strong>—when she gets you all 99% of the way, Mom walked in and killed the climax.</div>
                        <div style="margin-top: 4px;">• <strong style="color:var(--accent-danger);">❌ MISS (L):</strong> <em>Walk of Shame.</em> Missed the closing line by more than 3.0 points. No excuses—we post every receipt.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">MAIN STAGE vs. LAP-DANCE COIN FLIPS</div>
                        <div>• <strong style="color:var(--accent-emerald);">🔥 Official SMASH (&ge;+10.0% EV):</strong> Our headline earners that clear the +10% EV velvet rope, tracked alongside the <strong>Flagship 5-Pack</strong> and <strong>Ménage à Trois</strong>.</div>
                        <div style="margin-top: 4px;">• <strong style="color:#60a5fa;">🔵 All Tease, No Squeeze (&plusmn;10% EV):</strong> Tight toss-ups inside the -9.9% to +9.9% EV buffer—quarantined in their own booth so 50/50 bar-bet variance never waters down our Official SMASH record.</div>
                    </div>

                    <div style="background: rgba(30, 41, 59, 0.55); padding: 10px 12px; border-radius: 6px; border: 1px solid #1e293b;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-danger); margin-bottom: 4px;">🍾 CHAMPAGNE ROOM RULES (&le;-10% EV)</div>
                        <div>• <strong>Look, Don't Touch:</strong> Tracks the overhyped public favorites we stamped with a red <strong>PASS (&le;-10.0% EV)</strong>—the $500 lap dance where house rules say you can't even finish.</div>
                        <div style="margin-top: 4px;">• Every time a casual-bait favorite fails to cover, <strong>Traps Dodged</strong> ticks up—counting how many times the bouncer saved your bankroll from a bad decision.</div>
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
    // Permanent archive entries override stale ungraded data.json entries
    const entriesMap = Object.assign({}, ledgerObj.entries || {}, PERMANENT_LEDGER_ARCHIVE);
    const showBallsDeep = (AppState.activeMode === "balls_deep" || AppState.activeMode === "davinci");

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
        tip_all:        makeBucket(),
        balls_deep_all: makeBucket()
    };

    const tallyGrade = (bucketKey, res) => {
        if (res !== "HIT" && res !== "MISS" && res !== "BLUE_BALLS") return;
        buckets[bucketKey].total += 1;
        if (res === "HIT") buckets[bucketKey].hits += 1;
        else if (res === "BLUE_BALLS") buckets[bucketKey].blueBalls += 1;
        else if (res === "MISS") buckets[bucketKey].misses += 1;
    };

    let archivedRowsHTML = "";
    let upcomingRowsHTML = "";
    const renderedMatchups = new Set();
    const activeSlateMatchups = new Set(AppState.processedGames.map(g => g.matchup));

    // 1. Render ONLY truly completed/FINAL archived games first (prevents stale pre-kickoff snapshots & duplicates)
    Object.keys(entriesMap).forEach(archId => {
        const entry = entriesMap[archId];
        if (!entry) return;

        const cleanMatchup = cleanLabelCodes(entry.matchup || "");
        if (!cleanMatchup || renderedMatchups.has(cleanMatchup)) return;

        const entryLeague = entry.league || "NFL";
        if (!isRankedLedgerEntry(cleanMatchup, entryLeague)) return;

        const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[cleanMatchup];
        const isFinal = entry.status === "FINAL" || (espnMatch && espnMatch.state === "post");

        // If this matchup is on the active upcoming slate and NOT final, skip the old archive snapshot
        // so it renders live updated lines & projections in Loop 2 below.
        if (activeSlateMatchups.has(cleanMatchup) && !isFinal) return;

        // Also skip any ungraded old scraper snapshot that isn't final
        const hasGradedResult = entry.spread_record && (
            entry.spread_record.result_tip === "HIT" ||
            entry.spread_record.result_tip === "MISS" ||
            entry.spread_record.result_tip === "BLUE_BALLS"
        );
        if (!isFinal && !hasGradedResult) return;

        renderedMatchups.add(cleanMatchup);

        const scoreDisplay = entry.final_score || (espnMatch ? espnMatch.scoreStr : "COMPLETED");
        const statusLabel = `<span style="color:var(--accent-emerald);font-weight:700;">FINAL (${scoreDisplay})</span>`;

        if (entry.trap_avoided) {
            buckets.champagne_room.total += 1;
            buckets.champagne_room.dodged += 1;
        }

        const archivedRecords = [
            { type: "SPREAD", rec: entry.spread_record },
            { type: "TOTAL (O/U)", rec: entry.total_record }
        ].filter(x => x.rec);

        archivedRecords.forEach(({ type, rec }) => {
            const isSpread = type === "SPREAD";
            const pickLabel = cleanLabelCodes(rec.pick_label || rec.player || cleanMatchup);
            const vegasLine = rec.vegas_line !== undefined ? rec.vegas_line : (rec.line !== undefined ? rec.line : (rec.baseLine || 0));
            const baseOdds = rec.odds !== undefined ? rec.odds : (rec.baseOdds || -110);
            const tipProj = rec.tip_proj !== undefined ? rec.tip_proj : (rec.tipProjectedMean || vegasLine);
            const tipWinPct = rec.tip_win_pct !== undefined ? rec.tip_win_pct : (rec.tipModelPct || 50);
            const tipEvPct = rec.tip_ev_pct !== undefined ? rec.tip_ev_pct : (rec.tipEvPct || 0);
            const ledgerTier = getTierFromEv(tipEvPct);
            const tipColor = getTierColor(ledgerTier);

            const bdProj = rec.bd_proj !== undefined ? rec.bd_proj : (rec.bdProjectedMean || tipProj);
            const bdWinPct = rec.bd_win_pct !== undefined ? rec.bd_win_pct : (rec.bdModelPct || tipWinPct);
            const bdEvPct = rec.bd_ev_pct !== undefined ? rec.bd_ev_pct : (rec.bdEvPct || tipEvPct);
            const bdTier = getTierFromEv(bdEvPct);
            const bdColor = getTierColor(bdTier);
            const bdAltLabel = rec.bd_alt_label || rec.bdAltLabel || "Alt Escalator";
            const bdAltEvPct = rec.bd_alt_ev_pct !== undefined ? rec.bd_alt_ev_pct : (rec.bdAltEvPct || 0);
            const slot = rec.flagship_slot || rec.flagshipSlot || "";

            let gradedTip = rec.result_tip || rec.result || "PENDING";
            let gradedBd = rec.result_bd || gradedTip;
            const missByPts = rec.miss_by_pts || 0;

            if (gradedTip === "HIT" || gradedTip === "MISS" || gradedTip === "BLUE_BALLS") {
                tallyGrade("tip_all", gradedTip);
                tallyGrade("balls_deep_all", gradedBd);
                if (slot) {
                    tallyGrade("flagship_5pack", gradedTip);
                    if (slot.includes("MÉNAGE")) tallyGrade("menage_a_trois", gradedTip);
                }
                if (ledgerTier === "SMASH") {
                    tallyGrade("overall_smash", gradedTip);
                    tallyGrade(isSpread ? "spread_smash" : "total_smash", gradedTip);
                } else if (ledgerTier === "TOO_CLOSE") {
                    tallyGrade("all_tease", gradedTip);
                }
            }

            const fmtTipProj = (isSpread && Number(tipProj) > 0) ? `+${tipProj}` : `${tipProj}`;
            const fmtBdProj = (isSpread && Number(bdProj) > 0) ? `+${bdProj}` : `${bdProj}`;

            archivedRowsHTML += `
                <tr>
                    <td><strong>${cleanMatchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                    <td>${type} ${slot ? `<br><span class="badge-menage">${slot}</span>` : ""}</td>
                    <td><strong>${pickLabel}</strong> ${renderTierBadgeHTML(ledgerTier)}</td>
                    <td>${vegasLine} (${baseOdds > 0 ? '+' + baseOdds : baseOdds})</td>
                    <td style="color:${tipColor};">Proj: <strong>${fmtTipProj}</strong> (${tipWinPct}% | ${tipEvPct > 0 ? '+' : ''}${tipEvPct}% EV)</td>
                    <td>${showBallsDeep ? `<span style="color:${bdColor};">Proj: <strong>${fmtBdProj}</strong> (${bdWinPct}% | ${bdEvPct > 0 ? '+' : ''}${bdEvPct}% EV)<br><small style="color:var(--accent-gold);">${bdAltLabel} (${bdAltEvPct > 0 ? '+' : ''}${bdAltEvPct}% EV)</small></span>` : renderLockCellHTML()}</td>
                    <td>${renderGradeBadge(gradedTip, missByPts)}</td>
                </tr>
            `;
        });
    });

    // 2. Render active/upcoming slate games using live scraped lines & v213 projections
    AppState.processedGames.forEach(g => {
        if (renderedMatchups.has(g.matchup)) return;
        if (!isRankedLedgerEntry(g.matchup, g.league)) return;
        renderedMatchups.add(g.matchup);

        const espnMatch = ESPN_SCORE_CACHE.gamesByMatchup[g.matchup];
        const kickedOffByClock = g.commenceTime ? (new Date(g.commenceTime).getTime() <= Date.now()) : false;

        const isFinal = Boolean(espnMatch && espnMatch.state === "post");
        const isLocked = isFinal || kickedOffByClock || Boolean(espnMatch && espnMatch.state === "in");
        const scoreDisplay = espnMatch ? espnMatch.scoreStr : "";

        const statusLabel = isFinal
            ? `<span style="color:var(--accent-emerald);font-weight:700;">FINAL (${scoreDisplay})</span>`
            : (isLocked
                ? `<span style="color:var(--accent-gold);font-weight:700;">🔒 IN-PLAY (${scoreDisplay || 'CLOSING LOCKED'})</span>`
                : `<span style="color:var(--text-secondary);">PRE-KICKOFF SNAPSHOT</span>`);

        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread").sort((a, b) => b.tipEvPct - a.tipEvPct);
        const gameTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "total");

        if (isFinal && espnMatch && gameSpreads.length > 1) {
            const trapSide = gameSpreads[gameSpreads.length - 1];
            if (trapSide && trapSide.tipEvPct <= PASS_EV_CUTOFF) {
                const trapGrade = gradeSpreadPick(trapSide.isHomeSpread, trapSide.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                buckets.champagne_room.total += 1;
                if (trapGrade.outcome !== "HIT") {
                    buckets.champagne_room.dodged += 1;
                }
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

            if (isFinal && espnMatch) {
                const tipResObj = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.baseLine, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalPick(p.tipProjectedMean, p.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                const bdResObj = isSpread
                    ? gradeSpreadPick(p.isHomeSpread, p.baseLine, espnMatch.homeScore, espnMatch.awayScore)
                    : gradeTotalPick(p.bdProjectedMean, p.baseLine, espnMatch.homeScore, espnMatch.awayScore);
                gradedTip = tipResObj.outcome;
                gradedBd = bdResObj.outcome;
                missByPts = tipResObj.missBy;
            }

            if (gradedTip === "HIT" || gradedTip === "MISS" || gradedTip === "BLUE_BALLS") {
                tallyGrade("tip_all", gradedTip);
                tallyGrade("balls_deep_all", gradedBd);
                if (p.flagshipSlot) {
                    tallyGrade("flagship_5pack", gradedTip);
                    if (p.flagshipSlot.includes("MÉNAGE")) tallyGrade("menage_a_trois", gradedTip);
                }
                if (ledgerTier === "SMASH") {
                    tallyGrade("overall_smash", gradedTip);
                    tallyGrade(isSpread ? "spread_smash" : "total_smash", gradedTip);
                } else if (ledgerTier === "TOO_CLOSE") {
                    tallyGrade("all_tease", gradedTip);
                }
            }

            upcomingRowsHTML += `
                <tr>
                    <td><strong>${g.matchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                    <td>${isSpread ? 'SPREAD' : 'TOTAL (O/U)'} ${p.flagshipSlot ? `<br><span class="badge-menage">${p.flagshipSlot}</span>` : ""}</td>
                    <td><strong>${p.player}</strong> ${renderTierBadgeHTML(ledgerTier)}</td>
                    <td>${p.baseLine} (${p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds})</td>
                    <td style="color:${tipColor};">Proj: <strong>${fmtTipProj}</strong> (${p.tipModelPct}% | ${p.tipEvPct > 0 ? '+' : ''}${p.tipEvPct}% EV)</td>
                    <td>${showBallsDeep ? `<span style="color:${bdColor};">Proj: <strong>${fmtBdProj}</strong> (${p.bdModelPct}% | ${p.bdEvPct > 0 ? '+' : ''}${p.bdEvPct}% EV)<br><small style="color:var(--accent-gold);">${p.bdAltLabel} (${p.bdAltEvPct > 0 ? '+' : ''}${p.bdAltEvPct}% EV)</small></span>` : renderLockCellHTML()}</td>
                    <td>${renderGradeBadge(gradedTip, missByPts)}</td>
                </tr>
            `;
        });
    });

    const fmtBucket = (key) => {
        const b = buckets[key];
        if (!b || !b.total) return "0W - 0L - 0BB (0.0%)";
        const pct = ((b.hits / b.total) * 100).toFixed(1);
        return `${b.hits}W - ${b.misses}L - <span style="color:#60a5fa;">${b.blueBalls}BB</span> (${pct}%)`;
    };

    const fmtTraps = () => {
        const c = buckets.champagne_room;
        if (!c || !c.total) return "0 / 0 Dodged (0.0%)";
        const pct = ((c.dodged / c.total) * 100).toFixed(1);
        return `${c.dodged} / ${c.total} Dodged (${pct}%)`;
    };

    container.innerHTML = `
        ${buildLedgerLegendHTML()}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(225px, 1fr)); gap: 14px; margin-bottom: 20px; font-family: var(--font-mono);">
            <div style="background: var(--bg-elevated); border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-gold); font-weight: 800;">👑 FLAGSHIP 5-PACK &amp; MÉNAGE À TROIS</div>
                <div style="font-size: 15px; font-weight: 800; margin: 6px 0;">5-Pack: ${fmtBucket("flagship_5pack")}</div>
                <div style="font-size: 11.5px; color: var(--text-secondary);">Ménage à Trois: <strong>${fmtBucket("menage_a_trois")}</strong></div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(16, 185, 129, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-emerald); font-weight: 800;">🔥 OFFICIAL SMASH (&ge;+10.0% EV)</div>
                <div style="font-size: 15px; font-weight: 800; margin: 6px 0;">${fmtBucket("overall_smash")}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                    Spreads: <strong>${fmtBucket("spread_smash")}</strong><br>Totals: <strong>${fmtBucket("total_smash")}</strong>
                </div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(59, 130, 246, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: #60a5fa; font-weight: 800;">🔵 ALL TEASE, NO SQUEEZE (&plusmn;10% EV)</div>
                <div style="font-size: 15px; font-weight: 800; margin: 6px 0; color: var(--text-primary);">${fmtBucket("all_tease")}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Coin-flip zone | BB = Missed line by &le;3 pts</div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(239, 68, 68, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-danger); font-weight: 800;">🍾 CHAMPAGNE ROOM RULES (&le;-10% EV)</div>
                <div style="font-size: 16px; font-weight: 800; margin: 6px 0; color: var(--accent-emerald);">${fmtTraps()}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Look, Don't Touch: Public traps avoided</div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(6, 182, 212, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 800;">⚡ TIP vs. BALLS DEEP HEAD-TO-HEAD</div>
                <div style="font-size: 13px; font-weight: 800; margin: 6px 0;">Tip: ${fmtBucket("tip_all")}</div>
                ${showBallsDeep
                    ? `<div style="font-size: 13px; font-weight: 800; color: var(--accent-emerald);">Balls Deep: ${fmtBucket("balls_deep_all")}</div>`
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
                    ${archivedRowsHTML}
                    ${upcomingRowsHTML}
                </tbody>
            </table>
        </div>
    `;
}
// === END OF APP_CONTROLLER.JS ===
