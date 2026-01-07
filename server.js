const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { poolPromise, sql } = require('./db.config');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CHO PHÉP TẤT CẢ DOMAIN (dùng cho dev)
app.use(cors());
app.use(express.json());

// ================== HELPER FUNCTIONS ==================
// Lấy ID phân loại khách hàng mặc định (thành viên)
async function getDefaultCustomerTypeId() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`SELECT TOP 1 id FROM PHANLOAI_KH WHERE tenPLKH LIKE N'%thành viên%' OR tenPLKH LIKE N'%Thanh vien%' ORDER BY id`);

    if (result.recordset.length > 0) {
        return result.recordset[0].id;
    }

    // Nếu không có, lấy loại đầu tiên
    const firstResult = await pool.request()
        .query(`SELECT TOP 1 id FROM PHANLOAI_KH ORDER BY id`);

    return firstResult.recordset.length > 0 ? firstResult.recordset[0].id : null;
}

// Helper function để cập nhật phân loại cho TẤT CẢ khách hàng dựa trên tongchi
// DISABLE trigger trước khi UPDATE để tránh bị ghi đè
async function updateAllCustomerClassification() {
    console.log('[updateAllCustomerClassification] ===== BẮT ĐẦU CẬP NHẬT PHÂN LOẠI KHÁCH HÀNG =====');
    
    try {
        const pool = await poolPromise;
        
        // Bước 1: Liệt kê và DISABLE tất cả trigger trên bảng KHACHHANG
        const triggersResult = await pool.request()
            .query(`SELECT name FROM sys.triggers WHERE parent_id = OBJECT_ID('KHACHHANG')`);
        const triggers = triggersResult.recordset.map(t => t.name);
        console.log('[updateAllCustomerClassification] Các trigger trên KHACHHANG:', triggers);
        
        for (const triggerName of triggers) {
            await pool.request().query(`DISABLE TRIGGER ${triggerName} ON KHACHHANG`);
        }
        console.log('[updateAllCustomerClassification] Đã DISABLE tất cả trigger');
        
        // Bước 2: Cập nhật phân loại
        const result = await pool.request().query(`
            UPDATE KHACHHANG
            SET idPLKH = (
                SELECT TOP 1 pl.id
                FROM PHANLOAI_KH pl
                WHERE pl.nguongChiMin <= KHACHHANG.tongchi
                ORDER BY pl.nguongChiMin DESC
            )
            WHERE EXISTS (
                SELECT 1 
                FROM PHANLOAI_KH pl
                WHERE pl.nguongChiMin <= KHACHHANG.tongchi
            )
        `);
        
        const rowsAffected = result.rowsAffected[0] || 0;
        console.log(`[updateAllCustomerClassification] ✅ Đã cập nhật ${rowsAffected} khách hàng`);
        
        // Bước 3: ENABLE lại tất cả trigger
        for (const triggerName of triggers) {
            await pool.request().query(`ENABLE TRIGGER ${triggerName} ON KHACHHANG`);
        }
        console.log('[updateAllCustomerClassification] Đã ENABLE lại tất cả trigger');
        
        console.log('[updateAllCustomerClassification] ===== HOÀN TẤT =====');
        
        return rowsAffected;
    } catch (err) {
        console.error('[updateAllCustomerClassification] ❌ LỖI:', err.message);
        
        // Đảm bảo ENABLE lại trigger nếu có lỗi
        try {
            const pool = await poolPromise;
            await pool.request().query(`ENABLE TRIGGER ALL ON KHACHHANG`);
        } catch (e) {
            console.error('[updateAllCustomerClassification] Không thể ENABLE lại trigger:', e.message);
        }
        
        throw err;
    }
}


// Helper function để đăng ký font tiếng Việt cho PDF
function registerVietnameseFonts(doc) {
    const fontsDir = path.join(__dirname, 'fonts');
    const windowsFontsDir = process.platform === 'win32'
        ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
        : null;

    let vietnameseFont = 'Times-Roman';
    let vietnameseFontBold = 'Times-Bold';

    const fontFiles = {
        'NotoSans-Regular.ttf': 'NotoSans',
        'NotoSans-Bold.ttf': 'NotoSansBold',
        'Arial-Unicode-MS.ttf': 'ArialUnicode',
        'Times-New-Roman.ttf': 'TimesNewRoman'
    };

    const windowsFontFiles = {
        'arial.ttf': 'Arial',
        'arialbd.ttf': 'ArialBold',
        'times.ttf': 'TimesNewRoman',
        'timesbd.ttf': 'TimesNewRomanBold',
        'tahoma.ttf': 'Tahoma',
        'tahomabd.ttf': 'TahomaBold'
    };

    // Thử đăng ký font từ thư mục fonts
    for (const [filename, fontName] of Object.entries(fontFiles)) {
        const fontPath = path.join(fontsDir, filename);
        if (fs.existsSync(fontPath)) {
            try {
                doc.registerFont(fontName, fontPath);
                if (filename.includes('Regular') || filename.includes('Arial') || filename.includes('Times-New')) {
                    vietnameseFont = fontName;
                }
                if (filename.includes('Bold')) {
                    vietnameseFontBold = fontName;
                }
            } catch (e) {
                console.log(`Could not register font ${filename}:`, e.message);
            }
        }
    }

    // Thử đăng ký font từ Windows Fonts
    if (windowsFontsDir && fs.existsSync(windowsFontsDir) && vietnameseFont === 'Times-Roman') {
        const preferredFonts = ['arial.ttf', 'tahoma.ttf', 'times.ttf'];
        const preferredBoldFonts = ['arialbd.ttf', 'tahomabd.ttf', 'timesbd.ttf'];

        for (const preferredFont of preferredFonts) {
            if (windowsFontFiles[preferredFont]) {
                const fontPath = path.join(windowsFontsDir, preferredFont);
                if (fs.existsSync(fontPath)) {
                    try {
                        const fontName = windowsFontFiles[preferredFont];
                        doc.registerFont(fontName, fontPath);
                        vietnameseFont = fontName;
                        break;
                    } catch (e) {
                        console.log(`Could not register Windows font ${preferredFont}:`, e.message);
                    }
                }
            }
        }

        for (const preferredBoldFont of preferredBoldFonts) {
            if (windowsFontFiles[preferredBoldFont]) {
                const fontPath = path.join(windowsFontsDir, preferredBoldFont);
                if (fs.existsSync(fontPath)) {
                    try {
                        const fontName = windowsFontFiles[preferredBoldFont];
                        doc.registerFont(fontName, fontPath);
                        vietnameseFontBold = fontName;
                        break;
                    } catch (e) {
                        console.log(`Could not register Windows bold font ${preferredBoldFont}:`, e.message);
                    }
                }
            }
        }
    }

    return { vietnameseFont, vietnameseFontBold };
}

// Helper function để ghi lịch sử hoạt động
async function ghiLichSuHoatDong(idNV, loaiHoatDong, moTa, thamChieu = null, idThamChieu = null) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('idNV', sql.Int, idNV)
            .input('loaiHoatDong', sql.NVarChar(50), loaiHoatDong)
            .input('moTa', sql.NVarChar(500), moTa || null)
            .input('thamChieu', sql.NVarChar(50), thamChieu || null)
            .input('idThamChieu', sql.Int, idThamChieu || null)
            .query(`INSERT INTO LICHSU_HOATDONG (idNV, loaiHoatDong, moTa, thamChieu, idThamChieu) 
                    VALUES (@idNV, @loaiHoatDong, @moTa, @thamChieu, @idThamChieu)`);
    } catch (err) {
        // Không throw error để không ảnh hưởng đến flow chính
        console.error('Lỗi ghi lịch sử hoạt động:', err.message);
    }
}

// ================== LOGIN APIs ==================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username và password bắt buộc" });
    }

    try {
        const pool = await poolPromise;

        // Mã hóa password client gửi lên bằng SHA2_256 giống trong SQL
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex').toUpperCase();

        // Lấy user từ DB - Schema mới: USERS JOIN NHANVIEN để lấy maNV
        const userResult = await pool.request()
            .input('username', sql.NVarChar, username)
            .query(`SELECT u.userId, u.username, u.passwordHash, u.role, u.trangthai, n.maNV, n.id as idNV
                    FROM USERS u
                    LEFT JOIN NHANVIEN n ON u.idNV = n.id
                    WHERE u.username = @username`);

        if (userResult.recordset.length === 0) {
            return res.status(401).json({ message: 'Username hoặc password sai' });
        }

        const user = userResult.recordset[0];
        const storedHash = user.passwordHash;

        // So sánh hash (case-insensitive vì SQL Server có thể lưu khác nhau)
        const hashMatch = storedHash && (
            storedHash.toUpperCase() === passwordHash.toUpperCase() ||
            storedHash.toLowerCase() === passwordHash.toLowerCase()
        );

        if (!hashMatch) {
            console.log('Password hash mismatch:', {
                username,
                storedHash: storedHash,
                computedHash: passwordHash,
                storedLength: storedHash ? storedHash.length : 0,
                computedLength: passwordHash.length
            });
            return res.status(401).json({ message: 'Username hoặc password sai' });
        }

        // Kiểm tra trạng thái tài khoản
        if (user.trangthai === 0 || user.trangthai === false) {
            return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
        }

        // Trả về thông tin user và role để frontend điều hướng
        res.json({
            success: true,
            user: {
                userId: user.userId,
                username: user.username,
                role: user.role,
                maNV: user.maNV,
                idNV: user.idNV
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// ================== VITRI APIs ==================
// GET all
app.get('/api/vitri', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT id, tenVT FROM VITRI ORDER BY tenVT');

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu vị trí',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/vitri/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, tenVT FROM VITRI WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vị trí'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/vitri', async (req, res) => {
    const { tenVT } = req.body;
    if (!tenVT) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenVT'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('tenVT', sql.NVarChar(40), tenVT)
            .query('INSERT INTO VITRI (tenVT) OUTPUT INSERTED.id, INSERTED.tenVT VALUES (@tenVT)');

        res.status(201).json({
            success: true,
            message: 'Thêm vị trí thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm vị trí',
            error: err.message
        });
    }
});

// PUT
app.put('/api/vitri/:id', async (req, res) => {
    const { id } = req.params;
    const { tenVT } = req.body;
    if (!tenVT) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenVT'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('tenVT', sql.NVarChar(40), tenVT)
            .query('UPDATE VITRI SET tenVT = @tenVT WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vị trí'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật vị trí thành công',
            data: { id: parseInt(id), tenVT }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật vị trí',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/vitri/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM VITRI WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vị trí'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa vị trí thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa vị trí',
            error: err.message
        });
    }
});

// ================== PHANLOAI_KH APIs ==================
// GET all
app.get('/api/phanloaikh', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT id, maPLKH, tenPLKH, nguongChiMin FROM PHANLOAI_KH ORDER BY tenPLKH');

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu phân loại khách hàng',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/phanloaikh/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, maPLKH, tenPLKH, nguongChiMin FROM PHANLOAI_KH WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phân loại khách hàng'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/phanloaikh', async (req, res) => {
    const { maPLKH, tenPLKH, nguongChiMin } = req.body;
    if (!tenPLKH) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenPLKH'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('maPLKH', sql.NVarChar(10), maPLKH || null)
            .input('tenPLKH', sql.NVarChar(40), tenPLKH)
            .input('nguongChiMin', sql.Money, nguongChiMin || 0)
            .query('INSERT INTO PHANLOAI_KH (maPLKH, tenPLKH, nguongChiMin) OUTPUT INSERTED.id, INSERTED.maPLKH, INSERTED.tenPLKH, INSERTED.nguongChiMin VALUES (@maPLKH, @tenPLKH, @nguongChiMin)');

        res.status(201).json({
            success: true,
            message: 'Thêm phân loại khách hàng thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm phân loại khách hàng',
            error: err.message
        });
    }
});

// PUT
app.put('/api/phanloaikh/:id', async (req, res) => {
    const { id } = req.params;
    const { maPLKH, tenPLKH, nguongChiMin } = req.body;
    if (!tenPLKH) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenPLKH'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('maPLKH', sql.NVarChar(10), maPLKH || null)
            .input('tenPLKH', sql.NVarChar(40), tenPLKH)
            .input('nguongChiMin', sql.Money, nguongChiMin || 0)
            .query('UPDATE PHANLOAI_KH SET maPLKH = @maPLKH, tenPLKH = @tenPLKH, nguongChiMin = @nguongChiMin WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phân loại khách hàng'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật phân loại khách hàng thành công',
            data: { id: parseInt(id), maPLKH, tenPLKH, nguongChiMin }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật phân loại khách hàng',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/phanloaikh/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM PHANLOAI_KH WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phân loại khách hàng'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa phân loại khách hàng thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa phân loại khách hàng',
            error: err.message
        });
    }
});

// ================== PHANLOAI_SANPHAM APIs ==================
// GET all
app.get('/api/phanloaisanpham', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT id, maPLSP, tenPLSP FROM PHANLOAI_SANPHAM ORDER BY tenPLSP');

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu phân loại sản phẩm',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/phanloaisanpham/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, maPLSP, tenPLSP FROM PHANLOAI_SANPHAM WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phân loại sản phẩm'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/phanloaisanpham', async (req, res) => {
    const { maPLSP, tenPLSP } = req.body;
    if (!tenPLSP) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenPLSP'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('maPLSP', sql.NVarChar(10), maPLSP || null)
            .input('tenPLSP', sql.NVarChar(40), tenPLSP)
            .query('INSERT INTO PHANLOAI_SANPHAM (maPLSP, tenPLSP) OUTPUT INSERTED.id, INSERTED.maPLSP, INSERTED.tenPLSP VALUES (@maPLSP, @tenPLSP)');

        res.status(201).json({
            success: true,
            message: 'Thêm phân loại sản phẩm thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm phân loại sản phẩm',
            error: err.message
        });
    }
});

// PUT
app.put('/api/phanloaisanpham/:id', async (req, res) => {
    const { id } = req.params;
    const { maPLSP, tenPLSP } = req.body;
    if (!tenPLSP) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenPLSP'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('maPLSP', sql.NVarChar(10), maPLSP || null)
            .input('tenPLSP', sql.NVarChar(40), tenPLSP)
            .query('UPDATE PHANLOAI_SANPHAM SET maPLSP = @maPLSP, tenPLSP = @tenPLSP WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phân loại sản phẩm'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật phân loại sản phẩm thành công',
            data: { id: parseInt(id), maPLSP, tenPLSP }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật phân loại sản phẩm',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/phanloaisanpham/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM PHANLOAI_SANPHAM WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phân loại sản phẩm'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa phân loại sản phẩm thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa phân loại sản phẩm',
            error: err.message
        });
    }
});

