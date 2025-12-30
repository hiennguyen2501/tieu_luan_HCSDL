// Khai báo các page (vitri, phanloaikh…)
const pages = {
    vitri: {
        title: 'Quản Lý Vị Trí',
        api: 'vitri',
        fields: [
            { name: 'tenVT', label: 'Tên Vị Trí', type: 'text', required: true }
        ],
        displayFields: ['id', 'tenVT']
    },
    phanloaikh: {
        title: 'Quản Lý Phân Loại Khách Hàng',
        api: 'phanloaikh',
        fields: [
            { name: 'maPLKH', label: 'Mã PLKH', type: 'text', required: false },
            { name: 'tenPLKH', label: 'Tên PLKH', type: 'text', required: true },
            { name: 'nguongChiMin', label: 'Ngưỡng Chi Tối Thiểu', type: 'number', required: false }
        ],
        displayFields: ['id', 'maPLKH', 'tenPLKH', 'nguongChiMin']
    },
    khachhang: {
        title: 'Quản Lý Khách Hàng',
        api: 'khachhang',
        fields: [
            { name: 'tenKH', label: 'Tên KH', type: 'text', required: true },
            { name: 'idPLKH', label: 'Phân Loại KH', type: 'select', required: true },
            { name: 'diachi', label: 'Địa Chỉ', type: 'text', required: false },
            { name: 'sdt', label: 'SĐT', type: 'text', required: false }
        ],
        displayFields: ['id', 'maKH', 'tenKH', 'tenPLKH', 'diachi', 'sdt', 'diemtichluy', 'tongchi']
    },
    nhanvien: {
        title: 'Quản Lý Nhân Viên',
        api: 'nhanvien',
        fields: [
            { name: 'tenNV', label: 'Tên NV', type: 'text', required: true },
            { name: 'gioitinh', label: 'Giới Tính', type: 'select', options: [{ value: '', label: 'Chọn' }, { value: 'Nam', label: 'Nam' }, { value: 'Nữ', label: 'Nữ' }], required: false },
            { name: 'sdt', label: 'SĐT', type: 'text', required: false },
            { name: 'idVT', label: 'Vị Trí', type: 'select', required: true }
        ],
        displayFields: ['id', 'maNV', 'tenNV', 'sdt', 'gioitinh', 'tenVT', 'trangthai']
    },
    hanghoa: {
        title: 'Quản Lý Hàng Hóa',
        api: 'hanghoa',
        fields: [
            { name: 'tenHang', label: 'Tên Hàng', type: 'text', required: true },
            { name: 'idPLSP', label: 'Phân Loại Sản Phẩm', type: 'select', required: true },
            { name: 'soluong', label: 'Số Lượng', type: 'number', required: false },
            { name: 'gianhap', label: 'Giá Nhập', type: 'number', required: false },
            { name: 'giaban', label: 'Giá Bán', type: 'number', required: false },
            { name: 'tonKhoToiThieu', label: 'Tồn Kho Tối Thiểu', type: 'number', required: false }
        ],
        displayFields: ['id', 'maHang', 'tenHang', 'tenPLSP', 'soluong', 'gianhap', 'giaban', 'tonKhoToiThieu', 'ngayNhapCuoi']
    },
    hoadon: {
        title: 'Quản Lý Hóa Đơn',
        api: 'hoadon',
        fields: [
            { name: 'idNV', label: 'Nhân Viên', type: 'select', required: true },
            { name: 'idKH', label: 'Khách Hàng', type: 'select', required: true },
            { name: 'idKM', label: 'Khuyến Mãi', type: 'select', required: false },
            { name: 'loaiGiaoDich', label: 'Loại Giao Dịch', type: 'text', required: false },
            { name: 'diemDaDung', label: 'Điểm Đã Dùng', type: 'number', required: false }
        ],
        displayFields: ['id', 'maHD', 'tenNhanVien', 'tenKhachHang', 'ngayLap', 'tongTien', 'diemDaDung', 'loaiGiaoDich'],
        customActions: true
    },
    chitiethd: {
        title: 'Quản Lý Chi Tiết Hóa Đơn',
        api: 'chitiethd',
        fields: [
            { name: 'idHD', label: 'Hóa Đơn', type: 'select', required: true },
            { name: 'idHang', label: 'Hàng Hóa', type: 'select', required: true },
            { name: 'soluong', label: 'Số Lượng', type: 'number', required: true },
            { name: 'dongia', label: 'Đơn Giá', type: 'number', required: true }
        ],
        displayFields: ['maHD', 'maHang', 'tenHang', 'soluong', 'dongia', 'thanhTien'],
        compositeKey: ['idHD', 'idHang']
    },
    khuyenmai: {
        title: 'Quản Lý Khuyến Mãi',
        api: 'khuyenmai',
        fields: [
            { name: 'maKM', label: 'Mã KM', type: 'text', required: true },
            { name: 'tenKM', label: 'Tên KM', type: 'text', required: false },
            { name: 'phantramGiam', label: 'Phần Trăm Giảm (%)', type: 'number', required: true },
            { name: 'ngayBD', label: 'Ngày Bắt Đầu', type: 'date', required: false },
            { name: 'ngayKT', label: 'Ngày Kết Thúc', type: 'date', required: false }
        ],
        displayFields: ['id', 'maKM', 'tenKM', 'phantramGiam', 'ngayBD', 'ngayKT', 'trangthai']
    },
    phanloaisanpham: {
        title: 'Quản Lý Phân Loại Sản Phẩm',
        api: 'phanloaisanpham',
        fields: [
            { name: 'maPLSP', label: 'Mã PLSP', type: 'text', required: false },
            { name: 'tenPLSP', label: 'Tên PLSP', type: 'text', required: true }
        ],
        displayFields: ['id', 'maPLSP', 'tenPLSP']
    },
    phieunhap: {
        title: 'Quản Lý Phiếu Nhập Hàng',
        api: 'phieunhap',
        fields: [
            { name: 'idNV', label: 'Nhân Viên', type: 'select', required: true },
            { name: 'ngayNhap', label: 'Ngày Nhập', type: 'date', required: false }
        ],
        displayFields: ['id', 'maPN', 'ngayNhap', 'tenNhanVien', 'tongTien'],
        customActions: true
    }
};

