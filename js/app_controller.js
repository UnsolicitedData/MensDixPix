/**
 * DIXPIX QUANTITATIVE ENGINE — MASTER UI & 13-MODULE CALIBRATED CONTROLLER (v300)
 * - 13-Module Fibonacci Calibration (34/76 Tier-1 Market Baseline Anchor + 10-Zone Elevation + M_rise).
 * - Clean Flagship 5-Pack: Single "You gotta pay to go Balls Deep..." line under Active Engine header.
 * - 100% Opaque, borderless Balls Deep teaser bars on cards (no spoilers before clicking).
 * - 100% Cross-Tab Sync between Master Pick Board, Compendium P_agg, Telemetry & Ledger.
 */

const AppState = {
    rawPayload: null,
    lastDataHash: "",
    activeMode: "tip",        // "tip" | "balls_deep" | "davinci"
    intensitySlider: 0.0,     // -3.236 to +3.236 (-2*phi to +2*phi)
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

document.addEventListener("DOMContentLoaded", () => {
    bindUIControls();
    pollDataFeed();
    setInterval(pollDataFeed, 5000);
});

window.unlockBallsDeepMode = function(event) {
    if (event) event.stopPropagation();
    const bdRadio = document.getElementById("mode-balls-deep");
    if (bdRadio) {
        bdRadio.checked = true;
        AppState.activeMode = "balls_deep";
        recalculateAndRenderAll();
    }
};

window.toggleParlayLeg = function(propKey) {
    if (AppState.selectedParlayLegs.has(propKey)) {
        AppState.selectedParlayLegs.delete(propKey);
    } else {
        AppState.selectedParlayLegs.add(propKey);
    }
    renderCombinatoricsDeck();
};

window.loadFlagshipPreset = function(onlyMenage = false) {
    AppState.selectedParlayLegs.clear();
    AppState.flagshipFivePack.forEach(p => {
        if (!onlyMenage || (p.flagshipSlot && p.flagshipSlot.includes("MÉNAGE"))) {
            AppState.selectedParlayLegs.add(p.propKey);
        }
    });
    renderCombinatoricsDeck();
};

window.clearParlaySlip = function() {
    AppState.selectedParlayLegs.clear();
    renderCombinatoricsDeck();
};

window.setComboFilter = function(filterType, value) {
    AppState.comboFilters[filterType] = value;
    renderCombinatoricsDeck();
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

function recalculateAndRenderAll() {
    if (!AppState.rawPayload || !AppState.rawPayload.games) return;

    const defaultLeague = (AppState.rawPayload.slate_info && AppState.rawPayload.slate_info.league) || "NFL";
    const mode = AppState.activeMode;
    const sliderVal = (mode === "davinci") ? AppState.intensitySlider : 0.0;
    const playScaler = (typeof GOLDEN_PLAY_SCALER !== "undefined") ? GOLDEN_PLAY_SCALER : 38.5145;
    const tier1Weight = 34.0 / 76.0; // 0.44737 Fibonacci Tier-1 calibration weight

    AppState.processedGames = [];
    AppState.processedProps = [];

    AppState.rawPayload.games.forEach(game => {
        const gameLeague = game.league || defaultLeague;
        if (gameLeague === "NFL" && !AppState.filters.nfl) return;
        if (gameLeague === "NCAA" && !AppState.filters.ncaa) return;

        const envPayload = game.environmental_payload || {};
        const circPayload = game.circadian_payload || {};
        const homeTel = (game.team_telemetry && game.team_telemetry.home) || {};
        const awayTel = (game.team_telemetry && game.team_telemetry.away) || {};

        // Extract Vegas Home Spread & Total from props_board to anchor Tier 1 (Module 1 P_mkt)
        let vegasHomeSpread = null;
        let vegasTotalLine = null;
        if (Array.isArray(game.props_board)) {
            const homeSpreadProp = game.props_board.find(p => p.market_type === "spread" && p.player.startsWith(`${game.home_team} `));
            const awaySpreadProp = game.props_board.find(p => p.market_type === "spread" && p.player.startsWith(`${game.away_team} `));
            if (homeSpreadProp && homeSpreadProp.base_line !== undefined) {
                vegasHomeSpread = Number(homeSpreadProp.base_line);
            } else if (awaySpreadProp && awaySpreadProp.base_line !== undefined) {
                vegasHomeSpread = -Number(awaySpreadProp.base_line);
            }
            const totalProp = game.props_board.find(p => p.market_type === "total");
            if (totalProp && totalProp.base_line !== undefined) {
                vegasTotalLine = Number(totalProp.base_line);
            }
        }

        const m7 = calcBarometricBallistics(envPayload);
        const m8 = calcCircadianStrain(circPayload, game.kickoff_local_hour);

        // Module 11.2: 10-Zone 0.1*Fz Fibonacci Elevation Acclimation Matrix
        const elevTip = calcTenZoneElevationMatrix(envPayload, circPayload, "tip");
        const elevBd = calcTenZoneElevationMatrix(envPayload, circPayload, "balls_deep");
        const elevActive = calcTenZoneElevationMatrix(envPayload, circPayload, mode);

        // Module 11.1 & 12 Coupled Interaction
        const m11Bd = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, "balls_deep", 0.0);
        const m12Bd = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, "balls_deep", 0.0);
        const psiBd = calcCoupledInteractionPsi(m11Bd.phiBioScore, m12Bd.netTurnoverEPA, 0.0);

        const m11 = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, mode, sliderVal);
        const m12 = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, mode, sliderVal);
        const psi11_12 = (mode === "tip")
            ? 0
            : calcCoupledInteractionPsi(m11.phiBioScore, m12.netTurnoverEPA, sliderVal);

        const m9Base = calcFullGameFairMargin(game, m8.phiCircadianPenalty, 0, "tip", vegasHomeSpread, elevTip.psiElevPts);
        const m9Bd = calcFullGameFairMargin(game, m8.phiCircadianPenalty, psiBd, "balls_deep", vegasHomeSpread, elevBd.psiElevPts);
        const m9 = calcFullGameFairMargin(game, m8.phiCircadianPenalty, psi11_12, mode, vegasHomeSpread, elevActive.psiElevPts);

        // Calibrated Total (Tier 1 34/76 anchor prevents 15-point total outliers)
        const epaTotalPts = ((homeTel.net_epa_per_play || 0) + (awayTel.net_epa_per_play || 0)) * playScaler;
        const rzTotalPts = ((homeTel.opp_rz_dvoa || 0) + (awayTel.opp_rz_dvoa || 0)) * 8.0;
        const windMph = envPayload.is_dome ? 0 : (envPayload.wind_mph || 0);
        const windPenalty = Math.max(0, (windMph - 10.0) * 0.25);
        const rawTelemetryTotal = MODEL_TOTAL_INTERCEPT + epaTotalPts + rzTotalPts - windPenalty;

        let baseTelemetryTotal = Number(rawTelemetryTotal.toFixed(1));
        if (vegasTotalLine !== null && !isNaN(vegasTotalLine)) {
            const rawTotalDiff = rawTelemetryTotal - vegasTotalLine;
            const dampedTotalDiff = 7.0 * Math.tanh(rawTotalDiff / 7.0);
            baseTelemetryTotal = Number((vegasTotalLine + (dampedTotalDiff * tier1Weight)).toFixed(1));
        }

        const gameRecord = {
            gameId: game.game_id,
            league: gameLeague,
            matchup: `${game.away_team} @ ${game.home_team}`,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commenceTime: game.commence_time,
            elevationM: envPayload.elevation_m || 0,
            tempK: envPayload.temp_kelvin || 288.15,
            windMph,
            vegasHomeSpread: vegasHomeSpread !== null ? vegasHomeSpread : 0,
            m7, m8, m9Base, m9Bd, m9, m11, m12,
            elevActive,
            psiBd, psi11_12, baseTelemetryTotal
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

                if (prop.market_type === "spread") {
                    baseProjectedLine = isHomeSpread ? m9Base.fairHomeSpread : Number((-m9Base.fairHomeSpread).toFixed(2));
                    tipModelProb = calcPointGapWinProb(vegasLine - baseProjectedLine);

                    bdProjectedLine = isHomeSpread ? m9Bd.fairHomeSpread : Number((-m9Bd.fairHomeSpread).toFixed(2));
                    bdModelProb = calcPointGapWinProb(vegasLine - bdProjectedLine);
                } else if (prop.market_type === "total") {
                    baseProjectedLine = baseTelemetryTotal;
                    tipModelProb = calcPointGapWinProb(Math.abs(baseProjectedLine - vegasLine));

                    const bdShift = (psiBd * 0.45) + (m7.passGameModifierYards * 0.08);
                    bdProjectedLine = Number((baseProjectedLine + bdShift).toFixed(1));
                    bdModelProb = calcPointGapWinProb(Math.abs(bdProjectedLine - vegasLine));
                } else {
                    baseProjectedLine = prop.projected_mean_mu || vegasLine || 50;
                    const gammaRes = calcGammaSurvivalProb(baseProjectedLine, prop.projected_variance_sigma2 || 225, vegasLine || 45.5);
                    tipModelProb = gammaRes.trueOverProb;
                    bdModelProb = Math.max(0.01, Math.min(0.99, tipModelProb + (psiBd * 0.025)));
                    bdProjectedLine = Number((baseProjectedLine + ((bdModelProb - tipModelProb) * 12.0)).toFixed(1));
                }

                let finalCalculatedLine = baseProjectedLine;
                let activeModelProb = tipModelProb;
                let displayLabel = prop.player;

                if (prop.market_type === "spread") {
                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        // Section 2.3 DaVinci Continuous Flow Scaling (Fn/76 * I_flow)
                        const dvSpreadShift = (13.0 / 76.0) * sliderVal * 2.5;
                        const activeHomeSpread = m9.fairHomeSpread - dvSpreadShift;
                        finalCalculatedLine = isHomeSpread ? Number(activeHomeSpread.toFixed(2)) : Number((-activeHomeSpread).toFixed(2));
                        activeModelProb = calcPointGapWinProb(vegasLine - finalCalculatedLine);
                    }
                } else if (prop.market_type === "total") {
                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        const dvTotalShift = (psi11_12 * 0.55) + ((21.0 / 76.0) * sliderVal * 3.0);
                        finalCalculatedLine = Number((baseProjectedLine + dvTotalShift).toFixed(1));
                        activeModelProb = calcPointGapWinProb(Math.abs(finalCalculatedLine - vegasLine));
                    }
                    const isUnderPick = finalCalculatedLine < vegasLine;
                    displayLabel = `${game.away_team}@${game.home_team} Total (${isUnderPick ? "U" : "O"} ${vegasLine})`;
                } else {
                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        activeModelProb = Math.max(0.01, Math.min(0.99, tipModelProb + (psi11_12 * 0.04) + ((13.0 / 76.0) * sliderVal * 0.15)));
                        finalCalculatedLine = Number((baseProjectedLine + ((activeModelProb - tipModelProb) * 12.0)).toFixed(1));
                    }
                }

                const m2Tip = calcExpectedValueAndKelly(tipModelProb, prop.base_odds_over || -110);
                const m2Bd = calcExpectedValueAndKelly(bdModelProb, prop.base_odds_over || -110);
                const m2Active = calcExpectedValueAndKelly(activeModelProb, prop.base_odds_over || -110);

                const activeWinPct = Number((activeModelProb * 100).toFixed(2));
                const activeEvPct = Number(m2Active.evPercentage.toFixed(2));
                const tierBadge = activeEvPct >= SMASH_EV_CUTOFF ? "SMASH" : "PASS";

                AppState.processedProps.push({
                    propKey,
                    commenceTime: game.commence_time,
                    gameId: game.game_id,
                    league: gameLeague,
                    matchup: gameRecord.matchup,
                    homeTeam: game.home_team,
                    awayTeam: game.away_team,
                    player: displayLabel,
                    marketType: prop.market_type,
                    baseLine: vegasLine,
                    baseOdds: prop.base_odds_over || -110,
                    projectedMean: finalCalculatedLine,
                    tipProjectedMean: baseProjectedLine,
                    bdProjectedMean: bdProjectedLine,
                    vigFreePct: Number((vigFreeOver * 100).toFixed(2)),
                    tipModelPct: Number((tipModelProb * 100).toFixed(2)),
                    tipEvPct: Number(m2Tip.evPercentage.toFixed(2)),
                    bdModelPct: Number((bdModelProb * 100).toFixed(2)),
                    bdEvPct: Number(m2Bd.evPercentage.toFixed(2)),
                    activeModelPct: activeWinPct,
                    activeModelProbRaw: activeModelProb,
                    evPct: activeEvPct,
                    quarterKellyPct: Number(m2Active.quarterKellyStakePct.toFixed(2)),
                    tierBadge,
                    flagshipSlot: prop.flagship_slot || "",
                    psiBd,
                    psiActive: psi11_12
                });
            });
        }
    });

    // Tag Flagship 5-Pack: Mandatory Top 3 Spreads ("Ménage à Trois") + Top 2 Flex
    AppState.processedProps.forEach(p => { p.flagshipSlot = ""; });
    const bestSpreadPerGame = [];
    const remainingPool = [];

    AppState.processedGames.forEach(g => {
        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread");
        if (gameSpreads.length > 0) {
            gameSpreads.sort((a, b) => b.evPct - a.evPct);
            bestSpreadPerGame.push(gameSpreads[0]);
        }
        const gameTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType !== "spread");
        remainingPool.push(...gameTotals);
    });

    bestSpreadPerGame.sort((a, b) => b.evPct - a.evPct);
    const menageTop3 = bestSpreadPerGame.slice(0, 3);
    menageTop3.forEach((p, idx) => { p.flagshipSlot = `MÉNAGE À TROIS #${idx + 1}`; });

    const leftoverSpreads = bestSpreadPerGame.slice(3);
    const flexCandidates = [...leftoverSpreads, ...remainingPool].sort((a, b) => b.evPct - a.evPct);
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
}

