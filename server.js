const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;
const API_URL = 'https://sun-dd.onrender.com/sun';

let history = [];
let seenSessions = new Set();

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

function smartBridgeBreak(history) {
    if (!history || history.length < 3) return { prediction: 0, breakProb: 0.0 };
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    const last20 = history.slice(-20).map(h => h.result);
    const lastScores = history.slice(-20).map(h => h.totalScore || 0);
    let breakProbability = breakProb;
    const avgScore = lastScores.reduce((sum, score) => sum + score, 0) / (lastScores.length || 1);
    const scoreDeviation = lastScores.reduce((sum, score) => sum + Math.abs(score - avgScore), 0) / (lastScores.length || 1);
    if (streak >= 6) breakProbability = Math.min(breakProbability + 0.15, 0.9);
    else if (streak >= 4 && scoreDeviation > 3) breakProbability = Math.min(breakProbability + 0.1, 0.85);
    else breakProbability = Math.max(breakProbability - 0.15, 0.15);
    let prediction = breakProbability > 0.65 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    return { prediction, breakProb: breakProbability };
}

function trendAndProb(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 5) return breakProb > 0.75 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return 0;
    const weights = last15.map((_, i) => Math.pow(1.2, i));
    const taiWeighted = weights.reduce((sum, w, i) => sum + (last15[i] === 'Tài' ? w : 0), 0);
    const xiuWeighted = weights.reduce((sum, w, i) => sum + (last15[i] === 'Xỉu' ? w : 0), 0);
    const totalWeight = taiWeighted + xiuWeighted;
    if (totalWeight > 0 && Math.abs(taiWeighted - xiuWeighted) / totalWeight >= 0.25) return taiWeighted > xiuWeighted ? 2 : 1;
    return last15[last15.length - 1] === 'Xỉu' ? 1 : 2;
}

function shortPattern(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 4) return breakProb > 0.75 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    const last8 = history.slice(-8).map(h => h.result);
    return last8[last8.length - 1] === 'Xỉu' ? 1 : 2;
}

function meanDeviation(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 4) return breakProb > 0.75 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    const last12 = history.slice(-12).map(h => h.result);
    const taiCount = last12.filter(r => r === 'Tài').length;
    const xiuCount = last12.length - taiCount;
    const deviation = Math.abs(taiCount - xiuCount) / last12.length;
    return deviation < 0.35 ? (last12[last12.length - 1] === 'Xỉu' ? 1 : 2) : (xiuCount > taiCount ? 1 : 2);
}

function recentSwitch(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreak(history);
    if (streak >= 4) return breakProb > 0.75 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    const last10 = history.slice(-10).map(h => h.result);
    return last10[last10.length - 1] === 'Xỉu' ? 1 : 2;
}

function generatePrediction(history) {
    if (!history || history.length < 6) return { prediction: 'Chờ đủ dữ liệu', confidence: 0 };
    
    const trendPred = trendAndProb(history);
    const shortPred = shortPattern(history);
    const meanPred = meanDeviation(history);
    const switchPred = recentSwitch(history);
    const bridgePred = smartBridgeBreak(history);
    
    let taiScore = 0, xiuScore = 0;
    if (trendPred === 1) taiScore += 0.2; else if (trendPred === 2) xiuScore += 0.2;
    if (shortPred === 1) taiScore += 0.2; else if (shortPred === 2) xiuScore += 0.2;
    if (meanPred === 1) taiScore += 0.25; else if (meanPred === 2) xiuScore += 0.25;
    if (switchPred === 1) taiScore += 0.2; else if (switchPred === 2) xiuScore += 0.2;
    if (bridgePred.prediction === 1) taiScore += 0.15; else if (bridgePred.prediction === 2) xiuScore += 0.15;
    
    const finalPrediction = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    const confidence = Math.round(Math.abs(taiScore - xiuScore) / (taiScore + xiuScore + 0.0001) * 100);
    
    return { prediction: finalPrediction, confidence };
}

async function fetchApi() {
    try {
        const res = await axios.get(API_URL, { timeout: 10000 });
        const data = res.data;
        if (!data || !Array.isArray(data.history) || data.history.length === 0) return [];
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

app.get('/', async (req, res) => {
    await updateHistory();
    
    let lastSession = history[0] || {};
    let currentSession = lastSession.session || 0;
    let predicted = { prediction: 'Chờ đủ dữ liệu', confidence: 0 };
    
    if (history.length >= 6) {
        predicted = generatePrediction(history);
    }
    
    let patternText = '[Đang kết nối...]';
    if (history.length >= 3) {
        const last3 = history.slice(0, 3).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('');
        patternText = last3;
    }
    
    const result = {
        phien_truoc: currentSession,
        xuc_xac1: lastSession.d1 || 0,
        xuc_xac2: lastSession.d2 || 0,
        xuc_xac3: lastSession.d3 || 0,
        tong: lastSession.totalScore || 0,
        ket_qua: lastSession.result || '',
        pattern: patternText,
        phien_hien_tai: currentSession + 1,
        du_doan: predicted.prediction,
        do_tin_cay: predicted.confidence
    };
    
    res.json(result);
});

setInterval(updateHistory, 3000);

app.listen(PORT, () => {
    console.log(`🚀 Tool dự đoán Sunwin chạy trên cổng ${PORT}`);
    updateHistory();
});
