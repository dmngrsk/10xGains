# Comprehensive Test Plan for 10xGains

This document outlines the comprehensive testing strategy for the **10xGains** project. It defines the scope, approach, resources, and schedule of all testing activities to ensure the delivery of a high-quality, stable, and performant Angular application.

(Generated with Google AI Studio)

---

### 1. Introduction and Objectives

**1.1. Project Overview**

10xGains is a modern, single-page web application designed for fitness enthusiasts to create, manage, and track their training plans and workout sessions. The application is built with Angular; the backend API is a Hono application hosted on Azure Functions (`apps/api`), with Supabase providing authentication and the database.

**1.2. Test Objectives**

The primary objectives of the testing process are to:
*   Ensure the application meets all functional requirements and business logic.
*   Guarantee a high level of quality, stability, and reliability across all features.
*   Verify data integrity and consistency between the Angular front-end and the Supabase back-end.
*   Identify and resolve defects early in the development lifecycle.
*   Validate that the application provides a seamless and intuitive user experience across supported platforms.
*   Confirm that the application meets performance, security, and code quality standards.

---

### 2. Scope of Testing

**2.1. In-Scope Features**
The following features and components are within the scope of testing:

*   **User Authentication:**
    *   Welcome screen (auth entry point at `/auth`, choosing between Google and email sign-in)
    *   User Registration (email/password)
    *   User Login (email/password)
    *   Password recovery (request reset link, then change the password from Settings)
    *   Google OAuth sign-in (initiated from the welcome screen) and account linking in Settings
    *   Session Management (including token handling via `auth.interceptor.ts`)
    *   Route Protection (`auth.guard.ts`, `no-auth.guard.ts`)
*   **Plan Management (Full CRUD):**
    *   Listing, creating, updating, and deleting plans.
    *   Managing days within a plan (CRUD).
    *   Managing exercises within a day (CRUD).
    *   Managing sets for each exercise (CRUD).
    *   Drag-and-drop reordering for days, exercises, and sets.
    *   Configuration and updates of exercise progression rules.
    *   Activation of a plan.
    *   Plan note shared across all sessions of the same plan.
*   **Session Tracking:**
    *   Creation of a new session from an active plan.
    *   Real-time tracking of set completion (complete, fail, reset).
    *   Long-press and tap interactions on set bubbles (`long-press.directive.ts`).
    *   Session timer functionality and state management.
    *   Opening the notes dialog from the session view FAB.
    *   Creating, editing, and clearing session notes and plan notes (save on dialog close via 'Save' or backdrop click).
    *   Completion of an active session, triggering backend progression logic.
*   **Session History:**
    *   Three views - calendar, list and notes - chosen from the tab strip, with the last used view remembered between visits.
    *   Viewing a list of completed sessions, which loads a further page each time its end is scrolled to.
    *   Browsing completed sessions by month in the calendar, including days holding more than one session.
    *   Reading back the notes of completed sessions in the notes view, which lists only the sessions carrying one.
    *   Filtering session history by plan and date range, from the filter FAB.
    *   Accessing and editing session notes of completed sessions from the history view, including the note indicator on history entries.
*   **Exercise Progress:**
    *   Weight-over-time chart, scoped to the active plan and the last 3 months by default.
    *   Filtering by training plan (including "All plans", which spans plans) and by date-range preset.
    *   Toggling which exercise series are plotted via the chip row.
    *   Aggregation correctness: top completed set per session, reps of every set (failed ones included).
*   **Home & Settings:**
    *   Dashboard view displaying the current active session or prompts.
    *   User profile management (updating name).
    *   Account management (password change, sign-out).
*   **Core Shared Components & Utilities:**
    *   API services (`api.service.ts`, `plan.service.ts`, etc.) and data mapping logic (`*.mapping.ts`).
    *   Custom form validators and directives.
    *   `KeyedDebouncerService` for API call optimization in the session page.
    *   UI layouts, dialogs, and notice components.
