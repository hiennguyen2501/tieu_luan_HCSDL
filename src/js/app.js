// Logic chính (load page, CRUD, UI)
let currentPage = 'dashboard';
let currentData = null;
let allData = null; // Lưu toàn bộ dữ liệu để filter
let editingId = null;

// Dashboard và custom pages
let revenueChart = null;
let ordersChart = null;
let dashboardData = {
    products: [],
    customers: [],
    orders: []
};

// Nhà cung cấp
let nhacungcapList = [];
let editingNCCId = null;

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
    // Handle custom pages
    if (currentPage === 'dashboard') {
        await renderDashboard();
        return;
    } else if (currentPage === 'nhacungcap') {
        await renderNhacungcap();
        return;
    } else if (currentPage === 'lichsu') {
        await renderLichSu();
        return;
    }
    
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
            <div style="flex: 1; display: flex; gap: 10px; align-items: center;">
                <input type="text" 
                       id="search-input" 
                       placeholder="🔍 Tìm kiếm..." 
                       class="search-input"
                       style="flex: 1; max-width: 400px;"
                       oninput="filterTableData()"
                       onkeyup="if(event.key === 'Enter') filterTableData()">
                <button class="btn btn-secondary" onclick="clearSearch()" style="padding: 10px 16px;">
                    ✕ Xóa
                </button>
            </div>
            <div style="display: flex; gap: 10px;">
                ${currentPage !== 'hoadon' && currentPage !== 'hanghoa' ? `
                <button class="btn btn-primary" onclick="openAddModal()">
                    ➕ Thêm Mới
                </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="loadData()">
                    🔄 Tải Lại
                </button>
            </div>
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
            allData = result.data; // Lưu toàn bộ dữ liệu
            currentData = result.data;
            renderTable(result.data);
            // Clear search input
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
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
                value = value ? 'Hoạt động' : 'Không hoạt động';
            }
            if (field === 'tongtien' || field === 'tiengiamgia' || field === 'tongTien') {
                value = value ? parseFloat(value).toLocaleString('vi-VN') + ' đ' : '0 đ';
            }
            if (field === 'phantramgiam') {
                value = value + '%';
            }
            if ((field === 'ngayNhap' || field === 'ngayNhapCuoi' || field === 'ngayLap') && value) {
                if (field === 'ngayNhapCuoi') {
                    // ngayNhapCuoi là DATE, không có giờ
                    const date = new Date(value);
                    value = date.toLocaleDateString('vi-VN');
                } else {
                    // ngayNhap và ngayLap là DATETIME, có giờ - sử dụng formatDate để xử lý đúng timezone
                    value = formatDate(value);
                }
            }
            if (field === 'diemDaDung' && value !== null && value !== undefined) {
                value = parseInt(value) || 0;
            }
            // Hiển thị nhà cung cấp cho phiếu nhập
            if (field === 'tenNhaCungCap' && (value === null || value === undefined || value === '')) {
                value = '-';
            }
            html += `<td>${value}</td>`;
        });
        html += `<td class="action-btns">`;
        
        // Custom buttons for phieunhap
        if (currentPage === 'phieunhap') {
            html += `<button class="btn btn-primary btn-sm" onclick="viewPhieuNhapDetail(${item.id}, '${item.maPN}')">👁️ Xem</button>`;
            html += `<button class="btn btn-warning btn-sm" onclick="editPhieuNhap(${item.id}, '${item.maPN}')">✏️ Sửa</button>`;
            // Không có nút xóa cho phiếu nhập
        } else if (currentPage === 'hoadon') {
            // Hóa đơn: chỉ có nút xuất PDF/Excel, không có Sửa/Xóa
            html += `<button class="btn btn-secondary btn-sm" onclick="exportPDF('${item.maHD}')">📄 PDF</button>`;
            html += `<button class="btn btn-success btn-sm" onclick="exportExcel('${item.maHD}')">📊 Excel</button>`;
        } else {
            // Default buttons for other pages
            html += `<button class="btn btn-warning btn-sm" onclick="openEditModal(${index})">✏️ Sửa</button>`;
            html += `<button class="btn btn-danger btn-sm" onclick="deleteItem(${index})">🗑️ Xóa</button>`;
        }
        
        html += `</td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
    
    // Update search result count
    updateSearchResultCount(data.length);
}

// Filter table data
function filterTableData() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput || !allData) return;
    
    const keyword = searchInput.value.toLowerCase().trim();
    
    if (!keyword) {
        currentData = allData;
        renderTable(allData);
        return;
    }
    
    const page = pages[currentPage];
    if (!page) return;
    
    // Filter dữ liệu dựa trên tất cả các trường hiển thị
    const filtered = allData.filter(item => {
        return page.displayFields.some(field => {
            let value = item[field];
            
            // Convert value to string for searching
            if (value === null || value === undefined) value = '';
            if (typeof value === 'boolean') {
                value = value ? 'còn hiệu lực' : 'hết hiệu lực';
            }
            if (typeof value === 'number') {
                value = value.toString();
            }
            if (field === 'tongtien' || field === 'tiengiamgia' || field === 'tongTien') {
                value = value ? parseFloat(value).toLocaleString('vi-VN') : '0';
            }
            if (field === 'phantramgiam') {
                value = value + '%';
            }
            if ((field === 'ngayNhap' || field === 'ngayNhapCuoi' || field === 'ngayLap') && value) {
                if (field === 'ngayNhapCuoi') {
                    const date = new Date(value);
                    value = date.toLocaleDateString('vi-VN');
                } else {
                    // ngayNhap và ngayLap là DATETIME, có giờ - sử dụng formatDate để xử lý đúng timezone
                    value = formatDate(value);
                }
            }
            
            return String(value).toLowerCase().includes(keyword);
        });
    });
    
    currentData = filtered;
    renderTable(filtered);
}

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        filterTableData();
    }
}

