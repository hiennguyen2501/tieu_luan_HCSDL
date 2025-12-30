-- =============================================
-- TẠO BẢNG PHIẾU NHẬP HÀNG
-- =============================================

USE HeThongQuanLyCuaHang_FMSTYLE;
GO

-- Bảng PHIEUNHAP
CREATE TABLE PHIEUNHAP(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maPN AS ('PN' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED,
    ngayNhap DATETIME DEFAULT GETDATE(),
    idNV INT NOT NULL, -- Người nhập (quản lý hoặc thủ kho)
    tongTien MONEY DEFAULT 0,
    CONSTRAINT fk_PN_NV FOREIGN KEY(idNV) REFERENCES NHANVIEN(id)
);
GO

-- Bảng CHITIET_PHIEUNHAP
CREATE TABLE CHITIET_PHIEUNHAP(
    idPN INT NOT NULL,
    idHang INT NOT NULL,
    soluong INT NOT NULL CHECK(soluong > 0),
    dongia MONEY NOT NULL, -- Giá nhập
    thanhTien AS (soluong * dongia) PERSISTED,
    PRIMARY KEY (idPN, idHang),
    CONSTRAINT fk_CTPN_PN FOREIGN KEY(idPN) REFERENCES PHIEUNHAP(id) ON DELETE CASCADE,
    CONSTRAINT fk_CTPN_HH FOREIGN KEY(idHang) REFERENCES HANGHOA(id)
);
GO

-- =============================================
-- TRIGGER TỰ ĐỘNG CỘNG HÀNG VÀO KHO
-- =============================================

CREATE OR ALTER TRIGGER trg_CapNhatKhoSauNhapHang
ON CHITIET_PHIEUNHAP
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Cộng hàng vào kho
    UPDATE HANGHOA 
    SET soluong = HANGHOA.soluong + i.soluong,
        gianhap = i.dongia, -- Cập nhật giá nhập mới nhất
        ngayNhapCuoi = CAST(GETDATE() AS DATE) -- Cập nhật ngày nhập cuối
    FROM HANGHOA 
    JOIN inserted i ON HANGHOA.id = i.idHang;
    
    -- Cập nhật tổng tiền của phiếu nhập
    UPDATE PHIEUNHAP
    SET tongTien = (
        SELECT ISNULL(SUM(thanhTien), 0)
        FROM CHITIET_PHIEUNHAP
        WHERE idPN = PHIEUNHAP.id
    )
    WHERE id IN (SELECT DISTINCT idPN FROM inserted);
END;
GO

-- Trigger để cập nhật tổng tiền khi xóa chi tiết
CREATE OR ALTER TRIGGER trg_CapNhatTongTienPhieuNhap_Delete
ON CHITIET_PHIEUNHAP
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE PHIEUNHAP
    SET tongTien = (
        SELECT ISNULL(SUM(thanhTien), 0)
        FROM CHITIET_PHIEUNHAP
        WHERE idPN = PHIEUNHAP.id
    )
    WHERE id IN (SELECT DISTINCT idPN FROM deleted);
END;
GO