// ================== KHUYENMAI APIs ==================
// GET all
app.get('/api/khuyenmai', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('SELECT id, maKM, tenKM, phantramGiam, ngayBD, ngayKT, trangthai FROM KHUYENMAI ORDER BY ngayBD DESC');

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu khuyến mãi',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/khuyenmai/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT id, maKM, tenKM, phantramGiam, ngayBD, ngayKT, trangthai FROM KHUYENMAI WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khuyến mãi'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/khuyenmai', async (req, res) => {
    const { maKM, tenKM, phantramGiam, ngayBD, ngayKT } = req.body;
    if (!maKM || phantramGiam === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: maKM, phantramGiam'
        });
    }
    if (phantramGiam < 0 || phantramGiam > 100) {
        return res.status(400).json({
            success: false,
            message: 'Phần trăm giảm giá phải từ 0 đến 100'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('maKM', sql.NVarChar(20), maKM)
            .input('tenKM', sql.NVarChar(100), tenKM || null)
            .input('phantramGiam', sql.Int, phantramGiam)
            .input('ngayBD', sql.Date, ngayBD || null)
            .input('ngayKT', sql.Date, ngayKT || null)
            .query('INSERT INTO KHUYENMAI (maKM, tenKM, phantramGiam, ngayBD, ngayKT) OUTPUT INSERTED.id, INSERTED.maKM, INSERTED.tenKM, INSERTED.phantramGiam, INSERTED.ngayBD, INSERTED.ngayKT, INSERTED.trangthai VALUES (@maKM, @tenKM, @phantramGiam, @ngayBD, @ngayKT)');

        res.status(201).json({
            success: true,
            message: 'Thêm khuyến mãi thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm khuyến mãi',
            error: err.message
        });
    }
});

// PUT
app.put('/api/khuyenmai/:id', async (req, res) => {
    const { id } = req.params;
    const { maKM, tenKM, phantramGiam, ngayBD, ngayKT } = req.body;
    if (!maKM || phantramGiam === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: maKM, phantramGiam'
        });
    }
    if (phantramGiam < 0 || phantramGiam > 100) {
        return res.status(400).json({
            success: false,
            message: 'Phần trăm giảm giá phải từ 0 đến 100'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('maKM', sql.NVarChar(20), maKM)
            .input('tenKM', sql.NVarChar(100), tenKM || null)
            .input('phantramGiam', sql.Int, phantramGiam)
            .input('ngayBD', sql.Date, ngayBD || null)
            .input('ngayKT', sql.Date, ngayKT || null)
            .query('UPDATE KHUYENMAI SET maKM = @maKM, tenKM = @tenKM, phantramGiam = @phantramGiam, ngayBD = @ngayBD, ngayKT = @ngayKT WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khuyến mãi'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật khuyến mãi thành công',
            data: { id: parseInt(id), maKM, tenKM, phantramGiam, ngayBD, ngayKT }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật khuyến mãi',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/khuyenmai/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;

        // Kiểm tra xem khuyến mãi có đang được sử dụng trong hóa đơn không
        const checkUsage = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(*) as count FROM HOADON WHERE idKM = @id');

        if (checkUsage.recordset[0].count > 0) {
            // Nếu đang được sử dụng, set NULL cho các hóa đơn thay vì xóa
            await pool.request()
                .input('id', sql.Int, id)
                .query('UPDATE HOADON SET idKM = NULL WHERE idKM = @id');
        }

        // Xóa khuyến mãi
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM KHUYENMAI WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khuyến mãi'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa khuyến mãi thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa khuyến mãi',
            error: err.message
        });
    }
});

// ================== NHANVIEN APIs ==================
// GET all
app.get('/api/nhanvien', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT n.id, n.maNV, n.tenNV, n.gioitinh, n.sdt, n.idVT, n.trangthai, v.tenVT
                    FROM NHANVIEN n
                    LEFT JOIN VITRI v ON n.idVT = v.id
                    ORDER BY n.tenNV`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu nhân viên',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/nhanvien/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT n.id, n.maNV, n.tenNV, n.gioitinh, n.sdt, n.idVT, n.trangthai, v.tenVT
                    FROM NHANVIEN n
                    LEFT JOIN VITRI v ON n.idVT = v.id
                    WHERE n.id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/nhanvien', async (req, res) => {
    const { tenNV, gioitinh, sdt, idVT } = req.body;
    if (!tenNV || !idVT) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: tenNV, idVT'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('tenNV', sql.NVarChar(40), tenNV)
            .input('gioitinh', sql.NVarChar(3), gioitinh || null)
            .input('sdt', sql.VarChar(10), sdt || null)
            .input('idVT', sql.Int, idVT)
            .query('INSERT INTO NHANVIEN (tenNV, gioitinh, sdt, idVT) OUTPUT INSERTED.id, INSERTED.maNV, INSERTED.tenNV, INSERTED.gioitinh, INSERTED.sdt, INSERTED.idVT, INSERTED.trangthai VALUES (@tenNV, @gioitinh, @sdt, @idVT)');

        res.status(201).json({
            success: true,
            message: 'Thêm nhân viên thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm nhân viên',
            error: err.message
        });
    }
});

// PUT
app.put('/api/nhanvien/:id', async (req, res) => {
    const { id } = req.params;
    const { tenNV, gioitinh, sdt, idVT } = req.body;
    if (!tenNV || !idVT) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: tenNV, idVT'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('tenNV', sql.NVarChar(40), tenNV)
            .input('gioitinh', sql.NVarChar(3), gioitinh || null)
            .input('sdt', sql.VarChar(10), sdt || null)
            .input('idVT', sql.Int, idVT)
            .query('UPDATE NHANVIEN SET tenNV = @tenNV, gioitinh = @gioitinh, sdt = @sdt, idVT = @idVT WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật nhân viên thành công',
            data: { id: parseInt(id), tenNV, gioitinh, sdt, idVT }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật nhân viên',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/nhanvien/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM NHANVIEN WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa nhân viên thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa nhân viên',
            error: err.message
        });
    }
});

// ================== KHACHHANG APIs ==================

// API cập nhật lại phân loại cho tất cả khách hàng (DISABLE trigger trước)
app.post('/api/khachhang/sync-phanloai', async (req, res) => {
    try {
        const pool = await poolPromise;
        
        // Bước 1: Liệt kê tất cả trigger trên bảng KHACHHANG
        const triggersResult = await pool.request()
            .query(`
                SELECT name 
                FROM sys.triggers 
                WHERE parent_id = OBJECT_ID('KHACHHANG')
            `);
        const triggers = triggersResult.recordset.map(t => t.name);
        console.log('[sync-phanloai] Các trigger trên bảng KHACHHANG:', triggers);
        
        // Bước 2: DISABLE tất cả trigger trên bảng KHACHHANG
        for (const triggerName of triggers) {
            await pool.request().query(`DISABLE TRIGGER ${triggerName} ON KHACHHANG`);
            console.log(`[sync-phanloai] Đã DISABLE trigger: ${triggerName}`);
        }
        
        // Bước 3: Cập nhật phân loại cho tất cả khách hàng
        const result = await pool.request()
            .query(`
                UPDATE KHACHHANG
                SET idPLKH = (
                    SELECT TOP 1 pl.id
                    FROM PHANLOAI_KH pl
                    WHERE pl.nguongChiMin <= KHACHHANG.tongchi
                    ORDER BY pl.nguongChiMin DESC
                )
                WHERE EXISTS (
                    SELECT 1 
                    FROM PHANLOAI_KH pl
                    WHERE pl.nguongChiMin <= KHACHHANG.tongchi
                )
            `);
        console.log(`[sync-phanloai] Đã cập nhật ${result.rowsAffected[0]} khách hàng`);
        
        // Bước 4: ENABLE lại tất cả trigger
        for (const triggerName of triggers) {
            await pool.request().query(`ENABLE TRIGGER ${triggerName} ON KHACHHANG`);
            console.log(`[sync-phanloai] Đã ENABLE trigger: ${triggerName}`);
        }
        
        // Bước 5: Lấy danh sách khách hàng sau khi cập nhật
        const customers = await pool.request()
            .query(`
                SELECT k.id, k.maKH, k.tenKH, k.tongchi, k.idPLKH, p.tenPLKH, p.nguongChiMin
                FROM KHACHHANG k
                LEFT JOIN PHANLOAI_KH p ON k.idPLKH = p.id
                ORDER BY k.tongchi DESC
            `);

        res.status(200).json({
            success: true,
            message: `Đã cập nhật phân loại cho ${result.rowsAffected[0]} khách hàng`,
            triggers: triggers,
            data: customers.recordset
        });
    } catch (err) {
        console.error('[sync-phanloai] Lỗi:', err.message);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật phân loại khách hàng',
            error: err.message
        });
    }
});

// GET all - Tự động cập nhật phân loại trước khi trả về
app.get('/api/khachhang', async (req, res) => {
    try {
        const pool = await poolPromise;
        
        // Cập nhật phân loại cho tất cả khách hàng trước khi trả về
        await updateAllCustomerClassification();
        
        const result = await pool.request()
            .query(`SELECT k.id, k.maKH, k.tenKH, k.sdt, k.diachi, k.idPLKH, k.diemtichluy, k.tongchi, p.tenPLKH
                    FROM KHACHHANG k
                    LEFT JOIN PHANLOAI_KH p ON k.idPLKH = p.id
                    ORDER BY k.tenKH`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu khách hàng',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/khachhang/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT k.id, k.maKH, k.tenKH, k.sdt, k.diachi, k.idPLKH, k.diemtichluy, k.tongchi, p.tenPLKH
                    FROM KHACHHANG k
                    LEFT JOIN PHANLOAI_KH p ON k.idPLKH = p.id
                    WHERE k.id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách hàng'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/khachhang', async (req, res) => {
    const { tenKH, sdt, diachi, idPLKH } = req.body;
    if (!tenKH) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenKH'
        });
    }
    try {
        const pool = await poolPromise;

        // Mặc định là thành viên nếu không có idPLKH
        let finalIdPLKH = idPLKH;
        if (!finalIdPLKH) {
            finalIdPLKH = await getDefaultCustomerTypeId();
            if (!finalIdPLKH) {
                return res.status(400).json({
                    success: false,
                    message: 'Không tìm thấy phân loại khách hàng mặc định'
                });
            }
        }

        const result = await pool.request()
            .input('tenKH', sql.NVarChar(40), tenKH)
            .input('sdt', sql.VarChar(10), sdt || null)
            .input('diachi', sql.NVarChar(100), diachi || null)
            .input('idPLKH', sql.Int, finalIdPLKH)
            .query('INSERT INTO KHACHHANG (tenKH, sdt, diachi, idPLKH) OUTPUT INSERTED.id, INSERTED.maKH, INSERTED.tenKH, INSERTED.sdt, INSERTED.diachi, INSERTED.idPLKH, INSERTED.diemtichluy, INSERTED.tongchi VALUES (@tenKH, @sdt, @diachi, @idPLKH)');

        res.status(201).json({
            success: true,
            message: 'Thêm khách hàng thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm khách hàng',
            error: err.message
        });
    }
});

// PUT
app.put('/api/khachhang/:id', async (req, res) => {
    const { id } = req.params;
    const { tenKH, sdt, diachi, idPLKH } = req.body;
    if (!tenKH || !idPLKH) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin tenKH hoặc idPLKH'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('tenKH', sql.NVarChar(40), tenKH)
            .input('sdt', sql.VarChar(10), sdt || null)
            .input('diachi', sql.NVarChar(100), diachi || null)
            .input('idPLKH', sql.Int, idPLKH)
            .query('UPDATE KHACHHANG SET tenKH = @tenKH, sdt = @sdt, diachi = @diachi, idPLKH = @idPLKH WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách hàng'
            });
        }

        // Lấy lại thông tin khách hàng sau khi cập nhật
        const updatedResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT k.id, k.maKH, k.tenKH, k.sdt, k.diachi, k.idPLKH, k.diemtichluy, k.tongchi, p.tenPLKH
                    FROM KHACHHANG k
                    LEFT JOIN PHANLOAI_KH p ON k.idPLKH = p.id
                    WHERE k.id = @id`);

        res.status(200).json({
            success: true,
            message: 'Cập nhật khách hàng thành công',
            data: updatedResult.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật khách hàng',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/khachhang/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM KHACHHANG WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy khách hàng'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa khách hàng thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa khách hàng',
            error: err.message
        });
    }
});

