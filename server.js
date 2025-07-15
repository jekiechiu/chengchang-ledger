const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path'); // <-- 【新增】確保這行在這裡
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001; // Render 會注入 process.env.PORT

// ====== 中間件 (Middleware) ======
const allowedOrigins = [
  'https://chengchang-ledger.onrender.com', // 您的前端應用程式的 URL
  'http://localhost:3000' // 如果您在本地開發前端，也請加入
];

app.use(cors({
  origin: function (origin, callback) {
    // 允許沒有來源的請求 (例如來自 Postman 或 curl)
    // 或者如果來源在允許列表中
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // 允許的 HTTP 方法
  credentials: true, // 如果您需要發送 cookie 或授權頭部
})); // 允許跨域請求
app.use(express.json()); // 解析 JSON 格式的請求體
app.use(express.urlencoded({ extended: true })); // 解析 URL-encoded 格式的請求體

// ====== Supabase 配置 ======
const supabaseUrl = process.env.SUPABASE_URL; // 從環境變數讀取
const supabaseKey = process.env.SUPABASE_ANON_KEY; // 從環境變數讀取
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false } // 在後端不需要持久化會話
});

// ====== PostgreSQL 資料庫連接池配置 ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // 從環境變數讀取
  ssl: {
    rejectUnauthorized: false // 允許非官方 CA 簽名的 SSL 憑證，因為 Render 和 Supabase 可能有自簽憑證
  }
});

// 測試資料庫連線
pool.connect((err, client, done) => {
  if (err) {
    console.error('Database connection error:', err.message);
    return;
  }
  console.log('Connected to the database');
  client.release(); // 釋放客戶端連線
});

// ====== Multer 配置 (用於處理檔案上傳) ======
// 記憶體儲存，因為檔案會直接上傳到 Supabase Storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ====== API 路由 ======

// 1. POST /api/records - 新增帳本記錄 (包含圖片上傳)
app.post('/api/records', upload.single('image'), async (req, res) => {
  const { date, type, category, item_name, amount, notes } = req.body;
  const imageFile = req.file;

  let image_url = null;
  const bucketName = 'test'; // <-- 【檢查】這裡的名稱與你 Supabase 中的 Bucket 名稱一致

  try {
    // 如果有圖片上傳，則上傳到 Supabase Storage
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.originalname}`;
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, imageFile.buffer, {
          contentType: imageFile.mimetype,
          upsert: false // 不覆蓋同名檔案
        });

      if (error) {
        console.error('Supabase Storage Upload Error:', error);
        return res.status(500).json({ message: '圖片上傳失敗', error: error.message });
      }

      // 獲取圖片的公開 URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      if (publicUrlData && publicUrlData.publicUrl) {
        image_url = publicUrlData.publicUrl;
        console.log('Image uploaded successfully:', image_url);
      } else {
        console.warn('Could not get public URL for image.');
      }
    }

    // 將資料儲存到 PostgreSQL 資料庫
    const query = `
      INSERT INTO records (date, type, category, item_name, amount, notes, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [date, type, category, item_name, amount, notes, image_url];
    const result = await pool.query(query, values);

    res.status(201).json({ message: '資料儲存成功', record: result.rows[0] });

  } catch (error) {
    console.error('Error saving record:', error);
    res.status(500).json({ message: '資料儲存失敗，請檢查！', error: error.message });
  }
});

// 2. GET /api/records - 查詢帳本記錄
app.get('/api/records', async (req, res) => {
  const { startDate, endDate, category, type } = req.query;

  let query = 'SELECT * FROM records WHERE 1=1';
  const values = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND date >= $${paramIndex}`;
    values.push(startDate);
    paramIndex++;
  }
  if (endDate) {
    query += ` AND date <= $${paramIndex}`;
    values.push(endDate);
    paramIndex++;
  }
  if (category && category !== '所有項目') {
    query += ` AND category = $${paramIndex}`;
    values.push(category);
    paramIndex++;
  }
  if (type && (type === '收入' || type === '支出')) {
    query += ` AND type = $${paramIndex}`;
    values.push(type);
    paramIndex++;
  }

  query += ' ORDER BY date DESC;'; // 按日期降序排列

  try {
    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({ message: '查詢資料失敗', error: error.message });
  }
});

// ====== 靜態檔案服務 (用於前端 React) ======
// 這部分確保後端 Express 伺服器能提供 React 的 build/ 資料夾內容
app.use(express.static(path.join(__dirname, 'build')));

// 處理所有其他 GET 請求，將其路由到 React 應用程式的 index.html
app.get('*', (req, res) => {
  // 如果請求路徑不是以 /api 開頭 (即不是後端 API 請求)
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  }
});


// ====== 啟動伺服器 ======
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
