const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;
const API_URL = 'https://sun-dd.onrender.com/sun';

let history = [];
let seenSessions = new Set();
let logicPerformance = {
    logic1: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic2: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic3: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic4: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic5: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic6: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic7: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic8: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic9: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic10: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic11: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic12: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic13: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic14: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic15: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic16: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic17: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic18: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic19: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic21: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic22: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic23: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic24: { correct: 0, total: 0, accuracy: 0, consistency: 0 }
};

// ==================== TOÀN BỘ THUẬT TOÁN PHÂN TÍCH ====================

function calculateStdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function getDiceFrequencies(history, limit) {
    const allDice = [];
    const effectiveHistory = history.slice(0, limit);
    effectiveHistory.forEach(s => { allDice.push(s.d1, s.d2, s.d3); });
    const diceFreq = new Array(7).fill(0);
    allDice.forEach(d => { if (d >= 1 && d <= 6) diceFreq[d]++; });
    return diceFreq;
}

function detectStreakAndBreak(history) {
    if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) streak++;
        else break;
    }
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return { streak, currentResult, breakProb: 0.0 };
    const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
    const taiCount = last15.filter(r => r === 'Tài').length;
    const xiuCount = last15.filter(r => r === 'Xỉu').length;
    const imbalance = Math.abs(taiCount - xiuCount) / last15.length;
    let breakProb = 0.0;
    if (streak >= 8) breakProb = Math.min(0.6 + (switches / 15) + imbalance * 0.15, 0.9);
    else if (streak >= 5) breakProb = Math.min(0.35 + (switches / 10) + imbalance * 0.25, 0.85);
    else if (streak >= 3 && switches >= 7) breakProb = 0.3;
    return { streak, currentResult, breakProb };
}

// Logic 1: Tổng chỉ số phiên
function predictLogic1(lastSession, history) {
    if (!lastSession || history.length < 10) return null;
    const lastDigitOfSession = lastSession.sid % 10;
    const totalPreviousSession = lastSession.totalScore;
    let indicatorSum = lastDigitOfSession + totalPreviousSession;
    const currentPrediction = indicatorSum % 2 === 0 ? "Xỉu" : "Tài";
    let correctCount = 0, totalCount = 0;
    const consistencyWindow = Math.min(history.length - 1, 25);
    for (let i = 0; i < consistencyWindow; i++) {
        const session = history[i];
        const prevSession = history[i + 1];
        if (prevSession) {
            const prevIndicatorSum = (prevSession.sid % 10) + prevSession.totalScore;
            const prevPredicted = prevIndicatorSum % 2 === 0 ? "Xỉu" : "Tài";
            if (prevPredicted === session.result) correctCount++;
            totalCount++;
        }
    }
    if (totalCount > 5 && (correctCount / totalCount) >= 0.65) return currentPrediction;
    return null;
}

// Logic 2: Phân tích thuận nghịch
function predictLogic2(nextSessionId, history) {
    if (history.length < 15) return null;
    let thuanScore = 0, nghichScore = 0;
    const analysisWindow = Math.min(history.length, 60);
    for (let i = 0; i < analysisWindow; i++) {
        const session = history[i];
        const isEvenSID = session.sid % 2 === 0;
        const weight = 1.0 - (i / analysisWindow) * 0.6;
        if ((isEvenSID && session.result === "Xỉu") || (!isEvenSID && session.result === "Tài")) thuanScore += weight;
        if ((isEvenSID && session.result === "Tài") || (!isEvenSID && session.result === "Xỉu")) nghichScore += weight;
    }
    const currentSessionIsEven = nextSessionId % 2 === 0;
    const totalScore = thuanScore + nghichScore;
    if (totalScore < 10) return null;
    const thuanRatio = thuanScore / totalScore;
    const nghichRatio = nghichScore / totalScore;
    if (thuanRatio > nghichRatio + 0.15) return currentSessionIsEven ? "Xỉu" : "Tài";
    if (nghichRatio > thuanRatio + 0.15) return currentSessionIsEven ? "Tài" : "Xỉu";
    return null;
}

// Logic 3: Phân tích độ lệch chuẩn
function predictLogic3(history) {
    if (history.length < 15) return null;
    const analysisWindow = Math.min(history.length, 50);
    const lastXTotals = history.slice(0, analysisWindow).map(s => s.totalScore);
    const average = lastXTotals.reduce((a, b) => a + b, 0) / analysisWindow;
    const stdDev = calculateStdDev(lastXTotals);
    const deviationFactor = 0.8;
    const recentTrendLength = Math.min(5, history.length);
    const recentTrend = history.slice(0, recentTrendLength).map(s => s.totalScore);
    let isRising = false, isFalling = false;
    if (recentTrendLength >= 3) {
        isRising = true; isFalling = true;
        for (let i = 0; i < recentTrendLength - 1; i++) {
            if (recentTrend[i] <= recentTrend[i + 1]) isRising = false;
            if (recentTrend[i] >= recentTrend[i + 1]) isFalling = false;
        }
    }
    if (average < 10.5 - (deviationFactor * stdDev) && isFalling) return "Xỉu";
    if (average > 10.5 + (deviationFactor * stdDev) && isRising) return "Tài";
    return null;
}

