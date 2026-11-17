/**
 * DIXPIX QUANTITATIVE ENGINE — MASTER UI & COMBINATORICS CONTROLLER (v200)
 * - Pure EPA Baseline (No QB Delta double-counting)
 * - Objective SMASH threshold >= +10.0% EV (~57.62% Win Prob at -110)
 * - Centered single-card Flagship 5-Pack sub-banner & embedded mobile-friendly Combinatorics calculator
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

        const m7 = calcBarometricBallistics(envPayload);
        const m8 = calcCircadianStrain(circPayload, game.kickoff_local_hour);

        const m11Bd = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, "balls_deep", 0.0);
        const m12Bd = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, "balls_deep", 0.0);
        const psiBd = calcCoupledInteractionPsi(m11Bd.phiBioScore, m12Bd.netTurnoverEPA, 0.0);

        const m11 = calcBiophysicalMassLoad(envPayload, homeTel, 95.0, 0.62, mode, sliderVal);
        const m12 = calcTurnoverEPAMatrix({ home: homeTel, away: awayTel }, gameLeague, mode, sliderVal);
        const psi11_12 = (mode === "tip")
            ? 0
            : calcCoupledInteractionPsi(m11.phiBioScore, m12.netTurnoverEPA, sliderVal);

        const m9Base = calcFullGameFairMargin(game, m8.phiCircadianPenalty, 0, "tip");
        const m9Bd = calcFullGameFairMargin(game, m8.phiCircadianPenalty, psiBd, "balls_deep");
        const m9 = calcFullGameFairMargin(game, m8.phiCircadianPenalty, psi11_12, mode);

        // Pure EPA + Red-Zone DVOA + Wind Penalty (No QB Delta double-counting)
        const epaTotalPts = ((homeTel.net_epa_per_play || 0) + (awayTel.net_epa_per_play || 0)) * playScaler;
        const rzTotalPts = ((homeTel.opp_rz_dvoa || 0) + (awayTel.opp_rz_dvoa || 0)) * 10.0;
        const windMph = envPayload.is_dome ? 0 : (envPayload.wind_mph || 0);
        const windPenalty = Math.max(0, (windMph - 10.0) * 0.25);
        const baseTelemetryTotal = Number((MODEL_TOTAL_INTERCEPT + epaTotalPts + rzTotalPts - windPenalty).toFixed(1));

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
            m7, m8, m9Base, m9Bd, m9, m11, m12,
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
                        const activeHomeSpread = m9.fairHomeSpread - (sliderVal * 0.85);
                        finalCalculatedLine = isHomeSpread ? Number(activeHomeSpread.toFixed(2)) : Number((-activeHomeSpread).toFixed(2));
                        activeModelProb = calcPointGapWinProb(vegasLine - finalCalculatedLine);
                    }
                } else if (prop.market_type === "total") {
                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        const dvShift = (psi11_12 * 0.65) + (sliderVal * 1.45);
                        finalCalculatedLine = Number((baseProjectedLine + dvShift).toFixed(1));
                        activeModelProb = calcPointGapWinProb(Math.abs(finalCalculatedLine - vegasLine));
                    }
                    const isUnderPick = finalCalculatedLine < vegasLine;
                    displayLabel = `${game.away_team}@${game.home_team} Total (${isUnderPick ? "U" : "O"} ${vegasLine})`;
                } else {
                    if (mode === "balls_deep") {
                        finalCalculatedLine = bdProjectedLine;
                        activeModelProb = bdModelProb;
                    } else if (mode === "davinci") {
                        activeModelProb = Math.max(0.01, Math.min(0.99, tipModelProb + (psi11_12 * 0.04) + (sliderVal * 0.06)));
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

function buildBallsDeepBoxHTML(engineProp, isSpread) {
    const bdProj = engineProp.bdProjectedMean;
    const fmtBdProj = (isSpread && Number(bdProj) > 0) ? `+${bdProj}` : `${bdProj}`;
    const bdEvStr = `${engineProp.bdEvPct > 0 ? '+' : ''}${engineProp.bdEvPct}% EV`;

    if (AppState.activeMode === "tip") {
        return `
            <div class="bd-preview-locked" onclick="window.unlockBallsDeepMode(event)" title="Click to unlock Balls Deep Mode">
                <span style="color: var(--accent-gold); font-weight: 700;">🔒 BALLS DEEP — "You gotta pay to go balls deep..."</span>
                <span style="color: var(--text-secondary);">Proj: ${fmtBdProj} (${engineProp.bdModelPct}% | ${bdEvStr})</span>
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
                        ${buildBallsDeepBoxHTML(p, isSpread)}
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
                        🧮 PARLAY &amp; ROUND ROBIN CALCULATOR
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
                    <button class="calc-action-btn" onclick="window.clearParlaySlip()">
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
                    const fmtProj = (isSpread && Number(p.projectedMean) > 0) ? `+${p.projectedMean}` : `${p.projectedMean}`;
                    const evStr = `${p.evPct > 0 ? '+' : ''}${p.evPct}% EV`;

                    return `
                        <div onclick="window.toggleParlayLeg('${p.propKey}')" style="cursor: pointer; padding: 12px 14px; border-radius: 8px; background: ${isSelected ? 'rgba(6, 182, 212, 0.14)' : 'var(--bg-elevated)'}; border: 1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; transition: all 0.15s ease;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">
                                    ${isSelected ? '✅ IN SLIP // ' : ''}${p.matchup}
                                </span>
                                <div style="display: flex; gap: 6px;">
                                    ${p.flagshipSlot ? `<span class="${p.flagshipSlot.includes('MÉNAGE') ? 'badge-menage' : 'badge-flex'}">${p.flagshipSlot}</span>` : ''}
                                    <span class="${p.tierBadge === 'SMASH' ? 'badge-smash' : 'badge-pass'}">${p.tierBadge}</span>
                                </div>
                            </div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
                                ${p.player} <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">(${p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds})</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 12px; color: var(--accent-emerald);">
                                <span>Proj: <strong>${fmtProj}</strong></span>
                                <span>Win: <strong>${p.activeModelPct}%</strong> (${evStr})</span>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

function renderCompendiumBoard() {
    const tbody = document.getElementById("compendium-board-body");
    if (!tbody || AppState.processedGames.length === 0) return;

    const sliderVal = (AppState.activeMode === "davinci") ? AppState.intensitySlider : 0.0;

    tbody.innerHTML = AppState.processedGames.map(g => {
        const gameOmega = (
            (34 * ((g.m12.netTurnoverEPA || 0) * 0.1)) +
            (21 * (-g.m8.circadianStrainIndex * 0.1)) +
            (13 * (g.m11.phiBioScore * 0.05)) +
            (8 * ((1.225 - g.m7.airDensityRho) * 2)) +
            (13 * (g.psi11_12 * 0.1))
        ) / 76;

        const baseLogistic = 1.0 / (1.0 + Math.exp(-1.618 * gameOmega));
        const sliderMult = 1.0 + ((13 / 76) * sliderVal);
        const aggProb = Math.max(1.0, Math.min(99.0, baseLogistic * sliderMult * 100));

        return `
            <tr>
                <td><strong>${g.matchup}</strong></td>
                <td>${g.m7.airDensityRho} kg/m³</td>
                <td>${g.m8.circadianStrainIndex}</td>
                <td style="color:var(--accent-cyan);">${g.m11.phiBioScore}</td>
                <td>${g.m12.netTurnoverEPA > 0 ? '+' : ''}${g.m12.netTurnoverEPA}</td>
                <td style="font-family:var(--font-mono); font-weight:700; color:var(--accent-gold);">${gameOmega.toFixed(4)}</td>
                <td style="font-weight:700; color:var(--accent-emerald);">${aggProb.toFixed(1)}%</td>
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
        ${!showCoupledPsi ? `
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);">
                <div class="bd-preview-locked" onclick="window.unlockBallsDeepMode(event)" style="margin-top: 0;">
                    <span style="color: var(--accent-gold); font-weight: 700;">🔒 COUPLED Ψ_11,12 COLUMN HIDDEN IN TIP MODE — "You gotta pay to go balls deep..."</span>
                    <span style="color: var(--accent-cyan);">Click here to unlock Balls Deep Telemetry &rarr;</span>
                </div>
            </div>
        ` : ""}
        <table class="quant-table">
            <thead>
                <tr>
                    <th>Matchup</th>
                    <th>Mode Active</th>
                    <th>Circadian Strain (CSI)</th>
                    <th>Turnover EPA Diff (M12)</th>
                    ${showCoupledPsi ? `<th>Coupled Psi (&Psi;_11,12)</th>` : ""}
                    <th>Model Fair Home Spread (M9)</th>
                </tr>
            </thead>
            <tbody>
                ${AppState.processedGames.map(g => {
                    const tipSpreadStr = `${g.homeTeam} ${g.m9Base.fairHomeSpread > 0 ? '+' + g.m9Base.fairHomeSpread : g.m9Base.fairHomeSpread}`;
                    const activeSpreadStr = `${g.homeTeam} ${g.m9.fairHomeSpread > 0 ? '+' + g.m9.fairHomeSpread : g.m9.fairHomeSpread}`;

                    return `
                        <tr>
                            <td><strong>${g.matchup}</strong></td>
                            <td style="color:var(--accent-cyan); font-weight:700;">${modeDisplay}</td>
                            <td>${g.m8.circadianStrainIndex} (&Phi;_circ: ${g.m8.phiCircadianPenalty})</td>
                            <td>${g.m12.netTurnoverEPA > 0 ? '+' : ''}${g.m12.netTurnoverEPA}</td>
                            ${showCoupledPsi ? `<td style="color:var(--accent-gold); font-weight:700;">${g.psi11_12}</td>` : ""}
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

function renderBioWeatherLab() {
    const container = document.getElementById("biolab-container");
    if (!container || AppState.processedGames.length === 0) return;

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
                    <th>Biophysical Load (&Phi;_bio)</th>
                </tr>
            </thead>
            <tbody>
                ${AppState.processedGames.map(g => `
                    <tr>
                        <td><strong>${g.matchup}</strong></td>
                        <td>${g.elevationM}m</td>
                        <td>${g.m11.localGravityG} m/s²</td>
                        <td>${g.m7.airDensityRho}</td>
                        <td>${g.m7.fgRangeShiftYards > 0 ? '+' : ''}${g.m7.fgRangeShiftYards} yds</td>
                        <td>${g.m7.deepPassShiftYards > 0 ? '+' : ''}${g.m7.deepPassShiftYards} yds</td>
                        <td>${g.m7.passGameModifierYards > 0 ? '+' : ''}${g.m7.passGameModifierYards} yds</td>
                        <td>${g.m11.rhoPlayerDensity} kg/m³</td>
                        <td style="color:var(--accent-cyan);">${g.m11.phiBioScore} (x${g.m11.closingMultiplier})</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function renderHistoricalLedger() {
    const container = document.getElementById("ledger-container");
    if (!container) return;

    const ledgerObj = (AppState.rawPayload && AppState.rawPayload.historical_ledger) || {};
    const summary = ledgerObj.summary || {};

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

        const gameSpreads = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "spread").sort((a, b) => b.evPct - a.evPct);
        const gameTotals = AppState.processedProps.filter(p => p.gameId === g.gameId && p.marketType === "total");
        const topPicks = [
            { p: gameSpreads[0], savedRec: savedEntry.spread_record },
            { p: gameTotals[0], savedRec: savedEntry.total_record }
        ].filter(item => item.p);

        topPicks.forEach(({ p, savedRec }) => {
            const isSpread = p.marketType === "spread";
            const fmtTipProj = (isSpread && Number(p.tipProjectedMean) > 0) ? `+${p.tipProjectedMean}` : `${p.tipProjectedMean}`;
            const fmtBdProj = (isSpread && Number(p.bdProjectedMean) > 0) ? `+${p.bdProjectedMean}` : `${p.bdProjectedMean}`;

            const bdCell = AppState.activeMode === "tip"
                ? `<div class="bd-preview-locked" onclick="window.unlockBallsDeepMode(event)" style="margin:0;padding:4px 8px;">
                     <span style="color:var(--accent-gold);">🔒 "You gotta pay to go balls deep..."</span>
                   </div>`
                : `<span style="color:var(--accent-emerald);">Proj: <strong>${fmtBdProj}</strong> (${p.bdModelPct}% | ${p.bdEvPct > 0 ? '+' : ''}${p.bdEvPct}% EV)</span>`;

            const gradedRes = (savedRec && savedRec.result_tip) ? savedRec.result_tip : "PENDING";

            rowsHTML += `
                <tr>
                    <td><strong>${g.matchup}</strong><br><span style="font-size:11px;">${statusLabel}</span></td>
                    <td>${isSpread ? 'SPREAD' : 'TOTAL (O/U)'} ${p.flagshipSlot ? `<br><span class="badge-menage">${p.flagshipSlot}</span>` : ""}</td>
                    <td><strong>${p.player}</strong> <span class="${p.tierBadge === 'SMASH' ? 'badge-smash' : 'badge-pass'}">${p.tierBadge}</span></td>
                    <td>${p.baseLine} (${p.baseOdds > 0 ? '+' + p.baseOdds : p.baseOdds})</td>
                    <td>Proj: <strong>${fmtTipProj}</strong> (${p.tipModelPct}% | ${p.tipEvPct > 0 ? '+' : ''}${p.tipEvPct}% EV)</td>
                    <td>${bdCell}</td>
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

            <div style="background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 800;">🛡️ PASS AUDIT (&lt;+10.0% EV LEANS)</div>
                <div style="font-size: 18px; font-weight: 800; margin: 6px 0; color: var(--text-secondary);">${fmtBucket("pass_audit")}</div>
                <div style="font-size: 11px; color: var(--text-muted);">Tracks lower-edge games we passed on</div>
            </div>

            <div style="background: var(--bg-elevated); border: 1px solid rgba(6, 182, 212, 0.45); border-radius: 8px; padding: 14px;">
                <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 800;">⚡ TIP vs. BALLS DEEP HEAD-TO-HEAD</div>
                <div style="font-size: 14px; font-weight: 800; margin: 6px 0;">Just the Tip: ${fmtBucket("tip_all")}</div>
                ${AppState.activeMode === "tip" ? `
                    <div class="bd-preview-locked" onclick="window.unlockBallsDeepMode(event)">
                        <span style="color: var(--accent-gold);">🔒 Balls Deep Record — "You gotta pay to go balls deep..."</span>
                    </div>
                ` : `
                    <div style="font-size: 14px; font-weight: 800; color: var(--accent-emerald);">Balls Deep: ${fmtBucket("balls_deep_all")}</div>
                `}
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