*   **Backend (Azure Functions API, `apps/api`):**
    *   All API handlers for `exercises`, `plans`, `sessions`, `profiles`, and `progress`.
    *   Business logic, including Zod schema validation and the pure services: session creation (`resolveNextPlanDayId`, `cancelOutstandingSessions`, `buildSessionSets`), session completion (`assertSessionCompletable`, `skipPendingSets`, the row-flattening helpers), `resolveExerciseProgressions`, `aggregateExerciseProgress`, and `insertAndNormalizeOrder`. Repositories are I/O only and are covered by the E2E suite against a real database, not by mocked unit tests.
    *   Database interactions, including RPC calls for reordering logic.
*   **Static Code Analysis & Tooling:**
    *   Adherence to ESLint rules enforced by pre-commit hooks.

**2.2. Out-of-Scope Features**

*   **AI-Suggested Training Plans:** While types exist in `api.types.ts`, no implementation is present.
*   **Underlying Frameworks/Libraries:** Testing of Angular, Vitest, Supabase, or other third-party libraries themselves. We will only test our implementation and integration with them.
*   **Exhaustive Performance/Load Testing:** While basic performance benchmarks will be monitored, large-scale load and stress testing is not in the initial scope.
*   **Backend Infrastructure Testing:** Testing the Supabase and Azure infrastructure (e.g., database server uptime) is the responsibility of the cloud providers. We will test the API we build on top of them.

---

### 3. Test Types and Strategy

A multi-layered testing strategy will be employed, leveraging the "Testing Pyramid" model to ensure comprehensive coverage efficiently.

*   **Static Testing:**
    *   **Linting:** ESLint rules defined in `.eslintrc.json` will be enforced automatically via `husky` pre-commit hooks to maintain code consistency and prevent common errors.

*   **Unit Testing (Vitest):**
    *   **Focus:** Isolate and test the smallest parts of the application.
    *   **Targets:** Services, Facades, Mapping Logic, Utilities, Guards, Interceptors, Directives.

*   **Component Testing (Vitest):**
    *   **Focus:** Test individual components in isolation.
    *   **Targets:** All `*.component.ts` files, verifying rendering, event emissions, and user interactions with mocked dependencies.

*   **End-to-End (E2E) Testing (Cypress):**
    *   **Focus:** Simulate real user workflows from start to finish in a browser environment, leveraging a tag-based strategy for environment-specific execution.
    *   **Test Identification:** Tests will be tagged using `@cypress/grep` syntax. Critical smoke tests will be explicitly marked with `{ tags: '@smoke' }`.
    *   **General Feature Tests (Staging Only):** All tests *not* tagged as `@smoke` will run exclusively against the Staging environment. They will ensure deep feature correctness by programmatically creating isolated, **on-the-fly users** for each test run, guaranteeing a clean state and preventing test pollution.
    *   **Smoke Tests (Staging & Production):** All tests tagged as `@smoke` will provide a consistent health check across all environments. These tests will use a single, pre-existing **"Canary User"** to sign in and perform a minimal, non-destructive set of actions to verify core application availability.
    *   **Unified Implementation:** A "smart" custom command (e.g., `cy.login()`) will be implemented. This command will analyze the running test's tags to automatically select the correct login method (Canary User for `@smoke` tests, on-the-fly user for all others).

*   **Performance Testing:**
    *   **Focus:** Monitor and ensure the application is fast and responsive.
    *   **Strategy:** Regularly run Google Lighthouse audits, monitor build budgets in `angular.json`, and analyze component rendering performance.

---

### 4. Key Test Scenarios

This is a non-exhaustive list of high-priority test scenarios. Tests marked "Yes" in the **Smoke Test** column will be implemented with the `{ tags: '@smoke' }` annotation for filtering by `@cypress/grep`.

