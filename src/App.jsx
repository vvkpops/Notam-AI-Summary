import React, { useState } from 'react';
import Header from './components/Header';
import ConfigSection from './components/ConfigSection';
import Results from './components/Results';
import { fetchNotams } from './api/faaApi';
import { generateAISummary } from './api/groqApi';

function App() {
    const [params, setParams] = useState({
        icaoCode: 'KJFK',
        timeValue: 24,
        timeUnit: 'hours',
        analysisType: 'general',
        notamType: '',
        classification: '',
        featureType: '',
        selectedProxy: 'corsproxy',
        customProxyUrl: 'http://localhost:3001',
        aiModel: 'llama-3.3-70b-versatile', // Better model for analysis
        enableTimeFiltering: true // NEW: Time filtering toggle
    });
    
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleAnalyze = async () => {
        if (!params.icaoCode) {
            alert('Please enter a valid ICAO code.');
            return;
        }

        // Validate time inputs
        if (params.timeValue < 1 || params.timeValue > 168) {
            alert('Time value must be between 1 and 168 hours (7 days).');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            console.log(`🚀 Starting analysis for ${params.icaoCode} - Next ${params.timeValue} ${params.timeUnit}`);
            
            // Pass time filtering parameters to the API
            const notams = await fetchNotams({
                icaoCode: params.icaoCode,
                notamType: params.notamType,
                classification: params.classification,
                featureType: params.featureType,
                selectedProxy: params.selectedProxy,
                customProxyUrl: params.customProxyUrl,
                timeValue: params.timeValue,
                timeUnit: params.timeUnit,
                enableTimeFiltering: params.enableTimeFiltering
            });

            if (notams.length === 0) {
                const timeDesc = params.timeUnit === 'days' ? `${params.timeValue} day(s)` : `${params.timeValue} hour(s)`;
                setResult({ 
                    notams: [], 
                    summary: `<strong>No NOTAMs found for ${params.icaoCode} in the next ${timeDesc}</strong><br><br>All clear for operations in the specified time window.`, 
                    error: null, 
                    successMessage: `✅ Analysis complete - No active NOTAMs found for the next ${timeDesc}.`,
                    timeWindow: { timeValue: params.timeValue, timeUnit: params.timeUnit }
                });
                return;
            }

            // Pass time parameters to AI summary generation
            const summary = await generateAISummary({ 
                notams, 
                icaoCode: params.icaoCode,
                analysisType: params.analysisType,
                aiModel: params.aiModel,
                timeValue: params.timeValue,
                timeUnit: params.timeUnit
            });

            const timeDesc = params.timeUnit === 'days' ? `${params.timeValue} day(s)` : `${params.timeValue} hour(s)`;
            setResult({
                notams,
                summary,
                error: null,
                successMessage: `✅ Success! Analyzed ${notams.length} NOTAMs for the next ${timeDesc} using ${params.aiModel}.`,
                timeWindow: { timeValue: params.timeValue, timeUnit: params.timeUnit }
            });

        } catch (error) {
            console.error('Analysis error:', error);
            setResult({ 
                notams: [], 
                summary: '', 
                error, 
                successMessage: '',
                timeWindow: { timeValue: params.timeValue, timeUnit: params.timeUnit }
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <Header />
            <main className="main-content">
                <ConfigSection 
                    params={params} 
                    setParams={setParams} 
                    handleAnalyze={handleAnalyze} 
                    loading={loading}
                />
                {loading && (
                    <div className="loading">
                        🔍 Analyzing NOTAMs for the next {params.timeValue} {params.timeUnit}...
                    </div>
                )}
                {result && <Results result={result} />}
            </main>
        </div>
    );
}

export default App;