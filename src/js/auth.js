// Login, logout, phân quyền

// Check authentication
function checkAuth(requiredRole = null) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        return false;
    }
    if (requiredRole && user.role !== requiredRole) {
        return false;
    }
    return true;
}

// Get current user
function getCurrentUser() {
    return JSON.parse(localStorage.getItem("user"));
}

// Logout
function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

// Check and redirect if not authenticated
function requireAuth(requiredRole = null) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "login.html";
        return false;
    }
    if (requiredRole && user.role !== requiredRole) {
        alert(`Bạn không có quyền truy cập trang này! Yêu cầu quyền: ${requiredRole}`);
        window.location.href = "login.html";
        return false;
    }
    return true;
}

