// Gọi API (fetch)
const API_BASE = 'http://localhost:3000/api';

// Generic API call function
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}/${endpoint}`, options);
        const result = await response.json();
        return result;
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// GET request
async function apiGet(endpoint) {
    return await apiCall(endpoint, 'GET');
}

// POST request
async function apiPost(endpoint, data) {
    return await apiCall(endpoint, 'POST', data);
}

// PUT request
async function apiPut(endpoint, data) {
    return await apiCall(endpoint, 'PUT', data);
}

// DELETE request
async function apiDelete(endpoint) {
    return await apiCall(endpoint, 'DELETE');
}

// Login API
async function apiLogin(username, password) {
    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Export PDF
async function apiExportPDF(maHD) {
    try {
        // Tìm id từ maHD trước
        let idHD = null;
        
        // Nếu maHD là số, dùng trực tiếp
        if (!isNaN(maHD) && parseInt(maHD) > 0) {
            idHD = parseInt(maHD);
        } else {
            // Nếu là chuỗi maHD, cần tìm id
            const ordersRes = await apiGet('hoadon');
            if (ordersRes.success && ordersRes.data) {
                const order = ordersRes.data.find(o => o.maHD === maHD);
                if (order && order.id) {
                    idHD = order.id;
                }
            }
        }
        
        if (!idHD) {
            return { success: false, message: 'Không tìm thấy hóa đơn với mã: ' + maHD };
        }
        
        const response = await fetch(`${API_BASE}/hoadon/${idHD}/pdf`);
        if (!response.ok) {
            const error = await response.json();
            return { success: false, message: error.message || 'Lỗi khi xuất PDF' };
        }
        return await response.blob();
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Export Excel
async function apiExportExcel(maHD) {
    try {
        // Tìm id từ maHD trước
        let idHD = null;
        
        // Nếu maHD là số, dùng trực tiếp
        if (!isNaN(maHD) && parseInt(maHD) > 0) {
            idHD = parseInt(maHD);
        } else {
            // Nếu là chuỗi maHD, cần tìm id
            const ordersRes = await apiGet('hoadon');
            if (ordersRes.success && ordersRes.data) {
                const order = ordersRes.data.find(o => o.maHD === maHD);
                if (order && order.id) {
                    idHD = order.id;
                }
            }
        }
        
        if (!idHD) {
            return { success: false, message: 'Không tìm thấy hóa đơn với mã: ' + maHD };
        }
        
        const response = await fetch(`${API_BASE}/hoadon/${idHD}/export?format=excel`);
        if (!response.ok) {
            const error = await response.json();
            return { success: false, message: error.message || 'Lỗi khi xuất Excel' };
        }
        return await response.blob();
    } catch (error) {
        return { success: false, message: error.message };
    }
}