// Logic 4: Pattern matching
function predictLogic4(history) {
    if (history.length < 30) return null;
    let bestPrediction = null, maxConfidence = 0;
    const volatility = calculateStdDev(history.slice(0, Math.min(30, history.length)).map(s => s.totalScore));
    const patternLengths = (volatility < 1.7) ? [6, 5, 4] : [5, 4, 3];
    for (const len of patternLengths) {
        if (history.length < len + 2) continue;
        const recentPattern = history.slice(0, len).map(s => s.result).reverse().join('');
        let taiFollows = 0, xiuFollows = 0, totalMatches = 0;
        for (let i = len; i < Math.min(history.length - 1, 200); i++) {
            const patternToMatch = history.slice(i, i + len).map(s => s.result).reverse().join('');
            if (patternToMatch === recentPattern) {
                totalMatches++;
                if (history[i - 1].result === 'Tài') taiFollows++; else xiuFollows++;
            }
        }
        if (totalMatches < 3) continue;
        const taiConfidence = taiFollows / totalMatches;
        const xiuConfidence = xiuFollows / totalMatches;
        if (taiConfidence >= 0.70 && taiConfidence > maxConfidence) { maxConfidence = taiConfidence; bestPrediction = "Tài"; }
        else if (xiuConfidence >= 0.70 && xiuConfidence > maxConfidence) { maxConfidence = xiuConfidence; bestPrediction = "Xỉu"; }
    }
    return bestPrediction;
}

// Logic 5: Phân tích tần suất tổng điểm
function predictLogic5(history) {
    if (history.length < 40) return null;
    const sumCounts = {};
    const analysisWindow = Math.min(history.length, 400);
    for (let i = 0; i < analysisWindow; i++) {
        const total = history[i].totalScore;
        const weight = 1.0 - (i / analysisWindow) * 0.8;
        sumCounts[total] = (sumCounts[total] || 0) + weight;
    }
    let mostFrequentSum = -1, maxWeightedCount = 0;
    for (const sum in sumCounts) {
        if (sumCounts[sum] > maxWeightedCount) { maxWeightedCount = sumCounts[sum]; mostFrequentSum = parseInt(sum); }
    }
    if (mostFrequentSum !== -1) {
        const totalWeightedSum = Object.values(sumCounts).reduce((a, b) => a + b, 0);
        if (totalWeightedSum > 0 && (maxWeightedCount / totalWeightedSum) > 0.08) {
            if (mostFrequentSum <= 10) return "Xỉu";
            if (mostFrequentSum >= 11) return "Tài";
        }
    }
    return null;
}

// Logic 6: Phân tích feature set
function predictLogic6(lastSession, history) {
    if (!lastSession || history.length < 40) return null;
    const nextSessionLastDigit = (lastSession.sid + 1) % 10;
    const lastSessionTotalParity = lastSession.totalScore % 2;
    let taiVotes = 0, xiuVotes = 0;
    const analysisWindow = Math.min(history.length, 250);
    if (analysisWindow < 2) return null;
    for (let i = 0; i < analysisWindow - 1; i++) {
        const currentHistSessionResult = history[i].result;
        const prevHistSession = history[i + 1];
        const featureSetCurrent = `${nextSessionLastDigit % 2}-${lastSessionTotalParity}-${(lastSession.totalScore > 10.5 ? 'T' : 'X')}`;
        const featureSetHistory = `${prevHistSession.sid % 10 % 2}-${prevHistSession.totalScore % 2}-${(prevHistSession.totalScore > 10.5 ? 'T' : 'X')}`;
        if (featureSetHistory === featureSetCurrent) {
            if (currentHistSessionResult === "Tài") taiVotes++; else xiuVotes++;
        }
    }
    const totalVotes = taiVotes + xiuVotes;
    if (totalVotes < 5) return null;
    if (Math.abs(taiVotes - xiuVotes) / totalVotes > 0.25) return taiVotes > xiuVotes ? "Tài" : "Xỉu";
    return null;
}

// Logic 7: Phát hiện chuỗi dài
function predictLogic7(history) {
    const TREND_STREAK_MIN = 4, TREND_STREAK_MAX = 7;
    if (history.length < TREND_STREAK_MIN) return null;
    const volatility = calculateStdDev(history.slice(0, Math.min(25, history.length)).map(s => s.totalScore));
    const effectiveStreakLength = (volatility < 1.6) ? TREND_STREAK_MAX : TREND_STREAK_MIN + 1;
    const recentResults = history.slice(0, effectiveStreakLength).map(s => s.result);
    if (recentResults.length < effectiveStreakLength) return null;
    if (recentResults.every(r => r === "Tài")) return "Tài";
    if (recentResults.every(r => r === "Xỉu")) return "Xỉu";
    return null;
}