// ================== HANGHOA APIs ==================
// GET all
app.get('/api/hanghoa', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT h.id, h.maHang, h.tenHang, h.idPLSP, h.soluong, h.gianhap, h.giaban, h.tonKhoToiThieu, h.ngayNhapCuoi, p.tenPLSP
                    FROM HANGHOA h
                    LEFT JOIN PHANLOAI_SANPHAM p ON h.idPLSP = p.id
                    ORDER BY h.tenHang`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu hàng hóa',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/hanghoa/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT h.id, h.maHang, h.tenHang, h.idPLSP, h.soluong, h.gianhap, h.giaban, h.tonKhoToiThieu, h.ngayNhapCuoi, p.tenPLSP
                    FROM HANGHOA h
                    LEFT JOIN PHANLOAI_SANPHAM p ON h.idPLSP = p.id
                    WHERE h.id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hàng hóa'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/hanghoa', async (req, res) => {
    const { tenHang, idPLSP, soluong, gianhap, giaban, tonKhoToiThieu } = req.body;
    if (!tenHang || !idPLSP) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: tenHang, idPLSP'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('tenHang', sql.NVarChar(100), tenHang)
            .input('idPLSP', sql.Int, idPLSP)
            .input('soluong', sql.Int, soluong || 0)
            .input('gianhap', sql.Money, gianhap || null)
            .input('giaban', sql.Money, giaban || null)
            .input('tonKhoToiThieu', sql.Int, tonKhoToiThieu || 10)
            .query('INSERT INTO HANGHOA (tenHang, idPLSP, soluong, gianhap, giaban, tonKhoToiThieu) OUTPUT INSERTED.id, INSERTED.maHang, INSERTED.tenHang, INSERTED.idPLSP, INSERTED.soluong, INSERTED.gianhap, INSERTED.giaban, INSERTED.tonKhoToiThieu, INSERTED.ngayNhapCuoi VALUES (@tenHang, @idPLSP, @soluong, @gianhap, @giaban, @tonKhoToiThieu)');

        res.status(201).json({
            success: true,
            message: 'Thêm hàng hóa thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm hàng hóa',
            error: err.message
        });
    }
});

// PUT
app.put('/api/hanghoa/:id', async (req, res) => {
    const { id } = req.params;
    const { tenHang, idPLSP, soluong, gianhap, giaban, tonKhoToiThieu } = req.body;
    if (!tenHang || !idPLSP) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: tenHang, idPLSP'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('tenHang', sql.NVarChar(100), tenHang)
            .input('idPLSP', sql.Int, idPLSP)
            .input('soluong', sql.Int, soluong !== undefined ? soluong : null)
            .input('gianhap', sql.Money, gianhap || null)
            .input('giaban', sql.Money, giaban || null)
            .input('tonKhoToiThieu', sql.Int, tonKhoToiThieu || 10)
            .query('UPDATE HANGHOA SET tenHang = @tenHang, idPLSP = @idPLSP, soluong = COALESCE(@soluong, soluong), gianhap = @gianhap, giaban = @giaban, tonKhoToiThieu = @tonKhoToiThieu WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hàng hóa'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật hàng hóa thành công',
            data: { id: parseInt(id), tenHang, idPLSP, soluong, gianhap, giaban, tonKhoToiThieu }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật hàng hóa',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/hanghoa/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM HANGHOA WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hàng hóa'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa hàng hóa thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa hàng hóa',
            error: err.message
        });
    }
});

// ================== HOADON APIs ==================
// GET all
app.get('/api/hoadon', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT h.id, h.maHD, h.ngayLap, h.idNV, h.idKH, h.idKM, h.tongTien, h.loaiGiaoDich,
                    ISNULL(h.diemDaDung, 0) as diemDaDung,
                    nv.maNV, nv.tenNV as tenNhanVien,
                    kh.maKH, kh.tenKH as tenKhachHang,
                    km.maKM, km.tenKM as tenKhuyenMai, km.phantramGiam,
                    (SELECT ISNULL(SUM(thanhTien), 0) FROM CHITIET_HD WHERE idHD = h.id) as subtotal
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    LEFT JOIN KHACHHANG kh ON h.idKH = kh.id
                    LEFT JOIN KHUYENMAI km ON h.idKM = km.id
                    ORDER BY h.ngayLap DESC`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu hóa đơn',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/hoadon/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT h.id, h.maHD, h.ngayLap, h.idNV, h.idKH, h.idKM, h.tongTien, h.loaiGiaoDich,
                    nv.maNV, nv.tenNV as tenNhanVien,
                    kh.maKH, kh.tenKH as tenKhachHang,
                    km.maKM, km.tenKM as tenKhuyenMai, km.phantramGiam
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    LEFT JOIN KHACHHANG kh ON h.idKH = kh.id
                    LEFT JOIN KHUYENMAI km ON h.idKM = km.id
                    WHERE h.id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST
app.post('/api/hoadon', async (req, res) => {
    const { idNV, idKH, idKM, loaiGiaoDich, diemDaDung } = req.body;
    if (!idNV || !idKH) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: idNV, idKH'
        });
    }
    try {
        const pool = await poolPromise;

        // Nếu có điểm đã dùng, trừ điểm của khách hàng trước
        if (diemDaDung && diemDaDung > 0 && idKH) {
            const customerResult = await pool.request()
                .input('idKH', sql.Int, idKH)
                .query('SELECT diemtichluy FROM KHACHHANG WHERE id = @idKH');

            if (customerResult.recordset.length > 0) {
                const currentPoints = customerResult.recordset[0].diemtichluy || 0;
                if (currentPoints < diemDaDung) {
                    return res.status(400).json({
                        success: false,
                        message: `Khách hàng không đủ điểm. Hiện có: ${currentPoints}, yêu cầu: ${diemDaDung}`
                    });
                }

                // Trừ điểm
                await pool.request()
                    .input('idKH', sql.Int, idKH)
                    .input('diemDaDung', sql.Int, diemDaDung)
                    .query('UPDATE KHACHHANG SET diemtichluy = diemtichluy - @diemDaDung WHERE id = @idKH');
            }
        }

        // Tạo hóa đơn (lưu điểm đã dùng nếu có)
        // Note: Cần chạy ALTER TABLE HOADON ADD diemDaDung INT DEFAULT 0; trước
        let result;
        if (diemDaDung && diemDaDung > 0) {
            result = await pool.request()
                .input('idNV', sql.Int, idNV)
                .input('idKH', sql.Int, idKH)
                .input('idKM', sql.Int, idKM || null)
                .input('loaiGiaoDich', sql.NVarChar(20), loaiGiaoDich || 'Bán hàng')
                .input('diemDaDung', sql.Int, diemDaDung)
                .query(`INSERT INTO HOADON (idNV, idKH, idKM, loaiGiaoDich, diemDaDung) 
                        OUTPUT INSERTED.id, INSERTED.maHD, INSERTED.ngayLap, INSERTED.idNV, INSERTED.idKH, INSERTED.idKM, INSERTED.tongTien, INSERTED.loaiGiaoDich, INSERTED.diemDaDung 
                        VALUES (@idNV, @idKH, @idKM, @loaiGiaoDich, @diemDaDung)`);
        } else {
            result = await pool.request()
                .input('idNV', sql.Int, idNV)
                .input('idKH', sql.Int, idKH)
                .input('idKM', sql.Int, idKM || null)
                .input('loaiGiaoDich', sql.NVarChar(20), loaiGiaoDich || 'Bán hàng')
                .query(`INSERT INTO HOADON (idNV, idKH, idKM, loaiGiaoDich) 
                        OUTPUT INSERTED.id, INSERTED.maHD, INSERTED.ngayLap, INSERTED.idNV, INSERTED.idKH, INSERTED.idKM, INSERTED.tongTien, INSERTED.loaiGiaoDich 
                        VALUES (@idNV, @idKH, @idKM, @loaiGiaoDich)`);
        }

        const invoiceData = result.recordset[0];
        if (!invoiceData.diemDaDung) {
            invoiceData.diemDaDung = diemDaDung || 0;
        }

        // Ghi lịch sử hoạt động
        const tongTienFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.tongTien);
        const moTa = `Tạo hóa đơn ${invoiceData.maHD} với tổng tiền ${tongTienFormatted}`;
        await ghiLichSuHoatDong(idNV, 'Tạo hóa đơn', moTa, invoiceData.maHD, invoiceData.id);

        res.status(201).json({
            success: true,
            message: 'Thêm hóa đơn thành công',
            data: invoiceData
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm hóa đơn',
            error: err.message
        });
    }
});

// PUT
app.put('/api/hoadon/:id', async (req, res) => {
    const { id } = req.params;
    const { idNV, idKH, idKM, loaiGiaoDich, diemDaDung } = req.body;
    if (!idNV || !idKH) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: idNV, idKH'
        });
    }
    try {
        const pool = await poolPromise;

        // Tính lại tổng tiền từ chi tiết
        const totalResult = await pool.request()
            .input('idHD', sql.Int, id)
            .query('SELECT SUM(thanhTien) as tongTien FROM CHITIET_HD WHERE idHD = @idHD');

        const tongTien = totalResult.recordset[0].tongTien || 0;

        // Áp dụng khuyến mãi nếu có
        let finalTongTien = tongTien;
        if (idKM) {
            const kmResult = await pool.request()
                .input('idKM', sql.Int, idKM)
                .query('SELECT phantramGiam FROM KHUYENMAI WHERE id = @idKM');

            if (kmResult.recordset.length > 0) {
                const phantramGiam = kmResult.recordset[0].phantramGiam;
                finalTongTien = tongTien * (1 - phantramGiam / 100);
            }
        }

        // Áp dụng giảm giá từ điểm (1 điểm = 1000đ)
        if (diemDaDung && diemDaDung > 0) {
            finalTongTien = Math.max(0, finalTongTien - (diemDaDung * 1000));
        }

        // Update hóa đơn, bao gồm diemDaDung nếu có
        let updateQuery = 'UPDATE HOADON SET idNV = @idNV, idKH = @idKH, idKM = @idKM, tongTien = @tongTien, loaiGiaoDich = @loaiGiaoDich';
        const request = pool.request()
            .input('id', sql.Int, id)
            .input('idNV', sql.Int, idNV)
            .input('idKH', sql.Int, idKH)
            .input('idKM', sql.Int, idKM || null)
            .input('tongTien', sql.Money, finalTongTien)
            .input('loaiGiaoDich', sql.NVarChar(20), loaiGiaoDich || 'Bán hàng');

        if (diemDaDung !== undefined && diemDaDung !== null) {
            updateQuery += ', diemDaDung = @diemDaDung';
            request.input('diemDaDung', sql.Int, diemDaDung);
        }

        updateQuery += ' WHERE id = @id';
        const result = await request.query(updateQuery);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        // Lấy mã hóa đơn để ghi log
        const hdResult = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT maHD FROM HOADON WHERE id = @id');

        const maHD = hdResult.recordset[0]?.maHD;
        if (maHD) {
            const tongTienFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(finalTongTien);
            const moTa = `Sửa hóa đơn ${maHD} với tổng tiền ${tongTienFormatted}`;
            await ghiLichSuHoatDong(idNV, 'Sửa hóa đơn', moTa, maHD, parseInt(id));
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật hóa đơn thành công',
            data: { id: parseInt(id), idNV, idKH, idKM, tongTien: finalTongTien, loaiGiaoDich }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật hóa đơn',
            error: err.message
        });
    }
});

// DELETE
app.delete('/api/hoadon/:id', async (req, res) => {
    const { id } = req.params;
    const { idNV } = req.body; // Lấy idNV từ body nếu có
    try {
        const pool = await poolPromise;

        // Lấy thông tin trước khi xóa để ghi log
        const beforeDelete = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT maHD, idNV FROM HOADON WHERE id = @id');

        if (beforeDelete.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        const maHD = beforeDelete.recordset[0].maHD;
        const logIdNV = idNV || beforeDelete.recordset[0].idNV;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM HOADON WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        // Ghi lịch sử hoạt động
        if (logIdNV && maHD) {
            await ghiLichSuHoatDong(logIdNV, 'Xóa hóa đơn', `Xóa hóa đơn ${maHD}`, maHD, parseInt(id));
        }

        res.status(200).json({
            success: true,
            message: 'Xóa hóa đơn thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa hóa đơn',
            error: err.message
        });
    }
});

// ================== CHITIET_HD APIs ==================
// GET all
app.get('/api/chitiethd', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT c.idHD, c.idHang, c.soluong, c.dongia, c.thanhTien,
                    h.maHD, hh.maHang, hh.tenHang
                    FROM CHITIET_HD c
                    LEFT JOIN HOADON h ON c.idHD = h.id
                    LEFT JOIN HANGHOA hh ON c.idHang = hh.id`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu chi tiết hóa đơn',
            error: err.message
        });
    }
});

// GET by ID (composite key)
app.get('/api/chitiethd/:idHD/:idHang', async (req, res) => {
    const { idHD, idHang } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .query(`SELECT c.idHD, c.idHang, c.soluong, c.dongia, c.thanhTien,
                    h.maHD, hh.maHang, hh.tenHang
                    FROM CHITIET_HD c
                    LEFT JOIN HOADON h ON c.idHD = h.id
                    LEFT JOIN HANGHOA hh ON c.idHang = hh.id
                    WHERE c.idHD = @idHD AND c.idHang = @idHang`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết hóa đơn'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// GET by idHD
app.get('/api/chitiethd/:idHD', async (req, res) => {
    const { idHD } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('idHD', sql.Int, idHD)
            .query(`SELECT c.idHD, c.idHang, c.soluong, c.dongia, c.thanhTien,
                    h.maHD, hh.maHang, hh.tenHang
                    FROM CHITIET_HD c
                    LEFT JOIN HOADON h ON c.idHD = h.id
                    LEFT JOIN HANGHOA hh ON c.idHang = hh.id
                    WHERE c.idHD = @idHD`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST - Trigger sẽ tự động trừ kho và tích điểm
app.post('/api/chitiethd', async (req, res) => {
    const { idHD, idHang, soluong, dongia } = req.body;
    if (!idHD || !idHang || soluong === undefined || dongia === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: idHD, idHang, soluong, dongia'
        });
    }
    try {
        const pool = await poolPromise;

        // Kiểm tra tồn kho
        const stockResult = await pool.request()
            .input('idHang', sql.Int, idHang)
            .query('SELECT soluong FROM HANGHOA WHERE id = @idHang');

        if (stockResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hàng hóa'
            });
        }

        const currentStock = stockResult.recordset[0].soluong;
        if (currentStock < soluong) {
            return res.status(400).json({
                success: false,
                message: `Số lượng trong kho không đủ. Hiện có: ${currentStock}, yêu cầu: ${soluong}`
            });
        }

        // Thêm chi tiết hóa đơn (trigger sẽ tự động trừ kho và tích điểm)
        // Không dùng OUTPUT vì bảng có trigger, phải query lại sau khi insert
        await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .input('soluong', sql.Int, soluong)
            .input('dongia', sql.Money, dongia)
            .query('INSERT INTO CHITIET_HD (idHD, idHang, soluong, dongia) VALUES (@idHD, @idHang, @soluong, @dongia)');

        // Query lại để lấy dữ liệu vừa insert (bao gồm thanhTien được tính tự động)
        const result = await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .query('SELECT idHD, idHang, soluong, dongia, thanhTien FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHang');

        // Lấy idKH từ hóa đơn trước khi cập nhật tổng tiền
        const hdResult = await pool.request()
            .input('idHD', sql.Int, idHD)
            .query('SELECT idKH FROM HOADON WHERE id = @idHD');

        const idKH = hdResult.recordset.length > 0 ? hdResult.recordset[0].idKH : null;

        // Cập nhật tổng tiền hóa đơn (hàm này sẽ tự động gọi updateAllCustomerClassification)
        await recalculateInvoiceTotal(idHD);
        
        // Đợi một chút để đảm bảo trigger đã cập nhật tongchi xong
        // Sau đó mới cập nhật phân loại
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Cập nhật phân loại cho tất cả khách hàng sau khi tạo hóa đơn
        console.log('[POST /api/chitiethd] ===== GỌI HÀM updateAllCustomerClassification() =====');
        try {
            await updateAllCustomerClassification();
            console.log('[POST /api/chitiethd] ===== ĐÃ GỌI XONG updateAllCustomerClassification() =====');
        } catch (err) {
            console.error('[POST /api/chitiethd] Lỗi khi gọi updateAllCustomerClassification:', err.message);
        }

        res.status(201).json({
            success: true,
            message: 'Thêm chi tiết hóa đơn thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm chi tiết hóa đơn',
            error: err.message
        });
    }
});

// PUT
app.put('/api/chitiethd/:idHD/:idHang', async (req, res) => {
    const { idHD, idHang } = req.params;
    const { soluong, dongia } = req.body;
    if (soluong === undefined || dongia === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin soluong hoặc dongia'
        });
    }
    try {
        const pool = await poolPromise;

        // Lấy số lượng cũ
        const oldResult = await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .query('SELECT soluong FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHang');

        if (oldResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết hóa đơn'
            });
        }

        const oldSoluong = oldResult.recordset[0].soluong;
        const diffSoluong = soluong - oldSoluong;

        // Kiểm tra tồn kho nếu tăng số lượng
        if (diffSoluong > 0) {
            const stockResult = await pool.request()
                .input('idHang', sql.Int, idHang)
                .query('SELECT soluong FROM HANGHOA WHERE id = @idHang');

            if (stockResult.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hàng hóa'
                });
            }

            const currentStock = stockResult.recordset[0].soluong;
            if (currentStock < diffSoluong) {
                return res.status(400).json({
                    success: false,
                    message: `Số lượng trong kho không đủ. Hiện có: ${currentStock}, cần thêm: ${diffSoluong}`
                });
            }

            // Trừ thêm kho
            await pool.request()
                .input('idHang', sql.Int, idHang)
                .input('soluong', sql.Int, diffSoluong)
                .query('UPDATE HANGHOA SET soluong = soluong - @soluong WHERE id = @idHang');
        } else if (diffSoluong < 0) {
            // Cộng lại kho nếu giảm số lượng
            await pool.request()
                .input('idHang', sql.Int, idHang)
                .input('soluong', sql.Int, -diffSoluong)
                .query('UPDATE HANGHOA SET soluong = soluong + @soluong WHERE id = @idHang');
        }

        const result = await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .input('soluong', sql.Int, soluong)
            .input('dongia', sql.Money, dongia)
            .query('UPDATE CHITIET_HD SET soluong = @soluong, dongia = @dongia WHERE idHD = @idHD AND idHang = @idHang');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết hóa đơn'
            });
        }

        // Cập nhật tổng tiền hóa đơn
        await recalculateInvoiceTotal(idHD);

        res.status(200).json({
            success: true,
            message: 'Cập nhật chi tiết hóa đơn thành công',
            data: { idHD: parseInt(idHD), idHang: parseInt(idHang), soluong, dongia }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật chi tiết hóa đơn',
            error: err.message
        });
    }
});

// DELETE - Cộng lại hàng vào kho khi xóa chi tiết
app.delete('/api/chitiethd/:idHD/:idHang', async (req, res) => {
    const { idHD, idHang } = req.params;
    try {
        const pool = await poolPromise;

        // Lấy số lượng trước khi xóa
        const detailResult = await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .query('SELECT soluong FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHang');

        if (detailResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết hóa đơn'
            });
        }

        const soluong = detailResult.recordset[0].soluong;

        // Xóa chi tiết
        const result = await pool.request()
            .input('idHD', sql.Int, idHD)
            .input('idHang', sql.Int, idHang)
            .query('DELETE FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHang');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết hóa đơn'
            });
        }

        // Cộng lại hàng vào kho
        await pool.request()
            .input('idHang', sql.Int, idHang)
            .input('soluong', sql.Int, soluong)
            .query('UPDATE HANGHOA SET soluong = soluong + @soluong WHERE id = @idHang');

        // Cập nhật tổng tiền hóa đơn
        await recalculateInvoiceTotal(idHD);

        res.status(200).json({
            success: true,
            message: 'Xóa chi tiết hóa đơn thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa chi tiết hóa đơn',
            error: err.message
        });
    }
});

// ================== PHIEUNHAP APIs ==================
// GET all
app.get('/api/phieunhap', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT p.id, p.maPN, p.ngayNhap, p.idNV, p.idNCC, p.tongTien,
                    nv.maNV, nv.tenNV as tenNhanVien,
                    ncc.maNCC, ncc.tenNCC as tenNhaCungCap,
                    (SELECT ISNULL(SUM(thanhTien), 0) FROM CHITIET_PHIEUNHAP WHERE idPN = p.id) as subtotal
                    FROM PHIEUNHAP p
                    LEFT JOIN NHANVIEN nv ON p.idNV = nv.id
                    LEFT JOIN NHACUNGCAP ncc ON p.idNCC = ncc.id
                    ORDER BY p.ngayNhap DESC`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu phiếu nhập',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/phieunhap/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT p.id, p.maPN, p.ngayNhap, p.idNV, p.idNCC, p.tongTien,
                    nv.maNV, nv.tenNV as tenNhanVien,
                    ncc.maNCC, ncc.tenNCC as tenNhaCungCap
                    FROM PHIEUNHAP p
                    LEFT JOIN NHANVIEN nv ON p.idNV = nv.id
                    LEFT JOIN NHACUNGCAP ncc ON p.idNCC = ncc.id
                    WHERE p.id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phiếu nhập'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: err.message
        });
    }
});

