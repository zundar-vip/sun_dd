const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const API_URL = 'https://sunwin-ke-u8wn.onrender.com/sun';
const CHECK_INTERVAL_MS = 3000;

let cachedSessions = [];
let lastPrediction = null;
let lastUpdateTime = null;
let previousLastSessionId = null;

function deepFindSessions(obj, found = []) {
    if (!obj || typeof obj !== 'object') return found;
    
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (typeof item === 'object' && item !== null) {
                const hasDice1 = item.dice1 !== undefined;
                const hasXucXac = item.xuc_xac !== undefined;
                const hasDices = item.dices !== undefined;
                const hasTotal = item.total !== undefined;
                
                if (hasDice1 || hasXucXac || hasDices || hasTotal) {
                    found.push(item);
                } else {
                    deepFindSessions(item, found);
                }
            }
        }
    } else if (typeof obj === 'object') {
        for (const val of Object.values(obj)) {
            deepFindSessions(val, found);
        }
    }
    return found;
}

function parseSession(s, index) {
    let d1, d2, d3;

    if (s.dice1 !== undefined && s.dice2 !== undefined && s.dice3 !== undefined) {
        d1 = parseInt(s.dice1);
        d2 = parseInt(s.dice2);
        d3 = parseInt(s.dice3);
    } else if (s.xuc_xac && Array.isArray(s.xuc_xac) && s.xuc_xac.length >= 3) {
        d1 = parseInt(s.xuc_xac[0]);
        d2 = parseInt(s.xuc_xac[1]);
        d3 = parseInt(s.xuc_xac[2]);
    } else if (s.dices && Array.isArray(s.dices) && s.dices.length >= 3) {
        d1 = parseInt(s.dices[0]);
        d2 = parseInt(s.dices[1]);
        d3 = parseInt(s.dices[2]);
    } else if (s.dice && Array.isArray(s.dice) && s.dice.length >= 3) {
        d1 = parseInt(s.dice[0]);
        d2 = parseInt(s.dice[1]);
        d3 = parseInt(s.dice[2]);
    } else {
        return null;
    }

    if (isNaN(d1) || isNaN(d2) || isNaN(d3)) return null;
    if (d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6 || d3 < 1 || d3 > 6) return null;

    const total = d1 + d2 + d3;
    const result = total <= 10 ? 'Xỉu' : 'Tài';

    let id = s.phanloai || s.phan_loai || s.session || s.id || s.ma_phien || s.round || s.period || ('p' + index);
    id = String(id).trim();

    return { id, d1, d2, d3, total, result };
}

async function fetchSessions() {
    try {
        const res = await axios.get(API_URL, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });

        const rawSessions = deepFindSessions(res.data, []);
        const parsed = rawSessions
            .map((s, i) => parseSession(s, i))
            .filter(s => s !== null);

        const seen = new Set();
        const unique = [];
        for (const s of parsed) {
            if (!seen.has(s.id)) {
                seen.add(s.id);
                unique.push(s);
            }
        }

        unique.sort((a, b) => {
            const aNum = parseInt(a.id.replace(/\D/g, '') || '0');
            const bNum = parseInt(b.id.replace(/\D/g, '') || '0');
            return aNum - bNum;
        });

        return unique.slice(-15);
    } catch (err) {
        console.error('Fetch error:', err.message);
        return cachedSessions.length > 0 ? cachedSessions : [];
    }
}