// Update search result count
function updateSearchResultCount(count) {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const keyword = searchInput.value.trim();
    if (keyword && allData) {
        const totalCount = allData.length;
        if (count < totalCount) {
            // Show count in placeholder or tooltip
            searchInput.title = `Tìm thấy ${count}/${totalCount} kết quả`;
        } else {
            searchInput.title = '';
        }
    } else {
        searchInput.title = '';
    }
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
                // Use id for phieunhap and khuyenmai, otherwise use ma field
                if (currentPage === 'phieunhap' || currentPage === 'khuyenmai') {
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
            // Use id for phieunhap and khuyenmai, otherwise use ma field
            if (currentPage === 'phieunhap' || currentPage === 'khuyenmai') {
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
                    <div style="margin-top: 10px; color: #666; line-height: 1.8;">
                        <div style="margin-bottom: 5px;">
                            <strong>📅 Ngày nhập:</strong> ${formatDate(phieuNhap.ngayNhap)}
                        </div>
                        <div style="margin-bottom: 5px;">
                            <strong>👤 Nhân viên:</strong> ${phieuNhap.tenNhanVien || phieuNhap.maNV || 'N/A'}
                        </div>
                        <div style="margin-bottom: 5px;">
                            <strong>🏢 Nhà cung cấp:</strong> 
                            ${phieuNhap.tenNhaCungCap ? 
                                `<span style="color: #ff9800; font-weight: 600;">${phieuNhap.tenNhaCungCap}</span> <span style="color: #999;">(${phieuNhap.maNCC || ''})</span>` : 
                                '<span style="color: #999; font-style: italic;">Không có</span>'}
                        </div>
                    </div>
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

// Edit phieunhap - cho phép sửa giá nhập và số lượng
async function editPhieuNhap(id, maPN) {
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
        
        // Lưu id phiếu nhập để dùng khi save
        window.editingPhieuNhapId = id;
        window.editingPhieuNhapData = {
            phieuNhap: phieuNhap,
            chiTiet: chiTiet
        };
        
        const modal = document.getElementById('modal');
        document.getElementById('modal-title').textContent = `✏️ Sửa Phiếu Nhập: ${maPN}`;
        
        let html = `
            <div style="padding: 20px;">
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0; color: #e65100;">📥 Phiếu Nhập: ${maPN}</h4>
                    <p style="margin: 5px 0 0 0; color: #666;">
                        Ngày nhập: ${formatDate(phieuNhap.ngayNhap)}<br>
                        Nhân viên: ${phieuNhap.tenNhanVien || phieuNhap.maNV || 'N/A'}
                        ${phieuNhap.tenNhaCungCap ? `<br>Nhà cung cấp: ${phieuNhap.tenNhaCungCap} (${phieuNhap.maNCC || ''})` : ''}
                    </p>
                </div>
                <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                    <p style="margin: 0; color: #1565c0; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                        <span>ℹ️</span>
                        <span>Bạn có thể thay đổi số lượng và giá nhập (đơn giá) cho từng sản phẩm. Tổng tiền sẽ được tính lại tự động.</span>
                    </p>
                </div>
                <form id="edit-phieunhap-form" onsubmit="savePhieuNhapEdit(event)">
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #1a2b48; margin-bottom: 15px;">Danh Sách Hàng Hóa</h4>
                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px;">
        `;
        
        chiTiet.forEach((item, index) => {
            const safeId = `${id}_${item.idHang}`;
            html += `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 12px; border: 2px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 700; color: #1a2b48; font-size: 14px;">${item.tenHang || 'N/A'}</div>
                            <div style="font-size: 12px; color: #666; margin-top: 3px;">Mã: ${item.maHang || 'N/A'}</div>
                        </div>
                        <div style="font-size: 12px; color: #999;">STT: ${index + 1}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">📦 Số Lượng *</label>
                            <input type="number" 
                                   id="edit-soluong-${safeId}" 
                                   value="${item.soluong || 0}" 
                                   min="1" 
                                   required
                                   onchange="updatePhieuNhapEditTotal()"
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e8e8e8; border-radius: 6px; font-size: 13px; font-weight: 600; text-align: right;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 6px; color: #333; font-weight: 600; font-size: 12px;">💰 Giá Nhập (Đơn Giá) *</label>
                            <input type="number" 
                                   id="edit-dongia-${safeId}" 
                                   value="${item.dongia || 0}" 
                                   min="0" 
                                   step="1000"
                                   required
                                   onchange="updatePhieuNhapEditTotal()"
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e8e8e8; border-radius: 6px; font-size: 13px; font-weight: 600; color: #00b894; text-align: right;">
                            <div style="font-size: 11px; color: #999; margin-top: 4px;">Thành tiền: <span id="edit-thanhtien-${safeId}" style="font-weight: 700; color: #e65100;">${formatCurrency((item.soluong || 0) * (item.dongia || 0))}</span></div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        const currentTotal = chiTiet.reduce((sum, item) => sum + ((item.soluong || 0) * (item.dongia || 0)), 0);
        
        html += `
                        </div>
                    </div>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 14px; color: #666; font-weight: 500;">Tổng Tiền:</span>
                            <span id="edit-phieunhap-total" style="font-size: 20px; font-weight: 900; color: #e65100;">${formatCurrency(currentTotal)}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
                        <button type="submit" class="btn btn-success">💾 Lưu Thay Đổi</button>
                    </div>
                </form>
            </div>
        `;
        
        document.getElementById('modal-body').innerHTML = html;
        modal.classList.add('active');
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Update total when editing phieu nhap
function updatePhieuNhapEditTotal() {
    if (!window.editingPhieuNhapData || !window.editingPhieuNhapData.chiTiet) return;
    
    const chiTiet = window.editingPhieuNhapData.chiTiet;
    const idPN = window.editingPhieuNhapId;
    let total = 0;
    
    chiTiet.forEach(item => {
        const safeId = `${idPN}_${item.idHang}`;
        const soluongInput = document.getElementById(`edit-soluong-${safeId}`);
        const dongiaInput = document.getElementById(`edit-dongia-${safeId}`);
        const thanhtienSpan = document.getElementById(`edit-thanhtien-${safeId}`);
        
        if (soluongInput && dongiaInput) {
            const soluong = parseFloat(soluongInput.value) || 0;
            const dongia = parseFloat(dongiaInput.value) || 0;
            const thanhtien = soluong * dongia;
            
            total += thanhtien;
            
            if (thanhtienSpan) {
                thanhtienSpan.textContent = formatCurrency(thanhtien);
            }
        }
    });
    
    const totalSpan = document.getElementById('edit-phieunhap-total');
    if (totalSpan) {
        totalSpan.textContent = formatCurrency(total);
    }
}

// Save phieu nhap edit
async function savePhieuNhapEdit(event) {
    event.preventDefault();
    
    if (!window.editingPhieuNhapId || !window.editingPhieuNhapData) {
        showAlert('Không tìm thấy dữ liệu phiếu nhập', 'error');
        return;
    }
    
    const idPN = window.editingPhieuNhapId;
    const chiTiet = window.editingPhieuNhapData.chiTiet;
    
    try {
        let hasChanges = false;
        const updatePromises = [];
        
        // Cập nhật từng chi tiết
        for (const item of chiTiet) {
            const safeId = `${idPN}_${item.idHang}`;
            const soluongInput = document.getElementById(`edit-soluong-${safeId}`);
            const dongiaInput = document.getElementById(`edit-dongia-${safeId}`);
            
            if (!soluongInput || !dongiaInput) continue;
            
            const newSoluong = parseInt(soluongInput.value) || 0;
            const newDongia = parseFloat(dongiaInput.value) || 0;
            
            if (newSoluong <= 0) {
                showAlert(`Số lượng của ${item.tenHang} phải lớn hơn 0`, 'error');
                return;
            }
            
            // Kiểm tra xem có thay đổi không
            if (newSoluong !== (item.soluong || 0) || Math.abs(newDongia - (item.dongia || 0)) > 0.01) {
                hasChanges = true;
                
                // Cập nhật chi tiết phiếu nhập
                updatePromises.push(
                    apiPut(`chitietphieunhap/${idPN}/${item.idHang}`, {
                        soluong: newSoluong,
                        dongia: newDongia
                    })
                );
            }
        }
        
        if (!hasChanges) {
            showAlert('Không có thay đổi nào', 'info');
            closeModal();
            return;
        }
        
        // Thực hiện tất cả các cập nhật
        showAlert('Đang cập nhật phiếu nhập...', 'info');
        const results = await Promise.all(updatePromises);
        
        // Kiểm tra kết quả
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            showAlert(`Có ${failed.length} sản phẩm không thể cập nhật`, 'error');
            return;
        }
        
        // Cập nhật lại giá nhập của sản phẩm nếu giá nhập đã thay đổi
        for (const item of chiTiet) {
            const safeId = `${idPN}_${item.idHang}`;
            const dongiaInput = document.getElementById(`edit-dongia-${safeId}`);
            
            if (!dongiaInput) continue;
            
            const newDongia = parseFloat(dongiaInput.value) || 0;
            const oldDongia = item.dongia || 0;
            
            // Cập nhật giá nhập của sản phẩm nếu giá nhập đã thay đổi
            if (Math.abs(newDongia - oldDongia) > 0.01) {
                try {
                    await apiPut(`hanghoa/${item.maHang}`, {
                        gianhap: newDongia
                    });
                } catch (err) {
                    console.warn(`Không thể cập nhật giá nhập của ${item.tenHang}:`, err);
                }
            }
        }
        
        showAlert('Cập nhật phiếu nhập thành công!', 'success');
        closeModal();
        
        // Reload data
        await loadData();
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    } finally {
        // Cleanup
        window.editingPhieuNhapId = null;
        window.editingPhieuNhapData = null;
    }
}

// ==================== PHIẾU NHẬP CUSTOM UI ====================
let phieuNhapCart = [];
let phieuNhapProducts = [];
let phieuNhapNhanVien = [];
let phieuNhapPhanLoaiSP = [];
let newProductsList = [];
let phieuNhapNhacungcap = [];

// Render create phieu nhap UI
async function renderCreatePhieuNhap(keepCart = false) {
    const content = document.getElementById('page-content');
    // Chỉ reset cart nếu không phải quay lại từ trang thêm hàng hóa mới
    if (!keepCart) {
        phieuNhapCart = [];
        newProductsList = [];
    }
    
    // Load data
    const [productsRes, nhanvienRes, phanLoaiSPRes, nhacungcapRes] = await Promise.all([
        apiGet('hanghoa'),
        apiGet('nhanvien'),
        apiGet('phanloaisanpham'),
        apiGet('nhacungcap')
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
    if (nhacungcapRes.success) phieuNhapNhacungcap = nhacungcapRes.data;
    
    // Copy EXACTLY from staff.html
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>➕ Tạo Phiếu Nhập Hàng Mới</h2>
                <p>Chọn hoặc thêm hàng hóa vào phiếu nhập</p>
            </div>
            <button class="btn btn-outline" onclick="loadPage()">← Quay lại danh sách</button>
        </div>
        <div class="cart-section">
            <div class="products-panel">
                <div class="search-box" style="background: transparent; padding: 0; margin-bottom: 15px;">
                    <input type="text" class="search-input" id="search-phieunhap-product" placeholder="Tìm sản phẩm..." oninput="filterPhieuNhapProducts()">
                    <button class="btn btn-primary" onclick="filterPhieuNhapProducts()">Tìm</button>
                    <button class="btn btn-secondary" onclick="reloadPhieuNhapProducts()">Tải lại</button>
                    <button class="btn btn-success" onclick="renderAddNewProducts()">➕ Thêm Hàng Hóa Mới</button>
                </div>
                <div id="phieunhap-products" class="product-grid"></div>
            </div>
            <div class="cart-panel">
                <div class="panel-title">Danh Sách Nhập</div>
                <div id="phieunhap-cart-items"></div>
                <div id="phieunhap-cart-summary"></div>
            </div>
        </div>
    `;
    
    renderPhieuNhapProducts(phieuNhapProducts);
    // Đảm bảo DOM đã được render trước khi gọi renderPhieuNhapCart
    setTimeout(() => {
        renderPhieuNhapCart();
    }, 100);
}

// Render products
function renderPhieuNhapProducts(products) {
    const container = document.getElementById('phieunhap-products');
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="empty-state">Không tìm thấy sản phẩm</div>';
        return;
    }
    
    container.innerHTML = products.map(p => {
        const stockClass = p.soluong < 20 ? 'badge-warning' : p.soluong < 50 ? 'badge-info' : 'badge-success';
        return `
            <div class="product-card" onclick="addToPhieuNhapCart('${p.maHang}')">
                <div class="product-card-name">${p.tenHang}</div>
                <div class="product-card-code">${p.maHang}</div>
                <span class="product-card-stock ${stockClass}">
                    Tồn kho: ${p.soluong} sp
                </span>
                <div class="product-card-price">Giá nhập: ${formatCurrency(p.gianhap || 0)}</div>
                <div class="product-card-price">Giá bán: ${formatCurrency(p.giaban || 0)}</div>
                <button class="product-card-btn" onclick="event.stopPropagation(); addToPhieuNhapCart('${p.maHang}')">
                    Thêm vào phiếu
                </button>
            </div>
        `;
    }).join('');
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

function updatePhieuNhapCartQtyInput(key, value) {
    const item = phieuNhapCart.find(c => (c.isNew ? c.tempId : c.maHang) === key);
    if (!item) return;

    const qty = parseInt(value) || 1;
    
    if (qty <= 0) {
        if (item.isNew) {
            phieuNhapCart = phieuNhapCart.filter(c => c.tempId !== key);
        } else {
            phieuNhapCart = phieuNhapCart.filter(c => c.maHang !== key);
        }
        renderPhieuNhapCart();
        return;
    }
    
    // Validate tồn kho tối thiểu nếu có nhà cung cấp
    const selectedNCCValue = document.getElementById('phieunhap-nhacungcap-select')?.value || '';
    if (selectedNCCValue) {
        const selectedNCC = phieuNhapNhacungcap.find(ncc => ncc.id === parseInt(selectedNCCValue));
        if (selectedNCC && selectedNCC.defaultTonKho) {
            const minQty = selectedNCC.defaultTonKho;
            if (qty < minQty) {
                item.quantity = minQty;
                renderPhieuNhapCart();
                showAlert(`Số lượng tối thiểu từ nhà cung cấp ${selectedNCC.tenNCC} là ${minQty}`, 'warning');
                return;
            }
        }
    }
    
    item.quantity = qty;
    renderPhieuNhapCart();
}

function validatePhieuNhapCartQty(key, input) {
    const item = phieuNhapCart.find(c => (c.isNew ? c.tempId : c.maHang) === key);
    if (!item) return;

    const qty = parseInt(input.value) || 1;
    
    if (qty < 1) {
        input.value = 1;
        item.quantity = 1;
    } else {
        // Validate tồn kho tối thiểu nếu có nhà cung cấp
        const selectedNCCValue = document.getElementById('phieunhap-nhacungcap-select')?.value || '';
        if (selectedNCCValue) {
            const selectedNCC = phieuNhapNhacungcap.find(ncc => ncc.id === parseInt(selectedNCCValue));
            if (selectedNCC && selectedNCC.defaultTonKho) {
                const minQty = selectedNCC.defaultTonKho;
                if (qty < minQty) {
                    input.value = minQty;
                    item.quantity = minQty;
                    showAlert(`Số lượng tối thiểu từ nhà cung cấp ${selectedNCC.tenNCC} là ${minQty}`, 'warning');
                } else {
                    item.quantity = qty;
                }
            } else {
                item.quantity = qty;
            }
        } else {
            item.quantity = qty;
        }
    }

    renderPhieuNhapCart();
}

function updatePhieuNhapCartPrice(key, value) {
    const item = phieuNhapCart.find(c => (c.isNew ? c.tempId : c.maHang) === key);
    if (!item) return;

    const price = parseFloat(value) || 0;
    
    if (price < 0) {
        item.price = 0;
        showAlert('Giá nhập không thể âm, đã đặt về 0', 'warning');
    } else {
        item.price = price;
        // Hiển thị thông báo nếu giá thay đổi đáng kể
        const originalPrice = phieuNhapProducts.find(p => p.id === item.id)?.gianhap || 0;
        if (originalPrice > 0 && Math.abs(price - originalPrice) / originalPrice > 0.1) {
            // Thay đổi hơn 10%
            console.log(`Giá nhập đã thay đổi từ ${formatCurrency(originalPrice)} sang ${formatCurrency(price)}`);
        }
    }
    
    renderPhieuNhapCart();
}

function validatePhieuNhapCartPrice(key, input) {
    const item = phieuNhapCart.find(c => (c.isNew ? c.tempId : c.maHang) === key);
    if (!item) return;

    let price = parseFloat(input.value) || 0;
    
    if (price < 0) {
        price = 0;
        input.value = 0;
        item.price = 0;
        showAlert('Giá nhập không thể âm, đã đặt về 0', 'warning');
    } else {
        // Làm tròn về bội số của 1000
        price = Math.round(price / 1000) * 1000;
        input.value = price;
        item.price = price;
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
        itemsContainer.innerHTML = '<div class="cart-empty"><p>Chưa có sản phẩm</p></div>';
        summaryContainer.innerHTML = '';
        return;
    }
    
    itemsContainer.innerHTML = phieuNhapCart.map(item => {
        const itemKey = item.isNew ? item.tempId : item.maHang;
        const isNewBadge = item.isNew ? '<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 5px;">MỚI</span>' : '';
        // Escape các ký tự đặc biệt
        const safeName = (item.name || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;");
        const safeKey = (itemKey || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;");
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${safeName} ${isNewBadge}</div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                        <span style="font-size: 11px; color: #666; font-weight: 500;">💰 Giá nhập:</span>
                        <input type="number" class="price-input" value="${item.price}" min="0" step="1000"
                               onchange="updatePhieuNhapCartPrice('${safeKey}', this.value)"
                               onblur="validatePhieuNhapCartPrice('${safeKey}', this)"
                               oninput="this.style.borderColor='#00b894'"
                               style="width: 120px; padding: 6px 10px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 13px; font-weight: 600; color: #00b894; text-align: right; transition: all 0.3s;"
                               title="Có thể thay đổi giá nhập tại đây">
                        <span style="font-size: 11px; color: #999;">đ</span>
                        <span style="font-size: 10px; color: #999; font-style: italic;">(có thể chỉnh sửa)</span>
                    </div>
                </div>
                <div class="cart-item-qty">
                    <input type="number" class="qty-input" value="${item.quantity}" min="1" 
                           onchange="updatePhieuNhapCartQtyInput('${safeKey}', this.value)" 
                           onblur="validatePhieuNhapCartQty('${safeKey}', this)">
                </div>
                <button class="cart-item-remove" onclick="removeFromPhieuNhapCart('${safeKey}')">✕</button>
            </div>
        `;
    }).join('');
    
    const subtotal = phieuNhapCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    summaryContainer.innerHTML = `
        <div class="cart-summary">
            <div class="form-group">
                <label>Người Nhập</label>
                <select id="phieunhap-nhanvien-select">
                    <option value="">-- Chọn nhân viên --</option>
                    ${phieuNhapNhanVien.map(nv => `<option value="${nv.id}">${nv.tenNV} (${nv.maNV})</option>`).join('')}
                </select>
                ${phieuNhapNhanVien.length === 0 ? '<p style="font-size: 11px; color: #dc2626; margin-top: 5px;">Không có nhân viên thủ kho/quản lý</p>' : ''}
            </div>

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 6px;">
                    <span>📅</span>
                    <span>Ngày Nhập</span>
                </label>
                <input type="date" id="phieunhap-ngaynhap-input" 
                       style="width: 100%; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px; transition: all 0.3s ease;"
                       onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                       onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                <p style="font-size: 11px; color: #999; margin-top: 5px; display: flex; align-items: center; gap: 4px;">
                    <span>💡</span>
                    <span>Để trống sẽ dùng ngày hiện tại</span>
                </p>
            </div>

            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 6px;">
                    <span>🏢</span>
                    <span>Nhà Cung Cấp</span>
                </label>
                <div style="display: flex; gap: 8px;">
                    <select id="phieunhap-nhacungcap-select" style="flex: 1; padding: 10px 14px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px; transition: all 0.3s ease;"
                            onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                            onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                        <option value="">-- Không chọn --</option>
                        ${phieuNhapNhacungcap.map(ncc => `<option value="${ncc.id}">${ncc.tenNCC} (${ncc.maNCC})</option>`).join('')}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="openNewSupplierModal()" 
                            style="padding: 10px 16px; font-size: 13px; font-weight: 600; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255, 152, 0, 0.4)'"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(255, 152, 0, 0.3)'"
                            title="Thêm nhà cung cấp mới">
                        <span style="font-size: 16px; margin-right: 4px;">➕</span>
                        <span>Thêm</span>
                    </button>
                </div>
                <p style="font-size: 11px; color: #999; margin-top: 5px; display: flex; align-items: center; gap: 4px;">
                    <span>💡</span>
                    <span>Có thể để trống nếu không có nhà cung cấp</span>
                </p>
            </div>

            <div class="cart-summary-row">
                <span class="label">Tạm tính:</span>
                <span class="value">${formatCurrency(subtotal)}</span>
            </div>
            <div class="cart-summary-row total">
                <span>Tổng cộng:</span>
                <span>${formatCurrency(subtotal)}</span>
            </div>
            
            <button class="btn btn-success" style="width: 100%; margin-top: 15px;" onclick="createPhieuNhap()">
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
        // Lấy nhà cung cấp (nếu có)
        const selectedNCCValue = document.getElementById('phieunhap-nhacungcap-select')?.value || '';
        const idNCC = selectedNCCValue ? parseInt(selectedNCCValue) : null;
        
        // Lấy ngày nhập (nếu có)
        const ngayNhapInput = document.getElementById('phieunhap-ngaynhap-input')?.value || '';
        const ngayNhap = ngayNhapInput || null;
        
        // Validate tồn kho tối thiểu nếu có nhà cung cấp
        if (idNCC) {
            const selectedNCC = phieuNhapNhacungcap.find(ncc => ncc.id === idNCC);
            if (selectedNCC && selectedNCC.defaultTonKho) {
                const minQty = selectedNCC.defaultTonKho;
                const invalidItems = phieuNhapCart.filter(item => item.quantity < minQty);
                if (invalidItems.length > 0) {
                    const itemNames = invalidItems.map(item => item.name).join(', ');
                    showAlert(`Số lượng tối thiểu từ nhà cung cấp ${selectedNCC.tenNCC} là ${minQty}. Vui lòng kiểm tra: ${itemNames}`, 'error');
                    return;
                }
            }
        }
        
        // Tạo phiếu nhập
        const phieuNhapData = { 
            idNV: parseInt(selectedNVValue),
            idNCC: idNCC
        };
        if (ngayNhap) {
            phieuNhapData.ngayNhap = ngayNhap;
        }
        const phieuNhapRes = await apiPost('phieunhap', phieuNhapData);
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
        
        // Thêm hàng hóa có sẵn và cập nhật giá nhập
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
            
            // Cập nhật giá nhập của sản phẩm nếu giá nhập đã thay đổi
            const product = phieuNhapProducts.find(p => p.id === item.id);
            if (product && Math.abs((product.gianhap || 0) - item.price) > 0.01) {
                try {
                    const updateRes = await apiPut(`hanghoa/${product.maHang}`, {
                        gianhap: item.price
                    });
                    if (updateRes.success) {
                        console.log(`Đã cập nhật giá nhập của ${product.tenHang} từ ${formatCurrency(product.gianhap)} sang ${formatCurrency(item.price)}`);
                    }
                } catch (err) {
                    console.warn('Không thể cập nhật giá nhập:', err);
                    showAlert(`Lưu ý: Không thể cập nhật giá nhập của ${item.name}. Vui lòng cập nhật thủ công.`, 'warning');
                    // Không block việc tạo phiếu nhập nếu cập nhật giá nhập thất bại
                }
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
                soluong: 0, // Đặt = 0 vì trigger sẽ tự động cộng khi tạo chi tiết phiếu nhập
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

// ==================== DASHBOARD ====================
async function renderDashboard() {
    const content = document.getElementById('page-content');
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);
    
    // Load initial data if not loaded
    if (dashboardData.products.length === 0) {
        await loadDashboardInitialData();
    }
    
    // Nút thông báo - luôn hiển thị trong page-header của dashboard
    const notificationButtonHTML = `
            <div>
                <button onclick="openNotificationSection()" style="position: relative; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 600; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3); transition: all 0.3s; display: flex; align-items: center; gap: 8px;"
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255, 107, 107, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(255, 107, 107, 0.3)'">
                    <span style="font-size: 20px;">🔔</span>
                    <span>Thông Báo</span>
                    <span id="notification-badge-dashboard" style="position: absolute; top: -8px; right: -8px; background: #fff; color: #ff6b6b; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">0</span>
                </button>
            </div>
    `;
    
    // Copy EXACTLY from staff.html
    content.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Tổng Quan Hệ Thống</h2>
                <p>Thống kê nhanh hoạt động kinh doanh</p>
            </div>
            ${notificationButtonHTML}
        </div>
        <div class="stats-row">
            <div class="stat-card blue">
                <h3 id="stat-products">0</h3>
                <p>Sản phẩm trong kho</p>
            </div>
            <div class="stat-card green">
                <h3 id="stat-customers">0</h3>
                <p>Khách hàng</p>
            </div>
            <div class="stat-card orange">
                <h3 id="stat-orders">0</h3>
                <p>Hóa đơn hôm nay</p>
            </div>
            <div class="stat-card purple">
                <h3 id="stat-revenue">0đ</h3>
                <p>Doanh thu hôm nay</p>
            </div>
        </div>
        
        <!-- Charts Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            <!-- Revenue Chart -->
            <div class="chart-container">
                <div class="chart-header">
                    <div class="chart-title">📈 Biểu Đồ Doanh Thu</div>
                    <div class="chart-filter">
                        <select id="revenue-period" onchange="updateDashboardCharts()">
                            <option value="day">Theo Ngày</option>
                            <option value="month" selected>Theo Tháng</option>
                            <option value="year">Theo Năm</option>
                        </select>
                        <select id="revenue-year" onchange="updateDashboardCharts()" style="display: none;">
                            ${Array.from({length: 5}, (_, i) => {
                                const year = currentYear - i;
                                return `<option value="${year}" ${i === 0 ? 'selected' : ''}>${year}</option>`;
                            }).join('')}
                        </select>
                        <input type="month" id="revenue-month" onchange="updateDashboardCharts()" 
                               value="${currentYear}-${String(currentMonth).padStart(2, '0')}" 
                               style="display: none;">
                    </div>
                </div>
                <div class="chart-wrapper">
                    <canvas id="revenue-chart"></canvas>
                </div>
            </div>
            
            <!-- Orders Chart -->
            <div class="chart-container">
                <div class="chart-header">
                    <div class="chart-title">📊 Biểu Đồ Số Đơn Hàng</div>
                    <div class="chart-filter">
                        <select id="orders-period" onchange="updateDashboardCharts()">
                            <option value="day">Theo Ngày</option>
                            <option value="month" selected>Theo Tháng</option>
                            <option value="year">Theo Năm</option>
                        </select>
                        <select id="orders-year" onchange="updateDashboardCharts()" style="display: none;">
                            ${Array.from({length: 5}, (_, i) => {
                                const year = currentYear - i;
                                return `<option value="${year}" ${i === 0 ? 'selected' : ''}>${year}</option>`;
                            }).join('')}
                        </select>
                        <input type="month" id="orders-month" onchange="updateDashboardCharts()" 
                               value="${currentYear}-${String(currentMonth).padStart(2, '0')}" 
                               style="display: none;">
                    </div>
                </div>
                <div class="chart-wrapper">
                    <canvas id="orders-chart"></canvas>
                </div>
            </div>
        </div>
        
        <!-- Top Lists Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px;">
            <!-- Top Employees -->
            <div class="top-list-container">
                <div class="panel-title">👥 Top Nhân Viên Bán Chạy</div>
                <div id="top-employees-list"></div>
            </div>
            
            <!-- Loyal Customers -->
            <div class="top-list-container">
                <div class="panel-title">⭐ Khách Hàng Thân Thiết</div>
                <div id="loyal-customers-list"></div>
            </div>
            
            <!-- Best Selling Products -->
            <div class="top-list-container">
                <div class="panel-title">🔥 Sản Phẩm Bán Chạy</div>
                <div id="best-products-list"></div>
            </div>
        </div>
        
        <!-- Supplier Statistics Section -->
        <div style="margin-top: 30px;">
            <div class="panel-title" style="margin-bottom: 20px; font-size: 20px; font-weight: 700; color: #1a2b48;">
                🏢 Thống Kê Nhà Cung Cấp
            </div>
            
            <!-- Supplier Metrics Cards -->
            <div id="supplier-metrics-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-bottom: 25px;"></div>
            
            <!-- Supplier Content Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <!-- Top Suppliers -->
                <div class="top-list-container">
                    <div class="panel-title">⭐ Top Nhà Cung Cấp Theo Giá Trị</div>
                    <div id="top-suppliers-list"></div>
                </div>
                
                <!-- Supplier Summary Details -->
                <div class="top-list-container">
                    <div class="panel-title">📈 Chi Tiết Thống Kê</div>
                    <div id="supplier-summary"></div>
                </div>
            </div>
        </div>
        
        <!-- Warnings and Info -->
        <div id="stock-warnings"></div>
        <div id="slow-moving-warning"></div>
    `;

    try {
        const ordersRes = await apiGet('hoadon');
        const ordersData = ordersRes;

        const statProductsEl = document.getElementById('stat-products');
        const statCustomersEl = document.getElementById('stat-customers');
        const statOrdersEl = document.getElementById('stat-orders');
        const statRevenueEl = document.getElementById('stat-revenue');
        
        if (statProductsEl) statProductsEl.textContent = dashboardData.products.length;
        if (statCustomersEl) statCustomersEl.textContent = dashboardData.customers.length;

        if (ordersData.success && ordersData.data) {
            const today = new Date().toISOString().split('T')[0];
            const todayOrders = ordersData.data.filter(o => o.ngayLap && o.ngayLap.startsWith(today));
            if (statOrdersEl) statOrdersEl.textContent = todayOrders.length;
            const todayRevenue = todayOrders.reduce((sum, o) => sum + (parseFloat(o.tongTien) || 0), 0);
            if (statRevenueEl) statRevenueEl.textContent = formatCurrency(todayRevenue);
        } else {
            if (statOrdersEl) statOrdersEl.textContent = '0';
            if (statRevenueEl) statRevenueEl.textContent = '0đ';
        }

        // Load dashboard data
        await loadDashboardData();
        
        // Setup chart filters
        setupChartFilters();
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadDashboardInitialData() {
    try {
        const [productsRes, customersRes, ordersRes] = await Promise.all([
            apiGet('hanghoa'),
            apiGet('khachhang'),
            apiGet('hoadon')
        ]);
        
        if (productsRes.success) dashboardData.products = productsRes.data;
        if (customersRes.success) dashboardData.customers = customersRes.data;
        if (ordersRes.success) dashboardData.orders = ordersRes.data;
    } catch (error) {
        console.error('Error loading dashboard initial data:', error);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

// Format date - hiển thị đúng ngayLap từ database (không format hay convert gì cả)
// Parse trực tiếp từ ISO string để giữ nguyên giờ UTC
function formatDate(dateStr) {
    if (!dateStr) return '-';
    
    const dateStrClean = String(dateStr).trim();
    
    // Xử lý ISO format với Z (UTC): "2026-01-06T22:27:56.970Z"
    // Parse trực tiếp từ string, không dùng Date object để tránh timezone conversion
    if (dateStrClean.includes('T') && dateStrClean.endsWith('Z')) {
        const isoMatch = dateStrClean.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/);
        if (isoMatch) {
            const [, year, month, day, hour, minute] = isoMatch.map(Number);
            // Format trực tiếp từ UTC components - giữ nguyên giờ từ database
            const dayStr = String(day).padStart(2, '0');
            const monthStr = String(month).padStart(2, '0');
            const hourStr = String(hour).padStart(2, '0');
            const minuteStr = String(minute).padStart(2, '0');
            return `${dayStr}/${monthStr}/${year} ${hourStr}:${minuteStr}`;
        }
    }
    
    // SQL Server format: "YYYY-MM-DD HH:mm:ss" (không có Z)
    if (dateStrClean.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        const [datePart, timePart] = dateStrClean.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(minute).padStart(2, '0');
        return `${dayStr}/${monthStr}/${year} ${hourStr}:${minuteStr}`;
    }
    
    // DATE only: "YYYY-MM-DD" (không có giờ)
    if (dateStrClean.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStrClean.split('-').map(Number);
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        return `${dayStr}/${monthStr}/${year}`;
    }
    
    // Fallback: chỉ dùng khi không match các format trên
    return dateStrClean;
}

// Format datetime với đầy đủ giờ:phút:giây (dùng cho lịch sử hoạt động)
// Hiển thị đúng thoiGian từ database (không format hay convert gì cả)
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const dateStrClean = String(dateStr).trim();
    
    // Xử lý ISO format với Z (UTC): "2026-01-06T22:27:56.970Z"
    // Parse trực tiếp từ string, không dùng Date object để tránh timezone conversion
    if (dateStrClean.includes('T') && dateStrClean.endsWith('Z')) {
        const isoMatch = dateStrClean.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/);
        if (isoMatch) {
            const [, year, month, day, hour, minute, second] = isoMatch.map(Number);
            // Format trực tiếp từ UTC components - giữ nguyên giờ từ database
            const dayStr = String(day).padStart(2, '0');
            const monthStr = String(month).padStart(2, '0');
            const hourStr = String(hour).padStart(2, '0');
            const minuteStr = String(minute).padStart(2, '0');
            const secondStr = String(second || 0).padStart(2, '0');
            return `${dayStr}/${monthStr}/${year} ${hourStr}:${minuteStr}:${secondStr}`;
        }
    }
    
    // SQL Server format: "YYYY-MM-DD HH:mm:ss" (không có Z)
    if (dateStrClean.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        const [datePart, timePart] = dateStrClean.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(minute).padStart(2, '0');
        const secondStr = String(second || 0).padStart(2, '0');
        return `${dayStr}/${monthStr}/${year} ${hourStr}:${minuteStr}:${secondStr}`;
    }
    
    // Fallback: chỉ dùng khi không match các format trên
    return dateStrClean;
}

async function updateDashboardCharts() {
    await loadRevenueChart();
    await loadOrdersChart();
}

async function loadRevenueChart() {
    try {
        const period = document.getElementById('revenue-period')?.value || 'month';
        let url = `thongke/doanhthu?period=${period}`;
        
        if (period === 'month') {
            const monthInput = document.getElementById('revenue-month')?.value;
            if (monthInput) {
                const [year, month] = monthInput.split('-');
                const startDate = `${year}-${month}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${year}-${month}-${lastDay}`;
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
        } else if (period === 'year') {
            const year = document.getElementById('revenue-year')?.value || new Date().getFullYear();
            url += `&startDate=${year}-01-01&endDate=${year}-12-31`;
        } else {
            // Day: last 30 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            url += `&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
        }
        
        const result = await apiGet(url);
        
        if (result.success && result.data) {
            const data = result.data;
            let labels = [];
            let revenues = [];
            
            if (period === 'day') {
                // Group by date
                const grouped = {};
                data.forEach(item => {
                    const date = item.ngay || item.ngayLap?.split('T')[0];
                    if (date) {
                        if (!grouped[date]) grouped[date] = 0;
                        grouped[date] += parseFloat(item.tongDoanhThu || 0);
                    }
                });
                labels = Object.keys(grouped).sort();
                revenues = labels.map(date => grouped[date]);
            } else if (period === 'month') {
                // Group by month
                const grouped = {};
                data.forEach(item => {
                    const key = `${item.nam || new Date().getFullYear()}-${String(item.thang || 1).padStart(2, '0')}`;
                    if (!grouped[key]) grouped[key] = 0;
                    grouped[key] += parseFloat(item.tongDoanhThu || 0);
                });
                labels = Object.keys(grouped).sort();
                revenues = labels.map(key => grouped[key]);
                labels = labels.map(key => {
                    const [y, m] = key.split('-');
                    return `Tháng ${m}/${y}`;
                });
            } else if (period === 'year') {
                // Group by year
                const grouped = {};
                data.forEach(item => {
                    const year = item.nam || new Date().getFullYear();
                    if (!grouped[year]) grouped[year] = 0;
                    grouped[year] += parseFloat(item.tongDoanhThu || 0);
                });
                labels = Object.keys(grouped).sort();
                revenues = labels.map(year => grouped[year]);
                labels = labels.map(year => `Năm ${year}`);
            }
            
            const ctx = document.getElementById('revenue-chart');
            if (!ctx) return;
            
            if (revenueChart) {
                revenueChart.destroy();
            }
            
            if (typeof Chart !== 'undefined') {
                revenueChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Doanh Thu',
                            data: revenues,
                            borderColor: '#4a90e2',
                            backgroundColor: 'rgba(74, 144, 226, 0.1)',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#4a90e2',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointHoverBackgroundColor: '#4a90e2',
                            pointHoverBorderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                titleFont: {
                                    size: 14,
                                    weight: 'bold'
                                },
                                bodyFont: {
                                    size: 13
                                },
                                callbacks: {
                                    label: function(context) {
                                        return 'Doanh thu: ' + formatCurrency(context.parsed.y);
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    font: {
                                        size: 11
                                    }
                                }
                            },
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                },
                                ticks: {
                                    callback: function(value) {
                                        return formatCurrency(value);
                                    },
                                    font: {
                                        size: 11
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading revenue chart:', error);
    }
}

async function loadOrdersChart() {
    try {
        const period = document.getElementById('orders-period')?.value || 'month';
        let url = `thongke/doanhthu?period=${period}`;
        
        if (period === 'month') {
            const monthInput = document.getElementById('orders-month')?.value;
            if (monthInput) {
                const [year, month] = monthInput.split('-');
                const startDate = `${year}-${month}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endDate = `${year}-${month}-${lastDay}`;
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }
        } else if (period === 'year') {
            const year = document.getElementById('orders-year')?.value || new Date().getFullYear();
            url += `&startDate=${year}-01-01&endDate=${year}-12-31`;
        } else {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            url += `&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
        }
        
        const result = await apiGet(url);
        
        if (result.success && result.data) {
            const data = result.data;
            let labels = [];
            let orders = [];
            
            if (period === 'day') {
                const grouped = {};
                data.forEach(item => {
                    const date = item.ngay || item.ngayLap?.split('T')[0];
                    if (date) {
                        if (!grouped[date]) grouped[date] = 0;
                        grouped[date] += parseInt(item.soHoaDon || 0);
                    }
                });
                labels = Object.keys(grouped).sort();
                orders = labels.map(date => grouped[date]);
            } else if (period === 'month') {
                const grouped = {};
                data.forEach(item => {
                    const key = `${item.nam || new Date().getFullYear()}-${String(item.thang || 1).padStart(2, '0')}`;
                    if (!grouped[key]) grouped[key] = 0;
                    grouped[key] += parseInt(item.soHoaDon || 0);
                });
                labels = Object.keys(grouped).sort();
                orders = labels.map(key => grouped[key]);
                labels = labels.map(key => {
                    const [y, m] = key.split('-');
                    return `Tháng ${m}/${y}`;
                });
            } else if (period === 'year') {
                const grouped = {};
                data.forEach(item => {
                    const year = item.nam || new Date().getFullYear();
                    if (!grouped[year]) grouped[year] = 0;
                    grouped[year] += parseInt(item.soHoaDon || 0);
                });
                labels = Object.keys(grouped).sort();
                orders = labels.map(year => grouped[year]);
                labels = labels.map(year => `Năm ${year}`);
            }
            
            const ctx = document.getElementById('orders-chart');
            if (!ctx) return;
            
            if (ordersChart) {
                ordersChart.destroy();
            }
            
            if (typeof Chart !== 'undefined') {
                ordersChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Số Đơn Hàng',
                            data: orders,
                            borderColor: '#00b894',
                            backgroundColor: 'rgba(0, 184, 148, 0.1)',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#00b894',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointHoverBackgroundColor: '#00b894',
                            pointHoverBorderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                titleFont: {
                                    size: 14,
                                    weight: 'bold'
                                },
                                bodyFont: {
                                    size: 13
                                },
                                callbacks: {
                                    label: function(context) {
                                        return 'Số đơn hàng: ' + context.parsed.y + ' đơn';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    font: {
                                        size: 11
                                    }
                                }
                            },
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                },
                                ticks: {
                                    stepSize: 1,
                                    font: {
                                        size: 11
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading orders chart:', error);
    }
}

function setupChartFilters() {
    const revenuePeriod = document.getElementById('revenue-period');
    const ordersPeriod = document.getElementById('orders-period');
    
    if (revenuePeriod) {
        revenuePeriod.addEventListener('change', function() {
            const period = this.value;
            const yearSelect = document.getElementById('revenue-year');
            const monthInput = document.getElementById('revenue-month');
            if (period === 'year') {
                yearSelect.style.display = 'inline-block';
                monthInput.style.display = 'none';
            } else if (period === 'month') {
                yearSelect.style.display = 'none';
                monthInput.style.display = 'inline-block';
            } else {
                yearSelect.style.display = 'none';
                monthInput.style.display = 'none';
            }
        });
    }
    
    if (ordersPeriod) {
        ordersPeriod.addEventListener('change', function() {
            const period = this.value;
            const yearSelect = document.getElementById('orders-year');
            const monthInput = document.getElementById('orders-month');
            if (period === 'year') {
                yearSelect.style.display = 'inline-block';
                monthInput.style.display = 'none';
            } else if (period === 'month') {
                yearSelect.style.display = 'none';
                monthInput.style.display = 'inline-block';
            } else {
                yearSelect.style.display = 'none';
                monthInput.style.display = 'none';
            }
        });
    }
}

async function loadDashboardData() {
    try {
        // Load charts
        await loadRevenueChart();
        await loadOrdersChart();
        
        // Load top employees
        await loadTopEmployees();
        
        // Load loyal customers
        loadLoyalCustomers();
        
        // Load best selling products
        await loadBestSellingProducts();
        
        // Load stock warnings
        renderStockWarnings();
        
        // Load slow moving products
        await loadSlowMovingProducts();
        
        // Load supplier statistics
        await loadSupplierStatistics();
        
        // Update notification badge
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadTopEmployees() {
    try {
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const url = `thongke/doanhthu?period=day&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
        const result = await apiGet(url);
        
        if (result.success && result.data) {
            // Group by employee
            const employeeStats = {};
            result.data.forEach(item => {
                const idNV = item.idNV;
                if (!employeeStats[idNV]) {
                    employeeStats[idNV] = {
                        idNV: idNV,
                        tenNV: item.tenNhanVien || item.maNV || 'N/A',
                        maNV: item.maNV || '',
                        soHoaDon: 0,
                        tongDoanhThu: 0
                    };
                }
                employeeStats[idNV].soHoaDon += parseInt(item.soHoaDon || 0);
                employeeStats[idNV].tongDoanhThu += parseFloat(item.tongDoanhThu || 0);
            });
            
            const topEmployees = Object.values(employeeStats)
                .sort((a, b) => b.tongDoanhThu - a.tongDoanhThu)
                .slice(0, 5);
            
            const container = document.getElementById('top-employees-list');
            if (!container) return;
            
            if (topEmployees.length === 0) {
                container.innerHTML = '<div class="empty-state">Chưa có dữ liệu</div>';
                return;
            }
            
            container.innerHTML = topEmployees.map((emp, index) => `
                <div class="top-list-item">
                    <div class="top-list-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}">
                        ${index + 1}
                    </div>
                    <div class="top-list-info">
                        <div class="top-list-name">${emp.tenNV}</div>
                        <div class="top-list-detail">${emp.maNV} • ${emp.soHoaDon} đơn</div>
                    </div>
                    <div class="top-list-value">${formatCurrency(emp.tongDoanhThu)}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading top employees:', error);
    }
}

function loadLoyalCustomers() {
    try {
        const loyalCustomers = dashboardData.customers
            .filter(c => c.diemtichluy && c.diemtichluy > 0)
            .sort((a, b) => (b.diemtichluy || 0) - (a.diemtichluy || 0))
            .slice(0, 5);
        
        const container = document.getElementById('loyal-customers-list');
        if (!container) return;
        
        if (loyalCustomers.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có khách hàng thân thiết</div>';
            return;
        }
        
        container.innerHTML = loyalCustomers.map((customer, index) => `
            <div class="top-list-item">
                <div class="top-list-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}">
                    ${index + 1}
                </div>
                <div class="top-list-info">
                    <div class="top-list-name">${customer.tenKH}</div>
                    <div class="top-list-detail">${customer.maKH} ${customer.sdt ? '• ' + customer.sdt : ''}</div>
                </div>
                <div class="top-list-value">${customer.diemtichluy || 0} điểm</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading loyal customers:', error);
    }
}

async function loadBestSellingProducts() {
    try {
        const response = await apiGet('hoadon');
        
        if (response.success && response.data) {
            // Get all order details
            const productSales = {};
            
            for (const order of response.data) {
                if (!order.id) continue;
                try {
                    const detailRes = await apiGet(`chitiethd/${order.id}`);
                    
                    if (detailRes.success && detailRes.data) {
                        detailRes.data.forEach(item => {
                            const idHang = item.idHang;
                            if (!productSales[idHang]) {
                                productSales[idHang] = {
                                    idHang: idHang,
                                    maHang: item.maHang || '',
                                    tenHang: item.tenHang || '',
                                    soLuong: 0,
                                    tongTien: 0
                                };
                            }
                            productSales[idHang].soLuong += parseInt(item.soluong || 0);
                            productSales[idHang].tongTien += parseFloat(item.tongtien || 0);
                        });
                    }
                } catch (err) {
                    console.error('Error loading order details:', err);
                }
            }
            
            const bestProducts = Object.values(productSales)
                .sort((a, b) => b.soLuong - a.soLuong)
                .slice(0, 5);
            
            const container = document.getElementById('best-products-list');
            if (!container) return;
            
            if (bestProducts.length === 0) {
                container.innerHTML = '<div class="empty-state">Chưa có dữ liệu</div>';
                return;
            }
            
            container.innerHTML = bestProducts.map((product, index) => `
                <div class="top-list-item">
                    <div class="top-list-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}">
                        ${index + 1}
                    </div>
                    <div class="top-list-info">
                        <div class="top-list-name">${product.tenHang}</div>
                        <div class="top-list-detail">${product.maHang}</div>
                    </div>
                    <div class="top-list-value">${product.soLuong} sp</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading best selling products:', error);
        const container = document.getElementById('best-products-list');
        if (container) {
            container.innerHTML = '<div class="empty-state">Lỗi tải dữ liệu</div>';
        }
    }
}

async function loadSlowMovingProducts() {
    try {
        // Get all orders
        const response = await apiGet('hoadon');
        
        if (response.success && response.data) {
            const now = new Date();
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            const productSales = {};
            
            // Count sales for each product in the last 90 days
            for (const order of response.data) {
                if (!order.id || !order.ngayLap) continue;
                
                // Parse order date
                const orderDate = new Date(order.ngayLap);
                if (orderDate < ninetyDaysAgo) continue; // Skip orders older than 90 days
                
                try {
                    const detailRes = await apiGet(`chitiethd/${order.id}`);
                    
                    if (detailRes.success && detailRes.data) {
                        detailRes.data.forEach(item => {
                            const idHang = item.idHang;
                            if (!productSales[idHang]) {
                                productSales[idHang] = 0;
                            }
                            productSales[idHang] += parseInt(item.soluong || 0);
                        });
                    }
                } catch (err) {
                    // Skip errors
                }
            }
            
            // Find slow moving products:
            // 1. Sau 30 ngày nhập hàng không sinh bất cứ hóa đơn nào
            // 2. Số lượng bán trong 90 ngày gần nhất < 5 sản phẩm
            const slowMoving = dashboardData.products
                .filter(p => {
                    if (!p.ngayNhapCuoi) return false;
                    
                    // Parse ngayNhapCuoi
                    const ngayNhapCuoi = new Date(p.ngayNhapCuoi);
                    const thirtyDaysAfterImport = new Date(ngayNhapCuoi.getTime() + 30 * 24 * 60 * 60 * 1000);
                    
                    // Điều kiện 1: Sau 30 ngày nhập hàng không sinh bất cứ hóa đơn nào
                    const condition1 = now >= thirtyDaysAfterImport;
                    
                    // Điều kiện 2: Số lượng bán trong 90 ngày gần nhất < 5
                    const salesIn90Days = productSales[p.id] || 0;
                    const condition2 = salesIn90Days < 5;
                    
                    return condition1 && condition2;
                })
                .sort((a, b) => {
                    // Sort by ngayNhapCuoi (oldest first)
                    const dateA = new Date(a.ngayNhapCuoi || 0);
                    const dateB = new Date(b.ngayNhapCuoi || 0);
                    return dateA - dateB;
                })
                .slice(0, 5);
            
            const container = document.getElementById('slow-moving-warning');
            if (!container) return;
            
            if (slowMoving.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = `
                <div class="slow-moving-warning">
                    <h4>⚠️ Hàng Hóa Tồn Bán Chậm</h4>
                    ${slowMoving.map(p => `
                        <div class="stock-warning-item">
                            <span><strong>${p.tenHang}</strong> (${p.maHang})</span>
                            <span class="badge badge-warning">Tồn: ${p.soluong} sp</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Update notification badge
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading slow moving products:', error);
    }
}

async function loadSupplierStatistics() {
    try {
        // Đảm bảo nhacungcapList đã được load
        if (!nhacungcapList || nhacungcapList.length === 0) {
            const nhacungcapRes = await apiGet('nhacungcap');
            if (nhacungcapRes.success && nhacungcapRes.data) {
                nhacungcapList = nhacungcapRes.data;
            }
        }
        
        // Load phiếu nhập để tính thống kê
        const phieuNhapRes = await apiGet('phieunhap');
        
        if (phieuNhapRes.success && phieuNhapRes.data) {
            const phieuNhapList = phieuNhapRes.data;
            
            // Tính thống kê nhà cung cấp
            const supplierStats = {};
            
            phieuNhapList.forEach(pn => {
                if (pn.idNCC && pn.tenNhaCungCap) {
                    const idNCC = parseInt(pn.idNCC);
                    if (!isNaN(idNCC) && pn.tenNhaCungCap.trim()) {
                        if (!supplierStats[idNCC]) {
                            supplierStats[idNCC] = {
                                id: idNCC,
                                tenNCC: pn.tenNhaCungCap.trim(),
                                maNCC: (pn.maNCC || '').trim(),
                                soPhieuNhap: 0,
                                tongGiaTri: 0
                            };
                        }
                        supplierStats[idNCC].soPhieuNhap++;
                        const tongTien = parseFloat(pn.tongTien || 0);
                        if (!isNaN(tongTien)) {
                            supplierStats[idNCC].tongGiaTri += tongTien;
                        }
                    }
                }
            });
            
            // Calculate total value first (needed for percentage calculation)
            const totalValue = Object.values(supplierStats).reduce((sum, s) => sum + s.tongGiaTri, 0);
            const totalPhieuNhap = Object.values(supplierStats).reduce((sum, s) => sum + s.soPhieuNhap, 0);
            const suppliersWithOrders = Object.keys(supplierStats).length;
            
            // Top nhà cung cấp theo giá trị nhập hàng
            const topSuppliers = Object.values(supplierStats)
                .sort((a, b) => b.tongGiaTri - a.tongGiaTri)
                .slice(0, 5);
            
            // Render top suppliers
            const topSuppliersContainer = document.getElementById('top-suppliers-list');
            if (topSuppliersContainer) {
                if (topSuppliers.length === 0) {
                    topSuppliersContainer.innerHTML = '<div class="empty-state">Chưa có dữ liệu nhà cung cấp</div>';
                } else {
                    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#667eea', '#667eea'];
                    const rankIcons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    
                    topSuppliersContainer.innerHTML = topSuppliers.map((supplier, index) => {
                        const percentage = totalValue > 0 ? ((supplier.tongGiaTri / totalValue) * 100).toFixed(1) : 0;
                        return `
                            <div style="background: ${index < 3 ? 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)' : '#fff'}; border-radius: 10px; padding: 15px; margin-bottom: 12px; border-left: 4px solid ${rankColors[index]}; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;" 
                                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';" 
                                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)';">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${rankColors[index]}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: ${index < 3 ? '#fff' : '#1a2b48'}; flex-shrink: 0;">
                                        ${rankIcons[index] || (index + 1)}
                                    </div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 700; color: #1a2b48; font-size: 15px; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${supplier.tenNCC}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <span style="font-size: 12px; color: #666; background: #f0f0f0; padding: 3px 8px; border-radius: 4px;">${supplier.maNCC}</span>
                                            <span style="font-size: 12px; color: #999;">•</span>
                                            <span style="font-size: 12px; color: #4a90e2; font-weight: 500;">${supplier.soPhieuNhap} phiếu</span>
                                            <span style="font-size: 12px; color: #999;">•</span>
                                            <span style="font-size: 12px; color: #00b894; font-weight: 500;">${percentage}%</span>
                                        </div>
                                        <div style="background: #e0e0e0; border-radius: 4px; height: 4px; margin-top: 8px; overflow: hidden;">
                                            <div style="background: linear-gradient(90deg, ${rankColors[index]}, ${rankColors[index]}dd); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                                        </div>
                                    </div>
                                    <div style="text-align: right; flex-shrink: 0;">
                                        <div style="font-weight: 900; color: ${rankColors[index]}; font-size: 16px; margin-bottom: 2px;">
                                            ${formatCurrency(supplier.tongGiaTri)}
                                        </div>
                                        <div style="font-size: 11px; color: #999;">
                                            Giá trị nhập
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
            
            // Calculate additional statistics
            const totalSuppliers = (nhacungcapList && nhacungcapList.length) ? nhacungcapList.length : 0;
            const activeSuppliers = (nhacungcapList && nhacungcapList.length) ? nhacungcapList.filter(ncc => ncc.trangthai !== 0).length : 0;
            const inactiveSuppliers = totalSuppliers - activeSuppliers;
            const avgPhieuNhapPerSupplier = suppliersWithOrders > 0 ? (totalPhieuNhap / suppliersWithOrders).toFixed(1) : 0;
            const avgValuePerSupplier = suppliersWithOrders > 0 ? (totalValue / suppliersWithOrders) : 0;
            
            // Render metric cards
            const metricsContainer = document.getElementById('supplier-metrics-cards');
            if (metricsContainer) {
                metricsContainer.innerHTML = `
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Tổng Nhà Cung Cấp</div>
                            <div style="font-size: 24px; font-weight: 700;">📦</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; margin-bottom: 5px;">${totalSuppliers}</div>
                        <div style="font-size: 12px; opacity: 0.8;">${activeSuppliers} đang hoạt động</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(0, 184, 148, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Đang Hoạt Động</div>
                            <div style="font-size: 24px; font-weight: 700;">✅</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; margin-bottom: 5px;">${activeSuppliers}</div>
                        <div style="font-size: 12px; opacity: 0.8;">${totalSuppliers > 0 ? ((activeSuppliers / totalSuppliers) * 100).toFixed(1) : 0}% tổng số</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Có Giao Dịch</div>
                            <div style="font-size: 24px; font-weight: 700;">💼</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; margin-bottom: 5px;">${suppliersWithOrders}</div>
                        <div style="font-size: 12px; opacity: 0.8;">${totalPhieuNhap} phiếu nhập</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Tổng Giá Trị Nhập</div>
                            <div style="font-size: 24px; font-weight: 700;">💰</div>
                        </div>
                        <div style="font-size: 24px; font-weight: 900; margin-bottom: 5px; line-height: 1.2;">${formatCurrency(totalValue)}</div>
                        <div style="font-size: 12px; opacity: 0.8;">TB: ${formatCurrency(avgValuePerSupplier)}/NCC</div>
                    </div>
                `;
            }
            
            // Render summary details
            const summaryContainer = document.getElementById('supplier-summary');
            if (summaryContainer) {
                summaryContainer.innerHTML = `
                    <div style="padding: 10px 0;">
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 12px; border-left: 4px solid #667eea;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #666; font-size: 13px; font-weight: 500;">📋 Tổng Phiếu Nhập</span>
                                <span style="font-weight: 700; color: #667eea; font-size: 18px;">${totalPhieuNhap}</span>
                            </div>
                            <div style="font-size: 11px; color: #999; margin-top: 5px;">
                                Trung bình: ${avgPhieuNhapPerSupplier} phiếu/NCC
                            </div>
                        </div>
                        
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 12px; border-left: 4px solid #00b894;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #666; font-size: 13px; font-weight: 500;">📊 Tỷ Lệ Hoạt Động</span>
                                <span style="font-weight: 700; color: #00b894; font-size: 18px;">${totalSuppliers > 0 ? ((activeSuppliers / totalSuppliers) * 100).toFixed(1) : 0}%</span>
                            </div>
                            <div style="background: #e0e0e0; border-radius: 4px; height: 6px; margin-top: 8px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #00b894, #00cec9); height: 100%; width: ${totalSuppliers > 0 ? (activeSuppliers / totalSuppliers) * 100 : 0}%; transition: width 0.3s;"></div>
                            </div>
                        </div>
                        
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 12px; border-left: 4px solid #4a90e2;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #666; font-size: 13px; font-weight: 500;">🔄 Tỷ Lệ Giao Dịch</span>
                                <span style="font-weight: 700; color: #4a90e2; font-size: 18px;">${totalSuppliers > 0 ? ((suppliersWithOrders / totalSuppliers) * 100).toFixed(1) : 0}%</span>
                            </div>
                            <div style="font-size: 11px; color: #999; margin-top: 5px;">
                                ${suppliersWithOrders}/${totalSuppliers} nhà cung cấp có giao dịch
                            </div>
                        </div>
                        
                        <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border-radius: 8px; padding: 15px; margin-top: 15px; color: white;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-size: 13px; opacity: 0.95; font-weight: 500;">💵 Giá Trị Trung Bình</span>
                                <span style="font-weight: 900; font-size: 20px;">${formatCurrency(avgValuePerSupplier)}</span>
                            </div>
                            <div style="font-size: 11px; opacity: 0.85; margin-top: 5px;">
                                Mỗi nhà cung cấp có giao dịch
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            // Nếu không có dữ liệu
            const totalSuppliers = (nhacungcapList && nhacungcapList.length) ? nhacungcapList.length : 0;
            const activeSuppliers = (nhacungcapList && nhacungcapList.length) ? nhacungcapList.filter(ncc => ncc.trangthai !== 0).length : 0;
            
            // Render metric cards với dữ liệu cơ bản
            const metricsContainer = document.getElementById('supplier-metrics-cards');
            if (metricsContainer) {
                metricsContainer.innerHTML = `
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Tổng Nhà Cung Cấp</div>
                            <div style="font-size: 24px; font-weight: 700;">📦</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; margin-bottom: 5px;">${totalSuppliers}</div>
                        <div style="font-size: 12px; opacity: 0.8;">${activeSuppliers} đang hoạt động</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(0, 184, 148, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Đang Hoạt Động</div>
                            <div style="font-size: 24px; font-weight: 700;">✅</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; margin-bottom: 5px;">${activeSuppliers}</div>
                        <div style="font-size: 12px; opacity: 0.8;">${totalSuppliers > 0 ? ((activeSuppliers / totalSuppliers) * 100).toFixed(1) : 0}% tổng số</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Có Giao Dịch</div>
                            <div style="font-size: 24px; font-weight: 700;">💼</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; margin-bottom: 5px;">0</div>
                        <div style="font-size: 12px; opacity: 0.8;">Chưa có phiếu nhập</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 14px; opacity: 0.9;">Tổng Giá Trị Nhập</div>
                            <div style="font-size: 24px; font-weight: 700;">💰</div>
                        </div>
                        <div style="font-size: 24px; font-weight: 900; margin-bottom: 5px; line-height: 1.2;">0₫</div>
                        <div style="font-size: 12px; opacity: 0.8;">Chưa có giao dịch</div>
                    </div>
                `;
            }
            
            const topSuppliersContainer = document.getElementById('top-suppliers-list');
            const summaryContainer = document.getElementById('supplier-summary');
            if (topSuppliersContainer) {
                topSuppliersContainer.innerHTML = '<div class="empty-state">Chưa có dữ liệu giao dịch</div>';
            }
            if (summaryContainer) {
                summaryContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                        <div style="font-size: 14px;">Chưa có dữ liệu thống kê</div>
                        <div style="font-size: 12px; margin-top: 5px; opacity: 0.7;">Tạo phiếu nhập để xem thống kê</div>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading supplier statistics:', error);
        const topSuppliersContainer = document.getElementById('top-suppliers-list');
        const summaryContainer = document.getElementById('supplier-summary');
        const metricsContainer = document.getElementById('supplier-metrics-cards');
        if (topSuppliersContainer) {
            topSuppliersContainer.innerHTML = '<div class="empty-state">Lỗi tải dữ liệu</div>';
        }
        if (summaryContainer) {
            summaryContainer.innerHTML = '<div class="empty-state">Lỗi tải dữ liệu</div>';
        }
        if (metricsContainer) {
            metricsContainer.innerHTML = '<div class="empty-state">Lỗi tải dữ liệu</div>';
        }
    }
}

function renderStockWarnings() {
    // Sử dụng tonKhoToiThieu thay vì hardcode < 20
    const lowStockItems = dashboardData.products.filter(p => {
        const tonKhoToiThieu = p.tonKhoToiThieu || 10;
        return p.soluong <= tonKhoToiThieu && p.soluong > 0;
    });
    const container = document.getElementById('stock-warnings');
    
    if (!container) return;
    
    if (lowStockItems.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="stock-warning-list">
            <h4>⚠️ Cảnh Báo Hàng Tồn Kho Thấp</h4>
            ${lowStockItems.map(p => {
                const tonKhoToiThieu = p.tonKhoToiThieu || 10;
                return `
                <div class="stock-warning-item">
                    <span><strong>${p.tenHang}</strong> (${p.maHang})</span>
                    <span class="badge badge-warning">Còn ${p.soluong}/${tonKhoToiThieu} ${p.donvi || 'sp'}</span>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

// ==================== NOTIFICATIONS ====================
function openNotificationSection() {
    const section = document.getElementById('notification-section');
    if (section) {
        section.style.display = 'block';
        section.scrollTop = 0;
        loadNotificationData();
    }
}

function closeNotificationSection() {
    const section = document.getElementById('notification-section');
    if (section) {
        section.style.display = 'none';
    }
}

async function loadNotificationData() {
    try {
        // Load low stock items - Sử dụng tonKhoToiThieu thay vì hardcode < 20
        const lowStockItems = dashboardData.products.filter(p => {
            const tonKhoToiThieu = p.tonKhoToiThieu || 10; // Mặc định 10 nếu không có
            return p.soluong <= tonKhoToiThieu && p.soluong > 0;
        });
        const lowStockList = document.getElementById('low-stock-list');
        
        if (lowStockList) {
            if (lowStockItems.length === 0) {
                lowStockList.innerHTML = '<div style="text-align: center; padding: 20px; color: #4caf50; font-weight: 500;">✅ Không có sản phẩm nào tồn kho thấp</div>';
            } else {
                lowStockList.innerHTML = lowStockItems.map(p => {
                    const tonKhoToiThieu = p.tonKhoToiThieu || 10;
                    return `
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #ffcc80; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;"
                         onmouseover="this.style.boxShadow='0 2px 8px rgba(255,152,0,0.2)'; this.style.transform='translateX(5px)'"
                         onmouseout="this.style.boxShadow='none'; this.style.transform='translateX(0)'">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: #1a2b48; font-size: 15px; margin-bottom: 5px;">${p.tenHang}</div>
                            <div style="font-size: 13px; color: #666;">Mã: ${p.maHang} • Tồn kho tối thiểu: ${tonKhoToiThieu} ${p.donvi || 'sp'}</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 14px; white-space: nowrap; margin-left: 15px;">
                            Còn ${p.soluong} ${p.donvi || 'sp'}
                        </div>
                    </div>
                `;
                }).join('');
            }
        }

        // Load slow moving products - Logic đúng: sau 30 ngày nhập hàng không có hóa đơn VÀ số lượng bán trong 90 ngày < 5
        let slowMovingItems = [];
        let productSales = {}; // Khai báo ở ngoài để có thể dùng trong phần hiển thị
        try {
            const ordersRes = await apiGet('hoadon');
            const now = new Date();
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            
            if (ordersRes.success && ordersRes.data) {
                // Tính số lượng bán trong 90 ngày gần nhất
                for (const order of ordersRes.data) {
                    if (!order.id || !order.ngayLap) continue;
                    const orderDate = new Date(order.ngayLap);
                    if (orderDate < ninetyDaysAgo) continue; // Chỉ tính hóa đơn trong 90 ngày gần nhất
                    
                    try {
                        const detailRes = await apiGet(`chitiethd/${order.id}`);
                        if (detailRes.success && detailRes.data) {
                            detailRes.data.forEach(item => {
                                const idHang = item.idHang;
                                if (!productSales[idHang]) {
                                    productSales[idHang] = 0;
                                }
                                productSales[idHang] += parseInt(item.soluong || 0);
                            });
                        }
                    } catch (err) {
                        // Skip errors
                    }
                }
                
                // Lọc sản phẩm bán chậm theo 3 điều kiện:
                // 1. Sau 30 ngày nhập hàng không có hóa đơn nào
                // 2. Số lượng bán trong 90 ngày < 5
                // 3. Tồn kho > 50
                slowMovingItems = dashboardData.products
                    .filter(p => {
                        if (!p.ngayNhapCuoi) return false;
                        
                        // Điều kiện 1: Sau 30 ngày nhập hàng
                        const ngayNhapCuoi = new Date(p.ngayNhapCuoi);
                        const thirtyDaysAfterImport = new Date(ngayNhapCuoi.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const condition1 = now >= thirtyDaysAfterImport;
                        
                        // Điều kiện 2: Số lượng bán trong 90 ngày < 5
                        const salesIn90Days = productSales[p.id] || 0;
                        const condition2 = salesIn90Days < 5;
                        
                        // Điều kiện 3: Tồn kho > 50
                        const condition3 = p.soluong > 50;
                        
                        return condition1 && condition2 && condition3;
                    })
                    .sort((a, b) => b.soluong - a.soluong)
                    .slice(0, 10);
            }
        } catch (error) {
            console.error('Error loading slow moving products:', error);
        }

        const slowMovingList = document.getElementById('slow-moving-list');
        if (slowMovingList) {
            if (slowMovingItems.length === 0) {
                slowMovingList.innerHTML = '<div style="text-align: center; padding: 20px; color: #4caf50; font-weight: 500;">✅ Không có sản phẩm nào bán chậm</div>';
            } else {
                slowMovingList.innerHTML = slowMovingItems.map(p => {
                    const ngayNhapCuoi = p.ngayNhapCuoi ? new Date(p.ngayNhapCuoi).toLocaleDateString('vi-VN') : 'N/A';
                    const salesIn90Days = productSales[p.id] || 0;
                    return `
                    <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #f48fb1; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;"
                         onmouseover="this.style.boxShadow='0 2px 8px rgba(233,30,99,0.2)'; this.style.transform='translateX(5px)'"
                         onmouseout="this.style.boxShadow='none'; this.style.transform='translateX(0)'">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: #1a2b48; font-size: 15px; margin-bottom: 5px;">${p.tenHang}</div>
                            <div style="font-size: 13px; color: #666;">Mã: ${p.maHang} • Nhập cuối: ${ngayNhapCuoi} • Bán 90 ngày: ${salesIn90Days} sp</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #e91e63 0%, #c2185b 100%); color: white; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 14px; white-space: nowrap; margin-left: 15px;">
                            Tồn: ${p.soluong} ${p.donvi || 'sp'}
                        </div>
                    </div>
                `;
                }).join('');
            }
        }

        // Show/hide empty state
        const emptyState = document.getElementById('notification-empty');
        if (emptyState) {
            if (lowStockItems.length === 0 && slowMovingItems.length === 0) {
                emptyState.style.display = 'block';
                const lowStockSection = document.getElementById('notification-low-stock');
                const slowMovingSection = document.getElementById('notification-slow-moving');
                if (lowStockSection) lowStockSection.style.display = 'none';
                if (slowMovingSection) slowMovingSection.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                const lowStockSection = document.getElementById('notification-low-stock');
                const slowMovingSection = document.getElementById('notification-slow-moving');
                if (lowStockSection) lowStockSection.style.display = 'block';
                if (slowMovingSection) slowMovingSection.style.display = 'block';
            }
        }

    } catch (error) {
        console.error('Error loading notification data:', error);
    }
}

function updateNotificationBadge() {
    // Update both badges if they exist (warehouse fixed button and dashboard button)
    const badges = [
        document.getElementById('notification-badge'), // Fixed button in warehouse.html
        document.getElementById('notification-badge-dashboard') // Button in dashboard (for admin/staff pages)
    ].filter(b => b !== null);
    
    if (badges.length > 0) {
        // Sử dụng tonKhoToiThieu thay vì hardcode < 20
        const lowStockItems = dashboardData.products.filter(p => {
            const tonKhoToiThieu = p.tonKhoToiThieu || 10;
            return p.soluong <= tonKhoToiThieu && p.soluong > 0;
        });
        // Tính số lượng hàng bán chậm (cần load async, tạm thời chỉ tính low stock)
        let totalNotifications = lowStockItems.length;
        
        // Có thể thêm logic tính slow moving items nếu cần
        // Tạm thời chỉ hiển thị số low stock items
        
        badges.forEach(badge => {
            if (totalNotifications > 0) {
                badge.textContent = totalNotifications > 99 ? '99+' : totalNotifications;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });
    }
}

// ==================== NHÀ CUNG CẤP ====================
async function renderNhacungcap() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-header">
            <h2>Quản Lý Nhà Cung Cấp</h2>
            <p>Quản lý thông tin nhà cung cấp và mức tồn kho mặc định</p>
        </div>
        <div id="alert" class="alert"></div>
        <div class="toolbar">
            <button class="btn btn-primary" onclick="openAddNhacungcapModal()">
                ➕ Thêm Mới
            </button>
            <button class="btn btn-secondary" onclick="loadNhacungcap()">
                🔄 Tải Lại
            </button>
        </div>
        <div id="nhacungcap-container" class="table-container">
            <div class="loading">
                <div class="spinner"></div>
                <p>Đang tải dữ liệu...</p>
            </div>
        </div>
    `;
    
    await loadNhacungcap();
}

async function loadNhacungcap() {
    try {
        const result = await apiGet('nhacungcap?all=true');
        
        if (result.success) {
            // Parse defaultTonKho từ ghiChu nếu có
            nhacungcapList = result.data.map(ncc => {
                try {
                    if (ncc.ghiChu) {
                        const parsed = JSON.parse(ncc.ghiChu);
                        if (parsed.defaultTonKho !== undefined) {
                            ncc.defaultTonKho = parsed.defaultTonKho;
                        } else {
                            ncc.defaultTonKho = 10;
                        }
                    } else {
                        ncc.defaultTonKho = 10;
                    }
                } catch (e) {
                    ncc.defaultTonKho = 10;
                }
                return ncc;
            });
            renderNhacungcapTable(nhacungcapList);
        } else {
            document.getElementById('nhacungcap-container').innerHTML = 
                '<div class="empty-state">Không có dữ liệu</div>';
        }
    } catch (error) {
        document.getElementById('nhacungcap-container').innerHTML = 
            '<div class="empty-state">Lỗi kết nối server</div>';
    }
}

function renderNhacungcapTable(data) {
    const container = document.getElementById('nhacungcap-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">Chưa có dữ liệu</div>';
        return;
    }
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Mã NCC</th>
                    <th>Tên Nhà Cung Cấp</th>
                    <th>SĐT</th>
                    <th>Email</th>
                    <th>Địa Chỉ</th>
                    <th>Default Tồn Kho</th>
                    <th>Trạng Thái</th>
                    <th>Thao Tác</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(ncc => `
                    <tr>
                        <td><strong>${ncc.maNCC}</strong></td>
                        <td>${ncc.tenNCC}</td>
                        <td>${ncc.sdt || '-'}</td>
                        <td>${ncc.email || '-'}</td>
                        <td>${ncc.diachi || '-'}</td>
                        <td>${ncc.defaultTonKho || 10}</td>
                        <td>
                            <span class="badge ${ncc.trangthai === 1 || ncc.trangthai === true ? 'badge-success' : 'badge-danger'}">
                                ${ncc.trangthai === 1 || ncc.trangthai === true ? 'Hoạt động' : 'Ngừng'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editNhacungcap(${ncc.id})">✏️ Sửa</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteNhacungcap(${ncc.id})">🗑️ Xóa</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function openAddNhacungcapModal() {
    editingNCCId = null;
    openNhacungcapModal();
}

function editNhacungcap(id) {
    const ncc = nhacungcapList.find(n => n.id === id);
    if (!ncc) return;
    
    editingNCCId = id;
    openNhacungcapModal(ncc);
}

function openNhacungcapModal(ncc = null) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    title.textContent = ncc ? 'Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp';
    
    body.innerHTML = `
        <form id="nhacungcap-form" onsubmit="saveNhacungcap(event)">
            <div class="form-group">
                <label>Tên Nhà Cung Cấp *</label>
                <input type="text" id="ncc-tenNCC" value="${ncc ? ncc.tenNCC : ''}" required>
            </div>
            <div class="form-group">
                <label>Số Điện Thoại</label>
                <input type="tel" id="ncc-sdt" value="${ncc ? ncc.sdt || '' : ''}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="ncc-email" value="${ncc ? ncc.email || '' : ''}">
            </div>
            <div class="form-group">
                <label>Địa Chỉ</label>
                <input type="text" id="ncc-diachi" value="${ncc ? ncc.diachi || '' : ''}">
            </div>
            <div class="form-group">
                <label>Ghi Chú</label>
                <textarea id="ncc-ghiChu" rows="3">${ncc ? (() => {
                    try {
                        if (ncc.ghiChu) {
                            const parsed = JSON.parse(ncc.ghiChu);
                            return parsed.text || '';
                        }
                    } catch (e) {
                        return ncc.ghiChu || '';
                    }
                    return '';
                })() : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Tồn Kho Tối Thiểu (Mặc định: 10)</label>
                <input type="number" id="ncc-defaultTonKho" value="${ncc ? (ncc.defaultTonKho || 10) : 10}" min="0" required>
            </div>
            <div class="form-group">
                <label>Trạng Thái</label>
                <select id="ncc-trangthai">
                    <option value="1" ${ncc && (ncc.trangthai === 1 || ncc.trangthai === true) ? 'selected' : ''}>Hoạt động</option>
                    <option value="0" ${ncc && ncc.trangthai === 0 ? 'selected' : ''}>Ngừng</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
                <button type="submit" class="btn btn-success">💾 Lưu</button>
            </div>
        </form>
    `;
    
    modal.classList.add('active');
}

async function saveNhacungcap(event) {
    event.preventDefault();
    
    const defaultTonKho = parseInt(document.getElementById('ncc-defaultTonKho').value) || 10;
    const ghiChuText = document.getElementById('ncc-ghiChu').value.trim();
    
    // Lưu defaultTonKho vào ghiChu dưới dạng JSON
    let ghiChu = null;
    if (ghiChuText) {
        try {
            const parsed = JSON.parse(ghiChuText);
            parsed.defaultTonKho = defaultTonKho;
            ghiChu = JSON.stringify(parsed);
        } catch (e) {
            ghiChu = JSON.stringify({ text: ghiChuText, defaultTonKho: defaultTonKho });
        }
    } else {
        ghiChu = JSON.stringify({ defaultTonKho: defaultTonKho });
    }
    
    const data = {
        tenNCC: document.getElementById('ncc-tenNCC').value.trim(),
        sdt: document.getElementById('ncc-sdt').value.trim() || null,
        email: document.getElementById('ncc-email').value.trim() || null,
        diachi: document.getElementById('ncc-diachi').value.trim() || null,
        ghiChu: ghiChu,
        trangthai: parseInt(document.getElementById('ncc-trangthai').value)
    };
    
    try {
        let result;
        if (editingNCCId) {
            result = await apiPut(`nhacungcap/${editingNCCId}`, data);
        } else {
            result = await apiPost('nhacungcap', data);
        }
        
        if (result.success) {
            showAlert(editingNCCId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
            closeModal();
            await loadNhacungcap();
        } else {
            showAlert(result.message || 'Lỗi', 'error');
        }
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

async function deleteNhacungcap(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa nhà cung cấp này?')) return;
    
    try {
        const result = await apiDelete(`nhacungcap/${id}`);
        
        if (result.success) {
            showAlert('Xóa thành công', 'success');
            await loadNhacungcap();
        } else {
            showAlert(result.message || 'Lỗi', 'error');
        }
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// ==================== NEW SUPPLIER MODAL (for Phieu Nhap) ====================
function renderNewSupplierModal() {
    // Kiểm tra xem modal đã tồn tại chưa
    let modal = document.getElementById('new-supplier-modal');
    if (!modal) {
        // Tạo modal mới
        modal = document.createElement('div');
        modal.id = 'new-supplier-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 650px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; border-radius: 12px 12px 0 0; margin: -25px -25px 20px -25px; padding: 20px 25px;">
                <h3 style="color: white; margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 28px;">🏢</span>
                    <span>Thêm Nhà Cung Cấp Mới</span>
                </h3>
                <button class="close-btn" onclick="closeNewSupplierModal()" style="background: rgba(255,255,255,0.2); color: white;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                <p style="margin: 0; color: #e65100; font-size: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>ℹ️</span>
                    <span>Mã nhà cung cấp sẽ được tự động tạo sau khi lưu. Vui lòng điền đầy đủ thông tin để quản lý tốt hơn.</span>
                </p>
            </div>
            
            <form id="new-supplier-form" onsubmit="saveNewSupplierFromPhieuNhap(event)">
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <span>🏷️</span>
                        <span>Tên Nhà Cung Cấp <span style="color: #e74c3c;">*</span></span>
                    </label>
                    <input type="text" id="new-supplier-name" required placeholder="Ví dụ: Công ty TNHH ABC, Cửa hàng XYZ..." 
                           style="width: 100%; padding: 12px 16px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;"
                           onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                           onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 6px;">
                            <span>📞</span>
                            <span>Số Điện Thoại</span>
                        </label>
                        <input type="tel" id="new-supplier-phone" placeholder="0xxxxxxxxx hoặc 0xxx xxx xxx" 
                               pattern="[0-9]{10,11}" 
                               style="width: 100%; padding: 12px 16px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;"
                               onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                               onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                        <p style="font-size: 11px; color: #999; margin-top: 5px; margin-bottom: 0;">Định dạng: 10-11 chữ số</p>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 6px;">
                            <span>📧</span>
                            <span>Email</span>
                        </label>
                        <input type="email" id="new-supplier-email" placeholder="example@company.com" 
                               style="width: 100%; padding: 12px 16px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;"
                               onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                               onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                        <p style="font-size: 11px; color: #999; margin-top: 5px; margin-bottom: 0;">Để trống nếu không có</p>
                    </div>
                </div>
                
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <span>📍</span>
                        <span>Địa Chỉ</span>
                    </label>
                    <input type="text" id="new-supplier-address" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" 
                           style="width: 100%; padding: 12px 16px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;"
                           onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                           onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                </div>
                
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <span>📝</span>
                        <span>Ghi Chú</span>
                    </label>
                    <textarea id="new-supplier-note" rows="4" placeholder="Ghi chú về nhà cung cấp..." 
                             style="width: 100%; padding: 12px 16px; border: 2px solid #e8e8e8; border-radius: 8px; font-size: 13px; font-family: inherit; resize: vertical; transition: all 0.3s ease;"
                             onfocus="this.style.borderColor='#ff9800'; this.style.boxShadow='0 0 0 3px rgba(255, 152, 0, 0.1)'"
                             onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'"></textarea>
                    <p style="font-size: 11px; color: #999; margin-top: 5px; margin-bottom: 0;">Có thể để trống</p>
                </div>
                
                <div class="form-actions" style="margin-top: 25px; padding-top: 20px; border-top: 2px solid #f0f0f0;">
                    <button type="button" class="btn btn-outline" onclick="closeNewSupplierModal()" style="flex: 1;">
                        <span style="margin-right: 5px;">✕</span> Hủy
                    </button>
                    <button type="submit" class="btn btn-success" style="flex: 1; background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); border: none;">
                        <span style="margin-right: 5px;">💾</span> Lưu Nhà Cung Cấp
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Setup click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeNewSupplierModal();
        }
    });
}

function openNewSupplierModal() {
    // Render modal nếu chưa có
    renderNewSupplierModal();
    
    const modal = document.getElementById('new-supplier-modal');
    if (modal) {
        // Reset form
        const nameInput = document.getElementById('new-supplier-name');
        const phoneInput = document.getElementById('new-supplier-phone');
        const emailInput = document.getElementById('new-supplier-email');
        const addressInput = document.getElementById('new-supplier-address');
        const noteInput = document.getElementById('new-supplier-note');
        
        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (emailInput) emailInput.value = '';
        if (addressInput) addressInput.value = '';
        if (noteInput) noteInput.value = '';
        
        modal.classList.add('active');
        
        // Auto focus vào input đầu tiên
        setTimeout(() => {
            if (nameInput) nameInput.focus();
        }, 100);
    }
}

function closeNewSupplierModal() {
    const modal = document.getElementById('new-supplier-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function saveNewSupplierFromPhieuNhap(event) {
    event.preventDefault();
    
    const defaultTonKho = 10;
    const ghiChuText = document.getElementById('new-supplier-note').value.trim();
    
    // Lưu defaultTonKho vào ghiChu dưới dạng JSON
    let ghiChu = null;
    if (ghiChuText) {
        ghiChu = JSON.stringify({ text: ghiChuText, defaultTonKho: defaultTonKho });
    } else {
        ghiChu = JSON.stringify({ defaultTonKho: defaultTonKho });
    }
    
    const data = {
        tenNCC: document.getElementById('new-supplier-name').value.trim(),
        sdt: document.getElementById('new-supplier-phone').value.trim() || null,
        email: document.getElementById('new-supplier-email').value.trim() || null,
        diachi: document.getElementById('new-supplier-address').value.trim() || null,
        ghiChu: ghiChu,
        trangthai: 1
    };
    
    try {
        const result = await apiPost('nhacungcap', data);
        
        if (result.success) {
            showAlert('Thêm nhà cung cấp thành công!', 'success');
            closeNewSupplierModal();
            
            // Reload danh sách nhà cung cấp
            const nhacungcapRes = await apiGet('nhacungcap');
            if (nhacungcapRes.success) {
                phieuNhapNhacungcap = nhacungcapRes.data;
                // Cập nhật select trong cart
                const select = document.getElementById('phieunhap-nhacungcap-select');
                if (select) {
                    const newNCC = result.data;
                    select.innerHTML = `
                        <option value="">-- Không chọn --</option>
                        ${phieuNhapNhacungcap.map(ncc => `<option value="${ncc.id}" ${ncc.id === newNCC.id ? 'selected' : ''}>${ncc.tenNCC} (${ncc.maNCC})</option>`).join('')}
                    `;
                }
            }
        } else {
            showAlert(result.message || 'Lỗi', 'error');
        }
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Render Lịch Sử Hoạt Động
async function renderLichSu() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-header">
            <h2>📋 Lịch Sử Hoạt Động</h2>
            <p>Xem lại các hoạt động đã thực hiện trong hệ thống</p>
        </div>
        <div id="alert" class="alert"></div>
        <div class="toolbar" style="margin-bottom: 20px;">
            <div style="flex: 1; display: flex; gap: 10px; align-items: center;">
                <select id="lichsu-filter-loai" class="search-input" style="max-width: 200px;" onchange="loadLichSuData()">
                    <option value="">Tất cả loại</option>
                    <option value="Tạo hóa đơn">Tạo hóa đơn</option>
                    <option value="Sửa hóa đơn">Sửa hóa đơn</option>
                    <option value="Xóa hóa đơn">Xóa hóa đơn</option>
                    <option value="Tạo phiếu nhập">Tạo phiếu nhập</option>
                    <option value="Sửa phiếu nhập">Sửa phiếu nhập</option>
                    <option value="Xóa phiếu nhập">Xóa phiếu nhập</option>
                </select>
                <input type="text" 
                       id="lichsu-search-input" 
                       placeholder="🔍 Tìm kiếm..." 
                       class="search-input"
                       style="flex: 1; max-width: 400px;"
                       oninput="filterLichSuData()"
                       onkeyup="if(event.key === 'Enter') filterLichSuData()">
                <button class="btn btn-secondary" onclick="clearLichSuSearch()" style="padding: 10px 16px;">
                    ✕ Xóa
                </button>
            </div>
            <button class="btn btn-secondary" onclick="loadLichSuData()">
                🔄 Tải Lại
            </button>
            <button class="btn btn-success" onclick="exportLichSuReport('pdf')" title="Xuất PDF">
                📄 PDF
            </button>
            <button class="btn btn-success" onclick="exportLichSuReport('excel')" title="Xuất Excel">
                📊 Excel
            </button>
        </div>
        <div id="lichsu-container" class="table-container">
            <div class="loading">
                <div class="spinner"></div>
                <p>Đang tải lịch sử...</p>
            </div>
        </div>
    `;
    
    await loadLichSuData();
}

let lichSuData = [];
let lichSuFilteredData = [];

async function loadLichSuData() {
    try {
        const loaiHoatDong = document.getElementById('lichsu-filter-loai')?.value || '';
        
        let endpoint = 'lichsu?limit=200';
        if (loaiHoatDong) {
            endpoint += `&loaiHoatDong=${encodeURIComponent(loaiHoatDong)}`;
        }
        
        const result = await apiGet(endpoint);
        
        if (result.success) {
            lichSuData = result.data || [];
            lichSuFilteredData = [...lichSuData];
            renderLichSuTable();
        } else {
            showAlert(result.message || 'Lỗi tải lịch sử', 'error');
        }
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

function renderLichSuTable() {
    const container = document.getElementById('lichsu-container');
    
    if (lichSuFilteredData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #999;">
                <div style="font-size: 64px; margin-bottom: 15px;">📋</div>
                <h3 style="color: #666; margin-bottom: 10px;">Chưa có lịch sử hoạt động</h3>
                <p>Chưa có hoạt động nào được ghi lại trong hệ thống.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 150px;">Thời Gian</th>
                    <th style="width: 150px;">Nhân Viên</th>
                    <th style="width: 150px;">Loại Hoạt Động</th>
                    <th>Mô Tả</th>
                    <th style="width: 120px;">Tham Chiếu</th>
                </tr>
            </thead>
            <tbody>
                ${lichSuFilteredData.map(item => {
                    // Sử dụng formatDateTime để hiển thị đúng thời gian từ database (có cả giây)
                    const thoiGian = formatDateTime(item.thoiGian);
                    
                    const loaiIcon = {
                        'Tạo hóa đơn': '✅',
                        'Sửa hóa đơn': '✏️',
                        'Xóa hóa đơn': '❌',
                        'Tạo phiếu nhập': '📥',
                        'Sửa phiếu nhập': '✏️',
                        'Xóa phiếu nhập': '❌',
                        'Tạo khách hàng': '👤',
                        'Sửa khách hàng': '✏️',
                        'Tạo hàng hóa': '📦',
                        'Sửa hàng hóa': '✏️'
                    }[item.loaiHoatDong] || '📋';
                    
                    return `
                        <tr>
                            <td>${thoiGian}</td>
                            <td>${item.tenNhanVien || item.maNV || 'N/A'}</td>
                            <td>
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    ${loaiIcon} ${item.loaiHoatDong}
                                </span>
                            </td>
                            <td>${item.moTa || '-'}</td>
                            <td>
                                ${item.thamChieu ? `
                                    <span style="color: #4a90e2; font-weight: 600;">${item.thamChieu}</span>
                                ` : '-'}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div style="margin-top: 15px; color: #666; font-size: 14px;">
            Hiển thị <strong>${lichSuFilteredData.length}</strong> / ${lichSuData.length} hoạt động
        </div>
    `;
}

function filterLichSuData() {
    const searchTerm = document.getElementById('lichsu-search-input')?.value.toLowerCase() || '';
    
    if (!searchTerm) {
        lichSuFilteredData = [...lichSuData];
    } else {
        lichSuFilteredData = lichSuData.filter(item => {
            const moTa = (item.moTa || '').toLowerCase();
            const loaiHoatDong = (item.loaiHoatDong || '').toLowerCase();
            const tenNhanVien = (item.tenNhanVien || item.maNV || '').toLowerCase();
            const thamChieu = (item.thamChieu || '').toLowerCase();
            
            return moTa.includes(searchTerm) || 
                   loaiHoatDong.includes(searchTerm) || 
                   tenNhanVien.includes(searchTerm) ||
                   thamChieu.includes(searchTerm);
        });
    }
    
    renderLichSuTable();
}

function clearLichSuSearch() {
    const searchInput = document.getElementById('lichsu-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    const filterSelect = document.getElementById('lichsu-filter-loai');
    if (filterSelect) {
        filterSelect.value = '';
    }
    lichSuFilteredData = [...lichSuData];
    renderLichSuTable();
}

// Xuất báo cáo lịch sử
async function exportLichSuReport(format) {
    try {
        const loaiHoatDong = document.getElementById('lichsu-filter-loai')?.value || '';
        let url = `${API_BASE}/lichsu/export?format=${format}`;
        
        if (loaiHoatDong) {
            url += `&loaiHoatDong=${encodeURIComponent(loaiHoatDong)}`;
        }
        
        showAlert('Đang xuất báo cáo...', 'info');
        
        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            showAlert(error.message || 'Lỗi xuất báo cáo', 'error');
            return;
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `BaoCaoLichSu_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        showAlert('Xuất báo cáo thành công!', 'success');
    } catch (error) {
        showAlert('Lỗi: ' + error.message, 'error');
    }
}

// Initialize page on load
window.addEventListener('DOMContentLoaded', async function() {
    initModalClose();
    // Always start with dashboard
    currentPage = 'dashboard';
    // Activate dashboard menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const dashboardMenuItem = document.querySelector('.menu-item[onclick*="dashboard"]');
    if (dashboardMenuItem) {
        dashboardMenuItem.classList.add('active');
    }
    // Load dashboard
    await loadDashboardInitialData();
    await loadPage();
});

