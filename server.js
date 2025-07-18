// server.js (只讀端網站專用)
const express = require('express');
const { Pool } = require('pg'); // 重新引入 pg 以連接資料庫
const cors = require('cors'); 
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ====== 資料庫連接設定 (與管理端相同，連接到同一個資料庫) ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // 從 Render 環境變數獲取資料庫連線字串
  ssl: {
    rejectUnauthorized: false
  }
});

// 檢查資料庫連接
pool.connect()
  .then(() => console.log('Connected to the database (Read-Only Client)'))
  .catch(err => console.error('Database connection error (Read-Only Client)', err));

// ====== 中間件 (Middleware) ======
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供 React 前端建置後的靜態檔案
app.use(express.static(path.join(__dirname, 'build')));

// ====== API 路由 (只讀端，只提供 GET /api/records) ======

// 用於保持服務活躍的 Keep-Alive 端點
app.get('/api/keep-alive', async (req, res) => {
  try {
    // 執行一個簡單的資料庫查詢來保持資料庫連接活躍
    await pool.query('SELECT 1;');
    console.log('Keep-alive ping to database successful for Read-Only Client.');
    res.status(200).send('Read-Only Client service and database are active.');
  } catch (err) {
    console.error('Keep-alive ping to database failed for Read-Only Client:', err);
    res.status(500).send('Keep-alive ping failed for Read-Only Client.');
  }
});

// 獲取所有記帳記錄的 API 端點 (只讀端的核心資料API)
app.get('/api/records', async (req, res) => {
  try {
    // 這裡我們不處理查詢參數，直接獲取所有資料
    // ORDER BY date DESC, created_at DESC 確保最新資料在前面
    const query = 'SELECT id, date, type, category, amount, notes, image_url, created_at FROM records ORDER BY date DESC, created_at DESC';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching records for Read-Only Client:', err);
    res.status(500).json({ error: 'Failed to fetch records for Read-Only Client' });
  }
});

// 移除所有新增、編輯、刪除相關的路由
// 例如:
// app.post('/api/records', ...); // 移除
// app.put('/api/records/:id', ...); // 移除
// app.delete('/api/records/:id', ...); // 移除


// 其他任何未匹配的請求都導向 React 前端應用程式的 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ====== 啟動伺服器 ======
app.listen(port, () => {
  console.log(`Read-Only Client Server running on port ${port}`);
});
