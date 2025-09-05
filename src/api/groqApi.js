import { GROQ_API_KEY } from '../config';

// **ENHANCED: Smart token estimation and management**
function estimateTokens(text) {
    // More accurate estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
}

function truncateToTokenLimit(text, maxTokens) {
    const maxChars = maxTokens * 4; // Conservative estimate
    if (text.length <= maxChars) return text;
    
    // Find good truncation point
    const truncated = text.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    const lastSpace = truncated.lastIndexOf(' ');
    
    // Use best available break point
    const breakPoint = lastPeriod > maxChars * 0.8 ? lastPeriod + 1 :
                      lastNewline > maxChars * 0.8 ? lastNewline :
                      lastSpace > maxChars * 0.8 ? lastSpace : maxChars;
    
    return truncated.substring(0, breakPoint) + '\n\n[TRUNCATED FOR SIZE LIMIT]';
}

function smartNotamReduction(notams, targetTokens) {
    console.log(`🎯 Smart reduction: ${notams.length} NOTAMs, target: ${targetTokens} tokens`);
    
    // Step 1: Remove cancellation NOTAMs
    let filtered = notams.filter(notam => !notam.isCancellation);
    console.log(`📊 After removing cancellations: ${filtered.length} NOTAMs`);
    
    // Step 2: Prioritize by operational impact
    const prioritized = filtered.sort((a, b) => {
        const getPriority = (notam) => {
            const text = (notam.summary || notam.rawText || '').toUpperCase();
            
            // Critical (priority 1)
            if (/RWY.*CLSD|RUNWAY.*CLOSED|ILS.*U\/S/.test(text)) return 1;
            
            // Operational (priority 2)  
            if (/TWY.*CLSD|TAXIWAY.*CLOSED|NAV.*U\/S|APPROACH.*RESTRICTED/.test(text)) return 2;
            
            // Advisory (priority 3)
            return 3;
        };
        
        return getPriority(a) - getPriority(b);
    });
    
    // Step 3: Progressively reduce until we fit
    let currentTokens = estimateTokens(JSON.stringify(prioritized));
    let result = [...prioritized];
    
    while (currentTokens > targetTokens && result.length > 5) {
        // Remove lowest priority items first
        result = result.slice(0, Math.floor(result.length * 0.8));
        currentTokens = estimateTokens(JSON.stringify(result));
        console.log(`📉 Reduced to ${result.length} NOTAMs, ~${currentTokens} tokens`);
    }
    
    return result;
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

    // **CRITICAL: Smart token budget management**
    const maxTokensBudget = aiModel.includes('8b') ? 5000 : 12000; // Conservative limits
    const promptOverhead = 1500; // Estimated tokens for instructions
    const responseTokens = 800;   // Estimated tokens for response
    const availableForNotams = maxTokensBudget - promptOverhead - responseTokens;
    
    console.log(`💰 Token budget: ${maxTokensBudget} total, ${availableForNotams} for NOTAMs`);

    // **ENHANCED: Smart NOTAM reduction**
    const optimizedNotams = smartNotamReduction(notams, availableForNotams);
    
    if (optimizedNotams.length === 0) {
        return `<div style="text-align: center; padding: 20px;">
            <h3 style="color: #27ae60;">✅ No Active NOTAMs</h3>
            <p>No active NOTAMs found for <strong>${icaoCode}</strong> in the next ${timeDescription}.</p>
            <p style="color: #27ae60; font-weight: 600; margin-top: 15px;">All clear for operations! 🛫</p>
        </div>`;
    }

    // **OPTIMIZED: Minimal but complete NOTAM data**
    const compactNotamData = optimizedNotams.map((notam, index) => ({
        id: index + 1,
        number: notam.number || 'N/A',
        text: (notam.summary || notam.rawText || '').substring(0, 300), // Limit text length
        validFrom: notam.validFrom,
        validTo: notam.validTo,
        source: notam.source || 'FAA'
    }));

    const finalNotamJson = JSON.stringify(compactNotamData, null, 1); // Reduced formatting
    
    // **CRITICAL: Final token check**
    const notamTokens = estimateTokens(finalNotamJson);
    console.log(`📊 Final NOTAM data: ${compactNotamData.length} NOTAMs, ~${notamTokens} tokens`);
    
    if (notamTokens > availableForNotams) {
        console.warn('⚠️ Still too large, applying text truncation');
        const truncatedJson = truncateToTokenLimit(finalNotamJson, availableForNotams);
        var finalData = truncatedJson;
    } else {
        var finalData = finalNotamJson;
    }

    // **STREAMLINED: Concise but effective prompt**
    const getCompactPrompt = () => {
        const basePrompt = `
🎯 **AVIATION BRIEFING: ${icaoCode}**
**PERIOD:** Next ${timeDescription}
**DATA:** ${compactNotamData.length} NOTAMs (optimized for analysis)

**MISSION:** Create bullet-point operational briefing

**FORMAT:**
🔴 **CRITICAL** (max 3 items)
• [Impact + time]

🟡 **OPERATIONAL** (max 3 items)  
• [Impact + time]

🟢 **ADVISORY** (max 2 items)
• [Impact + time]

**RULES:**
- Start with operational impact, not NOTAM text
- Include effective times for critical items
- Max 12 words per bullet
- Skip minor administrative items
- Use aviation terminology`;

        const focusMap = {
            'runway': '\n**FOCUS:** Runway/taxiway operations, construction',
            'airspace': '\n**FOCUS:** Navigation aids, airspace restrictions', 
            'general': '\n**FOCUS:** All operational impacts by severity'
        };

        return basePrompt + (focusMap[analysisType] || focusMap.general);
    };

    const compactPrompt = `${getCompactPrompt()}

**NOTAM DATA:**
${finalData}

**BRIEFING:**`;

    // **FINAL: Token validation before sending**
    const totalPromptTokens = estimateTokens(compactPrompt);
    console.log(`📏 Final prompt: ${totalPromptTokens} tokens (limit: ${maxTokensBudget})`);
    
    if (totalPromptTokens > maxTokensBudget) {
        throw new Error(`Prompt still too large: ${totalPromptTokens} tokens (limit: ${maxTokensBudget}). Try reducing time window or use fewer NOTAMs.`);
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: aiModel,
                messages: [
                    {
                        role: 'system',
                        content: `Expert aviation analyst. Follow exact format. Be concise. Focus on operational impact.`
                    },
                    {
                        role: 'user', 
                        content: compactPrompt
                    }
                ],
                temperature: 0.1,
                max_tokens: responseTokens, // Conservative response limit
                top_p: 0.8,
                frequency_penalty: 0.3,
                presence_penalty: 0.2
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        let rawContent = data.choices[0].message.content;
        
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
                <p>Due to size constraints, showing ${compactNotamData.length} of ${notams.length} NOTAMs.</p>
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
        
        // Add optimization notice if NOTAMs were reduced
        let optimizationNotice = '';
        if (compactNotamData.length < notams.length) {
            optimizationNotice = `<div style="background: #e3f2fd; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid #2196f3;">
                <strong>📊 Analysis Optimized:</strong> Showing ${compactNotamData.length} most critical of ${notams.length} total NOTAMs for ${icaoCode}.
            </div>`;
        }
        
        console.log(`✅ AI summary generated: ${compactNotamData.length}/${notams.length} NOTAMs analyzed`);
        return optimizationNotice + formattedContent;
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};
