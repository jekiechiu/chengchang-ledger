// src/App.js (只讀端網站專用 - 增加餘額顯示)
import React, { useState, useEffect } => 'react';
import axios from 'axios';
import './App.css'; 

const API_BASE_URL = '/api/records'; 

function App() { 
  const [records, setRecords] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20; 

  const fetchRecords = async () => {
    try {
      const response = await axios.get(API_BASE_URL); 
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching records:', error.response ? error.response.data : error.message);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []); 

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);

  const totalPages = Math.ceil(records.length / recordsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const incomeTotal = records.filter(r => r.type === '收入').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const expenseTotal = records.filter(r => r.type === '支出').reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  
  // !! 新增餘額計算 !!
  const balanceTotal = incomeTotal - expenseTotal;

  const formatCurrency = (number) => {
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
                  <th className="text-right">金額</th> 
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
                    <td className="text-right">{formatCurrency(record.amount)}</td> 
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
