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
        // --- UPDATED MODEL ---
        aiModel: 'llama3-70b-8192', 
    });
    
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleAnalyze = async () => {
        if (!params.icaoCode) {
            alert('Please enter a valid ICAO code.');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const notams = await fetchNotams({
                ...params,
                hours: params.timeUnit === 'days' ? params.timeValue * 24 : params.timeValue,
            });

            if (notams.length === 0) {
                setResult({ notams: [], summary: '', error: null, successMessage: '' });
                return;
            }

            const summary = await generateAISummary({ notams, ...params });

            setResult({
                notams,
                summary,
                error: null,
                successMessage: `✅ Success! Analyzed ${notams.length} NOTAMs using ${params.aiModel}.`
            });

        } catch (error) {
            setResult({ notams: [], summary: '', error, successMessage: '' });
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
                {loading && <div className="loading">Analyzing NOTAMs</div>}
                {result && <Results result={result} />}
            </main>
        </div>
    );
}

export default App;