// ==========================================
// 100% OPAQUE, BORDERLESS BALLS DEEP BAR (NO SPOILERS BEFORE CLICK)
// ==========================================
function buildBallsDeepBoxHTML(engineProp, isSpread) {
    if (AppState.activeMode === "tip") {
        return `
            <div class="bd-preview-locked" onclick="window.unlockBallsDeepMode(event)" title="Click to unlock Balls Deep Mode">
                🔒 "You gotta pay to go Balls Deep..."
            </div>
        `;
    } else {
        const tipProj = engineProp.tipProjectedMean;
        const fmtTipProj = (isSpread && Number(tipProj) > 0) ? `+${tipProj}` : `${tipProj}`;
        const tipEvStr = `${engineProp.tipEvPct > 0 ? '+' : ''}${engineProp.tipEvPct}% EV`;
        const activeLabel = AppState.activeMode === "davinci" ? "DAVINCI ACTIVE" : "BALLS DEEP ACTIVE";
        const activeProj = (isSpread && Number(engineProp.projectedMean) > 0) ? `+${engineProp.projectedMean}` : `${engineProp.projectedMean}`;
        const activeEvStr = `${engineProp.evPct > 0 ? '+' : ''}${engineProp.evPct}% EV`;

        return `
            <div class="bd-preview-unlocked">
                <span style="color: var(--text-secondary);">Tip Baseline: <strong>${fmtTipProj}</strong> (${engineProp.tipModelPct}% | ${tipEvStr})</span>
                <span style="color: var(--accent-emerald); font-weight: 700;">⚡ ${activeLabel}: ${activeProj} (${engineProp.activeModelPct}% | ${activeEvStr} | Ψ: ${engineProp.psiActive})</span>
            </div>
        `;
    }
}

