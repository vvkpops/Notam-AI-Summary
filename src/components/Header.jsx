import React from 'react';
import PropTypes from 'prop-types';

const headerStyle = {
    background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
    color: 'white',
    padding: '30px',
    textAlign: 'center',
};

const h1Style = {
    fontSize: '2.5rem',
    marginBottom: '10px',
};

const pStyle = {
    fontSize: '1.1rem',
    opacity: '0.9',
};

const Header = () => {
    return (
        <header style={headerStyle}>
            <h1 style={h1Style}>✈️ NOTAM AI Summarizer</h1>
            <p style={pStyle}>Intelligent NOTAM analysis powered by AI - Get clear, actionable aviation insights</p>
        </header>
    );
};

export default Header;