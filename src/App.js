import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // 假設您有 App.css，如果沒有請確保此行存在

function App() {
  const [formData, setFormData] = useState({
    date: '', type: '收入', category: '', amount: '', notes: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchParams, setSearchParams] = useState({
    startDate: '', endDate: '', category: '所有項目'
  });

  // 新增狀態來處理編輯功能
  const [editingRecordId, setEditingRecordId] = useState(null); // 正在編輯的記錄ID
  const [editingImageUrl, setEditingImageUrl] = useState(null); // 正在編輯記錄的現有圖片URL
  const [clearExistingImage, setClearExistingImage] = useState(false); // 標記是否要清除現有圖片

  const categories = ['管理費', '租金收入', '水電費', '維修費', '其他'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setClearExistingImage(false); // 如果選了新圖片，就不需要清除舊圖片了
    } else {
      setImageFile(null); // 如果取消選取，則清空
    }
  };

  // 點擊「編輯」按鈕時，將資料填充到表單
  const handleEditClick = (record) => {
    setEditingRecordId(record.id);
    setFormData({
      date: record.date,
      type: record.type,
      category: record.category,
      amount: record.amount,
      notes: record.notes
    });
    setEditingImageUrl(record.image_url); // 設置現有圖片URL
    setImageFile(null); // 清除任何待處理的新圖片檔案
    setClearExistingImage(false); // 重置清除圖片標誌
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 捲動到頁面頂部以顯示表單
  };

  // 取消編輯模式
  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingImageUrl(null);
    setImageFile(null);
    setClearExistingImage(false);
    // 重置表單為初始狀態（新增模式）
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
        dataToSend.append('image', imageFile); // 上傳新圖片
      }

      // 如果是編輯模式，且使用者選擇清除現有圖片，且沒有上傳新圖片
      if (editingRecordId && clearExistingImage && !imageFile) {
        dataToSend.append('clearImage', 'true'); // 告知後端清除圖片
      } else {
        dataToSend.append('clearImage', 'false'); // 告知後端不清除圖片 (預設)
      }

      let response;
      if (editingRecordId) {
        // 更新現有記錄
        response = await axios.put(`/api/records/${editingRecordId}`, dataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('資料更新成功！');
      } else {
        // 添加新記錄
        response = await axios.post(`/api/records`, dataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        alert('資料儲存成功！');
      }
      console.log('Operation successful:', response.data);
      handleCancelEdit(); // 提交後重置表單和編輯狀態
      fetchRecords(); // 刷新記錄列表
    } catch (error) {
      console.error('Error during operation:', error.response ? error.response.data : error.message);
      alert('操作失敗，請檢查！');
    }
  };

  const fetchRecords = async () => {
    try {
      const response = await axios.get(`/api/records`, { params: searchParams });
      setRecords(response.data);
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

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <div className="app-container">
      <h1>成昌大樓管理費相關明細</h1>

      <section className="input-section">
        <h2>{editingRecordId ? '編輯資料' : '輸入資料'}</h2> {/* 標題根據模式改變 */}
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

            {/* 編輯模式下顯示現有圖片，並提供清除選項 */}
            {editingRecordId && editingImageUrl && !imageFile && !clearExistingImage && (
              <div className="existing-image-preview">
                <p>現有圖片:</p>
                <img src={editingImageUrl} alt="Existing Attachment" style={{ width: '100px', height: 'auto', display: 'block', marginBottom: '10px' }} />
                <button type="button" onClick={() => setClearExistingImage(true)} className="clear-image-button">清除現有圖片</button>
              </div>
            )}
            {/* 顯示圖片將被清除的提示 */}
            {clearExistingImage && !imageFile && (
              <p className="image-status">現有圖片將被清除。</p>
            )}
          </div>
          <button type="submit" className="save-button">
            {editingRecordId ? '更新資料' : '儲存資料'} {/* 按鈕文字根據模式改變 */}
          </button>
          {editingRecordId && ( // 編輯模式下顯示取消按鈕
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
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>類型</th>
                <th>項目別</th>
                <th>金額</th>
                <th>備註說明</th>
                <th>附件照片</th>
                <th>操作</th> {/* 新增「操作」表頭 */}
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.type}</td>
                  <td>{record.category}</td>
                  <td>{record.amount}</td>
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
                    {/* 未來您可以考慮在這裡添加刪除按鈕 */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="summary">
          <span>收入綜合: ${incomeTotal.toFixed(2)}</span>
          <span>支出綜合: ${expenseTotal.toFixed(2)}</span>
        </div>
      </section>
    </div>
  );
}

export default App;
                
