import { GROQ_API_KEY } from '../config';
import { parseRawNotam } from '../utils/parser'; // <-- Importing your parser

export const generateAISummary = async ({ notams, icaoCode, analysisType, aiModel }) => {
    const maxNotams = 50;
    const limitedNotams = notams.slice(0, maxNotams);

    // --- Using your parser to create a structured JSON payload ---
    const structuredNotamData = limitedNotams.map((n) => {
        const rawText = n.properties?.text || '';
        const parsed = parseRawNotam(rawText);
        
        // Return a clean, structured object for the AI
        return {
            notamNumber: parsed?.notamNumber || n.properties?.notamNumber || 'N/A',
            body: parsed?.body || rawText, // The most important part for the summary
            validFrom: parsed?.validFromRaw,
            validTo: parsed?.validToRaw,
            schedule: parsed?.schedule,
            isCancellation: parsed?.isCancellation,
        };
    }).filter(n => !n.isCancellation); // Filter out cancellation NOTAMs from the summary

    const notamJsonString = JSON.stringify(structuredNotamData, null, 2);
    const truncatedNote = notams.length > maxNotams ? `\n\nNote: Analysis is based on the first ${maxNotams} of ${notams.length} total NOTAMs.` : '';

    // --- A refined prompt that leverages the structured data ---
    const prompt = `
You are an expert aviation analyst providing a briefing for a professional pilot.
Analyze the following JSON data of NOTAMs for ${icaoCode}.

**Instructions:**
1.  Provide a brief, to-the-point, bulleted summary.
2.  Focus ONLY on operationally significant information from the "body" of each NOTAM.
3.  Look for runway/taxiway closures, equipment outages (e.g., ILS, VOR, PAPI), airspace restrictions, and critical obstacles.
4.  For each point, mention the effective times using the "validFrom" and "validTo" fields.
5.  If there are no significant operational impacts, state that clearly.

**Structured NOTAM Data:**
${notamJsonString}
${truncatedNote}

**Briefing Summary for ${icaoCode}:**
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
                        content: 'You are an expert aviation analyst creating concise, actionable summaries for pilots from structured JSON NOTAM data.'
                    },
                    {
                        role: 'user', 
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};