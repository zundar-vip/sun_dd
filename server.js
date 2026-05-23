const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const API_URL = 'https://sunwin-ke.onrender.com/sun';
const DATA_FILE = './history.json';

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
    logic20: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic21: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic22: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic23: { correct: 0, total: 0, accuracy: 0, consistency: 0 },
    logic24: { correct: 0, total: 0, accuracy: 0, consistency: 0 }
};
let lastUpdateTime = null;

if (fs.existsSync(DATA_FILE)) {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const saved = JSON.parse(raw);
        history = saved.history || [];
        seenSessions = new Set(saved.seenSessions || []);
        logicPerformance = saved.logicPerformance || logicPerformance;
        lastUpdateTime = saved.lastUpdateTime || null;
    } catch(e) {
        console.error('Lỗi load dữ liệu cũ, bắt đầu mới');
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            history, seenSessions: Array.from(seenSessions),
            logicPerformance, lastUpdateTime
        }));
    } catch(e) {}
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
    if (streak >= 8) {
        breakProb = Math.min(0.6 + (switches / 15) + imbalance * 0.15, 0.9);
    } else if (streak >= 5) {
        breakProb = Math.min(0.35 + (switches / 10) + imbalance * 0.25, 0.85);
    } else if (streak >= 3 && switches >= 7) {
        breakProb = 0.3;
    }
    return { streak, currentResult, breakProb };
}

function smartBridgeBreak(history) {
    if (!history || history.length < 3) return { prediction: 0, breakProb: 0.0, reason: 'Không đủ dữ liệu để bẻ cầu' };
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    const last20 = history.slice(-20).map(h => h.result);
    const lastScores = history.slice(-20).map(h => h.totalScore || 0);
    let breakProbability = breakProb;
    let reason = '';
    const avgScore = lastScores.reduce((sum, score) => sum + score, 0) / (lastScores.length || 1);
    const scoreDeviation = lastScores.reduce((sum, score) => sum + Math.abs(score - avgScore), 0) / (lastScores.length || 1);
    const last5 = last20.slice(-5);
    const patternCounts = {};
    for (let i = 0; i <= last20.length - 3; i++) {
        const pattern = last20.slice(i, i + 3).join(',');
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
    const mostCommonPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    const isStablePattern = mostCommonPattern && mostCommonPattern[1] >= 3;
    if (streak >= 6) {
        breakProbability = Math.min(breakProbability + 0.15, 0.9);
        reason = `[Bẻ Cầu] Chuỗi ${streak} ${currentResult} dài, khả năng bẻ cầu cao`;
    } else if (streak >= 4 && scoreDeviation > 3) {
        breakProbability = Math.min(breakProbability + 0.1, 0.85);
        reason = `[Bẻ Cầu] Biến động điểm số lớn (${scoreDeviation.toFixed(1)}), khả năng bẻ cầu tăng`;
    } else if (isStablePattern && last5.every(r => r === currentResult)) {
        breakProbability = Math.min(breakProbability + 0.05, 0.8);
        reason = `[Bẻ Cầu] Phát hiện mẫu lặp ${mostCommonPattern[0]}, có khả năng bẻ cầu`;
    } else {
        breakProbability = Math.max(breakProbability - 0.15, 0.15);
        reason = `[Bẻ Cầu] Không phát hiện mẫu bẻ cầu mạnh, tiếp tục theo cầu`;
    }
    let prediction = breakProbability > 0.65 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    return { prediction, breakProb: breakProbability, reason };
}

function trendAndProb(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 5) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return 0;
    const weights = last15.map((_, i) => Math.pow(1.2, i));
    const taiWeighted = weights.reduce((sum, w, i) => sum + (last15[i] === 'Tài' ? w : 0), 0);
    const xiuWeighted = weights.reduce((sum, w, i) => sum + (last15[i] === 'Xỉu' ? w : 0), 0);
    const totalWeight = taiWeighted + xiuWeighted;
    const last10 = last15.slice(-10);
    const patterns = [];
    if (last10.length >= 4) {
        for (let i = 0; i <= last10.length - 4; i++) {
            patterns.push(last10.slice(i, i + 4).join(','));
        }
    }
    const patternCounts = patterns.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
    const mostCommon = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] >= 3) {
        const pattern = mostCommon[0].split(',');
        return pattern[pattern.length - 1] !== last10[last10.length - 1] ? 1 : 2;
    } else if (totalWeight > 0 && Math.abs(taiWeighted - xiuWeighted) / totalWeight >= 0.25) {
        return taiWeighted > xiuWeighted ? 2 : 1;
    }
    return last15[last15.length - 1] === 'Xỉu' ? 1 : 2;
}

function shortPattern(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 4) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last8 = history.slice(-8).map(h => h.result);
    if (!last8.length) return 0;
    const patterns = [];
    if (last8.length >= 3) {
        for (let i = 0; i <= last8.length - 3; i++) {
            patterns.push(last8.slice(i, i + 3).join(','));
        }
    }
    const patternCounts = patterns.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
    const mostCommon = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] >= 2) {
        const pattern = mostCommon[0].split(',');
        return pattern[pattern.length - 1] !== last8[last8.length - 1] ? 1 : 2;
    }
    return last8[last8.length - 1] === 'Xỉu' ? 1 : 2;
}

function meanDeviation(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 4) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last12 = history.slice(-12).map(h => h.result);
    if (!last12.length) return 0;
    const taiCount = last12.filter(r => r === 'Tài').length;
    const xiuCount = last12.length - taiCount;
    const deviation = Math.abs(taiCount - xiuCount) / last12.length;
    if (deviation < 0.35) return last12[last12.length - 1] === 'Xỉu' ? 1 : 2;
    return xiuCount > taiCount ? 1 : 2;
}

function recentSwitch(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 4) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last10 = history.slice(-10).map(h => h.result);
    if (!last10.length) return 0;
    const switches = last10.slice(1).reduce((count, curr, idx) => count + (curr !== last10[idx] ? 1 : 0), 0);
    return switches >= 6 ? (last10[last10.length - 1] === 'Xỉu' ? 1 : 2) : (last10[last10.length - 1] === 'Xỉu' ? 1 : 2);
}

function isBadPattern(history) {
    if (!history || history.length < 3) return false;
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return false;
    const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
    const { streak } = detectStreakAndBreak(history);
    return switches >= 9 || streak >= 10;
}