// Logic 8: Phân tích độ lệch dài hạn
function predictLogic8(history) {
    const LONG_PERIOD = 30;
    if (history.length < LONG_PERIOD + 1) return null;
    const longTermTotals = history.slice(1, LONG_PERIOD + 1).map(s => s.totalScore);
    const longTermAverage = longTermTotals.reduce((a, b) => a + b, 0) / longTermTotals.length;
    const longTermStdDev = calculateStdDev(longTermTotals);
    const lastSessionTotal = history[0].totalScore;
    const dynamicDeviationThreshold = Math.max(1.5, 0.8 * longTermStdDev);
    if (lastSessionTotal > longTermAverage + dynamicDeviationThreshold) return "Xỉu";
    if (lastSessionTotal < longTermAverage - dynamicDeviationThreshold) return "Tài";
    return null;
}

// Logic 9: Phân tích đảo chiều chuỗi
function predictLogic9(history) {
    if (history.length < 20) return null;
    let maxTaiStreak = 0, maxXiuStreak = 0;
    let currentTaiStreak = 0, currentXiuStreak = 0;
    const historyForMaxStreak = history.slice(0, Math.min(history.length, 120));
    for (const session of historyForMaxStreak) {
        if (session.result === "Tài") { currentTaiStreak++; currentXiuStreak = 0; }
        else { currentXiuStreak++; currentTaiStreak = 0; }
        maxTaiStreak = Math.max(maxTaiStreak, currentTaiStreak);
        maxXiuStreak = Math.max(maxXiuStreak, currentXiuStreak);
    }
    const dynamicThreshold = Math.max(4, Math.floor(Math.max(maxTaiStreak, maxXiuStreak) * 0.5));
    const mostRecentResult = history[0].result;
    let currentConsecutiveCount = 0;
    for (let i = 0; i < history.length; i++) {
        if (history[i].result === mostRecentResult) currentConsecutiveCount++;
        else break;
    }
    if (currentConsecutiveCount >= dynamicThreshold && currentConsecutiveCount >= 3) {
        let totalReversals = 0, totalContinuations = 0;
        for (let i = currentConsecutiveCount; i < history.length - currentConsecutiveCount; i++) {
            const potentialStreak = history.slice(i, i + currentConsecutiveCount);
            if (potentialStreak.every(s => s.result === mostRecentResult)) {
                if (history[i - 1] && history[i - 1].result !== mostRecentResult) totalReversals++;
                else if (history[i - 1] && history[i - 1].result === mostRecentResult) totalContinuations++;
            }
        }
        if (totalReversals + totalContinuations > 3 && totalReversals > totalContinuations * 1.3) {
            return mostRecentResult === "Tài" ? "Xỉu" : "Tài";
        }
    }
    return null;
}

// Logic 10: Momentum & Stability
function predictLogic10(history) {
    const MOMENTUM_LENGTH = 3, STABILITY_LENGTH = 7;
    if (history.length < STABILITY_LENGTH + 1) return null;
    const recentResults = history.slice(0, MOMENTUM_LENGTH).map(s => s.result);
    const widerHistory = history.slice(0, STABILITY_LENGTH).map(s => s.result);
    if (recentResults.every(r => r === "Tài") && widerHistory.filter(r => r === "Tài").length / STABILITY_LENGTH >= 0.75) return "Tài";
    if (recentResults.every(r => r === "Xỉu") && widerHistory.filter(r => r === "Xỉu").length / STABILITY_LENGTH >= 0.75) return "Xỉu";
    return null;
}

// Logic 11: Pattern đảo chiều nâng cao
function predictLogic11(history) {
    if (history.length < 15) return null;
    const reversalPatterns = [
        { pattern: "TàiXỉuTài", predict: "Xỉu", minOcc: 3, weight: 1.5 },
        { pattern: "XỉuTàiXỉu", predict: "Tài", minOcc: 3, weight: 1.5 },
        { pattern: "TàiTàiXỉu", predict: "Tài", minOcc: 4, weight: 1.3 },
        { pattern: "XỉuXỉuTài", predict: "Xỉu", minOcc: 4, weight: 1.3 },
        { pattern: "TàiXỉuTàiXỉu", predict: "Tài", minOcc: 2, weight: 1.4 },
        { pattern: "XỉuTàiXỉuTài", predict: "Xỉu", minOcc: 2, weight: 1.4 },
    ];
    let bestMatch = null, maxWeightedConf = 0;
    for (const pat of reversalPatterns) {
        const patShort = pat.pattern.replace(/Tài/g, 'T').replace(/Xỉu/g, 'X');
        const patLen = patShort.length;
        if (history.length < patLen + 1) continue;
        const currentWindow = history.slice(0, patLen).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('');
        if (currentWindow === patShort) {
            let matchCount = 0, totalOcc = 0;
            for (let i = patLen; i < Math.min(history.length - 1, 350); i++) {
                const histPattern = history.slice(i, i + patLen).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('');
                if (histPattern === patShort) {
                    totalOcc++;
                    if (history[i - 1].result === pat.predict) matchCount++;
                }
            }
            if (totalOcc < pat.minOcc) continue;
            const acc = matchCount / totalOcc;
            if (acc >= 0.68) {
                const weightedConf = acc * pat.weight;
                if (weightedConf > maxWeightedConf) { maxWeightedConf = weightedConf; bestMatch = pat.predict; }
            }
        }
    }
    return bestMatch;
}

