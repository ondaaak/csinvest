import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 

const USER_ID = 1;
// Ujistěte se, že toto odpovídá adrese, kde běží Uvicorn
const BASE_URL = 'http://127.0.0.1:8000'; 

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Funkce pro získání a přepočet dat
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Získání detailu portfolia a historických dat
      const [portfolioResponse, historyResponse] = await Promise.all([
        axios.get(`${BASE_URL}/portfolio/${USER_ID}`),
        axios.get(`${BASE_URL}/portfolio-history/${USER_ID}`)
      ]);

      setPortfolio(portfolioResponse.data);

      // Zpracujeme poslední záznam z historie pro zobrazení součtů
      if (historyResponse.data.length > 0) {
        // Vždy bereme nejnovější záznam z konce pole
        const latest = historyResponse.data.slice(-1)[0]; 
        setTotals({
          invested: parseFloat(latest.total_invested).toFixed(2),
          value: parseFloat(latest.total_value).toFixed(2),
          profit: parseFloat(latest.total_profit).toFixed(2)
        });
      } else {
        // Pokud historie neexistuje (stává se to na začátku), nastavíme nuly
        setTotals({ invested: '0.00', value: '0.00', profit: '0.00' });
      }
      
    } catch (err) {
      console.error("Chyba při načítání dat z API:", err);
      // Detailní chybová zpráva pro uživatele
      setError("Nepodařilo se kontaktovat backend (port 8000). Zkontrolujte, zda běží server.");
    } finally {
      setLoading(false);
    }
  };

  // Funkce pro spuštění aktualizace cen
  const handleRefresh = async () => {
    setLoading(true);
    try {
      // POST volání spustí stahování dat z CSFloat
      await axios.post(`${BASE_URL}/refresh-portfolio/${USER_ID}`);
      // Po úspěšné aktualizaci získáme nová data
      await fetchData(); 
    } catch (err) {
      console.error("Chyba při aktualizaci:", err);
      setError("Aktualizace selhala. Zkontrolujte logy backendu.");
    } finally {
      setLoading(false);
    }
  };

  // Načíst data při prvním renderu
  useEffect(() => {
    fetchData();
  }, []); 

  // --- RENDERING ---
  if (loading && portfolio.length === 0) {
    return <div className="loading">Načítám data z backendu...</div>;
  }
  if (error) {
    return <div className="error-message">Chyba: {error}</div>;
  }
  if (portfolio.length === 0) {
    return <div className="loading">Portfolio je prázdné.</div>;
  }

  return (
    <div className="dashboard">
      <h1>CSInvest Portfolio App 💰</h1>
      
      <div className="summary-controls">
        <button onClick={handleRefresh} disabled={loading}>
          {loading ? 'Aktualizuji...' : 'Refresh Ceny (CSFloat)'}
        </button>
      </div>

      {/* Zobrazení souhrnu */}
      <div className="summary">
        <h2>Souhrn Portfolia (USD)</h2>
        <p>Celkem investováno: <b>${totals.invested}</b></p>
        <p>Aktuální hodnota: <b style={{color: totals.profit >= 0 ? 'green' : 'red'}}>${totals.value}</b></p>
        <p>Zisk/Ztráta: <b style={{color: totals.profit >= 0 ? 'green' : 'red'}}>{totals.profit}</b> USD</p>
      </div>

      {/* Zobrazení tabulky skinů */}
      <h2>Detailní Inventář</h2>
      <table>
        <thead>
          <tr>
            <th>Název Skinu</th>
            <th>Opotřebení</th>
            <th>Cena Nákupu</th>
            <th>Aktuální Cena</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.map(item => {
            const profit = (item.current_price - item.buy_price);
            return (
              <tr key={item.user_skin_id}>
                <td>{item.skin.name}</td>
                <td>{item.skin.wear}</td>
                <td>${item.buy_price.toFixed(2)}</td>
                <td>${item.current_price.toFixed(2)}</td>
                <td style={{ color: profit >= 0 ? 'green' : 'red' }}>
                  {profit.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;