function aiHtddLogic(history) {
    if (!history || history.length < 3) {
        const randomResult = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return { prediction: randomResult, reason: '[AI] Không đủ lịch sử, dự đoán ngẫu nhiên', source: 'HuyDaiXu AI' };
    }
    const recentHistory = history.slice(-5).map(h => h.result);
    const recentScores = history.slice(-5).map(h => h.totalScore || 0);
    const taiCount = recentHistory.filter(r => r === 'Tài').length;
    const xiuCount = recentHistory.filter(r => r === 'Xỉu').length;

    if (history.length >= 3) {
        const last3 = history.slice(-3).map(h => h.result);
        if (last3.join(',') === 'Tài,Xỉu,Tài') {
            return { prediction: 'Xỉu', reason: '[HuyDaiXu AI] Phát hiện mẫu 1T1X → tiếp theo nên đánh Xỉu', source: 'HuyDaiXu AI' };
        } else if (last3.join(',') === 'Xỉu,Tài,Xỉu') {
            return { prediction: 'Tài', reason: '[HuyDaiXu AI] Phát hiện mẫu 1X1T → tiếp theo nên đánh Tài', source: 'HuyDaiXu AI' };
        }
    }
    if (history.length >= 4) {
        const last4 = history.slice(-4).map(h => h.result);
        if (last4.join(',') === 'Tài,Tài,Xỉu,Xỉu') {
            return { prediction: 'Tài', reason: '[HuyDaiXu AI] Phát hiện mẫu 2T2X → tiếp theo nên đánh Tài', source: 'HuyDaiXu AI' };
        } else if (last4.join(',') === 'Xỉu,Xỉu,Tài,Tài') {
            return { prediction: 'Xỉu', reason: '[HuyDaiXu AI] Phát hiện mẫu 2X2T → tiếp theo nên đánh Xỉu', source: 'HuyDaiXu AI' };
        }
    }
    if (history.length >= 9 && history.slice(-6).every(h => h.result === 'Tài')) {
        return { prediction: 'Xỉu', reason: '[HuyDaiXu AI] Chuỗi Tài quá dài (6 lần) → dự đoán Xỉu', source: 'HuyDaiXu AI' };
    } else if (history.length >= 9 && history.slice(-6).every(h => h.result === 'Xỉu')) {
        return { prediction: 'Tài', reason: '[HuyDaiXu AI] Chuỗi Xỉu quá dài (6 lần) → dự đoán Tài', source: 'HuyDaiXu AI' };
    }
    const avgScore = recentScores.reduce((sum, score) => sum + score, 0) / (recentScores.length || 1);
    if (avgScore > 10) {
        return { prediction: 'Tài', reason: `[HuyDaiXu AI] Điểm trung bình cao (${avgScore.toFixed(1)}) → dự đoán Tài`, source: 'HuyDaiXu AI' };
    } else if (avgScore < 8) {
        return { prediction: 'Xỉu', reason: `[HuyDaiXu AI] Điểm trung bình thấp (${avgScore.toFixed(1)}) → dự đoán Xỉu`, source: 'HuyDaiXu AI' };
    }
    if (taiCount > xiuCount + 1) {
        return { prediction: 'Xỉu', reason: `[HuyDaiXu AI] Tài chiếm đa số (${taiCount}/${recentHistory.length}) → dự đoán Xỉu`, source: 'HuyDaiXu AI' };
    } else if (xiuCount > taiCount + 1) {
        return { prediction: 'Tài', reason: `[HuyDaiXu AI] Xỉu chiếm đa số (${xiuCount}/${recentHistory.length}) → dự đoán Tài`, source: 'HuyDaiXu AI' };
    } else {
        const overallTai = history.filter(h => h.result === 'Tài').length;
        const overallXiu = history.filter(h => h.result === 'Xỉu').length;
        if (overallTai > overallXiu + 2) {
            return { prediction: 'Xỉu', reason: '[HuyDaiXu AI] Tổng thể Tài nhiều hơn → dự đoán Xỉu', source: 'HuyDaiXu AI' };
        } else if (overallXiu > overallTai + 2) {
            return { prediction: 'Tài', reason: '[HuyDaiXu AI] Tổng thể Xỉu nhiều hơn → dự đoán Tài', source: 'HuyDaiXu AI' };
        } else {
            return { prediction: Math.random() < 0.5 ? 'Tài' : 'Xỉu', reason: '[HuyDaiXu AI] Cân bằng, dự đoán ngẫu nhiên', source: 'HuyDaiXu AI' };
        }
    }
}

let modelPredictions = { trend: {}, short: {}, mean: {}, switch: {}, bridge: {} };

function evaluateModelPerformance(history, modelName, lookback = 10) {
    if (!modelPredictions[modelName] || history.length < 2) return 1.0;
    lookback = Math.min(lookback, history.length - 1);
    let correctCount = 0;
    for (let i = 0; i < lookback; i++) {
        const sessionId = history[history.length - (i + 2)]?.session;
        const pred = modelPredictions[modelName][sessionId] || 0;
        const actual = history[history.length - (i + 1)].result;
        if ((pred === 1 && actual === 'Tài') || (pred === 2 && actual === 'Xỉu')) {
            correctCount++;
        }
    }
    const performanceScore = lookback > 0 ? 1.0 + (correctCount - lookback / 2) / (lookback / 2) : 1.0;
    return Math.max(0.5, Math.min(1.5, performanceScore));
}