// Logic 12: Phân tích chuỗi + parity
function predictLogic12(lastSession, history) {
    if (!lastSession || history.length < 20) return null;
    const nextSessionParity = (lastSession.sid + 1) % 2;
    const mostRecentResult = history[0].result;
    let currentConsecutiveCount = 0;
    for (let i = 0; i < history.length; i++) {
        if (history[i].result === mostRecentResult) currentConsecutiveCount++;
        else break;
    }
    let taiVotes = 0, xiuVotes = 0;
    const analysisWindow = Math.min(history.length, 250);
    for (let i = 0; i < analysisWindow - 1; i++) {
        const prevHistSession = history[i + 1];
        let histConsecutiveCount = 0;
        for (let j = i + 1; j < analysisWindow; j++) {
            if (history[j].result === prevHistSession.result) histConsecutiveCount++;
            else break;
        }
        if (prevHistSession.sid % 2 === nextSessionParity && histConsecutiveCount === currentConsecutiveCount) {
            if (history[i].result === "Tài") taiVotes++; else xiuVotes++;
        }
    }
    const totalVotes = taiVotes + xiuVotes;
    if (totalVotes < 6) return null;
    if (taiVotes / totalVotes >= 0.68) return "Tài";
    if (xiuVotes / totalVotes >= 0.68) return "Xỉu";
    return null;
}

// Logic 13: Thống kê chuỗi
function predictLogic13(history) {
    if (history.length < 80) return null;
    const mostRecentResult = history[0].result;
    let currentStreakLength = 0;
    for (let i = 0; i < history.length; i++) {
        if (history[i].result === mostRecentResult) currentStreakLength++;
        else break;
    }
    if (currentStreakLength < 1) return null;
    const streakStats = {};
    const analysisWindow = Math.min(history.length, 500);
    for (let i = 0; i < analysisWindow - 1; i++) {
        const sessionResult = history[i].result;
        const prevSessionResult = history[i + 1].result;
        let tempStreakLength = 1;
        for (let j = i + 2; j < analysisWindow; j++) {
            if (history[j].result === prevSessionResult) tempStreakLength++;
            else break;
        }
        if (tempStreakLength > 0) {
            const streakKey = `${prevSessionResult}_${tempStreakLength}`;
            if (!streakStats[streakKey]) streakStats[streakKey] = { 'Tài': 0, 'Xỉu': 0 };
            streakStats[streakKey][sessionResult]++;
        }
    }
    const currentStreakKey = `${mostRecentResult}_${currentStreakLength}`;
    if (streakStats[currentStreakKey]) {
        const stats = streakStats[currentStreakKey];
        const totalFollowUps = stats['Tài'] + stats['Xỉu'];
        if (totalFollowUps < 5) return null;
        if (stats['Tài'] / totalFollowUps >= 0.65) return "Tài";
        if (stats['Xỉu'] / totalFollowUps >= 0.65) return "Xỉu";
    }
    return null;
}

// Logic 14: Phân tích ngắn hạn vs dài hạn
function predictLogic14(history) {
    if (history.length < 50) return null;
    const shortPeriod = 8, longPeriod = 30;
    if (history.length < longPeriod) return null;
    const shortTermTotals = history.slice(0, shortPeriod).map(s => s.totalScore);
    const longTermTotals = history.slice(0, longPeriod).map(s => s.totalScore);
    const shortAvg = shortTermTotals.reduce((a, b) => a + b, 0) / shortPeriod;
    const longAvg = longTermTotals.reduce((a, b) => a + b, 0) / longPeriod;
    const longStdDev = calculateStdDev(longTermTotals);
    if (shortAvg > longAvg + (longStdDev * 0.8)) return "Xỉu";
    if (shortAvg < longAvg - (longStdDev * 0.8)) return "Tài";
    return null;
}

// Logic 15: Phân tích tổng chẵn lẻ
function predictLogic15(history) {
    if (history.length < 80) return null;
    const analysisWindow = Math.min(history.length, 400);
    const evenCounts = { "Tài": 0, "Xỉu": 0 }, oddCounts = { "Tài": 0, "Xỉu": 0 };
    let totalEven = 0, totalOdd = 0;
    for (let i = 0; i < analysisWindow; i++) {
        const session = history[i];
        if (session.totalScore % 2 === 0) { evenCounts[session.result]++; totalEven++; }
        else { oddCounts[session.result]++; totalOdd++; }
    }
    if (totalEven < 20 || totalOdd < 20) return null;
    const isLastTotalEven = history[0].totalScore % 2 === 0;
    if (isLastTotalEven) {
        if (evenCounts["Tài"] / totalEven >= 0.65) return "Tài";
        if (evenCounts["Xỉu"] / totalEven >= 0.65) return "Xỉu";
    } else {
        if (oddCounts["Tài"] / totalOdd >= 0.65) return "Tài";
        if (oddCounts["Xỉu"] / totalOdd >= 0.65) return "Xỉu";
    }
    return null;
}

