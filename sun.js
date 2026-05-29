const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TOKEN = '8150531475:AAHqDl79_yG0t56A4f78Bs_LTu1ReOHoOpo';
const API_URL = 'https://sunwin-ke-u8wn.onrender.com/sun';
const ADMIN_ID = 7125723417;

const bot = new TelegramBot(TOKEN, { polling: true });

let chatIds = new Set();
let lastSessionId = null;
let isRunning = false;

class AdvancedTXAnalyzer {
    constructor() {
        this.weightMatrix = {
            cau_bet: 0.35,
            cau_lap: 0.25,
            cau_dao: 0.20,
            cau_nhay: 0.15,
            random_factor: 0.05
        };
    }

    extractFeatures(historyData) {
        if (historyData.length < 5) return null;
        const scores = [];
        const results = [];
        for (const item of historyData) {
            if (item.total !== undefined) scores.push(item.total);
            if (item.result) results.push(item.result);
        }
        return { scores, results };
    }

    analyzePatternStreak(results) {
        if (results.length < 3) return 0.5;
        const last10 = results.slice(-10);
        const taiCount = last10.filter(r => ['Tài', 'tai', 'TÀI'].includes(r)).length;
        const xiuCount = last10.filter(r => ['Xỉu', 'xiu', 'XỈU'].includes(r)).length;
        if (taiCount + xiuCount === 0) return 0.5;
        const taiRatio = taiCount / (taiCount + xiuCount);
        if (taiRatio >= 0.7) return 0.75;
        if (taiRatio <= 0.3) return 0.25;
        return 0.5;
    }

    analyzeScoreDistribution(scores) {
        if (scores.length < 5) return 0.5;
        const recent = scores.slice(-10);
        const mean = recent.reduce((a, b) => a + b) / recent.length;
        if (mean > 10.5) return 0.4;
        if (mean < 9.5) return 0.6;
        return 0.5;
    }

    detectCauBet(scores) {
        if (scores.length < 6) return null;
        const recent = scores.slice(-6);
        let alternating = true;
        for (let i = 0; i < recent.length - 1; i++) {
            if ((recent[i] > 10 && recent[i + 1] > 10) || (recent[i] <= 10 && recent[i + 1] <= 10)) {
                alternating = false;
                break;
            }
        }
        if (alternating) {
            const last = recent[recent.length - 1];
            return { prediction: last > 10 ? 'Xỉu' : 'Tài', confidence: 0.75 };
        }
        return null;
    }

    detectCauLap(scores) {
        if (scores.length < 6) return null;
        const recent = scores.slice(-5);
        const allTai = recent.every(s => s > 10);
        const allXiu = recent.every(s => s <= 10);
        if (allTai) return { prediction: 'Tài', confidence: 0.70 };
        if (allXiu) return { prediction: 'Xỉu', confidence: 0.70 };
        return null;
    }

    detectCauDao(scores) {
        if (scores.length < 8) return null;
        const recent = scores.slice(-8);
        for (let i = 2; i < recent.length - 4; i++) {
            const seq1 = recent.slice(i - 2, i + 1);
            const seq2 = recent.slice(i + 1, i + 4);
            if (seq2.length >= 3) {
                const match = seq1.every((val, idx) => (val > 10) === (seq2[idx] > 10));
                if (match && i + 4 < recent.length) {
                    return { prediction: recent[i + 4] > 10 ? 'Tài' : 'Xỉu', confidence: 0.68 };
                }
            }
        }
        return null;
    }

    detectCauNhay(scores) {
        if (scores.length < 4) return null;
        const recent = scores.slice(-4);
        const jumps = recent.slice(1).map((v, i) => Math.abs(v - recent[i]));
        const avgJump = jumps.reduce((a, b) => a + b) / jumps.length;
        if (avgJump > 5) {
            return { prediction: recent[recent.length - 1] > 10 ? 'Xỉu' : 'Tài', confidence: 0.62 };
        }
        return null;
    }

    markovChainPrediction(results) {
        if (results.length < 5) return null;
        const transitions = { 'Tài': { 'Tài': 0, 'Xỉu': 0 }, 'Xỉu': { 'Tài': 0, 'Xỉu': 0 } };
        for (let i = 0; i < results.length - 1; i++) {
            const cur = results[i];
            const next = results[i + 1];
            if (cur in transitions && next in transitions[cur]) {
                transitions[cur][next]++;
            }
        }
        const last = results[results.length - 1];
        if (!(last in transitions)) return null;
        const trans = transitions[last];
        const total = trans.Tài + trans.Xỉu;
        if (total === 0) return null;
        const taiProb = trans.Tài / total;
        return taiProb > 0.5 ? { prediction: 'Tài', confidence: Math.min(taiProb, 0.72) } : { prediction: 'Xỉu', confidence: Math.min(1 - taiProb, 0.72) };
    }

