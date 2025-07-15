const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config(); // 載入根目錄的 .env 檔案中的環境變數

const app = express();
const port = process.env.PORT || 3001; // 從環境變數獲取 PORT

// ====== Supabase 配置 ======
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// ====== PostgreSQL 資料庫連接池配置 ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ====== Multer 配置 (處理檔案上傳) ======
const upload = multer({ storage: multer.memoryStorage() });

// ====== 中間件 (Middleware) ======
app.use(cors());
app.use(express.json());

// ====== 路由 (Routes) ======

// 1. POST /api/records - 新增帳本記錄 (包含圖片上傳)
app.post('/api/records', upload.single('image'), async (req, res) => {
  const { date, type, category, itemName, amount, notes } = req.body;
  let imageUrl = null;

  try {
    if (req.file) {
      const file = req.file;
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      const bucketName = 'ledger_images'; // 確保這個 bucket 存在於你的 Supabase Storage

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return res.status(500).json({ message: '圖片上傳失敗', error: uploadError.message });
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    const queryText = `
      INSERT INTO records (date, type, category, item_name, amount, notes, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [date, type, category, itemName, amount, notes, imageUrl];

    const result = await pool.query(queryText, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('新增記錄失敗:', err);
    res.status(500).json({ message: '伺服器內部錯誤', error: err.message });
  }
});

// 2. GET /api/records - 查詢帳本記錄
app.get('/api/records', async (req, res) => {
  const { startDate, endDate, category } = req.query;

  let queryText = 'SELECT * FROM records WHERE 1=1';
  const values = [];
  let paramIndex = 1;

  if (startDate) {
    queryText += ` AND date >= $${paramIndex++}`;
    values.push(startDate);
  }
  if (endDate) {
    queryText += ` AND date <= $${paramIndex++}`;
    values.push(endDate);
  }
  if (category && category !== '所有項目') {
    queryText += ` AND category = $${paramIndex++}`;
    values.push(category);
  }

  queryText += ' ORDER BY date DESC;';

  try {
    const result = await pool.query(queryText, values);
    res.json(result.rows);
  } catch (err) {
    console.error('查詢記錄失敗:', err);
    res.status(500).json({ message: '伺服器內部錯誤', error: err.message });
  }
});

// ====== 靜態檔案服務 (用於前端) ======
// 當部署在 Render 的 Web Service 上時，也需要提供前端靜態檔案
app.use(express.static('build')); // 假設前端打包後在根目錄的 'build' 資料夾

// 任何前端路由都導向 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) { // 避免攔截 API 請求
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  }
});
// 注意：這裡需要 path 模組，請在 server.js 開頭加上：const path = require('path');

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