// Logic 16: Phân tích modulo
function predictLogic16(history) {
    if (history.length < 60) return null;
    const MODULO_N = 5;
    const analysisWindow = Math.min(history.length, 500);
    const moduloPatterns = {};
    for (let i = 0; i < analysisWindow - 1; i++) {
        const prevSession = history[i + 1];
        const moduloValue = prevSession.totalScore % MODULO_N;
        if (!moduloPatterns[moduloValue]) moduloPatterns[moduloValue] = { 'Tài': 0, 'Xỉu': 0 };
        moduloPatterns[moduloValue][history[i].result]++;
    }
    const currentModuloValue = history[0].totalScore % MODULO_N;
    if (moduloPatterns[currentModuloValue]) {
        const stats = moduloPatterns[currentModuloValue];
        const totalCount = stats['Tài'] + stats['Xỉu'];
        if (totalCount < 7) return null;
        if (stats['Tài'] / totalCount >= 0.65) return "Tài";
        if (stats['Xỉu'] / totalCount >= 0.65) return "Xỉu";
    }
    return null;
}

// Logic 17: Z-Score phân tích
function predictLogic17(history) {
    if (history.length < 100) return null;
    const analysisWindow = Math.min(history.length, 600);
    const totals = history.slice(0, analysisWindow).map(s => s.totalScore);
    const meanTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDevTotal = calculateStdDev(totals);
    const lastSessionTotal = history[0].totalScore;
    const zScore = stdDevTotal > 0 ? Math.abs(lastSessionTotal - meanTotal) / stdDevTotal : 0;
    if (zScore >= 1.5) return lastSessionTotal > meanTotal ? "Xỉu" : "Tài";
    return null;
}

// Logic 18: Phân tích xúc xắc chẵn lẻ
function predictLogic18(history) {
    if (history.length < 50) return null;
    const analysisWindow = Math.min(history.length, 300);
    const patternStats = {};
    for (let i = 0; i < analysisWindow - 1; i++) {
        const prevSession = history[i + 1];
        const patternKey = `${prevSession.d1 % 2}-${prevSession.d2 % 2}-${prevSession.d3 % 2}`;
        if (!patternStats[patternKey]) patternStats[patternKey] = { 'Tài': 0, 'Xỉu': 0 };
        patternStats[patternKey][history[i].result]++;
    }
    const lastSession = history[0];
    const currentPatternKey = `${lastSession.d1 % 2}-${lastSession.d2 % 2}-${lastSession.d3 % 2}`;
    if (patternStats[currentPatternKey]) {
        const stats = patternStats[currentPatternKey];
        const totalCount = stats['Tài'] + stats['Xỉu'];
        if (totalCount < 8) return null;
        if (stats['Tài'] / totalCount >= 0.65) return "Tài";
        if (stats['Xỉu'] / totalCount >= 0.65) return "Xỉu";
    }
    return null;
}

// Logic 19: Phân tích thời gian thực
function predictLogic19(history) {
    if (history.length < 50) return null;
    let taiScore = 0, xiuScore = 0;
    const now = Date.now();
    const analysisWindowMs = 2 * 60 * 60 * 1000;
    for (const session of history) {
        if (now - session.timestamp > analysisWindowMs) break;
        const ageFactor = 1 - ((now - session.timestamp) / analysisWindowMs);
        const weight = ageFactor * ageFactor * ageFactor;
        if (session.result === "Tài") taiScore += weight;
        else xiuScore += weight;
    }
    const totalScore = taiScore + xiuScore;
    if (totalScore < 10) return null;
    if (taiScore / totalScore > xiuScore / totalScore + 0.10) return "Tài";
    if (xiuScore / totalScore > taiScore / totalScore + 0.10) return "Xỉu";
    return null;
}

// Logic 21: Multi-Window V3 (Markov + Pattern + Bias)
function markovWeightedV3(patternArr) {
    if (patternArr.length < 3) return null;
    const transitions = {};
    const lastResult = patternArr[patternArr.length - 1];
    const secondLastResult = patternArr.length > 1 ? patternArr[patternArr.length - 2] : null;
    for (let i = 0; i < patternArr.length - 1; i++) {
        const key = patternArr[i] + patternArr[i + 1];
        if (!transitions[key]) transitions[key] = { 'T': 0, 'X': 0 };
        if (i + 2 < patternArr.length) transitions[key][patternArr[i + 2]]++;
    }
    if (secondLastResult && lastResult && transitions[secondLastResult + lastResult]) {
        const stats = transitions[secondLastResult + lastResult];
        const total = stats['T'] + stats['X'];
        if (total > 3) {
            if (stats['T'] / total > 0.60) return "Tài";
            if (stats['X'] / total > 0.60) return "Xỉu";
        }
    }
    return null;
}

function repeatingPatternV3(patternArr) {
    if (patternArr.length < 4) return null;
    const lastThree = patternArr.slice(-3).join('');
    const lastFour = patternArr.slice(-4).join('');
    let taiFollows = 0, xiuFollows = 0, totalMatches = 0;
    for (let i = 0; i < patternArr.length - 4; i++) {
        const sliceThree = patternArr.slice(i, i + 3).join('');
        const sliceFour = patternArr.slice(i, i + 4).join('');
        if ((lastThree === sliceThree || lastFour === sliceFour) && i + 4 < patternArr.length) {
            totalMatches++;
            if (patternArr[i + 4] === 'T') taiFollows++; else xiuFollows++;
        }
    }
    if (totalMatches < 3) return null;
    if (taiFollows / totalMatches > 0.65) return "Tài";
    if (xiuFollows / totalMatches > 0.65) return "Xỉu";
    return null;
}

