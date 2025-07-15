const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
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

// ====== Supabase 設定 (用於檔案上傳) ======
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer 設定 - 使用 memoryStorage 將檔案暫存於記憶體
const upload = multer({ storage: multer.memoryStorage() });

// ====== 中間件 (Middleware) ======
app.use(cors()); // 簡化後的 CORS 設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 如果您想讓您的 React 前端靜態檔案從這個 Express 服務器提供
// 確保 build 資料夾位於您的專案根目錄
app.use(express.static(path.join(__dirname, 'build')));

// ====== API 路由 ======

// 獲取所有記帳記錄
app.get('/api/records', async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    let query = 'SELECT id, date, type, category, amount, notes, image_url, created_at FROM records'; // 已移除 item_name
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
    // 已移除 itemName
    const { date, type, category, amount, notes } = req.body;
    const imageFile = req.file; // Multer 會將檔案放在 req.file

    let imageUrl = null;

    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.originalname}`;
      const { data, error } = await supabase.storage
        .from('records-images') // 替換為您的 Supabase 儲存桶名稱
        .upload(fileName, imageFile.buffer, {
          contentType: imageFile.mimetype,
          upsert: false // 如果檔案存在則不覆蓋
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: 'Failed to upload image to Supabase Storage.' });
      }

      // 獲取公共可訪問的 URL
      const { data: publicURLData } = supabase.storage
        .from('records-images') // 替換為您的 Supabase 儲存桶名稱
        .getPublicUrl(fileName);

      if (publicURLData && publicURLData.publicUrl) {
        imageUrl = publicURLData.publicUrl;
      } else {
        console.warn('Supabase did not return a public URL for', fileName);
      }
    }

    // 執行 SQL INSERT
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

// 提供 React 前端靜態檔案
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ====== 啟動伺服器 ======
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
