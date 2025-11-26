import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css'; 

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000'; 

// --- Komponenta pro vykreslení grafu ---
// Používá historická data a simuluje časovou řadu
const PortfolioChart = ({ history }) => {
    // Příprava dat pro Recharts
    const dataForChart = history.map(record => ({
        // Převod timestampu na čitelný formát (měsíc/den)
        name: new Date(record.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Hodnota Portfolia': parseFloat(record.total_value),
    }));

    return (
        <div style={{ height: 350, backgroundColor: 'var(--card-bg)', padding: '15px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataForChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis dataKey="name" stroke="var(--card-text-color)" />
                    <YAxis stroke="var(--card-text-color)" domain={['auto', 'auto']} tickFormatter={(value) => `$${value}`} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid #3a3a3a', color: 'var(--card-text-color)' }} />
                    <Line type="monotone" dataKey="Hodnota Portfolia" stroke="#ffffff" strokeWidth={3} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- HLAVNÍ KOMPONENTA ---
function App() {
    const [portfolio, setPortfolio] = useState([]);
    const [history, setHistory] = useState([]);
    const [totals, setTotals] = useState({ invested: 0, value: 0, profit: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Načítání a zpracování dat
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [portfolioResponse, historyResponse] = await Promise.all([
                axios.get(`${BASE_URL}/portfolio/${USER_ID}`),
                axios.get(`${BASE_URL}/portfolio-history/${USER_ID}`)
            ]);

            // Data pro tabulku
            const portfolioData = portfolioResponse.data.map(item => ({
                ...item,
                profit: item.current_price - item.buy_price // Přidáme profit pro řazení
            }));

            setPortfolio(portfolioData);
            setHistory(historyResponse.data);

            // Zpracování součtů z historie (poslední záznam)
            if (historyResponse.data.length > 0) {
                const latest = historyResponse.data.slice(-1)[0]; 
                setTotals({
                    invested: parseFloat(latest.total_invested),
                    value: parseFloat(latest.total_value),
                    profit: parseFloat(latest.total_profit)
                });
            }
        } catch (err) {
            console.error("Chyba při načítání dat z API:", err);
            setError("Nepodařilo se kontaktovat backend (port 8000). Zkontrolujte připojení.");
        } finally {
            setLoading(false);
        }
    };

    // Spouštěč aktualizace cen
    const handleRefresh = async () => {
        setLoading(true);
        try {
            await axios.post(`${BASE_URL}/refresh-portfolio/${USER_ID}`);
            await fetchData(); // Znovu načíst data po aktualizaci
        } catch (err) {
            console.error("Chyba při aktualizaci:", err);
            setError("Aktualizace selhala. Zkontrolujte logy backendu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []); 

    // --- LOGIKA ŘAZENÍ ---
    // Řadíme portfolium podle profitu sestupně, jak je v návrhu ("Most profitable items")
    const sortedPortfolio = [...portfolio].sort((a, b) => b.profit - a.profit);
    const profitPercent = (totals.profit / totals.invested) * 100 || 0;
    const isProfit = totals.profit >= 0;

    // --- RENDERING ---
    if (error) {
        return <div className="loading" style={{color: 'var(--loss-color)'}}>Chyba: {error}</div>;
    }
    if (loading && portfolio.length === 0) {
        return <div className="loading">Načítám data z backendu...</div>;
    }
    
    return (
        <>
        <div className="header">
            <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--accent-color)' }}>CSInvest</h1>
            <div className="nav">
                <a href="#">Overview</a>
                <a href="#">Inventory</a>
                <a href="#">Search</a>
            </div>
            <button className="account-button">Account *</button>
        </div>
        
        <div className="dashboard-container">
            <div className="total-value-block">
                <div className="total-value-label">Total value</div>
                <div className="value-amount">{totals.value.toFixed(2)}€</div>
                <div className={isProfit ? 'profit-indicator' : 'loss-indicator'}>
                    {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
                </div>
            </div>

            <div className="stat-card">
                <PortfolioChart history={history} />
            </div>

            <button onClick={handleRefresh} disabled={loading} className="account-button refresh-button">
                {loading ? 'Aktualizuji ceny...' : 'Refresh Ceny (CSFloat)'}
            </button>
            
            <h2>Most profitable items ↓</h2>
            <table>
                <thead>
                    <tr>
                        <th>Amount</th>
                        <th>Name</th>
                        <th>Buy Price</th>
                        <th>Current Price</th>
                        <th>Profit</th>
                        <th>Profit %</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedPortfolio.map(item => (
                        <tr key={item.user_skin_id}>
                            <td>1</td>
                            <td>{item.skin.name}</td>
                            <td>{item.buy_price.toFixed(2)}€</td>
                            <td>{item.current_price.toFixed(2)}€</td>
                            <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>{item.profit.toFixed(2)}€</td>
                            <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>{((item.profit / item.buy_price) * 100).toFixed(2)}%</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        </>
    );
}

export default App;