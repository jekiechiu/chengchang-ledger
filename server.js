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

// ====== Supabase 設定 (用於檔案上傳/刪除) ======
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
      const timestamp = now.getFullYear() + '-' +
                        String(now.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') + '-' +
                        String(now.getMinutes()).padStart(2, '0') + '-' +
                        String(now.getSeconds()).padStart(2, '0') + '-' +
                        String(now.getMilliseconds()).padStart(3, '0');

      const fileExtension = path.extname(imageFile.originalname);
      const uniqueBaseName = `${timestamp}-${uuidv4()}`;
      const uniqueFileName = `${uniqueBaseName}${fileExtension}`;

      const { data, error } = await supabase.storage
        .from('records-images') // 請替換為您的 Supabase 儲存桶名稱
        .upload(uniqueFileName, imageFile.buffer, {
          contentType: imageFile.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: 'Failed to upload image to Supabase Storage.' });
      }

      const { data: publicURLData } = supabase.storage
        .from('records-images')
        .getPublicUrl(uniqueFileName);

      if (publicURLData && publicURLData.publicUrl) {
        imageUrl = publicURLData.publicUrl;
      } else {
        console.warn('Supabase did not return a public URL for', uniqueFileName);
      }
    }

    const result = await pool.query(
      'INSERT INTO records (date, type, category, amount, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [date, type, category, amount, notes, imageUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error('Error saving record:', err);
      if (err.code === '42703') {
          res.status(400).json({ error: 'Database column error. Please check your table schema.', details: err.message });
      } else if (err.severity === 'ERROR' && err.message.includes('violates not-null constraint')) {
          res.status(400).json({ error: 'Missing required field. Please ensure all necessary fields are provided.', details: err.message });
      } else if (err.statusCode && (err.statusCode === '400' || err.statusCode === '403')) {
          res.status(err.statusCode).json({ error: err.error || 'Supabase Storage Error', message: err.message });
      } else {
          res.status(500).json({ error: 'Failed to save record', details: err.message });
      }
  }
});