function generatePrediction(history) {
    if (!history || history.length === 0) {
        return { prediction: 'Chờ dữ liệu', confidence: 0, reason: 'Không có lịch sử' };
    }
    if (history.length < 6) {
        return { prediction: 'Chờ đủ 6 phiên', confidence: 0, reason: 'Chưa đủ dữ liệu' };
    }

    const currentSession = history[history.length - 1];

    const trendPred = trendAndProb(history);
    const shortPred = shortPattern(history);
    const meanPred = meanDeviation(history);
    const switchPred = recentSwitch(history);
    const bridgePred = smartBridgeBreak(history);
    const aiPred = aiHtddLogic(history);

    modelPredictions.trend[currentSession.session] = trendPred;
    modelPredictions.short[currentSession.session] = shortPred;
    modelPredictions.mean[currentSession.session] = meanPred;
    modelPredictions.switch[currentSession.session] = switchPred;
    modelPredictions.bridge[currentSession.session] = bridgePred.prediction;

    const modelScores = {
        trend: evaluateModelPerformance(history, 'trend'),
        short: evaluateModelPerformance(history, 'short'),
        mean: evaluateModelPerformance(history, 'mean'),
        switch: evaluateModelPerformance(history, 'switch'),
        bridge: evaluateModelPerformance(history, 'bridge')
    };

    const weights = {
        trend: 0.2 * modelScores.trend,
        short: 0.2 * modelScores.short,
        mean: 0.25 * modelScores.mean,
        switch: 0.2 * modelScores.switch,
        bridge: 0.15 * modelScores.bridge,
        aihtdd: 0.2
    };

    let taiScore = 0, xiuScore = 0;

    if (trendPred === 1) taiScore += weights.trend; else if (trendPred === 2) xiuScore += weights.trend;
    if (shortPred === 1) taiScore += weights.short; else if (shortPred === 2) xiuScore += weights.short;
    if (meanPred === 1) taiScore += weights.mean; else if (meanPred === 2) xiuScore += weights.mean;
    if (switchPred === 1) taiScore += weights.switch; else if (switchPred === 2) xiuScore += weights.switch;
    if (bridgePred.prediction === 1) taiScore += weights.bridge; else if (bridgePred.prediction === 2) xiuScore += weights.bridge;
    if (aiPred.prediction === 'Tài') taiScore += weights.aihtdd; else xiuScore += weights.aihtdd;

    if (isBadPattern(history)) {
        taiScore *= 0.8;
        xiuScore *= 0.8;
    }

    const last10Preds = history.slice(-10).map(h => h.result);
    const taiPredCount = last10Preds.filter(r => r === 'Tài').length;
    if (taiPredCount >= 7) xiuScore += 0.15;
    else if (taiPredCount <= 3) taiScore += 0.15;

    if (bridgePred.breakProb > 0.65) {
        if (bridgePred.prediction === 1) taiScore += 0.2;
        else xiuScore += 0.2;
    }

    const finalPrediction = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    const confidence = Math.abs(taiScore - xiuScore) / (taiScore + xiuScore + 0.0001) * 100;
    const confidenceText = confidence >= 75 ? 'Rất cao' : (confidence >= 50 ? 'Cao' : 'Thấp');

    return {
        prediction: finalPrediction,
        confidence: Math.round(confidence),
        confidenceText: `${confidenceText} (${Math.round(confidence)}%)`,
        details: {
            scores: { taiScore, xiuScore },
            modelVotes: { trendPred, shortPred, meanPred, switchPred, bridgePred, aiPred },
            reason: `${aiPred.reason} | ${bridgePred.reason}`
        }
    };
}

function calculateStdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function getDiceFrequencies(history, limit) {
    const allDice = [];
    const effectiveHistory = history.slice(0, limit);
    effectiveHistory.forEach(s => {
        allDice.push(s.d1, s.d2, s.d3);
    });
    const diceFreq = new Array(7).fill(0);
    allDice.forEach(d => {
        if (d >= 1 && d <= 6) diceFreq[d]++;
    });
    return diceFreq;
}

function predictLogic1(lastSession, history) {
    if (!lastSession || history.length < 10) return null;
    const lastDigitOfSession = lastSession.sid % 10;
    const totalPreviousSession = lastSession.totalScore;
    let indicatorSum = lastDigitOfSession + totalPreviousSession;
    const currentPrediction = indicatorSum % 2 === 0 ? "Xỉu" : "Tài";
    let correctCount = 0;
    let totalCount = 0;
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

function predictLogic2(nextSessionId, history) {
    if (history.length < 15) return null;
    let thuanScore = 0;
    let nghichScore = 0;
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

function predictLogic3(history) {
    if (history.length < 15) return null;
    const analysisWindow = Math.min(history.length, 50);
    const lastXTotals = history.slice(0, analysisWindow).map(s => s.totalScore);
    const sumOfTotals = lastXTotals.reduce((a, b) => a + b, 0);
    const average = sumOfTotals / analysisWindow;
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

function predictLogic4(history) {
    if (history.length < 30) return null;
    let bestPrediction = null;
    let maxConfidence = 0;
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
                const nextResult = history[i - 1].result;
                if (nextResult === 'Tài') taiFollows++; else xiuFollows++;
            }
        }
        if (totalMatches < 3) continue;
        const taiConfidence = taiFollows / totalMatches;
        const xiuConfidence = xiuFollows / totalMatches;
        const MIN_PATTERN_CONFIDENCE = 0.70;
        if (taiConfidence >= MIN_PATTERN_CONFIDENCE && taiConfidence > maxConfidence) {
            maxConfidence = taiConfidence;
            bestPrediction = "Tài";
        } else if (xiuConfidence >= MIN_PATTERN_CONFIDENCE && xiuConfidence > maxConfidence) {
            maxConfidence = xiuConfidence;
            bestPrediction = "Xỉu";
        }
    }
    return bestPrediction;
}

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
        if (sumCounts[sum] > maxWeightedCount) {
            maxWeightedCount = sumCounts[sum];
            mostFrequentSum = parseInt(sum);
        }
    }
    if (mostFrequentSum !== -1) {
        const totalWeightedSum = Object.values(sumCounts).reduce((a, b) => a + b, 0);
        if (totalWeightedSum > 0 && (maxWeightedCount / totalWeightedSum) > 0.08) {
            const neighbors = [];
            if (sumCounts[mostFrequentSum - 1]) neighbors.push(sumCounts[mostFrequentSum - 1]);
            if (sumCounts[mostFrequentSum + 1]) neighbors.push(sumCounts[mostFrequentSum + 1]);
            const isPeak = neighbors.every(n => maxWeightedCount > n * 1.05);
            if (isPeak) {
                if (mostFrequentSum <= 10) return "Xỉu";
                if (mostFrequentSum >= 11) return "Tài";
            }
        }
    }
    return null;
}

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
        const prevSessionLastDigit = prevHistSession.sid % 10;
        const prevSessionTotalParity = prevHistSession.totalScore % 2;
        const featureSetHistory = `${prevSessionLastDigit % 2}-${prevSessionTotalParity}-${(prevHistSession.totalScore > 10.5 ? 'T' : 'X')}`;
        const featureSetCurrent = `${nextSessionLastDigit % 2}-${lastSessionTotalParity}-${(lastSession.totalScore > 10.5 ? 'T' : 'X')}`;
        if (featureSetHistory === featureSetCurrent) {
            if (currentHistSessionResult === "Tài") taiVotes++; else xiuVotes++;
        }
    }
    const totalVotes = taiVotes + xiuVotes;
    if (totalVotes < 5) return null;
    const voteDifferenceRatio = Math.abs(taiVotes - xiuVotes) / totalVotes;
    if (voteDifferenceRatio > 0.25) {
        if (taiVotes > xiuVotes) return "Tài";
        if (xiuVotes > taiVotes) return "Xỉu";
    }
    return null;
}

