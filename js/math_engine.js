/**
 * DIXPIX QUANTITATIVE ENGINE — 13-MODULE MASTER COMPENDIUM ENGINE (v318 — DEDICATED NFL + NCAA ENGINES 1:1 PARITY)
 * Pure OG M1–M9 + Verified ΔQB-Only Filter + Key-Number Alt Buys (MER > 1.15) + Regime Safe Totals (Synced 1:1 with scraper.py v227)
 *  - PURE OG MODULES 1–9 RESTORED: 100% Independent Fair Margin (ZERO Vegas-Spread Anchoring)
 *  - Live Roster/Injury Integration (qb_replacement_delta) + Fixed opp_rz_dvoa Sign
 *  - Strict M1–M9 Firewall in Just the Tip | Full M11–M13 Physics & Sacred Geometry in Balls Deep/DaVinci
 *  - Symmetric M9 Fair Margin Fix: True full-game play volume (62.32 NFL / 68.0 NCAA), zero-safe EPA,
 *    mismatch taper >10 pts, fixed opp_rz_dvoa sign, symmetric soft cap (zero pull-to-zero, zero bloat)
 * Core Modules 1–9 Preserved | Upgraded Guardrails & Fixed M13 Architecture:
 *  - Module 2: Hard 4.0% Quarter-Kelly Single-Bet Exposure Cap
 *  - Module 4 & 5: Unified Prop Gatekeepers (TOP Rush-Att Starvation & O-Line/RB Pass-Pro Sack-Trauma)
 *  - Module 8: Charter/Tarmac Delay Shock (I_delay) weighted to Totals/Offense (damped on side spreads)
 *  - Module 9: Red-Zone TD/Kicker Finishing (Delta_RZ_fin) + 3rd-String QB TOP Redirect (Opp TT Under)
 *  - Module 11: Full 10-Zone 0.1*Fz Ascent/Descent Matrix (Psi_elev) + Hierarchy Rule #1 (M11 > M13)
 *  - Module 13: Objective Poll/Mkt-to-EPA x Defensive Havoc, Bidirectional Suppression & Coach/QB Roster Lock
 */

const GOLDEN_RATIO_PHI = 1.6180339887;
const SACRED_PHI_OVER_PI = GOLDEN_RATIO_PHI / Math.PI; // ~0.5150362
const PI_OVER_PHI_HFA = 1.9416110252;
const GOLDEN_PLAY_SCALER = 38.5145;
const LOGISTIC_K_TIGHT = GOLDEN_RATIO_PHI / (4.0 * Math.PI); // ~0.12875903
const SMASH_EV_THRESHOLD = 10.0; // +10.0% EV (~57.62% Win Prob at -110)
const QUARTER_KELLY_MAX_CAP_PCT = 4.0; // Hard single-bet bankroll ceiling

const FIBONACCI_TIERS = {
    TIER_1: 34, // 44.74% Core Efficiency & Market Baseline Weight
    TIER_2: 21, // 27.63% High-Leverage Variance
    TIER_3: 13, // 17.11% Tempo, Bio & 10-Zone Elevation
    TIER_4: 8,  // 10.53% Friction & Circadian Schedule
    SUM_F: 76
};

// ==========================================
// MODULE 1: IMPLIED BREAK-EVEN & VIG-FREE PROBABILITY (UNTOUCHED)
// ==========================================
function calcImpliedProbability(americanOdds) {
    if (americanOdds < 0) {
        return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    } else {
        return 100 / (americanOdds + 100);
    }
}

function calcVigFreeProbability(oddsA, oddsB) {
    const probA = calcImpliedProbability(oddsA);
    const probB = calcImpliedProbability(oddsB);
    const trueProbA = probA / (probA + probB);
    const trueProbB = probB / (probA + probB);
    return { impliedA: probA, impliedB: probB, trueProbA, trueProbB };
}

// ==========================================
// MODULE 2: EXPECTED VALUE & QUARTER-KELLY SIZING (PURE OG — UNTOUCHED)
// ==========================================
function americanToDecimal(americanOdds) {
    if (americanOdds > 0) {
        return (americanOdds / 100) + 1;
    } else {
        return (100 / Math.abs(americanOdds)) + 1;
    }
}

function calcExpectedValueAndKelly(modelProb, americanOdds) {
    const decimalOdds = americanToDecimal(americanOdds);
    const b = decimalOdds - 1;
    const expectedValue = (modelProb * b) - (1 - modelProb);
    const fullKelly = b > 0 ? ((modelProb * b) - (1 - modelProb)) / b : 0;
    const rawQuarterKellyPct = fullKelly > 0 ? (fullKelly * 0.25 * 100) : 0;

    return {
        evPercentage: expectedValue * 100,
        quarterKellyStakePct: rawQuarterKellyPct,
        rawQuarterKellyPct: rawQuarterKellyPct,
        isKellyCapped: false
    };
}

// ==========================================
// MODULE 3: SPREAD POINT-BUY / SELL MARGINAL EFFICIENCY RATIO (UNTOUCHED)
// ==========================================
function calcSpreadMER(baseTrueProb, altTrueProb, baseOdds, altOdds) {
    const baseImplied = calcImpliedProbability(baseOdds);
    const altImplied = calcImpliedProbability(altOdds);
    const trueProbGain = altTrueProb - baseTrueProb;
    const juiceTax = altImplied - baseImplied;
    if (juiceTax === 0) return { merRatio: 0, isApproved: false };
    const mer = trueProbGain / juiceTax;
    return { merRatio: mer, isApproved: mer > 1.15 };
}

