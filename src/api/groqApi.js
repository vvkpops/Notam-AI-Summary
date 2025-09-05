import { GROQ_API_KEY } from '../config';

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

    // Filter out cancellation NOTAMs for analysis
    const activeNotams = notams.filter(notam => !notam.isCancellation);
    
    if (activeNotams.length === 0) {
        return `<div style="text-align: center; padding: 20px;">
            <h3 style="color: #27ae60;">✅ No Active NOTAMs</h3>
            <p>No active NOTAMs found for <strong>${icaoCode}</strong> in the next ${timeDescription}.</p>
            <p style="color: #27ae60; font-weight: 600; margin-top: 15px;">All clear for operations! 🛫</p>
        </div>`;
    }

    // **SIMPLIFIED: Send NOTAMs as-is - they're already perfectly structured**
    const notamJsonString = JSON.stringify(activeNotams, null, 2);
    
    // Check size and truncate if needed
    const sizeLimit = 80000; // 80KB
    let finalNotamData = activeNotams;
    
    if (notamJsonString.length > sizeLimit) {
        console.warn(`⚠️ Payload too large, reducing NOTAMs from ${activeNotams.length} to fit size limit`);
        const targetCount = Math.floor(activeNotams.length * (sizeLimit / notamJsonString.length));
        finalNotamData = activeNotams.slice(0, Math.max(targetCount, 5)); // Keep at least 5
    }

    const finalNotamJson = JSON.stringify(finalNotamData, null, 2);
    
    // Log final size
    const finalSize = new Blob([finalNotamJson]).size;
    console.log(`📊 Final NOTAM JSON size: ${(finalSize / 1024).toFixed(2)}KB`);

    // **WORLD'S BEST PROMPT** - Let the AI do what it does best
    const getPrompt = () => {
        const timeWindow = `${now.toISOString()} → ${endTime.toISOString()}`;
        
        const basePrompt = `
🎯 **AVIATION OPERATIONAL BRIEFING**

**AIRPORT:** ${icaoCode}
**TIME WINDOW:** Next ${timeDescription} (${timeWindow})
**AUDIENCE:** Professional pilots, dispatchers, and operations personnel

**YOUR MISSION:**
Analyze the NOTAMs below and provide a professional operational briefing. Focus on what matters most for flight operations.

**OUTPUT FORMAT:**
🔴 **CRITICAL OPERATIONS**
• [Runway closures, major navigation outages - include times]

🟡 **OPERATIONAL IMPACTS** 
• [Equipment outages, restrictions - include times]

🟢 **ADVISORIES**
• [Minor items that may affect operations]

⏰ **TIME-SPECIFIC NOTES**
• [Any scheduling or time-limited items]

**GUIDELINES:**
- Lead with operational impact, not NOTAM jargon
- Use clear aviation terminology
- Include effective times for important items
- If no significant impacts: state "No critical operational impacts identified"
- Be concise but complete for operational decisions
`;

        const analysisSpecific = {
            'runway': '\n🛬 **FOCUS:** Prioritize runway and taxiway operations, closures, construction impacts',
            'airspace': '\n🌐 **FOCUS:** Prioritize navigation aids, airspace restrictions, approach limitations', 
            'general': '\n📋 **FOCUS:** Comprehensive overview - runways → navigation → airspace → facilities'
        };

        return basePrompt + (analysisSpecific[analysisType] || analysisSpecific.general);
    };

    const enhancedPrompt = `${getPrompt()}

**NOTAM DATA TO ANALYZE:**
${finalNotamJson}

**OPERATIONAL BRIEFING FOR ${icaoCode}:**
Provide your professional assessment for the next ${timeDescription}:
`;

    // Log prompt details
    const promptSize = new Blob([enhancedPrompt]).size;
    const estimatedTokens = Math.ceil(enhancedPrompt.length / 4);
    
    console.log(`📏 PROMPT STATS: ${enhancedPrompt.length} chars, ${(promptSize / 1024).toFixed(2)}KB, ~${estimatedTokens} tokens`);

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
                        content: `You are an expert aviation operations analyst with 20+ years of experience. Provide precise, time-specific operational briefings that help aviation professionals make informed decisions. Focus on real operational impacts, not just repeating NOTAM text.`
                    },
                    {
                        role: 'user', 
                        content: enhancedPrompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 1500,
                top_p: 0.9,
                frequency_penalty: 0.1
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const rawContent = data.choices[0].message.content;
        
        // Enhanced formatting
        return rawContent
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/🔴/g, '<span style="color: #e74c3c; font-weight: bold;">🔴</span>')
            .replace(/🟡/g, '<span style="color: #f39c12; font-weight: bold;">🟡</span>')
            .replace(/🟢/g, '<span style="color: #27ae60; font-weight: bold;">🟢</span>')
            .replace(/⏰/g, '<span style="color: #3498db; font-weight: bold;">⏰</span>')
            .replace(/• /g, '• ');
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};
