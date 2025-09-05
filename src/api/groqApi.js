import { GROQ_API_KEY, CLAUDE_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, COHERE_API_KEY } from '../config';
import { AI_PROVIDERS } from './aiProviders';

// Enhanced token estimation
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

// **UPDATED: Gemini-first provider selection**
function selectBestProvider(estimatedTokens) {
    console.log(`🤖 Selecting AI provider for ~${estimatedTokens} tokens`);
    
    // **GEMINI FIRST: Priority order with Gemini as primary**
    const providers = [
        { name: 'gemini', available: !!GEMINI_API_KEY, limit: 1000000, cost: 0, priority: 1 },
        { name: 'claude', available: !!CLAUDE_API_KEY, limit: 200000, cost: 0, priority: 2 },
        { name: 'cohere', available: !!COHERE_API_KEY, limit: 128000, cost: 0, priority: 3 },
        { name: 'openai', available: !!OPENAI_API_KEY, limit: 128000, cost: 1, priority: 4 },
        { name: 'groq', available: !!GROQ_API_KEY, limit: 6000, cost: 0, priority: 5 }
    ];
    
    // Find the best available provider that can handle the tokens
    for (const provider of providers) {
        if (provider.available && estimatedTokens <= provider.limit) {
            console.log(`✅ Selected ${provider.name} (limit: ${provider.limit.toLocaleString()} tokens, priority: ${provider.priority})`);
            return provider.name;
        }
    }
    
    // Fallback to any available provider with truncation
    const availableProvider = providers.find(p => p.available);
    if (availableProvider) {
        console.warn(`⚠️ Using ${availableProvider.name} with truncation`);
        return availableProvider.name;
    }
    
    throw new Error('No AI providers available. Please configure at least one API key.');
}

