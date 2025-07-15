// server.js

// 載入必要的模組
require('dotenv').config(); // 載入 .env 檔案中的環境變數
const express = require('express'); // Express 框架
const { createClient } = require('@supabase/supabase-js'); // Supabase JavaScript 客戶端庫
const cors = require('cors'); // 跨來源資源共享 (CORS) 中間件
const multer = require('multer'); // 用於處理 multipart/form-data (檔案上傳)
const path = require('path'); // 路徑處理模組

const app = express(); // 創建 Express 應用實例

// 從環境變數中獲取 Supabase 配置
// 注意：Render 部署時，環境變數會自動注入，不需要 .env 檔案
const supabaseUrl = process.env.SUPABASE_URL; // Supabase 專案 URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Supabase Public Anon Key
const databaseUrl = process.env.DATABASE_URL; // Supabase 資料庫連線字串
const port = process.env.PORT || 3001; // 後端服務監聽的 Port

// 初始化 Supabase 客戶端
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false // 在後端服務中通常不需要持久化會話
    }
});

// 設置 multer 用於處理檔案上傳
// 由於我們直接將檔案緩衝區傳遞給 Supabase，這裡不需要設置磁碟存儲
const storage = multer.memoryStorage(); // 將檔案存儲在記憶體中
const upload = multer({ storage: storage });

// ====== 中間件 (Middleware) ======

// 修正 CORS 問題：明確允許你的前端 URL 進行跨域請求
// 'https://chengchang-ledger.onrender.com' 是你前端部署在 Render 上的 URL
app.use(cors({
    origin: 'https://chengchang-ledger.onrender.com' 
}));

// 啟用 Express 的 JSON 和 URL 編碼解析
app.use(express.json()); // 解析 JSON 格式的請求主體
app.use(express.urlencoded({ extended: true })); // 解析 URL-encoded 格式的請求主體

// 部署靜態前端檔案
// 假設你的 React 應用程式的 build 文件夾在你的服務器根目錄下的一個 'client/build' 文件夾中
// 確保 'chengchang-ledger-simple-root' 項目結構中包含 'client/build'
app.use(express.static(path.join(__dirname, 'client/build')));

// ====== 資料庫連線測試 (選用，但建議保留) ======
// 透過 Supabase 客戶端測試資料庫連線
async function testDbConnection() {
    try {
        const { data, error } = await supabase.from('records').select('id').limit(1);
        if (error) {
            console.error('Failed to connect to the database:', error.message);
        } else {
            console.log('Connected to the database'); // 連線成功訊息
        }
    } catch (err) {
        console.error('Error during database connection test:', err.message);
    }
}
testDbConnection();


// ====== 路由 (Routes) ======

// API 路由：處理數據儲存
// 使用 upload.single('image') 中間件來處理單個檔案上傳，欄位名稱為 'image'
app.post('/api/records', upload.single('image'), async (req, res) => {
    try {
        const { date, type, category, item_name, amount, notes } = req.body;
        const imageFile = req.file; // 獲取上傳的檔案 (如果有的話)

        let imageUrl = null;

        // 如果有檔案上傳，則處理圖片上傳到 Supabase Storage
        if (imageFile) {
            const bucketName = 'test'; // 你的 Supabase Storage bucket 名稱
            const fileName = `${Date.now()}-${imageFile.originalname}`; // 生成獨特的檔案名稱
            const filePath = `${fileName}`; // 檔案在 bucket 中的路徑

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, imageFile.buffer, {
                    contentType: imageFile.mimetype,
                    upsert: false // 不覆蓋現有檔案
                });

            if (uploadError) {
                console.error('Error uploading image to Supabase Storage:', uploadError.message);
                // 這裡可以選擇是否返回錯誤或繼續不帶圖片的路徑
                return res.status(500).json({ error: '圖片上傳失敗，請檢查！' });
            }

            // 獲取公開的圖片 URL
            // 注意：這裡假設你的 bucket 是公開的
            const { data: publicUrlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            imageUrl = publicUrlData.publicUrl;
            console.log('Image uploaded successfully. Public URL:', imageUrl);
        }

        // 將數據插入到 Supabase 資料庫
        const { data, error } = await supabase
            .from('records') // 你的資料表名稱
            .insert([
                {
                    date,
                    type,
                    category,
                    item_name,
                    amount: parseFloat(amount), // 確保 amount 是數字類型
                    notes,
                    image_url: imageUrl // 儲存圖片 URL
                },
            ]);

        if (error) {
            console.error('Error saving data to Supabase:', error.message);
            return res.status(500).json({ error: '資料儲存失敗，請檢查！' }); //
        }

        console.log('Data saved successfully:', data);
        res.status(200).json({ message: '資料儲存成功！' });

    } catch (err) {
        console.error('Server error during record creation:', err.message);
        res.status(500).json({ error: '伺服器錯誤，請稍後再試。' });
    }
});

// API 路由：處理數據查詢 (選用，但你的前端需要)
app.get('/api/records', async (req, res) => {
    try {
        // 你可以根據前端傳遞的參數來篩選或排序
        const { startDate, endDate } = req.query;

        let query = supabase.from('records').select('*'); // 查詢所有欄位

        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }

        const { data, error } = await query.order('created_at', { ascending: false }); // 按創建時間降序排序

        if (error) {
            console.error('Error fetching data from Supabase:', error.message);
            return res.status(500).json({ error: '獲取資料失敗，請檢查！' });
        }

        res.status(200).json(data);

    } catch (err) {
        console.error('Server error during record fetching:', err.message);
        res.status(500).json({ error: '伺服器錯誤，請稍後再試。' });
    }
});

// 處理所有其他 GET 請求，將其路由到前端應用程式的 index.html
// 這確保了當使用者直接訪問非 API 路徑時，React 路由可以處理
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server running on port ${port}`); // 伺服器啟動訊息
});