    bayesianUpdate(predictions) {
        if (predictions.length === 0) return { prediction: 'Tài', confidence: 0.5 };
        let priorTai = 0.5, priorXiu = 0.5;
        for (const { prediction, confidence } of predictions) {
            if (prediction === 'Tài') { priorTai *= confidence; priorXiu *= (1 - confidence); }
            else { priorXiu *= confidence; priorTai *= (1 - confidence); }
        }
        const total = priorTai + priorXiu;
        if (total === 0) return { prediction: 'Tài', confidence: 0.5 };
        return priorTai > priorXiu ? { prediction: 'Tài', confidence: priorTai / total } : { prediction: 'Xỉu', confidence: priorXiu / total };
    }

    finalPrediction(historyData) {
        const features = this.extractFeatures(historyData);
        if (!features) return { prediction: 'Tài', winRate: 50 };
        const { scores, results } = features;
        const predictions = [];
        const cauBet = this.detectCauBet(scores); if (cauBet) predictions.push(cauBet);
        const cauLap = this.detectCauLap(scores); if (cauLap) predictions.push(cauLap);
        const cauDao = this.detectCauDao(scores); if (cauDao) predictions.push(cauDao);
        const cauNhay = this.detectCauNhay(scores); if (cauNhay) predictions.push(cauNhay);
        const markov = this.markovChainPrediction(results); if (markov) predictions.push(markov);
        if (predictions.length === 0) {
            const prob = this.analyzeScoreDistribution(scores);
            predictions.push(prob > 0.5 ? { prediction: 'Xỉu', confidence: prob } : { prediction: 'Tài', confidence: 1 - prob });
        }
        const finalResult = this.bayesianUpdate(predictions);
        let winRate = Math.round(finalResult.confidence * 100);
        return { prediction: finalResult.prediction, winRate: Math.max(55, Math.min(95, winRate)) };
    }
}

const analyzer = new AdvancedTXAnalyzer();

function parseSessionData(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        if (data.sessions) return data.sessions;
        if (data.dice) return [{ dice: data.dice, total: data.total, result: data.result, session_id: data.session_id }];
    }
    return [];
}

function formatMessage(oldSession, newSessionId, prediction, winRate) {
    const diceStr = (oldSession.dice || []).join(', ');
    const total = oldSession.total || 0;
    const result = oldSession.result || '';
    const oldSessionId = oldSession.session_id || '???';
    return `Phiên: ${oldSessionId}\nXúc xắc: ${diceStr}\nTổng điểm: ${total}\nKết quả: ${result}\n------------------------------\n#PHIÊN: ${newSessionId}\nDự Đoán: ${prediction}\nTỷ lệ win: ${winRate}%\nadmin: zundar🌊`;
}

async function fetchData() {
    try {
        const response = await axios.get(API_URL, { timeout: 10000 });
        return response.data;
    } catch (e) { return null; }
}

bot.onText(/\/chaybotsun/, async (msg) => {
    if (msg.chat.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Mày không có quyền.');
    if (isRunning) return bot.sendMessage(msg.chat.id, 'Bot đang chạy rồi.');
    isRunning = true;
    chatIds.add(msg.chat.id);
    lastSessionId = null;
    await bot.sendMessage(msg.chat.id, 'Bot bắt đầu phân tích Tài Xỉu.');
});

bot.onText(/\/stop/, async (msg) => {
    if (msg.chat.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, 'Mày không có quyền.');
    isRunning = false;
    chatIds.delete(msg.chat.id);
    await bot.sendMessage(msg.chat.id, 'Bot đã dừng.');
});

setInterval(async () => {
    if (!isRunning || chatIds.size === 0) return;
    const data = await fetchData();
    if (!data) return;
    const sessions = parseSessionData(data);
    if (sessions.length < 2) return;
    const oldSession = sessions[sessions.length - 2];
    const latestSession = sessions[sessions.length - 1];
    const latestSessionId = latestSession.session_id || '';
    if (latestSessionId === lastSessionId) return;
    lastSessionId = latestSessionId;
    const newSessionId = parseInt(oldSession.session_id || 0) + 1;
    const allSessionsExceptLatest = sessions.slice(0, -1);
    const { prediction, winRate } = analyzer.finalPrediction(allSessionsExceptLatest);
    const message = formatMessage(oldSession, newSessionId, prediction, winRate);
    for (const cid of chatIds) {
        try { await bot.sendMessage(cid, message); } catch (e) {}
    }
}, 3000);

console.log('SunWin Bot started...');