// Universal AI API caller
async function callAIProvider(provider, messages, maxResponseTokens, apiKey) {
    const config = AI_PROVIDERS[provider];
    if (!config) {
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    const url = config.urlWithKey ? config.urlWithKey(apiKey) : config.apiUrl;
    const headers = config.headers(apiKey);
    const body = config.formatRequest(messages, maxResponseTokens);
    
    console.log(`🚀 Calling ${config.name}...`);
    
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${config.name} API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    return config.extractResponse(data);
}

export const generateAISummary = async ({ 
    notams, 
    icaoCode, 
    analysisType, 
    aiModel,
    timeValue = 24,
    timeUnit = 'hours'
}) => {
    console.log('🎯 Starting AI summary generation with', notams.length, 'NOTAMs (Gemini Primary)');
    
    // Create time window description
    const timeDescription = timeUnit === 'days' 
        ? `${timeValue} day${timeValue > 1 ? 's' : ''}` 
        : `${timeValue} hour${timeValue > 1 ? 's' : ''}`;
    
    const now = new Date();
    const endTime = new Date(now.getTime() + (timeUnit === 'days' ? timeValue * 24 : timeValue) * 60 * 60 * 1000);

    // Filter out cancellation NOTAMs
    const activeNotams = notams.filter(notam => !notam.isCancellation);
    
    if (activeNotams.length === 0) {
        return `<div style="text-align: center; padding: 20px;">
            <h3 style="color: #27ae60;">✅ No Active NOTAMs</h3>
            <p>No active NOTAMs found for <strong>${icaoCode}</strong> in the next ${timeDescription}.</p>
            <p style="color: #27ae60; font-weight: 600; margin-top: 15px;">All clear for operations! 🛫</p>
        </div>`;
    }

    // **ENHANCED: Prepare detailed NOTAM data for specific analysis**
    const detailedNotamData = activeNotams.map((notam, index) => ({
        id: index + 1,
        number: notam.number || 'N/A',
        text: (notam.summary || notam.rawText || '').substring(0, 600), // Increased for more detail
        validFrom: notam.validFrom,
        validTo: notam.validTo,
        source: notam.source || 'FAA',
        icao: notam.icao || icaoCode
    }));

    // **ENHANCED: Detailed, specific prompt for technical precision**
    const systemPrompt = `You are an expert aviation operations analyst with deep knowledge of airport infrastructure, runway designations, taxiway systems, and navigation aids. You MUST provide extremely specific and detailed operational briefings that include exact runway numbers, taxiway identifiers, equipment designations, and precise operational impacts. Your analysis must be technically accurate and operationally actionable for professional pilots and dispatchers.`;
    
    const userPrompt = `
🎯 **DETAILED AVIATION OPERATIONAL BRIEFING**

**AIRPORT:** ${icaoCode}
**ANALYSIS PERIOD:** Next ${timeDescription}
**CURRENT TIME:** ${now.toISOString()}
**NOTAM COUNT:** ${detailedNotamData.length}

**CRITICAL MISSION:**
Provide a highly detailed, technically specific operational briefing with exact identifiers, numbers, and operational impacts.

**MANDATORY FORMAT:**
🔴 **CRITICAL OPERATIONS** (max 4 items)
• [SPECIFIC runway/taxiway/equipment + exact operational impact + precise times]

🟡 **OPERATIONAL IMPACTS** (max 4 items)  
• [SPECIFIC equipment/facility + exact restrictions + precise times]

🟢 **ADVISORIES** (max 3 items)
• [SPECIFIC details + operational considerations + times if relevant]

**TECHNICAL REQUIREMENTS:**
✅ Include EXACT runway numbers (e.g., "RWY 04L/22R", "RWY 09/27")
✅ Include EXACT taxiway identifiers (e.g., "TWY A", "TWY BRAVO", "TWY A1")
✅ Include SPECIFIC equipment names (e.g., "ILS RWY 31L", "PAPI RWY 04")
✅ Include PRECISE times (start/end) for all critical items
✅ Include EXACT operational impacts (e.g., "reduces to single runway ops")
✅ Include SPECIFIC approach/departure restrictions
✅ Use EXACT aviation terminology and designations
✅ Include SPECIFIC aircraft size/weight restrictions if applicable
✅ Include EXACT frequency changes or procedure modifications

**ANALYSIS FOCUS:**
${analysisType === 'runway' ? 'RUNWAY OPERATIONS: Focus on specific runway numbers, closures, length restrictions, surface conditions, displaced thresholds, construction areas' :
  analysisType === 'airspace' ? 'AIRSPACE & NAVIGATION: Focus on specific navigation aid designations, approach procedures, frequency changes, airspace restrictions' :
  'COMPREHENSIVE: Balance all operational aspects with specific technical details'}

**NOTAM DATA FOR DETAILED ANALYSIS:**
${JSON.stringify(detailedNotamData, null, 1)}

**DELIVER TECHNICAL OPERATIONAL BRIEFING:**
Analyze each NOTAM and extract specific operational details with exact identifiers and precise impacts:`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // **GEMINI PRIMARY: Auto-select with Gemini preference**
    const estimatedTokens = estimateTokens(userPrompt);
    const selectedProvider = selectBestProvider(estimatedTokens);
    
    const apiKeys = {
        gemini: GEMINI_API_KEY,
        claude: CLAUDE_API_KEY,
        cohere: COHERE_API_KEY,
        openai: OPENAI_API_KEY,
        groq: GROQ_API_KEY
    };

    try {
        let rawContent;
        
        if (selectedProvider === 'groq') {
            // Groq fallback with truncation
            let truncatedPrompt = userPrompt;
            if (estimatedTokens > 5000) {
                console.warn('⚠️ Truncating for Groq limits');
                truncatedPrompt = userPrompt.substring(0, 18000) + '\n\n[TRUNCATED FOR SIZE LIMIT - FOCUS ON MOST CRITICAL ITEMS]';
            }
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: aiModel || "llama-3.3-70b-versatile",
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: truncatedPrompt }
                    ],
                    temperature: 0.05, // Very low for precision
                    max_tokens: 1000,
                    top_p: 0.8
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            rawContent = data.choices[0].message.content;
        } else {
            // Use selected AI provider (Gemini primary)
            rawContent = await callAIProvider(
                selectedProvider, 
                messages, 
                2000, // Higher token limit for detailed responses
                apiKeys[selectedProvider]
            );
        }
        
        // **ENHANCED: Format cleanup with technical precision preservation**
        const firstEmojiMatch = rawContent.match(/(🔴|🟡|🟢)/);
        if (firstEmojiMatch) {
            rawContent = rawContent.substring(rawContent.indexOf(firstEmojiMatch[0]));
        }
        
        // Clean up while preserving technical details
        rawContent = rawContent
            .replace(/^[-*]\s/gm, '• ')
            .replace(/^(\d+\.)\s/gm, '• ')
            .replace(/\n\n+/g, '\n')
            .trim();
        
        const hasRequired = rawContent.includes('🔴') || rawContent.includes('🟡') || rawContent.includes('🟢');
        
        if (!hasRequired) {
            return `<div style="padding: 20px;">
                <h3 style="color: #f39c12;">⚠️ Technical Analysis</h3>
                <p><strong>Provider:</strong> ${selectedProvider.toUpperCase()} • <strong>NOTAMs:</strong> ${detailedNotamData.length}</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px; font-family: monospace;">
                    ${rawContent.replace(/\n/g, '<br>')}
                </div>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #666;">
                    <em>Note: Response may contain technical details not in standard format.</em>
                </p>
            </div>`;
        }
        
        const formattedContent = rawContent
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/🔴/g, '<span style="color: #e74c3c; font-weight: bold; font-size: 1.1em;">🔴</span>')
            .replace(/🟡/g, '<span style="color: #f39c12; font-weight: bold; font-size: 1.1em;">🟡</span>')
            .replace(/🟢/g, '<span style="color: #27ae60; font-weight: bold; font-size: 1.1em;">🟢</span>')
            .replace(/• /g, '<span style="margin-left: 10px;">• </span>')
            // **ENHANCED: Highlight technical identifiers**
            .replace(/\b(RWY|RUNWAY)\s+(\d{2}[LRC]?(?:\/\d{2}[LRC]?)?)\b/gi, '<strong style="color: #2c3e50; background: #f8f9fa; padding: 2px 4px; border-radius: 3px;">$1 $2</strong>')
            .replace(/\b(TWY|TAXIWAY)\s+([A-Z]\d*)\b/gi, '<strong style="color: #8e44ad; background: #f8f9fa; padding: 2px 4px; border-radius: 3px;">$1 $2</strong>')
            .replace(/\b(ILS|PAPI|VASI)\s+(RWY\s+\d{2}[LRC]?)\b/gi, '<strong style="color: #e67e22; background: #f8f9fa; padding: 2px 4px; border-radius: 3px;">$1 $2</strong>');
        
        // **ENHANCED: Provider info with technical details**
        const providerInfo = AI_PROVIDERS[selectedProvider] || { name: selectedProvider.toUpperCase() };
        let optimizationNotice = `<div style="background: #e8f5e8; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #28a745;">
            <strong>🤖 Technical Analysis:</strong> ${detailedNotamData.length} NOTAMs • ${providerInfo.name} • Detailed operational specifics included
            ${selectedProvider === 'gemini' ? '<span style="margin-left: 10px; color: #4285f4; font-weight: 600;">✨ Gemini Primary</span>' : ''}
        </div>`;
        
        console.log(`✅ Detailed AI summary generated using ${selectedProvider}: ${detailedNotamData.length}/${notams.length} NOTAMs`);
        return optimizationNotice + formattedContent;
        
    } catch (error) {
        console.error(`${selectedProvider} API Error:`, error);
        
        // **ENHANCED: Smart fallback to next available provider**
        const fallbackProviders = ['gemini', 'claude', 'cohere', 'openai', 'groq'].filter(p => p !== selectedProvider && apiKeys[p]);
        
        if (fallbackProviders.length > 0) {
            console.log(`🔄 Attempting fallback to ${fallbackProviders[0]}...`);
            try {
                const fallbackContent = await callAIProvider(
                    fallbackProviders[0], 
                    messages, 
                    1500, 
                    apiKeys[fallbackProviders[0]]
                );
                
                return `<div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
                    <strong>⚠️ Fallback Analysis:</strong> Primary provider failed, using ${fallbackProviders[0].toUpperCase()}
                </div>` + fallbackContent.replace(/\n/g, '<br>');
                
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
        
        throw new Error(`Failed to generate AI summary using ${selectedProvider}: ${error.message}`);
    }
};
