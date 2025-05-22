# Product Requirements Document (PRD) - 10xGains

## 1. Product Overview
The 10xGains product is a streamlined platform designed to lower the entry barrier for individuals interested in powerlifting and weightlifting. It offers an intuitive interface for creating, customizing, and tracking personalized training plans. The platform combines manual configuration with AI-driven suggestions to ensure that users can quickly set up safe and effective workout routines.

Designed as a cost-effective solution, the MVP focuses on usability, reliability, and flexibility.

## 2. User Problem
Many users face an overwhelming number of available training plans, which creates confusion and inhibits their ability to start powerlifting or weightlifting routines. The complexity of existing options creates a significant entry barrier. 10xGains addresses this problem by providing a simplified, user-friendly system that guides users to create, adjust, and monitor personalized training plans, ultimately helping them achieve their fitness goals.

## 3. Functional Requirements
1. User Account System:
   - Enable secure user registration and login.
   - Protect user data with proper authentication before accessing personal training plans.

2. Training Plan Creation:
   - Allow users to create personalized training plans with both predefined and custom exercises.
   - Provide functionality to specify exercise parameters including the number of sets, reps, and weight modifiers.
   - Support manual adjustments alongside an automated weight progression logic (increase weight by a constant value defined in the exercise by the user upon successful completion of all sets and apply a 10% deload after three consecutive failures).

3. Active Workout Session Tracking:
   - Display a simple, reorderable list of exercises during an active workout session.
   - Provide an intuitive set tracking mechanism where each exercise's sets are displayed in a row as clickable bubbles, enabling single-tap progress marking.
   - Offer pop-up dialogues for detailed editing of exercise parameters (e.g., sets, reps, and weights).
   - Display a FAB for workout completion, which in turn marks the session as complete and automatically triggers weight progression and new training session creation logic.

4. Workout History:
   - Present a clear summary of past workout sessions, including details such as exercises performed, sets, reps, and weight adjustments.
   - Ensure the history is updated in real-time as new sessions are completed.

5. AI Integration:
   - Integrate a chat-based AI tool within the training plan creation view to offer tailored training plan suggestions.
   - Allow users to refine AI suggestions through manual customization.
   - Enable the AI to lookup and embed external educational resources, presenting brief summaries and direct links during the conversation.

## 4. Product Boundaries
MVP Scope:
   - User account system, training plan creation, active workout tracking, workout history, and AI-driven training plan suggestions.
   - Automated weight progression on a per-exercise basis using fixed increments and a 10% deload mechanism.

Exclusions:
   - AI progress tracking features such as monitoring improvements and providing progress-based suggestions.
   - Detailed body metrics tracking (e.g., weight, measurements, body fat percentage calculations).
   - Advanced progress analytics (e.g., visual charts of exercise volume trends).
   - Gamification elements such as in-app achievements or rewards.

## 5. User Stories

US-001: Secure User Registration and Login
- Title: Secure Account Creation and Login
- Description: As a new user, I want to create an account and securely log in so that my training data and plans remain protected.
- Acceptance Criteria:
  - A registration form with necessary fields (e.g., email, password) is provided.
  - Secure authentication is required before accessing personalized content.
  - Proper error messages are displayed for invalid registration or login attempts.
  - We do not use any third-party login services (such as GitHub or Google).
  - Password retrieval via email should be possible.

US-002: Training Plan Creation and Customization
- Title: Create and Customize Training Plan
- Description: As a registered user, I want to create a personalized training plan by adding exercises (both predefined and custom) and specifying parameters like series, reps, and weight modifiers in order to tailor my workout to my needs.
- Acceptance Criteria:
  - Users can add, edit, and remove exercises from their training plan.
  - The interface allows specification of sets, reps, and weight parameters.
  - The system validates all inputs and provides user feedback on errors.
  - Plan modification is not possible without signing in to the system (US-001).

US-003: AI-Driven Training Plan Suggestions and Educational Resources
- Title: Receive AI-Driven Training Suggestions and Access Educational Resources
- Description: As a user, I want to interact with an AI chat tool during training plan creation so that I can receive customized training suggestions and access relevant educational content by looking up publicly available resources on powerlifting and weightlifting.
- Acceptance Criteria:
  - A chat interface integrated into the training plan creation view is available.
  - The AI provides relevant and actionable training suggestions based on user inputs.
  - The AI is capable of looking up publicly available educational resources, providing brief summaries and direct links during the interaction.
  - Users have the ability to edit and refine AI recommendations before finalizing their plan.
  - Querying and using AI suggestions is not possible without signing in to the system (US-001).

US-004: Active Workout Session Tracking
- Title: Track and Manage Active Workout Sessions
- Description: As a user, I want to track my workout session in real-time by marking sets and reps as completed using an intuitive interface with clickable bubbles representing each set, and have the system automatically adjust weights based on my performance, while also allowing manual adjustments.
- Acceptance Criteria:
  - A dynamic list of exercises is displayed for the active session with reorder functionality.
  - Each exercise displays its sets in a row as clickable bubbles, enabling single-tap progress marking.
  - Detailed pop-ups allow users to update set and rep information along with manual weight adjustments.
  - Automated weight progression is applied (increase by a constant value defined in the exercise upon success, 10% deload after three failures).
  - Workout session tracking is not possible without signing in to the system (US-001).

US-005: Workout History Overview
- Title: View Past Workout Sessions
- Description: As a user, I want to review a history of my past workout sessions to monitor my progress and performance over time.
- Acceptance Criteria:
  - A history page displays a chronological list of past sessions with key workout details.
  - Each entry includes information on exercises performed, sets, reps, and weight adjustments.
  - The history updates automatically as new sessions are recorded.
  - Accessing the workout history is not possible without signing in to the system (US-001).

## 6. Success Metrics
- 90% of users should be able to create a personalized training plan that meets their needs.
- 75% of users with a training plan should log their workout sessions on a weekly basis.
- The AI chat feature should provide relevant training suggestions in at least 80% of interactions.
- Automated weight progression and adjustment mechanisms should function accurately, with any errors resolved promptly through testing iterations.