function predictLogic7(history) {
    const TREND_STREAK_LENGTH_MIN = 4;
    const TREND_STREAK_LENGTH_MAX = 7;
    if (history.length < TREND_STREAK_LENGTH_MIN) return null;
    const volatility = calculateStdDev(history.slice(0, Math.min(25, history.length)).map(s => s.totalScore));
    const effectiveStreakLength = (volatility < 1.6) ? TREND_STREAK_LENGTH_MAX : TREND_STREAK_LENGTH_MIN + 1;
    const recentResults = history.slice(0, effectiveStreakLength).map(s => s.result);
    if (recentResults.length < effectiveStreakLength) return null;
    if (recentResults.every(r => r === "Tài")) {
        const nextFew = history.slice(effectiveStreakLength, effectiveStreakLength + 2);
        if (nextFew.length === 2 && nextFew.filter(s => s.result === "Tài").length >= 1) return "Tài";
    }
    if (recentResults.every(r => r === "Xỉu")) {
        const nextFew = history.slice(effectiveStreakLength, effectiveStreakLength + 2);
        if (nextFew.length === 2 && nextFew.filter(s => s.result === "Xỉu").length >= 1) return "Xỉu";
    }
    return null;
}

function predictLogic8(history) {
    const LONG_PERIOD = 30;
    if (history.length < LONG_PERIOD + 1) return null;
    const longTermTotals = history.slice(1, LONG_PERIOD + 1).map(s => s.totalScore);
    const longTermAverage = longTermTotals.reduce((a, b) => a + b, 0) / longTermTotals.length;
    const longTermStdDev = calculateStdDev(longTermTotals);
    const lastSessionTotal = history[0].totalScore;
    const dynamicDeviationThreshold = Math.max(1.5, 0.8 * longTermStdDev);
    const last5Totals = history.slice(0, Math.min(5, history.length)).map(s => s.totalScore);
    let isLast5Rising = false, isLast5Falling = false;
    if (last5Totals.length >= 2) {
        isLast5Rising = true; isLast5Falling = true;
        for (let i = 0; i < last5Totals.length - 1; i++) {
            if (last5Totals[i] <= last5Totals[i + 1]) isLast5Rising = false;
            if (last5Totals[i] >= last5Totals[i + 1]) isLast5Falling = false;
        }
    }
    if (lastSessionTotal > longTermAverage + dynamicDeviationThreshold && isLast5Rising) return "Xỉu";
    if (lastSessionTotal < longTermAverage - dynamicDeviationThreshold && isLast5Falling) return "Tài";
    return null;
}

function predictLogic9(history) {
    if (history.length < 20) return null;
    let maxTaiStreak = 0, maxXiuStreak = 0;
    let currentTaiStreakForHistory = 0, currentXiuStreakForHistory = 0;
    const historyForMaxStreak = history.slice(0, Math.min(history.length, 120));
    for (const session of historyForMaxStreak) {
        if (session.result === "Tài") {
            currentTaiStreakForHistory++;
            currentXiuStreakForHistory = 0;
        } else {
            currentXiuStreakForHistory++;
            currentTaiStreakForHistory = 0;
        }
        maxTaiStreak = Math.max(maxTaiStreak, currentTaiStreakForHistory);
        maxXiuStreak = Math.max(maxXiuStreak, currentXiuStreakForHistory);
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

function predictLogic10(history) {
    const MOMENTUM_STREAK_LENGTH = 3;
    const STABILITY_CHECK_LENGTH = 7;
    if (history.length < STABILITY_CHECK_LENGTH + 1) return null;
    const recentResults = history.slice(0, MOMENTUM_STREAK_LENGTH).map(s => s.result);
    const widerHistory = history.slice(0, STABILITY_CHECK_LENGTH).map(s => s.result);
    if (recentResults.every(r => r === "Tài")) {
        const taiCountInWider = widerHistory.filter(r => r === "Tài").length;
        if (taiCountInWider / STABILITY_CHECK_LENGTH >= 0.75 && predictLogic9(history) !== "Xỉu") return "Tài";
    }
    if (recentResults.every(r => r === "Xỉu")) {
        const xiuCountInWider = widerHistory.filter(r => r === "Xỉu").length;
        if (xiuCountInWider / STABILITY_CHECK_LENGTH >= 0.75 && predictLogic9(history) !== "Tài") return "Xỉu";
    }
    return null;
}

function predictLogic11(history) {
    if (history.length < 15) return null;
    const reversalPatterns = [
        { pattern: "TàiXỉuTài", predict: "Xỉu", minOccurrences: 3, weight: 1.5 },
        { pattern: "XỉuTàiXỉu", predict: "Tài", minOccurrences: 3, weight: 1.5 },
        { pattern: "TàiTàiXỉu", predict: "Tài", minOccurrences: 4, weight: 1.3 },
        { pattern: "XỉuXỉuTài", predict: "Xỉu", minOccurrences: 4, weight: 1.3 },
        { pattern: "TàiXỉuXỉu", predict: "Tài", minOccurrences: 3, weight: 1.4 },
        { pattern: "XỉuTàiTài", predict: "Xỉu", minOccurrences: 3, weight: 1.4 },
        { pattern: "XỉuTàiTàiXỉu", predict: "Xỉu", minOccurrences: 2, weight: 1.6 },
        { pattern: "TàiXỉuXỉuTài", predict: "Tài", minOccurrences: 2, weight: 1.6 },
        { pattern: "TàiXỉuTàiXỉu", predict: "Tài", minOccurrences: 2, weight: 1.4 },
        { pattern: "XỉuTàiXỉuTài", predict: "Xỉu", minOccurrences: 2, weight: 1.4 },
        { pattern: "TàiXỉuXỉuXỉu", predict: "Tài", minOccurrences: 1, weight: 1.7 },
        { pattern: "XỉuTàiTàiTài", predict: "Xỉu", minOccurrences: 1, weight: 1.7 },
    ];
    let bestPatternMatch = null, maxWeightedConfidence = 0;
    for (const patternDef of reversalPatterns) {
        const patternDefShort = patternDef.pattern.replace(/Tài/g, 'T').replace(/Xỉu/g, 'X');
        const patternLength = patternDefShort.length;
        if (history.length < patternLength + 1) continue;
        const currentWindowShort = history.slice(0, patternLength).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('');
        if (currentWindowShort === patternDefShort) {
            let matchCount = 0, totalPatternOccurrences = 0;
            for (let i = patternLength; i < Math.min(history.length - 1, 350); i++) {
                const historicalPatternShort = history.slice(i, i + patternLength).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('');
                if (historicalPatternShort === patternDefShort) {
                    totalPatternOccurrences++;
                    if (history[i - 1].result === patternDef.predict) matchCount++;
                }
            }
            if (totalPatternOccurrences < patternDef.minOccurrences) continue;
            const patternAccuracy = matchCount / totalPatternOccurrences;
            if (patternAccuracy >= 0.68) {
                const weightedConfidence = patternAccuracy * patternDef.weight;
                if (weightedConfidence > maxWeightedConfidence) {
                    maxWeightedConfidence = weightedConfidence;
                    bestPatternMatch = patternDef.predict;
                }
            }
        }
    }
    return bestPatternMatch;
}

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
        const currentHistSession = history[i];
        const prevHistSession = history[i + 1];
        const prevHistSessionParity = prevHistSession.sid % 2;
        let histConsecutiveCount = 0;
        for (let j = i + 1; j < analysisWindow; j++) {
            if (history[j].result === prevHistSession.result) histConsecutiveCount++;
            else break;
        }
        if (prevHistSessionParity === nextSessionParity && histConsecutiveCount === currentConsecutiveCount) {
            if (currentHistSession.result === "Tài") taiVotes++;
            else xiuVotes++;
        }
    }
    const totalVotes = taiVotes + xiuVotes;
    if (totalVotes < 6) return null;
    if (taiVotes / totalVotes >= 0.68) return "Tài";
    if (xiuVotes / totalVotes >= 0.68) return "Xỉu";
    return null;
}

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
        const taiProb = stats['Tài'] / totalFollowUps;
        const xiuProb = stats['Xỉu'] / totalFollowUps;
        if (taiProb >= 0.65) return "Tài";
        if (xiuProb >= 0.65) return "Xỉu";
    }
    return null;
}

