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

    // Enhanced structured NOTAM data with better parsing
    const structuredNotamData = limitedNotams.map((n, index) => {
        const rawText = n.properties?.text || '';
        const parsed = parseRawNotam(rawText);
        
        // Enhanced categorization
        const categories = categorizeNotam(rawText, parsed);
        
        return {
            index: index + 1,
            notamNumber: parsed?.notamNumber || n.properties?.notamNumber || 'N/A',
            body: parsed?.body || rawText,
            validFrom: parsed?.validFromRaw || n.properties?.effectiveStart,
            validTo: parsed?.validToRaw || n.properties?.effectiveEnd,
            schedule: parsed?.schedule,
            isCancellation: parsed?.isCancellation,
            source: n.properties?.source || 'FAA',
            isActiveInWindow: true,
            qLine: parsed?.qLine,
            aerodrome: parsed?.aerodrome,
            // NEW: Enhanced categorization
            category: categories.primary,
            severity: categories.severity,
            operationalImpact: categories.impact,
            affectedSystems: categories.systems
        };
    }).filter(n => !n.isCancellation);

    const notamJsonString = JSON.stringify(structuredNotamData, null, 2);
    const truncatedNote = notams.length > maxNotams 
        ? `\n\n⚠️ **Analysis Limited:** Showing first ${maxNotams} of ${notams.length} total NOTAMs due to analysis constraints.` 
        : '';

    // **WORLD'S BEST PROMPT** - Enhanced for operational excellence
    const getEnhancedPrompt = () => {
        const timeWindow = `${now.toISOString()} → ${endTime.toISOString()}`;
        
        const basePrompt = `
🎯 **AVIATION OPERATIONAL BRIEFING REQUEST**

**MISSION:** Provide a time-specific operational briefing for ${icaoCode}
**TIME SCOPE:** Active NOTAMs in the next ${timeDescription} (${timeWindow})
**AUDIENCE:** Professional pilots, dispatchers, and operations personnel

**📋 ANALYSIS FRAMEWORK:**
1. **CRITICALITY HIERARCHY:** 
   - 🔴 CRITICAL: Runway closures, major navigation outages, safety-critical items
   - 🟡 OPERATIONAL: Equipment outages, restrictions affecting normal ops
   - 🟢 ADVISORY: Minor facilities, lighting, informational items

2. **OPERATIONAL PRIORITIES:**
   - Runway availability and restrictions
   - ILS/GPS/Navigation aids status  
   - Taxiway routing and ground movement
   - Approach/departure procedures
   - Airspace restrictions
   - Airport facilities and services

3. **TIME-SENSITIVE FOCUS:**
   - Only include NOTAMs active during: ${timeWindow}
   - Specify exact effective times for critical items
   - Note any time-limited restrictions within the window

**📊 REQUIRED OUTPUT FORMAT:**
🔴 **CRITICAL OPERATIONS**
• [Runway closures, major nav outages - with times]

🟡 **OPERATIONAL IMPACTS** 
• [Equipment outages, restrictions - with times]

🟢 **ADVISORIES**
• [Minor items, if operationally relevant]

⏰ **TIME-SPECIFIC NOTES**
• [Any scheduling within the ${timeDescription} window]

**💼 PROFESSIONAL STANDARDS:**
- Lead with operational impact, not NOTAM text
- Use aviation terminology appropriately
- Be concise but complete for operational decisions
- If no significant impacts: clearly state "No critical operational impacts identified"
- Maximum 4 items per category for briefing clarity
`;

        const analysisSpecific = {
            'runway': `\n🛬 **SPECIAL FOCUS: RUNWAY OPERATIONS**
- Prioritize runway availability, surface conditions, construction
- Detail taxiway impacts on ground movement
- Note any displaced thresholds or approach restrictions`,
            
            'airspace': `\n🌐 **SPECIAL FOCUS: AIRSPACE & NAVIGATION**
- Prioritize ILS/GPS/NAVAID status for approaches
- Detail any airspace restrictions or TFRs
- Note frequency changes or procedure modifications`,
            
            'general': `\n📋 **COMPREHENSIVE OPERATIONAL OVERVIEW**
- Balance all operational aspects by impact severity
- Runway → Navigation → Airspace → Facilities priority
- Focus on flight planning and operational decision support`
        };

        return basePrompt + (analysisSpecific[analysisType] || analysisSpecific.general);
    };

    const enhancedPrompt = `${getEnhancedPrompt()}

**🔍 STRUCTURED NOTAM DATA FOR ANALYSIS:**
${notamJsonString}
${truncatedNote}

**📋 DELIVER OPERATIONAL BRIEFING FOR ${icaoCode}:**
Analyze the above NOTAMs and provide your professional operational assessment for the next ${timeDescription}:
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
                        content: `You are an expert aviation operations analyst with 20+ years of experience in flight operations, dispatch, and airport operations. Your role is to provide precise, time-specific operational briefings that help aviation professionals make informed decisions. You understand the operational significance of different NOTAM types and can prioritize information by real-world impact on flight operations.`
                    },
                    {
                        role: 'user', 
                        content: enhancedPrompt
                    }
                ],
                temperature: 0.1, // Consistent, factual responses
                max_tokens: 1500, // Adequate for detailed analysis
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
        
        // Enhanced formatting with better visual hierarchy
        return rawContent
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/🔴/g, '<span style="color: #e74c3c; font-weight: bold;">🔴</span>')
            .replace(/🟡/g, '<span style="color: #f39c12; font-weight: bold;">🟡</span>')
            .replace(/🟢/g, '<span style="color: #27ae60; font-weight: bold;">🟢</span>')
            .replace(/⏰/g, '<span style="color: #3498db; font-weight: bold;">⏰</span>')
            .replace(/📋/g, '<span style="color: #8e44ad; font-weight: bold;">📋</span>')
            .replace(/• /g, '• ');
        
    } catch (error) {
        console.error('Groq API Error:', error);
        throw new Error(`Failed to generate AI summary: ${error.message}`);
    }
};

// **NEW: Enhanced NOTAM categorization function**
function categorizeNotam(rawText, parsed) {
    const text = rawText.toUpperCase();
    const body = (parsed?.body || rawText).toUpperCase();
    
    // Primary category detection
    let primary = 'ADVISORY';
    let severity = 'LOW';
    let impact = 'MINIMAL';
    let systems = [];
    
    // Runway operations (CRITICAL)
    if (/RWY.*CLSD|RUNWAY.*CLOSED|RWY.*OUT.*SERVICE/i.test(text)) {
        primary = 'RUNWAY_CLOSURE';
        severity = 'CRITICAL';
        impact = 'HIGH';
        systems.push('RUNWAY');
    }
    
    // Navigation aids (OPERATIONAL/CRITICAL)
    if (/ILS.*U\/S|GPS.*U\/S|LOCALIZER.*U\/S|GLIDESLOPE.*U\/S/i.test(text)) {
        primary = 'NAVIGATION';
        severity = /ILS/i.test(text) ? 'CRITICAL' : 'OPERATIONAL';
        impact = 'HIGH';
        systems.push('ILS', 'NAVIGATION');
    }
    
    // Taxiway restrictions (OPERATIONAL)
    if (/TWY.*CLSD|TAXIWAY.*CLOSED/i.test(text)) {
        primary = 'TAXIWAY';
        severity = 'OPERATIONAL';
        impact = 'MEDIUM';
        systems.push('GROUND_MOVEMENT');
    }
    
    // Airspace (OPERATIONAL/CRITICAL)
    if (/AIRSPACE.*RESTRICTED|TFR|TEMPORARY.*FLIGHT.*RESTRICTION/i.test(text)) {
        primary = 'AIRSPACE';
        severity = 'OPERATIONAL';
        impact = 'MEDIUM';
        systems.push('AIRSPACE');
    }
    
    return {
        primary,
        severity,
        impact,
        systems
    };
}
