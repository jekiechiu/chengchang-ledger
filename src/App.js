import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // 假設您有 App.css，如果沒有請確保此行存在

function App() {
  // 移除所有與新增、編輯相關的狀態
  // const [formData, setFormData] = useState({ date: '', type: '收入', category: '', amount: '', notes: '' });
  // const [imageFile, setImageFile] = useState(null);
  // const [editingRecordId, setEditingRecordId] = useState(null);
  // const [editingImageUrl, setEditingImageUrl] = useState(null);
  // const [clearExistingImage, setClearExistingImage] = useState(false);

  const [records, setRecords] = useState([]);
  const [searchParams, setSearchParams] = useState({
    startDate: '', endDate: '', category: '所有項目'
  });

  const categories = ['管理費', '租金收入', '水電費', '維修費', '其他'];

  // 移除所有與新增、編輯、刪除相關的處理函數
  // const handleInputChange = (e) => { ... };
  // const handleImageChange = (e) => { ... };
  // const handleEditClick = (record) => { ... };
  // const handleDeleteClick = async (recordId) => { ... };
  // const handleCancelEdit = () => { ... };
  // const handleSubmit = async (e) => { ... };

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
      <h1>成昌大樓管理費支用明細</h1> {/* 網站名稱已更改 */}

      {/* 移除 '輸入資料' 區塊 */}
      {/*
      <section className="input-section">
        <h2>{editingRecordId ? '編輯資料' : '輸入資料'}</h2>
        <form onSubmit={handleSubmit}>
          // ... 原本的表單內容 ...
        </form>
      </section>
      */}

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
                {/* 移除 '操作' 表頭 */}
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{new Date(record.date).toLocaleDateString('zh-TW')}</td> {/*
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
                  {/* 移除 '編輯' 和 '刪除' 按鈕 */}
                  {/*
                  <td>
                    <button onClick={() => handleEditClick(record)} className="edit-button">編輯</button>
                    <button onClick={() => handleDeleteClick(record.id)} className="delete-button">刪除</button>
                  </td>
                  */}
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
