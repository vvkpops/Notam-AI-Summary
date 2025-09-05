import { GROQ_API_KEY } from '../config';

export const generateAISummary = async ({ notams, icaoCode, analysisType, aiModel }) => {
    const maxNotams = 50;
    const limitedNotams = notams.slice(0, maxNotams);
    const truncatedNote = notams.length > maxNotams ? `\n\nNote: Analysis limited to first ${maxNotams} NOTAMs out of ${notams.length} total.` : '';

    const prompt = `You are an expert aviation analyst. Analyze the following NOTAMs for ${icaoCode} airport and provide a clear, actionable summary focusing on ${analysisType} aspects.

NOTAMs to analyze (${limitedNotams.length} total):
${limitedNotams.map((n, i) => `${i + 1}. ${n.properties?.text || 'No text available'} (Effective: ${n.properties?.effectiveStart || 'Unknown'} to ${n.properties?.effectiveEnd || 'Unknown'}, Type: ${n.properties?.featureType || 'Unknown'})`).join('\n')}${truncatedNote}

Please provide:
1. **Executive Summary**: A brief 2-3 sentence overview of the most critical impacts
2. **Operational Impact**: Key impacts for pilots and flight operations
3. **Safety Considerations**: Any critical safety items that require attention
4. **Timeline**: When restrictions are active and their durations
5. **Flight Planning Recommendations**: Specific actions pilots should take

Format your response in clear, professional language suitable for aviation professionals. Use bullet points and clear sections for easy scanning. Focus on actionable insights rather than just repeating the NOTAM text.`;

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
                    { role: 'system', content: 'You are an expert aviation analyst specializing in NOTAM analysis and flight safety. You provide clear, actionable insights for pilots and flight operations personnel.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 2000
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