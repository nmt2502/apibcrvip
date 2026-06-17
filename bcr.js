const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// ================== DANH SÁCH BÀN ==================
const banThuong = Array.from({ length: 10 }, (_, i) =>
  `BAN${(i + 1).toString().padStart(2, '0')}`
);
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

    if (last10.length < 4) return { loaiCau: 'Không rõ', du_doan: null };

    if (last10.slice(-3).split('').every(v => v === last10.slice(-1))) {
        return { loaiCau: 'Cầu bệt', du_doan: last10.slice(-1) };
    }

    const last4 = last10.slice(-4);
    if (/^(PB){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'P' };
    if (/^(BP){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'B' };

    const P = (last10.match(/P/g) || []).length;
    const B = (last10.match(/B/g) || []).length;

    if (P >= B + 4) return { loaiCau: 'Cầu nghiêng Con', du_doan: 'P' };
    if (B >= P + 4) return { loaiCau: 'Cầu nghiêng Cái', du_doan: 'B' };

    return { loaiCau: 'Không rõ', du_doan: null };
}

// ================== ĐỘ TIN CẬY ==================
function tinhDoTinCay(ket_qua, loai_cau, du_doan) {
    const clean = ket_qua.replace(/[^PB]/g, '');
    const last10 = clean.slice(-10);

    let score = 50;

    if (loai_cau === 'Cầu bệt') score += 20;
    if (loai_cau === 'Cầu 1-1') score += 15;
    if (loai_cau.includes('nghiêng')) score += 10;

    const P = (last10.match(/P/g) || []).length;
    const B = (last10.match(/B/g) || []).length;

    if (du_doan === 'P' && P > B) score += 10;
    if (du_doan === 'B' && B > P) score += 10;

    if (last10.length < 6) score -= 15;

    return Math.max(30, Math.min(95, score));
}

// ================== FETCH + CACHE ==================
let cache = null;
let lastFetch = 0;

async function fetchAll() {
    if (cache && Date.now() - lastFetch < 3000) return cache;
    const res = await axios.get('https://lotus-resolved-shopzilla-acdbentity.trycloudflare.com/api/bcr');
    cache = res.data;
    lastFetch = Date.now();
    return cache;
}

// ================== CHUẨN HOÁ BÀN ==================
function normalizeBanId(str = '') {
    const s = str.toString().toUpperCase().trim();

    if (/^\d+$/.test(s)) return `BAN${s.padStart(2, '0')}`;
    if (/^C\d+$/.test(s.replace(/O/g, '0')))
        return s.replace(/O/g, '0').replace(/^C(\d)$/, 'C0$1');
    if (/^BAN\d+$/.test(s)) return s.replace(/^BAN(\d)$/, 'BAN0$1');

    return s.replace(/\s+/g, '');
}

// ================== LẤY 1 BÀN ==================
async function getBan(banId) {
    const all = await fetchAll();
    const banNorm = normalizeBanId(banId);

    const raw = all.find(item =>
        normalizeBanId(item.ban) === banNorm
    );

    if (!raw) {
        return { ban: banId, trang_thai: 'Không có dữ liệu' };
    }

    const ket_qua = raw.ket_qua || '';
    const cau = phatHienCau(ket_qua);
    const du_doan = cau.du_doan || duDoan10g1(ket_qua);
    const do_tin_cay = tinhDoTinCay(ket_qua, cau.loaiCau, du_doan);

    return {
        ban: raw.ban.toString(),   // ✅ ban gốc: "1", "10", "C01"
        ket_qua,
        loai_cau: cau.loaiCau,
        du_doan,
        do_tin_cay
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
    const danh_sach = {};
    for (const ban of banList) {
        danh_sach[ban] = await getBan(ban);
    }
    res.json({
        tong_ban: banList.length,
        danh_sach
    });
});

// ================== START ==================
app.listen(port, () => {
    console.log(`🚀 BCR API chạy tại port ${port}`);
});
