// Multi-provider AI API with smart fallbacks

const AI_PROVIDERS = {
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
            }))
        }),
        extractResponse: (data) => data.content[0].text
    },
    
    gemini: {
        name: "Gemini 1.5 Pro",
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
                    temperature: 0.1
                }
            };
        },
        extractResponse: (data) => data.candidates[0].content.parts[0].text,
        urlWithKey: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`
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
            temperature: 0.1
        }),
        extractResponse: (data) => data.choices[0].message.content
    },
    
    cohere: {
        name: "Command R+",
        maxTokens: 128000,
        responseTokens: 4096,
        apiUrl: "https://api.cohere.ai/v1/chat",
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }),
        formatRequest: (messages, maxTokens) => {
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessage = messages.find(m => m.role === 'user');
            
            return {
                model: "command-r-plus",
                message: userMessage.content,
                preamble: systemMessage?.content,
                max_tokens: Math.min(maxTokens, 4096),
                temperature: 0.1
            };
        },
        extractResponse: (data) => data.text
    }
};

export { AI_PROVIDERS };