function detectBiasV3(patternArr) {
    if (patternArr.length < 5) return null;
    let taiCount = 0, xiuCount = 0;
    patternArr.forEach(r => { if (r === 'T') taiCount++; else xiuCount++; });
    const total = taiCount + xiuCount;
    if (total === 0) return null;
    if (taiCount / total > 0.60) return "Tài";
    if (xiuCount / total > 0.60) return "Xỉu";
    return null;
}

function predictLogic21(history) {
    if (history.length < 20) return null;
    const patternArr = history.map(s => s.result === 'Tài' ? 'T' : 'X');
    const voteCounts = { Tài: 0, Xỉu: 0 };
    let totalWeightSum = 0;
    const windows = [3, 5, 8, 12, 20, 30, 40, 60, 80];
    for (const win of windows) {
        if (patternArr.length < win) continue;
        const subPattern = patternArr.slice(0, win);
        const weight = win / 10;
        const markovRes = markovWeightedV3(subPattern.slice().reverse());
        if (markovRes) { voteCounts[markovRes] += weight * 0.7; totalWeightSum += weight * 0.7; }
        const repeatRes = repeatingPatternV3(subPattern.slice().reverse());
        if (repeatRes) { voteCounts[repeatRes] += weight * 0.15; totalWeightSum += weight * 0.15; }
        const biasRes = detectBiasV3(subPattern);
        if (biasRes) { voteCounts[biasRes] += weight * 0.15; totalWeightSum += weight * 0.15; }
    }
    if (totalWeightSum === 0) return null;
    if (voteCounts.Tài > voteCounts.Xỉu * 1.08) return "Tài";
    if (voteCounts.Xỉu > voteCounts.Tài * 1.08) return "Xỉu";
    return null;
}

// Logic 22: Super-powered Cau Analysis
function predictLogic22(history) {
    if (history.length < 15) return null;
    const resultsOnly = history.map(s => s.result === 'Tài' ? 'T' : 'X');
    let taiVotes = 0, xiuVotes = 0, totalWeight = 0;
    const currentStreakResult = resultsOnly[0];
    let currentStreakLength = 0;
    for (let i = 0; i < resultsOnly.length; i++) {
        if (resultsOnly[i] === currentStreakResult) currentStreakLength++;
        else break;
    }
    if (currentStreakLength >= 3) {
        let streakBreakCount = 0, streakContinueCount = 0;
        const streakSearchWindow = Math.min(resultsOnly.length, 200);
        for (let i = currentStreakLength; i < streakSearchWindow; i++) {
            const potentialStreak = resultsOnly.slice(i, i + currentStreakLength);
            if (potentialStreak.every(r => r === currentStreakResult)) {
                if (resultsOnly[i - 1] === currentStreakResult) streakContinueCount++;
                else streakBreakCount++;
            }
        }
        const totalStreakOccurrences = streakBreakCount + streakContinueCount;
        if (totalStreakOccurrences > 5) {
            if (streakBreakCount / totalStreakOccurrences > 0.65) {
                if (currentStreakResult === 'T') xiuVotes += 1.5; else taiVotes += 1.5;
                totalWeight += 1.5;
            } else if (streakContinueCount / totalStreakOccurrences > 0.65) {
                if (currentStreakResult === 'T') taiVotes += 1.5; else xiuVotes += 1.5;
                totalWeight += 1.5;
            }
        }
    }
    if (totalWeight === 0) return null;
    if (taiVotes > xiuVotes * 1.1) return "Tài";
    if (xiuVotes > taiVotes * 1.1) return "Xỉu";
    return null;
}

// Logic 23: Combined formulas
function predictLogic23(history) {
    if (history.length < 5) return null;
    const totals = history.map(s => s.totalScore);
    const allDice = history.slice(0, Math.min(history.length, 10)).flatMap(s => [s.d1, s.d2, s.d3]);
    const diceFreq = getDiceFrequencies(history, 10);
    const avg_total = totals.slice(0, Math.min(history.length, 10)).reduce((a, b) => a + b, 0) / Math.min(history.length, 10);
    const simplePredictions = [];
    if (history.length >= 2) simplePredictions.push((totals[0] + totals[1]) % 2 === 0 ? "Tài" : "Xỉu");
    if (avg_total > 10.5) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (diceFreq[4] + diceFreq[5] > diceFreq[1] + diceFreq[2]) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (history.filter(s => s.totalScore > 10).length > history.length / 2) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (history.length >= 3) simplePredictions.push(totals.slice(0, 3).reduce((a, b) => a + b, 0) > 33 ? "Tài" : "Xỉu");
    if (history.length >= 5) simplePredictions.push(Math.max(...totals.slice(0, 5)) > 15 ? "Tài" : "Xỉu");
    if (allDice.filter(d => d > 3).length > 7) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    let taiVotes = 0, xiuVotes = 0;
    simplePredictions.forEach(p => { if (p === "Tài") taiVotes++; else if (p === "Xỉu") xiuVotes++; });
    if (taiVotes > xiuVotes * 1.5) return "Tài";
    if (xiuVotes > taiVotes * 1.5) return "Xỉu";
    return null;
}

