import React, { useState } from 'react';
import PropTypes from 'prop-types';

// Inline styles for components
const resultsSectionStyle = { marginTop: '40px' };
const resultsHeaderStyle = { background: '#2c3e50', color: 'white', padding: '20px', borderRadius: '10px 10px 0 0', fontSize: '1.2rem', fontWeight: '600' };
const summaryCardStyle = { background: 'white', border: '1px solid #e1e8ed', borderRadius: '0 0 10px 10px', padding: '30px' };
const summaryContentStyle = { lineHeight: '1.8', color: '#2c3e50', fontSize: '1.05rem' };
const rawNotamsStyle = { marginTop: '30px', background: '#f8f9fa', borderRadius: '10px', overflow: 'hidden' };
const rawNotamsHeaderStyle = { background: '#34495e', color: 'white', padding: '15px 20px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const rawNotamsContentStyle = (isOpen) => ({ maxHeight: isOpen ? '400px' : '0', overflowY: 'auto', padding: isOpen ? '20px' : '0 20px', fontFamily: 'Courier New, monospace', fontSize: '0.9rem', lineHeight: '1.6', transition: 'all 0.3s ease-in-out' });

const Results = ({ result }) => {
    const [isRawOpen, setIsRawOpen] = useState(false);

    if (!result) return null;

    if (result.error) {
        return (
            <div className="error">
                <h3>❌ Error Occurred</h3>
                <p><strong>Details:</strong> {result.error.message}</p>
                <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Technical Details</summary>
                    <pre style={{ background: '#f8f8f8', padding: '10px', borderRadius: '4px', overflowX: 'auto', marginTop: '5px' }}>{result.error.stack || result.error.toString()}</pre>
                </details>
            </div>
        );
    }
    
    if (result.notams.length === 0) {
        return (
             <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '40px', background: '#f8f9fa', borderRadius: '10px', marginTop: '30px' }}>
                <h3>No NOTAMs Found</h3>
                <p>No active NOTAMs found for the specified airport and time period.</p>
            </div>
        )
    }

    return (
        <section style={resultsSectionStyle}>
            <div style={resultsHeaderStyle}>📊 AI Analysis Results</div>
            <div style={summaryCardStyle}>
                {result.successMessage && <div className="success">{result.successMessage}</div>}
                <div style={summaryContentStyle} dangerouslySetInnerHTML={{ __html: result.summary }}></div>
            </div>

            <div style={rawNotamsStyle}>
                <div style={rawNotamsHeaderStyle} onClick={() => setIsRawOpen(!isRawOpen)}>
                    📋 Raw NOTAM Data ({result.notams.length})
                    <span>{isRawOpen ? '▲' : '▼'}</span>
                </div>
                <div style={rawNotamsContentStyle(isRawOpen)}>
                    {result.notams.map((notam, index) => (
                        <div key={index} style={{ background: 'white', marginBottom: '15px', padding: '15px', borderRadius: '6px', borderLeft: '3px solid #4ECDC4' }}>
                           <p><strong>Text:</strong> {notam.properties?.text || 'N/A'}</p>
                           <small><strong>Effective:</strong> {notam.properties?.effectiveStart ? new Date(notam.properties.effectiveStart).toLocaleString() : 'N/A'}</small>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

Results.propTypes = {
    result: PropTypes.object,
};

export default Results;