function predictLogic14(history) {
    if (history.length < 50) return null;
    const shortPeriod = 8;
    const longPeriod = 30;
    if (history.length < longPeriod) return null;
    const shortTermTotals = history.slice(0, shortPeriod).map(s => s.totalScore);
    const longTermTotals = history.slice(0, longPeriod).map(s => s.totalScore);
    const shortAvg = shortTermTotals.reduce((a, b) => a + b, 0) / shortPeriod;
    const longAvg = longTermTotals.reduce((a, b) => a + b, 0) / longPeriod;
    const longStdDev = calculateStdDev(longTermTotals);
    if (shortAvg > longAvg + (longStdDev * 0.8)) {
        const last2Results = history.slice(0, 2).map(s => s.result);
        if (last2Results.length === 2 && last2Results.every(r => r === "Tài")) return "Xỉu";
    } else if (shortAvg < longAvg - (longStdDev * 0.8)) {
        const last2Results = history.slice(0, 2).map(s => s.result);
        if (last2Results.length === 2 && last2Results.every(r => r === "Xỉu")) return "Tài";
    }
    return null;
}

function predictLogic15(history) {
    if (history.length < 80) return null;
    const analysisWindow = Math.min(history.length, 400);
    const evenCounts = { "Tài": 0, "Xỉu": 0 };
    const oddCounts = { "Tài": 0, "Xỉu": 0 };
    let totalEven = 0, totalOdd = 0;
    for (let i = 0; i < analysisWindow; i++) {
        const session = history[i];
        const isTotalEven = session.totalScore % 2 === 0;
        if (isTotalEven) {
            evenCounts[session.result]++;
            totalEven++;
        } else {
            oddCounts[session.result]++;
            totalOdd++;
        }
    }
    if (totalEven < 20 || totalOdd < 20) return null;
    const lastSessionTotal = history[0].totalScore;
    const isLastTotalEven = lastSessionTotal % 2 === 0;
    const minDominance = 0.65;
    if (isLastTotalEven) {
        if (evenCounts["Tài"] / totalEven >= minDominance) return "Tài";
        if (evenCounts["Xỉu"] / totalEven >= minDominance) return "Xỉu";
    } else {
        if (oddCounts["Tài"] / totalOdd >= minDominance) return "Tài";
        if (oddCounts["Xỉu"] / totalOdd >= minDominance) return "Xỉu";
    }
    return null;
}

function predictLogic16(history) {
    if (history.length < 60) return null;
    const MODULO_N = 5;
    const analysisWindow = Math.min(history.length, 500);
    const moduloPatterns = {};
    for (let i = 0; i < analysisWindow - 1; i++) {
        const prevSession = history[i + 1];
        const currentSessionResult = history[i].result;
        const moduloValue = prevSession.totalScore % MODULO_N;
        if (!moduloPatterns[moduloValue]) moduloPatterns[moduloValue] = { 'Tài': 0, 'Xỉu': 0 };
        moduloPatterns[moduloValue][currentSessionResult]++;
    }
    const lastSessionTotal = history[0].totalScore;
    const currentModuloValue = lastSessionTotal % MODULO_N;
    if (moduloPatterns[currentModuloValue]) {
        const stats = moduloPatterns[currentModuloValue];
        const totalCount = stats['Tài'] + stats['Xỉu'];
        if (totalCount < 7) return null;
        const taiProb = stats['Tài'] / totalCount;
        const xiuProb = stats['Xỉu'] / totalCount;
        if (taiProb >= 0.65) return "Tài";
        if (xiuProb >= 0.65) return "Xỉu";
    }
    return null;
}

function predictLogic17(history) {
    if (history.length < 100) return null;
    const analysisWindow = Math.min(history.length, 600);
    const totals = history.slice(0, analysisWindow).map(s => s.totalScore);
    const meanTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDevTotal = calculateStdDev(totals);
    const lastSessionTotal = history[0].totalScore;
    const deviation = Math.abs(lastSessionTotal - meanTotal);
    const zScore = stdDevTotal > 0 ? deviation / stdDevTotal : 0;
    if (zScore >= 1.5) {
        if (lastSessionTotal > meanTotal) return "Xỉu";
        else return "Tài";
    }
    return null;
}

function predictLogic18(history) {
    if (history.length < 50) return null;
    const analysisWindow = Math.min(history.length, 300);
    const patternStats = {};
    for (let i = 0; i < analysisWindow - 1; i++) {
        const prevSession = history[i + 1];
        const currentSessionResult = history[i].result;
        const p1 = prevSession.d1 % 2, p2 = prevSession.d2 % 2, p3 = prevSession.d3 % 2;
        const patternKey = `${p1}-${p2}-${p3}`;
        if (!patternStats[patternKey]) patternStats[patternKey] = { 'Tài': 0, 'Xỉu': 0 };
        patternStats[patternKey][currentSessionResult]++;
    }
    const lastSession = history[0];
    const currentP1 = lastSession.d1 % 2, currentP2 = lastSession.d2 % 2, currentP3 = lastSession.d3 % 2;
    const currentPatternKey = `${currentP1}-${currentP2}-${currentP3}`;
    if (patternStats[currentPatternKey]) {
        const stats = patternStats[currentPatternKey];
        const totalCount = stats['Tài'] + stats['Xỉu'];
        if (totalCount < 8) return null;
        const taiProb = stats['Tài'] / totalCount;
        const xiuProb = stats['Xỉu'] / totalCount;
        if (taiProb >= 0.65) return "Tài";
        if (xiuProb >= 0.65) return "Xỉu";
    }
    return null;
}

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
    const taiRatio = taiScore / totalScore;
    const xiuRatio = xiuScore / totalScore;
    if (taiRatio > xiuRatio + 0.10) return "Tài";
    if (xiuRatio > taiRatio + 0.10) return "Xỉu";
    return null;
}