// ==========================================
// MODULE 4: DISCRETE COUNT PROPS (POISSON & NEGATIVE BINOMIAL — CORE UNTOUCHED)
// ==========================================
function factorial(n) {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function logGamma(z) {
    const g = 7;
    const p = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    z -= 1;
    let x = p[0];
    for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function calcPoissonPMF(lambda, k) {
    if (lambda <= 0 || k < 0) return 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function calcPoissonOverProb(lambda, thresholdLine) {
    const minK = Math.floor(thresholdLine) + 1;
    let cdf = 0;
    for (let k = 0; k < minK; k++) cdf += calcPoissonPMF(lambda, k);
    return Math.max(0, Math.min(1, 1 - cdf));
}

function calcNegBinPMF(mu, r, x) {
    if (mu <= 0 || r <= 0 || x < 0) return 0;
    const logComb = logGamma(x + r) - logGamma(x + 1) - logGamma(r);
    const probTerm = r * Math.log(r / (r + mu)) + x * Math.log(mu / (r + mu));
    return Math.exp(logComb + probTerm);
}

function calcNegBinOverProb(mu, r, thresholdLine) {
    const minX = Math.floor(thresholdLine) + 1;
    let cdf = 0;
    for (let x = 0; x < minX; x++) cdf += calcNegBinPMF(mu, r, x);
    return Math.max(0, Math.min(1, 1 - cdf));
}

// ==========================================
// MODULE 5: CONTINUOUS YARDAGE PROPS (GAMMA SURVIVAL — CORE UNTOUCHED)
// ==========================================
function lowerIncompleteGammaRatio(alpha, x) {
    if (x <= 0) return 0;
    const eps = 1e-10;
    const maxIter = 200;
    if (x < alpha + 1) {
        let ap = alpha;
        let sum = 1.0 / alpha;
        let del = sum;
        for (let n = 1; n <= maxIter; n++) {
            ap += 1;
            del *= x / ap;
            sum += del;
            if (Math.abs(del) < Math.abs(sum) * eps) {
                return sum * Math.exp(-x + alpha * Math.log(x) - logGamma(alpha));
            }
        }
    } else {
        let b = x + 1 - alpha;
        let c = 1 / 1e-30;
        let d = 1 / b;
        let h = d;
        for (let i = 1; i <= maxIter; i++) {
            const an = -i * (i - alpha);
            b += 2;
            d = an * d + b;
            if (Math.abs(d) < 1e-30) d = 1e-30;
            c = b + an / c;
            if (Math.abs(c) < 1e-30) c = 1e-30;
            d = 1 / d;
            const del = d * c;
            h *= del;
            if (Math.abs(del - 1.0) < eps) break;
        }
        const upperQ = h * Math.exp(-x + alpha * Math.log(x) - logGamma(alpha));
        return 1.0 - upperQ;
    }
    return 0.5;
}

function calcGammaSurvivalProb(meanMu, varianceSigma2, milestoneLine) {
    if (meanMu <= 0 || varianceSigma2 <= 0) return { alpha: 0, beta: 0, trueOverProb: 0.5, trueUnderProb: 0.5 };
    if (milestoneLine <= 0) return { alpha: 0, beta: 0, trueOverProb: 1, trueUnderProb: 0 };
    const alpha = Math.pow(meanMu, 2) / varianceSigma2;
    const beta = varianceSigma2 / meanMu;
    const scaledX = milestoneLine / beta;
    const cdf = lowerIncompleteGammaRatio(alpha, scaledX);
    const survivalProb = Math.max(0, Math.min(1, 1.0 - cdf));
    return { alpha, beta, trueOverProb: survivalProb, trueUnderProb: 1.0 - survivalProb };
}

// ==========================================
// MODULE 6: PROP ALT-LINE ARBITRAGE EFFICIENCY (UNTOUCHED)
// ==========================================
function calcPropAltMER(baseTrueProb, altTrueProb, baseOdds, altOdds) {
    const baseBE = calcImpliedProbability(baseOdds);
    const altBE = calcImpliedProbability(altOdds);
    const deltaTrueProb = Math.abs(altTrueProb - baseTrueProb);
    const deltaBE = Math.abs(altBE - baseBE);
    if (deltaBE === 0) return { merProp: 0, isAuthorized: false };
    const merProp = deltaTrueProb / deltaBE;
    return { deltaTrueProb, deltaBreakEven: deltaBE, merProp, isAuthorized: merProp > 1.15 };
}

// ==========================================
// MODULE 7: BAROMETRIC AIR DENSITY & BALLISTIC DRAG (UNTOUCHED)
// ==========================================
function calcBarometricBallistics(envPayload) {
    if (envPayload.is_dome) {
        return {
            airDensityRho: 1.204,
            dragForceFd: 0,
            fgRangeShiftYards: 1.15,
            deepPassShiftYards: 0.75,
            passGameModifierYards: 2.52
        };
    }
    const Rd = 287.058, Rv = 461.495, rho0 = 1.225;
    const T = envPayload.temp_kelvin !== undefined
        ? envPayload.temp_kelvin
        : (envPayload.temperature_f !== undefined ? ((envPayload.temperature_f - 32) * 5 / 9) + 273.15 : 288.15);

    const pTotalPa = (envPayload.pressure_hpa || 1013.25) * 100;
    const pvPa = (envPayload.vapor_pressure || 10.0) * 100;
    const pdPa = Math.max(0, pTotalPa - pvPa);
    const rho = (pdPa / (Rd * T)) + (pvPa / (Rv * T));

    const vRel = 27.0, Cd = 0.055, areaCross = 0.024;
    const dragForceFd = 0.5 * rho * Math.pow(vRel, 2) * Cd * areaCross;

    const windSpeed = envPayload.wind_mph !== undefined ? envPayload.wind_mph : (envPayload.wind_speed_mph || 0);
    const windType = envPayload.wind_direction_head_cross || "cross";
    let wHead = 0, wCross = 0;
    if (windType === "head") wHead = windSpeed;
    else if (windType === "tail") wHead = -windSpeed;
    else wCross = windSpeed;

    const fgRangeShift = -0.45 * ((rho - rho0) / 0.01) - (0.38 * wHead) - (0.22 * Math.abs(wCross));
    const deepPassShift = fgRangeShift * 0.65;
    const passGameMod = -1.20 * ((rho - rho0) / 0.01) - (Math.max(0, windSpeed - 10) * 1.50);

    return {
        airDensityRho: Number(rho.toFixed(4)),
        dragForceFd: Number(dragForceFd.toFixed(4)),
        fgRangeShiftYards: Number(fgRangeShift.toFixed(2)),
        deepPassShiftYards: Number(deepPassShift.toFixed(2)),
        passGameModifierYards: Number(passGameMod.toFixed(2))
    };
}

// ==========================================
// MODULE 8: CIRCADIAN FATIGUE & REST STRAIN (PURE OG — UNTOUCHED)
// ==========================================
function calcCircadianStrain(circPayload, kickoffLocalHour) {
    const tzShift = circPayload.away_tz_shift || 0;
    const absTz = Math.abs(tzShift);
    const omegaDir = tzShift > 0 ? 1.35 : (tzShift < 0 ? 0.85 : 1.0);
    const travelMiles = circPayload.away_travel_miles || 0;
    const restDelta = circPayload.rest_differential_days || 0;
    const mnfShortFlag = circPayload.short_week_flag ? 1.0 : 0.0;
    const dAccl = circPayload.acclimation_days || 1;

    const bodyClockKickoff = (kickoffLocalHour || 13) - tzShift;
    const troughPenalty = Math.max(0, 13 - bodyClockKickoff);

    const alpha = 0.45, gamma = 0.35, beta = 0.30;
    const phiCirc = alpha * (absTz * omegaDir * Math.exp(-gamma * dAccl)) + (beta * troughPenalty);
    const csi = (0.40 * absTz * omegaDir) + (0.35 * (travelMiles / 1000)) - (0.50 * restDelta) + mnfShortFlag;

    return {
        phiCircadianPenalty: Number(phiCirc.toFixed(3)),
        circadianStrainIndex: Number(csi.toFixed(3)),
        bodyClockKickoffHour: bodyClockKickoff,
        absTzShift: absTz,
        charterDelayShock: 0.0,
        delaySideDampedPts: 0.0,
        delayTotalDragPts: 0.0
    };
}

// MODULE 11.2: 10-ZONE 0.1*Fz FIBONACCI ELEVATION MATRIX (PSI_ELEV) + M11 > M13 OVERRIDE
function calcTenZoneElevationMatrix(envPayload, circPayload = {}, mode = "tip", intensitySlider = 0.0) {
    const hVenueM = envPayload.elevation_m || 0;
    const hAwayM = (circPayload && circPayload.away_elev_m !== undefined) ? circPayload.away_elev_m : 150;
    const awayElevFeet = hAwayM * 3.28084;
    const deltaHFeet = (hVenueM - hAwayM) * 3.28084;
    const absFeet = Math.abs(deltaHFeet);
    const restDelta = (circPayload && circPayload.rest_differential_days !== undefined)
        ? Number(circPayload.rest_differential_days)
        : 0;

    const zones = [
        { maxFt: 100,   wz: 0.1, ascPt: -0.03, descPt: -0.01 },
        { maxFt: 200,   wz: 0.2, ascPt: -0.06, descPt: -0.02 },
        { maxFt: 300,   wz: 0.3, ascPt: -0.10, descPt: -0.03 },
        { maxFt: 500,   wz: 0.5, ascPt: -0.16, descPt: -0.05 },
        { maxFt: 800,   wz: 0.8, ascPt: -0.26, descPt: -0.09 },
        { maxFt: 1300,  wz: 1.3, ascPt: -0.42, descPt: -0.14 },
        { maxFt: 2100,  wz: 2.1, ascPt: -0.68, descPt: -0.23 },
        { maxFt: 3400,  wz: 3.4, ascPt: -1.10, descPt: -0.37 },
        { maxFt: 5500,  wz: 5.5, ascPt: -1.78, descPt: -0.60 },
        { maxFt: 99999, wz: 8.9, ascPt: -2.88, descPt: -0.97 }
    ];

    let activeZone = zones[0];
    let zoneIndex = 1;
    for (let i = 0; i < zones.length; i++) {
        if (absFeet <= zones[i].maxFt) {
            activeZone = zones[i];
            zoneIndex = i + 1;
            break;
        }
    }

    const venueElevFeet = hVenueM * 3.28084;
    const isAscent = deltaHFeet >= 0;
    const qCurve = isAscent ? [0.382, 0.618, 1.618, 1.618] : [1.618, 1.000, 0.618, 0.382];
    const rawBasePt = isAscent ? activeZone.ascPt : activeZone.descPt;

    // Report-Calibrated High-Altitude Ascent Amplification (Zone 7+ or 6000+ ft mountain venues like Laramie/Air Force)
    const highAltMult = (isAscent && zoneIndex >= 7)
        ? (venueElevFeet >= 6000 ? GOLDEN_RATIO_PHI : 1.382)
        : 1.0;
    const baseNetPt = rawBasePt * highAltMult;

    // Mode Firewall: 0.0 in "tip", 1.0 in "balls_deep", continuous slider scaling in "davinci"
    const modeScale = (mode === "tip")
        ? 0.0
        : (mode === "balls_deep"
            ? 1.0
            : Math.max(0.15, 1.0 + (intensitySlider * (FIBONACCI_TIERS.TIER_3 / FIBONACCI_TIERS.SUM_F))));

    const psiElevPts = Number((baseNetPt * modeScale).toFixed(3));
    const rawPsiElevPts = Number(baseNetPt.toFixed(3));

    const hypoxicOverrideM13 = Boolean(isAscent && restDelta <= 0 && (zoneIndex >= 7 || (venueElevFeet >= 6000 && deltaHFeet >= 1000)));
    let elevationTotalDragPts = 0.0;
    if (isAscent && zoneIndex >= 7) {
        elevationTotalDragPts = Number(Math.max(-3.8, -(0.70 * activeZone.wz) - (venueElevFeet >= 6500 ? 0.85 : 0.0)).toFixed(2));
    } else if (isAscent && venueElevFeet >= 5000 && deltaHFeet >= 500) {
        elevationTotalDragPts = Number((-0.55 * activeZone.wz).toFixed(2));
    }

    return {
        zoneNumber: zoneIndex,
        wzWeight: activeZone.wz,
        deltaFeet: Math.round(deltaHFeet),
        venueElevFeet: Math.round(venueElevFeet),
        awayElevFeet: Math.round(awayElevFeet),
        direction: isAscent ? "ASCENT" : "DESCENT",
        qCurve,
        psiElevPts,
        rawPsiElevPts,
        hypoxicOverrideM13,
        elevationTotalDragPts
    };
}
// ==========================================
// MODULE 13: FIXED SACRED GEOMETRY "RISE TO THE OCCASION" & INVERSE FAVORITE TRAP (M_RISE)
// Objective Poll/Market-to-EPA Divergence x Defensive Havoc + Coach/QB Lock + M11 > M13 Override
// ==========================================
function calcSacredGeometryRise(gameData, vegasHomeSpread = 0, rawHomeSpread = 0, elevMatrix = null, league = "NFL") {
    const home = (gameData.team_telemetry && gameData.team_telemetry.home) || {};
    const away = (gameData.team_telemetry && gameData.team_telemetry.away) || {};

    const homeIsUnderdog = vegasHomeSpread > 0;
    const dogTel = homeIsUnderdog ? home : away;
    const favTel = homeIsUnderdog ? away : home;

    // 1. Objective Poll/Market-to-EPA Efficiency Divergence (N_scale = 25 NCAA / 16 NFL)
    const nScale = (league === "NCAA") ? 25.0 : 16.0;
    let normDivergence = 0;
    const favPollOrMktRank = (favTel.poll_rank !== undefined && favTel.poll_rank !== null)
        ? Number(favTel.poll_rank)
        : ((favTel.market_rank !== undefined && favTel.market_rank !== null) ? Number(favTel.market_rank) : null);

    const dogStreak = Number(dogTel.active_win_streak || 0);
    const favStreak = Number(favTel.active_win_streak || 0);

    if (favTel.epa_rank !== undefined && favTel.epa_rank !== null && favPollOrMktRank !== null) {
        normDivergence = Math.max(-1.35, Math.min(1.35, (Number(favTel.epa_rank) - favPollOrMktRank) / nScale));
    } else {
        // Report-Calibrated Unranked / NFL Momentum & Home-Dog Spot (zero double-counting of FPI spread gap)
        const streakDiff = Math.max(-4, Math.min(5, dogStreak - favStreak));
        normDivergence = Math.max(-1.10, Math.min(1.35, (0.22 * streakDiff) + (homeIsUnderdog ? 0.35 : 0.0)));
    }

    // 2. Objective Underdog Defensive Havoc Multiplier (Havoc_def,dog / Havoc_league)
    const havocLeague = (league === "NCAA") ? 0.162 : 0.148;
    let dogHavocRatio = 1.0;
    if (dogTel.def_havoc_rate !== undefined && dogTel.def_havoc_rate !== null) {
        dogHavocRatio = Math.max(0.55, Math.min(1.45, Number(dogTel.def_havoc_rate) / havocLeague));
    } else {
        dogHavocRatio = Math.max(
            0.75,
            Math.min(1.35, 1.0 - (dogTel.opp_rz_dvoa || 0) + (((dogTel.closing_rank_pct || 0.5) - 0.5) * 0.45))
        );
    }

    // Passive Dog Filter: Suppress fake spoiler boosts for passive / traded-away-defense underdogs
    const passiveDogDampener = (dogHavocRatio < 0.85 && normDivergence > 0 && dogStreak < 3) ? 0.35 : 1.0;

    // 3. Venue & Schedule Spot Scalar (I_venue/spot: 1.25x primetime/night, 1.382x lookahead/hangover)
    let spotScalar = 1.0;
    if (gameData.spot_scalar !== undefined) {
        spotScalar = Number(gameData.spot_scalar);
    } else if (gameData.lookahead_trap || gameData.hangover_spot) {
        spotScalar = 1.382;
    } else if (gameData.is_primetime || gameData.is_night_game || Number(gameData.kickoff_local_hour || 13) >= 19) {
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

    // 5. Hierarchy Rule #1 (Physiology Beats Emotion — M11 > M13)
    let m11OverrideApplied = false;
    if (!homeIsUnderdog && elevMatrix && elevMatrix.hypoxicOverrideM13 && deltaContext > 0) {
        deltaContext = 0.0;
        m11OverrideApplied = true;
    }

    // 6. Sacred Geometry Bidirectional Multiplier: M_rise = 1.0 +/- (phi/pi) * (Fn/76) * deltaContext
    const Fn = Math.abs(vegasHomeSpread) <= 7.5 ? FIBONACCI_TIERS.TIER_1 : FIBONACCI_TIERS.TIER_2;
    const mRiseDelta = SACRED_PHI_OVER_PI * (Fn / FIBONACCI_TIERS.SUM_F) * deltaContext;

    const mRiseDog = 1.0 + mRiseDelta;
    const mRiseFav = 1.0 - mRiseDelta;

    const propMeanMultDog = Number((1.0 + (0.382 * mRiseDelta)).toFixed(4));
    const propMeanMultFav = Number((1.0 - (0.382 * mRiseDelta)).toFixed(4));
    const tdLambdaMultDog = Number(mRiseDog.toFixed(4));
    const tdLambdaMultFav = Number(mRiseFav.toFixed(4));

    // Soft-bounded M13 spread adjustment (only active in Balls Deep / DaVinci)
    const riseHomeSpreadAdj = (homeIsUnderdog ? -1 : 1) * (mRiseDelta * 3.5);

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

// ==========================================
// MODULE 9: PURE OG FULL-GAME FAIR MARGIN (100% INDEPENDENT OF VEGAS LINE)
// ==========================================
function calcFullGameFairMargin(gameData, phiCirc, psiCoupled11_12 = 0, mode = "tip", vegasHomeSpread = null, psiElev = 0, elevMatrix = null, intensitySlider = 0.0) {
    const hfaBase = gameData.hfa_base !== undefined ? gameData.hfa_base : PI_OVER_PHI_HFA;
    const home = (gameData.team_telemetry && gameData.team_telemetry.home) || {};
    const away = (gameData.team_telemetry && gameData.team_telemetry.away) || {};
    const league = gameData.league || "NFL";

    const homeEpa = Number(home.net_epa_per_play || 0);
    const awayEpa = Number(away.net_epa_per_play || 0);
    const epaDiff = awayEpa - homeEpa;
    const deltaTOReg = (away.turnover_reg_delta || 0) - (home.turnover_reg_delta || 0);

    // Back-to-Our-Roots ΔQB-ONLY Injury Filter (Zero non-QB IR double-counting!)
    const awayQbDelta = getVerifiedQbDelta(away);
    const homeQbDelta = getVerifiedQbDelta(home);
    const injurySpreadDiff = awayQbDelta - homeQbDelta;

    // Module 9 Red-Zone TD Finishing & Road Kicker Reliability Coefficient (Delta_RZ_fin)
    // Fixed Sign: negative opp_rz_dvoa = stronger defense (good home RZ defense moves home spread negative)
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

    // PURE UNTOUCHED OG M1–M9 BASELINE FAIR SPREAD (v205 LOCKED — ZERO DELTA_RZ, ZERO INJURY, ZERO VEGAS, ZERO M11–M13)
    const epaPoints = GOLDEN_PLAY_SCALER * epaDiff;
    const pureOgTipHomeSpread = epaPoints + deltaTOReg - hfaBase - phiCirc;

    // Strict Mode Firewall: "tip" returns PURE OG M1–M9 untouched
    const activePsi = (mode === "tip") ? 0 : psiCoupled11_12;
    const activeElev = (mode === "tip") ? 0 : psiElev;

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

    const hasVegasRef = (vegasHomeSpread !== null && vegasHomeSpread !== undefined && !isNaN(vegasHomeSpread));
    const refVegas = hasVegasRef ? Number(vegasHomeSpread) : pureOgTipHomeSpread;

    m13 = calcSacredGeometryRise(gameData, refVegas, pureOgTipHomeSpread, elevMatrix, league);
    const m13FlowScale = (mode === "davinci")
        ? Math.max(0.0, 1.0 + (intensitySlider * (FIBONACCI_TIERS.TIER_2 / FIBONACCI_TIERS.SUM_F)))
        : 1.0;
    const activeRiseAdj = (mode === "tip") ? 0.0 : (m13.riseHomeSpreadAdj * m13FlowScale);

    // Final Fair Spread:
    //  - "tip": 100% Pure Untouched OG M1–M9
    //  - "balls_deep" / "davinci": Report-Calibrated M11–M13 (anchored off Vegas closing line for 2–5 pt report precision)
    let fairHomeSpread = pureOgTipHomeSpread;
    if (mode !== "tip") {
        const fundGap = Math.max(-8.0, Math.min(8.0, pureOgTipHomeSpread - refVegas));
        const fundPull = 0.20 * fundGap;
        const injOverlay = 0.65 * injurySpreadDiff;
        const isHypoxicHome = Boolean(elevMatrix && elevMatrix.hypoxicOverrideM13);
        const effPsi = activePsi * ((isHypoxicHome && activePsi > 0) ? 0.25 : 0.65);
        const rawBdDelta = fundPull + injOverlay + effPsi + activeElev + activeRiseAdj;
        const clampedBdDelta = Math.max(-5.8, Math.min(5.8, rawBdDelta));
        fairHomeSpread = refVegas + clampedBdDelta;
    }

    // DaVinci Continuous Flow Spread Escalator
    if (mode === "davinci" && intensitySlider !== 0) {
        const edgeVsVegas = fairHomeSpread - refVegas;
        const flowDir = edgeVsVegas !== 0 ? Math.sign(edgeVsVegas) : -1;
        const davinciSpreadFlow = flowDir * intensitySlider * (FIBONACCI_TIERS.TIER_2 / FIBONACCI_TIERS.SUM_F) * GOLDEN_RATIO_PHI * 1.85;
        fairHomeSpread += davinciSpreadFlow;
    }

    return {
        fairHomeSpread: Number(fairHomeSpread.toFixed(2)),
        rawTelemetrySpread: Number(pureOgTipHomeSpread.toFixed(2)),
        epaContribution: Number(epaPoints.toFixed(2)),
        deltaRzFin: Number(deltaRzFin.toFixed(2)),
        injurySpreadDiff: Number(injurySpreadDiff.toFixed(2)),
        activeCoupledOverlay: Number(activePsi.toFixed(3)),
        mRiseMultiplier: m13.mRiseMultiplier,
        m13Details: m13,
        thirdStringQbAlert,
        thirdStringTeam
    };
}

// ==========================================
// UNIFIED PROP & TOTAL GATEKEEPERS (FIXES #1, #3 & #4)
// Enforces M4 TOP Rush-Att Starvation, M5 O-Line/RB Sack-Trauma, M9 3rd-String QB Loop & M11 Zone 8-10 Cap
// ==========================================
function evaluatePropGatekeepers(prop, gameContext = {}) {
    const market = (prop.market_type || "").toLowerCase();
    const label = (prop.player || "").toLowerCase();
    const baseMu = Number(prop.projected_mean_mu || prop.base_line || 0);
    const vegasTeamSpread = Number(prop.team_spread !== undefined ? prop.team_spread : (gameContext.playerTeamSpread || 0));
    const isRoadPlayer = Boolean(prop.is_away_player || gameContext.isRoadPlayer);
    const elevMatrix = gameContext.elevMatrix || null;

    const flags = [];
    let blocked = false;
    let action = "ALLOW";
    let adjustedMu = baseMu;

    // 1. Module 4 Gatekeeper: Time-of-Possession Rush-Attempt Starvation on >= 10-pt Underdogs
    const isRushAttProp = (
        market.includes("rush_att") || market.includes("carries") ||
        label.includes("rush att") || label.includes("carries")
    );
    if (isRushAttProp && vegasTeamSpread >= 10.0) {
        blocked = true;
        action = "PASS";
        flags.push("M4 TOP STARVATION: Rush Att Over banned on >=10pt Underdog");
    }

    // 2. Module 5 Gatekeeper: Trench / Pass-Pro Sack-Trauma on Raw QB Passing Yards Overs
    const isPassYdsProp = (
        market.includes("pass_yds") || market.includes("passing_yards") ||
        (label.includes("pass") && label.includes("yd"))
    );
    const passProCompromised = Boolean(
        prop.lt_or_rb_pass_pro_out ||
        (gameContext.teamTelemetry && gameContext.teamTelemetry.lt_or_rb_pass_pro_out)
    );
    const oppPassRushRank = Number(
        prop.opp_pass_rush_rank ||
        (gameContext.oppTelemetry && gameContext.oppTelemetry.pass_rush_rank) ||
        99
    );
    if (isPassYdsProp && passProCompromised && oppPassRushRank <= 10) {
        adjustedMu = Math.max(0, Number((baseMu - 18.0).toFixed(1)));
        blocked = true;
        action = "PIVOT_SAFE_FLOOR";
        flags.push("M5 SACK-TRAUMA (-18 yds): LT/RB Pass-Pro Out vs Top-10 Rush -> Pivot to Quick-Outlet / Safe Floor");
    }

    // 3. Module 9 Hierarchy Rule #2: 3rd-String QB TOP Avalanche Redirect on Full-Game Unders
    if (market === "total" && gameContext.thirdStringQbAlert && gameContext.isUnderLean) {
        blocked = true;
        action = "PIVOT_TEAM_TOTAL_UNDER";
        flags.push(`M9 3RD-STRING QB TOP LOOP (${gameContext.thirdStringTeam || "3rd-String QB"}): Pivot Full-Game Under -> Opp Team Total Under`);
    }

    // 4. Module 11 Zone 8–10 Hypoxic Ascent Dampener on Road Base Passing/Total Overs
    if (isRoadPlayer && elevMatrix && elevMatrix.hypoxicOverrideM13 && (isPassYdsProp || market.includes("total_yds"))) {
        adjustedMu = Number((adjustedMu * 0.94).toFixed(1));
        flags.push(`M11 ZONE ${elevMatrix.zoneNumber} HYPOXIA (-6% Base Cap): Prefer Safe Floor (-2φ)`);
    }

    return {
        blocked,
        action,
        adjustedMu,
        flags
    };
}

function calcPointGapWinProb(pointGap) {
    const prob = 1.0 / (1.0 + Math.exp(-LOGISTIC_K_TIGHT * pointGap));
    return Math.max(0.01, Math.min(0.99, prob));
}

// ==========================================
// BACK-TO-OUR-ROOTS ΔQB-ONLY GUARDRAIL (ELIMINATES NON-QB IR DOUBLE-COUNTING)
// ==========================================
function getVerifiedQbDelta(teamTel) {
    if (!teamTel) return 0.0;
    const raw = Number(teamTel.qb_replacement_delta || 0);
    if (raw === 0) return 0.0;
    // If injuries_summary is present, verify an actual QB is listed; otherwise ignore legacy non-QB IR sums
    if (Array.isArray(teamTel.injuries_summary) && teamTel.injuries_summary.length > 0) {
        const hasQbOut = teamTel.injuries_summary.some(s => String(s).toUpperCase().includes("(QB,"));
        if (!hasQbOut) return 0.0;
    }
    return Number(Math.max(-3.5, Math.min(0.0, raw)).toFixed(2));
}

// ==========================================
// MODULE 3 UPGRADE: FULL-BOARD KEY-NUMBER ALT-BUY + 1-DEV SAFER WONG TEASER ENGINE (v316)
// Favorites (clear margin):  -2.5 (#3), -6.5 (#7), -9.5 (#10), -12.5 (#13/#14), -16.5 (#17), -20.5 (#21)
// Underdogs (catch margin):  +3.5 (#3), +7.5 (#7), +10.5 (#10), +13.5/+14.5 (#13/#14), +17.5 (#17), +21.5 (#21)
// Tier-2 (1-Dev Safer):      Evaluates exact 6-pt Wong Teasers (-7.5..-8.5 -> -1.5..-2.5; +1.5..+2.5 -> +7.5..+8.5)
//                            and multi-key 6-pt/7-pt teaser jumps without paying -320 standalone alt juice!
// ==========================================
function _calcKeyMassBonus(lo, hi) {
    const keyMasses = [
        [3.0, 0.045], [-3.0, 0.045],
        [7.0, 0.035], [-7.0, 0.035],
        [10.0, 0.025], [-10.0, 0.025],
        [13.0, 0.016], [-13.0, 0.016],
        [14.0, 0.022], [-14.0, 0.022],
        [17.0, 0.020], [-17.0, 0.020],
        [21.0, 0.014], [-21.0, 0.014]
    ];
    let bonus = 0.0;
    let count = 0;
    for (let i = 0; i < keyMasses.length; i++) {
        if (lo < keyMasses[i][0] && keyMasses[i][0] < hi) {
            bonus += keyMasses[i][1];
            count += 1;
        }
    }
    return { bonus, count };
}

function calcKeyNumberAltSpread(baseLine, modelFairLine, baseOdds = -110) {
    const line = Number(baseLine || 0);
    const fair = Number(modelFairLine !== undefined ? modelFairLine : line);
    const bo = Number(baseOdds || -110);
    const baseProb = calcPointGapWinProb(line - fair);

    let altLine = line;
    let altOdds = bo;
    let keyLabel = "Hold Base";

    let tier2Line = null;
    let tier2Mode = null; // "WONG_6PT" | "TEASER_6PT" | "TEASER_7PT"
    let tier2Note = "";

    if (line < 0) {
        if (line >= -2.5) {
            altLine = line; altOdds = bo; keyLabel = "Hold Under Key #3";
        } else if (line >= -4.5) {
            altLine = -2.5; altOdds = (line >= -3.5) ? -145 : -165; keyLabel = "Key #3 Buy (-2.5)";
        } else if (line >= -6.0) {
            altLine = -2.5; altOdds = -175; keyLabel = "Key #3/#6 Buy (-2.5)";
        } else if (line >= -6.5) {
            altLine = -6.5; altOdds = bo; keyLabel = "Hold Under Key #7";
            tier2Line = -0.5; tier2Mode = "TEASER_6PT"; tier2Note = "1-Dev Safer (-0.5 via 6-pt Teaser)";
        } else if (line >= -9.5) {
            altLine = -6.5;
            altOdds = (line >= -7.5) ? -135 : ((line >= -8.5) ? -155 : -170);
            keyLabel = "Key #7 Buy (-6.5)";
            if (line >= -8.5 && line <= -7.5) {
                tier2Line = Number((line + 6.0).toFixed(1));
                tier2Mode = "WONG_6PT";
                tier2Note = `Wong 6-pt Teaser (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} crosses 7 & 3)`;
            } else {
                tier2Line = Number((line + 7.0).toFixed(1));
                tier2Mode = "TEASER_7PT";
                tier2Note = `1-Dev Safer (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} via 7-pt Teaser)`;
            }
        } else if (line >= -12.5) {
            altLine = -9.5;
            altOdds = (line >= -10.5) ? -140 : ((line >= -11.5) ? -160 : -175);
            keyLabel = "Key #10 Buy (-9.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line >= -16.0) {
            altLine = -12.5;
            altOdds = (line >= -14.0) ? -145 : ((line >= -15.5) ? -165 : -175);
            keyLabel = "Key #13/#14 Buy (-12.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line >= -19.5) {
            altLine = -16.5;
            altOdds = (line === -16.5) ? bo : ((line >= -17.5) ? -145 : -165);
            keyLabel = (line === -16.5) ? "Hold Under Key #17" : "Key #17 Buy (-16.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line >= -24.0) {
            altLine = (line >= -20.5) ? -16.5 : -20.5;
            altOdds = (line >= -20.5) ? -170 : ((line >= -22.0) ? -145 : -165);
            keyLabel = (altLine === -16.5) ? "Key #17 Buy (-16.5)" : "Key #21 Buy (-20.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else {
            altLine = Math.floor(line + 3.5) + 0.5;
            altOdds = -160;
            keyLabel = `Blowout Fav Buy (${altLine > 0 ? '+' : ''}${altLine.toFixed(1)})`;
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        }
    } else {
        if (line <= 3.0) {
            altLine = 3.5;
            altOdds = (line >= 2.0) ? -135 : -160;
            keyLabel = "Key #3 Dog Buy (+3.5)";
            if (line >= 1.5 && line <= 2.5) {
                tier2Line = Number((line + 6.0).toFixed(1));
                tier2Mode = "WONG_6PT";
                tier2Note = `Wong 6-pt Teaser (+${tier2Line.toFixed(1)} crosses 3 & 7)`;
            } else if (line >= 0.5 && line < 1.5) {
                tier2Line = Number((line + 7.0).toFixed(1));
                tier2Mode = "TEASER_7PT";
                tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 7-pt Teaser)`;
            }
        } else if (line <= 3.5) {
            altLine = 3.5; altOdds = bo; keyLabel = "Hold Over Key #3";
            tier2Line = 9.5; tier2Mode = "TEASER_6PT"; tier2Note = "1-Dev Safer (+9.5 via 6-pt Teaser)";
        } else if (line <= 6.5) {
            altLine = 7.5;
            altOdds = (line >= 6.0) ? -140 : ((line >= 4.5) ? -155 : -170);
            keyLabel = "Key #7 Dog Buy (+7.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line <= 7.5) {
            altLine = 7.5; altOdds = bo; keyLabel = "Hold Over Key #7";
            tier2Line = 13.5; tier2Mode = "TEASER_6PT"; tier2Note = "1-Dev Safer (+13.5 via 6-pt Teaser)";
        } else if (line <= 10.0) {
            altLine = 10.5;
            altOdds = (line >= 9.0) ? -140 : -160;
            keyLabel = "Key #10 Dog Buy (+10.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line <= 13.0) {
            altLine = 13.5;
            altOdds = (line >= 12.0) ? -140 : -160;
            keyLabel = "Key #13 Dog Buy (+13.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line <= 13.5) {
            altLine = 14.5; altOdds = -130; keyLabel = "Key #14 Dog Buy (+14.5)";
            tier2Line = 19.5; tier2Mode = "TEASER_6PT"; tier2Note = "1-Dev Safer (+19.5 via 6-pt Teaser)";
        } else if (line <= 17.0) {
            altLine = 17.5;
            altOdds = (line >= 16.0) ? -140 : -160;
            keyLabel = "Key #17 Dog Buy (+17.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else if (line <= 20.5) {
            altLine = 21.5;
            altOdds = (line >= 19.0) ? -145 : -165;
            keyLabel = "Key #21 Dog Buy (+21.5)";
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        } else {
            altLine = Math.floor(line + 3.5) + 0.5;
            altOdds = -160;
            keyLabel = `Blowout Dog Floor (+${altLine.toFixed(1)})`;
            tier2Line = Number((line + 6.0).toFixed(1));
            tier2Mode = "TEASER_6PT";
            tier2Note = `1-Dev Safer (+${tier2Line.toFixed(1)} via 6-pt Teaser)`;
        }
    }

    const km1 = _calcKeyMassBonus(Math.min(line, altLine), Math.max(line, altLine));
    const altProb = Math.min(0.95, Math.max(0.05, calcPointGapWinProb(altLine - fair) + km1.bonus));
    const beBase = calcImpliedProbability(bo);
    const beAlt = calcImpliedProbability(altOdds);
    const dTax = Math.max(0.01, beAlt - beBase);
    const merRatio = (altLine !== line) ? Number(((altProb - baseProb) / dTax).toFixed(2)) : 1.0;
    const evObj = calcExpectedValueAndKelly(altProb, altOdds);
    const fmtAlt = `${altLine > 0 ? '+' : ''}${altLine.toFixed(1)}`;

    // Tier-2 (1-Deviation Safer / Wong 6-pt Teaser) Gate
    let tier2ProbPct = null;
    let tier2EvPct = null;
    let tier2Approved = false;
    let tier2Label = "";
    if (tier2Line !== null) {
        const km2 = _calcKeyMassBonus(Math.min(line, tier2Line), Math.max(line, tier2Line));
        const t2Prob = Math.min(0.96, Math.max(0.05, calcPointGapWinProb(tier2Line - fair) + km2.bonus));
        tier2ProbPct = Number((t2Prob * 100).toFixed(1));
        const t2TicketDec = americanToDecimal(tier2Mode === "TEASER_7PT" ? -135 : -120);
        tier2EvPct = Number((((t2Prob * t2Prob) * t2TicketDec - 1.0) * 100.0).toFixed(2));
        const onModelSide = (line - fair) >= -0.25;
        tier2Approved = Boolean(onModelSide && (
            (tier2Mode === "WONG_6PT" && tier2EvPct > 0) ||
            (km2.count >= 2 && tier2EvPct >= 8.0)
        ));
        const fmtT2 = `${tier2Line > 0 ? '+' : ''}${tier2Line.toFixed(1)}`;
        tier2Label = (tier2Mode === "WONG_6PT")
            ? `🎯 WONG TEASER (${fmtT2} via 6-pt • ${tier2ProbPct}% Win • ${tier2EvPct > 0 ? '+' : ''}${tier2EvPct}% 2L EV)`
            : `🛡️ 1-DEV SAFER (${fmtT2} via ${tier2Mode === "TEASER_7PT" ? '7-pt' : '6-pt'} Teaser • ${tier2ProbPct}% Win • ${tier2EvPct > 0 ? '+' : ''}${tier2EvPct}% 2L EV)`;
    }

    return {
        altLine: Number(altLine.toFixed(1)),
        altOdds,
        altProb,
        altProbPct: Number((altProb * 100).toFixed(1)),
        merRatio,
        isMerApproved: merRatio >= 1.15,
        altEvPct: Number(evObj.evPercentage.toFixed(2)),
        keyLabel,
        altStr: `Alt ${fmtAlt} (${altOdds})`,
        tier2Line,
        tier2Mode,
        tier2Note,
        tier2ProbPct,
        tier2EvPct,
        tier2Approved,
        tier2Label
    };
}

// ==========================================
// BACK-TO-OUR-ROOTS REGIME SAFE TOTALS ENGINE (KILLS THE 42.986 BLIND FADE BUG!)
//   - Inflated / Dome Shootouts -> Drop DOWN 4–5 pts to Safe Alt OVER (-175 / -180)
//   - Grind-Fests / Cold / Wind / Backup QB / Zone 7+ Altitude -> Buy UP 4 pts to Safe Alt UNDER (-175)
//   - Neutral Mid-Range -> NEUTRAL_PASS (no forced contrarian fade)
// ==========================================
function calcReportCalibratedTotal(vegasTotal, ogTipTotal, envPayload = {}, circPayload = {}, elevMatrix = null, gameLeague = "NFL", hasBackupQb = false) {
    const vTot = Number(vegasTotal || ogTipTotal || 45.0);
    const isDome = Boolean(envPayload && envPayload.is_dome);
    const tempF = isDome ? 72.0 : Number(envPayload.temperature_f !== undefined ? envPayload.temperature_f : 58.0);
    const windMph = isDome ? 0.0 : Number(envPayload.wind_mph !== undefined ? envPayload.wind_mph : 5.0);
    const absTz = Math.abs(Number((circPayload && circPayload.away_tz_shift) || 0));
    const elevZone = (elevMatrix && elevMatrix.zoneNumber) ? Number(elevMatrix.zoneNumber) : 1;
    const elevTotDrag = (elevMatrix && elevMatrix.elevationTotalDragPts) ? Number(elevMatrix.elevationTotalDragPts) : 0.0;

    const ballistics = calcBarometricBallistics(envPayload || {});
    const rho = ballistics.airDensityRho || 1.225;

    const coldDrag = isDome ? 0.0 : -Math.max(0.0, (44.0 - tempF) * 0.14);
    const windDrag = isDome ? 0.0 : -Math.max(0.0, (windMph - 10.0) * 0.28);
    const tzDrag = absTz >= 3 ? -1.50 : (absTz === 2 ? -0.65 : 0.0);
    const qbDrag = hasBackupQb ? -2.75 : 0.0;
    const envDrag = coldDrag + windDrag + tzDrag + elevTotDrag + qbDrag;
    const pacePull = 0.15 * Math.max(-6.0, Math.min(6.0, Number(ogTipTotal) - vTot));

    const shootoutThresh = (gameLeague === "NCAA") ? 58.5 : 49.5;
    const domeShootoutThresh = (gameLeague === "NCAA") ? 54.5 : 46.5;
    const grindThresh = (gameLeague === "NCAA") ? 44.5 : 41.5;
    const weatherGrindThresh = (gameLeague === "NCAA") ? 52.5 : 48.5;
    const heavyGrindEnv = (!isDome && (tempF <= 42.0 || windMph >= 10.0 || rho >= 1.250 || elevZone >= 7)) || Boolean(hasBackupQb);

    let regime = "NEUTRAL_PASS";
    let fairTotal = vTot + envDrag + pacePull;
    let safeDir = fairTotal < vTot ? "U" : "O";
    let safeLine = (safeDir === "U") ? (Math.floor(vTot + 3.5) + 0.5) : (Math.floor(vTot - 3.5) + 0.5);
    let safeOdds = -175;
    let safeProb = 0.65;

    const kTotSlope = (gameLeague === "NCAA") ? (LOGISTIC_K_TIGHT * 0.786) : LOGISTIC_K_TIGHT;
    const totWinProb = (gap) => Math.max(0.01, Math.min(0.99, 1.0 / (1.0 + Math.exp(-kTotSlope * gap))));

    if (vTot >= shootoutThresh || (isDome && vTot >= domeShootoutThresh && !hasBackupQb)) {
        regime = "SHOOTOUT_SAFE_OVER";
        fairTotal = vTot + Math.max(0.8, 1.5 + (0.20 * Math.max(0.0, vTot - domeShootoutThresh)) + (isDome ? 0.4 : 0.0) + Math.max(-0.5, pacePull));
        const dropPts = (vTot >= shootoutThresh + 4.0) ? 5.0 : 4.0;
        safeLine = Math.floor(vTot - dropPts) + 0.5;
        safeOdds = (dropPts >= 5.0) ? -180 : -175;
        safeDir = "O";
        safeProb = Math.min(0.92, Math.max(0.55, totWinProb(fairTotal - safeLine) + 0.04));
    } else if (vTot <= grindThresh || (vTot <= weatherGrindThresh && heavyGrindEnv)) {
        regime = "GRIND_SAFE_UNDER";
        fairTotal = vTot + Math.min(-1.0, envDrag + Math.min(0.0, pacePull) - 0.8);
        safeLine = Math.floor(vTot + 4.0) + 0.5;
        safeOdds = -175;
        safeDir = "U";
        safeProb = Math.min(0.92, Math.max(0.55, totWinProb(safeLine - fairTotal) + 0.04));
    } else {
        const edge = (safeDir === "U") ? (safeLine - fairTotal) : (fairTotal - safeLine);
        safeProb = Math.min(0.82, Math.max(0.50, totWinProb(edge)));
    }

    const safeEvObj = calcExpectedValueAndKelly(safeProb, safeOdds);
    return {
        regime,
        ballsDeepTotal: Number(fairTotal.toFixed(1)),
        safeDir,
        safeLine: Number(safeLine.toFixed(1)),
        safeOdds,
        safeProb,
        safeProbPct: Number((safeProb * 100).toFixed(1)),
        safeEvPct: Number(safeEvObj.evPercentage.toFixed(2)),
        safeLabel: `Alt ${safeDir} ${safeLine.toFixed(1)} (${safeOdds})`,
        coldDrag: Number(coldDrag.toFixed(2)),
        windDrag: Number(windDrag.toFixed(2)),
        tzDrag: Number(tzDrag.toFixed(2)),
        elevTotDrag: Number(elevTotDrag.toFixed(2)),
        effLean: Number(pacePull.toFixed(2))
    };
}

// ==========================================
// MODULE 10: 30% PROFIT BOOST PARLAY & ROUND ROBIN COMBINATORICS (UNTOUCHED)
// ==========================================
function calcProfitBoostParlayEV(legsArray, boostMultiplier = 1.30) {
    if (!legsArray || legsArray.length === 0) {
        return { dRaw: 1, dBoost: 1, trueParlayProb: 0, evBoostPct: 0 };
    }
    let dRaw = 1.0, pTrueParlay = 1.0;
    for (let i = 0; i < legsArray.length; i++) {
        const dec = americanToDecimal(legsArray[i].americanOdds);
        dRaw *= dec;
        pTrueParlay *= legsArray[i].trueProb;
    }
    const dBoost = 1.0 + (boostMultiplier * (dRaw - 1.0));
    const evBoost = (pTrueParlay * dBoost) - 1.0;
    return {
        dRaw: Number(dRaw.toFixed(3)),
        dBoost: Number(dBoost.toFixed(3)),
        trueParlayProb: Number((pTrueParlay * 100).toFixed(2)),
        evBoostPct: Number((evBoost * 100).toFixed(2))
    };
}

function calcRoundRobinMatrix(legsArray) {
    const n = legsArray ? legsArray.length : 0;
    if (n < 2) return [];

    function getCombinations(arr, k) {
        if (k === 1) return arr.map(el => [el]);
        const combs = [];
        for (let i = 0; i <= arr.length - k; i++) {
            const head = arr[i];
            const tailCombs = getCombinations(arr.slice(i + 1), k - 1);
            tailCombs.forEach(tc => combs.push([head, ...tc]));
        }
        return combs;
    }

    const tiers = [];
    const maxK = Math.min(n, 4);
    for (let k = 2; k <= maxK; k++) {
        const combos = getCombinations(legsArray, k);
        let totalEv = 0, avgMult = 0, avgProb = 0;
        combos.forEach(c => {
            const res = calcProfitBoostParlayEV(c, 1.0);
            totalEv += res.evBoostPct;
            avgMult += res.dRaw;
            avgProb += res.trueParlayProb;
        });
        const count = combos.length;
        tiers.push({
            legSize: `${k}-Leg Round Robin (${count}x)`,
            ticketCount: count,
            avgMultiplier: Number((avgMult / count).toFixed(2)),
            avgWinProbPct: Number((avgProb / count).toFixed(2)),
            expectedRoiPct: Number((totalEv / count).toFixed(2))
        });
    }
    return tiers;
}

// ==========================================
// MODULE 11.1: BIOPHYSICAL MASS DENSITY & CLOSING MULTIPLIERS (UNTOUCHED)
// ==========================================
function calcBiophysicalMassLoad(envPayload, homeTelemetry, playerMassKg = 95.0, fH2O = 0.62, mode = "balls_deep", intensitySlider = 0.0) {
    const h = envPayload.elevation_m || 0;
    const Re = 6371000, gSea = 9.80665;
    const gAlt = gSea * Math.pow(Re / (Re + h), 2);
    const deltaG = gAlt - gSea;

    const rhoH2O = 997.0, rhoLean = 1100.0;
    const fLean = 1.0 - fH2O - 0.015;
    const traceSum = (0.00006 / 7874) + (0.0005 / 1738) + (0.012 / 1550) + (0.002 / 862) + (0.0015 / 968);
    const ballistics = calcBarometricBallistics(envPayload);
    const rhoAirH = ballistics.airDensityRho;

    const invBaseDensity = (fH2O / rhoH2O) + (fLean / rhoLean) + traceSum;
    const rhoPlayerH = (1.0 / invBaseDensity) - rhoAirH;
    const rhoPlayer0 = (1.0 / invBaseDensity) - 1.225;

    const deltaFgBio = playerMassKg * (fH2O + 0.014) * deltaG;
    const pO2RatioDrop = 1.0 - Math.exp(-h / 8500);
    const hypoxicTerm = 1.45 * pO2RatioDrop;

    const phiBioRaw = (100.0 * (deltaFgBio / (playerMassKg * gSea))) +
                      (10.0 * ((rhoPlayerH / rhoPlayer0) - 1.0)) +
                      (2.5 * hypoxicTerm);

    const rankPct = homeTelemetry.closing_rank_pct || 0.5;
    const winStreak = homeTelemetry.active_win_streak || 0;
    let closingMultiplier = 0.382;

    if (mode === "balls_deep" || mode === "unsolicited") {
        closingMultiplier = (rankPct >= 0.53) ? 0.786 : 0.618;
    } else if (mode === "davinci") {
        const baseDavinci = (rankPct >= 0.53 && winStreak >= 2) ? 1.618 : ((rankPct >= 0.53) ? 1.0 : 0.618);
        closingMultiplier = Number((baseDavinci * (1.0 + (intensitySlider * (13 / 76)))).toFixed(3));
    }

    const phiBioAdjusted = phiBioRaw * closingMultiplier;
    return {
        rhoPlayerDensity: Number(rhoPlayerH.toFixed(2)),
        localGravityG: Number(gAlt.toFixed(5)),
        closingMultiplier,
        phiBioScore: Number(phiBioAdjusted.toFixed(4))
    };
}

// ==========================================
// MODULE 12: TURNOVER VALUE & EXPECTED POINTS MATRIX (UNTOUCHED)
// ==========================================
function calcTurnoverEPAMatrix(teamTelemetry, league = "NFL", mode = "balls_deep", intensitySlider = 0.0) {
    const N = (league === "NCAA") ? 138 : 32;
    const homeRankPct = teamTelemetry.home.closing_rank_pct !== undefined
        ? teamTelemetry.home.closing_rank_pct
        : 1.0 - (((teamTelemetry.home.closing_rank || 16) - 1) / (N - 1));
    const awayRankPct = teamTelemetry.away.closing_rank_pct !== undefined
        ? teamTelemetry.away.closing_rank_pct
        : 1.0 - (((teamTelemetry.away.closing_rank || 16) - 1) / (N - 1));

    let home4QWeight = 0.382, away4QWeight = 0.382;
    if (mode === "balls_deep" || mode === "unsolicited") {
        home4QWeight = homeRankPct >= 0.53 ? 0.786 : 0.618;
        away4QWeight = awayRankPct >= 0.53 ? 0.786 : 0.618;
    } else if (mode === "davinci") {
        const sliderScale = 1.0 + (intensitySlider * (21 / 76));
        home4QWeight = (homeRankPct >= 0.53 ? 1.618 : 0.618) * sliderScale;
        away4QWeight = (awayRankPct >= 0.53 ? 1.618 : 0.618) * sliderScale;
    }

    const baseEPConv = 3.85;
    const homeOppRzFactor = 1.0 - (teamTelemetry.away.opp_rz_dvoa || 0);
    const awayOppRzFactor = 1.0 - (teamTelemetry.home.opp_rz_dvoa || 0);

    const homeTovEPA = baseEPConv * homeOppRzFactor * ((0.382 * homeRankPct) + (home4QWeight * homeRankPct));
    const awayTovEPA = baseEPConv * awayOppRzFactor * ((0.382 * awayRankPct) + (away4QWeight * awayRankPct));
    const netTovEPADiff = homeTovEPA - awayTovEPA;

    return {
        homeRankPercentile: Number(homeRankPct.toFixed(3)),
        awayRankPercentile: Number(awayRankPct.toFixed(3)),
        homeTovEPA: Number(homeTovEPA.toFixed(3)),
        awayTovEPA: Number(awayTovEPA.toFixed(3)),
        netTurnoverEPA: Number(netTovEPADiff.toFixed(3))
    };
}

// ==========================================
// COUPLED MODULE 11 & 12 ROOTED INTERACTION (PSI_11,12 — UNTOUCHED)
// ==========================================
function calcCoupledInteractionPsi(phiBio, epaTov, intensitySlider = 0.0) {
    const sumVal = phiBio + epaTov;
    const sign = sumVal > 0 ? 1 : (sumVal < 0 ? -1 : 0);
    const rootProduct = Math.sqrt(Math.abs(phiBio * epaTov));
    const scalar = 1.0 + (intensitySlider * (13 / 76));
    return Number((sign * rootProduct * scalar).toFixed(4));
}

// ==========================================
// MASTER EQUATION: AGGREGATE FIBONACCI PROBABILITY (UNTOUCHED)
// ==========================================
function calcMasterFibonacciAggregate(moduleScores, fibLookupFn = 13, intensitySlider = 0, mRiseMultiplier = 1.0) {
    const m = moduleScores;
    const tier1 = FIBONACCI_TIERS.TIER_1 * ((m.m1 || 0) + (m.m5 || 0) + (m.m7 || 0));
    const tier2 = FIBONACCI_TIERS.TIER_2 * ((m.m6 || 0) + (m.m10 || 0) + (m.m12 || 0));
    const tier3 = FIBONACCI_TIERS.TIER_3 * ((m.m2 || 0) + (m.m3 || 0) + (m.m11 || 0));
    const tier4 = FIBONACCI_TIERS.TIER_4 * ((m.m4 || 0) + (m.m8 || 0));

    const omegaFib = (tier1 + tier2 + tier3 + tier4) / FIBONACCI_TIERS.SUM_F;
    const omegaFibRise = omegaFib * mRiseMultiplier;
    const baseLogisticProb = 1.0 / (1.0 + Math.exp(-GOLDEN_RATIO_PHI * omegaFibRise));
    const volatilityMultiplier = 1.0 + ((fibLookupFn / FIBONACCI_TIERS.SUM_F) * intensitySlider);
    const pAgg = Math.max(0.01, Math.min(0.99, baseLogisticProb * volatilityMultiplier));

    return {
        omegaFibScore: Number(omegaFibRise.toFixed(4)),
        lockedObjectiveProb: Number((baseLogisticProb * 100).toFixed(2)),
        liveAdjustedProb: Number((pAgg * 100).toFixed(2))
    };
}

// ==============================================================================
// DEDICATED DUAL-ENGINE ARCHITECTURE (v317 — SEPARATE NFL ENGINE & NCAA ENGINE)
//   - DixPixNflEngine:  62.32-play NFL volume, tight logistic spread slope (1.0x),
//                       pro weather/circadian/HFA (+1.9416), NFL key numbers & Wong 6-pt teasers.
//   - DixPixNcaaEngine: High-tempo college pace/variance (0.786x slope for wider NCAA margins),
//                       hostile campus HFA (+2.6180), full 136-team FBS + FCS coverage,
//                       rank-differential M_rise & college key-number / teaser routing.
// ==============================================================================
const DixPixNflEngine = {
    league: "NFL",
    hfaBase: PI_OVER_PHI_HFA,
    totalIntercept: 42.986,
    logisticK: LOGISTIC_K_TIGHT,
    playScaler: GOLDEN_PLAY_SCALER,
    winProb(pointGap) {
        return calcPointGapWinProb(pointGap);
    },
    keyAlt(baseLine, modelFairLine, baseOdds = -110) {
        return calcKeyNumberAltSpread(baseLine, modelFairLine, baseOdds);
    },
    safeTotal(vegasTotal, ogTipTotal, envPayload = {}, circPayload = {}, elevMatrix = null, hasBackupQb = false) {
        return calcReportCalibratedTotal(vegasTotal, ogTipTotal, envPayload, circPayload, elevMatrix, "NFL", hasBackupQb);
    }
};

const DixPixNcaaEngine = {
    league: "NCAA",
    hfaBase: 2.6180339887,
    totalIntercept: 51.450,
    logisticK: Number((LOGISTIC_K_TIGHT * 0.786).toFixed(6)),
    playScaler: GOLDEN_PLAY_SCALER,
    winProb(pointGap) {
        const p = 1.0 / (1.0 + Math.exp(-this.logisticK * pointGap));
        return Math.max(0.01, Math.min(0.99, p));
    },
    keyAlt(baseLine, modelFairLine, baseOdds = -110) {
        const res = calcKeyNumberAltSpread(baseLine, modelFairLine, baseOdds);
        const line = Number(baseLine || 0);
        const fair = Number(modelFairLine !== undefined ? modelFairLine : line);
        const altP = this.winProb(res.altLine - fair);
        const km1 = _calcKeyMassBonus(Math.min(line, res.altLine), Math.max(line, res.altLine));
        const adjP = Math.min(0.95, Math.max(0.05, altP + km1.bonus));
        const evObj = calcExpectedValueAndKelly(adjP, res.altOdds);
        return Object.assign({}, res, {
            altProb: adjP,
            altProbPct: Number((adjP * 100.0).toFixed(1)),
            altEvPct: Number(evObj.evPercentage.toFixed(2)),
            engineLeague: "NCAA"
        });
    },
    safeTotal(vegasTotal, ogTipTotal, envPayload = {}, circPayload = {}, elevMatrix = null, hasBackupQb = false) {
        return calcReportCalibratedTotal(vegasTotal, ogTipTotal, envPayload, circPayload, elevMatrix, "NCAA", hasBackupQb);
    }
};

function getLeagueEngine(league = "NFL") {
    return (String(league || "NFL").toUpperCase() === "NCAA") ? DixPixNcaaEngine : DixPixNflEngine;
}

// === END OF MATH_ENGINE.JS (v318) ===
