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

    // Check size and truncate if needed
    const sizeLimit = 80000; // 80KB
    let finalNotamData = activeNotams;
    
    if (JSON.stringify(activeNotams).length > sizeLimit) {
        console.warn(`⚠️ Payload too large, reducing NOTAMs from ${activeNotams.length} to fit size limit`);
        const targetCount = Math.floor(activeNotams.length * (sizeLimit / JSON.stringify(activeNotams).length));
        finalNotamData = activeNotams.slice(0, Math.max(targetCount, 5));
    }

    const finalNotamJson = JSON.stringify(finalNotamData, null, 2);
    
    // Log final size
    const finalSize = new Blob([finalNotamJson]).size;
    console.log(`📊 Final NOTAM JSON size: ${(finalSize / 1024).toFixed(2)}KB`);

    // **FOOLPROOF PROMPT WITH BUILT-IN VERIFICATION**
    const getFoolproofPrompt = () => {
        const timeWindow = `${now.toISOString()} → ${endTime.toISOString()}`;
        
        const basePrompt = `
🎯 **MISSION: AVIATION OPERATIONAL BRIEFING**

**TARGET:** ${icaoCode} Airport
**TIMEFRAME:** Next ${timeDescription} (${timeWindow})
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

**VERIFICATION CHECKLIST - YOU MUST VERIFY:**
✅ Each bullet point starts with OPERATIONAL IMPACT (not NOTAM jargon)
✅ Times are included for critical items
✅ No duplicate information
✅ Aviation terminology is correct
✅ Information is accurate to the NOTAM data
✅ Bullet points are concise (max 15 words each)
✅ No unnecessary words or filler
✅ Categories are correctly prioritized by operational severity

**WHAT TO AVOID:**
❌ Long sentences or paragraphs
❌ Repeating NOTAM text verbatim
❌ Non-aviation jargon
❌ Duplicate information
❌ Vague statements without operational context
❌ Missing time information for critical items
❌ More than 11 total bullet points
`;

        const analysisSpecific = {
            'runway': `\n**SPECIAL FOCUS:** Runway closures, taxiway restrictions, construction impacts on aircraft movement`,
            'airspace': `\n**SPECIAL FOCUS:** Navigation aids, airspace restrictions, approach/departure limitations`, 
            'general': `\n**SPECIAL FOCUS:** All operational impacts ranked by severity: runways → navigation → airspace → facilities`
        };

        return basePrompt + (analysisSpecific[analysisType] || analysisSpecific.general);
    };

    const foolproofPrompt = `${getFoolproofPrompt()}

**NOTAM DATA TO ANALYZE:**
${finalNotamJson}

**INSTRUCTIONS:**
1. Analyze the NOTAMs above
2. Extract operational impacts (not NOTAM text)
3. Create bullet points with times
4. Self-verify against checklist
5. Deliver verified briefing

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
                        content: `You are an expert aviation operations analyst. You MUST follow the exact format specified. You MUST verify your output against the checklist provided. You MUST use bullet points only. You MUST include operational impacts and times. You MUST be concise and professional. If you provide anything other than the requested format, you have failed the mission.`
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
        
        console.log('✅ AI summary generated and verified');
        return formattedContent;
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};
