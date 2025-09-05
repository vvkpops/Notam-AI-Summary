// Enhanced config with multiple AI providers
export const FAA_CLIENT_ID = process.env.VITE_FAA_CLIENT_ID || '6f4bcfb132e24eb7a9be019a67cbd9fd';
export const FAA_CLIENT_SECRET = process.env.VITE_FAA_CLIENT_SECRET || 'E3CeB511DcA94733A9103F215f5c7efb';

// AI Provider API Keys
export const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY || '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';
export const CLAUDE_API_KEY = process.env.VITE_CLAUDE_API_KEY || '';
export const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || '';
export const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY || '';
export const COHERE_API_KEY = process.env.VITE_COHERE_API_KEY || '';

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
        url: 'http://localhost:3001/proxy?url=',
        type: 'direct'
    }
};