function markovWeightedV3(patternArr) {
    if (patternArr.length < 3) return null;
    const transitions = {};
    const lastResult = patternArr[patternArr.length - 1];
    const secondLastResult = patternArr.length > 1 ? patternArr[patternArr.length - 2] : null;
    for (let i = 0; i < patternArr.length - 1; i++) {
        const current = patternArr[i];
        const next = patternArr[i + 1];
        const key = current + next;
        if (!transitions[key]) transitions[key] = { 'T': 0, 'X': 0 };
        if (i + 2 < patternArr.length) transitions[key][patternArr[i + 2]]++;
    }
    if (secondLastResult && lastResult) {
        const currentTransitionKey = secondLastResult + lastResult;
        if (transitions[currentTransitionKey]) {
            const stats = transitions[currentTransitionKey];
            const total = stats['T'] + stats['X'];
            if (total > 3) {
                if (stats['T'] / total > 0.60) return "Tài";
                if (stats['X'] / total > 0.60) return "Xỉu";
            }
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
        let isMatch = false;
        if (lastThree === sliceThree) isMatch = true;
        else if (lastFour === sliceFour) isMatch = true;
        if (isMatch && i + 4 < patternArr.length) {
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
    patternArr.forEach(result => {
        if (result === 'T') taiCount++; else xiuCount++;
    });
    const total = taiCount + xiuCount;
    if (total === 0) return null;
    const taiRatio = taiCount / total;
    const xiuRatio = xiuCount / total;
    if (taiRatio > 0.60) return "Tài";
    if (xiuRatio > 0.60) return "Xỉu";
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
        if (markovRes) {
            voteCounts[markovRes] += weight * 0.7;
            totalWeightSum += weight * 0.7;
        }
        const repeatRes = repeatingPatternV3(subPattern.slice().reverse());
        if (repeatRes) {
            voteCounts[repeatRes] += weight * 0.15;
            totalWeightSum += weight * 0.15;
        }
        const biasRes = detectBiasV3(subPattern);
        if (biasRes) {
            voteCounts[biasRes] += weight * 0.15;
            totalWeightSum += weight * 0.15;
        }
    }
    if (totalWeightSum === 0) return null;
    if (voteCounts.Tài > voteCounts.Xỉu * 1.08) return "Tài";
    if (voteCounts.Xỉu > voteCounts.Tài * 1.08) return "Xỉu";
    return null;
}

function predictLogic22(history) {
    if (history.length < 15) return null;
    const resultsOnly = history.map(s => s.result === 'Tài' ? 'T' : 'X');
    let taiVotes = 0, xiuVotes = 0, totalContributionWeight = 0;
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
                if (resultsOnly[i - 1]) {
                    if (resultsOnly[i - 1] === currentStreakResult) streakContinueCount++;
                    else streakBreakCount++;
                }
            }
        }
        const totalStreakOccurrences = streakBreakCount + streakContinueCount;
        if (totalStreakOccurrences > 5) {
            if (streakBreakCount / totalStreakOccurrences > 0.65) {
                if (currentStreakResult === 'T') xiuVotes += 1.5; else taiVotes += 1.5;
                totalContributionWeight += 1.5;
            } else if (streakContinueCount / totalStreakOccurrences > 0.65) {
                if (currentStreakResult === 'T') taiVotes += 1.5; else xiuVotes += 1.5;
                totalContributionWeight += 1.5;
            }
        }
    }
    if (history.length >= 4) {
        const lastFour = resultsOnly.slice(0, 4).join('');
        let patternMatches = 0, taiFollows = 0, xiuFollows = 0;
        const patternToMatch = lastFour.substring(0, 3);
        const searchLength = Math.min(resultsOnly.length, 150);
        for (let i = 0; i < searchLength - 3; i++) {
            const historicalPattern = resultsOnly.slice(i, i + 3).join('');
            if (historicalPattern === patternToMatch) {
                if (resultsOnly[i + 3] === 'T') taiFollows++;
                else xiuFollows++;
                patternMatches++;
            }
        }
        if (patternMatches > 4) {
            if (taiFollows / patternMatches > 0.70) { taiVotes += 1.2; totalContributionWeight += 1.2; }
            else if (xiuFollows / patternMatches > 0.70) { xiuVotes += 1.2; totalContributionWeight += 1.2; }
        }
    }
    if (totalContributionWeight === 0) return null;
    if (taiVotes > xiuVotes * 1.1) return "Tài";
    if (xiuVotes > taiVotes * 1.1) return "Xỉu";
    return null;
}