// ==========================================
// CENTERED FLAGSHIP 5-PACK (SINGLE CONCISE BALLS DEEP LINE IN HEADER)
// ==========================================
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
        : (AppState.activeMode === "balls_deep" ? "Balls Deep Coupled Mode" : "DaVinci Override Mode");

    const headerBallsDeepSubline = AppState.activeMode === "tip"
        ? `<div onclick="window.unlockBallsDeepMode(event)" style="margin-top: 6px; font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-gold); cursor: pointer;">
             🔒 "You gotta pay to go Balls Deep..."
           </div>`
        : `<div style="margin-top: 6px; font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--accent-emerald);">
             ⚡ Balls Deep Coupled Telemetry Unlocked
           </div>`;

    container.innerHTML = `
        <div id="flagship-banner-toggle" style="cursor: pointer; padding: 14px 20px; text-align: center; background: linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(6, 182, 212, 0.10), rgba(245, 158, 11, 0.16)); user-select: none;">
            <div style="font-size: 15px; font-weight: 800; color: var(--accent-gold); letter-spacing: 0.04em;">
                👑 THE DIXPIX FLAGSHIP 5-PACK // FEATURING "THE MÉNAGE À TROIS"
            </div>
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                Active Engine: <strong style="color: var(--accent-cyan);">${modeTitle}</strong> &bull; 
                <span style="color: var(--text-primary); text-decoration: underline;">
                    ${isExpanded ? 'Click to collapse 5-Pack ▲' : 'Click to unlock &amp; expand all 5 Flagship Plays ▼'}
                </span>
            </div>
            ${headerBallsDeepSubline}
        </div>

        <div id="flagship-banner-drawer" style="display: ${isExpanded ? 'block' : 'none'}; padding: 14px 18px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface);">
            ${AppState.flagshipFivePack.map((p, idx) => {
                const isMenage = p.flagshipSlot.includes("MÉNAGE");
                const isSpread = p.marketType === "spread";
                const fmtProj = (isSpread && Number(p.projectedMean) > 0) ? `+${p.projectedMean}` : `${p.projectedMean}`;
                const evStr = `${p.evPct > 0 ? '+' : ''}${p.evPct}% EV`;

                return `
                    <div style="padding: 10px 0; ${idx < AppState.flagshipFivePack.length - 1 ? 'border-bottom: 1px solid #1e293b;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span class="${isMenage ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>
                                <strong style="font-size: 13px; color: var(--text-primary);">${p.player}</strong>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 12px;">
                                <span style="color: var(--accent-emerald);">
                                    Proj: <strong>${fmtProj}</strong> | Win: <strong>${p.activeModelPct}%</strong> (${evStr})
                                </span>
                                <span class="${p.tierBadge === 'SMASH' ? 'badge-smash' : 'badge-pass'}">${p.tierBadge}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    const toggleHeader = document.getElementById("flagship-banner-toggle");
    const drawer = document.getElementById("flagship-banner-drawer");
    if (toggleHeader && drawer) {
        toggleHeader.addEventListener("click", () => {
            const closing = drawer.style.display === "block";
            drawer.style.display = closing ? "none" : "block";
            if (closing) openCardMemory.delete(bannerKey);
            else openCardMemory.add(bannerKey);
            renderFlagshipFivePack();
        });
    }
}

