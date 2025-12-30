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
        const response = await fetch(`${API_BASE}/hoadon/${maHD}/pdf`);
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
        const response = await fetch(`${API_BASE}/hoadon/${maHD}/export?format=excel`);
        if (!response.ok) {
            const error = await response.json();
            return { success: false, message: error.message || 'Lỗi khi xuất Excel' };
        }
        return await response.blob();
    } catch (error) {
        return { success: false, message: error.message };
    }
}

