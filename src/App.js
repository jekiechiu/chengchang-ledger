// src/App.js (修改端網站專用 - 增加餘額顯示)

import React, { useState, useEffect } => 'react';
import axios from 'axios';
import './App.css'; 

function App() {
  const [formData, setFormData] = useState({ date: '', type: '收入', category: '', amount: '', notes: '' });
  const [imageFile, setImageFile] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingImageUrl, setEditingImageUrl] = useState(null);
  const [clearExistingImage, setClearExistingImage] = useState(false);

  const [records, setRecords] = useState([]);
  const [searchParams, setSearchParams] = useState({
    startDate: '', endDate: '', category: '所有項目'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20; 

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
    setImageFile(e.target.files[0]);
  };

  const fetchRecords = async () => {
    try {
      const response = await axios.get(`/api/records`, { params: searchParams });
      setRecords(response.data);
      setCurrentPage(1); 
    } catch (error) {
      console.error('Error fetching records:', error.response ? error.response.data : error.message);
    }
  };

  const handleEditClick = (record) => {
    setEditingRecordId(record.id);
    setFormData({
      date: record.date.split('T')[0], 
      type: record.type,
      category: record.category,
      amount: record.amount,
      notes: record.notes
    });
    setEditingImageUrl(record.image_url);
    setClearExistingImage(false);
  };

  const handleDeleteClick = async (recordId) => {
    if (window.confirm('確定要刪除這筆記錄嗎？')) {
      try {
        await axios.delete(`/api/records/${recordId}`);
        fetchRecords(); 
        alert('記錄已刪除！');
      } catch (error) {
        console.error('Error deleting record:', error.response ? error.response.data : error.message);
        alert('刪除失敗。');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setFormData({ date: '', type: '收入', category: '', amount: '', notes: '' });
    setImageFile(null);
    setEditingImageUrl(null);
    setClearExistingImage(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }
    if (imageFile) {
      data.append('image', imageFile);
    }
    if (editingRecordId) {
      data.append('clearExistingImage', clearExistingImage); 
    }

    try {
      if (editingRecordId) {
        await axios.put(`/api/records/${editingRecordId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('記錄已更新！');
      } else {
        await axios.post('/api/records', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('記錄已新增！');
      }
      setFormData({ date: '', type: '收入', category: '', amount: '', notes: '' });
      setImageFile(null);
      setEditingRecordId(null);
      setEditingImageUrl(null);
      setClearExistingImage(false);
      fetchRecords(); 
    } catch (error) {
      console.error('Error submitting data:', error.response ? error.response.data : error.message);
      alert('操作失敗。');
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
  
  // !! 新增餘額計算 !!
  const balanceTotal = incomeTotal - expenseTotal;

  useEffect(() => {
    fetchRecords();
  }, []);

  const formatCurrency = (number) => {
    return parseFloat(number || 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);

  const totalPages = Math.ceil(records.length / recordsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="app-container">
      <h1>成昌大樓管理費支用明細</h1>

      <section className="input-section">
        <h2>{editingRecordId ? '編輯資料' : '輸入資料'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>日期:</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>類型:</label>
            <select name="type" value={formData.type} onChange={handleInputChange} required>
              <option value="收入">收入</option>
              <option value="支出">支出</option>
            </select>
          </div>
          <div className="form-group">
            <label>項目別:</label>
            <select name="category" value={formData.category} onChange={handleInputChange} required>
              <option value="">請選擇</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>金額:</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>備註說明:</label>
            <textarea name="notes" value={formData.notes} onChange={handleInputChange}></textarea>
          </div>
          <div className="form-group">
            <label>附件照片:</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {editingImageUrl && (
              <div className="current-image">
                <p>目前照片:</p>
                <img src={editingImageUrl} alt="Current Attachment" style={{ width: '80px', height: 'auto' }} /> 
                <label>
                  <input type="checkbox" checked={clearExistingImage} onChange={() => setClearExistingImage(!clearExistingImage)} />
                  清除現有照片
                </label>
              </div>
            )}
          </div>
          <button type="submit">{editingRecordId ? '更新資料' : '新增資料'}</button>
          {editingRecordId && <button type="button" onClick={handleCancelEdit}>取消編輯</button>}
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
                  <th className="text-right">金額</th>
                  <th>備註說明</th>
                  <th>附件照片</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.date).toLocaleDateString('zh-TW')}</td>
                    <td>{record.type}</td>
                    <td>{record.category}</td>
                    <td className="text-right">{formatCurrency(record.amount)}</td>
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
          {/* !! 新增餘額顯示 !! */}
          <span>餘額: ${formatCurrency(balanceTotal)}</span>
        </div>
      </section>
    </div>
  );
}

export default App;
