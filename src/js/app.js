// Logic chính (load page, CRUD, UI)
let currentPage = 'vitri';
let currentData = null;
let editingId = null;

// Show page
function showPage(pageName, element) {
    currentPage = pageName;
    editingId = null;

    // Update menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Activate clicked menu item
    if (element) {
        element.classList.add('active');
    } else {
        // Fallback: find menu item by page name
        const menuItems = Array.from(document.querySelectorAll('.menu-item'));
        const pageNames = Object.keys(pages);
        const pageIndex = pageNames.indexOf(pageName);
        if (pageIndex >= 0 && menuItems[pageIndex]) {
            menuItems[pageIndex].classList.add('active');
        }
    }

    // Load page
    loadPage();
}

// Load page content
async function loadPage() {
    const page = pages[currentPage];
    if (!page) return;

    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-header">
            <h2>${page.title}</h2>
            <p>Quản lý thông tin ${page.title.toLowerCase()}</p>
        </div>
        <div id="alert" class="alert"></div>
        <div class="toolbar">
            <button class="btn btn-primary" onclick="openAddModal()">
                ➕ Thêm Mới
            </button>
            <button class="btn btn-secondary" onclick="loadData()">
                🔄 Tải Lại
            </button>
        </div>
        <div id="table-container" class="table-container">
            <div class="loading">
                <div class="spinner"></div>
                <p>Đang tải dữ liệu...</p>
            </div>
        </div>
    `;

    await loadData();
}

// Load data
async function loadData() {
    const page = pages[currentPage];
    const container = document.getElementById('table-container');

    try {
        const result = await apiGet(page.api);

        if (result.success) {
            currentData = result.data;
            renderTable(result.data);
            showAlert(`Đã tải ${result.count || result.data.length} bản ghi`, 'success');
        } else {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Không có dữ liệu</p></div>';
            showAlert(result.message || 'Lỗi khi tải dữ liệu', 'error');
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>Lỗi kết nối server</p></div>';
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Render table
function renderTable(data) {
    const page = pages[currentPage];
    const container = document.getElementById('table-container');

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>Chưa có dữ liệu</p></div>';
        return;
    }

    let html = '<table><thead><tr>';
    page.displayFields.forEach(field => {
        html += `<th>${getFieldLabel(field)}</th>`;
    });
    html += '<th>Thao Tác</th></tr></thead><tbody>';

    data.forEach((item, index) => {
        html += '<tr>';
        page.displayFields.forEach(field => {
            let value = item[field];
            if (value === null || value === undefined) value = '-';
            if (typeof value === 'boolean') {
                value = value ? 'Còn hiệu lực' : 'Hết hiệu lực';
            }
            if (field === 'tongtien' || field === 'tiengiamgia' || field === 'tongTien') {
                value = value ? parseFloat(value).toLocaleString('vi-VN') + ' đ' : '0 đ';
            }
            if (field === 'phantramgiam') {
                value = value + '%';
            }
            if ((field === 'ngayNhap' || field === 'ngayNhapCuoi' || field === 'ngayLap') && value) {
                const date = new Date(value);
                if (field === 'ngayNhapCuoi') {
                    // ngayNhapCuoi là DATE, không có giờ
                    value = date.toLocaleDateString('vi-VN');
                } else {
                    // ngayNhap và ngayLap là DATETIME, có giờ
                    value = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                }
            }
            if (field === 'diemDaDung' && value !== null && value !== undefined) {
                value = parseInt(value) || 0;
            }
            html += `<td>${value}</td>`;
        });
        html += `<td class="action-btns">
            <button class="btn btn-warning btn-sm" onclick="openEditModal(${index})">✏️ Sửa</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem(${index})">🗑️ Xóa</button>`;
        
        // Add PDF and Excel export buttons for invoices
        if (currentPage === 'hoadon') {
            html += `<button class="btn btn-secondary btn-sm" onclick="exportPDF('${item.maHD}')">📄 PDF</button>`;
            html += `<button class="btn btn-success btn-sm" onclick="exportExcel('${item.maHD}')">📊 Excel</button>`;
        }
        
        // Add view detail button for phieunhap
        if (currentPage === 'phieunhap') {
            html += `<button class="btn btn-primary btn-sm" onclick="viewPhieuNhapDetail(${item.id}, '${item.maPN}')">👁️ Xem Chi Tiết</button>`;
        }
        
        html += `</td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Get field label
function getFieldLabel(fieldName) {
    const page = pages[currentPage];
    const field = page.fields.find(f => f.name === fieldName);
    return field ? field.label : fieldName;
}

// Open add modal
function openAddModal() {
    editingId = null;
    const page = pages[currentPage];
    
    // Custom UI for phieunhap
    if (currentPage === 'phieunhap') {
        renderCreatePhieuNhap();
        return;
    }
    
    document.getElementById('modal-title').textContent = `Thêm ${page.title}`;
    renderForm();
    document.getElementById('modal').classList.add('active');
}

// Open edit modal
function openEditModal(index) {
    editingId = index;
    const page = pages[currentPage];
    document.getElementById('modal-title').textContent = `Sửa ${page.title}`;
    renderForm(currentData[index]);
    document.getElementById('modal').classList.add('active');
}

// Render form
async function renderForm(data = null) {
    const page = pages[currentPage];
    const modalBody = document.getElementById('modal-body');

    let html = '<form id="data-form" onsubmit="saveData(event)">';
    
    for (const field of page.fields) {
        let value = data ? (data[field.name] ?? '') : '';
        
        // Format date for input
        if (field.type === 'date' && value && value.includes('T')) {
            value = value.split('T')[0];
        } else if (field.type === 'date' && value && !value.includes('T')) {
            // Already formatted
        } else if (field.type === 'number' && value !== '') {
            value = parseFloat(value);
        } else if (field.name === 'gioitinh') {
            // gioitinh is string 'Nam' or 'Nữ', keep as is
            value = value || '';
        } else if (field.type === 'select' && value === true) {
            value = '1';
        } else if (field.type === 'select' && value === false) {
            value = '0';
        } else if (field.type === 'select' && typeof value === 'boolean') {
            value = value ? '1' : '0';
        }
        
        // Special handling for invoice discount code - use codeMGG from data
        if (field.name === 'codeMGG' && data && data.codeMGG) {
            value = data.codeMGG;
        }
        
        html += `<div class="form-group">
            <label>${field.label} ${field.required ? '<span style="color:red">*</span>' : ''}</label>`;

        if (field.type === 'select') {
            html += `<select name="${field.name}" ${field.required ? 'required' : ''} id="select-${field.name}">`;
            
            // If field has predefined options, use them
            if (field.options) {
                field.options.forEach(opt => {
                    html += `<option value="${opt.value}" ${value == opt.value ? 'selected' : ''}>${opt.label}</option>`;
                });
            } else {
                // Load options dynamically from API
                html += '<option value="">Đang tải...</option>';
            }
            
            html += '</select>';
        } else {
            const inputType = field.type === 'number' ? 'number' :
                field.type === 'date' ? 'date' :
                    field.type === 'email' ? 'email' : 'text';
            const readonly = (field.name.includes('ma') && data && !field.name.includes('codeMGG')) ? 'readonly' : '';
            html += `<input type="${inputType}" name="${field.name}" value="${value}" ${field.required ? 'required' : ''} ${readonly} step="${field.type === 'number' ? 'any' : ''}" placeholder="${field.name === 'codeMGG' ? 'Nhập mã giảm giá (ví dụ: SALE10)' : ''}">`;
        }
        html += '</div>';
    }
    html += `<div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
        <button type="submit" class="btn btn-success">💾 Lưu</button>
    </div></form>`;

    modalBody.innerHTML = html;
    
    // Load dynamic select options - wait for DOM to be ready
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(async () => {
        const loadPromises = [];
        for (const field of page.fields) {
            if (field.type === 'select' && !field.options) {
                // Get the correct value from data for this specific field
                const fieldValue = data ? (data[field.name] ?? '') : '';
                loadPromises.push(loadSelectOptions(field.name, fieldValue));
            }
        }
        // Load all selects in parallel
        await Promise.all(loadPromises);
    });
}

// Load select options from API
async function loadSelectOptions(fieldName, selectedValue = '') {
    const select = document.getElementById(`select-${fieldName}`);
    if (!select) return;
    
    try {
        let apiEndpoint = '';
        let valueField = 'id';
        let labelField = '';
        
        if (fieldName === 'idNV') {
            apiEndpoint = 'nhanvien';
            labelField = 'tenNV';
        } else if (fieldName === 'idKH') {
            apiEndpoint = 'khachhang';
            labelField = 'tenKH';
        } else if (fieldName === 'idKM') {
            apiEndpoint = 'khuyenmai';
            labelField = 'tenKM';
        } else if (fieldName === 'idVT') {
            apiEndpoint = 'vitri';
            labelField = 'tenVT';
        } else if (fieldName === 'idPLKH') {
            apiEndpoint = 'phanloaikh';
            labelField = 'tenPLKH';
        } else if (fieldName === 'idPLSP') {
            apiEndpoint = 'phanloaisanpham';
            labelField = 'tenPLSP';
        } else if (fieldName === 'idHD') {
            apiEndpoint = 'hoadon';
            labelField = 'maHD';
        } else if (fieldName === 'idHang') {
            apiEndpoint = 'hanghoa';
            labelField = 'tenHang';
        }
        
        if (!apiEndpoint) return;
        
        const result = await apiGet(apiEndpoint);
        if (result.success && result.data && result.data.length > 0) {
            select.innerHTML = '<option value="">Chọn...</option>';
            result.data.forEach(item => {
                const optionValue = item[valueField];
                const optionLabel = item[labelField] || item[`ma${fieldName.replace('id', '')}`] || optionValue;
                // Convert both to string for comparison to handle number/string mismatch
                const selected = String(optionValue) === String(selectedValue) ? 'selected' : '';
                select.innerHTML += `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
            });
        } else {
            console.warn(`No data returned for ${fieldName} from ${apiEndpoint}:`, result);
            select.innerHTML = '<option value="">Không có dữ liệu</option>';
        }
    } catch (error) {
        console.error(`Error loading options for ${fieldName}:`, error);
        const select = document.getElementById(`select-${fieldName}`);
        if (select) {
            select.innerHTML = '<option value="">Lỗi tải dữ liệu</option>';
        }
    }
}

