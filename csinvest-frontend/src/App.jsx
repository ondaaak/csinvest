import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Routes, Route, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import './App.css'; 
import { useCurrency } from './currency/CurrencyContext.jsx';
import { hasPendingReturnTarget } from './utils/returnTarget.js';
import discordIcon from './assets/site/discord.png';
import steamIcon from './assets/site/steam.png';

const BASE_URL = '/api'; 

const InventoryPage = lazy(() => import('./pages/Inventory.jsx'));
const SearchPage = lazy(() => import('./pages/Search.jsx'));
const CasesPage = lazy(() => import('./pages/Cases.jsx'));
const CaseDetailPage = lazy(() => import('./pages/CaseDetail.jsx'));
const SkinDetailPage = lazy(() => import('./pages/SkinDetail.jsx'));
const KnivesPage = lazy(() => import('./pages/Knives.jsx'));
const GlovesPage = lazy(() => import('./pages/Gloves.jsx'));
const WeaponsPage = lazy(() => import('./pages/Weapons.jsx'));
const CollectionsPage = lazy(() => import('./pages/Collections.jsx'));
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetail.jsx'));
const LoginPage = lazy(() => import('./pages/Login.jsx'));
const RegisterPage = lazy(() => import('./pages/Register.jsx'));
const AccountPage = lazy(() => import('./pages/Account.jsx'));
const AgentsPage = lazy(() => import('./pages/Agents.jsx'));
const CharmsPage = lazy(() => import('./pages/Charms.jsx'));

const RouteLoadingFallback = () => (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--text-color)' }}>
        <div style={{ opacity: 0.8 }}>Loading…</div>
    </div>
);