// POST - Tạo phiếu nhập mới
app.post('/api/phieunhap', async (req, res) => {
    const { idNV, idNCC, ngayNhap } = req.body;
    if (!idNV) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: idNV'
        });
    }
    try {
        const pool = await poolPromise;

        // Kiểm tra nhân viên có quyền (quản lý hoặc thủ kho)
        const nvResult = await pool.request()
            .input('idNV', sql.Int, idNV)
            .query(`SELECT nv.id, nv.maNV, nv.tenNV, vt.tenVT
                    FROM NHANVIEN nv
                    LEFT JOIN VITRI vt ON nv.idVT = vt.id
                    WHERE nv.id = @idNV`);

        if (nvResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        const nv = nvResult.recordset[0];
        const tenVT = (nv.tenVT || '').toLowerCase();

        // Chỉ cho phép quản lý và thủ kho
        // if (!tenVT.includes('quản lý') && !tenVT.includes('quan ly') && 
        //     !tenVT.includes('thủ kho') && !tenVT.includes('thu kho') &&
        //     !tenVT.includes('warehouse') && !tenVT.includes('manager')) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Chỉ quản lý và thủ kho mới có quyền tạo phiếu nhập'
        //     });
        // }

        // Kiểm tra nhà cung cấp nếu có
        if (idNCC) {
            const nccResult = await pool.request()
                .input('idNCC', sql.Int, idNCC)
                .query('SELECT id FROM NHACUNGCAP WHERE id = @idNCC AND trangthai = 1');

            if (nccResult.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy nhà cung cấp hoặc nhà cung cấp đã ngừng hoạt động'
                });
            }
        }

        // Tạo phiếu nhập (server tự động sinh maPN)
        let query, request;
        if (ngayNhap) {
            request = pool.request()
                .input('idNV', sql.Int, idNV)
                .input('idNCC', sql.Int, idNCC || null)
                .input('ngayNhap', sql.DateTime, ngayNhap);
            query = `INSERT INTO PHIEUNHAP (idNV, idNCC, ngayNhap) 
                    OUTPUT INSERTED.id, INSERTED.maPN, INSERTED.ngayNhap, INSERTED.idNV, INSERTED.idNCC, INSERTED.tongTien 
                    VALUES (@idNV, @idNCC, @ngayNhap)`;
        } else {
            request = pool.request()
                .input('idNV', sql.Int, idNV)
                .input('idNCC', sql.Int, idNCC || null);
            query = `INSERT INTO PHIEUNHAP (idNV, idNCC) 
                    OUTPUT INSERTED.id, INSERTED.maPN, INSERTED.ngayNhap, INSERTED.idNV, INSERTED.idNCC, INSERTED.tongTien 
                    VALUES (@idNV, @idNCC)`;
        }
        const result = await request.query(query);

        const phieuNhapData = result.recordset[0];

        // Ghi lịch sử hoạt động
        const moTa = `Tạo phiếu nhập ${phieuNhapData.maPN}`;
        await ghiLichSuHoatDong(idNV, 'Tạo phiếu nhập', moTa, phieuNhapData.maPN, phieuNhapData.id);

        res.status(201).json({
            success: true,
            message: 'Tạo phiếu nhập thành công',
            data: phieuNhapData
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo phiếu nhập',
            error: err.message
        });
    }
});