// Save data
async function saveData(event) {
    event.preventDefault();
    const page = pages[currentPage];
    const form = event.target;
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        if (value !== '') {
            if (key === 'gioitinh') {
                // gioitinh should be string 'Nam' or 'Nữ', not boolean
                data[key] = value; // Keep as string ('Nam' or 'Nữ')
            } else if (key.includes('ngay') || key.includes('date')) {
                data[key] = value;
            } else if (key === 'sdt') {
                // sdt must be string, not number
                data[key] = String(value);
            } else if (key.startsWith('id') || key.includes('id')) {
                // ID fields should be numbers
                data[key] = parseInt(value) || parseFloat(value);
            } else if (!isNaN(value) && value !== '') {
                // Other numeric fields
                data[key] = parseFloat(value);
            } else {
                data[key] = value;
            }
        }
    });

    try {
        let endpoint = page.api;
        let result;

        if (editingId !== null) {
            const item = currentData[editingId];
            if (page.compositeKey) {
                const keys = page.compositeKey.map(k => item[k]).join('/');
                endpoint += `/${keys}`;
            } else {
                // Use id for phieunhap, otherwise use ma field
                if (currentPage === 'phieunhap') {
                    endpoint += `/${item.id}`;
                } else {
                    const keyField = page.fields.find(f => f.name.includes('ma') && f.required);
                    endpoint += `/${item[keyField ? keyField.name : 'id']}`;
                }
            }
            result = await apiPut(endpoint, data);
        } else {
            result = await apiPost(endpoint, data);
        }

        if (result.success) {
            showAlert(result.message, 'success');
            closeModal();
            await loadData();
        } else {
            showAlert(result.message || 'Lỗi khi lưu dữ liệu', 'error');
        }
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Delete item
async function deleteItem(index) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
        return;
    }

    const page = pages[currentPage];
    const item = currentData[index];

    try {
        let endpoint = page.api;
        
        if (page.compositeKey) {
            const keys = page.compositeKey.map(k => item[k]).join('/');
            endpoint += `/${keys}`;
        } else {
            // Use id for phieunhap, otherwise use ma field
            if (currentPage === 'phieunhap') {
                endpoint += `/${item.id}`;
            } else {
                const keyField = page.fields.find(f => f.name.includes('ma') && f.required);
                endpoint += `/${item[keyField ? keyField.name : 'id']}`;
            }
        }

        const result = await apiDelete(endpoint);

        if (result.success) {
            showAlert(result.message, 'success');
            await loadData();
        } else {
            showAlert(result.message || 'Lỗi khi xóa dữ liệu', 'error');
        }
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Show alert as toast popup
function showAlert(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Set icon based on type
    let icon = 'ℹ️';
    let title = 'Thông báo';
    if (type === 'success') {
        icon = '✅';
        title = 'Thành công';
    } else if (type === 'error') {
        icon = '❌';
        title = 'Lỗi';
    } else if (type === 'info') {
        icon = 'ℹ️';
        title = 'Thông tin';
    }

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    // Add to container
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 3000);

    // Click to close
    toast.addEventListener('click', function(e) {
        if (e.target !== toast.querySelector('.toast-close')) {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    });
}

// Close modal
function closeModal() {
    document.getElementById('modal').classList.remove('active');
    editingId = null;
}

// Close modal when clicking outside
function initModalClose() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
}

