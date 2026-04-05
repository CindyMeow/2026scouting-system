import React, { useState, useEffect } from 'react';

const EventSwitcher = () => {
    const [config, setConfig] = useState({
        year: '2026',
        eventKey: '2026txcle'
    });
    const [currentStatus, setCurrentStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const eventOptions = ["2026txcle", "2026txman", "2026twno", "2026chcmp"];

    useEffect(() => {
        fetch(`http://${window.location.hostname}:5000/api/system/config`)
            .then(res => res.json())
            .then(data => {
                setConfig({ year: data.year, eventKey: data.eventKey });
                setCurrentStatus(data.eventKey);
            });
    }, []);

    const handleSwitch = async () => {
        if (!window.confirm(`確定切換至 ${config.eventKey}？`)) return;
        setLoading(true);
        try {
            await fetch(`http://${window.location.hostname}:5000/api/system/switch-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            window.location.reload(); 
        } catch (err) {
            alert("切換失敗");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sidebar-event-switcher">
            <div className="current-event-badge">
                <small>目前載入：</small>
                <span>{currentStatus || '---'}</span>
            </div>
            
            <div className="switcher-inputs">
                <div className="input-row">
                    <div className="input-item">
                        <label>年度</label>
                        <select 
                            value={config.year} 
                            onChange={(e) => setConfig({...config, year: e.target.value})}
                        >
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                        </select>
                    </div>
                </div>

                <div className="input-row">
                    <div className="input-item">
                        <label>賽事代碼</label>
                        <input 
                            list="sidebar-event-list" 
                            value={config.eventKey}
                            onChange={(e) => setConfig({...config, eventKey: e.target.value.toLowerCase()})}
                            placeholder="輸入或選擇"
                        />
                        <datalist id="sidebar-event-list">
                            {eventOptions.map(opt => <option key={opt} value={opt} />)}
                        </datalist>
                    </div>
                </div>

                <button 
                    onClick={handleSwitch} 
                    disabled={loading}
                    className="switch-confirm-btn"
                >
                    {loading ? '切換中...' : '確認切換環境'}
                </button>
            </div>

            <style>{`
                .sidebar-event-switcher {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    width: 100%;
                    box-sizing: border-box; /* 確保 padding 不會撐開寬度 */
                }
                .current-event-badge {
                    margin-bottom: 12px;
                    display: flex;
                    flex-direction: column;
                }
                .current-event-badge small {
                    color: #94a3b8;
                    font-size: 10px;
                }
                .current-event-badge span {
                    color: #fbbf24;
                    font-weight: bold;
                    font-size: 14px;
                }
                .switcher-inputs {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .input-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .input-item label {
                    font-size: 10px;
                    color: #94a3b8;
                }
                .input-item select, .input-item input {
                    background: #1e293b;
                    border: 1px solid #334155;
                    color: white;
                    padding: 6px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    width: 100%;
                    box-sizing: border-box;
                }
                .switch-confirm-btn {
                    background: #8b5cf6;
                    color: white;
                    border: none;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: bold;
                    margin-top: 4px;
                    transition: background 0.2s;
                }
                .switch-confirm-btn:hover {
                    background: #7c3aed;
                }
                .switch-confirm-btn:disabled {
                    background: #475569;
                }
            `}</style>
        </div>
    );
};

export default EventSwitcher;