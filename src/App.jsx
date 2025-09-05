import React, { useState } from 'react';
import Header from './components/Header';
import ConfigSection from './components/ConfigSection';
import Results from './components/Results';
import { fetchNotams, validateAndNormalizeIcao } from './api/faaApi';
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
        aiModel: 'llama-3.3-70b-versatile',
        enableTimeFiltering: true
    });
    
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleAnalyze = async () => {
        if (!params.icaoCode || !params.icaoCode.trim()) {
            alert('Please enter a valid ICAO code.');
            return;
        }

        // **ENHANCED VALIDATION: Validate ICAO format before proceeding**
        try {
            const normalizedIcao = validateAndNormalizeIcao(params.icaoCode);
            console.log(`✅ ICAO validation passed: ${normalizedIcao}`);
        } catch (error) {
            alert(error.message);
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
            const timeDesc = params.timeUnit === 'days' ? `${params.timeValue} day(s)` : `${params.timeValue} hour(s)`;
            console.log(`🚀 Starting analysis for ${params.icaoCode.toUpperCase()} - Next ${timeDesc}`);
            
            // Fetch NOTAMs with enhanced ICAO handling
            const notams = await fetchNotams({
                icaoCode: params.icaoCode, // Will be normalized inside fetchNotams
                notamType: params.notamType,
                classification: params.classification,
                featureType: params.featureType,
                selectedProxy: params.selectedProxy,
                customProxyUrl: params.customProxyUrl,
                timeValue: params.timeValue,
                timeUnit: params.timeUnit,
                enableTimeFiltering: params.enableTimeFiltering
            });

            const normalizedIcao = params.icaoCode.trim().toUpperCase();

            if (notams.length === 0) {
                setResult({ 
                    notams: [], 
                    summary: `<div style="text-align: center; padding: 20px;">
                        <h3 style="color: #27ae60;">✅ No Active NOTAMs</h3>
                        <p>No NOTAMs found for <strong>${normalizedIcao}</strong> in the next ${timeDesc}.</p>
                        <p style="color: #27ae60; font-weight: 600; margin-top: 15px;">All clear for operations! 🛫</p>
                    </div>`, 
                    error: null, 
                    successMessage: `✅ Analysis complete - No active NOTAMs found for ${normalizedIcao} in the next ${timeDesc}.`,
                    timeWindow: { timeValue: params.timeValue, timeUnit: params.timeUnit },
                    icaoCode: normalizedIcao
                });
                return;
            }

            // Generate AI summary
            const summary = await generateAISummary({ 
                notams, 
                icaoCode: normalizedIcao,
                analysisType: params.analysisType,
                aiModel: params.aiModel,
                timeValue: params.timeValue,
                timeUnit: params.timeUnit
            });

            setResult({
                notams,
                summary,
                error: null,
                successMessage: `✅ Successfully analyzed ${notams.length} NOTAMs for ${normalizedIcao} in the next ${timeDesc} using ${params.aiModel}.`,
                timeWindow: { timeValue: params.timeValue, timeUnit: params.timeUnit },
                icaoCode: normalizedIcao
            });

        } catch (error) {
            console.error('Analysis error:', error);
            setResult({ 
                notams: [], 
                summary: '', 
                error, 
                successMessage: '',
                timeWindow: { timeValue: params.timeValue, timeUnit: params.timeUnit },
                icaoCode: params.icaoCode.trim().toUpperCase()
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
                        <div style={{ fontSize: '1.1rem', marginBottom: '10px' }}>
                            🔍 Analyzing NOTAMs for {params.icaoCode.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.9rem', opacity: '0.8' }}>
                            Next {params.timeValue} {params.timeUnit} • {params.analysisType} analysis
                        </div>
                    </div>
                )}
                {result && <Results result={result} />}
            </main>
        </div>
    );
}

export default App;