const PortfolioChart = ({ history, currentTotals, feeMultiplier = 1 }) => {
    const { formatPrice } = useCurrency();
    const [showTotal, setShowTotal] = useState(true);
    const [showProfit, setShowProfit] = useState(true);
    const chartHostRef = useRef(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!chartHostRef.current) {
            return;
        }

        const measure = () => {
            const rect = chartHostRef.current.getBoundingClientRect();
            const nextWidth = Math.max(0, Math.floor(rect.width));
            const nextHeight = Math.max(0, Math.floor(rect.height));
            setChartSize({ width: nextWidth, height: nextHeight });
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(chartHostRef.current);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    const dataForChartBase = (history || []).map(record => {
        const t = new Date(record.timestamp);
        const grossVal = Number(record.total_value ?? 0);
        const inv = Number(record.total_invested ?? 0);
        const val = grossVal * feeMultiplier;
        const prof = val - inv;
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
    const segmentedProfitData = (() => {
        if (dataForChart.length <= 1) {
            return dataForChart.map((point) => {
                const profit = Number(point?.profit ?? 0);
                return {
                    ...point,
                    profitPositive: profit >= 0 ? profit : null,
                    profitNegative: profit < 0 ? profit : null,
                };
            });
        }

        const out = [];
        for (let i = 0; i < dataForChart.length; i += 1) {
            const current = dataForChart[i];
            const currentProfit = Number(current?.profit ?? 0);
            out.push({
                ...current,
                profitPositive: currentProfit >= 0 ? currentProfit : null,
                profitNegative: currentProfit < 0 ? currentProfit : null,
            });

            if (i === dataForChart.length - 1) continue;

            const next = dataForChart[i + 1];
            const nextProfit = Number(next?.profit ?? 0);
            const crossesZero = (currentProfit < 0 && nextProfit > 0) || (currentProfit > 0 && nextProfit < 0);
            if (!crossesZero) continue;

            const ts1 = Number(current?.ts ?? 0);
            const ts2 = Number(next?.ts ?? ts1);
            const value1 = Number(current?.value ?? 0);
            const value2 = Number(next?.value ?? value1);
            const ratio = (0 - currentProfit) / (nextProfit - currentProfit);
            const crossTs = ts1 + ((ts2 - ts1) * ratio);
            const crossValue = value1 + ((value2 - value1) * ratio);

            out.push({
                ...current,
                ts: crossTs,
                name: new Date(crossTs).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
                value: crossValue,
                profit: 0,
                profitPct: 0,
                profitPositive: 0,
                profitNegative: 0,
            });
        }

        return out;
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
                {Array.from(new Map(payload.map((entry) => [entry.name, entry])).values()).map((entry, idx) => {
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
        <div className="overview-chart-box" style={{ height: 'clamp(260px, 52vw, 380px)', backgroundColor: 'var(--card-bg)', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 15, marginBottom: 10, fontSize: '0.9rem' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                    <input type="checkbox" checked={showTotal} onChange={e => setShowTotal(e.target.checked)} />
                    <span style={{ color: '#ffffff' }}>Total Value</span>
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                    <input type="checkbox" checked={showProfit} onChange={e => setShowProfit(e.target.checked)} />
                    <span style={{ color: '#ffffff' }}>Profit</span>
                </label>
            </div>
            <div ref={chartHostRef} style={{ width: '100%', height: 'calc(100% - 36px)', minWidth: 220, minHeight: 220 }}>
                {chartSize.width > 0 && chartSize.height > 0 && (
                    <LineChart width={chartSize.width} height={chartSize.height} data={segmentedProfitData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
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
                        <YAxis stroke="var(--card-text-color)" domain={['auto', 'auto']} tickFormatter={(value) => formatPrice(value)} width={84} />
                        <Tooltip content={<CustomTooltip />} />
                        {showTotal && (
                            <Line type="monotone" dataKey="value" name="Total Value" stroke="#ffffff" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        )}
                        {showProfit && (
                            <>
                                <Line type="monotone" dataKey="profitPositive" name="Profit" stroke="var(--profit-color)" strokeWidth={3} dot={false} connectNulls={false} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="profitNegative" name="Profit" stroke="var(--loss-color)" strokeWidth={3} dot={false} connectNulls={false} activeDot={{ r: 6 }} />
                            </>
                        )}
                    </LineChart>
                )}
            </div>
        </div>
    );
};


function OverviewPage() {
    const { userId } = useAuth();
    const { formatPrice } = useCurrency();
    const [portfolio, setPortfolio] = useState([]);
    const [history, setHistory] = useState([]);
    const [totals, setTotals] = useState({ invested: 0, value: 0, profit: 0 });
    const [feeMultiplier, setFeeMultiplier] = useState(0.9604);
    const [timeframe, setTimeframe] = useState('all');
    const [sortAsc, setSortAsc] = useState(false);

    const clampFeePct = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, n));
    };

    const toNetMultiplier = (sellFeePct, withdrawFeePct) => {
        const sell = clampFeePct(sellFeePct) / 100;
        const withdraw = clampFeePct(withdrawFeePct) / 100;
        return Math.max(0, (1 - sell) * (1 - withdraw));
    };

    const fetchData = async () => {
        if (!userId) {
            setPortfolio([]);
            setHistory([]);
            setTotals({ invested: 0, value: 0, profit: 0 });
            return;
        }
        try {
            const token = localStorage.getItem('csinvest:token');
            const authConfig = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
            const [portfolioResponse, historyResponse, meResponse] = await Promise.all([
                axios.get(`${BASE_URL}/portfolio/${userId}`, authConfig),
                axios.get(`${BASE_URL}/portfolio-history/${userId}`, authConfig),
                axios.get(`${BASE_URL}/auth/me`, authConfig)
            ]);

            const portfolioArray = Array.isArray(portfolioResponse.data) ? portfolioResponse.data : [];
            const historyArray = Array.isArray(historyResponse.data) ? historyResponse.data : [];
            const sellFeePct = clampFeePct(meResponse?.data?.sell_fee_pct ?? 2);
            const withdrawFeePct = clampFeePct(meResponse?.data?.withdraw_fee_pct ?? 2);
            const nextFeeMultiplier = toNetMultiplier(sellFeePct, withdrawFeePct);
            setFeeMultiplier(nextFeeMultiplier);

            const portfolioData = portfolioArray.map(item => {
                const amt = typeof item.amount === 'number' ? item.amount : 1;
                return {
                    ...item,
                    profit: (item.current_price - item.buy_price) * amt,
                };
            });

            setPortfolio(portfolioData);
            setHistory(historyArray);

            // Keep overview totals aligned with Inventory summary logic:
            // apply fees only on non-cash items, then add cash back 1:1.
            const nonCashItems = portfolioData.filter((item) => {
                const slug = String(item?.slug || item?.item?.slug || '').toLowerCase();
                const name = String(item?.item?.name || '').toLowerCase();
                return slug !== 'cash' && name !== 'cash';
            });
            const cashItems = portfolioData.filter((item) => {
                const slug = String(item?.slug || item?.item?.slug || '').toLowerCase();
                const name = String(item?.item?.name || '').toLowerCase();
                return slug === 'cash' || name === 'cash';
            });

            const nonCashTotals = nonCashItems.reduce((acc, item) => {
                const amt = typeof item.amount === 'number' ? item.amount : 1;
                const buyUnit = Number(item.buy_price) || 0;
                const currentUnit = Number(item.current_price) || 0;
                acc.invested += buyUnit * amt;
                acc.value += currentUnit * amt;
                return acc;
            }, { invested: 0, value: 0 });

            const cashValue = cashItems.reduce((acc, item) => {
                const amt = typeof item.amount === 'number' ? item.amount : 1;
                const buyUnit = Number(item.buy_price) || 0;
                return acc + (buyUnit * amt);
            }, 0);

            const netValueAfterFees = (nonCashTotals.value * nextFeeMultiplier) + cashValue;
            const investedWithCash = nonCashTotals.invested + cashValue;

            setTotals({
                invested: investedWithCash,
                value: netValueAfterFees,
                profit: netValueAfterFees - investedWithCash,
            });
        } catch (err) {
            console.error("Chyba při načítání dat z API:", err);
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
            <div className="dashboard-container overview-page">
            <div className="total-value-block">
                <div className="total-value-label">Total value</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.7, marginBottom: 4 }}>After sell + withdraw fees</div>
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
                <PortfolioChart history={filteredHistory} currentTotals={totals} feeMultiplier={feeMultiplier} />
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
                        <div className="overview-table-wrap">
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
                </>
            )}
        </div>
    );
}

function App() {
    const { user } = useAuth();
    const { currency, cycleCurrency, refreshRates, loadingRates, lastUpdated, rates } = useCurrency();
    const location = useLocation();
    const navigationType = useNavigationType();
    const path = location.pathname || '/';
    const scrollPositionsRef = useRef(new Map());
    const restoreTimerRef = useRef(null);
    const routeKey = `${location.pathname}${location.search}`;

    const getScrollSnapshot = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        return { y, max };
    };

    const readSavedSnapshot = (key) => {
        const inMemory = scrollPositionsRef.current.get(key);
        if (inMemory && typeof inMemory === 'object') {
            return inMemory;
        }

        const raw = sessionStorage.getItem(`scroll:${key}`);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && Number.isFinite(parsed.y)) {
                return {
                    y: Math.max(0, Number(parsed.y) || 0),
                    max: Number.isFinite(parsed.max) ? Math.max(0, Number(parsed.max)) : null,
                };
            }
        } catch {
            const legacy = Number(raw);
            if (Number.isFinite(legacy) && legacy >= 0) {
                return { y: legacy, max: null };
            }
        }

        return null;
    };

    const currencySymbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CZK: 'Kč',
        RUB: '₽',
    };
    const currentRate = typeof rates?.[currency] === 'number' ? rates[currency] : 1;
    const ratesTooltip = `${lastUpdated ? `Rates updated: ${new Date(lastUpdated).toLocaleString('cs-CZ')}` : 'Rates updated: not yet'}\n1$ = ${currentRate.toFixed(2)}${currencySymbols[currency] || currency}`;

    useEffect(() => {
        if (restoreTimerRef.current) {
            clearTimeout(restoreTimerRef.current);
            restoreTimerRef.current = null;
        }

        const saveScroll = () => {
            const snapshot = getScrollSnapshot();
            scrollPositionsRef.current.set(routeKey, snapshot);
            try {
                sessionStorage.setItem(`scroll:${routeKey}`, JSON.stringify(snapshot));
            } catch {
                // Ignore storage write errors.
            }
        };

        window.addEventListener('scroll', saveScroll, { passive: true });
        return () => {
            saveScroll();
            window.removeEventListener('scroll', saveScroll);
        };
    }, [routeKey]);

    useEffect(() => {
        if (navigationType === 'POP') {
            if (hasPendingReturnTarget()) {
                return;
            }

            const saved = readSavedSnapshot(routeKey);

            if (saved && Number.isFinite(saved.y)) {
                let tries = 0;
                const maxTries = 80;
                const restore = () => {
                    const maxScrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                    const wasNearBottom = Number.isFinite(saved.max) ? saved.y >= (saved.max - 24) : false;
                    const ratioTarget = Number.isFinite(saved.max) && saved.max > 0
                        ? (saved.y / saved.max) * maxScrollable
                        : saved.y;
                    const target = wasNearBottom
                        ? maxScrollable
                        : Math.max(0, Math.min(maxScrollable, ratioTarget));

                    window.scrollTo(0, target);
                    const reached = Math.abs((window.scrollY || 0) - target) <= 3;
                    const canReach = maxScrollable >= target - 3;

                    if ((reached || canReach) || tries >= maxTries) {
                        return;
                    }

                    tries += 1;
                    restoreTimerRef.current = setTimeout(restore, 60);
                };

                requestAnimationFrame(() => {
                    requestAnimationFrame(restore);
                });
                return;
            }
        }
        window.scrollTo(0, 0);
    }, [routeKey, path, navigationType]);

    const isAuthPage = path === '/login' || path === '/register' || path === '/account';
    
    const blurPaths = ['/overview', '/inventory'];
    const shouldBlur = !user && blurPaths.includes(path) && !isAuthPage;

    return (
        <>
            <div className="header">
                <div className="header-left">
                    <NavLink to="/" style={{ textDecoration: 'none' }}>
                        <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--accent-color)' }}>CS2Invests</h1>
                    </NavLink>
                </div>
                <div className="header-center nav">
                    <NavLink to="/overview" className={({isActive}) => isActive ? 'active' : undefined}>Overview</NavLink>
                    <NavLink to="/inventory" className={({isActive}) => isActive ? 'active' : undefined}>Inventory</NavLink>
                    <NavLink to="/search" className={({isActive}) => isActive ? 'active' : undefined}>Search</NavLink>
                </div>
                <div className="header-right">
                    
                                        <div className="header-tools" title={ratesTooltip}>
                      <button aria-label="Toggle currency" onClick={cycleCurrency} style={{
                          background:'var(--button-bg)',
                          color:'var(--button-text)',
                          border:'none',
                          padding:'6px 10px',
                          borderRadius:10,
                          cursor:'pointer',
                          fontSize:'0.75rem'
                      }}>{currency}</button>
                      <button aria-label="Refresh FX rates" onClick={refreshRates} disabled={loadingRates} style={{
                          background:'var(--button-bg)',
                          color:'var(--button-text)',
                          border:'none',
                          padding:'6px 10px',
                          borderRadius:10,
                          cursor: loadingRates ? 'not-allowed':'pointer',
                          fontSize:'0.75rem'
                      }}>{loadingRates ? (<span className="spinner" aria-label="Loading FX rates" />) : '↻'}</button>
                    </div>
                    {user ? (
                        <NavLink to="/account" className="account-button header-bordered-button" style={{ textDecoration: 'none' }}>Account</NavLink>
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
                <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<SearchPage />} />
                        <Route path="/overview" element={<OverviewPage />} />
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
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/account" element={<AccountPage />} />
                        <Route path="*" element={<SearchPage />} />
                    </Routes>
                </Suspense>
            </div>
            <footer className="footer">
                <div className="footer-line">2026 CS2Invests (beta) |</div>
                <div className="footer-line">ondaaak@gmail.com |</div>
                <div className="footer-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <img src={discordIcon} alt="Discord" style={{ height: '14px', width: '14px' }} />
                    <span>ondaaak</span>
                </div>
                <div className="footer-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span>|</span>
                    <a
                        href="https://steamcommunity.com/profiles/76561199012173128/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <img src={steamIcon} alt="Steam" style={{ height: '14px', width: '14px' }} />
                        <span>ondra</span>
                    </a>
                </div>
            </footer>
        </>
    );
}

export default App;