// PUT
app.put('/api/phieunhap/:id', async (req, res) => {
    const { id } = req.params;
    const { idNV } = req.body;
    if (!idNV) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: idNV'
        });
    }
    try {
        const pool = await poolPromise;

        // Kiểm tra quyền nhân viên
        const nvResult = await pool.request()
            .input('idNV', sql.Int, idNV)
            .query(`SELECT nv.id, vt.tenVT
                    FROM NHANVIEN nv
                    LEFT JOIN VITRI vt ON nv.idVT = vt.id
                    WHERE nv.id = @idNV`);

        if (nvResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }

        const tenVT = (nvResult.recordset[0].tenVT || '').toLowerCase();
        if (!tenVT.includes('quản lý') && !tenVT.includes('quan ly') &&
            !tenVT.includes('thủ kho') && !tenVT.includes('thu kho') &&
            !tenVT.includes('warehouse') && !tenVT.includes('manager')) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ quản lý và thủ kho mới có quyền cập nhật phiếu nhập'
            });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('idNV', sql.Int, idNV)
            .query('UPDATE PHIEUNHAP SET idNV = @idNV WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phiếu nhập'
            });
        }

        // Lấy lại dữ liệu sau khi cập nhật
        const updatedResult = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT p.id, p.maPN, p.ngayNhap, p.idNV, p.tongTien,
                    nv.maNV, nv.tenNV as tenNhanVien
                    FROM PHIEUNHAP p
                    LEFT JOIN NHANVIEN nv ON p.idNV = nv.id
                    WHERE p.id = @id`);

        const phieuNhapData = updatedResult.recordset[0];

        // Ghi lịch sử hoạt động
        const moTa = `Sửa phiếu nhập ${phieuNhapData.maPN}`;
        await ghiLichSuHoatDong(idNV, 'Sửa phiếu nhập', moTa, phieuNhapData.maPN, phieuNhapData.id);

        res.status(200).json({
            success: true,
            message: 'Cập nhật phiếu nhập thành công',
            data: phieuNhapData
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật phiếu nhập',
            error: err.message
        });
    }
});

// DELETE - Xóa phiếu nhập (sẽ trừ lại hàng trong kho thông qua trigger)
app.delete('/api/phieunhap/:id', async (req, res) => {
    const { id } = req.params;
    const { idNV } = req.body; // Lấy idNV từ body nếu có
    try {
        const pool = await poolPromise;

        // Lấy thông tin trước khi xóa để ghi log
        const beforeDelete = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT maPN, idNV FROM PHIEUNHAP WHERE id = @id');

        if (beforeDelete.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phiếu nhập'
            });
        }

        const maPN = beforeDelete.recordset[0].maPN;
        const logIdNV = idNV || beforeDelete.recordset[0].idNV;

        // Lấy chi tiết trước khi xóa để trừ lại kho
        const detailResult = await pool.request()
            .input('idPN', sql.Int, id)
            .query('SELECT idHang, soluong FROM CHITIET_PHIEUNHAP WHERE idPN = @idPN');

        // Xóa phiếu nhập (trigger sẽ tự động xóa chi tiết và cập nhật kho)
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM PHIEUNHAP WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phiếu nhập'
            });
        }

        // Trừ lại hàng trong kho (vì trigger chỉ cộng khi insert, không trừ khi delete)
        for (const detail of detailResult.recordset) {
            await pool.request()
                .input('idHang', sql.Int, detail.idHang)
                .input('soluong', sql.Int, detail.soluong)
                .query('UPDATE HANGHOA SET soluong = soluong - @soluong WHERE id = @idHang');
        }

        // Ghi lịch sử hoạt động
        if (logIdNV && maPN) {
            await ghiLichSuHoatDong(logIdNV, 'Xóa phiếu nhập', `Xóa phiếu nhập ${maPN}`, maPN, parseInt(id));
        }

        res.status(200).json({
            success: true,
            message: 'Xóa phiếu nhập thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa phiếu nhập',
            error: err.message
        });
    }
});

// ================== CHITIET_PHIEUNHAP APIs ==================
// GET all
app.get('/api/chitietphieunhap', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`SELECT c.idPN, c.idHang, c.soluong, c.dongia, c.thanhTien,
                    p.maPN, hh.maHang, hh.tenHang
                    FROM CHITIET_PHIEUNHAP c
                    LEFT JOIN PHIEUNHAP p ON c.idPN = p.id
                    LEFT JOIN HANGHOA hh ON c.idHang = hh.id`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu chi tiết phiếu nhập',
            error: err.message
        });
    }
});

// GET by ID phiếu nhập
app.get('/api/chitietphieunhap/:idPN', async (req, res) => {
    const { idPN } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('idPN', sql.Int, idPN)
            .query(`SELECT c.idPN, c.idHang, c.soluong, c.dongia, c.thanhTien,
                    p.maPN, hh.maHang, hh.tenHang
                    FROM CHITIET_PHIEUNHAP c
                    LEFT JOIN PHIEUNHAP p ON c.idPN = p.id
                    LEFT JOIN HANGHOA hh ON c.idHang = hh.id
                    WHERE c.idPN = @idPN`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu chi tiết phiếu nhập',
            error: err.message
        });
    }
});

// POST
app.post('/api/chitietphieunhap', async (req, res) => {
    const { idPN, idHang, soluong, dongia } = req.body;
    if (idPN === undefined || idHang === undefined || soluong === undefined || dongia === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: idPN, idHang, soluong, dongia'
        });
    }
    if (soluong <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Số lượng phải lớn hơn 0'
        });
    }
    try {
        const pool = await poolPromise;

        // Kiểm tra phiếu nhập tồn tại
        const phieuResult = await pool.request()
            .input('idPN', sql.Int, idPN)
            .query('SELECT id FROM PHIEUNHAP WHERE id = @idPN');

        if (phieuResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy phiếu nhập'
            });
        }

        // Kiểm tra hàng hóa tồn tại
        const hangResult = await pool.request()
            .input('idHang', sql.Int, idHang)
            .query('SELECT id, maHang, tenHang FROM HANGHOA WHERE id = @idHang');

        if (hangResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hàng hóa'
            });
        }

        // Kiểm tra chi tiết đã tồn tại chưa
        const existingResult = await pool.request()
            .input('idPN', sql.Int, idPN)
            .input('idHang', sql.Int, idHang)
            .query('SELECT soluong FROM CHITIET_PHIEUNHAP WHERE idPN = @idPN AND idHang = @idHang');

        if (existingResult.recordset.length > 0) {
            // Nếu đã tồn tại, cập nhật số lượng
            const oldSoluong = existingResult.recordset[0].soluong;
            const newSoluong = oldSoluong + soluong;

            await pool.request()
                .input('idPN', sql.Int, idPN)
                .input('idHang', sql.Int, idHang)
                .input('soluong', sql.Int, newSoluong)
                .input('dongia', sql.Money, dongia)
                .query('UPDATE CHITIET_PHIEUNHAP SET soluong = @soluong, dongia = @dongia WHERE idPN = @idPN AND idHang = @idHang');

            // Cập nhật lại kho (trigger chỉ chạy khi insert)
            // Lấy ngayNhap từ phiếu nhập
            const phieuNhapResult = await pool.request()
                .input('idPN', sql.Int, idPN)
                .query('SELECT ngayNhap FROM PHIEUNHAP WHERE id = @idPN');

            if (phieuNhapResult.recordset.length > 0) {
                const ngayNhap = phieuNhapResult.recordset[0].ngayNhap;
                await pool.request()
                    .input('idHang', sql.Int, idHang)
                    .input('soluong', sql.Int, soluong)
                    .input('dongia', sql.Money, dongia)
                    .input('ngayNhap', sql.Date, ngayNhap)
                    .query('UPDATE HANGHOA SET soluong = soluong + @soluong, gianhap = @dongia, ngayNhapCuoi = CAST(@ngayNhap AS DATE) WHERE id = @idHang');
            } else {
                // Fallback nếu không tìm thấy phiếu nhập
                await pool.request()
                    .input('idHang', sql.Int, idHang)
                    .input('soluong', sql.Int, soluong)
                    .input('dongia', sql.Money, dongia)
                    .query('UPDATE HANGHOA SET soluong = soluong + @soluong, gianhap = @dongia, ngayNhapCuoi = CAST(GETDATE() AS DATE) WHERE id = @idHang');
            }
        } else {
            // Thêm mới
            await pool.request()
                .input('idPN', sql.Int, idPN)
                .input('idHang', sql.Int, idHang)
                .input('soluong', sql.Int, soluong)
                .input('dongia', sql.Money, dongia)
                .query('INSERT INTO CHITIET_PHIEUNHAP (idPN, idHang, soluong, dongia) VALUES (@idPN, @idHang, @soluong, @dongia)');
        }

        // Query lại để lấy dữ liệu vừa insert/update
        const result = await pool.request()
            .input('idPN', sql.Int, idPN)
            .input('idHang', sql.Int, idHang)
            .query('SELECT idPN, idHang, soluong, dongia, thanhTien FROM CHITIET_PHIEUNHAP WHERE idPN = @idPN AND idHang = @idHang');

        res.status(201).json({
            success: true,
            message: 'Thêm chi tiết phiếu nhập thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm chi tiết phiếu nhập',
            error: err.message
        });
    }
});

// PUT
app.put('/api/chitietphieunhap/:idPN/:idHang', async (req, res) => {
    const { idPN, idHang } = req.params;
    const { soluong, dongia } = req.body;
    if (soluong === undefined || dongia === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin soluong hoặc dongia'
        });
    }
    if (soluong <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Số lượng phải lớn hơn 0'
        });
    }
    try {
        const pool = await poolPromise;

        // Lấy số lượng cũ
        const oldResult = await pool.request()
            .input('idPN', sql.Int, idPN)
            .input('idHang', sql.Int, idHang)
            .query('SELECT soluong FROM CHITIET_PHIEUNHAP WHERE idPN = @idPN AND idHang = @idHang');

        if (oldResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết phiếu nhập'
            });
        }

        const oldSoluong = oldResult.recordset[0].soluong;
        const diffSoluong = soluong - oldSoluong;

        // Cập nhật chi tiết
        await pool.request()
            .input('idPN', sql.Int, idPN)
            .input('idHang', sql.Int, idHang)
            .input('soluong', sql.Int, soluong)
            .input('dongia', sql.Money, dongia)
            .query('UPDATE CHITIET_PHIEUNHAP SET soluong = @soluong, dongia = @dongia WHERE idPN = @idPN AND idHang = @idHang');

        // Cập nhật kho (cộng thêm nếu tăng, trừ nếu giảm)
        if (diffSoluong !== 0) {
            // Lấy ngayNhap từ phiếu nhập
            const phieuNhapResult = await pool.request()
                .input('idPN', sql.Int, idPN)
                .query('SELECT ngayNhap FROM PHIEUNHAP WHERE id = @idPN');

            if (phieuNhapResult.recordset.length > 0) {
                const ngayNhap = phieuNhapResult.recordset[0].ngayNhap;
                await pool.request()
                    .input('idHang', sql.Int, idHang)
                    .input('soluong', sql.Int, diffSoluong)
                    .input('dongia', sql.Money, dongia)
                    .input('ngayNhap', sql.Date, ngayNhap)
                    .query('UPDATE HANGHOA SET soluong = soluong + @soluong, gianhap = @dongia, ngayNhapCuoi = CAST(@ngayNhap AS DATE) WHERE id = @idHang');
            } else {
                // Fallback nếu không tìm thấy phiếu nhập
                await pool.request()
                    .input('idHang', sql.Int, idHang)
                    .input('soluong', sql.Int, diffSoluong)
                    .input('dongia', sql.Money, dongia)
                    .query('UPDATE HANGHOA SET soluong = soluong + @soluong, gianhap = @dongia, ngayNhapCuoi = CAST(GETDATE() AS DATE) WHERE id = @idHang');
            }
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật chi tiết phiếu nhập thành công',
            data: { idPN: parseInt(idPN), idHang: parseInt(idHang), soluong, dongia }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật chi tiết phiếu nhập',
            error: err.message
        });
    }
});

// DELETE - Trừ lại hàng trong kho
app.delete('/api/chitietphieunhap/:idPN/:idHang', async (req, res) => {
    const { idPN, idHang } = req.params;
    try {
        const pool = await poolPromise;

        // Lấy số lượng trước khi xóa
        const detailResult = await pool.request()
            .input('idPN', sql.Int, idPN)
            .input('idHang', sql.Int, idHang)
            .query('SELECT soluong FROM CHITIET_PHIEUNHAP WHERE idPN = @idPN AND idHang = @idHang');

        if (detailResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết phiếu nhập'
            });
        }

        const soluong = detailResult.recordset[0].soluong;

        // Xóa chi tiết
        const result = await pool.request()
            .input('idPN', sql.Int, idPN)
            .input('idHang', sql.Int, idHang)
            .query('DELETE FROM CHITIET_PHIEUNHAP WHERE idPN = @idPN AND idHang = @idHang');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy chi tiết phiếu nhập'
            });
        }

        // Trừ lại hàng trong kho
        await pool.request()
            .input('idHang', sql.Int, idHang)
            .input('soluong', sql.Int, soluong)
            .query('UPDATE HANGHOA SET soluong = soluong - @soluong WHERE id = @idHang');

        res.status(200).json({
            success: true,
            message: 'Xóa chi tiết phiếu nhập thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa chi tiết phiếu nhập',
            error: err.message
        });
    }
});

// Helper function to recalculate invoice total and apply discount
async function recalculateInvoiceTotal(idHD) {
    const pool = await poolPromise;

    // Calculate total from invoice details
    const totalResult = await pool.request()
        .input('idHD', sql.Int, idHD)
        .query('SELECT SUM(thanhTien) as tongTien FROM CHITIET_HD WHERE idHD = @idHD');

    const tongTien = totalResult.recordset[0].tongTien || 0;

    // Get invoice discount and points used
    const invoiceResult = await pool.request()
        .input('idHD', sql.Int, idHD)
        .query('SELECT idKM, ISNULL(diemDaDung, 0) as diemDaDung FROM HOADON WHERE id = @idHD');

    let finalTongTien = tongTien;
    if (invoiceResult.recordset.length > 0) {
        const invoice = invoiceResult.recordset[0];

        // Áp dụng mã giảm giá
        if (invoice.idKM) {
            const idKM = invoice.idKM;
            const kmResult = await pool.request()
                .input('idKM', sql.Int, idKM)
                .query('SELECT phantramGiam FROM KHUYENMAI WHERE id = @idKM');

            if (kmResult.recordset.length > 0) {
                const phantramGiam = kmResult.recordset[0].phantramGiam;
                finalTongTien = tongTien * (1 - phantramGiam / 100);
            }
        }

        // Áp dụng giảm giá từ điểm (1 điểm = 1000đ)
        const diemDaDung = invoice.diemDaDung || 0;
        if (diemDaDung > 0) {
            finalTongTien = Math.max(0, finalTongTien - (diemDaDung * 1000));
        }
    }

    // Update invoice total
    await pool.request()
        .input('idHD', sql.Int, idHD)
        .input('tongTien', sql.Money, finalTongTien)
        .query('UPDATE HOADON SET tongTien = @tongTien WHERE id = @idHD');
    
    // KHÔNG gọi updateAllCustomerClassification ở đây
    // Vì sẽ được gọi sau khi thêm chi tiết hóa đơn (trong POST /api/chitiethd)
}

// ================== TRẢ HÀNG API ==================
app.post('/api/hoadon/:id/tra-hang', async (req, res) => {
    const { id } = req.params;
    const { items } = req.body; // [{ idHang, soluong }]

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu danh sách sản phẩm trả hàng'
        });
    }

    try {
        const pool = await poolPromise;

        // Kiểm tra hóa đơn tồn tại
        const invoiceResult = await pool.request()
            .input('idHD', sql.Int, id)
            .query('SELECT id FROM HOADON WHERE id = @idHD');

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        // Kiểm tra và cộng lại hàng vào kho
        for (const item of items) {
            const { idHang, soluong } = item;

            // Kiểm tra chi tiết hóa đơn
            const detailResult = await pool.request()
                .input('idHD', sql.Int, id)
                .input('idHang', sql.Int, idHang)
                .query('SELECT soluong FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHang');

            if (detailResult.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy sản phẩm trong hóa đơn`
                });
            }

            const invoiceQty = detailResult.recordset[0].soluong;
            if (soluong > invoiceQty) {
                return res.status(400).json({
                    success: false,
                    message: `Số lượng trả (${soluong}) vượt quá số lượng đã bán (${invoiceQty})`
                });
            }

            // Cộng lại hàng vào kho
            await pool.request()
                .input('idHang', sql.Int, idHang)
                .input('soluong', sql.Int, soluong)
                .query('UPDATE HANGHOA SET soluong = soluong + @soluong WHERE id = @idHang');

            // Cập nhật hoặc xóa chi tiết hóa đơn
            if (soluong === invoiceQty) {
                // Xóa nếu trả hết
                await pool.request()
                    .input('idHD', sql.Int, id)
                    .input('idHang', sql.Int, idHang)
                    .query('DELETE FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHang');
            } else {
                // Giảm số lượng
                await pool.request()
                    .input('idHD', sql.Int, id)
                    .input('idHang', sql.Int, idHang)
                    .input('soluong', sql.Int, invoiceQty - soluong)
                    .query('UPDATE CHITIET_HD SET soluong = @soluong, dongia = dongia WHERE idHD = @idHD AND idHang = @idHang');
            }
        }

        // Recalculate invoice total
        await recalculateInvoiceTotal(id);

        res.status(200).json({
            success: true,
            message: 'Trả hàng thành công',
            data: { idHD: parseInt(id), items }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi trả hàng',
            error: err.message
        });
    }
});

// ================== ĐỔI HÀNG API ==================
app.post('/api/hoadon/:id/doi-hang', async (req, res) => {
    const { id } = req.params;
    const { idHangCu, idHangMoi, soluong } = req.body;

    if (!idHangCu || !idHangMoi || !soluong) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin: idHangCu, idHangMoi, soluong'
        });
    }

    try {
        const pool = await poolPromise;

        // Kiểm tra hóa đơn và chi tiết cũ
        const oldDetailResult = await pool.request()
            .input('idHD', sql.Int, id)
            .input('idHangCu', sql.Int, idHangCu)
            .query('SELECT soluong, dongia FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHangCu');

        if (oldDetailResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm cũ trong hóa đơn'
            });
        }

        const oldDetail = oldDetailResult.recordset[0];
        if (soluong > oldDetail.soluong) {
            return res.status(400).json({
                success: false,
                message: `Số lượng đổi (${soluong}) vượt quá số lượng đã bán (${oldDetail.soluong})`
            });
        }

        // Kiểm tra tồn kho hàng mới
        const newStockResult = await pool.request()
            .input('idHangMoi', sql.Int, idHangMoi)
            .query('SELECT soluong, giaban FROM HANGHOA WHERE id = @idHangMoi');

        if (newStockResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hàng hóa mới'
            });
        }

        const newStock = newStockResult.recordset[0];
        if (newStock.soluong < soluong) {
            return res.status(400).json({
                success: false,
                message: `Số lượng trong kho không đủ. Hiện có: ${newStock.soluong}, yêu cầu: ${soluong}`
            });
        }

        // Cộng lại hàng cũ vào kho
        await pool.request()
            .input('idHangCu', sql.Int, idHangCu)
            .input('soluong', sql.Int, soluong)
            .query('UPDATE HANGHOA SET soluong = soluong + @soluong WHERE id = @idHangCu');

        // Trừ hàng mới khỏi kho
        await pool.request()
            .input('idHangMoi', sql.Int, idHangMoi)
            .input('soluong', sql.Int, soluong)
            .query('UPDATE HANGHOA SET soluong = soluong - @soluong WHERE id = @idHangMoi');

        // Cập nhật chi tiết hóa đơn
        if (soluong === oldDetail.soluong) {
            // Đổi toàn bộ: xóa cũ, thêm mới
            await pool.request()
                .input('idHD', sql.Int, id)
                .input('idHangCu', sql.Int, idHangCu)
                .query('DELETE FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHangCu');

            const newTongtien = soluong * newStock.giaban;
            await pool.request()
                .input('idHD', sql.Int, id)
                .input('idHangMoi', sql.Int, idHangMoi)
                .input('soluong', sql.Int, soluong)
                .input('dongia', sql.Money, newStock.giaban)
                .query('INSERT INTO CHITIET_HD (idHD, idHang, soluong, dongia) VALUES (@idHD, @idHangMoi, @soluong, @dongia)');
        } else {
            // Đổi một phần: giảm cũ, thêm mới
            const remainingQty = oldDetail.soluong - soluong;
            await pool.request()
                .input('idHD', sql.Int, id)
                .input('idHangCu', sql.Int, idHangCu)
                .input('soluong', sql.Int, remainingQty)
                .query('UPDATE CHITIET_HD SET soluong = @soluong WHERE idHD = @idHD AND idHang = @idHangCu');

            // Kiểm tra xem hàng mới đã có trong hóa đơn chưa
            const existingNewDetail = await pool.request()
                .input('idHD', sql.Int, id)
                .input('idHangMoi', sql.Int, idHangMoi)
                .query('SELECT soluong, dongia FROM CHITIET_HD WHERE idHD = @idHD AND idHang = @idHangMoi');

            if (existingNewDetail.recordset.length > 0) {
                // Cộng thêm vào chi tiết đã có
                const newQty = existingNewDetail.recordset[0].soluong + soluong;
                await pool.request()
                    .input('idHD', sql.Int, id)
                    .input('idHangMoi', sql.Int, idHangMoi)
                    .input('soluong', sql.Int, newQty)
                    .query('UPDATE CHITIET_HD SET soluong = @soluong WHERE idHD = @idHD AND idHang = @idHangMoi');
            } else {
                // Thêm mới
                const newTongtien = soluong * newStock.giaban;
                await pool.request()
                    .input('idHD', sql.Int, id)
                    .input('idHangMoi', sql.Int, idHangMoi)
                    .input('soluong', sql.Int, soluong)
                    .input('dongia', sql.Money, newStock.giaban)
                    .query('INSERT INTO CHITIET_HD (idHD, idHang, soluong, dongia) VALUES (@idHD, @idHangMoi, @soluong, @dongia)');
            }
        }

        // Recalculate invoice total
        await recalculateInvoiceTotal(id);

        res.status(200).json({
            success: true,
            message: 'Đổi hàng thành công',
            data: { idHD: parseInt(id), idHangCu, idHangMoi, soluong }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đổi hàng',
            error: err.message
        });
    }
});

