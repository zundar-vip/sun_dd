const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

let sessionHistory = [];
let predictionCache = {};

class SunwinAnalyzer {
    constructor() {
        this.api = 'https://sunwin-ke-u8wn.onrender.com/sun';
        this.markovMatrix = {};
        this.patternWindow = 10;
    }

    async fetchLatestSession() {
        try {
            const res = await axios.get(this.api, { timeout: 10000 });
            return res.data;
        } catch (e) {
            return null;
        }
    }

    extractDiceValues(session) {
        const dices = [];
        if (session.dice1) dices.push(session.dice1);
        if (session.dice2) dices.push(session.dice2);
        if (session.dice3) dices.push(session.dice3);
        if (session.xuc_xac && Array.isArray(session.xuc_xac)) return session.xuc_xac;
        if (session.dices && Array.isArray(session.dices)) return session.dices;
        return dices.length === 3 ? dices : [];
    }

    determineResult(total) {
        if (total >= 3 && total <= 10) return 'Xỉu';
        if (total >= 11 && total <= 18) return 'Tài';
        return 'Unknown';
    }

    updateMarkovChain(history) {
        if (history.length < 2) return;
        const lastResult = history[history.length - 1].result;
        const prevResult = history[history.length - 2].result;
        if (!this.markovMatrix[prevResult]) this.markovMatrix[prevResult] = {};
        if (!this.markovMatrix[prevResult][lastResult]) this.markovMatrix[prevResult][lastResult] = 0;
        this.markovMatrix[prevResult][lastResult]++;
    }

    calculateTransitionProbability(currentResult) {
        if (!this.markovMatrix[currentResult]) return { Tai: 0.5, Xiu: 0.5 };
        const transitions = this.markovMatrix[currentResult];
        const total = Object.values(transitions).reduce((a, b) => a + b, 0);
        if (total === 0) return { Tai: 0.5, Xiu: 0.5 };
        const probs = {};
        for (const [key, val] of Object.entries(transitions)) {
            probs[key] = val / total;
        }
        if (!probs['Tài']) probs['Tài'] = 0;
        if (!probs['Xỉu']) probs['Xỉu'] = 0;
        return probs;
    }

