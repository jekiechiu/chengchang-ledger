const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // 引入 uuid 庫
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

// ====== Supabase 設定 (用於檔案上傳) ======
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer 設定 - 使用 memoryStorage 將檔案暫存於記憶體
const upload = multer({
  storage: multer.memoryStorage(),
  // 您也可以在這裡設定檔案大小限制，例如 5MB
  // limits: { fileSize: 5 * 1024 * 1024 }
});

// ====== 中間件 (Middleware) ======
app.use(cors()); // 簡化後的 CORS 設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 提供 React 前端靜態檔案
// 確保 build 資料夾位於您的專案根目錄
app.use(express.static(path.join(__dirname, 'build')));

// ====== API 路由 ======

// 新增：用於保持服務和資料庫活躍的 Keep-Alive 端點
app.get('/api/keep-alive', async (req, res) => {
  try {
    // 執行一個非常輕量的資料庫查詢，不影響任何資料
    await pool.query('SELECT 1;');
    console.log('Keep-alive ping to database successful.');
    res.status(200).send('Service and database are active.');
  } catch (err) {
    console.error('Keep-alive ping to database failed:', err);
    res.status(500).send('Keep-alive ping failed.');
  }
});

// 獲取所有記帳記錄
app.get('/api/records', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    // 移除了 item_name 欄位
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

// 添加新的記帳記錄
app.post('/api/records', upload.single('image'), async (req, res) => {
  try {
    const { date, type, category, amount, notes } = req.body;
    const imageFile = req.file;

    let imageUrl = null;

    if (imageFile) {
      const now = new Date();
      // 格式化日期時間為 YYYY-MM-DD_HH-MM-SS-ms
      const timestamp = now.getFullYear() + '-' +
                        String(now.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') + '-' +
                        String(now.getMinutes()).padStart(2, '0') + '-' +
                        String(now.getSeconds()).padStart(2, '0') + '-' +
                        String(now.getMilliseconds()).padStart(3, '0');

      // 重要：只提取原始檔名副檔名，並結合時間戳和 UUID 確保唯一性
      const fileExtension = path.extname(imageFile.originalname); // 獲取副檔名，例如 ".jpg"
      const uniqueBaseName = `${timestamp}-${uuidv4()}`; // 時間戳 + UUID 作為唯一基名
      const uniqueFileName = `${uniqueBaseName}${fileExtension}`; // 組合生成最終檔名

      const { data, error } = await supabase.storage
        .from('records-images') // 請替換為您的 Supabase 儲存桶名稱
        .upload(uniqueFileName, imageFile.buffer, { // 使用這個保證唯一的檔名
          contentType: imageFile.mimetype,
          upsert: false // 保持 false，因為我們旨在確保檔名是唯一的
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: 'Failed to upload image to Supabase Storage.' });
      }

      // 獲取公共可訪問的 URL
      const { data: publicURLData } = supabase.storage
        .from('records-images') // 請替換為您的 Supabase 儲存桶名稱
        .getPublicUrl(uniqueFileName); // 這裡也要使用這個唯一的檔名

      if (publicURLData && publicURLData.publicUrl) {
        imageUrl = publicURLData.publicUrl;
      } else {
        console.warn('Supabase did not return a public URL for', uniqueFileName);
      }
    }

    // 執行 SQL INSERT
    const result = await pool.query(
      'INSERT INTO records (date, type, category, amount, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [date, type, category, amount, notes, imageUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
      // 捕獲並日誌詳細錯誤信息
      console.error('Error saving record:', err);
      // 根據錯誤類型提供更具體的響應，例如 400 或 403
      if (err.code === '42703') { // PostgreSQL: undefined_column (例如 created_at 不存在)
          res.status(400).json({ error: 'Database column error. Please check your table schema.', details: err.message });
      } else if (err.severity === 'ERROR' && err.message.includes('violates not-null constraint')) {
          res.status(400).json({ error: 'Missing required field. Please ensure all necessary fields are provided.', details: err.message });
      } else if (err.statusCode && (err.statusCode === '400' || err.statusCode === '403')) { // Supabase Storage errors
          res.status(err.statusCode).json({ error: err.error || 'Supabase Storage Error', message: err.message });
      } else {
          res.status(500).json({ error: 'Failed to save record', details: err.message });
      }
  }
});

// 如果沒有其他 API 路由匹配，就將請求導向 React 前端
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


// ====== 啟動伺服器 ======
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