function predict(sessions) {
    if (sessions.length < 5) {
        return { prediction: 'Chờ thêm dữ liệu...', winRate: 50, confidence: 'Thấp' };
    }

    const results = sessions.map(s => s.result);
    const totals = sessions.map(s => s.total);
    const lastResult = results[results.length - 1];
    const lastTotal = totals[totals.length - 1];

    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === lastResult) streak++;
        else break;
    }

    let switchCount = 0;
    for (let i = results.length - 1; i >= 1; i--) {
        if (results[i] !== results[i - 1]) switchCount++;
        else break;
    }

    const last10 = results.slice(-10);
    const taiCount = last10.filter(r => r === 'Tài').length;
    const xiuCount = last10.filter(r => r === 'Xỉu').length;

    let scoreTai = 50;
    let scoreXiu = 50;

    if (streak >= 6) {
        if (lastResult === 'Tài') scoreXiu += 30;
        else scoreTai += 30;
    } else if (streak >= 5) {
        if (lastResult === 'Tài') scoreXiu += 25;
        else scoreTai += 25;
    } else if (streak >= 4) {
        if (lastResult === 'Tài') scoreXiu += 20;
        else scoreTai += 20;
    } else if (streak >= 3) {
        if (lastResult === 'Tài') scoreXiu += 14;
        else scoreTai += 14;
    } else if (streak >= 2) {
        if (lastResult === 'Tài') scoreXiu += 8;
        else scoreTai += 8;
    }

    if (switchCount >= 5) {
        if (lastResult === 'Tài') scoreXiu += 18;
        else scoreTai += 18;
    } else if (switchCount >= 4) {
        if (lastResult === 'Tài') scoreXiu += 14;
        else scoreTai += 14;
    } else if (switchCount >= 3) {
        if (lastResult === 'Tài') scoreXiu += 10;
        else scoreTai += 10;
    }

    if (taiCount > xiuCount + 3) scoreXiu += 18;
    else if (xiuCount > taiCount + 3) scoreTai += 18;
    else if (taiCount > xiuCount + 1) scoreXiu += 10;
    else if (xiuCount > taiCount + 1) scoreTai += 10;

    if (lastTotal >= 15) scoreXiu += 10;
    else if (lastTotal >= 13) scoreXiu += 5;
    else if (lastTotal <= 5) scoreTai += 10;
    else if (lastTotal <= 7) scoreTai += 5;

    const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    if (lastTotal > avgTotal + 3) scoreXiu += 8;
    else if (lastTotal < avgTotal - 3) scoreTai += 8;

    const prediction = scoreTai >= scoreXiu ? 'Tài' : 'Xỉu';
    const maxScore = Math.max(scoreTai, scoreXiu);
    const totalScore = scoreTai + scoreXiu;
    const winRate = Math.round((maxScore / totalScore) * 100);

    let confidence = 'Thấp';
    const margin = Math.abs(scoreTai - scoreXiu);
    if (margin > 30) confidence = 'Rất cao';
    else if (margin > 20) confidence = 'Cao';
    else if (margin > 10) confidence = 'Khá';
    else if (margin > 5) confidence = 'Trung bình';

    return {
        prediction,
        winRate: Math.max(53, Math.min(winRate, 98)),
        confidence,
        streak,
        switchCount
    };
}

function getNextSessionId(sessions) {
    if (sessions.length === 0) return '1';
    const lastId = sessions[sessions.length - 1].id;
    const num = parseInt(lastId.replace(/\D/g, '') || '0');
    return String(num + 1);
}

function formatOutput(sessions, prediction) {
    const last10 = sessions.slice(-10);
    const nextId = getNextSessionId(sessions);

    let out = '                  ↓\n';
    for (let i = 0; i < last10.length; i++) {
        const s = last10[i];
        out += ` Phiên: ${s.id}\n`;
        out += ` Xúc xắc: ${s.d1} , ${s.d2} , ${s.d3}\n`;
        out += ` Tổng điểm: ${s.total}\n`;
        out += ` Kết quả: ${s.result}\n`;
        out += `------------------------------\n`;
    }

    out += `   #PHIÊN: ${nextId}\n`;
    out += `   Dự Đoán: ${prediction.prediction}\n`;
    out += `   Tỷ lệ win : ${prediction.winRate}%\n`;
    out += `   admin : zundar`;

    return out;
}

async function updatePrediction() {
    const sessions = await fetchSessions();
    
    if (sessions.length === 0) return;

    const currentLastId = sessions[sessions.length - 1].id;
    const isNewSession = currentLastId !== previousLastSessionId;

    cachedSessions = sessions;

    if (isNewSession || !lastPrediction) {
        lastPrediction = predict(sessions);
        lastUpdateTime = new Date().toLocaleString('vi-VN');
        previousLastSessionId = currentLastId;
        console.log(`[${lastUpdateTime}] New prediction: ${lastPrediction.prediction} (${lastPrediction.winRate}%)`);
    }
}

function startAutoUpdate() {
    updatePrediction();
    setInterval(updatePrediction, CHECK_INTERVAL_MS);
}

app.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (!lastPrediction || cachedSessions.length === 0) {
        await updatePrediction();
    }

    if (!lastPrediction || cachedSessions.length === 0) {
        res.send('Đang tải dữ liệu... Refresh sau 3 giây.');
        return;
    }

    const output = formatOutput(cachedSessions, lastPrediction);
    const htmlOutput = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="3">
    <title>Sunwin Analyzer</title>
    <style>
        body { background: #000; color: #0f0; font-family: monospace; font-size: 16px; padding: 20px; white-space: pre; }
    </style>
</head>
<body>${output.replace(/\n/g, '<br>')}<br><br>Cập nhật lúc: ${lastUpdateTime}</body>
</html>`;

    res.send(htmlOutput);
});

app.get('/raw', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!lastPrediction || cachedSessions.length === 0) {
        res.send('Chưa có dữ liệu.');
        return;
    }
    res.send(formatOutput(cachedSessions, lastPrediction));
});

app.get('/json', (req, res) => {
    res.json({
        sessions: cachedSessions.slice(-10),
        prediction: lastPrediction,
        nextSession: getNextSessionId(cachedSessions),
        lastUpdate: lastUpdateTime,
        admin: 'zundar'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        ok: true, 
        sessionsCached: cachedSessions.length,
        hasPrediction: lastPrediction !== null,
        lastUpdate: lastUpdateTime
    });
});

app.listen(PORT, () => {
    console.log(`Tai Xiu Auto Predict running on port ${PORT}`);
    startAutoUpdate();
});
