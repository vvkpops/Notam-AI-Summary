import { FAA_CLIENT_ID, FAA_CLIENT_SECRET, PROXY_CONFIGS } from '../config';

export const fetchNotams = async ({ icaoCode, notamType, classification, featureType, selectedProxy, customProxyUrl }) => {
    try {
        // Learning from your notams.js, the FAA API works best without date parameters.
        // This defaults to all active NOTAMs.
        const params = new URLSearchParams({
            responseFormat: 'geoJson',
            icaoLocation: icaoCode,
            pageSize: 1000,
            pageNum: 1,
            sortBy: 'effectiveStartDate',
            sortOrder: 'Asc'
        });

        // Add optional filters
        if (notamType) params.append('notamType', notamType);
        if (classification) params.append('classification', classification);
        if (featureType) params.append('featureType', featureType);

        const faaApiUrl = `https://external-api.faa.gov/notamapi/v1/notams?${params.toString()}`;
        
        let proxyConfig = PROXY_CONFIGS[selectedProxy];
        if (selectedProxy === 'custom' && customProxyUrl) {
            proxyConfig = {
                url: customProxyUrl.endsWith('/') ? `${customProxyUrl}proxy?url=` : `${customProxyUrl}/proxy?url=`,
                type: 'direct'
            };
        }

        let proxyUrl, fetchOptions;

        if (proxyConfig.type === 'json') {
            proxyUrl = proxyConfig.url + encodeURIComponent(faaApiUrl);
            fetchOptions = { method: 'GET', headers: { 'Accept': 'application/json' } };
        } else {
            proxyUrl = proxyConfig.url + encodeURIComponent(faaApiUrl);
            fetchOptions = {
                method: 'GET',
                headers: {
                    'client_id': FAA_CLIENT_ID,
                    'client_secret': FAA_CLIENT_SECRET,
                    'Accept': 'application/json'
                }
            };
        }

        console.log('Fetching NOTAMs via proxy:', proxyUrl);
        const response = await fetch(proxyUrl, fetchOptions);

        if (!response.ok) {
            throw new Error(`Proxy request failed (${response.status}): ${await response.text()}`);
        }

        let data;
        if (proxyConfig.type === 'json') {
            const proxyResponse = await response.json();
            if (!proxyResponse.contents) {
                 throw new Error(`Proxy response error from ${selectedProxy}: ${JSON.stringify(proxyResponse)}`);
            }
            data = JSON.parse(proxyResponse.contents);
        } else {
            data = await response.json();
        }

        if (data.error) {
            throw new Error(`FAA API Error (${data.status || 'N/A'}): ${data.error} - ${data.message || 'No message.'}`);
        }

        console.log('FAA API Response via proxy:', data);
        return data.items || [];
        
    } catch (error) {
        console.error('Proxy API Error:', error);
        throw new Error(`Failed to fetch NOTAMs via ${selectedProxy} proxy: ${error.message}`);
    }
};