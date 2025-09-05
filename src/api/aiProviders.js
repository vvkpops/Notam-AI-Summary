// Multi-provider AI API with Google Gemini as primary

const AI_PROVIDERS = {
    gemini: {
        name: "Google Gemini Pro",
        maxTokens: 1000000,
        responseTokens: 8192,
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
        headers: (apiKey) => ({
            'Content-Type': 'application/json'
        }),
        formatRequest: (messages, maxTokens) => {
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessage = messages.find(m => m.role === 'user');
            
            return {
                contents: [{
                    parts: [{
                        text: systemMessage ? `${systemMessage.content}\n\n${userMessage.content}` : userMessage.content
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: Math.min(maxTokens, 8192),
                    temperature: 0.05, // Very low for precise technical details
                    topP: 0.8,
                    topK: 40
                }
            };
        },
        extractResponse: (data) => {
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Invalid Gemini response structure');
            }
            return data.candidates[0].content.parts[0].text;
        },
        urlWithKey: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`
    },
    
    claude: {
        name: "Claude 3.5 Sonnet",
        maxTokens: 200000,
        responseTokens: 8192,
        apiUrl: "https://api.anthropic.com/v1/messages",
        headers: (apiKey) => ({
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        }),
        formatRequest: (messages, maxTokens) => ({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: Math.min(maxTokens, 8192),
            messages: messages.map(msg => ({
                role: msg.role === 'system' ? 'user' : msg.role,
                content: msg.role === 'system' ? `System: ${msg.content}` : msg.content
            })),
            temperature: 0.05
        }),
        extractResponse: (data) => data.content[0].text
    },
    
    openai: {
        name: "GPT-4o-mini",
        maxTokens: 128000,
        responseTokens: 4096,
        apiUrl: "https://api.openai.com/v1/chat/completions",
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }),
        formatRequest: (messages, maxTokens) => ({
            model: "gpt-4o-mini",
            messages: messages,
            max_tokens: Math.min(maxTokens, 4096),
            temperature: 0.05
        }),
        extractResponse: (data) => data.choices[0].message.content
    },
    
    groq: {
        name: "Llama 3.3 70B",
        maxTokens: 6000,
        responseTokens: 1000,
        apiUrl: "https://api.groq.com/openai/v1/chat/completions",
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }),
        formatRequest: (messages, maxTokens) => ({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            max_tokens: Math.min(maxTokens, 1000),
            temperature: 0.05
        }),
        extractResponse: (data) => data.choices[0].message.content
    }
};

export { AI_PROVIDERS };