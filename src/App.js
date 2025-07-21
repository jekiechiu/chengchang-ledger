// src/App.js (修改端網站專用 - 包含所有最新功能和修正)

import React, { useState, useEffect } from 'react'; // <-- 已修正語法錯誤
import axios from 'axios';
import './App.css'; 

function App() {
  const [formData, setFormData] = useState({ date: '', type: '收入', category: '', amount: '', notes: '' });
  const [imageFile, setImageFile] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchParams, setSearchParams] = useState({
    startDate: '', endDate: '', category: '所有項目'
  });

  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingImageUrl, setEditingImageUrl] = useState(null);
  const [clearExistingImage, setClearExistingImage] = useState(false);

  // 分頁相關狀態
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20; // 每頁顯示 20 筆資料

  // 最新項目別類別
  const categories = [
    '其他費用',
    '維護管理費',
    '委外清潔費',
    '電梯保養費',
    '電梯維修費',
    '水塔清洗費',
    '清潔人員獎金',
    '公共設施電費',
    '大樓硬體維修',
    '消防設備維護',
    '大樓雜項支出'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setClearExistingImage(false); 
    } else {
      setImageFile(null); 
    }
  };

  const handleEditClick = (record) => {
    setEditingRecordId(record.id);
    const formattedDate = record.date ? new Date(record.date).toISOString().split('T')[0] : '';
    setFormData({
      date: formattedDate, 
      type: record.type,
      category: record.category,
      amount: record.amount,
      notes: record.notes
    });
    setEditingImageUrl(record.image_url);
    setImageFile(null);
    setClearExistingImage(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (recordId) => {
    if (window.confirm('確定要刪除這筆記錄嗎？此操作無法恢復！')) {
      try {
        await axios.delete(`/api/records/${recordId}`);
        alert('記錄刪除成功！');
        fetchRecords(); 
      } catch (error) {
        console.error('Error deleting record:', error.response ? error.response.data : error.message);
        alert('刪除失敗，請檢查！');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingImageUrl(null);
    setImageFile(null);
    setClearExistingImage(false);
    setFormData({ date: '', type: '收入', category: '', amount: '', notes: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = new FormData();
      for (const key in formData) {
        dataToSend.append(key, formData[key]);
      }

      if (imageFile) {
        dataToSend.append('image', imageFile); 
      }

      dataToSend.append('clearImage', editingRecordId && clearExistingImage && !imageFile ? 'true' : 'false');

      let response;
      if (editingRecordId) {
        response = await axios.put(`/api/records/${editingRecordId}`, dataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('資料更新成功！');
      } else {
        response = await axios.post(`/api/records`, dataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('資料儲存成功！');
      }
      console.log('Operation successful:', response.data);
      handleCancelEdit(); 
      fetchRecords(); 
    } catch (error) {
      console.error('Error during operation:', error.response ? error.response.data : error.message);
      alert('操作失敗，請檢查！');
    }
  };

  const fetchRecords = async () => {
    try {
      const response = await axios.get(`/api/records`, { params: searchParams });
      setRecords(response.data);
      setCurrentPage(1); // 每次重新查詢後，將當前頁碼重設為第一頁
    } catch (error) {
      console.error('Error fetching records:', error.response ? error.response.data : error.message);
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleClearSearch = () => {
    setSearchParams({ startDate: '', endDate: '', category: '所有項目' });
    fetchRecords();
  };

  const incomeTotal = records.filter(r => r.type === '收入').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const expenseTotal = records.filter(r => r.type === '支出').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const balanceTotal = incomeTotal - expenseTotal; // 餘額計算

  useEffect(() => {
    fetchRecords();
  }, []);

  // 輔助函數：將數字格式化為貨幣顯示 (XXX,XXX)
  const formatCurrency = (number) => {
    return parseFloat(number || 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // 分頁邏輯
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(records.length / recordsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="app-container">
      <h1>成昌大樓管理費相關明細</h1>

      <section className="input-section">
        <h2>{editingRecordId ? '編輯資料' : '輸入資料'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>日期:</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>類型:</label>
            <label><input type="radio" name="type" value="收入" checked={formData.type === '收入'} onChange={handleInputChange} /> 收入</label>
            <label><input type="radio" name="type" value="支出" checked={formData.type === '支出'} onChange={handleInputChange} /> 支出</label>
          </div>
          <div className="form-group">
            <label>項目別:</label>
            <select name="category" value={formData.category} onChange={handleInputChange} required>
              <option value="">請選擇</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>金額:</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="例如: 1000" required />
          </div>
          <div className="form-group">
            <label>備註說明 (選填):</label>
            <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="輸入任何相關備註"></textarea>
          </div>
          <div className="form-group">
            <label>上傳附件照片 (選填):</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {imageFile && <p>已選取檔案: {imageFile.name}</p>}

            {editingRecordId && editingImageUrl && !imageFile && !clearExistingImage && (
              <div className="existing-image-preview">
                <p>現有圖片:</p>
                <img src={editingImageUrl} alt="Existing Attachment" style={{ width: '80px', height: 'auto', display: 'block', marginBottom: '10px' }} /> {/* 圖片寬度改為 80px */}
                <button type="button" onClick={() => setClearExistingImage(true)} className="clear-image-button">清除現有圖片</button>
              </div>
            )}
            {clearExistingImage && !imageFile && (
              <p className="image-status">現有圖片將被清除。</p>
            )}
          </div>
          <button type="submit" className="save-button">
            {editingRecordId ? '更新資料' : '儲存資料'}
          </button>
          {editingRecordId && (
            <button type="button" onClick={handleCancelEdit} className="cancel-button">
              取消編輯
            </button>
          )}
        </form>
      </section>

      <section className="query-section">
        <h2>查詢資料</h2>
        <form onSubmit={handleSearchSubmit}>
          <div className="form-group">
            <label>開始日期:</label>
            <input type="date" name="startDate" value={searchParams.startDate} onChange={handleSearchChange} />
          </div>
          <div className="form-group">
            <label>結束日期:</label>
            <input type="date" name="endDate" value={searchParams.endDate} onChange={handleSearchChange} />
          </div>
          <div className="form-group">
            <label>項目別:</label>
            <select name="category" value={searchParams.category} onChange={handleSearchChange}>
              <option value="所有項目">所有項目</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <button type="submit" className="query-button">查詢資料</button>
          <button type="button" onClick={handleClearSearch} className="clear-button">重新查詢</button>
        </form>
      </section>

      <section className="results-section">
        <h2>查詢結果</h2>
        {records.length === 0 ? (
          <p>沒有符合條件的資料。</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>類型</th>
                  <th>項目別</th>
                  <th className="text-right">金額</th> {/* 金額表頭靠右對齊 */}
                  <th>備註說明</th>
                  <th>附件照片</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.date).toLocaleDateString('zh-TW')}</td> {/* 日期格式化 */}
                    <td>{record.type}</td>
                    <td>{record.category}</td>
                    <td className="text-right">{formatCurrency(record.amount)}</td> {/* 金額數據靠右對齊並格式化 */}
                    <td>{record.notes}</td>
                    <td>
                      {record.image_url ? (
                        <a href={record.image_url} target="_blank" rel="noopener noreferrer">
                          <img src={record.image_url} alt="附件照片" style={{ width: '80px', height: 'auto', objectFit: 'contain' }} />
                        </a>
                      ) : (
                        <span>無</span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => handleEditClick(record)} className="edit-button">編輯</button>
                      <button onClick={() => handleDeleteClick(record.id)} className="delete-button">刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分頁控制按鈕 */}
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => paginate(i + 1)}
                  className={currentPage === i + 1 ? 'active' : ''} 
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="summary">
          <span>收入綜合: ${formatCurrency(incomeTotal)}</span>
          <span>支出綜合: ${formatCurrency(expenseTotal)}</span>
          <span>餘額: ${formatCurrency(balanceTotal)}</span> {/* 餘額顯示 */}
        </div>
      </section>
    </div>
  );
}

export default App;
