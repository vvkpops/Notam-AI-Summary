import React from 'react';
import PropTypes from 'prop-types';

// Inline styles for components
const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '25px',
};

const timeControlsStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
};

const timeInputStyle = {
    width: '80px',
    textAlign: 'center',
};

const timeUnitStyle = (isActive) => ({
    padding: '8px 15px',
    background: isActive ? '#4ECDC4' : '#e9ecef',
    color: isActive ? 'white' : 'inherit',
    border: `2px solid ${isActive ? '#4ECDC4' : '#e1e8ed'}`,
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontWeight: '500',
});

const analyzeBtnStyle = {
    background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
    color: 'white',
    border: 'none',
    padding: '15px 40px',
    fontSize: '1.1rem',
    fontWeight: '600',
    borderRadius: '50px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
};

const NotamForm = ({ params, setParams, handleAnalyze, loading }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setParams(prev => ({ ...prev, [name]: value }));
    };

    const handleTimeUnitChange = (unit) => {
        setParams(prev => ({ ...prev, timeUnit: unit }));
    };

    return (
        <>
            <div style={formGridStyle}>
                <div className="form-group">
                    <label htmlFor="icaoCode">ICAO Airport Code</label>
                    <input type="text" id="icaoCode" name="icaoCode" value={params.icaoCode} onChange={handleChange} placeholder="e.g., KJFK" maxLength="4" style={{ textTransform: 'uppercase' }} />
                </div>
                
                <div className="form-group">
                    <label>Time Period</label>
                    <div style={timeControlsStyle}>
                        <input type="number" name="timeValue" value={params.timeValue} onChange={handleChange} style={timeInputStyle} min="1" max="168" />
                        <div onClick={() => handleTimeUnitChange('hours')} style={timeUnitStyle(params.timeUnit === 'hours')}>Hours</div>
                        <div onClick={() => handleTimeUnitChange('days')} style={timeUnitStyle(params.timeUnit === 'days')}>Days</div>
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
            
            {/* Additional filters can be added here in a similar fashion */}

            <button onClick={handleAnalyze} disabled={loading} style={analyzeBtnStyle}>
                {loading ? 'Analyzing...' : '🚀 Analyze NOTAMs'}
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