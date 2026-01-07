# 🏪 Hệ Thống Quản Lý Cửa Hàng FMSTYLE

Hệ thống quản lý cửa hàng thời trang FMSTYLE - Giải pháp quản lý toàn diện cho cửa hàng bán lẻ với đầy đủ tính năng từ quản lý kho, bán hàng, đến thống kê doanh thu.

## 📋 Mục Lục

- [Giới thiệu](#giới-thiệu)
- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cài đặt](#cài-đặt)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Hướng dẫn sử dụng](#hướng-dẫn-sử-dụng)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Tác giả](#tác-giả)

## 🎯 Giới thiệu

Hệ thống Quản Lý Cửa Hàng FMSTYLE là một ứng dụng web toàn diện được thiết kế để quản lý mọi khía cạnh của một cửa hàng bán lẻ thời trang. Hệ thống hỗ trợ hai loại người dùng chính:

- **Admin**: Quản lý toàn bộ hệ thống, nhân viên, khách hàng, hàng hóa, và các cấu hình
- **Staff**: Nhân viên bán hàng với các chức năng bán hàng, tạo hóa đơn, và quản lý phiếu nhập hàng

## ✨ Tính năng

### 👨‍💼 Quản lý Admin
- ✅ Quản lý vị trí nhân viên, phân loại khách hàng, phân loại sản phẩm
- ✅ Quản lý khuyến mãi và mã giảm giá
- ✅ Quản lý nhân viên (thêm, sửa, xóa, phân quyền)
- ✅ Quản lý khách hàng và điểm tích lũy
- ✅ Quản lý hàng hóa (thêm, sửa, xóa, theo dõi tồn kho)
- ✅ Quản lý hóa đơn và chi tiết hóa đơn
- ✅ Quản lý phiếu nhập hàng với giao diện tương tự bán hàng
- ✅ Xem chi tiết phiếu nhập hàng

### 💼 Quản lý Staff (Nhân viên bán hàng)
- ✅ **Dashboard**: Tổng quan hệ thống, thống kê nhanh
- ✅ **Kho Hàng Hóa**: Xem và tìm kiếm sản phẩm, cảnh báo tồn kho thấp
- ✅ **Tạo Hóa Đơn**: 
  - Chọn sản phẩm từ kho
  - Quản lý giỏ hàng
  - Chọn/Thêm khách hàng mới
  - Áp dụng mã giảm giá
  - Sử dụng điểm tích lũy (1 điểm = 1.000đ)
  - Chọn nhân viên bán hàng
  - Tự động trừ kho và tích điểm
  - In hóa đơn, xuất PDF
- ✅ **Danh Sách Hóa Đơn**: Xem, tìm kiếm, xem chi tiết, xuất PDF
- ✅ **Khách Hàng**: Xem danh sách, điểm tích lũy
- ✅ **Thống Kê Doanh Thu**: 
  - Theo ngày, tuần, tháng, quý, năm
  - Lọc theo nhân viên
  - Sắp xếp theo doanh thu từ cao đến thấp
- ✅ **Phiếu Nhập Hàng**:
  - Tạo phiếu nhập mới
  - Chọn hàng hóa có sẵn hoặc thêm hàng hóa mới
  - Quản lý giỏ hàng nhập
  - Tự động cộng hàng vào kho khi tạo phiếu nhập
  - Xem chi tiết phiếu nhập
- ✅ **Trả Hàng**: Trả hàng từ hóa đơn, tự động cộng lại vào kho
- ✅ **Đổi Hàng**: Đổi sản phẩm trong hóa đơn, tự động cập nhật kho

### 🔐 Bảo mật & Phân quyền
- ✅ Đăng nhập với mã hóa SHA-256
- ✅ Phân quyền theo role (admin, user, seller, warehouse)
- ✅ Kiểm tra quyền truy cập các chức năng
- ✅ Session management

### 📊 Tự động hóa
- ✅ Trigger tự động trừ kho khi bán hàng
- ✅ Trigger tự động cộng kho khi nhập hàng
- ✅ Trigger tự động tích điểm cho khách hàng (100.000đ = 1 điểm, tối thiểu 1 điểm)
- ✅ Trigger tự động cập nhật tổng tiền hóa đơn/phiếu nhập
- ✅ Tự động sinh mã (HD, PN, KH, NV, SP)

## 🛠️ Công nghệ sử dụng

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQL Server** - Database
- **mssql** - SQL Server driver
- **PDFKit** - Tạo PDF hóa đơn
- **ExcelJS** - Xuất Excel

### Frontend
- **HTML5** - Cấu trúc
- **CSS3** - Styling với gradient, animations
- **Vanilla JavaScript** - Logic và tương tác
- **Fetch API** - Giao tiếp với backend

### Database
- **Microsoft SQL Server** - Hệ quản trị cơ sở dữ liệu
- **Triggers** - Tự động cập nhật kho, điểm tích lũy
- **Computed Columns** - Tự động tính toán (mã, thành tiền)

## 📦 Cài đặt

### Yêu cầu hệ thống
- Node.js >= 14.x
- SQL Server >= 2016
- npm hoặc yarn

### Bước 1: Clone repository
```bash
git clone <repository-url>
cd be-Hien-ne
```

### Bước 2: Cài đặt dependencies
```bash
npm install
```

### Bước 3: Cấu hình Database
1. Tạo database trong SQL Server
2. Chạy script SQL trong file `README.md` (phần Database Schema) để tạo các bảng và triggers
3. Cấu hình kết nối database trong file `db.config.js`:
```javascript
const config = {
    user: 'your_username',
    password: 'your_password',
    server: 'localhost',
    database: 'HeThongQuanLyCuaHang_FMSTYLE',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};
```

### Bước 4: Tạo tài khoản admin
Chạy script SQL để tạo tài khoản admin mặc định:
```sql
-- Tạo nhân viên admin
INSERT INTO VITRI (tenVT) VALUES (N'Quản lý');
INSERT INTO NHANVIEN (tenNV, gioitinh, sdt, idVT) 
VALUES (N'Admin', N'Nam', '0123456789', 1);

-- Tạo user admin (password: admin123)
INSERT INTO USERS (username, passwordHash, role, idNV)
VALUES ('admin', UPPER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'admin123'), 2)), 'admin', 1);
```

### Bước 5: Chạy ứng dụng
```bash
# Development mode (với nodemon)
npm run dev

# Production mode
npm start
```

Ứng dụng sẽ chạy tại: `http://localhost:3000`

### Bước 6: Truy cập ứng dụng
- **Admin Panel**: `http://localhost:3000/src/pages/admin.html`
- **Staff Panel**: `http://localhost:3000/src/pages/staff.html`
- **Login**: `http://localhost:3000/src/pages/login.html`


## 📖 Hướng dẫn sử dụng

### Đăng nhập
1. Truy cập `http://localhost:3000/src/pages/login.html`
2. Nhập username và password
3. Hệ thống sẽ tự động chuyển đến trang tương ứng (admin hoặc staff)

### Quản lý Admin
1. **Quản lý dữ liệu cơ bản**: Vị trí, Phân loại KH, Phân loại SP, Khuyến mãi
2. **Quản lý nhân viên**: Thêm, sửa, xóa nhân viên, phân quyền
3. **Quản lý khách hàng**: Xem danh sách, điểm tích lũy
4. **Quản lý hàng hóa**: Thêm, sửa, xóa, theo dõi tồn kho
5. **Quản lý hóa đơn**: Xem danh sách, chi tiết
6. **Quản lý phiếu nhập**: Tạo phiếu nhập với giao diện tương tự bán hàng

### Quản lý Staff
1. **Tạo hóa đơn**:
   - Chọn sản phẩm từ kho
   - Thêm vào giỏ hàng
   - Chọn/Thêm khách hàng
   - Áp dụng mã giảm giá (nếu có)
   - Sử dụng điểm tích lũy
   - Chọn nhân viên bán hàng
   - Tạo hóa đơn
   - In hoặc xuất PDF

2. **Phiếu nhập hàng**:
   - Chọn hàng hóa có sẵn hoặc thêm hàng hóa mới
   - Thêm vào giỏ hàng nhập
   - Chọn người nhập (quản lý/thủ kho)
   - Tạo phiếu nhập
   - Hệ thống tự động cộng hàng vào kho

3. **Thống kê doanh thu**:
   - Chọn khoảng thời gian (ngày/tuần/tháng/quý/năm)
   - Lọc theo nhân viên (tùy chọn)
   - Xem báo cáo doanh thu

## 🔌 API Documentation

### Authentication
- `POST /api/login` - Đăng nhập

### Hàng Hóa
- `GET /api/hanghoa` - Lấy danh sách hàng hóa
- `POST /api/hanghoa` - Tạo hàng hóa mới
- `PUT /api/hanghoa/:id` - Cập nhật hàng hóa
- `DELETE /api/hanghoa/:id` - Xóa hàng hóa

### Hóa Đơn
- `GET /api/hoadon` - Lấy danh sách hóa đơn
- `POST /api/hoadon` - Tạo hóa đơn mới
- `GET /api/hoadon/:id` - Lấy chi tiết hóa đơn
- `GET /api/hoadon/:id/pdf` - Xuất PDF hóa đơn
- `GET /api/hoadon/:id/export` - Xuất Excel/JSON
- `POST /api/hoadon/:id/tra-hang` - Trả hàng
- `POST /api/hoadon/:id/doi-hang` - Đổi hàng

### Phiếu Nhập
- `GET /api/phieunhap` - Lấy danh sách phiếu nhập
- `POST /api/phieunhap` - Tạo phiếu nhập mới
- `GET /api/chitietphieunhap/:idPN` - Lấy chi tiết phiếu nhập

### Khách Hàng
- `GET /api/khachhang` - Lấy danh sách khách hàng
- `POST /api/khachhang` - Tạo khách hàng mới
- `PUT /api/khachhang/:id` - Cập nhật khách hàng

### Thống Kê
- `GET /api/thongke/doanhthu` - Thống kê doanh thu

## 🗄️ Database Schema

### Các bảng chính

#### VITRI
- Quản lý vị trí nhân viên (Quản lý, Thủ kho, Bán hàng, ...)

#### NHANVIEN
- Thông tin nhân viên (mã NV tự động sinh: NV00001, NV00002, ...)

#### USERS
- Tài khoản đăng nhập (username, password hash SHA-256, role, idNV)

#### KHACHHANG
- Thông tin khách hàng (mã KH tự động sinh, điểm tích lũy, tổng chi)

#### HANGHOA
- Thông tin hàng hóa (mã SP tự động sinh, số lượng, giá nhập, giá bán)

#### HOADON
- Hóa đơn bán hàng (mã HD tự động sinh, ngày lập, nhân viên, khách hàng, mã giảm giá, điểm đã dùng)

#### CHITIET_HD
- Chi tiết hóa đơn (sản phẩm, số lượng, đơn giá, thành tiền)

#### PHIEUNHAP
- Phiếu nhập hàng (mã PN tự động sinh, ngày nhập, người nhập, tổng tiền)

#### CHITIET_PHIEUNHAP
- Chi tiết phiếu nhập (sản phẩm, số lượng, đơn giá, thành tiền)

### Triggers tự động

1. **trg_CapNhatKhoSauBanHang**: Tự động trừ kho và tích điểm khi bán hàng
2. **trg_CapNhatKhoSauNhapHang**: Tự động cộng kho khi nhập hàng
3. **trg_CapNhatTongTienPhieuNhap_Delete**: Cập nhật tổng tiền khi xóa chi tiết phiếu nhập

Xem chi tiết SQL schema trong file `README.md` (phần dưới).

---

## 📝 Database Schema (SQL Script)

```sql
CREATE DATABASE HeThongQuanLyCuaHang_FMSTYLE;
GO
USE HeThongQuanLyCuaHang_FMSTYLE;
GO

-- =============================================
-- 1. BẢNG DANH MỤC GỐC
-- =============================================

CREATE TABLE VITRI (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tenVT NVARCHAR(40) NOT NULL
);

CREATE TABLE PHANLOAI_KH(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maPLKH NVARCHAR(10) UNIQUE, -- 'LE', 'THANHVIEN', 'VIP'
    tenPLKH NVARCHAR(40) NOT NULL,
    nguongChiMin MONEY DEFAULT 0
);

CREATE TABLE PHANLOAI_SANPHAM(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maPLSP NVARCHAR(10) UNIQUE, -- 'NAM', 'NU', 'PK'
    tenPLSP NVARCHAR(40) NOT NULL
);

CREATE TABLE KHUYENMAI(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maKM NVARCHAR(20) UNIQUE,
    tenKM NVARCHAR(100),
    phantramGiam INT CHECK(phantramGiam BETWEEN 0 AND 100),
    ngayBD DATE,
    ngayKT DATE,
    trangthai AS (CASE WHEN GETDATE() BETWEEN ngayBD AND ngayKT THEN 1 ELSE 0 END)
);

-- =============================================
-- 2. NHÂN VIÊN & TÀI KHOẢN
-- =============================================

CREATE TABLE NHANVIEN(
    id INT IDENTITY(1,1) PRIMARY KEY, -- Dùng ID này làm Khóa chính để liên kết
    maNV AS ('NV' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED, 
    tenNV NVARCHAR(40) NOT NULL,
    gioitinh NVARCHAR(3) CHECK(gioitinh IN (N'Nam', N'Nữ')), 
    sdt VARCHAR(10),
    idVT INT NOT NULL,
    trangthai BIT DEFAULT 1,
    CONSTRAINT fk_NV_VT FOREIGN KEY(idVT) REFERENCES VITRI(id)
);

CREATE TABLE USERS (
    userId INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,         -- Tên đăng nhập
    passwordHash VARCHAR(64) NOT NULL,            -- Mật khẩu mã hóa SHA2_256
    role NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user', 'seller', 'warehouse')), 
    idNV INT NULL,                                -- FK trỏ đến id (INT) của NHANVIEN
    trangthai BIT DEFAULT 1,                       -- 1: Hoạt động, 0: Khóa
    ngaytao DATETIME DEFAULT GETDATE(),

    CONSTRAINT fk_USERS_NV FOREIGN KEY (idNV)
        REFERENCES NHANVIEN(id)                   -- Ràng buộc với cột id (INT)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- =============================================
-- 3. KHÁCH HÀNG & HÀNG HÓA
-- =============================================

CREATE TABLE KHACHHANG(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maKH AS ('KH' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED,
    tenKH NVARCHAR(40) NOT NULL,
    sdt VARCHAR(10) UNIQUE,
    diachi NVARCHAR(100),
    idPLKH INT NOT NULL,
    diemtichluy INT DEFAULT 0,
    tongchi MONEY DEFAULT 0,
    CONSTRAINT fk_KH_PLKH FOREIGN KEY (idPLKH) REFERENCES PHANLOAI_KH(id)
);

CREATE TABLE HANGHOA(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maHang AS ('SP' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED,
    tenHang NVARCHAR(100) NOT NULL,
    idPLSP INT NOT NULL,
    soluong INT DEFAULT 0 CHECK(soluong >= 0),
    gianhap MONEY,
    giaban MONEY,
    tonKhoToiThieu INT DEFAULT 10,
    ngayNhapCuoi DATE DEFAULT GETDATE(),
    CONSTRAINT fk_HH_PLSP FOREIGN KEY(idPLSP) REFERENCES PHANLOAI_SANPHAM(id)
);

-- =============================================
-- 4. HÓA ĐƠN & PHIẾU NHẬP
-- =============================================

CREATE TABLE HOADON(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maHD AS ('HD' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED,
    diemDaDung INT DEFAULT 0,
    ngayLap DATETIME DEFAULT GETDATE(),
    idNV INT NOT NULL, -- Liên kết id nhân viên
    idKH INT NOT NULL, -- Liên kết id khách hàng
    idKM INT NULL,     -- Liên kết id khuyến mãi
    tongTien MONEY DEFAULT 0,
    loaiGiaoDich NVARCHAR(20) DEFAULT N'Bán hàng',
    CONSTRAINT fk_HD_NV FOREIGN KEY(idNV) REFERENCES NHANVIEN(id),
    CONSTRAINT fk_HD_KH FOREIGN KEY(idKH) REFERENCES KHACHHANG(id),
    CONSTRAINT fk_HD_KM FOREIGN KEY(idKM) REFERENCES KHUYENMAI(id)
);

CREATE TABLE CHITIET_HD(
    idHD INT NOT NULL,
    idHang INT NOT NULL,
    soluong INT NOT NULL,
    dongia MONEY,
    thanhTien AS (soluong * dongia) PERSISTED,
    PRIMARY KEY (idHD, idHang),
    CONSTRAINT fk_CTHD_HD FOREIGN KEY(idHD) REFERENCES HOADON(id),
    CONSTRAINT fk_CTHD_HH FOREIGN KEY(idHang) REFERENCES HANGHOA(id)
);

GO


CREATE TABLE LICHSU_HOATDONG (
    id INT IDENTITY(1,1) PRIMARY KEY,
    idNV INT NOT NULL, -- Nhân viên thực hiện
    loaiHoatDong NVARCHAR(50) NOT NULL, -- 'Tạo hóa đơn', 'Tạo phiếu nhập', 'Sửa hóa đơn', 'Xóa hóa đơn', 'Sửa phiếu nhập', 'Tạo khách hàng', 'Sửa khách hàng', 'Tạo hàng hóa', 'Sửa hàng hóa', v.v.
    moTa NVARCHAR(500), -- Mô tả chi tiết: "Tạo hóa đơn HD00001 với tổng tiền 500,000đ"
    thamChieu NVARCHAR(50), -- Mã tham chiếu: maHD, maPN, maKH, maHang, v.v.
    idThamChieu INT NULL, -- ID tham chiếu: idHD, idPN, idKH, idHang, v.v.
    thoiGian DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_LSHD_NV FOREIGN KEY(idNV) REFERENCES NHANVIEN(id)
);
GO

-- Tạo index để tìm kiếm nhanh
CREATE INDEX idx_LSHD_idNV ON LICHSU_HOATDONG(idNV);
CREATE INDEX idx_LSHD_thoiGian ON LICHSU_HOATDONG(thoiGian DESC);
CREATE INDEX idx_LSHD_loaiHoatDong ON LICHSU_HOATDONG(loaiHoatDong);
GO
-- =============================================
-- 5. TRIGGER TỰ ĐỘNG CẬP NHẬT KHO
-- =============================================

CREATE OR ALTER TRIGGER trg_CapNhatKhoSauBanHang
ON CHITIET_HD
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    -- Trừ kho
    UPDATE HANGHOA SET soluong = HANGHOA.soluong - i.soluong
    FROM HANGHOA JOIN inserted i ON HANGHOA.id = i.idHang;
    UPDATE KHACHHANG SET tongchi = tongchi + i.thanhTien,
                         diemtichluy = diemtichluy + (CAST(i.thanhTien AS INT) / 100000)
    FROM KHACHHANG 
    JOIN HOADON h ON KHACHHANG.id = h.idKH
    JOIN inserted i ON h.id = i.idHD;
END;
GO

CREATE TABLE NHACUNGCAP(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maNCC AS ('NCC' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED,
    tenNCC NVARCHAR(100) NOT NULL,
    sdt VARCHAR(15),
    email NVARCHAR(100),
    diachi NVARCHAR(200),
    ghiChu NVARCHAR(500),
    trangthai BIT DEFAULT 1, -- 1: Hoạt động, 0: Ngừng hợp tác
    ngayTao DATETIME DEFAULT GETDATE()
);
GO

-- Bảng PHIEUNHAP
CREATE TABLE PHIEUNHAP(
    id INT IDENTITY(1,1) PRIMARY KEY,
    maPN AS ('PN' + RIGHT('000' + CAST(id AS VARCHAR(5)), 5)) PERSISTED,
    ngayNhap DATETIME DEFAULT GETDATE(),
    idNV INT NOT NULL, -- Người nhập (quản lý hoặc thủ kho)
    idNCC INT NULL, -- Nhà cung cấp (có thể NULL)
    tongTien MONEY DEFAULT 0,
    CONSTRAINT fk_PN_NV FOREIGN KEY(idNV) REFERENCES NHANVIEN(id),
    CONSTRAINT fk_PN_NCC FOREIGN KEY(idNCC) REFERENCES NHACUNGCAP(id)
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
```

## 👤 Tác giả

**FMSTYLE Development Team**

---

## 📄 License

ISC License

---

## 🙏 Lời cảm ơn

Cảm ơn bạn đã sử dụng Hệ Thống Quản Lý Cửa Hàng FMSTYLE!

Nếu có bất kỳ câu hỏi hoặc đề xuất nào, vui lòng liên hệ với chúng tôi.