// Logic 24: Pattern Data
const PATTERN_DATA = {
    "ttxttx": { tai: 80, xiu: 20 }, "xxttxx": { tai: 25, xiu: 75 },
    "ttxxtt": { tai: 75, xiu: 25 }, "txtxt": { tai: 60, xiu: 40 },
    "xtxtx": { tai: 40, xiu: 60 }, "ttx": { tai: 70, xiu: 30 },
    "xxt": { tai: 30, xiu: 70 }, "tttt": { tai: 85, xiu: 15 },
    "xxxx": { tai: 15, xiu: 85 }, "ttttt": { tai: 88, xiu: 12 },
    "xxxxx": { tai: 12, xiu: 88 }, "tttttt": { tai: 92, xiu: 8 },
    "xxxxxx": { tai: 8, xiu: 92 }
};

function predictLogic24(history) {
    if (!history || history.length < 5) return null;
    const totals = history.map(s => s.totalScore);
    const allDice = history.flatMap(s => [s.d1, s.d2, s.d3]);
    const diceFreq = new Array(7).fill(0);
    allDice.forEach(d => { if (d >= 1 && d <= 6) diceFreq[d]++; });
    const avg_total = totals.slice(0, Math.min(history.length, 10)).reduce((a, b) => a + b, 0) / Math.min(history.length, 10);
    const votes = [];
    if (history.length >= 2) votes.push((totals[0] + totals[1]) % 2 === 0 ? "Tài" : "Xỉu");
    if (avg_total > 10.5) votes.push("Tài"); else votes.push("Xỉu");
    if (diceFreq[4] + diceFreq[5] > diceFreq[1] + diceFreq[2]) votes.push("Tài"); else votes.push("Xỉu");
    const patternSeq = history.slice(0, 3).map(s => s.result === "Tài" ? "t" : "x").reverse().join("");
    if (PATTERN_DATA[patternSeq]) {
        const prob = PATTERN_DATA[patternSeq];
        if (prob.tai > prob.xiu + 15) votes.push("Tài");
        else if (prob.xiu > prob.tai + 15) votes.push("Xỉu");
    }
    const taiCount = votes.filter(v => v === "Tài").length;
    const xiuCount = votes.filter(v => v === "Xỉu").length;
    if (taiCount + xiuCount < 4) return null;
    if (taiCount >= xiuCount + 3) return "Tài";
    if (xiuCount >= taiCount + 3) return "Xỉu";
    return null;
}

// Meta-Logic: Ensemble tất cả logic
async function predictLogic20(history) {
    if (history.length < 30) return null;
    let taiVotes = 0, xiuVotes = 0;
    const signals = [
        { logic: 'logic1', baseWeight: 0.8 }, { logic: 'logic2', baseWeight: 0.7 }, { logic: 'logic3', baseWeight: 0.9 },
        { logic: 'logic4', baseWeight: 1.2 }, { logic: 'logic5', baseWeight: 0.6 }, { logic: 'logic6', baseWeight: 0.8 },
        { logic: 'logic7', baseWeight: 1.0 }, { logic: 'logic8', baseWeight: 0.7 }, { logic: 'logic9', baseWeight: 1.1 },
        { logic: 'logic10', baseWeight: 0.9 }, { logic: 'logic11', baseWeight: 1.3 }, { logic: 'logic12', baseWeight: 0.7 },
        { logic: 'logic13', baseWeight: 1.2 }, { logic: 'logic14', baseWeight: 0.8 }, { logic: 'logic15', baseWeight: 0.6 },
        { logic: 'logic16', baseWeight: 0.7 }, { logic: 'logic17', baseWeight: 0.9 }, { logic: 'logic18', baseWeight: 1.3 },
        { logic: 'logic19', baseWeight: 0.9 }, { logic: 'logic21', baseWeight: 1.5 }, { logic: 'logic22', baseWeight: 1.8 },
        { logic: 'logic23', baseWeight: 1.0 }, { logic: 'logic24', baseWeight: 1.1 }
    ];
    const lastSession = history[0];
    const nextSessionId = lastSession.sid + 1;
    const childPredictions = {
        logic1: predictLogic1(lastSession, history), logic2: predictLogic2(nextSessionId, history),
        logic3: predictLogic3(history), logic4: predictLogic4(history), logic5: predictLogic5(history),
        logic6: predictLogic6(lastSession, history), logic7: predictLogic7(history), logic8: predictLogic8(history),
        logic9: predictLogic9(history), logic10: predictLogic10(history), logic11: predictLogic11(history),
        logic12: predictLogic12(lastSession, history), logic13: predictLogic13(history), logic14: predictLogic14(history),
        logic15: predictLogic15(history), logic16: predictLogic16(history), logic17: predictLogic17(history),
        logic18: predictLogic18(history), logic19: predictLogic19(history), logic21: predictLogic21(history),
        logic22: predictLogic22(history), logic23: predictLogic23(history), logic24: predictLogic24(history)
    };
    signals.forEach(signal => {
        const prediction = childPredictions[signal.logic];
        if (prediction !== null && logicPerformance[signal.logic]) {
            const acc = logicPerformance[signal.logic].accuracy;
            const consistency = logicPerformance[signal.logic].consistency;
            if (logicPerformance[signal.logic].total > 3 && acc > 0.35 && consistency > 0.25) {
                const effectiveWeight = signal.baseWeight * ((acc + consistency) / 2);
                if (prediction === "Tài") taiVotes += effectiveWeight;
                else xiuVotes += effectiveWeight;
            }
        }
    });
    if (taiVotes + xiuVotes < 1.5) return null;
    if (taiVotes > xiuVotes * 1.08) return "Tài";
    if (xiuVotes > taiVotes * 1.08) return "Xỉu";
    return null;
}

