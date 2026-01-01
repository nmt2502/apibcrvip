const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Danh sách bàn C01 → C16
const banList = Array.from({ length: 16 }, (_, i) => `C${(i + 1).toString().padStart(2, '0')}`);

// ================== 1. THUẬT TOÁN 10g1 ==================
function duDoan10g1(ket_qua) {
    const last10 = ket_qua.slice(-10);
    let P = 0, B = 0;
    for (const kq of last10) {
        if (kq === 'P') P++;
        if (kq === 'B') B++;
    }
    if (P > B) return 'P';
    if (B > P) return 'B';
    return last10.slice(-1);
}

// ================== 2. NHẬN DIỆN CẦU ==================
function phatHienCau(ket_qua) {
    const last10 = ket_qua.slice(-10);

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

    if (P >= B + 4) return { loaiCau: 'Cầu nghiêng con', du_doan: 'P' };
    if (B >= P + 4) return { loaiCau: 'Cầu nghiêng cái', du_doan: 'B' };

    return { loaiCau: 'Không rõ', du_doan: null };
}

// ================== 3. FETCH 1 LẦN – DÙNG CHUNG ==================
let cacheData = null;
let lastFetch = 0;

async function fetchAllData() {
    // cache 3s cho Render
    if (Date.now() - lastFetch < 3000 && cacheData) return cacheData;

    const res = await axios.get('https://bcrapj-9ska.onrender.com/sexy/all');
    cacheData = res.data;
    lastFetch = Date.now();
    return cacheData;
}

// ================== 4. XỬ LÝ 1 BÀN ==================
async function getBanData(banId) {
    try {
        const allData = await fetchAllData();
        const data = allData[banId];

        if (!data || !data.ket_qua) {
            return { ban: banId, trang_thai: 'Chưa có dữ liệu' };
        }

        const du10g1 = duDoan10g1(data.ket_qua);
        const cau = phatHienCau(data.ket_qua);
        const pattern = data.du_doan || null;

        let du_doan = null;
        if (pattern && pattern === du10g1) du_doan = pattern;
        else if (cau.du_doan) du_doan = cau.du_doan;

        return {
            ban: banId,
            ket_qua: data.ket_qua,
            du_doan,
            loai_cau: cau.loaiCau,
            do_tin_cay: Math.round((data.do_tin_cay || 0) * 100),
            cap_nhat: data.cap_nhat,
            thong_ke: data.thong_ke || { thang: 0, thua: 0 }
        };
    } catch (err) {
        return { ban: banId, error: 'Lỗi lấy dữ liệu' };
    }
}

// ================== 5. API TỪNG BÀN ==================
banList.forEach(banId => {
    app.get(`/api/${banId.toLowerCase()}`, async (req, res) => {
        res.json(await getBanData(banId));
    });
});

// ================== 6. API TẤT CẢ BÀN ==================
app.get('/api/ban', async (req, res) => {
    const result = {};
    for (const ban of banList) {
        result[ban] = await getBanData(ban);
    }
    res.json(result);
});

// ================== 7. START SERVER ==================
app.listen(port, () => {
    console.log(`🚀 API BCR chạy tại http://localhost:${port}`);
});
