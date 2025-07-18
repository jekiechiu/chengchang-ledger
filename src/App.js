// src/App.js (只讀端網站專用)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // 假設您有 App.css

// 指向自己後端的相對路徑
const API_BASE_URL = '/api/records'; 

function App() { 
  const [records, setRecords] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20; // 每頁顯示 20 筆資料

  const fetchRecords = async () => {
    try {
      const response = await axios.get(API_BASE_URL); 
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching records:', error.response ? error.response.data : error.message);
      // alert('無法加載資料，請檢查服務是否正常運行。');
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []); // 僅在元件載入時執行一次

  // 計算當前頁面要顯示的資料
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);

  // 計算總頁數
  const totalPages = Math.ceil(records.length / recordsPerPage);

  // 更改當前頁碼
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // 計算總收入和總支出
  const incomeTotal = records.filter(r => r.type === '收入').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const expenseTotal = records.filter(r => r.type === '支出').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  // 輔助函數：將數字格式化為貨幣顯示 (XXX,XXX)
  const formatCurrency = (number) => {
    // 確保是數字，並格式化為中文數字千分位格式
    return parseFloat(number || 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="app-container">
      <h1>成昌大樓管理費支用明細</h1>

      <section className="results-section">
        <h2>所有項目</h2> 
        {records.length === 0 ? (
          <p>沒有資料可顯示。</p>
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
                  <th>憑證</th> 
                </tr>
              </thead>
              <tbody>
                {currentRecords.map(record => (
                  <tr key={record.id}>
                    <td>{new Date(record.date).toLocaleDateString('zh-TW')}</td> 
                    <td>{record.type}</td>
                    <td>{record.category}</td>
                    <td className="text-right">{formatCurrency(record.amount)}</td> {/* 金額數據靠右對齊並格式化 */}
                    <td>{record.notes}</td>
                    <td>
                      {record.image_url ? (
                        <a href={record.image_url} target="_blank" rel="noopener noreferrer">憑證</a>
                      ) : (
                        <span>無</span>
                      )}
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
          <span>收入總計: ${formatCurrency(incomeTotal)}</span> {/* 總計格式化 */}
          <span>支出總計: ${formatCurrency(expenseTotal)}</span> {/* 總計格式化 */}
        </div>
      </section>
    </div>
  );
}

export default App;
