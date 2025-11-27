import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { InventoryPage, SearchPage, SearchCategory } from './pages';
import LoginPage from './pages/Login.jsx';
import AccountPage from './pages/Account.jsx';
import { useAuth } from './auth/AuthContext.jsx';
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

// --- STRÁNKA: OVERVIEW ---
function OverviewPage() {
    const { userId } = useAuth();
    const [portfolio, setPortfolio] = useState([]);
    const [history, setHistory] = useState([]);
    const [totals, setTotals] = useState({ invested: 0, value: 0, profit: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeframe, setTimeframe] = useState('all');
    const [sortAsc, setSortAsc] = useState(false);

    // Načítání a zpracování dat
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!userId) throw new Error('Unauthenticated');
            const [portfolioResponse, historyResponse] = await Promise.all([
                axios.get(`${BASE_URL}/portfolio/${userId}`),
                axios.get(`${BASE_URL}/portfolio-history/${userId}`)
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

    // --- FILTRACE HISTORIE PRO GRAF ---
    const now = new Date();
    const filteredHistory = history.filter((record) => {
        const t = new Date(record.timestamp);
        if (timeframe === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            return t >= weekAgo;
        }
        if (timeframe === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(now.getMonth() - 1);
            return t >= monthAgo;
        }
        if (timeframe === 'year') {
            const yearAgo = new Date(now);
            yearAgo.setFullYear(now.getFullYear() - 1);
            return t >= yearAgo;
        }
        return true; // all
    });

    // --- LOGIKA ŘAZENÍ ---
    const sortedPortfolio = [...portfolio].sort((a, b) => {
        const diff = a.profit - b.profit;
        return sortAsc ? diff : -diff;
    });
    const profitPercent = (totals.profit / totals.invested) * 100 || 0;
    const isProfit = totals.profit >= 0;

    // --- RENDERING ---
    // Per-section overlay removed; global overlay handled in App layout
    
    return (
        <div className="dashboard-container">
            <div className="total-value-block">
                <div className="total-value-label">Total value</div>
                <div className="value-amount">{totals.value.toFixed(2)}€</div>
                <div className={isProfit ? 'profit-indicator' : 'loss-indicator'}>
                    {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
                </div>
            </div>

            <div className="stat-card">
                <div className="chart-toolbar">
                    <div className="chart-filters">
                        {['week','month','year','all'].map((tf) => (
                            <button
                                key={tf}
                                className={`chart-filter ${timeframe === tf ? 'active' : ''}`}
                                onClick={() => setTimeframe(tf)}
                            >
                                {tf === 'week' && 'week'}
                                {tf === 'month' && 'month'}
                                {tf === 'year' && 'year'}
                                {tf === 'all' && 'all'}
                            </button>
                        ))}
                    </div>
                </div>
                <PortfolioChart history={filteredHistory} />
            </div>

            <button onClick={handleRefresh} disabled={loading} className="account-button refresh-button">
                {loading ? 'Aktualizuji ceny...' : 'Refresh Ceny'}
            </button>
            
            <h2 className="mpi-header">
                Most profitable items
                <button
                    className={`arrow-toggle ${sortAsc ? 'rotated' : ''}`}
                    onClick={() => setSortAsc(!sortAsc)}
                    aria-label="Toggle sort order"
                >
                    ↓
                </button>
            </h2>
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
    );
}

// --- HLAVNÍ APLIKACE / LAYOUT ---
function App() {
    const { user } = useAuth();
    const location = useLocation();
    const path = location.pathname || '/';
    const isSearch = path.startsWith('/search');
    const isAuthPage = path === '/login' || path === '/account';
    const shouldBlur = !user && !isSearch && !isAuthPage; // blur Overview & Inventory only when logged out
    return (
        <>
            <div className="header">
                <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--accent-color)' }}>CSInvest</h1>
                <div className="nav">
                    <NavLink to="/" end className={({isActive}) => isActive ? 'active' : undefined}>Overview</NavLink>
                    <NavLink to="/inventory" className={({isActive}) => isActive ? 'active' : undefined}>Inventory</NavLink>
                    <NavLink to="/search" className={({isActive}) => isActive ? 'active' : undefined}>Search</NavLink>
                </div>
                {user ? (
                    <NavLink to="/account" className="account-button">Account</NavLink>
                ) : (
                    <NavLink to="/login" className="account-button">Login</NavLink>
                )}
            </div>
            <div className={`app-content ${shouldBlur ? 'blurred' : ''}`}>
                {shouldBlur && (
                    <div className="screen-blur">
                        <div className="screen-message">
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>Login to preview your skins</div>
                            <NavLink to="/login" className="account-button">Login</NavLink>
                        </div>
                    </div>
                )}
                <Routes>
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/search/:category" element={<SearchCategory />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="*" element={<OverviewPage />} />
                </Routes>
            </div>
        </>
    );
}

export default App;