| Feature Area | Scenario ID | Scenario Description | Priority | **Smoke Test** |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication**<br>*&nbsp;&nbsp;the welcome screen* | AUTH-01 | Choosing "Sign in with email" on the welcome screen opens the login form. | High | No |
| *&nbsp;&nbsp;registration* | AUTH-02 | A new user can register via the email form and is signed in when email verification is disabled. | Critical | No |
|  | AUTH-03 | A user sees a pending verification notice when email verification is enabled. | High | No |
|  | AUTH-04 | A user can confirm their account via the activation-link callback and lands on Home. | Critical | No |
| *&nbsp;&nbsp;signing in* | AUTH-05 | A user can sign in with valid email credentials. | Critical | **Yes** |
|  | AUTH-06 | A user cannot sign in with invalid credentials and sees an error. | High | No |
| *&nbsp;&nbsp;password reset* | AUTH-07 | A user can request a password reset link from the login form. | High | No |
|  | AUTH-08 | A user can change their password after following the reset link and sign back in. | High | No |
| *&nbsp;&nbsp;sessions and access* | AUTH-09 | A user without a valid session (never signed in, or session expired mid-use) is redirected to the welcome screen. | Critical | No |
|  | AUTH-10 | An authenticated user visiting the welcome or login screens is redirected to Home. | High | No |
|  | AUTH-11 | An authenticated user can sign out and is returned to the welcome screen. | High | No |
|  | AUTH-12 | A user cannot access another user's data (RLS check). | Critical | No |
| *&nbsp;&nbsp;Google sign-in* | AUTH-13 | A user can start the Google OAuth flow from the welcome screen. | High | No |
|  | AUTH-14 | A profile is created for a first-time Google user on the OAuth callback. | Critical | No |
|  | AUTH-15 | The existing profile of an auto-linked user is preserved on the OAuth callback. | Critical | No |
| **Plan Management**<br>*&nbsp;&nbsp;the plan list* | PLAN-01 | An authenticated user can create a new plan. | Critical | No |
|  | PLAN-02 | An authenticated user can view and navigate to an existing plan's details page. | Critical | **Yes** |
| *&nbsp;&nbsp;building the structure* | PLAN-03 | In the plan editor, a user can add, edit and delete a new day. | High | No |
|  | PLAN-04 | In the plan editor, a user can add an exercise to a day, edit its progression, and delete it from a day. | High | No |
|  | PLAN-05 | In the plan editor, a user can create a global exercise and add this exercise to a day in a plan. | Medium | No |
|  | PLAN-06 | In the plan editor, a user can add, edit, and delete a set for an exercise. | High | No |
| *&nbsp;&nbsp;ready to activate* | PLAN-07 | A plan cannot be activated while any day has no exercises or any exercise has no sets, and the editor says which. | High | No |
|  | PLAN-08 | A plan cannot be activated while any exercise has no progression rule, and can be once the rule is set. | Medium | No |
| *&nbsp;&nbsp;editing an unused plan* | PLAN-09 | In the plan editor, a user can reorder days and exercises, and the order is saved. Sets are not reorderable. | Medium | No |
|  | PLAN-10 | In the plan editor, a user can step a set's weight up and down inline, and only the settled value is written. | High | No |
| *&nbsp;&nbsp;plan lifecycle* | PLAN-11 | A user can activate a plan, which then correctly appears as the active plan on the home page. | High | No |
|  | PLAN-12 | A user can delete a plan that has not been used in any sessions. | Medium | No |
| *&nbsp;&nbsp;a trained plan* | PLAN-13 | The active plan is read-only until deactivated; once deactivated, a plan with history stays editable but its trained days and exercises can only be archived, not deleted. | High | No |
|  | PLAN-14 | Archiving an exercise removes it from an active plan while the workouts that trained it still render in history. | High | No |
|  | PLAN-15 | Archiving a training day removes it from the plan while the workouts trained from it still name it in history. | High | No |
|  | PLAN-16 | A session is judged against the prescription it was created with, not against a plan weight changed while it was open. | Critical | No |
| **Session Tracking**<br>*&nbsp;&nbsp;recording a workout* | SESS-01 | A user can start a new session from an active plan on the home page. | Critical | **Yes** |
|  | SESS-02 | A user can tap a set bubble to cycle through its states (Pending -> Completed -> Failed -> Pending). | Critical | No |
|  | SESS-03 | A user can long-press a set bubble to open the edit dialog and successfully update its details. | High | No |
|  | SESS-04 | The session timer starts and updates correctly after the first set interaction. | Critical | No |
| *&nbsp;&nbsp;warmup sets* | SESS-05 | A user can expand ephemeral warmup sets from the warmup toggle and dismiss them one by one, without any network traffic. | Medium | No |
|  | SESS-06 | Clicking a working set dismisses that exercise's warmup UI, and the dismissal persists per exercise across a reload. | Medium | No |
| *&nbsp;&nbsp;completing a session* | SESS-07 | A user can successfully complete a session, after which a new session is available and they are redirected. | Critical | No |
|  | SESS-08 | A user is prompted with a confirmation dialog if they try to complete a session with unfinished sets. | High | No |
| *&nbsp;&nbsp;notes* | SESS-09 | A user can open the notes dialog via the FAB in the session view, enter a session note, close the dialog with 'Save', and see the note again after reopening. | High | No |
|  | SESS-10 | The notes dialog is modal: a click outside neither closes it nor saves, and 'Cancel' discards the entered text. | High | No |
|  | SESS-11 | A plan note entered in one session is displayed when the notes dialog is opened in another session of the same plan. | High | No |
|  | SESS-12 | A plan note from one plan is never displayed in a session belonging to a different plan. | Critical | No |
|  | SESS-13 | A user cannot read or modify another user's notes (RLS check). | Critical | No |
| *&nbsp;&nbsp;history integrity* | SESS-14 | Editing a set in one session leaves the recorded sets of earlier completed sessions of the same plan day byte-for-byte unchanged. | Critical | No |
| **History (List)**<br>*&nbsp;&nbsp;browsing the list* | HIST-01 | A completed session correctly appears in the session history list. | High | No |
|  | HIST-02 | The session history list loads a further page of sessions when its end is scrolled to, and stops once every session is loaded. | Medium | No |
| *&nbsp;&nbsp;filtering* | HIST-03 | A user can open the filter dialog and apply filters for date range, verifying the results. | Medium | No |
|  | HIST-04 | The empty state notice is shown when no sessions match the filter criteria. | Medium | No |
| *&nbsp;&nbsp;errors* | HIST-05 | An error notice is displayed if the session history fails to load. | High | No |
|  | HIST-06 | On error, a user can click the retry button to reload the session history. | High | No |
| *&nbsp;&nbsp;notes* | HIST-07 | A completed session with a note shows a note indicator on its history entry, and the note can be opened from the history view. | High | No |
| **History (Calendar)**<br>*&nbsp;&nbsp;browsing the calendar* | HIST-08 | Days holding completed sessions are marked with dots in the calendar. | High | No |
|  | HIST-09 | Tapping a day with a single session navigates to that session's detail page. | High | No |
|  | HIST-10 | Tapping a day with multiple sessions opens the session picker, and choosing an entry navigates to it. | High | No |
|  | HIST-11 | Returning from a session detail page restores the calendar view and the displayed month. | Medium | No |
|  | HIST-12 | Scrolling between months updates the anchored month and its dots; an empty month renders with no dots and no empty-state notice. | Medium | No |
| *&nbsp;&nbsp;filtering and errors* | HIST-13 | The calendar's filter dialog offers plan and month selection (no date range or page size), and applying a month jumps the calendar to it. | Medium | No |
|  | HIST-14 | An error notice is displayed if the calendar fails to load, and the retry button restores the calendar. | High | No |
| **History (Notes)**<br>*&nbsp;&nbsp;reading notes back* | HIST-15 | The notes view lists only the completed sessions carrying a note, newest first. | High | No |
|  | HIST-16 | Tapping a note card navigates to that session's detail page. | Medium | No |
| *&nbsp;&nbsp;empty and errors* | HIST-17 | The empty state notice is shown when no session matching the filters has a note. | Medium | No |
|  | HIST-18 | An error notice is displayed if the notes fail to load, and the retry button restores them. | High | No |
| **History (Views)**<br>*&nbsp;&nbsp;switching views* | HIST-19 | Without a view parameter, the calendar opens by default; each view picked from the tabs (list, then notes, then calendar again) is restored on revisits. | Medium | No |
| **Progress**<br>*&nbsp;&nbsp;plotting and toggling series* | PROG-01 | The progress chart renders with one chip per exercise of the selected plan, all plotted by default, in plan appearance order. | High | No |
|  | PROG-02 | Tapping an exercise chip removes its series from the chart, and tapping it again restores it. | Medium | No |
| *&nbsp;&nbsp;filtering* | PROG-03 | A user can widen the scope to "All plans", and the filter selection is still shown when the dialog is reopened. | Medium | No |
|  | PROG-04 | Filtering by a custom date range narrows the plotted series to the exercises trained in that window. | Medium | No |
|  | PROG-05 | The empty state notice is shown when no progress data matches the filter criteria. | Medium | No |
| *&nbsp;&nbsp;errors* | PROG-06 | An error notice is displayed if the progress data fails to load. | High | No |
|  | PROG-07 | On error, a user can click the retry button to reload the progress data. | High | No |
| *&nbsp;&nbsp;tooltips* | PROG-08 | Pressing the chart activates every point of the pressed day: a scaffold day shared by Squat and Deadlift activates both points at the same day `x`. | Medium | No |

