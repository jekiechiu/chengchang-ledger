const express = require('express');
const { Pool } = require('pg');
// 移除 multer 和 uuid 的引入，因為不再處理檔案上傳
// const multer = require('multer');
// const { createClient } = require('@supabase/supabase-js');
// const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ====== 資料庫連接設定 ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 檢查資料庫連接
pool.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Database connection error', err));

// 移除 Supabase 設定，因為不再處理檔案上傳/刪除
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_ANON_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

// 移除 Multer 設定
// const upload = multer({ ... });

// ====== 中間件 (Middleware) ======
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供 React 前端靜態檔案
app.use(express.static(path.join(__dirname, 'build')));

// ====== API 路由 ======

// 用於保持服務和資料庫活躍的 Keep-Alive 端點 (保留)
app.get('/api/keep-alive', async (req, res) => {
  try {
    await pool.query('SELECT 1;');
    console.log('Keep-alive ping to database successful.');
    res.status(200).send('Service and database are active.');
  } catch (err) {
    console.error('Keep-alive ping to database failed:', err);
    res.status(500).send('Keep-alive ping failed.');
  }
});

// 獲取所有記帳記錄 (保留)
app.get('/api/records', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    let query = 'SELECT id, date, type, category, amount, notes, image_url, created_at FROM records';
    let params = [];
    let conditions = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`date >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`date <= $${paramIndex++}`);
      params.push(endDate);
    }
    if (category && category !== '所有項目') {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// 移除 添加新的記帳記錄 路由 (POST)
// app.post('/api/records', upload.single('image'), async (req, res) => { ... });

// 移除 更新現有記帳記錄 路由 (PUT)
// app.put('/api/records/:id', upload.single('image'), async (req, res) => { ... });

// 移除 刪除單筆記帳記錄 路由 (DELETE)
// app.delete('/api/records/:id', async (req, res) => { ... });


// 如果沒有其他 API 路由匹配，就將請求導向 React 前端
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


// ====== 啟動伺服器 ======
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
