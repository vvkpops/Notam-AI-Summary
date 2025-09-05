import { GROQ_API_KEY, CLAUDE_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, COHERE_API_KEY } from '../config';
import { AI_PROVIDERS } from './aiProviders';

// Enhanced token estimation
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

// Smart provider selection based on token requirements
function selectBestProvider(estimatedTokens) {
    console.log(`🤖 Selecting AI provider for ~${estimatedTokens} tokens`);
    
    // Priority order based on token limits and cost
    const providers = [
        { name: 'gemini', available: !!GEMINI_API_KEY, limit: 1000000, cost: 0 },
        { name: 'claude', available: !!CLAUDE_API_KEY, limit: 200000, cost: 0 },
        { name: 'cohere', available: !!COHERE_API_KEY, limit: 128000, cost: 0 },
        { name: 'openai', available: !!OPENAI_API_KEY, limit: 128000, cost: 1 },
        { name: 'groq', available: !!GROQ_API_KEY, limit: 6000, cost: 0 }
    ];
    
    // Find the best available provider that can handle the tokens
    for (const provider of providers) {
        if (provider.available && estimatedTokens <= provider.limit) {
            console.log(`✅ Selected ${provider.name} (limit: ${provider.limit.toLocaleString()} tokens)`);
            return provider.name;
        }
    }
    
    // Fallback to Groq with truncation
    console.warn('⚠️ Using Groq with aggressive truncation');
    return 'groq';
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
    console.log('🎯 Starting AI summary generation with', notams.length, 'NOTAMs');
    
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

    // **OPTIMIZED: Prepare compact NOTAM data**
    const compactNotamData = activeNotams.map((notam, index) => ({
        id: index + 1,
        number: notam.number || 'N/A',
        text: (notam.summary || notam.rawText || '').substring(0, 400), // Increased limit
        validFrom: notam.validFrom,
        validTo: notam.validTo,
        source: notam.source || 'FAA'
    }));

    // **STREAMLINED: Optimized prompt**
    const systemPrompt = `You are an expert aviation operations analyst. Provide precise, time-specific operational briefings for pilots and dispatchers. Focus on operational impacts using the exact format specified.`;
    
    const userPrompt = `
🎯 **AVIATION BRIEFING: ${icaoCode}**
**PERIOD:** Next ${timeDescription}
**DATA:** ${compactNotamData.length} NOTAMs

**FORMAT REQUIRED:**
🔴 **CRITICAL** (max 3 items)
• [Operational impact + effective time]

🟡 **OPERATIONAL** (max 3 items)  
• [Operational impact + effective time]

🟢 **ADVISORY** (max 2 items)
• [Operational impact + effective time]

**RULES:**
- Start with operational impact, not NOTAM text
- Include effective times for critical items
- Max 12 words per bullet point
- Use aviation terminology
- Focus on flight operations impact

**NOTAM DATA:**
${JSON.stringify(compactNotamData, null, 1)}

**BRIEFING:**`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // **SMART: Auto-select best AI provider**
    const estimatedTokens = estimateTokens(userPrompt);
    const selectedProvider = selectBestProvider(estimatedTokens);
    
    const apiKeys = {
        groq: GROQ_API_KEY,
        claude: CLAUDE_API_KEY,
        gemini: GEMINI_API_KEY,
        openai: OPENAI_API_KEY,
        cohere: COHERE_API_KEY
    };

    try {
        let rawContent;
        
        if (selectedProvider === 'groq') {
            // Use existing Groq implementation with truncation
            if (estimatedTokens > 5000) {
                console.warn('⚠️ Truncating for Groq limits');
                userPrompt = userPrompt.substring(0, 20000) + '\n\n[TRUNCATED FOR SIZE LIMIT]';
            }
            
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: aiModel,
                    messages: [{ role: 'user', content: userPrompt }],
                    temperature: 0.1,
                    max_tokens: 800,
                    top_p: 0.8
                })
            });
            
            if (!response.ok) {
                throw new Error(`Groq API error: ${response.status}`);
            }
            
            const data = await response.json();
            rawContent = data.choices[0].message.content;
        } else {
            // Use selected AI provider
            rawContent = await callAIProvider(
                selectedProvider, 
                messages, 
                1000, 
                apiKeys[selectedProvider]
            );
        }
        
        // **ENHANCED: Format cleanup**
        const firstEmojiMatch = rawContent.match(/(🔴|🟡|🟢)/);
        if (firstEmojiMatch) {
            rawContent = rawContent.substring(rawContent.indexOf(firstEmojiMatch[0]));
        }
        
        rawContent = rawContent
            .replace(/^[-*]\s/gm, '• ')
            .replace(/^(\d+\.)\s/gm, '• ')
            .replace(/\n\n+/g, '\n')
            .trim();
        
        const hasRequired = rawContent.includes('🔴') || rawContent.includes('🟡') || rawContent.includes('🟢');
        
        if (!hasRequired) {
            return `<div style="padding: 20px;">
                <h3 style="color: #f39c12;">⚠️ Analysis Simplified</h3>
                <p>Showing ${compactNotamData.length} of ${notams.length} NOTAMs using ${selectedProvider.toUpperCase()}.</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    ${rawContent.replace(/\n/g, '<br>')}
                </div>
            </div>`;
        }
        
        const formattedContent = rawContent
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/🔴/g, '<span style="color: #e74c3c; font-weight: bold;">🔴</span>')
            .replace(/🟡/g, '<span style="color: #f39c12; font-weight: bold;">🟡</span>')
            .replace(/🟢/g, '<span style="color: #27ae60; font-weight: bold;">🟢</span>')
            .replace(/• /g, '<span style="margin-left: 10px;">• </span>');
        
        // Add provider info
        const providerInfo = AI_PROVIDERS[selectedProvider] || { name: selectedProvider.toUpperCase() };
        let optimizationNotice = `<div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid #28a745;">
            <strong>🤖 AI Analysis:</strong> ${compactNotamData.length} NOTAMs analyzed using ${providerInfo.name}
        </div>`;
        
        console.log(`✅ AI summary generated using ${selectedProvider}: ${compactNotamData.length}/${notams.length} NOTAMs`);
        return optimizationNotice + formattedContent;
        
    } catch (error) {
        console.error(`${selectedProvider} API Error:`, error);
        throw new Error(`Failed to generate AI summary using ${selectedProvider}: ${error.message}`);
    }
};