---

### 5. Test Environment and Tools

| Category | Tool / Environment | Configuration / Notes |
| :--- | :--- | :--- |
| **Node.js Version** | Node.js | `24.18.0` (as per `.nvmrc`) |
| **Package Manager**| pnpm | As per the `packageManager` field in `package.json` |
| **Unit/Component Testing** | Vitest | Configured in `vitest.config.ts`. Runs in a `jsdom` environment. |
| **API Testing**| Vitest | Configured in `apps/api/vitest.config.ts`. Runs in a `node` environment. |
| **E2E Testing** | Cypress | Runs against deployed Staging and Production environments. |
| **E2E Test Filtering**| `@cypress/grep`| Used to selectively run tests tagged with `@smoke`. |
| **Code Coverage** | `@vitest/coverage-v8` | `pnpm test:coverage` script generates reports. |
| **Linting** | ESLint, `lint-staged`, Husky | Enforced on pre-commit. |
| **CI/CD** | GitHub Actions (*Assumed*) | Pipelines will be configured to run linting and all tests. |
| **Bug Tracking** | Jira / GitHub Issues (*Recommended*)| A dedicated project for tracking defects. |
| **Environments** | | |
| &nbsp;&nbsp;&nbsp;*Development* | Local machine | `ng serve --configuration=development` |
| &nbsp;&nbsp;&nbsp;*Staging* | Supabase Staging Project | Used for full E2E test suite. |
| &nbsp;&nbsp;&nbsp;*Production* | Supabase Production Project | Used only for `@smoke` E2E tests. |

