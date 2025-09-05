import { FAA_CLIENT_ID, FAA_CLIENT_SECRET, PROXY_CONFIGS } from '../config';

/**
 * Parses a NOTAM from the NAV CANADA API into a format consistent with the FAA API.
 */
function parseCanadianNotam(notam) {
    let rawText = 'Full NOTAM text not available from source.';
    try {
        if (typeof notam.text === 'string') {
            const parsedText = JSON.parse(notam.text);
            rawText = parsedText.raw?.replace(/\\n/g, '\n') || notam.text;
        }
    } catch (e) {
        console.warn(`Could not parse nested JSON for Canadian NOTAM: ${notam.pk}`);
        if (typeof notam.text === 'string') rawText = notam.text;
    }

    return {
        properties: {
            notamNumber: notam.notam_id || 'N/A',
            text: rawText,
            effectiveStart: notam.startValidity,
            effectiveEnd: notam.endValidity,
            source: 'NAV CANADA'
        }
    };
}

/**
 * Enhanced ICAO code validation and normalization
 */
export const validateAndNormalizeIcao = (icaoCode) => {
    if (!icaoCode || typeof icaoCode !== 'string') {
        throw new Error('ICAO code is required');
    }

    // Remove whitespace and convert to uppercase
    const normalized = icaoCode.trim().toUpperCase();
    
    // Validate format: exactly 4 alphanumeric characters
    if (!/^[A-Z0-9]{4}$/.test(normalized)) {
        throw new Error(`Invalid ICAO code format: "${icaoCode}". Must be exactly 4 alphanumeric characters (e.g., KJFK, CYYZ, EGLL)`);
    }

    console.log(`✅ ICAO normalized: "${icaoCode}" → "${normalized}"`);
    return normalized;
};

/**
 * Enhanced time filtering utility functions
 */
export const createTimeWindow = (timeValue, timeUnit) => {
    const now = new Date();
    const hours = timeUnit === 'days' ? timeValue * 24 : timeValue;
    const endTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    
    return {
        start: now,
        end: endTime,
        hours: hours
    };
};

export const isNotamActiveInWindow = (notam, timeWindow) => {
    const props = notam.properties;
    if (!props) return false;

    // Parse NOTAM dates with enhanced validation
    const notamStart = props.effectiveStart ? new Date(props.effectiveStart) : null;
    const notamEnd = props.effectiveEnd ? new Date(props.effectiveEnd) : null;

    // Handle permanent NOTAMs
    if (!notamEnd || 
        props.effectiveEnd === 'PERM' || 
        props.effectiveEnd === 'PERMANENT' ||
        isNaN(notamEnd?.getTime())) {
        // If NOTAM starts before our window ends, it's active
        return !notamStart || notamStart <= timeWindow.end;
    }

    // Check if NOTAM overlaps with our time window
    // NOTAM is active if: notam_start <= window_end AND notam_end >= window_start
    const isActive = (!notamStart || notamStart <= timeWindow.end) && 
                    (notamEnd >= timeWindow.start);

    return isActive;
};

/**
 * ENHANCED NOTAM fetch with bulletproof ICAO handling and 50 NOTAM limit
 */
