# Custom Model Configuration Guide

This guide explains how to configure and use custom AI models with the Gmail AI Unsubscriber.

## Currently Supported Providers

### 1. OpenAI Models
- **Default:** `gpt-3.5-turbo`
- **Alternatives:** `gpt-4`, `gpt-4-turbo`, `gpt-4o`, `gpt-4o-mini`

### 2. Anthropic Claude Models  
- **Default:** `claude-3-5-sonnet-20241022`
- **Alternatives:** `claude-3-opus-20240229`, `claude-3-haiku-20240307`

### 3. Custom/Local Models
- **Ollama** (local models)
- **OpenAI-compatible APIs** (like Together AI, Groq, etc.)

## Configuration Options

### Option 1: Change OpenAI Model (Easiest)

Add to your `.env` file:
```bash
# Use a different OpenAI model
OPENAI_MODEL=gpt-4o-mini
# or
OPENAI_MODEL=gpt-4-turbo
```

### Option 2: Use Anthropic Claude

Add to your `.env` file:
```bash
# Enable Claude for email analysis
USE_CLAUDE_FOR_ANALYSIS=true
CLAUDE_MODEL=claude-3-haiku-20240307
```

### Option 3: Custom OpenAI-Compatible API

For providers like Together AI, Groq, or local models:
```bash
# Custom API endpoint
OPENAI_API_BASE=https://api.together.xyz/v1
OPENAI_API_KEY=your_together_api_key
OPENAI_MODEL=meta-llama/Llama-2-70b-chat-hf

# Or for Groq
OPENAI_API_BASE=https://api.groq.com/openai/v1
OPENAI_API_KEY=your_groq_api_key
OPENAI_MODEL=llama3-70b-8192
```

### Option 4: Local Ollama Models

```bash
# Use local Ollama
OPENAI_API_BASE=http://localhost:11434/v1
OPENAI_API_KEY=ollama  # Can be anything for local
OPENAI_MODEL=llama3.1:8b
```

## Model Performance Recommendations

### For Email Analysis (Speed + Cost)
1. **Best Balance:** `gpt-4o-mini` - Fast, cheap, accurate
2. **Budget Option:** `claude-3-haiku` - Very fast and cheap
3. **High Accuracy:** `gpt-4o` - Best accuracy, more expensive
4. **Local Option:** `llama3.1:8b` via Ollama - Free but requires setup

### For Unsubscribe Automation (Accuracy + Reasoning)
1. **Best:** `claude-3-5-sonnet` - Excellent at web automation
2. **Alternative:** `gpt-4o` - Good reasoning capabilities
3. **Budget:** `claude-3-haiku` - Faster, less accurate

## Setup Instructions

### 1. Using a Different OpenAI Model

Simply update your `.env` file:
```bash
OPENAI_MODEL=gpt-4o-mini
```

Restart the application. No code changes needed!

### 2. Setting Up Ollama (Local Models)

1. Install Ollama: https://ollama.ai/
2. Pull a model: `ollama pull llama3.1:8b`
3. Start Ollama: `ollama serve`
4. Update `.env`:
```bash
OPENAI_API_BASE=http://localhost:11434/v1
OPENAI_API_KEY=ollama
OPENAI_MODEL=llama3.1:8b
```

### 3. Using Together AI

1. Sign up at https://together.ai/
2. Get API key
3. Update `.env`:
```bash
OPENAI_API_BASE=https://api.together.xyz/v1
OPENAI_API_KEY=your_together_api_key
OPENAI_MODEL=meta-llama/Llama-2-70b-chat-hf
```

### 4. Using Groq

1. Sign up at https://groq.com/
2. Get API key
3. Update `.env`:
```bash
OPENAI_API_BASE=https://api.groq.com/openai/v1
OPENAI_API_KEY=your_groq_api_key
OPENAI_MODEL=llama3-70b-8192
```

## Available Models by Provider

### OpenAI
- `gpt-4o` - Latest, most capable
- `gpt-4o-mini` - Fast and cheap version of GPT-4o
- `gpt-4-turbo` - Previous generation, still very good
- `gpt-3.5-turbo` - Fastest, cheapest

### Anthropic Claude
- `claude-3-5-sonnet-20241022` - Latest, best reasoning
- `claude-3-opus-20240229` - Most capable, expensive
- `claude-3-haiku-20240307` - Fastest, cheapest

### Together AI (Popular Models)
- `meta-llama/Llama-2-70b-chat-hf`
- `mistralai/Mixtral-8x7B-Instruct-v0.1`
- `NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO`

### Groq (Ultra-fast inference)
- `llama3-70b-8192`
- `llama3-8b-8192`
- `mixtral-8x7b-32768`

### Ollama (Local)
- `llama3.1:8b`, `llama3.1:70b`
- `mistral:7b`
- `codellama:13b`
- `phi3:mini`

## Troubleshooting

### Common Issues

1. **API Key not working**
   - Check if the key is correct
   - Verify the provider supports the model name
   - Check if you have credits/quota

2. **Model not found**
   - Verify the exact model name with the provider
   - Some providers use different naming conventions

3. **Slow responses**
   - Try a smaller/faster model
   - Check your internet connection
   - For local models, ensure sufficient RAM/GPU

4. **Rate limits**
   - The app has built-in rate limiting
   - Consider upgrading your API plan
   - Use multiple API keys (not implemented yet)

### Model Testing

To test a model configuration:

1. Update your `.env` file
2. Restart the app: `npm start`
3. Try scanning a small batch of emails
4. Check the console for any errors
5. Monitor response quality and speed

## Cost Considerations

### Approximate costs per 1000 emails analyzed:

- **GPT-4o-mini:** ~$0.01-0.02
- **Claude-3-haiku:** ~$0.01-0.02  
- **GPT-3.5-turbo:** ~$0.005-0.01
- **GPT-4o:** ~$0.10-0.20
- **Claude-3-sonnet:** ~$0.15-0.30
- **Local models:** Free (after setup)

## Performance Tips

1. **Use preprocessing:** The app already filters obvious junk without AI
2. **Enable caching:** Results are cached to avoid repeat analysis
3. **Batch processing:** The app processes emails in batches
4. **Choose appropriate models:** Balance cost, speed, and accuracy for your needs

## Need Help?

Check the application logs for detailed error messages. Most configuration issues will show up in the console when you start the app.
