import { FAA_CLIENT_ID, FAA_CLIENT_SECRET, PROXY_CONFIGS } from '../config';

/**
 * Parses a NOTAM from the NAV CANADA API into a format consistent with the FAA API.
 * This ensures the rest of the application can handle the data uniformly.
 * @param {object} notam - The raw NOTAM object from the NAV CANADA API.
 * @returns {object} A formatted NOTAM object.
 */
function parseCanadianNotam(notam) {
    let rawText = 'Full NOTAM text not available from source.';
    try {
        // NAV CANADA nests the raw NOTAM inside a JSON string in the 'text' field.
        if (typeof notam.text === 'string') {
            const parsedText = JSON.parse(notam.text);
            rawText = parsedText.raw?.replace(/\\n/g, '\n') || notam.text;
        }
    } catch (e) {
        console.warn(`Could not parse nested JSON for Canadian NOTAM: ${notam.pk}`);
        if (typeof notam.text === 'string') rawText = notam.text;
    }

    // Create a structure that mimics the FAA's GeoJSON format for consistency.
    return {
        properties: {
            notamNumber: notam.notam_id || 'N/A',
            text: rawText,
            effectiveStart: notam.startValidity,
            effectiveEnd: notam.endValidity,
            source: 'NAV CANADA' // Add source for clarity
        }
    };
}


export const fetchNotams = async ({ icaoCode, notamType, classification, featureType, selectedProxy, customProxyUrl }) => {
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
        // NAV CANADA doesn't require API keys, so we use simpler headers.
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

        // Parse and return the Canadian NOTAMs in a consistent format
        return navNotams.map(parseCanadianNotam);
    }

    // --- 3. If not Canadian or FAA returned results, return FAA data ---
    if (faaData.error) {
        throw new Error(`FAA API Error (${faaData.status || 'N/A'}): ${faaData.error} - ${faaData.message || 'No message.'}`);
    }

    console.log(`✅ Found ${faaItems.length} NOTAMs from FAA for ${icaoCode}`);
    return faaItems;
};
