import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const formGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' };
const sectionStyle = { background: '#f1f3f4', padding: '20px', borderRadius: '8px', marginTop: '20px' };
const timeControlsStyle = { display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' };
const timeInputStyle = { width: '80px', textAlign: 'center', fontSize: '1rem', fontWeight: '600' };
const timeUnitStyle = (isActive) => ({ padding: '8px 15px', background: isActive ? '#4ECDC4' : '#e9ecef', color: isActive ? 'white' : 'inherit', border: `2px solid ${isActive ? '#4ECDC4' : '#e1e8ed'}`, borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease', fontWeight: '500' });
const analyzeBtnStyle = { background: 'linear-gradient(45deg, #4285f4, #34a853)', color: 'white', border: 'none', padding: '15px 40px', fontSize: '1.1rem', fontWeight: '600', borderRadius: '50px', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 5px 15px rgba(66, 133, 244, 0.3)', marginTop: '25px' };

const NotamForm = ({ params, setParams, handleAnalyze, loading }) => {
    const [icaoValidation, setIcaoValidation] = useState({ isValid: true, message: '' });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setParams(prev => ({ ...prev, [name]: value }));
    };

    const handleIcaoChange = (e) => {
        const value = e.target.value.toUpperCase();
        setParams(prev => ({ ...prev, icaoCode: value }));
        
        // Real-time validation
        if (value.length === 0) {
            setIcaoValidation({ isValid: true, message: '' });
        } else if (value.length < 4) {
            setIcaoValidation({ isValid: false, message: `${4 - value.length} more character${4 - value.length > 1 ? 's' : ''} needed` });
        } else if (value.length === 4) {
            if (/^[A-Z0-9]{4}$/.test(value)) {
                setIcaoValidation({ isValid: true, message: '✅ Valid ICAO format' });
            } else {
                setIcaoValidation({ isValid: false, message: 'Must be 4 alphanumeric characters only' });
            }
        } else {
            setIcaoValidation({ isValid: false, message: 'Too long - ICAO codes are exactly 4 characters' });
        }
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

    // Popular airports for quick selection
    const popularAirports = [
        { code: 'KJFK', name: 'New York JFK' },
        { code: 'KLAX', name: 'Los Angeles' },
        { code: 'EGLL', name: 'London Heathrow' },
        { code: 'CYYZ', name: 'Toronto Pearson' },
        { code: 'CYUL', name: 'Montreal' },
        { code: 'CYYT', name: 'St. Johns' },
        { code: 'CYVR', name: 'Vancouver' }
    ];

    const isFormValid = icaoValidation.isValid && params.icaoCode.length === 4;

    return (
        <>
            <div style={formGridStyle}>
                <div className="form-group">
                    <label htmlFor="icaoCode">
                        ICAO Airport Code
                        {icaoValidation.message && (
                            <span style={{ 
                                marginLeft: '10px', 
                                fontSize: '0.85rem',
                                color: icaoValidation.isValid ? '#27ae60' : '#e74c3c',
                                fontWeight: '500'
                            }}>
                                {icaoValidation.message}
                            </span>
                        )}
                    </label>
                    <input 
                        type="text" 
                        id="icaoCode" 
                        name="icaoCode" 
                        value={params.icaoCode} 
                        onChange={handleIcaoChange}
                        placeholder="e.g., KJFK" 
                        maxLength="4" 
                        style={{ 
                            textTransform: 'uppercase', 
                            fontSize: '1.1rem', 
                            fontWeight: '600',
                            borderColor: icaoValidation.isValid ? '#e1e8ed' : '#e74c3c',
                            boxShadow: icaoValidation.isValid ? 'none' : '0 0 0 2px rgba(231, 76, 60, 0.1)'
                        }} 
                    />
                    {/* Quick airport selection */}
                    <div style={{ marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {popularAirports.map(airport => (
                            <button
                                key={airport.code}
                                type="button"
                                onClick={() => {
                                    setParams(prev => ({ ...prev, icaoCode: airport.code }));
                                    setIcaoValidation({ isValid: true, message: '✅ Valid ICAO format' });
                                }}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    background: params.icaoCode === airport.code ? '#4285f4' : '#e9ecef',
                                    color: params.icaoCode === airport.code ? 'white' : '#666',
                                    border: '1px solid #ccc',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                title={airport.name}
                            >
                                {airport.code}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="form-group">
                    <label>Time Window: <strong style={{color: '#4285f4'}}>{getTimeDescription()}</strong></label>
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
                                onMouseOver={(e) => e.target.style.background = '#4285f4'}
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
                        <option value="general">Comprehensive Analysis</option>
                        <option value="runway">Runway Operations Detail</option>
                        <option value="airspace">Airspace & Navigation Detail</option>
                    </select>
                </div>
            </div>
            
            <div style={sectionStyle}>
                <div style={formGridStyle}>
                    <div className="form-group">
                        <label htmlFor="aiModel">
                            AI Provider 
                            <span style={{ color: '#4285f4', fontSize: '0.85rem', marginLeft: '8px' }}>
                                ✨ Gemini Primary
                            </span>
                        </label>
                        <select id="aiModel" name="aiModel" value={params.aiModel} onChange={handleChange}>
                            <option value="gemini-pro">Google Gemini Pro (Recommended)</option>
                            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Fallback)</option>
                            <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fast)</option>
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
                
                <div style={{ background: '#e8f0fe', padding: '12px', borderRadius: '6px', marginTop: '15px', fontSize: '0.9rem' }}>
                    <strong>🎯 Technical Analysis Features:</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                        <li>Specific runway numbers (e.g., RWY 04L/22R)</li>
                        <li>Exact taxiway identifiers (e.g., TWY A, TWY BRAVO)</li>
                        <li>Navigation aid designations (e.g., ILS RWY 31L)</li>
                        <li>Precise operational impacts and times</li>
                    </ul>
                </div>
            </div>

            <button 
                onClick={handleAnalyze} 
                disabled={loading || !isFormValid} 
                style={{
                    ...analyzeBtnStyle,
                    opacity: loading || !isFormValid ? 0.6 : 1,
                    cursor: loading || !isFormValid ? 'not-allowed' : 'pointer'
                }}
            >
                {loading ? '🔍 Analyzing...' : `🚀 Detailed Analysis (${getTimeDescription()})`}
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