#### 5.1 E2E Test Data & Credential Management

| Concern | Staging Environment Configuration | Production Environment Configuration |
| :--- | :--- | :--- |
| **User Management** | - **Canary User:** Manually created once for all smoke tests.<br>- **Ephemeral Users:** Created on-the-fly for all non-`@smoke` tests using the secret (`sb_secret_...`) key. | - **Canary User:** Manually created once for all smoke tests.<br>- **Ephemeral Users**: Creation is **not permitted**. |
| **Test Data** | - **Canary Data:** Seeded via a version-controlled SQL script against the Canary User's ID.<br>- **Ephemeral Data:** Created dynamically as part of each non-`@smoke` test. | - **Canary Data:** Seeded via a version-controlled SQL script against the Canary User's ID. |
| **Credential Access** | - **Secret key:** For non-`@smoke` tests.<br>- **Staging Canary User Password:** For `@smoke` tests. | - **Secret key:** The key **NEVER** used.<br>- **Production Canary User Password:** For `@smoke` tests. |

---

### 6. Test Execution Schedule

Testing will be an ongoing activity integrated into the development lifecycle and CI/CD pipeline.

*   **Unit & Component Tests:** Executed by developers during feature development (`pnpm test:watch`). Must pass before a pull request can be created.
*   **E2E Testing on Staging:** After every deployment to the staging environment, the *entire* suite of E2E tests will be executed. The test runner will automatically use the correct user strategy (Canary or ephemeral) for each test based on its tags.
    *   **Trigger:** After each successful staging deployment.
    *   **Command:** `cypress run --env testEnv=staging`
*   **Smoke Testing on Production:** After every successful deployment to the production environment, only the critical smoke tests will be executed. This provides a fast, safe, and reliable health check of the live application.
    *   **Trigger:** After each successful production deployment.
    *   **Command:** `cypress run --env testEnv=production,grepTags=@smoke,grepFilterSpecs=true`

---

### 7. Test Acceptance Criteria

**7.1. Entry Criteria (Start of Testing Cycle)**
*   All code for the features to be tested has been successfully merged into the staging branch.
*   A stable build has been deployed to the staging environment.
*   All unit and component tests are passing in the CI pipeline.
*   Relevant user stories and requirements are available and understood.

