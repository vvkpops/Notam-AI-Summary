// Safely access Vercel environment variables with fallback for local development
export const FAA_CLIENT_ID = import.meta.env.VITE_FAA_CLIENT_ID || '6f4bcfb132e24eb7a9be019a67cbd9fd';
export const FAA_CLIENT_SECRET = import.meta.env.VITE_FAA_CLIENT_SECRET || 'E3CeB511DcA94733A9103F215f5c7efb';
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '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';

// CORS Proxy configurations
export const PROXY_CONFIGS = {
    allorigins: {
        url: 'https://api.allorigins.win/get?url=',
        type: 'json'
    },
    corsproxy: {
        url: 'https://corsproxy.io/?',
        type: 'direct'
    },
    custom: {
        url: 'http://localhost:3001/proxy?url=', // Example for local proxy server
        type: 'direct'
    }
};