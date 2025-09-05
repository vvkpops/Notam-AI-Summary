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
 * NEW: Time filtering utility functions
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

    // Parse NOTAM dates
    const notamStart = props.effectiveStart ? new Date(props.effectiveStart) : null;
    const notamEnd = props.effectiveEnd ? new Date(props.effectiveEnd) : null;

    // Handle permanent NOTAMs
    if (!notamEnd || props.effectiveEnd === 'PERM' || props.effectiveEnd === 'PERMANENT') {
        // If NOTAM starts before our window ends, it's active
        return !notamStart || notamStart <= timeWindow.end;
    }

    // Check if NOTAM overlaps with our time window
    // NOTAM is active if: notam_start <= window_end AND notam_end >= window_start
    const isActive = (!notamStart || notamStart <= timeWindow.end) && 
                    (notamEnd >= timeWindow.start);

    return isActive;
};

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
    // Create time window for filtering
    const timeWindow = createTimeWindow(timeValue, timeUnit);
    console.log(`🕐 Time window: ${timeWindow.start.toISOString()} to ${timeWindow.end.toISOString()} (${timeWindow.hours}h)`);

    // --- 1. PRIMARY SOURCE: Always try FAA first ---
    const faaParams = new URLSearchParams({
        responseFormat: 'geoJson',
        icaoLocation: icaoCode,
        pageSize: 1000,
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

    console.log('Fetching NOTAMs from FAA:', proxyUrl);
    const faaResponse = await fetch(proxyUrl, fetchOptions);
    const faaData = await faaResponse.json();

    let faaItems = faaData.items || [];

    // --- 2. FALLBACK LOGIC: If Canadian ICAO AND FAA returned zero results, try NAV CANADA ---
    if (icaoCode.startsWith('C') && faaItems.length === 0) {
        console.log(`🍁 FAA returned no results for Canadian ICAO ${icaoCode}. Falling back to NAV CANADA.`);
        
        const navCanadaUrl = `https://plan.navcanada.ca/weather/api/alpha/?site=${icaoCode}&alpha=notam`;
        proxyUrl = proxyConfig.url + encodeURIComponent(navCanadaUrl);
        fetchOptions = { method: 'GET', headers: { 'Accept': 'application/json' } };

        console.log('Fetching from NAV CANADA via proxy:', proxyUrl);
        const navResponse = await fetch(proxyUrl, fetchOptions);
        
        if (!navResponse.ok) {
            throw new Error(`NAV CANADA fallback failed (${navResponse.status}): ${await navResponse.text()}`);
        }

        let navData;
        if (proxyConfig.type === 'json') {
            const proxyResponse = await navResponse.json();
            navData = JSON.parse(proxyResponse.contents);
        } else {
            navData = await navResponse.json();
        }

        const navNotams = navData?.data || [];
        console.log(`✅ Found ${navNotams.length} NOTAMs from NAV CANADA for ${icaoCode}`);
        faaItems = navNotams.map(parseCanadianNotam);
    }

    if (faaData.error) {
        throw new Error(`FAA API Error (${faaData.status || 'N/A'}): ${faaData.error} - ${faaData.message || 'No message.'}`);
    }

    console.log(`✅ Found ${faaItems.length} total NOTAMs from ${faaItems[0]?.properties?.source || 'FAA'} for ${icaoCode}`);

    // --- 3. NEW: Apply time filtering if enabled ---
    if (enableTimeFiltering) {
        const filteredItems = faaItems.filter(notam => isNotamActiveInWindow(notam, timeWindow));
        console.log(`🎯 Time filtering: ${faaItems.length} → ${filteredItems.length} NOTAMs (${timeWindow.hours}h window)`);
        
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