import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { InventoryPage, SearchPage, SearchCategory, CasesPage, CaseDetailPage, SkinDetailPage, AddItemPage } from './pages';
import LoginPage from './pages/Login.jsx';
import RegisterPage from './pages/Register.jsx';
import AccountPage from './pages/Account.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import './App.css'; 
import { useCurrency } from './currency/CurrencyContext.jsx';

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000'; 

// --- Komponenta pro vykreslení grafu ---
// Používá historická data a simuluje časovou řadu
const PortfolioChart = ({ history }) => {
    const { formatPrice } = useCurrency();
    if (!history || history.length === 0) {
        return (
            <div style={{ height: 350, backgroundColor: 'var(--card-bg)', padding: '15px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', color:'var(--card-text-color)' }}>
                No history data.
            </div>
        );
    }
    const dataForChart = history.map(record => ({
        name: new Date(record.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ts: new Date(record.timestamp),
        value: Number(record.total_value ?? 0),
    }));

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || payload.length === 0) return null;
        const p = payload[0];
        const point = p && p.payload ? p.payload : null;
        const amount = point && typeof point.value === 'number' ? point.value : null;
        const time = point && point.ts ? point.ts : null;
        return (
            <div style={{ background:'var(--card-bg)', border:'1px solid #3a3a3a', color:'var(--card-text-color)', padding:'8px 10px', borderRadius:8 }}>
                <div style={{ fontWeight:600 }}>{amount !== null ? formatPrice(amount) : '-'}</div>
                {time && (
                    <div style={{ fontSize:'0.8rem', opacity:0.8 }}>
                        {time.toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </div>
                )}
            </div>
        );
    };
    return (
        <div style={{ height: 350, backgroundColor: 'var(--card-bg)', padding: '15px' }}>
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dataForChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis dataKey="name" stroke="var(--card-text-color)" />
                    <YAxis stroke="var(--card-text-color)" domain={['auto', 'auto']} tickFormatter={(value) => `$${value}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={3} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- STRÁNKA: OVERVIEW ---
function OverviewPage() {
    const { userId } = useAuth();
    const { formatPrice } = useCurrency();
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
        // Pokud není přihlášen uživatel, nastavíme prázdná data bez chyby
        if (!userId) {
            setPortfolio([]);
            setHistory([]);
            setTotals({ invested: 0, value: 0, profit: 0 });
            setLoading(false);
            return;
        }
        try {
            const [portfolioResponse, historyResponse] = await Promise.all([
                axios.get(`${BASE_URL}/portfolio/${userId}`),
                axios.get(`${BASE_URL}/portfolio-history/${userId}`)
            ]);

            const portfolioArray = Array.isArray(portfolioResponse.data) ? portfolioResponse.data : [];
            const historyArray = Array.isArray(historyResponse.data) ? historyResponse.data : [];

            const portfolioData = portfolioArray.map(item => {
                const amt = typeof item.amount === 'number' ? item.amount : 1;
                return {
                    ...item,
                    profit: (item.current_price - item.buy_price) * amt,
                };
            });

            setPortfolio(portfolioData);
            setHistory(historyArray);

            if (historyArray.length > 0) {
                const latest = historyArray[historyArray.length - 1];
                setTotals({
                    invested: parseFloat(latest.total_invested),
                    value: parseFloat(latest.total_value),
                    profit: parseFloat(latest.total_profit)
                });
            } else {
                setTotals({ invested: 0, value: 0, profit: 0 });
            }
        } catch (err) {
            console.error("Chyba při načítání dat z API:", err);
            setError("Nepodařilo se načíst data z backendu.");
        } finally {
            setLoading(false);
        }
    };

    // Spouštěč aktualizace cen
    const handleRefresh = async () => {
        setLoading(true);
        try {
            if (!userId) throw new Error('Unauthenticated');
            await axios.post(`${BASE_URL}/refresh-portfolio/${userId}`);
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
                <div className="value-amount">{formatPrice(totals.value)}</div>
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
                        <tr key={item.user_item_id}>
                            <td>{typeof item.amount === 'number' ? item.amount : 1}</td>
                            <td>{item.item?.name || '—'}</td>
                            <td>{formatPrice(item.buy_price)}</td>
                            <td>{formatPrice(item.current_price)}</td>
                            <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>{formatPrice(item.profit)}</td>
                            <td className={item.profit >= 0 ? 'profit-text' : 'loss-text'}>{((item.profit / ((item.buy_price * (typeof item.amount === 'number' ? item.amount : 1)) || 1)) * 100).toFixed(2)}%</td>
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
    const { currency, cycleCurrency, refreshRates, loadingRates, lastUpdated } = useCurrency();
    const location = useLocation();
    const path = location.pathname || '/';
    const isSearch = path.startsWith('/search');
    const isAuthPage = path === '/login' || path === '/register' || path === '/account';
    // Only blur selected protected pages (overview and inventory) when logged out
    const blurPaths = ['/', '/inventory'];
    const shouldBlur = !user && blurPaths.includes(path) && !isAuthPage;

    // Theme handling
    const [theme, setTheme] = useState('light');
    useEffect(() => {
        const saved = localStorage.getItem('csinvest:theme');
        const t = saved === 'dark' ? 'dark' : 'light';
        setTheme(t);
        document.body.setAttribute('data-theme', t);
    }, []);
    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('csinvest:theme', next);
    };
    return (
        <>
            <div className="header">
                <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--accent-color)' }}>CSInvest</h1>
                <div className="nav" style={{ display:'flex', gap:'14px', justifyContent:'center', paddingLeft:'150px', flex:1 }}>
                    <NavLink to="/" end className={({isActive}) => isActive ? 'active' : undefined}>Overview</NavLink>
                    <NavLink to="/inventory" className={({isActive}) => isActive ? 'active' : undefined}>Inventory</NavLink>
                    <NavLink to="/search" className={({isActive}) => isActive ? 'active' : undefined}>Search</NavLink>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button aria-label="Toggle theme" className={`theme-toggle ${theme}`} onClick={toggleTheme}></button>
                    <div style={{ display:'flex', gap:6 }}>
                      <button aria-label="Toggle currency" onClick={cycleCurrency} style={{
                          background:'var(--button-bg)',
                          color:'var(--button-text)',
                          border:'1px solid var(--border-color)',
                          padding:'6px 10px',
                          borderRadius:10,
                          cursor:'pointer',
                          fontSize:'0.75rem'
                      }}>{currency}</button>
                      <button aria-label="Refresh FX rates" onClick={refreshRates} disabled={loadingRates} style={{
                          background:'var(--button-bg)',
                          color:'var(--button-text)',
                          border:'1px solid var(--border-color)',
                          padding:'6px 10px',
                          borderRadius:10,
                          cursor: loadingRates ? 'not-allowed':'pointer',
                          fontSize:'0.75rem'
                      }}>{loadingRates ? '↻…' : '↻'}</button>
                    </div>
                    {user ? (
                        <NavLink to="/account" className="account-button">Account</NavLink>
                    ) : (
                        <NavLink to="/login" className="account-button">Login</NavLink>
                    )}
                </div>
            </div>
            <div className={`app-content ${shouldBlur ? 'blurred' : ''}`}>
                {shouldBlur && (
                    <div className="screen-blur">
                        <div className="screen-message">
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>Login to preview your skins</div>
                                                        <div style={{ textAlign:'center' }}>
                                                            <NavLink to="/login" className="account-button">Login</NavLink>
                                                        </div>
                        </div>
                    </div>
                )}
                <Routes>
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/add" element={<AddItemPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/search/cases" element={<CasesPage />} />
                    <Route path="/case/:slug" element={<CaseDetailPage />} />
                    <Route path="/skin/:slug" element={<SkinDetailPage />} />
                    <Route path="/search/:category" element={<SearchCategory />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="*" element={<OverviewPage />} />
                </Routes>
            </div>
            <footer className="footer">
                <span>© 2025 CSInvest (beta)</span>
                <a href="#" aria-label="About placeholder">About</a>
                <a href="#" aria-label="Contact placeholder">Contact</a>
            </footer>
        </>
    );
}

export default App;
// Footer injected below in root render wrapper