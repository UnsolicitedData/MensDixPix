// ==========================================
// MODULE 13: FIXED SACRED GEOMETRY "RISE TO THE OCCASION" & INVERSE FAVORITE TRAP (M_RISE)
// Objective Poll/Market-to-EPA Divergence x Defensive Havoc + Coach/QB Lock + M11 > M13 Override
// ==========================================
function calcSacredGeometryRise(gameData, vegasHomeSpread = 0, epaDivergencePts = 0, elevMatrix = null, league = "NFL") {
    const home = (gameData.team_telemetry && gameData.team_telemetry.home) || {};
    const away = (gameData.team_telemetry && gameData.team_telemetry.away) || {};

    const homeIsUnderdog = vegasHomeSpread > 0;
    const dogTel = homeIsUnderdog ? home : away;
    const favTel = homeIsUnderdog ? away : home;

    // 1. Objective Poll/Market-to-EPA Efficiency Divergence (N_scale = 25 NCAA / 16 NFL)
    const nScale = (league === "NCAA") ? 25.0 : 16.0;
    let normDivergence = 0;
    const favPollOrMktRank = (favTel.poll_rank !== undefined)
        ? Number(favTel.poll_rank)
        : (favTel.market_rank !== undefined ? Number(favTel.market_rank) : null);

    if (favTel.epa_rank !== undefined && favPollOrMktRank !== null) {
        normDivergence = Math.max(-1.35, Math.min(1.35, (Number(favTel.epa_rank) - favPollOrMktRank) / nScale));
    } else {
        // Objective fallback using symmetric, mismatch-tapered EPA divergence (zero pull-to-zero bias)
        const marketEpaGap = epaDivergencePts * (homeIsUnderdog ? -1 : 1);
        normDivergence = Math.max(-1.25, Math.min(1.25, marketEpaGap / 4.5));
    }

    // 2. Objective Underdog Defensive Havoc Multiplier (Havoc_def,dog / Havoc_league)
    const havocLeague = (league === "NCAA") ? 0.162 : 0.148;
    let dogHavocRatio = 1.0;
    if (dogTel.def_havoc_rate !== undefined && dogTel.def_havoc_rate !== null) {
        dogHavocRatio = Math.max(0.55, Math.min(1.45, Number(dogTel.def_havoc_rate) / havocLeague));
    } else {
        dogHavocRatio = Math.max(
            0.65,
            Math.min(1.35, 1.0 - (dogTel.opp_rz_dvoa || 0) + (((dogTel.closing_rank_pct || 0.5) - 0.5) * 0.45))
        );
    }

    const passiveDogDampener = (dogHavocRatio < 0.85 && normDivergence > 0) ? 0.35 : 1.0;

    // 3. Venue & Schedule Spot Scalar
    let spotScalar = 1.0;
    if (gameData.spot_scalar !== undefined) {
        spotScalar = Number(gameData.spot_scalar);
    } else if (gameData.lookahead_trap || gameData.hangover_spot) {
        spotScalar = 1.382;
    } else if (gameData.is_primetime || gameData.is_night_game) {
        spotScalar = 1.25;
    }

    let deltaContext = Math.max(-1.618, Math.min(1.618, normDivergence * dogHavocRatio * passiveDogDampener * spotScalar));

    // 4. Live Coach / QB Roster-Sync Lock
    let coachSyncBlocked = false;
    if (dogTel.coach_roster_verified === false || dogTel.hc_changed === true || gameData.stale_coach_tag === true) {
        if (deltaContext > 0) {
            deltaContext = 0.0;
            coachSyncBlocked = true;
        }
    }

    // 5. Hierarchy Rule #1 (M11 > M13)
    let m11OverrideApplied = false;
    if (!homeIsUnderdog && elevMatrix && elevMatrix.hypoxicOverrideM13 && deltaContext > 0) {
        deltaContext = 0.0;
        m11OverrideApplied = true;
    }

    // 6. Sacred Geometry Bidirectional Multiplier
    const Fn = Math.abs(vegasHomeSpread) <= 7.5 ? FIBONACCI_TIERS.TIER_1 : FIBONACCI_TIERS.TIER_2;
    const mRiseDelta = SACRED_PHI_OVER_PI * (Fn / FIBONACCI_TIERS.SUM_F) * deltaContext;

    const mRiseDog = 1.0 + mRiseDelta;
    const mRiseFav = 1.0 - mRiseDelta;

    const propMeanMultDog = Number((1.0 + (0.382 * mRiseDelta)).toFixed(4));
    const propMeanMultFav = Number((1.0 - (0.382 * mRiseDelta)).toFixed(4));
    const tdLambdaMultDog = Number(mRiseDog.toFixed(4));
    const tdLambdaMultFav = Number(mRiseFav.toFixed(4));
    const riseHomeSpreadAdj = (homeIsUnderdog ? -1 : 1) * (mRiseDelta * 4.2);

    return {
        mRiseMultiplier: Number(mRiseDog.toFixed(4)),
        mRiseDog: Number(mRiseDog.toFixed(4)),
        mRiseFav: Number(mRiseFav.toFixed(4)),
        mRiseSignedHomeDelta: Number((homeIsUnderdog ? mRiseDelta : -mRiseDelta).toFixed(4)),
        deltaContext: Number(deltaContext.toFixed(3)),
        dogHavocRatio: Number(dogHavocRatio.toFixed(3)),
        riseHomeSpreadAdj: Number(riseHomeSpreadAdj.toFixed(2)),
        propMeanMultDog,
        propMeanMultFav,
        tdLambdaMultDog,
        tdLambdaMultFav,
        m11OverrideApplied,
        coachSyncBlocked
    };
}

