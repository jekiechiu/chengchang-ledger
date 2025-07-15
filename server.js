const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
// 移除了 uuid 的引入：
// const { v4: uuidv4 } = require('uuid');
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
    // 移除了 itemName 的解構
    const { date, type, category, amount, notes } = req.body;
    const imageFile = req.file; // Multer 會將檔案放在 req.file

    let imageUrl = null;

    if (imageFile) {
      // **修改：使用日期時間精確到毫秒來生成檔案名**
      const now = new Date();
      // 格式化日期時間為 YYYY-MM-DD_HH-MM-SS-ms
      const timestamp = now.getFullYear() + '-' +
                        String(now.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') + '-' +
                        String(now.getMinutes()).padStart(2, '0') + '-' +
                        String(now.getSeconds()).padStart(2, '0') + '-' +
                        String(now.getMilliseconds()).padStart(3, '0');

      // 將時間戳和原始檔名結合起來，避免潛在的檔名重複
      const uniqueFileName = `${timestamp}-${imageFile.originalname}`;

      const { data, error } = await supabase.storage
        .from('records-images') // 請替換為您的 Supabase 儲存桶名稱
        .upload(uniqueFileName, imageFile.buffer, { // 使用 uniqueFileName
          contentType: imageFile.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: 'Failed to upload image to Supabase Storage.' });
      }

      // 獲取公共可訪問的 URL
      const { data: publicURLData } = supabase.storage
        .from('records-images') // 請替換為您的 Supabase 儲存桶名稱
        .getPublicUrl(uniqueFileName); // 這裡也要使用 uniqueFileName

      if (publicURLData && publicURLData.publicUrl) {
        imageUrl = publicURLData.publicUrl;
      } else {
        console.warn('Supabase did not return a public URL for', uniqueFileName);
      }
    }

    // 執行 SQL INSERT
    // 移除了 item_name 欄位和對應的參數
    const result = await pool.query(
      'INSERT INTO records (date, type, category, amount, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [date, type, category, amount, notes, imageUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving record:', err);
    res.status(500).json({ error: 'Failed to save record' });
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