// Export PDF
async function exportPDF(maHD) {
    try {
        const blob = await apiExportPDF(maHD);
        if (blob.success === false) {
            showAlert(blob.message || 'Lỗi khi xuất PDF', 'error');
            return;
        }
        
        // Create blob and download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HoaDon_${maHD}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showAlert('Xuất PDF thành công!', 'success');
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Export Excel
async function exportExcel(maHD) {
    try {
        const blob = await apiExportExcel(maHD);
        if (blob.success === false) {
            showAlert(blob.message || 'Lỗi khi xuất Excel', 'error');
            return;
        }
        
        // Create blob and download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HoaDon_${maHD}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showAlert('Xuất Excel thành công!', 'success');
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// View phieunhap detail
async function viewPhieuNhapDetail(id, maPN) {
    try {
        const [phieuNhapRes, chiTietRes] = await Promise.all([
            apiGet(`phieunhap/${id}`),
            apiGet(`chitietphieunhap/${id}`)
        ]);
        
        if (!phieuNhapRes.success || !chiTietRes.success) {
            showAlert('Không thể tải chi tiết phiếu nhập', 'error');
            return;
        }
        
        const phieuNhap = phieuNhapRes.data;
        const chiTiet = chiTietRes.data;
        
        const modal = document.getElementById('modal');
        document.getElementById('modal-title').textContent = `Chi Tiết Phiếu Nhập: ${maPN}`;
        
        let html = `
            <div style="padding: 20px;">
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0; color: #e65100;">📥 Phiếu Nhập: ${maPN}</h4>
                    <p style="margin: 5px 0 0 0; color: #666;">
                        Ngày nhập: ${new Date(phieuNhap.ngayNhap).toLocaleString('vi-VN')}<br>
                        Nhân viên: ${phieuNhap.tenNhanVien || phieuNhap.maNV || 'N/A'}
                    </p>
                </div>
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #1a2b48; margin-bottom: 10px;">Danh Sách Hàng Hóa</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">STT</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Mã Hàng</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Tên Hàng</th>
                                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Số Lượng</th>
                                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Đơn Giá</th>
                                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Thành Tiền</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        chiTiet.forEach((item, index) => {
            html += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${index + 1}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.maHang || 'N/A'}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.tenHang || 'N/A'}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${item.soluong || 0}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">${parseFloat(item.dongia || 0).toLocaleString('vi-VN')} đ</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd; font-weight: bold;">${parseFloat(item.thanhTien || 0).toLocaleString('vi-VN')} đ</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800; text-align: right;">
                    <div style="font-size: 18px; font-weight: bold; color: #e65100;">
                        Tổng Tiền: ${parseFloat(phieuNhap.tongTien || 0).toLocaleString('vi-VN')} đ
                    </div>
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Đóng</button>
                </div>
            </div>
        `;
        
        document.getElementById('modal-body').innerHTML = html;
        modal.classList.add('active');
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// ==================== PHIẾU NHẬP CUSTOM UI ====================
let phieuNhapCart = [];
let phieuNhapProducts = [];
let phieuNhapNhanVien = [];
let phieuNhapPhanLoaiSP = [];
let newProductsList = [];

// Render create phieu nhap UI
async function renderCreatePhieuNhap(keepCart = false) {
    const content = document.getElementById('page-content');
    // Chỉ reset cart nếu không phải quay lại từ trang thêm hàng hóa mới
    if (!keepCart) {
        phieuNhapCart = [];
        newProductsList = [];
    }
    
    // Load data
    const [productsRes, nhanvienRes, phanLoaiSPRes] = await Promise.all([
        apiGet('hanghoa'),
        apiGet('nhanvien'),
        apiGet('phanloaisanpham')
    ]);
    
    if (productsRes.success) phieuNhapProducts = productsRes.data;
    if (nhanvienRes.success) {
        phieuNhapNhanVien = nhanvienRes.data.filter(nv => {
            const tenVT = (nv.tenVT || '').toLowerCase();
            return tenVT.includes('quản lý') || tenVT.includes('quan ly') || 
                   tenVT.includes('thủ kho') || tenVT.includes('thu kho') ||
                   tenVT.includes('warehouse') || tenVT.includes('manager');
        });
    }
    if (phanLoaiSPRes.success) phieuNhapPhanLoaiSP = phanLoaiSPRes.data;
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>➕ Tạo Phiếu Nhập Hàng Mới</h2>
                <p>Chọn hoặc thêm hàng hóa vào phiếu nhập</p>
            </div>
            <button class="btn btn-outline" onclick="loadPage()">← Quay lại danh sách</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 420px; gap: 25px;">
            <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);">
                <div style="display: flex; gap: 12px; margin-bottom: 15px;">
                    <input type="text" id="search-phieunhap-product" placeholder="Tìm sản phẩm..." 
                           style="flex: 1; padding: 12px 16px; border: 2px solid #e8e8e8; border-radius: 10px; font-size: 14px;"
                           oninput="filterPhieuNhapProducts()">
                    <button class="btn btn-primary" onclick="filterPhieuNhapProducts()">Tìm</button>
                    <button class="btn btn-secondary" onclick="reloadPhieuNhapProducts()">Tải lại</button>
                    <button class="btn btn-success" onclick="renderAddNewProducts()">➕ Thêm Hàng Hóa Mới</button>
                </div>
                <div id="phieunhap-products" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px;"></div>
            </div>
            <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05); position: sticky; top: 25px; max-height: calc(100vh - 50px); overflow-y: auto;">
                <div style="font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 15px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0;">Danh Sách Nhập</div>
                <div id="phieunhap-cart-items"></div>
                <div id="phieunhap-cart-summary"></div>
            </div>
        </div>
    `;
    
    renderPhieuNhapProducts(phieuNhapProducts);
    renderPhieuNhapCart();
}

// Render products
function renderPhieuNhapProducts(products) {
    const container = document.getElementById('phieunhap-products');
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Không tìm thấy sản phẩm</div>';
        return;
    }
    
    container.innerHTML = products.map(p => `
        <div style="background: #fafafa; border-radius: 12px; padding: 15px; transition: all 0.3s; border: 2px solid transparent; cursor: pointer;"
             onclick="addToPhieuNhapCart('${p.maHang}')">
            <div style="font-weight: 700; color: #1a1a2e; font-size: 13px; margin-bottom: 5px;">${p.tenHang}</div>
            <div style="color: #888; font-size: 11px; margin-bottom: 8px;">${p.maHang}</div>
            <span style="font-size: 11px; padding: 3px 8px; border-radius: 15px; display: inline-block; margin-bottom: 8px; background: #e6fff5; color: #00b894;">
                Tồn kho: ${p.soluong} sp
            </span>
            <div style="font-size: 15px; font-weight: 700; color: #00b894; margin-bottom: 10px;">
                Giá nhập: ${parseFloat(p.gianhap || 0).toLocaleString('vi-VN')} đ
            </div>
            <button class="btn btn-primary" style="width: 100%; padding: 8px; font-size: 12px;" 
                    onclick="event.stopPropagation(); addToPhieuNhapCart('${p.maHang}')">
                Thêm vào phiếu
            </button>
        </div>
    `).join('');
}

function filterPhieuNhapProducts() {
    const keyword = document.getElementById('search-phieunhap-product')?.value.toLowerCase() || '';
    const filtered = phieuNhapProducts.filter(p =>
        p.maHang.toLowerCase().includes(keyword) ||
        p.tenHang.toLowerCase().includes(keyword)
    );
    renderPhieuNhapProducts(filtered);
}

async function reloadPhieuNhapProducts() {
    const result = await apiGet('hanghoa');
    if (result.success) {
        phieuNhapProducts = result.data;
        document.getElementById('search-phieunhap-product').value = '';
        renderPhieuNhapProducts(phieuNhapProducts);
        showAlert('Đã tải lại danh sách sản phẩm', 'success');
    }
}

function addToPhieuNhapCart(maHang) {
    const product = phieuNhapProducts.find(p => p.maHang === maHang);
    if (!product) {
        showAlert('Không tìm thấy sản phẩm', 'error');
        return;
    }
    
    const existingItem = phieuNhapCart.find(c => c.maHang === maHang && !c.isNew);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        phieuNhapCart.push({
            id: product.id,
            maHang: product.maHang,
            name: product.tenHang,
            price: product.gianhap || 0,
            quantity: 1
        });
    }
    
    renderPhieuNhapCart();
    showAlert(`Đã thêm ${product.tenHang}`, 'success');
}

function updatePhieuNhapCartQty(key, delta) {
    const item = phieuNhapCart.find(c => (c.isNew ? c.tempId : c.maHang) === key);
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
        if (item.isNew) {
            phieuNhapCart = phieuNhapCart.filter(c => c.tempId !== key);
        } else {
            phieuNhapCart = phieuNhapCart.filter(c => c.maHang !== key);
        }
    }
    renderPhieuNhapCart();
}

function removeFromPhieuNhapCart(key) {
    const item = phieuNhapCart.find(c => (c.isNew ? c.tempId : c.maHang) === key);
    if (item && item.isNew) {
        phieuNhapCart = phieuNhapCart.filter(c => c.tempId !== key);
    } else {
        phieuNhapCart = phieuNhapCart.filter(c => c.maHang !== key);
    }
    renderPhieuNhapCart();
}

function renderPhieuNhapCart() {
    const itemsContainer = document.getElementById('phieunhap-cart-items');
    const summaryContainer = document.getElementById('phieunhap-cart-summary');
    
    if (!itemsContainer || !summaryContainer) {
        setTimeout(() => renderPhieuNhapCart(), 100);
        return;
    }
    
    if (phieuNhapCart.length === 0) {
        itemsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><p>Chưa có sản phẩm</p></div>';
        summaryContainer.innerHTML = '';
        return;
    }
    
    itemsContainer.innerHTML = phieuNhapCart.map(item => {
        const itemKey = item.isNew ? item.tempId : item.maHang;
        const isNewBadge = item.isNew ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 5px;">MỚI</span>' : '';
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1a1a2e; font-size: 13px;">${item.name} ${isNewBadge}</div>
                    <div style="color: #00b894; font-weight: 600; font-size: 12px; margin-top: 3px;">
                        ${parseFloat(item.price).toLocaleString('vi-VN')} đ
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button onclick="updatePhieuNhapCartQty('${itemKey}', -1)" 
                            style="width: 28px; height: 28px; border: none; border-radius: 6px; background: #ffe6e6; color: #e74c3c; cursor: pointer; font-weight: 600;">−</button>
                    <span style="width: 35px; text-align: center; font-weight: 600; font-size: 14px;">${item.quantity}</span>
                    <button onclick="updatePhieuNhapCartQty('${itemKey}', 1)" 
                            style="width: 28px; height: 28px; border: none; border-radius: 6px; background: #e6fff5; color: #00b894; cursor: pointer; font-weight: 600;">+</button>
                </div>
                <button onclick="removeFromPhieuNhapCart('${itemKey}')" 
                        style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 16px; padding: 5px; margin-left: 10px;">✕</button>
            </div>
        `;
    }).join('');
    
    const subtotal = phieuNhapCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    summaryContainer.innerHTML = `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #e0e0e0;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Người Nhập</label>
                <select id="phieunhap-nhanvien-select" style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                    <option value="">-- Chọn nhân viên --</option>
                    ${phieuNhapNhanVien.map(nv => `<option value="${nv.id}">${nv.tenNV} (${nv.maNV})</option>`).join('')}
                </select>
                ${phieuNhapNhanVien.length === 0 ? '<p style="font-size: 11px; color: #dc2626; margin-top: 5px;">Không có nhân viên thủ kho/quản lý</p>' : ''}
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #666;">Tạm tính:</span>
                <span style="font-weight: 600;">${parseFloat(subtotal).toLocaleString('vi-VN')} đ</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #1a1a2e; padding-top: 10px; border-top: 2px solid #1a1a2e; margin-top: 12px;">
                <span>Tổng cộng:</span>
                <span>${parseFloat(subtotal).toLocaleString('vi-VN')} đ</span>
            </div>
            <button class="btn btn-success" onclick="createPhieuNhap()" style="width: 100%; margin-top: 15px;">
                Tạo Phiếu Nhập
            </button>
        </div>
    `;
}

async function createPhieuNhap() {
    if (phieuNhapCart.length === 0) {
        showAlert('Chưa có sản phẩm nào trong phiếu nhập', 'error');
        return;
    }
    
    const selectedNVValue = document.getElementById('phieunhap-nhanvien-select')?.value;
    if (!selectedNVValue) {
        showAlert('Vui lòng chọn người nhập', 'error');
        return;
    }
    
    try {
        // Tạo phiếu nhập
        const phieuNhapRes = await apiPost('phieunhap', { idNV: parseInt(selectedNVValue) });
        if (!phieuNhapRes.success) {
            showAlert(phieuNhapRes.message || 'Lỗi tạo phiếu nhập', 'error');
            return;
        }
        
        const idPN = phieuNhapRes.data.id;
        const maPN = phieuNhapRes.data.maPN;
        
        // Tách hàng hóa mới và hàng hóa có sẵn
        const newProducts = phieuNhapCart.filter(item => item.isNew === true);
        const existingProducts = phieuNhapCart.filter(item => !item.isNew);
        
        // Tạo hàng hóa mới trước (nếu có)
        if (newProducts.length > 0) {
            for (const newItem of newProducts) {
                const createProductRes = await apiPost('hanghoa', newItem.newProductData);
                if (!createProductRes.success) {
                    await apiDelete(`phieunhap/${idPN}`);
                    showAlert(`Lỗi: ${createProductRes.message}`, 'error');
                    return;
                }
                
                const newProduct = createProductRes.data;
                const detailRes = await apiPost('chitietphieunhap', {
                    idPN: idPN,
                    idHang: newProduct.id,
                    soluong: newItem.quantity,
                    dongia: newItem.price
                });
                
                if (!detailRes.success) {
                    await apiDelete(`phieunhap/${idPN}`);
                    showAlert(`Lỗi thêm sản phẩm ${newItem.name}: ${detailRes.message}`, 'error');
                    return;
                }
            }
        }
        
        // Thêm hàng hóa có sẵn
        for (const item of existingProducts) {
            const detailRes = await apiPost('chitietphieunhap', {
                idPN: idPN,
                idHang: item.id,
                soluong: item.quantity,
                dongia: item.price
            });
            
            if (!detailRes.success) {
                await apiDelete(`phieunhap/${idPN}`);
                showAlert(`Lỗi thêm sản phẩm ${item.name}: ${detailRes.message}`, 'error');
                return;
            }
        }
        
        showAlert(`Tạo phiếu nhập ${maPN} thành công! ${newProducts.length > 0 ? `Đã tạo ${newProducts.length} hàng hóa mới.` : ''}`, 'success');
        phieuNhapCart = [];
        newProductsList = [];
        // Quay lại trang danh sách phiếu nhập
        await loadPage();
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Render add new products view
function renderAddNewProducts() {
    const content = document.getElementById('page-content');
    newProductsList = [];
    
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>➕ Thêm Hàng Hóa Mới Vào Phiếu Nhập</h2>
                <p>Thêm hàng hóa mới vào phiếu nhập (sẽ được tạo khi lưu phiếu nhập)</p>
            </div>
                <button class="btn btn-outline" onclick="renderCreatePhieuNhap(true)">← Quay lại</button>
        </div>
        <div style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                <p style="margin: 0; color: #e65100; font-size: 13px;">
                    <strong>ℹ️ Lưu ý:</strong> Hàng hóa mới sẽ được thêm vào phiếu nhập và tự động tạo trong hệ thống khi bạn lưu phiếu nhập.
                </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #1a2b48;">Danh Sách Hàng Hóa Mới</h3>
                <button class="btn btn-primary" onclick="addNewProductRow()">➕ Thêm Dòng</button>
            </div>
            <div id="new-products-list" style="margin-bottom: 20px;"></div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; color: #1a2b48;">Tổng số hàng hóa:</span>
                    <span id="total-products-count" style="font-size: 18px; font-weight: 700; color: #1976d2;">0</span>
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-outline" onclick="renderCreatePhieuNhap()">Hủy</button>
                <button class="btn btn-success" onclick="addNewProductsToPhieuNhap()" id="add-to-phieunhap-btn" disabled>
                    ➕ Thêm Vào Phiếu Nhập (<span id="add-count">0</span>)
                </button>
            </div>
        </div>
    `;
    
    addNewProductRow();
}

function addNewProductRow() {
    const listContainer = document.getElementById('new-products-list');
    if (!listContainer) return;
    
    const rowId = 'product-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const productData = {
        id: rowId,
        tenHang: '',
        idPLSP: '',
        gianhap: 0,
        giaban: 0,
        soluong: 0,
        tonKhoToiThieu: 10
    };
    
    newProductsList.push(productData);
    
    const rowHTML = `
        <div class="product-form-row" id="${rowId}" style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 15px; border: 2px solid #e0e0e0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #1a2b48;">Hàng Hóa #${newProductsList.length}</h4>
                <button class="btn btn-danger btn-sm" onclick="removeProductRow('${rowId}')" style="padding: 6px 12px; font-size: 12px;">🗑️ Xóa</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Tên Hàng *</label>
                    <input type="text" class="product-input" data-id="${rowId}" data-field="tenHang" required placeholder="Nhập tên hàng hóa" 
                           onchange="updateProductData('${rowId}')" 
                           style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Phân Loại *</label>
                    <select class="product-input" data-id="${rowId}" data-field="idPLSP" required onchange="updateProductData('${rowId}')"
                            style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                        <option value="">-- Chọn --</option>
                        ${phieuNhapPhanLoaiSP.map(pl => `<option value="${pl.id}">${pl.tenPLSP}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Giá Nhập *</label>
                    <input type="number" class="product-input" data-id="${rowId}" data-field="gianhap" required min="0" step="1000" placeholder="0" 
                           onchange="updateProductData('${rowId}')"
                           style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Giá Bán *</label>
                    <input type="number" class="product-input" data-id="${rowId}" data-field="giaban" required min="0" step="1000" placeholder="0" 
                           onchange="updateProductData('${rowId}')"
                           style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Số Lượng</label>
                    <input type="number" class="product-input" data-id="${rowId}" data-field="soluong" min="0" value="0" placeholder="0" 
                           onchange="updateProductData('${rowId}')"
                           style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">Tồn Kho Tối Thiểu</label>
                    <input type="number" class="product-input" data-id="${rowId}" data-field="tonKhoToiThieu" min="0" value="10" placeholder="10" 
                           onchange="updateProductData('${rowId}')"
                           style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px;">
                </div>
            </div>
        </div>
    `;
    
    listContainer.insertAdjacentHTML('beforeend', rowHTML);
    updateSaveButton();
}

function removeProductRow(rowId) {
    newProductsList = newProductsList.filter(p => p.id !== rowId);
    const rowElement = document.getElementById(rowId);
    if (rowElement) rowElement.remove();
    updateRowNumbers();
    updateSaveButton();
}

function updateRowNumbers() {
    const rows = document.querySelectorAll('.product-form-row');
    rows.forEach((row, index) => {
        const header = row.querySelector('h4');
        if (header) header.textContent = `Hàng Hóa #${index + 1}`;
    });
}

function updateProductData(rowId) {
    const product = newProductsList.find(p => p.id === rowId);
    if (!product) return;
    
    const inputs = document.querySelectorAll(`[data-id="${rowId}"]`);
    inputs.forEach(input => {
        const field = input.dataset.field;
        if (field) {
            if (input.type === 'number') {
                product[field] = parseFloat(input.value) || 0;
            } else if (input.tagName === 'SELECT') {
                product[field] = input.value;
            } else {
                product[field] = input.value.trim();
            }
        }
    });
    updateSaveButton();
}

function updateSaveButton() {
    const totalCount = newProductsList.length;
    const validCount = newProductsList.filter(p => 
        p.tenHang && p.tenHang.trim() && p.idPLSP && parseInt(p.idPLSP) > 0 && p.gianhap > 0 && p.giaban > 0
    ).length;
    
    const countElement = document.getElementById('total-products-count');
    const addCountElement = document.getElementById('add-count');
    const addButton = document.getElementById('add-to-phieunhap-btn');
    
    if (countElement) countElement.textContent = totalCount;
    if (addCountElement) addCountElement.textContent = validCount;
    if (addButton) addButton.disabled = validCount === 0;
}

async function addNewProductsToPhieuNhap() {
    // Cập nhật lại dữ liệu từ form trước khi filter
    newProductsList.forEach(product => {
        const inputs = document.querySelectorAll(`[data-id="${product.id}"]`);
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (field) {
                if (input.type === 'number') {
                    product[field] = parseFloat(input.value) || 0;
                } else if (input.tagName === 'SELECT') {
                    product[field] = input.value;
                } else {
                    product[field] = input.value.trim();
                }
            }
        });
    });
    
    const validProducts = newProductsList.filter(p => 
        p.tenHang && p.tenHang.trim() && p.idPLSP && parseInt(p.idPLSP) > 0 && p.gianhap > 0 && p.giaban > 0
    );
    
    if (validProducts.length === 0) {
        showAlert('Không có hàng hóa hợp lệ để thêm. Vui lòng kiểm tra lại: Tên hàng, Phân loại, Giá nhập, Giá bán', 'error');
        return;
    }
    
    // Thêm vào cart với unique tempId cho mỗi sản phẩm
    validProducts.forEach((product, index) => {
        const tempId = 'NEW-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substr(2, 9);
        phieuNhapCart.push({
            id: null,
            tempId: tempId,
            maHang: 'MỚI',
            name: product.tenHang,
            price: product.gianhap,
            quantity: product.soluong || 1,
            isNew: true,
            newProductData: {
                tenHang: product.tenHang,
                idPLSP: parseInt(product.idPLSP),
                gianhap: product.gianhap,
                giaban: product.giaban,
                soluong: product.soluong || 0,
                tonKhoToiThieu: product.tonKhoToiThieu || 10
            }
        });
    });
    
    showAlert(`Đã thêm ${validProducts.length} hàng hóa mới vào phiếu nhập`, 'success');
    
    // Reload products và quay lại trang tạo phiếu nhập (giữ lại cart)
    try {
        const productsRes = await apiGet('hanghoa');
        if (productsRes.success) {
            phieuNhapProducts = productsRes.data;
        }
        // Giữ lại cart khi quay lại từ trang thêm hàng hóa mới
        renderCreatePhieuNhap(true);
    } catch (error) {
        console.error('Error reloading products:', error);
        // Vẫn quay lại dù có lỗi
        renderCreatePhieuNhap(true);
    }
}

// Initialize page on load
window.addEventListener('DOMContentLoaded', function() {
    initModalClose();
    loadPage();
});

