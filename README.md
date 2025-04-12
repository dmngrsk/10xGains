# 10xGains
![10xGains Banner](https://i.imgur.com/0azmM90.png)

## Table of Contents
- [Project Name](#project-name)
- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Name
**10xGains**

## Project Description
10xGains is a streamlined platform designed to lower the entry barrier for powerlifting and weightlifting. The application enables users to create, customize, and track personalized training plans with AI-driven suggestions, ensuring safe and effective workout routines. Key features include secure user registration/login, flexible training plan creation, active workout session tracking, and comprehensive workout history.

## Tech Stack
- **Frontend**: Angular 19, Angular Material Design 3, Tailwind CSS 4
- **Backend**: Supabase (for PostgreSQL and authentication)
- **AI Integration**: Perplexity API (Sonar model) for AI-driven training plan suggestions
- **CI/CD and Hosting**: GitHub Actions, Azure Static Web Apps

## Getting Started Locally
### Prerequisites
- **Node.js**: Version specified in `.nvmrc` (22.14.0)
- **Yarn**: Please use Yarn for managing packages

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/dmngrsk/10xGains.git
   ```
2. Navigate to the project directory:
   ```bash
   cd 10xGains
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
4. Start the development server:
   ```bash
   yarn start
   ```
5. Open your browser and navigate to `http://localhost:4200`

## Available Scripts
In the project directory, you can run:
- `ng serve` or `yarn start`: Runs the app in development mode.
- `ng build` or `yarn build`: Builds the app for production.
- `ng lint` or `yarn lint`: Lints and fixes the code.
- `yarn test`: Runs tests using Vitest.
- `yarn test:coverage`: Generates a test coverage report.
- `yarn watch`: Rebuilds the project on file changes.

## Project Scope
The current MVP scope includes:
- **User Account System**: Secure user registration and login.
- **Training Plan Creation**: Ability to create personalized training plans with both predefined and custom exercises, incorporating manual adjustments and automated weight progression.
- **Active Workout Session Tracking**: Real-time tracking of exercises with clickable set markers and detailed editing capabilities.
- **Workout History**: Chronological record of past workout sessions.
- **AI-Driven Training Suggestions**: Integrated chat tool offering tailored training plan suggestions and educational resources.

## Project Status
The project is currently in early development (MVP stage) with version `0.1.0`. Features are actively being developed and refined.

## License
This project is licensed under the MIT License. 