// ==================== FETCH API & DỰ ĐOÁN ====================

async function fetchApi() {
    try {
        const res = await axios.get(API_URL, { timeout: 10000 });
        const data = res.data;
        if (data && Array.isArray(data.history) && data.history.length > 0) {
            return data.history.map(item => ({
                session: parseInt(item.phien_truoc) || parseInt(item.phien_hien_tai) || 0,
                sid: parseInt(item.phien_truoc) || parseInt(item.phien_hien_tai) || 0,
                d1: parseInt(item.xuc_xac1) || 0,
                d2: parseInt(item.xuc_xac2) || 0,
                d3: parseInt(item.xuc_xac3) || 0,
                totalScore: parseInt(item.tong) || 0,
                result: item.ket_qua || '',
                timestamp: Date.now()
            }));
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function updateHistory() {
    const data = await fetchApi();
    if (data.length === 0) return;
    for (const entry of data) {
        if (!seenSessions.has(entry.session) && entry.session > 0 && entry.result) {
            seenSessions.add(entry.session);
            history.unshift(entry);
            if (history.length > 500) history = history.slice(0, 500);
            break;
        }
    }
}

async function getBestPrediction() {
    if (history.length < 6) return { prediction: 'Chờ đủ dữ liệu', confidence: 0 };
    
    // Gọi Meta-Logic (tổng hợp 24 logic)
    const metaPred = await predictLogic20(history);
    if (metaPred) return { prediction: metaPred, confidence: 75 };
    
    // Fallback: dùng các logic cơ bản
    let taiScore = 0, xiuScore = 0;
    const preds = [
        trendAndProb(history), shortPattern(history), meanDeviation(history),
        recentSwitch(history), smartBridgeBreak(history).prediction
    ];
    preds.forEach(p => {
        if (p === 1) taiScore += 0.2;
        else if (p === 2) xiuScore += 0.2;
    });
    
    const finalPrediction = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    const confidence = Math.round(Math.abs(taiScore - xiuScore) / (taiScore + xiuScore + 0.0001) * 100);
    return { prediction: finalPrediction, confidence };
}

// Các hàm phụ cho fallback
function trendAndProb(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 5) return breakProb > 0.75 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    const last15 = history.slice(-15).map(h => h.result);
    return last15[last15.length - 1] === 'Xỉu' ? 1 : 2;
}

function shortPattern(history) {
    if (!history || history.length < 3) return 0;
    const last8 = history.slice(-8).map(h => h.result);
    return last8[last8.length - 1] === 'Xỉu' ? 1 : 2;
}

function meanDeviation(history) {
    if (!history || history.length < 3) return 0;
    const last12 = history.slice(-12).map(h => h.result);
    const taiCount = last12.filter(r => r === 'Tài').length;
    const xiuCount = last12.length - taiCount;
    return xiuCount > taiCount ? 1 : 2;
}

function recentSwitch(history) {
    if (!history || history.length < 3) return 0;
    const last10 = history.slice(-10).map(h => h.result);
    return last10[last10.length - 1] === 'Xỉu' ? 1 : 2;
}

function smartBridgeBreak(history) {
    if (!history || history.length < 3) return { prediction: 0 };
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    let breakProbability = breakProb;
    if (streak >= 6) breakProbability = Math.min(breakProbability + 0.15, 0.9);
    else if (streak >= 4) breakProbability = Math.min(breakProbability + 0.1, 0.85);
    else breakProbability = Math.max(breakProbability - 0.15, 0.15);
    return { prediction: breakProbability > 0.65 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2) };
}

// ==================== ROUTE CHÍNH ====================

app.get('/', async (req, res) => {
    await updateHistory();
    
    let lastSession = history[0] || {};
    let currentSession = lastSession.session || 0;
    let predicted = await getBestPrediction();
    
    let patternText = '[Đang kết nối...]';
    if (history.length >= 3) {
        patternText = history.slice(0, 3).map(s => s.result === 'Tài' ? 'T' : 'X').join('');
    }
    
    res.json({
        phien_truoc: currentSession || 0,
        xuc_xac1: lastSession.d1 || 0,
        xuc_xac2: lastSession.d2 || 0,
        xuc_xac3: lastSession.d3 || 0,
        tong: lastSession.totalScore || 0,
        ket_qua: lastSession.result || '',
        pattern: patternText,
        phien_hien_tai: currentSession ? currentSession + 1 : 1,
        du_doan: predicted.prediction,
        do_tin_cay: predicted.confidence
    });
});

setInterval(updateHistory, 3000);

app.listen(PORT, () => {
    console.log(`🚀 Tool dự đoán Sunwin - Full 24 Logic + Meta-Logic - PORT ${PORT}`);
    updateHistory();
});
