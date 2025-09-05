import React from 'react';
import PropTypes from 'prop-types';

const formGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' };
const sectionStyle = { background: '#f1f3f4', padding: '20px', borderRadius: '8px', marginTop: '20px' };
const timeControlsStyle = { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' };
const timeInputStyle = { width: '80px', textAlign: 'center', fontSize: '1rem', fontWeight: '600' };
const timeUnitStyle = (isActive) => ({ padding: '8px 15px', background: isActive ? '#4ECDC4' : '#e9ecef', color: isActive ? 'white' : 'inherit', border: `2px solid ${isActive ? '#4ECDC4' : '#e1e8ed'}`, borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: '500' });
const analyzeBtnStyle = { background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)', color: 'white', border: 'none', padding: '15px 40px', fontSize: '1.1rem', fontWeight: '600', borderRadius: '50px', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', marginTop: '25px' };

const NotamForm = ({ params, setParams, handleAnalyze, loading }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setParams(prev => ({ ...prev, [name]: value }));
    };

    const handleTimeUnitChange = (unit) => {
        setParams(prev => ({ ...prev, timeUnit: unit }));
    };

    const getTimeDescription = () => {
        const { timeValue, timeUnit } = params;
        const desc = timeUnit === 'days' ? `${timeValue} day${timeValue > 1 ? 's' : ''}` : `${timeValue} hour${timeValue > 1 ? 's' : ''}`;
        return `Next ${desc}`;
    };

    const handleTimePreset = (preset) => {
        switch(preset) {
            case '6h':
                setParams(prev => ({ ...prev, timeValue: 6, timeUnit: 'hours' }));
                break;
            case '12h':
                setParams(prev => ({ ...prev, timeValue: 12, timeUnit: 'hours' }));
                break;
            case '24h':
                setParams(prev => ({ ...prev, timeValue: 24, timeUnit: 'hours' }));
                break;
            case '3d':
                setParams(prev => ({ ...prev, timeValue: 3, timeUnit: 'days' }));
                break;
            case '7d':
                setParams(prev => ({ ...prev, timeValue: 7, timeUnit: 'days' }));
                break;
        }
    };

    return (
        <>
            <div style={formGridStyle}>
                <div className="form-group">
                    <label htmlFor="icaoCode">ICAO Airport Code</label>
                    <input 
                        type="text" 
                        id="icaoCode" 
                        name="icaoCode" 
                        value={params.icaoCode} 
                        onChange={handleChange} 
                        placeholder="e.g., KJFK" 
                        maxLength="4" 
                        style={{ textTransform: 'uppercase', fontSize: '1.1rem', fontWeight: '600' }} 
                    />
                </div>
                
                <div className="form-group">
                    <label>Time Window: <strong style={{color: '#4ECDC4'}}>{getTimeDescription()}</strong></label>
                    <div style={timeControlsStyle}>
                        <input 
                            type="number" 
                            name="timeValue" 
                            value={params.timeValue} 
                            onChange={handleChange} 
                            style={timeInputStyle} 
                            min="1" 
                            max="168" 
                        />
                        <div onClick={() => handleTimeUnitChange('hours')} style={timeUnitStyle(params.timeUnit === 'hours')}>Hours</div>
                        <div onClick={() => handleTimeUnitChange('days')} style={timeUnitStyle(params.timeUnit === 'days')}>Days</div>
                    </div>
                    {/* Quick preset buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {[
                            { label: '6H', value: '6h' },
                            { label: '12H', value: '12h' },
                            { label: '24H', value: '24h' },
                            { label: '3D', value: '3d' },
                            { label: '7D', value: '7d' }
                        ].map(preset => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={() => handleTimePreset(preset.value)}
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '0.85rem',
                                    background: '#e9ecef',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => e.target.style.background = '#4ECDC4'}
                                onMouseOut={(e) => e.target.style.background = '#e9ecef'}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="form-group">
                    <label htmlFor="analysisType">Analysis Focus</label>
                    <select id="analysisType" name="analysisType" value={params.analysisType} onChange={handleChange}>
                        <option value="general">General Summary</option>
                        <option value="runway">Runway Operations</option>
                        <option value="airspace">Airspace Restrictions</option>
                    </select>
                </div>
            </div>
            
            <div style={sectionStyle}>
                <div style={formGridStyle}>
                    <div className="form-group">
                        <label htmlFor="aiModel">AI Model</label>
                        <select id="aiModel" name="aiModel" value={params.aiModel} onChange={handleChange}>
                            <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
                            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="selectedProxy">CORS Proxy</label>
                        <select id="selectedProxy" name="selectedProxy" value={params.selectedProxy} onChange={handleChange}>
                            <option value="corsproxy">CORS Proxy</option>
                            <option value="allorigins">AllOrigins</option>
                        </select>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleAnalyze} 
                disabled={loading || !params.icaoCode} 
                style={{
                    ...analyzeBtnStyle,
                    opacity: loading || !params.icaoCode ? 0.6 : 1,
                    cursor: loading || !params.icaoCode ? 'not-allowed' : 'pointer'
                }}
            >
                {loading ? '🔍 Analyzing...' : `🚀 Analyze NOTAMs (${getTimeDescription()})`}
            </button>
        </>
    );
};

NotamForm.propTypes = {
    params: PropTypes.object.isRequired,
    setParams: PropTypes.func.isRequired,
    handleAnalyze: PropTypes.func.isRequired,
    loading: PropTypes.bool.isRequired,
};

export default NotamForm;