import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { InventoryPage, SearchPage, SearchCategory, CasesPage, CaseDetailPage, SkinDetailPage, KnivesPage, GlovesPage, WeaponsPage, CollectionsPage, CollectionDetailPage } from './pages';
import LoginPage from './pages/Login.jsx';
import RegisterPage from './pages/Register.jsx';
import AccountPage from './pages/Account.jsx';
import AgentsPage from './pages/Agents.jsx';
import CharmsPage from './pages/Charms.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import './App.css'; 
import { useCurrency } from './currency/CurrencyContext.jsx';
import discordIcon from './assets/site/discord.png';

const USER_ID = 1;
const BASE_URL = 'http://127.0.0.1:8000'; 


const PortfolioChart = ({ history, currentTotals }) => {
    const { formatPrice } = useCurrency();
    const [showTotal, setShowTotal] = useState(true);
    const [showProfit, setShowProfit] = useState(true);

    const dataForChartBase = (history || []).map(record => {
        const t = new Date(record.timestamp);
        const val = Number(record.total_value ?? 0);
        const prof = Number(record.total_profit ?? 0);
        const inv = Number(record.total_invested ?? (val - prof));
        const pct = inv > 0 ? (prof / inv) * 100 : 0;
        return {
            name: t.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
            ts: t.getTime(),
            value: val,
            profit: prof,
            profitPct: pct,
        };
    });
    const nowMs = Date.now();
    const liveValue = Number(currentTotals?.value ?? 0);
    const liveProfit = Number(currentTotals?.profit ?? 0);
    const liveInvested = Number(currentTotals?.invested ?? (liveValue - liveProfit));
    const liveProfitPct = liveInvested > 0 ? (liveProfit / liveInvested) * 100 : 0;
    const livePoint = {
        name: new Date(nowMs).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
        ts: nowMs,
        value: liveValue,
        profit: liveProfit,
        profitPct: liveProfitPct,
    };

    const dataForChart = (() => {
        if (dataForChartBase.length === 0) {
            return [livePoint];
        }

        const last = dataForChartBase[dataForChartBase.length - 1];
        if (last.ts < nowMs) {
            return [
                ...dataForChartBase,
                livePoint,
            ];
        }
        return [
            ...dataForChartBase.slice(0, -1),
            { ...dataForChartBase[dataForChartBase.length - 1], ...livePoint },
        ];
    })();

    if (dataForChart.length === 0) {
        return (
            <div style={{ height: 350, backgroundColor: 'var(--card-bg)', padding: '15px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', color:'var(--card-text-color)' }}>
                No history data.
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || payload.length === 0) return null;
        // payload is array of active lines: [{ name, value, stroke, ... }]
        // We get timestamp from the first payload item's original object
        const first = payload[0];
        const point = first.payload;
        const ts = point.ts;
        const dt = new Date(ts);

        return (
            <div style={{ background:'var(--card-bg)', border:'1px solid #3a3a3a', color:'var(--card-text-color)', padding:'8px 10px', borderRadius:8 }}>
                <div style={{ fontSize:'0.8rem', opacity:0.8, borderBottom: '1px solid #444', marginBottom: 4, paddingBottom: 2 }}>
                    {dt.toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
                {payload.map((entry, idx) => {
                    const isProfit = entry.name === 'Profit';
                    const pctStr = isProfit && point.profitPct !== undefined 
                        ? ` (${point.profitPct >= 0 ? '+' : ''}${point.profitPct.toFixed(2)}%)` 
                        : '';
                    return (
                        <div key={idx} style={{ color: entry.stroke, fontWeight: 600 }}>
                            {entry.name}: {formatPrice(entry.value)}{pctStr}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ height: 380, backgroundColor: 'var(--card-bg)', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 15, marginBottom: 10, fontSize: '0.9rem' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                    <input type="checkbox" checked={showTotal} onChange={e => setShowTotal(e.target.checked)} />
                    <span style={{ color: '#ffffff' }}>Total Value</span>
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                    <input type="checkbox" checked={showProfit} onChange={e => setShowProfit(e.target.checked)} />
                    <span style={{ color: '#4caf50' }}>Profit</span>
                </label>
            </div>
            <ResponsiveContainer width="100%" height={340}>
                <LineChart data={dataForChart} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis
                        dataKey="ts"
                        type="number"
                        domain={[ 'dataMin', nowMs ]}
                        tickFormatter={(v) => new Date(v).toLocaleString('cs-CZ', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        stroke="var(--card-text-color)"
                        tick={{ fontSize: 12 }}
                        tickMargin={10}
                    />
                    <YAxis stroke="var(--card-text-color)" domain={['auto', 'auto']} tickFormatter={(value) => `$${value}`} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    {showTotal && (
                        <Line type="monotone" dataKey="value" name="Total Value" stroke="#ffffff" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    )}
                    {showProfit && (
                        <Line type="monotone" dataKey="profit" name="Profit" stroke="#4caf50" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};


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

    const fetchData = async () => {
        setLoading(true);
        setError(null);

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

            // Keep header totals based on currently fetched portfolio prices,
            // not on historical snapshots that can lag behind.
            const liveTotals = portfolioData.reduce((acc, item) => {
                const amt = typeof item.amount === 'number' ? item.amount : 1;
                const buyUnit = Number(item.buy_price) || 0;
                const currentUnit = Number(item.current_price) || 0;
                acc.invested += buyUnit * amt;
                acc.value += currentUnit * amt;
                return acc;
            }, { invested: 0, value: 0 });

            setTotals({
                invested: liveTotals.invested,
                value: liveTotals.value,
                profit: liveTotals.value - liveTotals.invested,
            });
        } catch (err) {
            console.error("Chyba při načítání dat z API:", err);
            setError("Nepodařilo se načíst data z backendu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        
    }, [userId]);  

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
        return true; 
    });

    const sortedPortfolio = [...portfolio].sort((a, b) => {
        const diff = a.profit - b.profit;
        return sortAsc ? diff : -diff;
    });
    const profitPercent = (totals.profit / totals.invested) * 100 || 0;
    const isProfit = totals.profit >= 0;
    
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
                <PortfolioChart history={filteredHistory} currentTotals={totals} />
            </div>
            
            {sortedPortfolio.length > 0 && (
                <>
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
                </>
            )}
        </div>
    );
}

function App() {
    const { user } = useAuth();
    const { currency, cycleCurrency, refreshRates, loadingRates, lastUpdated } = useCurrency();
    const location = useLocation();
    const path = location.pathname || '/';

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [path]);

    const isSearch = path.startsWith('/search');
    const isAuthPage = path === '/login' || path === '/register' || path === '/account';
    
    const blurPaths = ['/', '/inventory'];
    const shouldBlur = !user && blurPaths.includes(path) && !isAuthPage;

    return (
        <>
            <div className="header">
                <NavLink to="/" style={{ textDecoration: 'none' }}>
                    <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--accent-color)' }}>CSInvest</h1>
                </NavLink>
                <div className="nav" style={{ display:'flex', gap:'14px', justifyContent:'center', paddingLeft:'150px', flex:1 }}>
                    <NavLink to="/" end className={({isActive}) => isActive ? 'active' : undefined}>Overview</NavLink>
                    <NavLink to="/inventory" className={({isActive}) => isActive ? 'active' : undefined}>Inventory</NavLink>
                    <NavLink to="/search" className={({isActive}) => isActive ? 'active' : undefined}>Search</NavLink>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    
                    <div style={{ display:'flex', gap:6 }} title={lastUpdated ? `Rates updated: ${new Date(lastUpdated).toLocaleString('cs-CZ')}` : 'Rates not updated'}>
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
                      }}>{loadingRates ? (<span className="spinner" aria-label="Loading FX rates" />) : '↻'}</button>
                    </div>
                    {user ? (
                        <NavLink to="/account" className="account-button" style={{ textDecoration: 'none' }}>Account</NavLink>
                    ) : (
                        <NavLink to="/login" className="account-button" style={{ textDecoration: 'none' }}>Login</NavLink>
                    )}
                </div>
            </div>
            <div className={`app-content ${shouldBlur ? 'blurred' : ''}`}>
                {shouldBlur && (
                    <div className="screen-blur">
                        <div className="screen-message" style={{ background: 'transparent', border: 'none', boxShadow: 'none', transform: 'translateY(-60%)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '32px', color: 'var(--text-color)' }}>Login to check your portfolio</div>
                            <div style={{ textAlign: 'center' }}>
                                <NavLink to="/login" className="account-button" style={{ textDecoration: 'none', border: '1px solid white' }}>Login</NavLink>
                            </div>
                        </div>
                    </div>
                )}
                <Routes>
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    {/** Add route removed; Add Item is now handled via modal in Inventory */}
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/search/knives" element={<KnivesPage />} />
                    <Route path="/search/gloves" element={<GlovesPage />} />
                    <Route path="/search/agents" element={<AgentsPage />} />
                    <Route path="/search/charms" element={<CharmsPage />} />
                    <Route path="/search/weapons" element={<WeaponsPage />} />
                    <Route path="/search/cases" element={<CasesPage />} />
                    <Route path="/search/collections" element={<CollectionsPage />} />
                    <Route path="/case/:slug" element={<CaseDetailPage />} />
                    <Route path="/collection/:slug" element={<CollectionDetailPage />} />
                    <Route path="/skin/:slug" element={<SkinDetailPage />} />
                    <Route path="/search/:category" element={<SearchCategory />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="*" element={<OverviewPage />} />
                </Routes>
            </div>
            <footer className="footer">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span>2026 CSInvest (beta) | ondaaak@gmail.com |</span>
                    <img src={discordIcon} alt="Discord" style={{ height: '16px', width: '16px' }} />
                    <span>ondaaak</span>
                </div>
            </footer>
        </>
    );
}

export default App;
