import React from 'react';
import PropTypes from 'prop-types';
import NotamForm from './NotamForm';

const configSectionStyle = {
    background: '#f8f9fa',
    padding: '25px',
    borderRadius: '10px',
    marginBottom: '30px',
    borderLeft: '4px solid #4ECDC4',
};

const configTitleStyle = {
    fontSize: '1.3rem',
    color: '#2c3e50',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
};

const ConfigSection = ({ params, setParams, handleAnalyze, loading }) => {
    return (
        <section style={configSectionStyle}>
            <h2 style={configTitleStyle}>
                <span role="img" aria-label="settings" style={{ marginRight: '10px' }}>⚙️</span> 
                Analysis Configuration
            </h2>
            <NotamForm 
                params={params} 
                setParams={setParams} 
                handleAnalyze={handleAnalyze} 
                loading={loading} 
            />
        </section>
    );
};

ConfigSection.propTypes = {
    params: PropTypes.object.isRequired,
    setParams: PropTypes.func.isRequired,
    handleAnalyze: PropTypes.func.isRequired,
    loading: PropTypes.bool.isRequired,
};

export default ConfigSection;