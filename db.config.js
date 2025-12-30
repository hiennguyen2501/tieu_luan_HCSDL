// db.config.js
require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false, // nếu dùng Azure thì bật true
        trustServerCertificate: true // quan trọng với SQL Server local
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Đã kết nối SQL Server thành công!');
        return pool;
    })
    .catch(err => {
        console.log('Lỗi kết nối database: ', err);
        process.exit(1);
    });

module.exports = {
    sql,
    poolPromise
};