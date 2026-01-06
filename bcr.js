const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// ================== DANH SÁCH BÀN ==================
// BAN01 → BAN10
const banThuong = Array.from({ length: 10 }, (_, i) =>
  `BAN${(i + 1).toString().padStart(2, '0')}`
);

// C01 → C16
const banC = Array.from({ length: 16 }, (_, i) =>
  `C${(i + 1).toString().padStart(2, '0')}`
);

const banList = [...banThuong, ...banC];

// ================== 10g1 ==================
function duDoan10g1(ket_qua) {
    const clean = ket_qua.replace(/[^PB]/g, '');
    const last10 = clean.slice(-10);
    let P = 0, B = 0;

    for (const c of last10) {
        if (c === 'P') P++;
        if (c === 'B') B++;
    }
    if (P > B) return 'P';
    if (B > P) return 'B';
    return last10.slice(-1) || null;
}

// ================== NHẬN DIỆN CẦU ==================
function phatHienCau(ket_qua) {
    const clean = ket_qua.replace(/[^PB]/g, '');
    const last10 = clean.slice(-10);

    if (last10.length < 4) return { loaiCau: 'Chưa đủ dữ liệu', du_doan: null };

    // Cầu bệt
    if (last10.slice(-3).split('').every(v => v === last10.slice(-1))) {
        return { loaiCau: 'Cầu bệt', du_doan: last10.slice(-1) };
    }

    // Cầu 1-1
    const last4 = last10.slice(-4);
    if (/^(PB){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'P' };
    if (/^(BP){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'B' };

    // Cầu nghiêng
    const P = (last10.match(/P/g) || []).length;
    const B = (last10.match(/B/g) || []).length;

    if (P >= B + 4) return { loaiCau: 'Cầu nghiêng Con', du_doan: 'P' };
    if (B >= P + 4) return { loaiCau: 'Cầu nghiêng Cái', du_doan: 'B' };

    return { loaiCau: 'Không rõ', du_doan: null };
}

// ================== FETCH + CACHE ==================
let cache = null;
let lastFetch = 0;

async function fetchAll() {
    if (cache && Date.now() - lastFetch < 3000) return cache;
    const res = await axios.get('https://bcrapj-9ska.onrender.com/sexy/all');
    cache = res.data;
    lastFetch = Date.now();
    return cache;
}

// ================== CHUẨN HOÁ TÊN BÀN ==================
function normalizeBanId(str = '') {
    return str
        .toUpperCase()
        .replace(/O/g, '0')                // CO2 → C02
        .replace(/\s+/g, '')              // BAN 01 → BAN01
        .replace(/^BAN(\d)$/, 'BAN0$1')   // BAN1 → BAN01
        .replace(/^C(\d)$/, 'C0$1')       // C1 → C01
        .trim();
}

// ================== LẤY 1 BÀN ==================
async function getBan(banId) {
    const all = await fetchAll();
    const banNorm = normalizeBanId(banId);

    const raw = all.find(item => {
        const apiBan = normalizeBanId(item.cấm || item.ban || '');
        return apiBan === banNorm;
    });

    if (!raw) {
        return {
            ban: banId,
            trang_thai: 'Không có dữ liệu'
        };
    }

    const ket_qua = raw.ket_qua || '';
    const cauApi = raw.cau || raw.cầu || null;

    const du10g1 = duDoan10g1(ket_qua);
    const cau = phatHienCau(ket_qua);

    return {
        ban: banId,
        ket_qua,
        cau_api: cauApi,
        loai_cau: cau.loaiCau,
        du_doan: cau.du_doan || du10g1,
        cap_nhat: raw['Thời gian']
    };
}

// ================== API TỪNG BÀN ==================
banList.forEach(ban => {
    app.get(`/api/${ban.toLowerCase()}`, async (req, res) => {
        res.json(await getBan(ban));
    });
});

// ================== API TẤT CẢ ==================
app.get('/api/ban', async (req, res) => {
    const result = {};
    for (const ban of banList) {
        result[ban] = await getBan(ban);
    }
    res.json(result);
});

// ================== API FULL BÀN ==================
app.get('/api/fullban', async (req, res) => {
    const result = {};
    for (const ban of banList) {
        result[ban] = await getBan(ban);
    }
    res.json({
        tong_ban: banList.length,
        danh_sach: result
    });
});

// ================== START SERVER ==================
app.listen(port, () => {
    console.log(`🚀 BCR API chạy tại port ${port}`);
});