export const fetchNotams = async ({ 
    icaoCode, 
    notamType, 
    classification, 
    featureType, 
    selectedProxy, 
    customProxyUrl,
    timeValue = 24,
    timeUnit = 'hours',
    enableTimeFiltering = true 
}) => {
    // **CRITICAL FIX: Validate and normalize ICAO code first**
    const normalizedIcao = validateAndNormalizeIcao(icaoCode);
    
    // Create time window for filtering
    const timeWindow = createTimeWindow(timeValue, timeUnit);
    console.log(`🕐 Time window: ${timeWindow.start.toISOString()} to ${timeWindow.end.toISOString()} (${timeWindow.hours}h)`);

    // --- 1. PRIMARY SOURCE: ALWAYS try FAA first for ALL ICAO codes ---
    // **OPTIMIZED: Request exactly 50 NOTAMs for performance**
    const faaParams = new URLSearchParams({
        responseFormat: 'geoJson',
        icaoLocation: normalizedIcao,
        pageSize: 50, // **FIXED: Limit to 50 NOTAMs max**
        pageNum: 1,
        sortBy: 'effectiveStartDate',
        sortOrder: 'Asc'
    });
    const faaApiUrl = `https://external-api.faa.gov/notamapi/v1/notams?${faaParams.toString()}`;
    
    let proxyConfig = PROXY_CONFIGS[selectedProxy];
    if (selectedProxy === 'custom' && customProxyUrl) {
        proxyConfig = {
            url: customProxyUrl.endsWith('/') ? `${customProxyUrl}proxy?url=` : `${customProxyUrl}/proxy?url=`,
            type: 'direct'
        };
    }
    
    let proxyUrl = proxyConfig.url + encodeURIComponent(faaApiUrl);
    let fetchOptions = {
        method: 'GET',
        headers: {
            'client_id': FAA_CLIENT_ID,
            'client_secret': FAA_CLIENT_SECRET,
            'Accept': 'application/json'
        }
    };

    console.log(`📡 Fetching max 50 NOTAMs from FAA for ${normalizedIcao}:`, proxyUrl);
    
    let faaItems = [];
    let faaError = null;
    
    try {
        const faaResponse = await fetch(proxyUrl, fetchOptions);
        
        if (!faaResponse.ok) {
            throw new Error(`FAA API HTTP Error: ${faaResponse.status} ${faaResponse.statusText}`);
        }
        
        const faaData = await faaResponse.json();
        
        // Check for API-level errors
        if (faaData.error) {
            throw new Error(`FAA API Error (${faaData.status || 'N/A'}): ${faaData.error} - ${faaData.message || 'No message.'}`);
        }
        
        faaItems = faaData.items || [];
        
        // **SAFETY: Ensure we never exceed 50 NOTAMs**
        if (faaItems.length > 50) {
            console.warn(`⚠️ API returned ${faaItems.length} NOTAMs, limiting to 50 for performance`);
            faaItems = faaItems.slice(0, 50);
        }
        
        console.log(`✅ FAA returned ${faaItems.length} NOTAMs for ${normalizedIcao} (max 50 limit enforced)`);
        
    } catch (error) {
        faaError = error;
        console.warn(`❌ FAA fetch failed for ${normalizedIcao}:`, error.message);
    }

    // --- 2. FALLBACK LOGIC: Only use NAV CANADA if FAA returns ZERO results ---
    if (faaItems.length === 0) {
        console.log(`🔄 FAA returned zero NOTAMs for ${normalizedIcao}. Attempting NAV CANADA fallback...`);
        
        try {
            const navCanadaUrl = `https://plan.navcanada.ca/weather/api/alpha/?site=${normalizedIcao}&alpha=notam`;
            proxyUrl = proxyConfig.url + encodeURIComponent(navCanadaUrl);
            fetchOptions = { method: 'GET', headers: { 'Accept': 'application/json' } };

            console.log(`🍁 Fetching from NAV CANADA for ${normalizedIcao}:`, proxyUrl);
            const navResponse = await fetch(proxyUrl, fetchOptions);
            
            if (!navResponse.ok) {
                throw new Error(`NAV CANADA HTTP Error: ${navResponse.status} ${navResponse.statusText}`);
            }

            let navData;
            if (proxyConfig.type === 'json') {
                const proxyResponse = await navResponse.json();
                navData = JSON.parse(proxyResponse.contents);
            } else {
                navData = await navResponse.json();
            }

            const navNotams = navData?.data || [];
            
            // **SAFETY: Limit NAV CANADA results to 50 as well**
            const limitedNavNotams = navNotams.slice(0, 50);
            console.log(`✅ NAV CANADA returned ${navNotams.length} NOTAMs, using ${limitedNavNotams.length} (max 50 limit enforced)`);
            
            if (limitedNavNotams.length > 0) {
                faaItems = limitedNavNotams.map(parseCanadianNotam);
                console.log(`🔄 Using NAV CANADA data as fallback for ${normalizedIcao}`);
            } else {
                console.log(`ℹ️ NAV CANADA also returned zero NOTAMs for ${normalizedIcao}`);
            }

        } catch (navError) {
            console.warn(`❌ NAV CANADA fallback also failed for ${normalizedIcao}:`, navError.message);
            
            // If both FAA and NAV CANADA failed, throw the original FAA error
            if (faaError && navError) {
                throw new Error(`Both data sources failed. FAA: ${faaError.message}. NAV CANADA: ${navError.message}`);
            }
        }
    }

    // If we still have no NOTAMs and there was an FAA error, throw it
    if (faaItems.length === 0 && faaError) {
        throw faaError;
    }

    console.log(`📊 Total NOTAMs retrieved for ${normalizedIcao}: ${faaItems.length}/50 max (Source: ${faaItems[0]?.properties?.source || 'FAA'})`);

    // --- 3. Apply time filtering if enabled ---
    if (enableTimeFiltering && faaItems.length > 0) {
        const filteredItems = faaItems.filter(notam => {
            const isActive = isNotamActiveInWindow(notam, timeWindow);
            if (!isActive) {
                console.log(`⏰ Filtered out NOTAM ${notam.properties?.notamNumber || 'N/A'} - outside time window`);
            }
            return isActive;
        });
        
        console.log(`🎯 Time filtering: ${faaItems.length} → ${filteredItems.length} NOTAMs (${timeWindow.hours}h window, 50 max)`);
        
        // Add debug info to each NOTAM
        filteredItems.forEach(notam => {
            notam._timeFilterInfo = {
                windowStart: timeWindow.start.toISOString(),
                windowEnd: timeWindow.end.toISOString(),
                notamStart: notam.properties?.effectiveStart,
                notamEnd: notam.properties?.effectiveEnd
            };
        });
        
        return filteredItems;
    }

    return faaItems;
};