function predictLogic23(history) {
    if (history.length < 5) return null;
    const totals = history.map(s => s.totalScore);
    const allDice = history.slice(0, Math.min(history.length, 10)).flatMap(s => [s.d1, s.d2, s.d3]);
    const diceFreq = getDiceFrequencies(history, 10);
    const avg_total = totals.slice(0, Math.min(history.length, 10)).reduce((a, b) => a + b, 0) / Math.min(history.length, 10);
    const simplePredictions = [];
    if (history.length >= 2) {
        if ((totals[0] + totals[1]) % 2 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (avg_total > 10.5) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (diceFreq[4] + diceFreq[5] > diceFreq[1] + diceFreq[2]) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (history.filter(s => s.totalScore > 10).length > history.length / 2) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (history.length >= 3) {
        if (totals.slice(0, 3).reduce((a, b) => a + b, 0) > 33) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (history.length >= 5) {
        if (Math.max(...totals.slice(0, 5)) > 15) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (history.length >= 5) {
        if (totals.slice(0, 5).filter(t => t > 10).length >= 3) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (history.length >= 3) {
        if (totals.slice(0, 3).reduce((a, b) => a + b, 0) > 34) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (history.length >= 2) {
        if (totals[0] > 10 && totals[1] > 10) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if (totals[0] < 10 && totals[1] < 10) simplePredictions.push("Xỉu"); else simplePredictions.push("Tài");
    }
    if (history.length >= 1) {
        if ((totals[0] + diceFreq[3]) % 2 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if (diceFreq[2] > 3) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if ([11, 12, 13].includes(totals[0])) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (history.length >= 2) {
        if (totals[0] + totals[1] > 30) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (allDice.filter(d => d > 3).length > 7) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (history.length >= 1) {
        if (totals[0] % 2 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (allDice.filter(d => d > 3).length > 8) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    if (history.length >= 3) {
        if (totals.slice(0, 3).reduce((a, b) => a + b, 0) % 4 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if (totals.slice(0, 3).reduce((a, b) => a + b, 0) % 3 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (history.length >= 1) {
        if (totals[0] % 3 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if (totals[0] % 5 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if (totals[0] % 4 === 0) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    }
    if (diceFreq[4] > 2) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    let taiVotes = 0, xiuVotes = 0;
    simplePredictions.forEach(p => { if (p === "Tài") taiVotes++; else if (p === "Xỉu") xiuVotes++; });
    if (taiVotes > xiuVotes * 1.5) return "Tài";
    if (xiuVotes > taiVotes * 1.5) return "Xỉu";
    return null;
}

const PATTERN_DATA = {
    "ttxttx": { tai: 80, xiu: 20 }, "xxttxx": { tai: 25, xiu: 75 },
    "ttxxtt": { tai: 75, xiu: 25 }, "txtxt": { tai: 60, xiu: 40 },
    "xtxtx": { tai: 40, xiu: 60 }, "ttx": { tai: 70, xiu: 30 },
    "xxt": { tai: 30, xiu: 70 }, "txt": { tai: 65, xiu: 35 },
    "xtx": { tai: 35, xiu: 65 }, "tttt": { tai: 85, xiu: 15 },
    "xxxx": { tai: 15, xiu: 85 }, "ttttt": { tai: 88, xiu: 12 },
    "xxxxx": { tai: 12, xiu: 88 }, "tttttt": { tai: 92, xiu: 8 },
    "xxxxxx": { tai: 8, xiu: 92 }, "tttx": { tai: 75, xiu: 25 },
    "xxxt": { tai: 25, xiu: 75 }, "ttxtx": { tai: 78, xiu: 22 },
    "xxtxt": { tai: 22, xiu: 78 }, "txtxtx": { tai: 82, xiu: 18 },
    "xtxtxt": { tai: 18, xiu: 82 }, "ttxtxt": { tai: 85, xiu: 15 },
    "xxtxtx": { tai: 15, xiu: 85 }, "txtxxt": { tai: 83, xiu: 17 },
    "xtxttx": { tai: 17, xiu: 83 }, "ttttttt": { tai: 95, xiu: 5 },
    "xxxxxxx": { tai: 5, xiu: 95 }, "tttttttt": { tai: 97, xiu: 3 },
    "xxxxxxxx": { tai: 3, xiu: 97 }, "txtx": { tai: 60, xiu: 40 },
    "xtxt": { tai: 40, xiu: 60 }, "txtxt": { tai: 65, xiu: 35 },
    "xtxtx": { tai: 35, xiu: 65 }, "txtxtxt": { tai: 70, xiu: 30 },
    "xtxtxtx": { tai: 30, xiu: 70 }
};

function predictLogic24(history) {
    if (!history || history.length < 5) return null;
    const totals = history.map(s => s.totalScore);
    const allDice = history.flatMap(s => [s.d1, s.d2, s.d3]);
    const diceFreq = new Array(7).fill(0);
    allDice.forEach(d => { if (d >= 1 && d <= 6) diceFreq[d]++; });
    const avg_total = totals.slice(0, Math.min(history.length, 10)).reduce((a, b) => a + b, 0) / Math.min(history.length, 10);
    const votes = [];
    if (history.length >= 2) {
        if ((totals[0] + totals[1]) % 2 === 0) votes.push("Tài"); else votes.push("Xỉu");
    }
    if (avg_total > 10.5) votes.push("Tài"); else votes.push("Xỉu");
    if (diceFreq[4] + diceFreq[5] > diceFreq[1] + diceFreq[2]) votes.push("Tài"); else votes.push("Xỉu");
    if (history.filter(s => s.totalScore > 10).length > history.length / 2) votes.push("Tài"); else votes.push("Xỉu");
    if (history.length >= 3) {
        if (totals.slice(0, 3).reduce((a, b) => a + b, 0) > 33) votes.push("Tài"); else votes.push("Xỉu");
    }
    if (history.length >= 5) {
        if (Math.max(...totals.slice(0, 5)) > 15) votes.push("Tài"); else votes.push("Xỉu");
    }
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

function updateLogicPerformance(logicName, predicted, actual) {
    if (predicted === null || !logicPerformance[logicName]) return;
    const currentAcc = logicPerformance[logicName].accuracy;
    const currentTotal = logicPerformance[logicName].total;
    let dynamicDecayFactor = 0.95;
    if (currentTotal > 0 && currentAcc < 0.60) dynamicDecayFactor = 0.85;
    else if (currentTotal > 0 && currentAcc > 0.80) dynamicDecayFactor = 0.98;
    logicPerformance[logicName].correct = logicPerformance[logicName].correct * dynamicDecayFactor;
    logicPerformance[logicName].total = logicPerformance[logicName].total * dynamicDecayFactor;
    logicPerformance[logicName].total++;
    let wasCorrect = 0;
    if (predicted === actual) { logicPerformance[logicName].correct++; wasCorrect = 1; }
    logicPerformance[logicName].accuracy = logicPerformance[logicName].total > 0 ? (logicPerformance[logicName].correct / logicPerformance[logicName].total) : 0;
    const adaptiveAlphaConsistency = (currentAcc < 0.6) ? 0.3 : 0.1;
    logicPerformance[logicName].consistency = (logicPerformance[logicName].consistency * (1 - adaptiveAlphaConsistency)) + (wasCorrect * adaptiveAlphaConsistency);
    if (logicPerformance[logicName].total < 20 && logicPerformance[logicName].accuracy > 0.90) logicPerformance[logicName].accuracy = 0.90;
    else if (logicPerformance[logicName].total < 50 && logicPerformance[logicName].accuracy > 0.95) logicPerformance[logicName].accuracy = 0.95;
    logicPerformance[logicName].lastPredicted = predicted;
    logicPerformance[logicName].lastActual = actual;
}

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
        logic1: predictLogic1(lastSession, history),
        logic2: predictLogic2(nextSessionId, history),
        logic3: predictLogic3(history),
        logic4: predictLogic4(history),
        logic5: predictLogic5(history),
        logic6: predictLogic6(lastSession, history),
        logic7: predictLogic7(history),
        logic8: predictLogic8(history),
        logic9: predictLogic9(history),
        logic10: predictLogic10(history),
        logic11: predictLogic11(history),
        logic12: predictLogic12(lastSession, history),
        logic13: predictLogic13(history),
        logic14: predictLogic14(history),
        logic15: predictLogic15(history),
        logic16: predictLogic16(history),
        logic17: predictLogic17(history),
        logic18: predictLogic18(history),
        logic19: predictLogic19(history),
        logic21: predictLogic21(history),
        logic22: predictLogic22(history),
        logic23: predictLogic23(history),
        logic24: predictLogic24(history),
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
    const totalWeightedVotes = taiVotes + xiuVotes;
    if (totalWeightedVotes < 1.5) return null;
    if (taiVotes > xiuVotes * 1.08) return "Tài";
    if (xiuVotes > taiVotes * 1.08) return "Xỉu";
    return null;
}

async function fetchApi() {
    try {
        const res = await axios.get(API_URL, { timeout: 10000 });
        const data = res.data;
        if (!Array.isArray(data) || data.length === 0) return [];
        return data.map(item => ({
            session: parseInt(item.phien_hien_tai) || 0,
            sid: parseInt(item.phien_hien_tai) || 0,
            d1: parseInt(item.xuc_xac1) || 0,
            d2: parseInt(item.xuc_xac2) || 0,
            d3: parseInt(item.xuc_xac3) || 0,
            totalScore: parseInt(item.tong) || 0,
            result: item.ket_qua || '',
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error('Lỗi fetch API:', e.message);
        return [];
    }
}

async function updateHistory() {
    const data = await fetchApi();
    if (data.length === 0) return;
    let newEntry = null;
    for (const entry of data) {
        if (!seenSessions.has(entry.session) && entry.session > 0) {
            seenSessions.add(entry.session);
            history.unshift(entry);
            newEntry = entry;
            if (history.length > 1000) history = history.slice(0, 1000);
            console.log(`✅ Phiên mới: ${entry.session} | ${entry.result} | Tổng: ${entry.totalScore}`);
            break;
        }
    }
    if (newEntry && history.length >= 2) {
        const prevEntry = history[1];
        const predicted = currentPrediction.prediction;
        if (predicted !== 'Chờ dữ liệu' && predicted !== 'Chờ đủ 6 phiên') {
            const actual = newEntry.result;
            const logicNames = Object.keys(logicPerformance);
            for (const name of logicNames) {
                const childPred = getChildPrediction(name, history.slice(1));
                if (childPred) updateLogicPerformance(name, childPred, actual);
            }
            console.log(`🎯 Dự đoán: ${predicted} | Thực tế: ${actual} | Độ tin cậy: ${currentPrediction.confidenceText}`);
        }
    }
    saveData();
}

function getChildPrediction(name, history) {
    const lastSession = history[0];
    const nextSessionId = lastSession.sid + 1;
    switch (name) {
        case 'logic1': return predictLogic1(lastSession, history);
        case 'logic2': return predictLogic2(nextSessionId, history);
        case 'logic3': return predictLogic3(history);
        case 'logic4': return predictLogic4(history);
        case 'logic5': return predictLogic5(history);
        case 'logic6': return predictLogic6(lastSession, history);
        case 'logic7': return predictLogic7(history);
        case 'logic8': return predictLogic8(history);
        case 'logic9': return predictLogic9(history);
        case 'logic10': return predictLogic10(history);
        case 'logic11': return predictLogic11(history);
        case 'logic12': return predictLogic12(lastSession, history);
        case 'logic13': return predictLogic13(history);
        case 'logic14': return predictLogic14(history);
        case 'logic15': return predictLogic15(history);
        case 'logic16': return predictLogic16(history);
        case 'logic17': return predictLogic17(history);
        case 'logic18': return predictLogic18(history);
        case 'logic19': return predictLogic19(history);
        case 'logic21': return predictLogic21(history);
        case 'logic22': return predictLogic22(history);
        case 'logic23': return predictLogic23(history);
        case 'logic24': return predictLogic24(history);
        default: return null;
    }
}

async function generateAdvancedPrediction() {
    if (history.length < 6) {
        return { prediction: 'Chờ đủ 6 phiên', confidence: 0, confidenceText: 'N/A', details: { reason: 'Chưa đủ dữ liệu' } };
    }
    const oldPred = generatePrediction(history);
    const metaPred = await predictLogic20(history);
    let finalPrediction = oldPred.prediction;
    let finalConfidence = oldPred.confidence;
    let finalConfidenceText = oldPred.confidenceText;
    let reason = oldPred.details.reason;
    if (metaPred) {
        if (oldPred.confidence < 70) {
            finalPrediction = metaPred;
            finalConfidence = 75;
            finalConfidenceText = 'Cao (75%)';
            reason = `Dự đoán từ Meta-Logic (${metaPred}) do độ tin cậy của logic cũ thấp.`;
        } else {
            finalPrediction = metaPred;
            finalConfidence = (oldPred.confidence + 75) / 2;
            finalConfidenceText = `Trung bình (${Math.round(finalConfidence)}%)`;
            reason = `Kết hợp từ Meta-Logic và logic cũ.`;
        }
    }
    return {
        prediction: finalPrediction,
        confidence: Math.round(finalConfidence),
        confidenceText: finalConfidenceText,
        details: { reason, oldPred, metaPred }
    };
}

app.get('/', async (req, res) => {
    await updateHistory();
    currentPrediction = await generateAdvancedPrediction();
    const latestSessions = history.slice(0, 20).map(s => ({
        session: s.session,
        result: s.result,
        total: s.totalScore,
        dice: [s.d1, s.d2, s.d3]
    }));
    res.json({
        status: 'ok',
        lastUpdate: new Date().toISOString(),
        currentPrediction,
        recentHistory: latestSessions,
        totalSessions: history.length,
        logicPerformance: logicPerformance
    });
});

app.get('/sun', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({
        history: history.slice(0, limit),
        total: history.length
    });
});

app.get('/sun', async (req, res) => {
    await updateHistory();
    currentPrediction = await generateAdvancedPrediction();
    res.json(currentPrediction);
});

app.get('/sun', (req, res) => {
    res.json(logicPerformance);
});

setInterval(async () => {
    await updateHistory();
    currentPrediction = await generateAdvancedPrediction();
}, 5000);

app.listen(PORT, () => {
    console.log(`🚀 Tool dự đoán Sunwin chạy trên cổng ${PORT}`);
    console.log(`📡 API: ${API_URL}`);
    updateHistory().then(() => {
        generateAdvancedPrediction().then(pred => {
            currentPrediction = pred;
            console.log('✅ Khởi tạo xong, sẵn sàng dự đoán');
        });
    });
});