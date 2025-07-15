import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    date: '', type: '收入', category: '', amount: '', notes: '' // 已移除 itemName
  });
  const [imageFile, setImageFile] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchParams, setSearchParams] = useState({
    startDate: '', endDate: '', category: '所有項目'
  });

  const categories = ['管理費', '租金收入', '水電費', '維修費', '其他'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
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

      const response = await axios.post(`/api/records`, dataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log('Record added successfully:', response.data);
      // setFormData 的重置已移除 itemName
      setFormData({ date: '', type: '收入', category: '', amount: '', notes: '' });
      setImageFile(null);
      fetchRecords();
      alert('資料儲存成功！');
    } catch (error) {
      console.error('Error adding record:', error.response ? error.response.data : error.message);
      alert('資料儲存失敗，請檢查！');
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
        <h2>輸入資料</h2>
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
          {/* 已刪除項目名稱輸入框 */}
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
          </div>
          <button type="submit" className="save-button">儲存資料</button>
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
                {/* 已刪除項目名稱表頭 */}
                <th>金額</th>
                <th>備註說明</th>
                <th>附件照片</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{record.type}</td>
                  <td>{record.category}</td>
                  {/* 已刪除項目名稱單元格 */}
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