    analyzePattern(history) {
        if (history.length < 3) return { Tai: 0.5, Xiu: 0.5 };
        let streakCount = 0;
        const lastResult = history[history.length - 1].result;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].result === lastResult) streakCount++;
            else break;
        }
        let patternProb = {};
        if (streakCount >= 4) {
            patternProb[lastResult] = 0.25;
            patternProb[lastResult === 'Tài' ? 'Xỉu' : 'Tài'] = 0.75;
        } else if (streakCount >= 3) {
            patternProb[lastResult] = 0.35;
            patternProb[lastResult === 'Tài' ? 'Xỉu' : 'Tài'] = 0.65;
        } else if (streakCount >= 2) {
            patternProb[lastResult] = 0.45;
            patternProb[lastResult === 'Tài' ? 'Xỉu' : 'Tài'] = 0.55;
        } else {
            patternProb['Tài'] = 0.5;
            patternProb['Xỉu'] = 0.5;
        }
        return patternProb;
    }

    bayesianUpdate(prior, likelihood, totalProb) {
        return (likelihood * prior) / (totalProb > 0 ? totalProb : 1);
    }

    predictNextSession(history) {
        if (history.length < 2) {
            return { prediction: 'Tài', winRate: 50 };
        }

        const lastSession = history[history.length - 1];
        const currentResult = lastSession.result;

        const markovProbs = this.calculateTransitionProbability(currentResult);
        const patternProbs = this.analyzePattern(history);

        let totalTai = (markovProbs['Tài'] || 0) * 0.5 + (patternProbs['Tài'] || 0) * 0.5;
        let totalXiu = (markovProbs['Xỉu'] || 0) * 0.5 + (patternProbs['Xỉu'] || 0) * 0.5;

        const sum = totalTai + totalXiu;
        totalTai = totalTai / (sum > 0 ? sum : 1);
        totalXiu = totalXiu / (sum > 0 ? sum : 1);

        let prediction;
        let winRate;
        if (totalTai > totalXiu) {
            prediction = 'Tài';
            winRate = Math.round(totalTai * 100);
        } else if (totalXiu > totalTai) {
            prediction = 'Xỉu';
            winRate = Math.round(totalXiu * 100);
        } else {
            prediction = Math.random() > 0.5 ? 'Tài' : 'Xỉu';
            winRate = 50;
        }

        return { prediction, winRate: Math.min(winRate, 99) };
    }

    formatOutput(latestSessions, prediction) {
        const lastSession = latestSessions[latestSessions.length - 1];
        const dices = this.extractDiceValues(lastSession);
        const total = lastSession.total || (Array.isArray(dices) ? dices.reduce((a, b) => a + b, 0) : 0);
        const result = this.determineResult(total);
        const phiendu = lastSession.phanloai || lastSession.phan_loai || lastSession.session || 'Unknown';
        const nextSession = String(parseInt(phiendu) + 1);

        let output = `                  ↓
 Phiên: ${phiendu}
 Xúc xắc: ${dices.join(' , ')}
 Tổng điểm: ${total}
 Kết quả: ${result}
----------------------------- 
#PHIÊN: ${nextSession}
Dự Đoán: ${prediction.prediction}
Tỷ lệ win : ${prediction.winRate}%
admin : zundar`;

        return output;
    }

    async analyze() {
        const data = await this.fetchLatestSession();
        if (!data) return 'Không thể kết nối API';

        let sessionData;
        if (Array.isArray(data)) {
            sessionData = data;
        } else if (data.data && Array.isArray(data.data)) {
            sessionData = data.data;
        } else if (data.sessions && Array.isArray(data.sessions)) {
            sessionData = data.sessions;
        } else if (data.results && Array.isArray(data.results)) {
            sessionData = data.results;
        } else {
            sessionData = [data];
        }

        const processedSessions = sessionData.map(s => {
            const dices = this.extractDiceValues(s);
            const total = s.total || (dices.length === 3 ? dices.reduce((a, b) => a + b, 0) : 0);
            const result = this.determineResult(total);
            return {
                ...s,
                dices: dices,
                total: total,
                result: result
            };
        }).filter(s => s.result !== 'Unknown');

        if (processedSessions.length === 0) return 'Không có dữ liệu phiên';

        const sortedSessions = processedSessions.sort((a, b) => {
            const aId = parseInt(a.phanloai || a.phan_loai || a.session || '0');
            const bId = parseInt(b.phanloai || b.phan_loai || b.session || '0');
            return aId - bId;
        });

        sessionHistory = [...sessionHistory.slice(-100), ...sortedSessions];
        const uniqueHistory = [];
        const seenIds = new Set();
        for (const s of sessionHistory) {
            const id = s.phanloai || s.phan_loai || s.session || '';
            if (!seenIds.has(id)) {
                seenIds.add(id);
                uniqueHistory.push(s);
            }
        }
        sessionHistory = uniqueHistory.slice(-50);

        this.updateMarkovChain(sessionHistory);
        const prediction = this.predictNextSession(sessionHistory);
        const output = this.formatOutput(sessionHistory, prediction);

        predictionCache = {
            timestamp: Date.now(),
            output: output,
            prediction: prediction
        };

        return output;
    }
}

const analyzer = new SunwinAnalyzer();

app.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    try {
        const result = await analyzer.analyze();
        res.send(result);
    } catch (error) {
        res.send('Lỗi phân tích, thử lại sau');
    }
});

app.get('/api', async (req, res) => {
    try {
        const result = await analyzer.analyze();
        res.json({ success: true, data: result, timestamp: Date.now() });
    } catch (error) {
        res.json({ success: false, error: 'Lỗi phân tích' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const server = app.listen(PORT, () => {
    console.log(`Sunwin Analyzer running on port ${PORT}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
