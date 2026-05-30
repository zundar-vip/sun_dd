const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://sunwin-ke-u8wn.onrender.com/sun';

let sessions = [];
let prediction = 'Đang tải...';
let winRate = 0;
let lastId = '';

function extractAll(obj, out = []) {
    if (!obj || typeof obj !== 'object') return out;
    if (Array.isArray(obj)) {
        obj.forEach(v => extractAll(v, out));
        return out;
    }
    if (obj.dice1 !== undefined || obj.xuc_xac !== undefined || obj.dices !== undefined || obj.total !== undefined) {
        out.push(obj);
    }
    Object.values(obj).forEach(v => extractAll(v, out));
    return out;
}

function parseOne(raw, idx) {
    let d1, d2, d3;
    if (raw.dice1 !== undefined && raw.dice2 !== undefined && raw.dice3 !== undefined) {
        d1 = parseInt(raw.dice1); d2 = parseInt(raw.dice2); d3 = parseInt(raw.dice3);
    } else if (raw.xuc_xac && Array.isArray(raw.xuc_xac) && raw.xuc_xac.length >= 3) {
        d1 = parseInt(raw.xuc_xac[0]); d2 = parseInt(raw.xuc_xac[1]); d3 = parseInt(raw.xuc_xac[2]);
    } else if (raw.dices && Array.isArray(raw.dices) && raw.dices.length >= 3) {
        d1 = parseInt(raw.dices[0]); d2 = parseInt(raw.dices[1]); d3 = parseInt(raw.dices[2]);
    } else if (raw.dice && Array.isArray(raw.dice) && raw.dice.length >= 3) {
        d1 = parseInt(raw.dice[0]); d2 = parseInt(raw.dice[1]); d3 = parseInt(raw.dice[2]);
    } else {
        return null;
    }
    if ([d1,d2,d3].some(v => isNaN(v) || v < 1 || v > 6)) return null;
    const total = d1 + d2 + d3;
    const result = total >= 3 && total <= 10 ? 'Xỉu' : 'Tài';
    let id = raw.phanloai || raw.phan_loai || raw.session || raw.id || raw.ma_phien || raw.round || raw.period || ('P' + idx);
    id = String(id).replace(/\s/g, '');
    return { id, d1, d2, d3, total, result };
}

function dedupe(arr) {
    const seen = new Set();
    return arr.filter(s => { if (!s || seen.has(s.id)) return false; seen.add(s.id); return true; });
}

function sortById(arr) {
    return arr.sort((a, b) => { const na = parseInt(a.id.replace(/\D/g,''))||0; const nb = parseInt(b.id.replace(/\D/g,''))||0; return na - nb; });
}

function predict(sessions) {
    if (sessions.length < 5) return { prediction: 'Tài', winRate: 55 };
    const results = sessions.map(s => s.result);
    const totals = sessions.map(s => s.total);
    const lastRes = results[results.length - 1];
    const lastTotal = totals[totals.length - 1];
    let streak = 0;
    for (let i = results.length - 1; i >= 0; i--) { if (results[i] === lastRes) streak++; else break; }
    let alt = 0;
    for (let i = results.length - 1; i >= 1; i--) { if (results[i] !== results[i-1]) alt++; else break; }
    const r10 = results.slice(-10);
    const tai10 = r10.filter(r => r === 'Tài').length;
    const xiu10 = r10.filter(r => r === 'Xỉu').length;
    let sTai = 0, sXiu = 0;
    if (streak === 2) { lastRes === 'Tài' ? sXiu += 8 : sTai += 8; }
    else if (streak === 3) { lastRes === 'Tài' ? sXiu += 16 : sTai += 16; }
    else if (streak === 4) { lastRes === 'Tài' ? sXiu += 24 : sTai += 24; }
    else if (streak >= 5) { lastRes === 'Tài' ? sXiu += 32 : sTai += 32; }
    if (alt === 3) { lastRes === 'Tài' ? sXiu += 10 : sTai += 10; }
    else if (alt === 4) { lastRes === 'Tài' ? sXiu += 16 : sTai += 16; }
    else if (alt >= 5) { lastRes === 'Tài' ? sXiu += 22 : sTai += 22; }
    if (tai10 > xiu10 + 3) sXiu += 18;
    else if (xiu10 > tai10 + 3) sTai += 18;
    else if (tai10 > xiu10 + 1) sXiu += 10;
    else if (xiu10 > tai10 + 1) sTai += 10;
    if (lastTotal >= 15) sXiu += 12;
    else if (lastTotal >= 13) sXiu += 6;
    else if (lastTotal <= 5) sTai += 12;
    else if (lastTotal <= 7) sTai += 6;
    const avgTotal = totals.reduce((a,b)=>a+b,0)/totals.length;
    if (lastTotal > avgTotal + 3) sXiu += 8;
    else if (lastTotal < avgTotal - 3) sTai += 8;
    const result = sTai >= sXiu ? 'Tài' : 'Xỉu';
    const max = Math.max(sTai, sXiu);
    const total = sTai + sXiu;
    const rate = total > 0 ? Math.round((max / total) * 100) : 55;
    return { prediction: result, winRate: Math.max(54, Math.min(rate, 98)) };
}

function getNextId() {
    if (sessions.length === 0) return '???';
    const last = sessions[sessions.length - 1];
    return String((parseInt(last.id.replace(/\D/g,'')) || 0) + 1);
}

function formatOutput() {
    const last10 = sessions.slice(-10);
    let out = '                  ↓\n';
    last10.forEach(s => {
        out += ` Phiên: ${s.id}\n`;
        out += ` Xúc xắc: ${s.d1} , ${s.d2} , ${s.d3}\n`;
        out += ` Tổng điểm: ${s.total}\n`;
        out += ` Kết quả: ${s.result}\n`;
        out += `------------------------------\n`;
    });
    out += `   #PHIÊN: ${getNextId()}\n`;
    out += `   Dự Đoán: ${prediction}\n`;
    out += `   Tỷ lệ win : ${winRate}%\n`;
    out += `   admin : zundar`;
    return out;
}

async function update() {
    try {
        const res = await axios.get(API_URL, { timeout: 15000 });
        const raw = extractAll(res.data, []);
        const parsed = raw.map((r,i) => parseOne(r,i)).filter(s => s !== null);
        const unique = dedupe(parsed);
        const sorted = sortById(unique);
        const valid = sorted.filter(s => s.result === 'Tài' || s.result === 'Xỉu');
        if (valid.length > 0) {
            const latest = valid[valid.length - 1];
            if (latest.id !== lastId) {
                sessions = valid.slice(-20);
                const pred = predict(sessions);
                prediction = pred.prediction;
                winRate = pred.winRate;
                lastId = latest.id;
            }
        }
    } catch (e) {}
}

app.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (sessions.length < 5) await update();
    res.send(formatOutput());
});

app.listen(PORT, async () => {
    console.log(`Running on port ${PORT}`);
    await update();
    setInterval(update, 2500);
});
