const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

class SunwinAnalyzer {
    constructor() {
        this.api = 'https://sunwin-ke-u8wn.onrender.com/sun';
        this.allSessions = [];
        this.lastFetchTime = 0;
        this.cacheDuration = 3000;
    }

    async fetchAllSessions() {
        const now = Date.now();
        if (now - this.lastFetchTime < this.cacheDuration && this.allSessions.length > 0) {
            return this.allSessions;
        }

        try {
            const res = await axios.get(this.api, { 
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            console.log('API Response:', JSON.stringify(res.data).substring(0, 500));
            
            let sessions = [];
            const data = res.data;
            
            if (Array.isArray(data)) {
                sessions = data;
            } else if (typeof data === 'object' && data !== null) {
                const possibleKeys = ['data', 'sessions', 'results', 'list', 'items', 'history', 'records', 'games'];
                for (const key of possibleKeys) {
                    if (data[key] && Array.isArray(data[key])) {
                        sessions = data[key];
                        break;
                    }
                }
                if (sessions.length === 0) {
                    for (const val of Object.values(data)) {
                        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                            sessions = val;
                            break;
                        }
                    }
                }
            }

            if (sessions.length === 0) {
                console.log('Không parse được sessions từ API, raw data:', typeof data);
                return [];
            }

            const processedSessions = sessions.map((s, index) => {
                let dices = [];
                if (s.dice1 !== undefined && s.dice2 !== undefined && s.dice3 !== undefined) {
                    dices = [s.dice1, s.dice2, s.dice3];
                } else if (s.xuc_xac && Array.isArray(s.xuc_xac)) {
                    dices = s.xuc_xac;
                } else if (s.dices && Array.isArray(s.dices)) {
                    dices = s.dices;
                } else if (s.dice && Array.isArray(s.dice)) {
                    dices = s.dice;
                }

                const total = s.total || s.tong || s.sum || s.tong_diem || 
                             (dices.length === 3 ? dices.reduce((a, b) => a + b, 0) : 0);

                let result;
                if (s.result || s.ket_qua) {
                    result = (s.result || s.ket_qua).toString();
                    if (result.includes('xỉu') || result.includes('Xỉu') || result.includes('xiu') || result.includes('XIU')) result = 'Xỉu';
                    else if (result.includes('tài') || result.includes('Tài') || result.includes('tai') || result.includes('TAI')) result = 'Tài';
                } else {
                    if (total >= 3 && total <= 10) result = 'Xỉu';
                    else if (total >= 11 && total <= 18) result = 'Tài';
                    else result = 'Unknown';
                }

                const sessionId = s.phanloai || s.phan_loai || s.session || s.id || s.ma_phien || s.round || String(index);

                return {
                    sessionId: String(sessionId),
                    dices: dices,
                    total: total,
                    result: result,
                    rawData: s
                };
            }).filter(s => s.result !== 'Unknown' && s.total >= 3 && s.total <= 18);

            const uniqueSessions = [];
            const seenIds = new Set();
            for (const s of processedSessions) {
                if (!seenIds.has(s.sessionId)) {
                    seenIds.add(s.sessionId);
                    uniqueSessions.push(s);
                }
            }

            uniqueSessions.sort((a, b) => {
                const aNum = parseInt(a.sessionId.replace(/\D/g, '')) || 0;
                const bNum = parseInt(b.sessionId.replace(/\D/g, '')) || 0;
                return aNum - bNum;
            });

            this.allSessions = uniqueSessions.slice(-20);
            this.lastFetchTime = now;
            
            console.log(`Parsed ${this.allSessions.length} sessions from API`);
            
            return this.allSessions;
        } catch (e) {
            console.error('Fetch error:', e.message);
            return this.allSessions.length > 0 ? this.allSessions : [];
        }
    }

    analyzeSequentialPattern(sessions) {
        if (sessions.length < 3) return null;
        
        const results = sessions.map(s => s.result);
        const last10 = results.slice(-10);
        
        const patterns = [];
        for (let i = 0; i < last10.length - 2; i++) {
            patterns.push(last10.slice(i, i + 3).join('-'));
        }
        
        const patternCount = {};
        patterns.forEach(p => {
            patternCount[p] = (patternCount[p] || 0) + 1;
        });
        
        const last2 = last10.slice(-2).join('-');
        const possibleNext = [];
        
        for (const [pattern, count] of Object.entries(patternCount)) {
            if (pattern.startsWith(last2)) {
                const nextResult = pattern.split('-')[2];
                possibleNext.push({ result: nextResult, weight: count });
            }
        }
        
        return possibleNext;
    }

    calculateStreakAnalysis(sessions) {
        const results = sessions.map(s => s.result);
        const lastResult = results[results.length - 1];
        
        let currentStreak = 0;
        for (let i = results.length - 1; i >= 0; i--) {
            if (results[i] === lastResult) currentStreak++;
            else break;
        }
        
        let alternateCount = 0;
        for (let i = results.length - 1; i >= 1; i--) {
            if (results[i] !== results[i - 1]) alternateCount++;
            else break;
        }
        
        return {
            currentStreak,
            lastResult,
            alternateCount,
            totalSessions: results.length
        };
    }

    calculateFrequencyDistribution(sessions) {
        const results = sessions.map(s => s.result);
        const last10 = results.slice(-10);
        const last20 = results.slice(-20);
        
        const freq10 = { 'Tài': 0, 'Xỉu': 0 };
        const freq20 = { 'Tài': 0, 'Xỉu': 0 };
        
        last10.forEach(r => { if (freq10[r] !== undefined) freq10[r]++; });
        last20.forEach(r => { if (freq20[r] !== undefined) freq20[r]++; });
        
        return {
            last10: { Tai: freq10['Tài'] / last10.length, Xiu: freq10['Xỉu'] / last10.length },
            last20: { Tai: freq20['Tài'] / last20.length, Xiu: freq20['Xỉu'] / last20.length },
            totalTai: freq20['Tài'],
            totalXiu: freq20['Xỉu']
        };
    }

    bayesianInference(priorTai, priorXiu, likelihoodTai, likelihoodXiu) {
        const evidence = (likelihoodTai * priorTai) + (likelihoodXiu * priorXiu);
        if (evidence === 0) return { Tai: 0.5, Xiu: 0.5 };
        
        const posteriorTai = (likelihoodTai * priorTai) / evidence;
        const posteriorXiu = (likelihoodXiu * priorXiu) / evidence;
        
        return { Tai: posteriorTai, Xiu: posteriorXiu };
    }

    predictNextSession(sessions) {
        if (sessions.length < 3) {
            return { prediction: 'Tài', winRate: 50, confidence: 'Thấp - Thiếu dữ liệu' };
        }

        const streak = this.calculateStreakAnalysis(sessions);
        const freq = this.calculateFrequencyDistribution(sessions);
        const patternMatches = this.analyzeSequentialPattern(sessions);

        let scoreTai = 0;
        let scoreXiu = 0;
        const totalWeight = 0;

        if (streak.currentStreak >= 5) {
            const reverseResult = streak.lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            if (reverseResult === 'Tài') scoreTai += 3.5;
            else scoreXiu += 3.5;
        } else if (streak.currentStreak >= 4) {
            const reverseResult = streak.lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            if (reverseResult === 'Tài') scoreTai += 2.5;
            else scoreXiu += 2.5;
        } else if (streak.currentStreak >= 3) {
            const reverseResult = streak.lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            if (reverseResult === 'Tài') scoreTai += 1.8;
            else scoreXiu += 1.8;
        } else if (streak.currentStreak >= 2) {
            const reverseResult = streak.lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            if (reverseResult === 'Tài') scoreTai += 1.2;
            else scoreXiu += 1.2;
        }

        if (streak.alternateCount >= 4) {
            const nextInAlternate = streak.lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            if (nextInAlternate === 'Tài') scoreTai += 2.0;
            else scoreXiu += 2.0;
        } else if (streak.alternateCount >= 3) {
            const nextInAlternate = streak.lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            if (nextInAlternate === 'Tài') scoreTai += 1.5;
            else scoreXiu += 1.5;
        }

        if (patternMatches && patternMatches.length > 0) {
            const bestPattern = patternMatches.reduce((a, b) => a.weight > b.weight ? a : b);
            if (bestPattern.result === 'Tài') scoreTai += bestPattern.weight * 0.8;
            else scoreXiu += bestPattern.weight * 0.8;
        }

        const imbalance10 = Math.abs(freq.last10.Tai - freq.last10.Xiu);
        if (imbalance10 > 0.3) {
            const minorityResult = freq.last10.Tai < freq.last10.Xiu ? 'Tài' : 'Xỉu';
            if (minorityResult === 'Tài') scoreTai += imbalance10 * 3;
            else scoreXiu += imbalance10 * 3;
        }

        const imbalance20 = Math.abs(freq.last20.Tai - freq.last20.Xiu);
        if (imbalance20 > 0.2) {
            const minorityResult = freq.last20.Tai < freq.last20.Xiu ? 'Tài' : 'Xỉu';
            if (minorityResult === 'Tài') scoreTai += imbalance20 * 2;
            else scoreXiu += imbalance20 * 2;
        }

        const priorTai = freq.last10.Tai * 0.6 + freq.last20.Tai * 0.4;
        const priorXiu = freq.last10.Xiu * 0.6 + freq.last20.Xiu * 0.4;

        const rawProbTai = scoreTai / (scoreTai + scoreXiu + 0.01);
        const rawProbXiu = scoreXiu / (scoreTai + scoreXiu + 0.01);

        const posterior = this.bayesianInference(priorTai, priorXiu, rawProbTai, rawProbXiu);

        let prediction;
        let winRate;
        if (posterior.Tai > posterior.Xiu) {
            prediction = 'Tài';
            winRate = Math.round(posterior.Tai * 100);
        } else if (posterior.Xiu > posterior.Tai) {
            prediction = 'Xỉu';
            winRate = Math.round(posterior.Xiu * 100);
        } else {
            prediction = scoreTai >= scoreXiu ? 'Tài' : 'Xỉu';
            winRate = 50;
        }

        winRate = Math.max(51, Math.min(winRate, 99));
        
        let confidence = 'Cao';
        const margin = Math.abs(posterior.Tai - posterior.Xiu);
        if (margin < 0.1) confidence = 'Thấp';
        else if (margin < 0.2) confidence = 'Trung bình';
        else if (margin < 0.35) confidence = 'Khá cao';
        else confidence = 'Rất cao';

        return { prediction, winRate, confidence, scoreTai, scoreXiu };
    }

    formatAllSessions(sessions) {
        let output = '';
        const displaySessions = sessions.slice(-10);
        
        for (let i = 0; i < displaySessions.length; i++) {
            const s = displaySessions[i];
            const dices = s.dices.length === 3 ? s.dices : ['?', '?', '?'];
            output += ` Phiên: ${s.sessionId}
 Xúc xắc: ${dices.join(' , ')}
 Tổng điểm: ${s.total}
 Kết quả: ${s.result}
------------------------------
`;
        }
        
        return output;
    }

    async analyze() {
        const sessions = await this.fetchAllSessions();
        
        if (sessions.length === 0) {
            return 'Đang chờ dữ liệu từ API...';
        }

        const lastSession = sessions[sessions.length - 1];
        const nextSessionId = String(parseInt(lastSession.sessionId.replace(/\D/g, '') || '0') + 1);
        
        const prediction = this.predictNextSession(sessions);
        
        let output = this.formatAllSessions(sessions);
        output += `   #PHIÊN: ${nextSessionId}
   Dự Đoán: ${prediction.prediction}
   Tỷ lệ win : ${prediction.winRate}%
   Độ tin cậy: ${prediction.confidence}
   admin : zundar`;

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
        console.error('Route error:', error);
        res.send('Lỗi hệ thống, đang thử lại...');
    }
});

app.get('/api', async (req, res) => {
    try {
        const result = await analyzer.analyze();
        res.json({ success: true, data: result, timestamp: Date.now() });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/debug', async (req, res) => {
    try {
        const sessions = await analyzer.fetchAllSessions();
        res.json({ count: sessions.length, sessions: sessions });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), sessions: analyzer.allSessions.length });
});

const server = app.listen(PORT, () => {
    console.log(`Sunwin Analyzer v2 running on port ${PORT}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

setInterval(async () => {
    try {
        await analyzer.fetchAllSessions();
        console.log(`Auto-fetch: ${analyzer.allSessions.length} sessions cached`);
    } catch (e) {
        console.error('Auto-fetch error:', e.message);
    }
}, 5000);

process.on('uncaughtException', (err) => {
    console.error('Uncaught:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('Rejection:', reason);
});
