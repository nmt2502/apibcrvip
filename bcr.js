const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// Danh sách bàn C01 → C16
const banList = Array.from({ length: 16 }, (_, i) => `C${(i + 1).toString().padStart(2, '0')}`);

// --- 1. Thuật toán 10g1 ---
function duDoan10g1(ket_qua) {
    const last10 = ket_qua.slice(-10);
    let countP = 0;
    let countB = 0;
    for (const ch of last10) {
        if (ch === 'P') countP++;
        else if (ch === 'B') countB++;
    }
    if (countP > countB) return 'P';
    if (countB > countP) return 'B';
    return last10.slice(-1);
}

// --- 2. Hàm nhận diện cầu ---
function phatHienCau(ket_qua) {
    const last10 = ket_qua.slice(-10);

    // Cầu bệt
    if (last10.slice(-2).split('').every(c => c === last10.slice(-2)[0])) {
        return { loaiCau: 'Cầu bệt', du_doan: last10.slice(-1) };
    }

    // Cầu 1-1
    const last4 = last10.slice(-4);
    if (/^(PB){2}$/.test(last4) || /^(BP){2}$/.test(last4)) {
        return { loaiCau: 'Cầu 1-1', du_doan: last4[0] === 'P' ? 'B' : 'P' };
    }

    // Cầu nghiêng con / cái
    const countP = (last10.match(/P/g) || []).length;
    const countB = (last10.match(/B/g) || []).length;
    if (countP > countB + 3) return { loaiCau: 'Cầu nghiêng con', du_doan: 'P' };
    if (countB > countP + 3) return { loaiCau: 'Cầu nghiêng cái', du_doan: 'B' };

    return { loaiCau: 'Không rõ', du_doan: null };
}

// --- 3. Lấy dữ liệu từ API gốc ---
async function fetchBanData(banId) {
    try {
        const response = await axios.get(`https://predictbcr.onrender.com/api/${banId.toLowerCase()}`);
        const data = response.data;

        const du_doan_10g1 = duDoan10g1(data.ket_qua);
        const du_doan_pattern = data.du_doan;
        const cau = phatHienCau(data.ket_qua);

        // Dự đoán cuối cùng: ưu tiên pattern + 10g1 đồng thuận, nếu không thì dựa trên cầu
        let du_doan;
        if (du_doan_10g1 === du_doan_pattern) du_doan = du_doan_10g1;
        else if (cau.du_doan) du_doan = cau.du_doan;
        else du_doan = null;

        return {
            ban: data.ban,
            ket_qua: data.ket_qua,
            du_doan: du_doan,
            loai_cau: cau.loaiCau,
            do_tin_cay: Math.round(data.do_tin_cay * 100),
            cap_nhat: data.cap_nhat,
            thong_ke: { thang: 0, thua: 0 }
        };
    } catch (error) {
        console.error(`Lỗi lấy dữ liệu bàn ${banId}:`, error.message);
        return { error: `Không thể lấy dữ liệu bàn ${banId}` };
    }
}

// --- 4. Routes từng bàn ---
banList.forEach(banId => {
    app.get(`/api/${banId.toLowerCase()}`, async (req, res) => {
        const result = await fetchBanData(banId);
        res.json(result);
    });
});

// --- 5. Route tất cả bàn ---
app.get('/api/ban', async (req, res) => {
    const result = {};
    for (const ban of banList) {
        result[ban] = await fetchBanData(ban);
    }
    res.json(result);
});

// --- 6. Khởi động server ---
app.listen(port, () => {
    console.log(`Server API BCR đang chạy tại http://localhost:${port}`);
});