**7.2. Exit Criteria (Definition of Done)**
*   All planned test scenarios have been executed.
*   Code coverage meets or exceeds the target of **85%** for critical business logic.
*   No **Critical** or **Blocker** severity bugs remain open.
*   All **High** severity bugs have a documented resolution plan.
*   The application passes Lighthouse performance, accessibility, and SEO audits with a score of **90+**.
*   The final build is approved by the QA Engineer and Product Owner.

---

### 8. Roles and Responsibilities

| Role | Responsibilities |
| :--- | :--- |
| **Developers** | - Write and maintain unit and component tests.<br>- Perform initial testing on their own features.<br>- Fix bugs assigned to them.<br>- Participate in code reviews. |
| **QA Engineer** | - Create, maintain, and execute the test plan.<br>- Develop and maintain E2E tests.<br>- Perform manual exploratory and regression testing.<br>- Report, triage, and verify bugs.<br>- Provide the final sign-off for releases. |
| **Product Owner** | - Define and clarify requirements and acceptance criteria.<br>- Prioritize features and bugs.<br>- Participate in User Acceptance Testing (UAT). |
| **DevOps / Infra** | - Set up and maintain the CI/CD pipeline.<br>- Manage and provision test environments (Staging, Production). |

---

### 9. Bug Reporting and Triage

All defects found during the testing process will be reported and tracked using a designated bug-tracking tool (e.g., Jira).

**9.1. Bug Report Template**
Each bug report must include:
*   **Title:** A clear, concise summary of the issue.
*   **Environment:** (e.g., Local, Staging, Production; Browser/OS version).
*   **Steps to Reproduce:** A detailed, numbered list of steps to trigger the bug.
*   **Expected Result:** What the application should have done.
*   **Actual Result:** What the application actually did.
*   **Severity:** (Blocker, Critical, High, Medium, Low).
*   **Priority:** (High, Medium, Low).
*   **Attachments:** Screenshots, videos, or logs.

**9.2. Bug Lifecycle**
1.  **New:** A bug is reported by a team member.
2.  **Triage:** The bug is reviewed by the QA Engineer and Product Owner to confirm its validity and assign severity/priority.
3.  **To Do:** The bug is assigned to a developer.
4.  **In Progress:** The developer is actively working on a fix.
5.  **In Review / Ready for QA:** The fix has been implemented and is ready for verification on the staging environment.
6.  **Done / Closed:** The QA Engineer verifies the fix, and the bug is closed.
7.  **Reopened:** If the fix is not working, the bug is returned to the "To Do" state.

### **10. Living Document and Change Management**

This test plan is a **living document**, designed to evolve in lockstep with the 10xGains application. It serves as a central source of truth for quality assurance and must be updated as new features are developed or existing requirements change.

The following process will be adopted to manage changes to this plan and ensure its continued relevance.

#### **10.1. Workflow for New Features or Requirements**

The test planning process is integrated directly into the development lifecycle, beginning before implementation starts.

1.  **Planning Phase (Before Development):**
    *   **Collaboration:** The Product Owner, a Developer, and the QA Engineer will collaboratively review any new user story or requirement.
    *   **Scenario Identification:** The QA Engineer will identify the necessary unit, component, and End-to-End (E2E) test scenarios required to validate the feature. A decision will be made on whether any new E2E scenario is critical enough to be included in the smoke test suite (tagged as `@smoke`).

2.  **Test Plan Update (During Feature Planning):**
    *   Before development work begins, the QA Engineer will update this document by:
        1.  Adding the new feature to **Section 2.1 (In-Scope Features)**.
        2.  Adding the new E2E scenarios to the table in **Section 4 (Key Test Scenarios)**, including their priority and smoke test status.

3.  **Implementation Phase (During Development):**
    *   **Developers** are responsible for writing the unit and component tests identified in the planning phase alongside the feature code.
    *   The **QA Engineer** is responsible for creating the corresponding automated E2E tests in Cypress.

#### **10.2. Periodic Review**

*   This test plan will be formally reviewed on a **quarterly basis** by the project team.
*   The goal of the review is to ensure the document accurately reflects the application's current state, to update testing priorities, and to archive or remove test scenarios for deprecated features.
