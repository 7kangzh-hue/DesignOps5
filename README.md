<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1PWgEI1izjpz5iimq2wksWi_0xPpT6xCU

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure AI services:
   - Copy the environment template:
     ```bash
     cp .env.example .env.local
     ```
   - Edit `.env.local` and add your API keys:
     - `VITE_GEMINI_API_KEY`: Your Google Gemini API key
     - `VITE_DEEPSEEK_API_KEY`: Your DeepSeek API key

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## AI Services Configuration

This app supports dual AI providers:

- **Google Gemini**: Professional AI service, requires VPN in some regions
- **DeepSeek**: Free AI service, accessible without VPN

You can switch between providers in the app's Settings page. Both services need to be configured in `.env.local` for the switching feature to work properly.

For detailed configuration instructions, see [ENV_SETUP.md](ENV_SETUP.md).

## Features

- **Dual AI Provider Support**: Switch between Gemini and DeepSeek
- **Weekly Report Generation**: AI-powered weekly reports
- **Presentation Suggestions**: Generate meeting presentation scripts
- **Real-time Switching**: Change AI providers without refreshing
- **Debug Logging**: Detailed console logs for troubleshooting

## Deployment

See [ENV_SETUP.md](ENV_SETUP.md) for deployment instructions on:
- GitHub Actions
- Vercel
- Other hosting platforms
