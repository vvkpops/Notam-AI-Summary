import { GROQ_API_KEY } from '../config';

export const generateAISummary = async ({ 
    notams, 
    icaoCode, 
    analysisType, 
    aiModel,
    timeValue = 24,
    timeUnit = 'hours'
}) => {
    console.log('🎯 Starting AI summary generation with', notams.length, 'NOTAMs (max 50)');
    
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

    // **OPTIMIZED: Already limited to 50, but ensure we don't exceed safe payload sizes**
    const sizeLimit = 70000; // 70KB - more conservative for 50 NOTAMs
    let finalNotamData = activeNotams;
    
    const jsonString = JSON.stringify(activeNotams);
    if (jsonString.length > sizeLimit) {
        console.warn(`⚠️ Payload still too large with ${activeNotams.length} NOTAMs, reducing further`);
        const targetCount = Math.floor(activeNotams.length * (sizeLimit / jsonString.length));
        finalNotamData = activeNotams.slice(0, Math.max(targetCount, 10)); // Keep at least 10
    }

    const finalNotamJson = JSON.stringify(finalNotamData, null, 2);
    
    // Log final size
    const finalSize = new Blob([finalNotamJson]).size;
    console.log(`📊 Final NOTAM JSON size: ${(finalSize / 1024).toFixed(2)}KB for ${finalNotamData.length} NOTAMs`);

    // **ENHANCED PROMPT - Optimized for 50 NOTAM maximum**
    const getFoolproofPrompt = () => {
        const timeWindow = `${now.toISOString()} → ${endTime.toISOString()}`;
        
        const basePrompt = `
🎯 **MISSION: AVIATION OPERATIONAL BRIEFING**

**TARGET:** ${icaoCode} Airport
**TIMEFRAME:** Next ${timeDescription} (${timeWindow})
**DATA:** ${finalNotamData.length} NOTAMs (max 50 for optimal analysis)
**OUTPUT:** Bullet-point operational briefing for pilots and dispatchers

**MANDATORY REQUIREMENTS:**
1. ✅ BULLET POINTS ONLY - No paragraphs, no fluff
2. ✅ OPERATIONAL IMPACT FIRST - What it means for operations
3. ✅ INCLUDE TIMES - When restrictions are active
4. ✅ AVIATION TERMINOLOGY - Professional language only
5. ✅ PRIORITIZE BY SEVERITY - Critical → Operational → Advisory

**STRICT OUTPUT FORMAT:**
🔴 **CRITICAL OPERATIONS**
• [Bullet point with operational impact + time]
• [Maximum 4 items]

🟡 **OPERATIONAL IMPACTS**
• [Bullet point with operational impact + time]
• [Maximum 4 items]

🟢 **ADVISORIES**
• [Bullet point with operational impact + time]
• [Maximum 3 items]

**QUALITY CONTROL - VERIFY BEFORE RESPONDING:**
✅ Each bullet starts with OPERATIONAL IMPACT (not NOTAM jargon)
✅ Times included for critical/operational items
✅ No duplicate information
✅ Aviation terminology is correct
✅ Information matches the NOTAM data
✅ Bullet points are concise (max 15 words each)
✅ No unnecessary words or filler
✅ Categories correctly prioritized by operational severity
✅ Total bullet points ≤ 11

**ANALYSIS OPTIMIZATION:**
- Focus on the MOST OPERATIONALLY SIGNIFICANT NOTAMs
- With 50 NOTAMs max, prioritize by real impact on flight operations
- Skip minor administrative or low-impact NOTAMs
- Emphasize runway, navigation, and airspace impacts
`;

        const analysisSpecific = {
            'runway': `\n**SPECIAL FOCUS:** Runway closures, taxiway restrictions, construction impacts on aircraft movement`,
            'airspace': `\n**SPECIAL FOCUS:** Navigation aids, airspace restrictions, approach/departure limitations`, 
            'general': `\n**SPECIAL FOCUS:** All operational impacts ranked by severity: runways → navigation → airspace → facilities`
        };

        return basePrompt + (analysisSpecific[analysisType] || analysisSpecific.general);
    };

    const foolproofPrompt = `${getFoolproofPrompt()}

**NOTAM DATA TO ANALYZE (${finalNotamData.length}/50 max):**
${finalNotamJson}

**INSTRUCTIONS:**
1. Analyze the ${finalNotamData.length} NOTAMs above
2. Extract ONLY the most operationally significant impacts
3. Create bullet points with times for critical items
4. Self-verify against quality control checklist
5. Deliver verified operational briefing

**DELIVER OPERATIONAL BRIEFING FOR ${icaoCode}:**
`;

    // Log prompt details
    const promptSize = new Blob([foolproofPrompt]).size;
    const estimatedTokens = Math.ceil(foolproofPrompt.length / 4);
    
    console.log(`📏 PROMPT STATS: ${foolproofPrompt.length} chars, ${(promptSize / 1024).toFixed(2)}KB, ~${estimatedTokens} tokens`);

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
                        content: `You are an expert aviation operations analyst. You MUST follow the exact format specified. You MUST verify your output against the quality control checklist. You MUST use bullet points only. You MUST include operational impacts and times. You MUST be concise and professional. Focus on the MOST OPERATIONALLY SIGNIFICANT items from the NOTAMs provided. With a 50 NOTAM limit, prioritize by real operational impact.`
                    },
                    {
                        role: 'user', 
                        content: foolproofPrompt
                    }
                ],
                temperature: 0.05, // Lower for more consistent format adherence
                max_tokens: 1200,  // Reduced to enforce conciseness
                top_p: 0.8,        // More focused responses
                frequency_penalty: 0.2, // Reduce repetition
                presence_penalty: 0.1   // Encourage variety
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        let rawContent = data.choices[0].message.content;
        
        // **POST-PROCESSING VERIFICATION AND CLEANUP**
        
        // Remove any text before the first emoji category
        const firstEmojiMatch = rawContent.match(/(🔴|🟡|🟢)/);
        if (firstEmojiMatch) {
            rawContent = rawContent.substring(rawContent.indexOf(firstEmojiMatch[0]));
        }
        
        // Ensure bullet points are properly formatted
        rawContent = rawContent
            .replace(/^-\s/gm, '• ')       // Convert dashes to bullets
            .replace(/^\*\s/gm, '• ')      // Convert asterisks to bullets
            .replace(/^(\d+\.)\s/gm, '• ') // Convert numbers to bullets
            .replace(/\n\n+/g, '\n')       // Remove excessive line breaks
            .trim();
        
        // Verify the output contains required sections
        const hasRequired = rawContent.includes('🔴') || rawContent.includes('🟡') || rawContent.includes('🟢');
        
        if (!hasRequired) {
            console.warn('⚠️ AI response missing required format, applying fallback');
            return `<div style="padding: 20px;">
                <h3 style="color: #f39c12;">⚠️ Analysis Incomplete</h3>
                <p><strong>Raw AI Response:</strong></p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    ${rawContent.replace(/\n/g, '<br>')}
                </div>
                <p style="margin-top: 15px;"><em>Note: AI response did not follow the required format. Please review NOTAMs manually.</em></p>
            </div>`;
        }
        
        // Enhanced formatting with strict bullet point preservation
        const formattedContent = rawContent
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/🔴/g, '<span style="color: #e74c3c; font-weight: bold; font-size: 1.1em;">🔴</span>')
            .replace(/🟡/g, '<span style="color: #f39c12; font-weight: bold; font-size: 1.1em;">🟡</span>')
            .replace(/🟢/g, '<span style="color: #27ae60; font-weight: bold; font-size: 1.1em;">🟢</span>')
            .replace(/• /g, '<span style="margin-left: 10px;">• </span>');
        
        console.log(`✅ AI summary generated and verified for ${finalNotamData.length} NOTAMs`);
        return formattedContent;
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};
