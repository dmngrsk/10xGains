# Tech Stack - 10xGains

## Frontend
- Angular 19: Main framework for application development.
- Tailwind CSS 4: For flexible styling.
- Angular Material Design 3: Prebuilt UI component library.

## Backend
- Azure Functions (Node.js 22, Flex Consumption): Hosts the custom REST API, a Hono application in `apps/api`.
- Supabase: PostgreSQL database and authentication.

## AI
- OpenRouter API: Cost-effective AI-driven training suggestions.

## CI/CD and Hosting
- GitHub Actions: For CI/CD pipelines.
- Azure Static Web Apps: Frontend hosting with free tier, custom domain support, and global CDN.
- Azure Functions: API hosting, deployed via OIDC from GitHub Actions. 
