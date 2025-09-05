import { GROQ_API_KEY } from '../config';
import { parseRawNotam } from '../utils/parser';

export const generateAISummary = async ({ 
    notams, 
    icaoCode, 
    analysisType, 
    aiModel,
    timeValue = 24,
    timeUnit = 'hours'
}) => {
    const maxNotams = 50;
    const limitedNotams = notams.slice(0, maxNotams);

    // Create time window description
    const timeDescription = timeUnit === 'days' 
        ? `${timeValue} day${timeValue > 1 ? 's' : ''}` 
        : `${timeValue} hour${timeValue > 1 ? 's' : ''}`;
    
    const now = new Date();
    const endTime = new Date(now.getTime() + (timeUnit === 'days' ? timeValue * 24 : timeValue) * 60 * 60 * 1000);

    // --- Using your parser to create a structured JSON payload ---
    const structuredNotamData = limitedNotams.map((n) => {
        const rawText = n.properties?.text || '';
        const parsed = parseRawNotam(rawText);
        
        return {
            notamNumber: parsed?.notamNumber || n.properties?.notamNumber || 'N/A',
            body: parsed?.body || rawText,
            validFrom: parsed?.validFromRaw || n.properties?.effectiveStart,
            validTo: parsed?.validToRaw || n.properties?.effectiveEnd,
            schedule: parsed?.schedule,
            isCancellation: parsed?.isCancellation,
            source: n.properties?.source || 'FAA',
            isActiveInWindow: !n._timeFilterInfo || true // All filtered NOTAMs are active in window
        };
    }).filter(n => !n.isCancellation);

    const notamJsonString = JSON.stringify(structuredNotamData, null, 2);
    const truncatedNote = notams.length > maxNotams 
        ? `\n\nNote: Analysis is based on the first ${maxNotams} of ${notams.length} total NOTAMs active in the specified time window.` 
        : '';

    // --- Enhanced time-aware prompt ---
    const getAnalysisPrompt = () => {
        const baseInstructions = `
You are an expert aviation analyst providing a briefing for a professional pilot.
Analyze the following JSON data of NOTAMs for ${icaoCode} that will be ACTIVE in the next ${timeDescription}.

**TIME WINDOW:** ${now.toISOString()} to ${endTime.toISOString()}

**CRITICAL INSTRUCTIONS:**
1. Focus ONLY on NOTAMs that affect operations in the next ${timeDescription}
2. Provide a brief, bullet-pointed summary prioritizing operational significance
3. Start with the most critical items (runway closures, ILS outages, etc.)
4. Include effective times using "validFrom" and "validTo" fields
5. If no significant operational impacts exist, state that clearly
6. Use this format:
   • **CRITICAL:** [Most important items first]
   • **OPERATIONAL:** [Equipment outages, restrictions]
   • **ADVISORY:** [Minor items, if space permits]
`;

        const analysisSpecific = {
            'runway': `
**SPECIAL FOCUS:** Prioritize runway and taxiway operations, closures, and surface conditions.
Look for: RWY closures, taxiway restrictions, construction, surface conditions, displaced thresholds.`,
            'airspace': `
**SPECIAL FOCUS:** Prioritize airspace restrictions, procedures, and navigation aids.
Look for: TFRs, airspace closures, approach/departure restrictions, NAVAID outages.`,
            'general': `
**FOCUS:** Provide a balanced overview of all operationally significant NOTAMs.
Prioritize by operational impact: runways → navigation → airspace → facilities.`
        };

        return baseInstructions + (analysisSpecific[analysisType] || analysisSpecific.general);
    };

    const prompt = `${getAnalysisPrompt()}

**Structured NOTAM Data:**
${notamJsonString}
${truncatedNote}

**OPERATIONAL BRIEFING for ${icaoCode} (Next ${timeDescription}):**
`;

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
                        content: `You are an expert aviation analyst creating time-specific, actionable NOTAM summaries for pilots and dispatchers. Focus on operational impacts within the specified time window.`
                    },
                    {
                        role: 'user', 
                        content: prompt
                    }
                ],
                temperature: 0.1, // Lower temperature for more consistent, factual responses
                max_tokens: 1200  // Increased for detailed time-specific analysis
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/• /g, '• '); // Ensure bullet points are preserved
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};