// ================== EXPORT INVOICE API ==================
app.get('/api/hoadon/:id/export', async (req, res) => {
    const { id } = req.params;
    const { format } = req.query; // 'json' or 'excel'

    try {
        const pool = await poolPromise;

        // Get invoice data with all related information
        const invoiceResult = await pool.request()
            .input('idHD', sql.Int, id)
            .query(`SELECT h.id, h.maHD, h.ngayLap, h.tongTien, h.idKM, h.loaiGiaoDich,
                    ISNULL(h.diemDaDung, 0) as diemDaDung,
                    nv.maNV, nv.tenNV as tenNhanVien,
                    kh.maKH, kh.tenKH as tenKhachHang, kh.diachi, kh.sdt,
                    km.maKM, km.tenKM as tenKhuyenMai, km.phantramGiam
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    LEFT JOIN KHACHHANG kh ON h.idKH = kh.id
                    LEFT JOIN KHUYENMAI km ON h.idKM = km.id
                    WHERE h.id = @idHD`);

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        const invoice = invoiceResult.recordset[0];

        // Get invoice details with product information
        const detailsResult = await pool.request()
            .input('idHD', sql.Int, id)
            .query(`SELECT cthd.idHang, cthd.soluong, cthd.dongia, cthd.thanhTien,
                    hh.maHang, hh.tenHang
                    FROM CHITIET_HD cthd
                    INNER JOIN HANGHOA hh ON cthd.idHang = hh.id
                    WHERE cthd.idHD = @idHD
                    ORDER BY hh.maHang`);

        const details = detailsResult.recordset;

        // Calculate amounts
        const subtotal = details.reduce((sum, item) => sum + (parseFloat(item.thanhTien) || 0), 0);
        const tienGiamGiaCode = invoice.idKM ? (subtotal * (invoice.phantramGiam || 0) / 100) : 0;
        const diemDaDung = invoice.diemDaDung || 0;
        const tienGiamGiaDiem = diemDaDung * 1000; // 1 điểm = 1000đ
        const thanhTien = parseFloat(invoice.tongTien) || 0;

        // Prepare response data
        const invoiceData = {
            thongTinHoaDon: {
                maHD: invoice.maHD,
                ngaylap: invoice.ngayLap,
                nhanVien: {
                    maNV: invoice.maNV,
                    tenNV: invoice.tenNhanVien
                },
                khachHang: invoice.maKH ? {
                    maKH: invoice.maKH,
                    tenKH: invoice.tenKhachHang,
                    diachi: invoice.diachi,
                    sdt: invoice.sdt
                } : null,
                maGiamGia: invoice.maKM ? {
                    maKM: invoice.maKM,
                    tenKM: invoice.tenKhuyenMai,
                    phantramgiam: invoice.phantramGiam
                } : null,
                tongTien: subtotal,
                tienGiamGiaCode: tienGiamGiaCode,
                tienGiamGiaDiem: tienGiamGiaDiem,
                thanhTien: thanhTien
            },
            chiTietHangHoa: details.map((item, index) => ({
                stt: index + 1,
                maHang: item.maHang,
                tenHang: item.tenHang,
                soluong: item.soluong,
                dongia: parseFloat(item.dongia),
                tongtien: parseFloat(item.thanhTien)
            }))
        };

        // Return JSON or Excel based on format parameter
        if (format === 'excel') {
            // Create Excel file
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Hóa Đơn');

            // Set column widths
            worksheet.columns = [
                { width: 10 }, // STT
                { width: 15 }, // Mã hàng
                { width: 30 }, // Tên hàng
                { width: 12 }, // Số lượng
                { width: 15 }, // Đơn giá
                { width: 15 }  // Thành tiền
            ];

            // Header row
            worksheet.mergeCells('A1:F1');
            worksheet.getCell('A1').value = 'HÓA ĐƠN BÁN HÀNG';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Invoice info
            worksheet.mergeCells('A2:F2');
            worksheet.getCell('A2').value = `Mã hóa đơn: ${invoice.maHD} | Ngày lập: ${new Date(invoice.ngayLap).toLocaleDateString('vi-VN')}`;
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            // Customer info
            if (invoice.tenKhachHang) {
                worksheet.mergeCells('A3:F3');
                worksheet.getCell('A3').value = `Khách hàng: ${invoice.tenKhachHang}${invoice.diachi ? ' | Địa chỉ: ' + invoice.diachi : ''}${invoice.sdt ? ' | SĐT: ' + invoice.sdt : ''}`;
            }

            // Staff info
            worksheet.mergeCells('A4:F4');
            worksheet.getCell('A4').value = `Nhân viên: ${invoice.tenNhanVien || 'N/A'}`;

            // Discount code
            if (invoice.maKM) {
                worksheet.mergeCells('A5:F5');
                worksheet.getCell('A5').value = `Mã giảm giá: ${invoice.maKM} (${invoice.phantramGiam}%)${invoice.tenKhuyenMai ? ' - ' + invoice.tenKhuyenMai : ''}`;
                worksheet.getCell('A5').font = { color: { argb: 'FF0066CC' } };
            }

            // Empty row
            worksheet.getRow(6).height = 5;

            // Table header
            const headerRow = worksheet.getRow(7);
            headerRow.values = ['STT', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Đơn giá', 'Thành tiền'];
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF667EEA' }
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.height = 25;

            // Data rows
            details.forEach((item, index) => {
                const row = worksheet.getRow(8 + index);
                row.values = [
                    index + 1,
                    item.maHang,
                    item.tenHang,
                    item.soluong,
                    parseFloat(item.dongia).toLocaleString('vi-VN'),
                    parseFloat(item.thanhTien).toLocaleString('vi-VN')
                ];
                row.getCell(5).numFmt = '#,##0';
                row.getCell(6).numFmt = '#,##0';
            });

            // Summary row
            const summaryRowIndex = 8 + details.length;

            worksheet.mergeCells(`A${summaryRowIndex}:D${summaryRowIndex}`);
            worksheet.getCell(`A${summaryRowIndex}`).value = 'Tổng tiền:';
            worksheet.getCell(`A${summaryRowIndex}`).font = { bold: true };
            worksheet.getCell(`E${summaryRowIndex}`).value = subtotal.toLocaleString('vi-VN');
            worksheet.getCell(`E${summaryRowIndex}`).numFmt = '#,##0';
            worksheet.getCell(`E${summaryRowIndex}`).font = { bold: true };

            let currentRow = summaryRowIndex + 1;

            if (tienGiamGiaCode > 0) {
                worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
                worksheet.getCell(`A${currentRow}`).value = 'Giảm giá (Mã):';
                worksheet.getCell(`E${currentRow}`).value = '-' + tienGiamGiaCode.toLocaleString('vi-VN');
                worksheet.getCell(`E${currentRow}`).numFmt = '#,##0';
                worksheet.getCell(`E${currentRow}`).font = { color: { argb: 'FFCC0000' } };
                currentRow++;
            }

            if (tienGiamGiaDiem > 0) {
                worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
                worksheet.getCell(`A${currentRow}`).value = 'Giảm giá (Điểm):';
                worksheet.getCell(`E${currentRow}`).value = '-' + tienGiamGiaDiem.toLocaleString('vi-VN');
                worksheet.getCell(`E${currentRow}`).numFmt = '#,##0';
                worksheet.getCell(`E${currentRow}`).font = { color: { argb: 'FF059669' } };
                currentRow++;
            }

            const finalRowIndex = currentRow;
            worksheet.mergeCells(`A${finalRowIndex}:D${finalRowIndex}`);
            worksheet.getCell(`A${finalRowIndex}`).value = 'Thành tiền:';
            worksheet.getCell(`A${finalRowIndex}`).font = { size: 12, bold: true };
            worksheet.getCell(`E${finalRowIndex}`).value = thanhTien.toLocaleString('vi-VN');
            worksheet.getCell(`E${finalRowIndex}`).numFmt = '#,##0';
            worksheet.getCell(`E${finalRowIndex}`).font = { size: 12, bold: true };

            // Footer
            worksheet.mergeCells(`A${finalRowIndex + 2}:F${finalRowIndex + 2}`);
            worksheet.getCell(`A${finalRowIndex + 2}`).value = 'Cảm ơn quý khách đã sử dụng dịch vụ!';
            worksheet.getCell(`A${finalRowIndex + 2}`).alignment = { horizontal: 'center' };
            worksheet.getCell(`A${finalRowIndex + 2}`).font = { italic: true };

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="HoaDon_${invoice.maHD}.xlsx"`);

            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        } else {
            // Return JSON
            res.status(200).json({
                success: true,
                data: invoiceData
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xuất hóa đơn',
            error: err.message
        });
    }
});

// ================== PDF EXPORT API ==================
app.get('/api/hoadon/:id/pdf', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;

        // Get invoice data
        const invoiceResult = await pool.request()
            .input('idHD', sql.Int, id)
            .query(`SELECT h.id, h.maHD, h.ngayLap, h.tongTien, h.idKM, h.loaiGiaoDich,
                    ISNULL(h.diemDaDung, 0) as diemDaDung,
                    nv.tenNV, kh.tenKH, kh.diachi, kh.sdt,
                    km.maKM, km.phantramGiam
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    LEFT JOIN KHACHHANG kh ON h.idKH = kh.id
                    LEFT JOIN KHUYENMAI km ON h.idKM = km.id
                    WHERE h.id = @idHD`);

        if (invoiceResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hóa đơn'
            });
        }

        const invoice = invoiceResult.recordset[0];

        // Get invoice details
        const detailsResult = await pool.request()
            .input('idHD', sql.Int, id)
            .query(`SELECT cthd.idHang, cthd.soluong, cthd.dongia, cthd.thanhTien,
                    hh.maHang, hh.tenHang
                    FROM CHITIET_HD cthd
                    INNER JOIN HANGHOA hh ON cthd.idHang = hh.id
                    WHERE cthd.idHD = @idHD
                    ORDER BY hh.maHang`);

        const details = detailsResult.recordset;

        // Calculate subtotal from details
        const subtotal = details.reduce((sum, item) => sum + (parseFloat(item.thanhTien) || 0), 0);
        const tienGiamGiaCode = invoice.idKM ? (subtotal * (invoice.phantramGiam || 0) / 100) : 0;
        const diemDaDung = invoice.diemDaDung || 0;
        const tienGiamGiaDiem = diemDaDung * 1000; // 1 điểm = 1000đ
        const thanhTien = parseFloat(invoice.tongTien) || 0;

        // Create PDF with A4 portrait
        const doc = new PDFDocument({
            margin: 10,
            size: 'A4',
            layout: 'portrait',
            info: {
                Title: `Hoa Don ${invoice.maHD}`,
                Author: 'FMSTYLE',
                Subject: 'Hoa don ban hang'
            }
        });

        // Font registration
        const fontsDir = path.join(__dirname, 'fonts');
        const windowsFontsDir = process.platform === 'win32'
            ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts')
            : null;

        let vietnameseFont = 'Times-Roman';
        let vietnameseFontBold = 'Times-Bold';

        const fontFiles = {
            'NotoSans-Regular.ttf': 'NotoSans',
            'NotoSans-Bold.ttf': 'NotoSansBold',
            'Arial-Unicode-MS.ttf': 'ArialUnicode',
            'Times-New-Roman.ttf': 'TimesNewRoman'
        };

        const windowsFontFiles = {
            'arial.ttf': 'Arial',
            'arialbd.ttf': 'ArialBold',
            'times.ttf': 'TimesNewRoman',
            'timesbd.ttf': 'TimesNewRomanBold',
            'tahoma.ttf': 'Tahoma',
            'tahomabd.ttf': 'TahomaBold'
        };

        for (const [filename, fontName] of Object.entries(fontFiles)) {
            const fontPath = path.join(fontsDir, filename);
            if (fs.existsSync(fontPath)) {
                try {
                    doc.registerFont(fontName, fontPath);
                    if (filename.includes('Regular') || filename.includes('Arial') || filename.includes('Times-New')) {
                        vietnameseFont = fontName;
                    }
                    if (filename.includes('Bold')) {
                        vietnameseFontBold = fontName;
                    }
                } catch (e) {
                    console.log(`Could not register font ${filename}:`, e.message);
                }
            }
        }

        if (windowsFontsDir && fs.existsSync(windowsFontsDir) && vietnameseFont === 'Times-Roman') {
            const preferredFonts = ['arial.ttf', 'tahoma.ttf', 'times.ttf'];
            const preferredBoldFonts = ['arialbd.ttf', 'tahomabd.ttf', 'timesbd.ttf'];

            for (const preferredFont of preferredFonts) {
                if (windowsFontFiles[preferredFont]) {
                    const fontPath = path.join(windowsFontsDir, preferredFont);
                    if (fs.existsSync(fontPath)) {
                        try {
                            const fontName = windowsFontFiles[preferredFont];
                            doc.registerFont(fontName, fontPath);
                            vietnameseFont = fontName;
                            break;
                        } catch (e) {
                            console.log(`Could not register Windows font ${preferredFont}:`, e.message);
                        }
                    }
                }
            }

            for (const preferredBoldFont of preferredBoldFonts) {
                if (windowsFontFiles[preferredBoldFont]) {
                    const fontPath = path.join(windowsFontsDir, preferredBoldFont);
                    if (fs.existsSync(fontPath)) {
                        try {
                            const fontName = windowsFontFiles[preferredBoldFont];
                            doc.registerFont(fontName, fontPath);
                            vietnameseFontBold = fontName;
                            break;
                        } catch (e) {
                            console.log(`Could not register Windows bold font ${preferredBoldFont}:`, e.message);
                        }
                    }
                }
            }
        }

        if (vietnameseFont === 'Times-Roman') {
            console.warn('Warning: Vietnamese font not found. PDF may display Vietnamese text incorrectly.');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="HoaDon_${invoice.maHD}.pdf"`);
        doc.pipe(res);

        // Helper functions
        const safeText = (text) => {
            if (text === null || text === undefined) return '';
            try {
                return String(text).normalize('NFC');
            } catch (e) {
                return String(text);
            }
        };

        const formatCurrency = (amount) => {
            return parseFloat(amount || 0).toLocaleString('vi-VN') + ' đ';
        };

        const formatDate = (date) => {
            if (!date) return '';
            const d = new Date(date);
            return d.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        const pageWidth = 595.28;
        const margin = 40;
        const contentWidth = pageWidth - (margin * 2);

        // Header with logo space
        doc.fontSize(26)
            .font(vietnameseFontBold)
            .fillColor('#2563eb')
            .text('HÓA ĐƠN BÁN HÀNG', margin, 50, { align: 'center' });

        // Decorative line
        doc.moveTo(margin, 90)
            .lineTo(pageWidth - margin, 90)
            .lineWidth(3)
            .strokeColor('#3b82f6')
            .stroke();

        doc.moveTo(margin, 94)
            .lineTo(pageWidth - margin, 94)
            .lineWidth(1)
            .strokeColor('#93c5fd')
            .stroke();

        // Invoice info in two columns
        let yPos = 115;
        doc.fontSize(10)
            .font(vietnameseFont)
            .fillColor('#374151');

        // Left column
        doc.font(vietnameseFontBold).text('Mã hóa đơn:', margin, yPos);
        doc.font(vietnameseFont).text(safeText(invoice.maHD), margin + 90, yPos);

        // Right column
        doc.font(vietnameseFontBold).text('Ngày lập:', pageWidth / 2 + 20, yPos);
        doc.font(vietnameseFont).text(formatDate(invoice.ngayLap), pageWidth / 2 + 90, yPos);

        yPos += 25;

        // Customer info section
        if (invoice.tenKH) {
            doc.rect(margin, yPos - 5, contentWidth, 1)
                .fillColor('#e5e7eb')
                .fill();

            yPos += 10;

            doc.fontSize(11)
                .font(vietnameseFontBold)
                .fillColor('#1f2937')
                .text('THÔNG TIN KHÁCH HÀNG', margin, yPos);

            yPos += 20;
            doc.fontSize(10).font(vietnameseFont).fillColor('#374151');

            // Customer name
            doc.font(vietnameseFontBold).text('Khách hàng:', margin, yPos);
            doc.font(vietnameseFont).text(safeText(invoice.tenKH), margin + 90, yPos);
            yPos += 18;

            // Address and phone in two columns
            if (invoice.diachi) {
                doc.font(vietnameseFontBold).text('Địa chỉ:', margin, yPos);
                doc.font(vietnameseFont).text(safeText(invoice.diachi), margin + 90, yPos, {
                    width: contentWidth / 2 - 100
                });
            }

            if (invoice.sdt) {
                const phoneX = invoice.diachi ? pageWidth / 2 + 20 : margin;
                const phoneValueX = invoice.diachi ? pageWidth / 2 + 60 : margin + 90;
                doc.font(vietnameseFontBold).text('SĐT:', phoneX, yPos);
                doc.font(vietnameseFont).text(safeText(invoice.sdt), phoneValueX, yPos);
            }

            yPos += 35;
        }

        // Staff info
        doc.rect(margin, yPos - 5, contentWidth, 1)
            .fillColor('#000000')
            .fill();

        yPos += 10;
        doc.font(vietnameseFontBold).text('Nhân viên:', margin, yPos);
        doc.font(vietnameseFont).text(safeText(invoice.tenNV || 'N/A'), margin + 90, yPos);

        // Discount code
        if (invoice.maKM) {
            doc.font(vietnameseFontBold).text('Mã giảm giá:', pageWidth / 2 + 20, yPos);
            doc.font(vietnameseFont)
                .fillColor('#0891b2')
                .text(`${safeText(invoice.maKM)} (${invoice.phantramGiam}%)`,
                    pageWidth / 2 + 95, yPos);
            doc.fillColor('#374151');
        }

        yPos += 30;

        // Table
        const tableTop = yPos;
        const colWidths = [35, 65, 180, 50, 85, 100];
        const colX = [margin];
        for (let i = 1; i < colWidths.length; i++) {
            colX[i] = colX[i - 1] + colWidths[i - 1];
        }

        // Table header
        doc.rect(margin, tableTop, contentWidth, 28)
            .fillAndStroke('#3b82f6', '#2563eb');

        doc.fontSize(10)
            .font(vietnameseFontBold)
            .fillColor('#ffffff');

        const headerY = tableTop + 10;
        doc.text('STT', colX[0] + 5, headerY, { width: colWidths[0] - 10, align: 'center' })
            .text('Mã hàng', colX[1] + 5, headerY, { width: colWidths[1] - 10 })
            .text('Tên hàng', colX[2] + 5, headerY, { width: colWidths[2] - 10 })
            .text('SL', colX[3] + 5, headerY, { width: colWidths[3] - 10, align: 'center' })
            .text('Đơn giá', colX[4] + 5, headerY, { width: colWidths[4] - 10, align: 'right' })
            .text('Thành tiền', colX[5] + 5, headerY, { width: colWidths[5] - 10, align: 'right' });

        // Table rows
        yPos = tableTop + 33;
        doc.fontSize(9.5)
            .font(vietnameseFont)
            .fillColor('#1f2937');

        details.forEach((item, index) => {
            if (yPos > 720) {
                doc.addPage();
                yPos = 50;

                // Redraw header
                doc.rect(margin, yPos, contentWidth, 28)
                    .fillAndStroke('#3b82f6', '#2563eb');
                doc.fontSize(10).font(vietnameseFontBold).fillColor('#ffffff');
                const newHeaderY = yPos + 10;
                doc.text('STT', colX[0] + 5, newHeaderY, { width: colWidths[0] - 10, align: 'center' })
                    .text('Mã hàng', colX[1] + 5, newHeaderY, { width: colWidths[1] - 10 })
                    .text('Tên hàng', colX[2] + 5, newHeaderY, { width: colWidths[2] - 10 })
                    .text('SL', colX[3] + 5, newHeaderY, { width: colWidths[3] - 10, align: 'center' })
                    .text('Đơn giá', colX[4] + 5, newHeaderY, { width: colWidths[4] - 10, align: 'right' })
                    .text('Thành tiền', colX[5] + 5, newHeaderY, { width: colWidths[5] - 10, align: 'right' });
                yPos += 33;
                doc.fontSize(9.5).font(vietnameseFont).fillColor('#1f2937');
            }

            // Alternate row colors
            if (index % 2 === 0) {
                doc.rect(margin, yPos - 2, contentWidth, 22)
                    .fillColor('#f9fafb')
                    .fill();
            }

            const rowY = yPos + 4;
            doc.fillColor('#1f2937')
                .text((index + 1).toString(), colX[0] + 5, rowY, { width: colWidths[0] - 10, align: 'center' })
                .text(safeText(item.maHang), colX[1] + 5, rowY, { width: colWidths[1] - 10 })
                .text(safeText(item.tenHang || ''), colX[2] + 5, rowY, { width: colWidths[2] - 10 })
                .text(item.soluong.toString(), colX[3] + 5, rowY, { width: colWidths[3] - 10, align: 'center' })
                .text(formatCurrency(item.dongia), colX[4] + 5, rowY, { width: colWidths[4] - 10, align: 'right' })
                .text(formatCurrency(item.thanhTien), colX[5] + 5, rowY, { width: colWidths[5] - 10, align: 'right' });

            yPos += 22;
        });

        // Table border
        doc.rect(margin, tableTop, contentWidth, yPos - tableTop)
            .lineWidth(1)
            .strokeColor('#d1d5db')
            .stroke();

        // Summary section
        yPos += 25;
        const summaryBoxWidth = 240;
        const summaryBoxLeft = pageWidth - margin - summaryBoxWidth;

        // Calculate summary height based on discounts
        let summaryHeight = 70;
        if (tienGiamGiaCode > 0) summaryHeight += 25;
        if (tienGiamGiaDiem > 0) summaryHeight += 25;

        // Summary box with gradient effect
        doc.rect(summaryBoxLeft, yPos, summaryBoxWidth, summaryHeight)
            .fillColor('#f8fafc')
            .fillAndStroke('#f8fafc', '#cbd5e1');

        doc.fontSize(10.5).font(vietnameseFont).fillColor('#374151');
        let summaryY = yPos + 15;

        // Total
        doc.text('Tổng tiền:', summaryBoxLeft + 15, summaryY);
        doc.font(vietnameseFontBold)
            .text(formatCurrency(subtotal), summaryBoxLeft + 120, summaryY, {
                width: 105,
                align: 'right'
            });

        // Discount from code
        if (tienGiamGiaCode > 0) {
            summaryY += 25;
            doc.font(vietnameseFont)
                .fillColor('#dc2626')
                .text('Giảm giá (Mã):', summaryBoxLeft + 15, summaryY);
            doc.font(vietnameseFontBold)
                .text('-' + formatCurrency(tienGiamGiaCode), summaryBoxLeft + 120, summaryY, {
                    width: 105,
                    align: 'right'
                });
        }

        // Discount from points
        if (tienGiamGiaDiem > 0) {
            summaryY += 25;
            doc.font(vietnameseFont)
                .fillColor('#059669')
                .text('Giảm giá (Điểm):', summaryBoxLeft + 15, summaryY);
            doc.font(vietnameseFontBold)
                .text('-' + formatCurrency(tienGiamGiaDiem), summaryBoxLeft + 120, summaryY, {
                    width: 105,
                    align: 'right'
                });
        }

        // Final total
        summaryY += 28;
        doc.fontSize(12)
            .font(vietnameseFontBold)
            .fillColor('#1e40af')
            .text('Thành tiền:', summaryBoxLeft + 15, summaryY);
        doc.text(formatCurrency(thanhTien), summaryBoxLeft + 120, summaryY, {
            width: 105,
            align: 'right'
        });

        // Footer
        const footerY = 770;
        doc.fontSize(9)
            .font(vietnameseFont)
            .fillColor('#6b7280')
            .text('Cảm ơn quý khách đã sử dụng dịch vụ!', margin, footerY, {
                align: 'center',
                width: contentWidth
            });

        doc.fontSize(8)
            .text('FMSTYLE - Địa chỉ: 171 Bà Triệu, Huế - Hotline: 1900 9090',
                margin, footerY + 15, {
                align: 'center',
                width: contentWidth
            });

        doc.end();

    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xuất PDF',
            error: err.message
        });
    }
});