// MODULE 9: SYMMETRIC FULL-GAME FAIR MARGIN (v311 — ZERO PULL-TO-ZERO, ZERO BLOAT)
function calcFullGameFairMargin(gameData, phiCirc, psiCoupled11_12 = 0, mode = "tip", vegasHomeSpread = null, psiElev = 0, elevMatrix = null, intensitySlider = 0.0) {
    const hfaBase = gameData.hfa_base !== undefined ? gameData.hfa_base : PI_OVER_PHI_HFA;
    const home = (gameData.team_telemetry && gameData.team_telemetry.home) || {};
    const away = (gameData.team_telemetry && gameData.team_telemetry.away) || {};
    const league = gameData.league || "NFL";

    const homeEpa = Number(home.net_epa_per_play || 0);
    const awayEpa = Number(away.net_epa_per_play || 0);
    const hasEpaFeed = (homeEpa !== 0 || awayEpa !== 0);
    const epaDiff = awayEpa - homeEpa;
    const deltaTOReg = (away.turnover_reg_delta || 0) - (home.turnover_reg_delta || 0);

    // Fixed Sign: negative opp_rz_dvoa = stronger defense (good home RZ defense moves spread negative)
    let deltaRzFin = ((home.opp_rz_dvoa || 0) - (away.opp_rz_dvoa || 0)) * 4.0;
    if (away.rz_td_pct_off !== undefined && home.rz_td_pct_def !== undefined) {
        const nRzProj = Number(away.rz_trips_proj || 3.2);
        const fgAcc = (away.fg_pct_u45 !== undefined) ? Number(away.fg_pct_u45) : 0.84;
        const fgBaseline = (league === "NCAA") ? 0.82 : 0.88;
        const awayRzScore = nRzProj * ((4.0 * (Number(away.rz_td_pct_off) - Number(home.rz_td_pct_def))) + (3.0 * (fgAcc - fgBaseline)));
        const homeRzScore = (home.rz_td_pct_off !== undefined && away.rz_td_pct_def !== undefined)
            ? Number(home.rz_trips_proj || 3.2) * (4.0 * (Number(home.rz_td_pct_off) - Number(away.rz_td_pct_def)))
            : 0;
        deltaRzFin = Math.max(-2.8, Math.min(2.8, awayRzScore - homeRzScore));
    }

    // Hierarchy Rule #2: 3rd-String QB Time-of-Possession Feedback Loop
    const homeIsThirdString = Boolean((home.qb_depth && home.qb_depth >= 3) || home.is_third_string_qb);
    const awayIsThirdString = Boolean((away.qb_depth && away.qb_depth >= 3) || away.is_third_string_qb);
    const thirdStringQbAlert = Boolean(
        (homeIsThirdString && awayEpa >= 0.0) ||
        (awayIsThirdString && homeEpa >= 0.0)
    );
    const thirdStringTeam = homeIsThirdString ? (gameData.home_team || "HOME") : (awayIsThirdString ? (gameData.away_team || "AWAY") : null);

    // Strict Mode Firewall: "tip" uses Modules 1-9 ONLY
    const activePsi = (mode === "tip") ? 0 : psiCoupled11_12;
    const activeElev = (mode === "tip") ? 0 : psiElev;

    // True full-game offensive volume (62.32 NFL plays = GOLDEN_PLAY_SCALER * PHI; 68.0 NCAA plays)
    const trueGamePlays = (league === "NCAA") ? 68.0 : (GOLDEN_PLAY_SCALER * GOLDEN_RATIO_PHI);
    const epaPoints = trueGamePlays * epaDiff;
    const rawEpaSpread = epaPoints - hfaBase;
    const rawTelemetryHomeSpread = rawEpaSpread + deltaRzFin + deltaTOReg - phiCirc + activePsi + activeElev;

    let calibratedHomeSpread = rawTelemetryHomeSpread;
    let m13 = {
        mRiseMultiplier: 1.0,
        mRiseDog: 1.0,
        mRiseFav: 1.0,
        mRiseSignedHomeDelta: 0.0,
        deltaContext: 0.0,
        dogHavocRatio: 1.0,
        riseHomeSpreadAdj: 0.0,
        m11OverrideApplied: false,
        coachSyncBlocked: false
    };

    if (vegasHomeSpread !== null && vegasHomeSpread !== undefined && !isNaN(vegasHomeSpread)) {
        const telemetryWeight = FIBONACCI_TIERS.TIER_1 / FIBONACCI_TIERS.SUM_F; // 34 / 76 = 0.44737

        // Symmetric EPA residual: zero-safe when feed missing, mismatch-tapered above 10-pt spreads
        let epaResidual = 0.0;
        let taperedEpaGap = 0.0;
        if (hasEpaFeed) {
            const rawEpaGap = rawEpaSpread - vegasHomeSpread;
            const excessSpread = Math.max(0.0, Math.abs(vegasHomeSpread) - 10.0);
            const mismatchTaper = 1.0 / (1.0 + Math.pow(excessSpread / 10.0, 2));
            taperedEpaGap = rawEpaGap * mismatchTaper;
            epaResidual = 3.5 * Math.tanh((rawEpaGap * telemetryWeight) / 3.5) * mismatchTaper;
        }

        m13 = calcSacredGeometryRise(gameData, vegasHomeSpread, taperedEpaGap, elevMatrix, league);
        const m13FlowScale = (mode === "davinci")
            ? Math.max(0.0, 1.0 + (intensitySlider * (FIBONACCI_TIERS.TIER_2 / FIBONACCI_TIERS.SUM_F)))
            : 1.0;
        const activeRiseAdj = (mode === "tip") ? 0.0 : (m13.riseHomeSpreadAdj * m13FlowScale);

        // Pure situational residuals + symmetric EPA residual (zero pull-to-zero, hard soft-cap prevents bloat)
        const situationalDelta = deltaRzFin + deltaTOReg - phiCirc + activePsi + activeElev + activeRiseAdj;
        const maxShift = (mode === "tip") ? 4.5 : 5.5;
        const finalDelta = maxShift * Math.tanh((epaResidual + situationalDelta) / maxShift);

        calibratedHomeSpread = vegasHomeSpread + finalDelta;

        // DaVinci Continuous Flow Spread Escalator
        if (mode === "davinci" && intensitySlider !== 0) {
            const edgeVsVegas = calibratedHomeSpread - vegasHomeSpread;
            const flowDir = edgeVsVegas !== 0 ? Math.sign(edgeVsVegas) : (finalDelta !== 0 ? Math.sign(finalDelta) : -1);
            const davinciSpreadFlow = flowDir * intensitySlider * (FIBONACCI_TIERS.TIER_2 / FIBONACCI_TIERS.SUM_F) * GOLDEN_RATIO_PHI * 1.85;
            calibratedHomeSpread += davinciSpreadFlow;
        }
    }

    return {
        fairHomeSpread: Number(calibratedHomeSpread.toFixed(2)),
        rawTelemetrySpread: Number(rawTelemetryHomeSpread.toFixed(2)),
        epaContribution: Number(epaPoints.toFixed(2)),
        deltaRzFin: Number(deltaRzFin.toFixed(2)),
        activeCoupledOverlay: Number(activePsi.toFixed(3)),
        mRiseMultiplier: m13.mRiseMultiplier,
        m13Details: m13,
        thirdStringQbAlert,
        thirdStringTeam
    };
}