// 更新現有記帳記錄
app.put('/api/records/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { date, type, category, amount, notes, clearImage } = req.body;
  const imageFile = req.file;

  let imageUrl = null;
  let oldImageUrl = null;

  try {
    // 1. 獲取當前記錄的舊圖片 URL (如果存在)
    const { rows: currentRecordRows } = await pool.query('SELECT image_url FROM records WHERE id = $1', [id]);
    if (currentRecordRows.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }
    if (currentRecordRows[0].image_url) {
      oldImageUrl = currentRecordRows[0].image_url;
    }

    // 2. 處理圖片更新邏輯
    if (imageFile) {
      // 有新圖片上傳：
      // 生成新圖片檔名
      const now = new Date();
      const timestamp = now.getFullYear() + '-' +
                        String(now.getMonth() + 1).padStart(2, '0') + '-' +
                        String(now.getDate()).padStart(2, '0') + '_' +
                        String(now.getHours()).padStart(2, '0') + '-' +
                        String(now.getMinutes()).padStart(2, '0') + '-' +
                        String(now.getSeconds()).padStart(2, '0') + '-' +
                        String(now.getMilliseconds()).padStart(3, '0');

      const fileExtension = path.extname(imageFile.originalname);
      const uniqueBaseName = `${timestamp}-${uuidv4()}`;
      const newFileName = `${uniqueBaseName}${fileExtension}`;

      // 上傳新圖片
      const { data, error: uploadError } = await supabase.storage
        .from('records-images')
        .upload(newFileName, imageFile.buffer, {
          contentType: imageFile.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase new image upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload new image to Supabase Storage.' });
      }

      // 獲取新圖片的公共 URL
      const { data: newPublicURLData } = supabase.storage
        .from('records-images')
        .getPublicUrl(newFileName);

      if (newPublicURLData && newPublicURLData.publicUrl) {
        imageUrl = newPublicURLData.publicUrl;
      } else {
        console.warn('Supabase did not return a public URL for new image:', newFileName);
      }

      // 如果舊圖片存在，則刪除它
      if (oldImageUrl) {
        // 從 URL 中提取檔案路徑/名稱
        // 注意：Supabase 的 Public URL 格式為 `[URL]/storage/v1/object/public/bucket_name/file_path/file_name`
        // 我們需要提取 `file_path/file_name`，但通常您的檔名不包含子路徑，所以直接拿最後一個部分即可。
        const oldFileKey = oldImageUrl.split('/').pop();
        const { error: deleteError } = await supabase.storage
          .from('records-images')
          .remove([oldFileKey]);

        if (deleteError) {
          console.error('Supabase old image deletion error:', deleteError);
          // 這裡可以選擇是否回傳錯誤，或者僅記錄，因為主要操作是更新記錄
        }
      }
    } else if (clearImage === 'true') {
      // 沒有新圖片，但前端請求清除舊圖片
      imageUrl = null; // 將資料庫中的圖片 URL 設為 NULL
      if (oldImageUrl) {
        // 從 URL 中提取檔案路徑/名稱
        const oldFileKey = oldImageUrl.split('/').pop();
        const { error: deleteError } = await supabase.storage
          .from('records-images')
          .remove([oldFileKey]);

        if (deleteError) {
          console.error('Supabase image clear deletion error:', deleteError);
        }
      }
    } else {
      // 沒有新圖片，也沒有請求清除，保留舊圖片 URL
      imageUrl = oldImageUrl;
    }

    // 3. 更新資料庫記錄
    const result = await pool.query(
      'UPDATE records SET date = $1, type = $2, category = $3, amount = $4, notes = $5, image_url = $6 WHERE id = $7 RETURNING *',
      [date, type, category, amount, notes, imageUrl, id]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error updating record:', err);
    if (err.code === '42703') {
        res.status(400).json({ error: 'Database column error. Please check your table schema.', details: err.message });
    } else if (err.severity === 'ERROR' && err.message.includes('violates not-null constraint')) {
        res.status(400).json({ error: 'Missing required field. Please ensure all necessary fields are provided.', details: err.message });
    } else if (err.statusCode && (err.statusCode === '400' || err.statusCode === '403')) {
        res.status(err.statusCode).json({ error: err.error || 'Supabase Storage Error', message: err.message });
    } else {
        res.status(500).json({ error: 'Failed to update record', details: err.message });
    }
  }
});

// 新增：刪除單筆記帳記錄 (包含相關附件)
app.delete('/api/records/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. 先從資料庫獲取該記錄的 image_url
    const { rows: recordToDelete } = await pool.query('SELECT image_url FROM records WHERE id = $1', [id]);

    if (recordToDelete.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const imageUrlToDelete = recordToDelete[0].image_url;

    // 2. 如果存在圖片 URL，則嘗試從 Supabase Storage 刪除檔案
    if (imageUrlToDelete) {
      // 從 URL 中提取檔案路徑/名稱
      // 例如：https://abc.supabase.co/storage/v1/object/public/records-images/your-file-name.jpg
      const fileKey = imageUrlToDelete.split('/').pop();
      
      if (fileKey) { // 確保 fileKey 不為空
        const { error: deleteFileError } = await supabase.storage
          .from('records-images') // 替換為您的 Supabase 儲存桶名稱
          .remove([fileKey]); // 傳入檔案鍵 (名稱)

        if (deleteFileError) {
          console.error('Supabase file deletion error for record ID', id, ':', deleteFileError);
          // 注意：這裡即使檔案刪除失敗，我們也可能希望繼續刪除資料庫記錄
          // 否則如果圖片刪不掉，記錄也永遠刪不掉。您可以根據需求調整。
        }
      }
    }

    // 3. 從資料庫中刪除記錄
    const result = await pool.query('DELETE FROM records WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found in database after attempting deletion.' });
    }

    res.status(200).json({ message: 'Record and associated file (if any) deleted successfully.', deletedId: result.rows[0].id });

  } catch (err) {
    console.error('Error deleting record:', err);
    res.status(500).json({ error: 'Failed to delete record', details: err.message });
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