function render_game_cards(data) {
    const container = document.getElementById("master-board-body");
    if (!container) return;
    
    container.innerHTML = ""; 
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";
    container.style.gap = "15px";

    const games = data.games || [];

    games.forEach(game => {
        const cardKey = game.game_id || `${game.away_team}@${game.home_team}`;
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

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 10px;">
                <span style="font-size: 0.85em; color: #94a3b8;">${gameDate} @ ${gameTime}</span>
                <span style="font-size: 0.85em; color: #94a3b8;">${weatherString}</span>
            </div>
            <div style="font-size: 1.25em; font-weight: bold; text-align: center; margin-bottom: 10px;">
                ${game.away_team} @ ${game.home_team}
            </div>
            <div style="font-size: 0.85em; text-align: center; color: #cbd5e1;">
                Click to expand lines, EV% &amp; Balls Deep telemetry
            </div>
        `;

        const drawer = document.createElement("div");
        drawer.style.display = openCardMemory.has(cardKey) ? "block" : "none";
        drawer.style.marginTop = "15px";
        drawer.style.borderTop = "1px solid #334155";
        drawer.style.paddingTop = "10px";

        const props = game.props_board || [];
        if (props.length === 0) {
            drawer.innerHTML = `<div style="font-size: 0.85em; color: #94a3b8;">No active lines available yet.</div>`;
        } else {
            props.forEach((p, idx) => {
                const propKey = `${game.game_id}_${p.market_type}_${idx}`;
                const engineData = AppState.processedProps.find(ep => ep.propKey === propKey);
                if (!engineData) return;

                const isSpread = p.market_type === "spread";
                const displayProj = (isSpread && Number(engineData.projectedMean) > 0)
                    ? `+${engineData.projectedMean}`
                    : `${engineData.projectedMean}`;
                const evStr = `${engineData.evPct > 0 ? '+' : ''}${engineData.evPct}% EV`;
                const slotBadge = engineData.flagshipSlot
                    ? `<span class="${engineData.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}" style="margin-right:6px;">${engineData.flagshipSlot}</span>`
                    : "";

                const propBlock = document.createElement("div");
                propBlock.style.padding = "8px 0";
                propBlock.style.borderBottom = "1px solid #0f172a";

                propBlock.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.85em;">
                        <span>${slotBadge}<strong>${engineData.player}</strong></span>
                        <span style="display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono);">
                            <span style="color: ${engineData.evPct >= SMASH_EV_CUTOFF ? '#22c55e' : '#cbd5e1'};">
                                Proj: ${displayProj} | Win: ${engineData.activeModelPct}% (${evStr})
                            </span>
                            <span class="${engineData.tierBadge === 'SMASH' ? 'badge-smash' : 'badge-pass'}">${engineData.tierBadge}</span>
                        </span>
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

        container.appendChild(card);
    });
}

function renderCombinatoricsDeck() {
    const container = document.getElementById("combinatorics-container");
    if (!container) return;

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

    const uniqueMatchups = Array.from(new Set(App