// ================== THỐNG KÊ DOANH THU API ==================
app.get('/api/thongke/doanhthu', async (req, res) => {
    const { period, startDate, endDate, idNV } = req.query; // period: 'day', 'week', 'month', 'quarter', 'year'

    try {
        const pool = await poolPromise;
        let query = '';
        const hasIdNV = idNV && idNV !== '';

        if (period === 'day' && startDate && endDate) {
            query = `SELECT 
                        CAST(h.ngayLap AS DATE) as ngay,
                        h.idNV,
                        nv.maNV,
                        nv.tenNV as tenNhanVien,
                        COUNT(*) as soHoaDon,
                        SUM(h.tongTien) as tongDoanhThu
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate
                    ${hasIdNV ? 'AND h.idNV = @idNV' : ''}
                    GROUP BY CAST(h.ngayLap AS DATE), h.idNV, nv.maNV, nv.tenNV
                    ORDER BY tongDoanhThu DESC, ngay DESC`;
        } else if (period === 'week') {
            const whereClause = hasIdNV ? 'WHERE h.idNV = @idNV' : 'WHERE h.ngayLap >= DATEADD(WEEK, -12, GETDATE())';
            if (hasIdNV && startDate && endDate) {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            DATEPART(WEEK, h.ngayLap) as tuan,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate AND h.idNV = @idNV
                        GROUP BY DATEPART(YEAR, h.ngayLap), DATEPART(WEEK, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC, tuan DESC`;
            } else {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            DATEPART(WEEK, h.ngayLap) as tuan,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        ${whereClause}
                        GROUP BY DATEPART(YEAR, h.ngayLap), DATEPART(WEEK, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC, tuan DESC`;
            }
        } else if (period === 'month') {
            const whereClause = hasIdNV ? 'WHERE h.idNV = @idNV' : 'WHERE h.ngayLap >= DATEADD(MONTH, -12, GETDATE())';
            if (hasIdNV && startDate && endDate) {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            DATEPART(MONTH, h.ngayLap) as thang,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate AND h.idNV = @idNV
                        GROUP BY DATEPART(YEAR, h.ngayLap), DATEPART(MONTH, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC, thang DESC`;
            } else {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            DATEPART(MONTH, h.ngayLap) as thang,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        ${whereClause}
                        GROUP BY DATEPART(YEAR, h.ngayLap), DATEPART(MONTH, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC, thang DESC`;
            }
        } else if (period === 'quarter') {
            const whereClause = hasIdNV ? 'WHERE h.idNV = @idNV' : 'WHERE h.ngayLap >= DATEADD(YEAR, -3, GETDATE())';
            if (hasIdNV && startDate && endDate) {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            DATEPART(QUARTER, h.ngayLap) as quy,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate AND h.idNV = @idNV
                        GROUP BY DATEPART(YEAR, h.ngayLap), DATEPART(QUARTER, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC, quy DESC`;
            } else {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            DATEPART(QUARTER, h.ngayLap) as quy,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        ${whereClause}
                        GROUP BY DATEPART(YEAR, h.ngayLap), DATEPART(QUARTER, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC, quy DESC`;
            }
        } else if (period === 'year') {
            const whereClause = hasIdNV ? 'WHERE h.idNV = @idNV' : '';
            if (hasIdNV && startDate && endDate) {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate AND h.idNV = @idNV
                        GROUP BY DATEPART(YEAR, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC`;
            } else {
                query = `SELECT 
                            DATEPART(YEAR, h.ngayLap) as nam,
                            h.idNV,
                            nv.maNV,
                            nv.tenNV as tenNhanVien,
                            COUNT(*) as soHoaDon,
                            SUM(h.tongTien) as tongDoanhThu
                        FROM HOADON h
                        LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                        ${whereClause}
                        GROUP BY DATEPART(YEAR, h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                        ORDER BY tongDoanhThu DESC, nam DESC`;
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin period hoặc startDate/endDate'
            });
        }

        const request = pool.request();
        if (startDate) request.input('startDate', sql.Date, startDate);
        if (endDate) request.input('endDate', sql.Date, endDate);
        if (hasIdNV) request.input('idNV', sql.Int, parseInt(idNV));

        const result = await request.query(query);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thống kê doanh thu',
            error: err.message
        });
    }
});

// ================== XUẤT BÁO CÁO DOANH THU ==================
app.get('/api/thongke/doanhthu/export', async (req, res) => {
    const { period, startDate, endDate, idNV, format = 'pdf' } = req.query;

    try {
        const pool = await poolPromise;

        // Lấy dữ liệu thống kê (dùng lại logic từ API thống kê)
        let query = '';
        const hasIdNV = idNV && idNV !== '';

        if (period === 'day' && startDate && endDate) {
            query = `SELECT 
                        CAST(h.ngayLap AS DATE) as ngay,
                        h.idNV,
                        nv.maNV,
                        nv.tenNV as tenNhanVien,
                        COUNT(*) as soHoaDon,
                        SUM(h.tongTien) as tongDoanhThu
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate
                    ${hasIdNV ? 'AND h.idNV = @idNV' : ''}
                    GROUP BY CAST(h.ngayLap AS DATE), h.idNV, nv.maNV, nv.tenNV
                    ORDER BY ngay DESC`;
        } else if (period === 'month' && startDate && endDate) {
            query = `SELECT 
                        YEAR(h.ngayLap) as nam,
                        MONTH(h.ngayLap) as thang,
                        h.idNV,
                        nv.maNV,
                        nv.tenNV as tenNhanVien,
                        COUNT(*) as soHoaDon,
                        SUM(h.tongTien) as tongDoanhThu
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate
                    ${hasIdNV ? 'AND h.idNV = @idNV' : ''}
                    GROUP BY YEAR(h.ngayLap), MONTH(h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                    ORDER BY nam DESC, thang DESC`;
        } else if (period === 'year' && startDate && endDate) {
            query = `SELECT 
                        YEAR(h.ngayLap) as nam,
                        h.idNV,
                        nv.maNV,
                        nv.tenNV as tenNhanVien,
                        COUNT(*) as soHoaDon,
                        SUM(h.tongTien) as tongDoanhThu
                    FROM HOADON h
                    LEFT JOIN NHANVIEN nv ON h.idNV = nv.id
                    WHERE CAST(h.ngayLap AS DATE) BETWEEN @startDate AND @endDate
                    ${hasIdNV ? 'AND h.idNV = @idNV' : ''}
                    GROUP BY YEAR(h.ngayLap), h.idNV, nv.maNV, nv.tenNV
                    ORDER BY nam DESC`;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin period hoặc startDate/endDate'
            });
        }

        const request = pool.request();
        if (startDate) request.input('startDate', sql.Date, startDate);
        if (endDate) request.input('endDate', sql.Date, endDate);
        if (hasIdNV) request.input('idNV', sql.Int, parseInt(idNV));

        const result = await request.query(query);
        const data = result.recordset;

        // Tính tổng
        const totalRevenue = data.reduce((sum, item) => sum + (parseFloat(item.tongDoanhThu) || 0), 0);
        const totalOrders = data.reduce((sum, item) => sum + (parseInt(item.soHoaDon) || 0), 0);

        if (format === 'excel') {
            // Xuất Excel
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Báo Cáo Doanh Thu');

            // Header
            worksheet.mergeCells('A1:F1');
            worksheet.getCell('A1').value = 'BÁO CÁO DOANH THU';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:F2');
            const periodText = period === 'day' ? 'Theo Ngày' : period === 'month' ? 'Theo Tháng' : 'Theo Năm';
            worksheet.getCell('A2').value = `${periodText} - Từ ${startDate} đến ${endDate}`;
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            worksheet.getRow(4).values = ['STT', period === 'day' ? 'Ngày' : period === 'month' ? 'Tháng/Năm' : 'Năm', 'Nhân Viên', 'Số Hóa Đơn', 'Tổng Doanh Thu', 'Ghi Chú'];
            worksheet.getRow(4).font = { bold: true };
            worksheet.getRow(4).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Data
            data.forEach((item, index) => {
                const row = worksheet.addRow([
                    index + 1,
                    period === 'day' ? item.ngay : period === 'month' ? `Tháng ${item.thang}/${item.nam}` : item.nam,
                    item.tenNhanVien || item.maNV || 'N/A',
                    item.soHoaDon,
                    parseFloat(item.tongDoanhThu || 0),
                    ''
                ]);
                row.getCell(5).numFmt = '#,##0';
            });

            // Tổng
            worksheet.addRow([]);
            const totalRow = worksheet.addRow(['TỔNG CỘNG', '', '', totalOrders, totalRevenue, '']);
            totalRow.font = { bold: true };
            totalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE0' }
            };
            totalRow.getCell(5).numFmt = '#,##0';

            // Auto fit columns
            worksheet.columns.forEach(column => {
                column.width = 15;
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="BaoCaoDoanhThu_${period}_${startDate}_${endDate}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end();
        } else {
            // Xuất PDF
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="BaoCaoDoanhThu_${period}_${startDate}_${endDate}.pdf"`);
            doc.pipe(res);

            // Đăng ký font tiếng Việt
            const { vietnameseFont, vietnameseFontBold } = registerVietnameseFonts(doc);

            // Header
            doc.fontSize(20).font(vietnameseFontBold).text('BÁO CÁO DOANH THU', { align: 'center' });
            doc.moveDown();
            const periodText = period === 'day' ? 'Theo Ngày' : period === 'month' ? 'Theo Tháng' : 'Theo Năm';
            doc.fontSize(12).font(vietnameseFont).text(`${periodText} - Từ ${startDate} đến ${endDate}`, { align: 'center' });
            doc.moveDown(2);

            // Table header
            const tableTop = doc.y;
            const colWidths = [50, 100, 150, 100, 120, 100];
            const colX = [50, 100, 200, 350, 450, 570];

            doc.fontSize(10).font(vietnameseFontBold);
            doc.text('STT', colX[0], tableTop);
            doc.text(period === 'day' ? 'Ngày' : period === 'month' ? 'Tháng/Năm' : 'Năm', colX[1], tableTop);
            doc.text('Nhân Viên', colX[2], tableTop);
            doc.text('Số HĐ', colX[3], tableTop);
            doc.text('Doanh Thu', colX[4], tableTop);

            doc.moveTo(50, tableTop + 20).lineTo(670, tableTop + 20).stroke();

            // Data rows
            let y = tableTop + 30;
            doc.font(vietnameseFont).fontSize(9);
            data.forEach((item, index) => {
                if (y > 750) {
                    doc.addPage();
                    y = 50;
                }
                doc.text((index + 1).toString(), colX[0], y);
                const dateText = period === 'day' ? item.ngay : period === 'month' ? `Tháng ${item.thang}/${item.nam}` : item.nam.toString();
                doc.text(dateText, colX[1], y);
                doc.text(item.tenNhanVien || item.maNV || 'N/A', colX[2], y);
                doc.text(item.soHoaDon.toString(), colX[3], y);
                doc.text(parseFloat(item.tongDoanhThu || 0).toLocaleString('vi-VN') + ' đ', colX[4], y);
                y += 20;
            });

            // Tổng
            doc.moveTo(50, y).lineTo(670, y).stroke();
            y += 10;
            doc.font(vietnameseFontBold).fontSize(10);
            doc.text('TỔNG CỘNG', colX[0], y);
            doc.text(totalOrders.toString(), colX[3], y);
            doc.text(totalRevenue.toLocaleString('vi-VN') + ' đ', colX[4], y);

            doc.end();
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xuất báo cáo',
            error: err.message
        });
    }
});

// ================== XUẤT BÁO CÁO LỊCH SỬ HOẠT ĐỘNG ==================
app.get('/api/lichsu/export', async (req, res) => {
    const { loaiHoatDong, format = 'pdf' } = req.query;

    try {
        const pool = await poolPromise;

        let query = `SELECT TOP 200
                    ls.id, ls.idNV, ls.loaiHoatDong, ls.moTa, ls.thamChieu, ls.idThamChieu, ls.thoiGian,
                    nv.maNV, nv.tenNV as tenNhanVien
                    FROM LICHSU_HOATDONG ls
                    LEFT JOIN NHANVIEN nv ON ls.idNV = nv.id
                    WHERE 1=1`;

        const request = pool.request();

        if (loaiHoatDong) {
            query += ' AND ls.loaiHoatDong = @loaiHoatDong';
            request.input('loaiHoatDong', sql.NVarChar(50), loaiHoatDong);
        }

        query += ' ORDER BY ls.thoiGian DESC';

        const result = await request.query(query);
        const data = result.recordset;

        if (format === 'excel') {
            // Xuất Excel
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Lịch Sử Hoạt Động');

            worksheet.mergeCells('A1:E1');
            worksheet.getCell('A1').value = 'BÁO CÁO LỊCH SỬ HOẠT ĐỘNG';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.getRow(3).values = ['STT', 'Thời Gian', 'Nhân Viên', 'Loại Hoạt Động', 'Mô Tả', 'Tham Chiếu'];
            worksheet.getRow(3).font = { bold: true };
            worksheet.getRow(3).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            data.forEach((item, index) => {
                const thoiGian = new Date(item.thoiGian).toLocaleString('vi-VN');
                worksheet.addRow([
                    index + 1,
                    thoiGian,
                    item.tenNhanVien || item.maNV || 'N/A',
                    item.loaiHoatDong,
                    item.moTa || '-',
                    item.thamChieu || '-'
                ]);
            });

            worksheet.columns.forEach(column => {
                column.width = 20;
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="BaoCaoLichSu_${new Date().toISOString().split('T')[0]}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end();
        } else {
            // Xuất PDF
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="BaoCaoLichSu_${new Date().toISOString().split('T')[0]}.pdf"`);
            doc.pipe(res);

            // Đăng ký font tiếng Việt
            const { vietnameseFont, vietnameseFontBold } = registerVietnameseFonts(doc);

            doc.fontSize(20).font(vietnameseFontBold).text('BÁO CÁO LỊCH SỬ HOẠT ĐỘNG', { align: 'center' });
            doc.moveDown(2);

            const tableTop = doc.y;
            const colWidths = [50, 120, 120, 120, 200, 100];
            const colX = [50, 100, 220, 340, 460, 660];

            doc.fontSize(9).font(vietnameseFontBold);
            doc.text('STT', colX[0], tableTop);
            doc.text('Thời Gian', colX[1], tableTop);
            doc.text('Nhân Viên', colX[2], tableTop);
            doc.text('Loại HĐ', colX[3], tableTop);
            doc.text('Mô Tả', colX[4], tableTop);
            doc.text('Tham Chiếu', colX[5], tableTop);

            doc.moveTo(50, tableTop + 15).lineTo(760, tableTop + 15).stroke();

            let y = tableTop + 25;
            doc.font(vietnameseFont).fontSize(8);
            data.forEach((item, index) => {
                if (y > 750) {
                    doc.addPage();
                    y = 50;
                    doc.font(vietnameseFontBold).fontSize(9);
                    doc.text('STT', colX[0], y);
                    doc.text('Thời Gian', colX[1], y);
                    doc.text('Nhân Viên', colX[2], y);
                    doc.text('Loại HĐ', colX[3], y);
                    doc.text('Mô Tả', colX[4], y);
                    doc.text('Tham Chiếu', colX[5], y);
                    doc.moveTo(50, y + 15).lineTo(760, y + 15).stroke();
                    y += 25;
                    doc.font(vietnameseFont).fontSize(8);
                }
                const thoiGian = new Date(item.thoiGian).toLocaleString('vi-VN');
                doc.text((index + 1).toString(), colX[0], y);
                doc.text(thoiGian, colX[1], y);
                doc.text(item.tenNhanVien || item.maNV || 'N/A', colX[2], y);
                doc.text(item.loaiHoatDong, colX[3], y);
                doc.text((item.moTa || '-').substring(0, 30), colX[4], y);
                doc.text(item.thamChieu || '-', colX[5], y);
                y += 20;
            });

            doc.end();
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xuất báo cáo',
            error: err.message
        });
    }
});

// ================== NHACUNGCAP APIs ==================
// GET all
app.get('/api/nhacungcap', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { all } = req.query; // Tham số để lấy tất cả (kể cả đã ngừng)
        const whereClause = all === 'true' ? '' : 'WHERE trangthai = 1';
        const result = await pool.request()
            .query(`SELECT id, maNCC, tenNCC, sdt, email, diachi, ghiChu, trangthai, ngayTao
                    FROM NHACUNGCAP
                    ${whereClause}
                    ORDER BY tenNCC`);

        res.status(200).json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu nhà cung cấp',
            error: err.message
        });
    }
});

// GET by ID
app.get('/api/nhacungcap/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT id, maNCC, tenNCC, sdt, email, diachi, ghiChu, trangthai, ngayTao
                    FROM NHACUNGCAP
                    WHERE id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà cung cấp'
            });
        }

        res.status(200).json({
            success: true,
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu nhà cung cấp',
            error: err.message
        });
    }
});

// POST
app.post('/api/nhacungcap', async (req, res) => {
    const { tenNCC, sdt, email, diachi, ghiChu } = req.body;
    if (!tenNCC) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: tenNCC'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('tenNCC', sql.NVarChar(100), tenNCC)
            .input('sdt', sql.VarChar(15), sdt || null)
            .input('email', sql.NVarChar(100), email || null)
            .input('diachi', sql.NVarChar(200), diachi || null)
            .input('ghiChu', sql.NVarChar(500), ghiChu || null)
            .query(`INSERT INTO NHACUNGCAP (tenNCC, sdt, email, diachi, ghiChu) 
                    OUTPUT INSERTED.id, INSERTED.maNCC, INSERTED.tenNCC, INSERTED.sdt, INSERTED.email, INSERTED.diachi, INSERTED.ghiChu, INSERTED.trangthai, INSERTED.ngayTao 
                    VALUES (@tenNCC, @sdt, @email, @diachi, @ghiChu)`);

        res.status(201).json({
            success: true,
            message: 'Thêm nhà cung cấp thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm nhà cung cấp',
            error: err.message
        });
    }
});

// PUT
app.put('/api/nhacungcap/:id', async (req, res) => {
    const { id } = req.params;
    const { tenNCC, sdt, email, diachi, ghiChu, trangthai } = req.body;
    if (!tenNCC) {
        return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin bắt buộc: tenNCC'
        });
    }
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('tenNCC', sql.NVarChar(100), tenNCC)
            .input('sdt', sql.VarChar(15), sdt || null)
            .input('email', sql.NVarChar(100), email || null)
            .input('diachi', sql.NVarChar(200), diachi || null)
            .input('ghiChu', sql.NVarChar(500), ghiChu || null)
            .input('trangthai', sql.Bit, trangthai !== undefined ? trangthai : 1)
            .query(`UPDATE NHACUNGCAP 
                    SET tenNCC = @tenNCC, sdt = @sdt, email = @email, diachi = @diachi, ghiChu = @ghiChu, trangthai = @trangthai
                    OUTPUT INSERTED.id, INSERTED.maNCC, INSERTED.tenNCC, INSERTED.sdt, INSERTED.email, INSERTED.diachi, INSERTED.ghiChu, INSERTED.trangthai, INSERTED.ngayTao
                    WHERE id = @id`);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà cung cấp'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật nhà cung cấp thành công',
            data: result.recordset[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật nhà cung cấp',
            error: err.message
        });
    }
});

// DELETE (soft delete - chỉ đổi trạng thái)
app.delete('/api/nhacungcap/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE NHACUNGCAP SET trangthai = 0 WHERE id = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhà cung cấp'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa nhà cung cấp thành công'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa nhà cung cấp',
            error: err.message
        });
    }
});

// ================== HOME PAGE ==================
app.get('/', (req, res) => {
    res.send(`
        <h2>API FMSTYLE đang chạy!</h2>
        <h3>Danh sách các API endpoints:</h3>
        <ul>
            <li><strong>LOGIN:</strong> POST /api/login</li>
            <li><strong>VITRI:</strong> GET, POST, PUT, DELETE /api/vitri</li>
            <li><strong>PHANLOAI_KH:</strong> GET, POST, PUT, DELETE /api/phanloaikh</li>
            <li><strong>PHANLOAI_SANPHAM:</strong> GET, POST, PUT, DELETE /api/phanloaisanpham</li>
            <li><strong>KHUYENMAI:</strong> GET, POST, PUT, DELETE /api/khuyenmai</li>
            <li><strong>NHANVIEN:</strong> GET, POST, PUT, DELETE /api/nhanvien</li>
            <li><strong>KHACHHANG:</strong> GET, POST, PUT, DELETE /api/khachhang</li>
            <li><strong>HANGHOA:</strong> GET, POST, PUT, DELETE /api/hanghoa</li>
            <li><strong>HOADON:</strong> GET, POST, PUT, DELETE /api/hoadon</li>
            <li><strong>CHITIET_HD:</strong> GET, POST, PUT, DELETE /api/chitiethd</li>
            <li><strong>LICHSU_HOATDONG:</strong> GET /api/lichsu</li>
        </ul>
    `);
});

// ================== LICHSU_HOATDONG APIs ==================
// GET all - Lấy lịch sử hoạt động
app.get('/api/lichsu', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { idNV, loaiHoatDong, limit = 100 } = req.query;

        let query = `SELECT TOP ${limit} 
                    ls.id, ls.idNV, ls.loaiHoatDong, ls.moTa, ls.thamChieu, ls.idThamChieu, ls.thoiGian,
                    nv.maNV, nv.tenNV as tenNhanVien
                    FROM LICHSU_HOATDONG ls
                    LEFT JOIN NHANVIEN nv ON ls.idNV = nv.id
                    WHERE 1=1`;

        const request = pool.request();

        if (idNV) {
            query += ' AND ls.idNV = @idNV';
            request.input('idNV', sql.Int, parseInt(idNV));
        }

        if (loaiHoatDong) {
            query += ' AND ls.loaiHoatDong = @loaiHoatDong';
            request.input('loaiHoatDong', sql.NVarChar(50), loaiHoatDong);
        }

        query += ' ORDER BY ls.thoiGian DESC';

        const result = await request.query(query);

        res.status(200).json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy lịch sử hoạt động',
            error: err.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
    console.log(`CORS đã được bật – bạn có thể gọi API từ bất kỳ đâu!`);
});
