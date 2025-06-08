# Comprehensive Test Plan for 10xGains

This document outlines the comprehensive testing strategy for the **10xGains** project. It defines the scope, approach, resources, and schedule of all testing activities to ensure the delivery of a high-quality, stable, and performant Angular application.

(Generated with Google AI Studio)

---

### 1. Introduction and Objectives

**1.1. Project Overview**

10xGains is a modern, single-page web application designed for fitness enthusiasts to create, manage, and track their training plans and workout sessions. The application is built with Angular and leverages Supabase for backend services, including authentication, database, and Deno-based Edge Functions.

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
    *   User Registration
    *   User Login
    *   Session Management (including token handling via `auth.interceptor.ts`)
    *   Route Protection (`auth.guard.ts`, `no-auth.guard.ts`)
*   **Training Plan Management (Full CRUD):**
    *   Listing, creating, updating, and deleting training plans.
    *   Managing training days within a plan (CRUD).
    *   Managing exercises within a day (CRUD).
    *   Managing sets for each exercise (CRUD).
    *   Drag-and-drop reordering for days, exercises, and sets.
    *   Configuration and updates of exercise progression rules.
    *   Activation of a training plan.
*   **Session Tracking:**
    *   Creation of a new session from an active plan.
    *   Real-time tracking of set completion (complete, fail, reset).
    *   Long-press and tap interactions on set bubbles (`long-press.directive.ts`).
    *   Session timer functionality and state management.
    *   Completion of an active session, triggering backend progression logic.
*   **Session History:**
    *   Viewing a paginated list of completed sessions.
    *   Filtering session history by training plan and date range.
*   **Home & Settings:**
    *   Dashboard view displaying the current active session or prompts.
    *   User profile management (updating name).
    *   Account management (password change, sign-out).
*   **Core Shared Components & Utilities:**
    *   API services (`api.service.ts`, `plan.service.ts`, etc.) and data mapping logic (`*.mapping.ts`).
    *   Custom form validators and directives.
    *   `KeyedDebouncerService` for API call optimization in the session page.
    *   UI layouts, dialogs, and notice components.
*   **Backend (Supabase Edge Functions):**
    *   All API handlers for `exercises`, `training-plans`, `training-sessions`, and `user-profiles`.
    *   Business logic, including Zod schema validation and `resolveExerciseProgressions`.
    *   Database interactions, including RPC calls for reordering logic.
*   **Static Code Analysis & Tooling:**
    *   Adherence to ESLint rules enforced by pre-commit hooks.

**2.2. Out-of-Scope Features**

*   **Password Reset / Forgot Password:** This functionality is commented out in the codebase and is considered out of scope until implemented.
*   **AI-Suggested Training Plans:** While types exist in `api.types.ts`, no implementation is present.
*   **"Progress" Feature:** The navigation link is present but disabled.
*   **Underlying Frameworks/Libraries:** Testing of Angular, Vitest, Supabase, or other third-party libraries themselves. We will only test our implementation and integration with them.
*   **Exhaustive Performance/Load Testing:** While basic performance benchmarks will be monitored, large-scale load and stress testing is not in the initial scope.
*   **Backend Infrastructure Testing:** Testing the Supabase infrastructure (e.g., database server uptime) is the responsibility of the cloud provider. We will test the Edge Functions we build on top of it.

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
    *   **Smoke Tests (Staging & Production):** All tests tagged as `@smoke` will provide a consistent health check across all environments. These tests will use a single, pre-existing **"Canary User"** to log in and perform a minimal, non-destructive set of actions to verify core application availability.
    *   **Unified Implementation:** A "smart" custom command (e.g., `cy.loginAsAppropriateUser()`) will be implemented. This command will analyze the running test's tags to automatically select the correct login method (Canary User for `@smoke` tests, on-the-fly user for all others).

*   **Performance Testing:**
    *   **Focus:** Monitor and ensure the application is fast and responsive.
    *   **Strategy:** Regularly run Google Lighthouse audits, monitor build budgets in `angular.json`, and analyze component rendering performance.

---

### 4. Key Test Scenarios

This is a non-exhaustive list of high-priority test scenarios. Tests marked "Yes" in the **Smoke Test** column will be implemented with the `{ tags: '@smoke' }` annotation for filtering by `@cypress/grep`.

| Feature Area | Scenario ID | Scenario Description | Priority | **Smoke Test** |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | AUTH-01 | A new user can successfully register and is automatically logged in. | Critical | No |
| | AUTH-02 | A registered user can successfully log in with valid credentials. | Critical | **Yes** |
| | AUTH-03 | A user with invalid credentials is shown a specific error message. | High | No |
| | AUTH-04 | An unauthenticated user attempting to access a protected route (e.g., `/home`) is redirected to `/auth/login`. | Critical | No |
| | AUTH-05 | An authenticated user attempting to access an auth route (e.g., `/auth/login`) is redirected to `/home`. | High | No |
| | AUTH-06 | User data is isolated; User A cannot access User B's data via API or direct URL manipulation (RLS check). | Critical | No |
| **Plan Management**| PLAN-01 | An authenticated user can create a new training plan. | Critical | No |
| | PLAN-02 | An authenticated user can view and navigate to an existing plan's details page. | Critical | **Yes** |
| | PLAN-03 | In the plan editor, a user can add a new training day. | High | No |
| | PLAN-04 | In the plan editor, a user can add a new exercise to a day (both existing and newly created exercises). | High | No |
| | PLAN-05 | In the plan editor, a user can add, edit, and delete a set for an exercise. | High | No |
| | PLAN-06 | In the plan editor, a user can reorder days, exercises, and sets using drag-and-drop and verify the order is saved. | Medium | No |
| | PLAN-07 | A user can activate a plan, which then correctly appears as the active plan on the home page. | High | No |
| | PLAN-08 | A plan that has been used in a session becomes read-only and all edit/delete/add controls are hidden or disabled. | High | No |
| | PLAN-09 | A user can delete a training plan that has not been used in any sessions. | Medium | No |
| **Session Tracking**| SESS-01 | A user can start a new session from an active plan on the home page. | Critical | **Yes** |
| | SESS-02 | A user can tap a set bubble to cycle through its states (Pending -> Completed -> Failed -> Pending). | Critical | No |
| | SESS-03 | A user can long-press a set bubble to open the edit dialog and successfully update its details. | High | No |
| | SESS-04 | The session timer starts and updates correctly after the first set interaction. | Critical | No |
| | SESS-05 | A user can successfully complete a session, after which a new session is available and they are redirected. | Critical | No |
| | SESS-06 | A user is prompted with a confirmation dialog if they try to complete a session with unfinished sets. | High | No |
| **History** | HIST-01 | A completed session correctly appears in the session history list. | High | No |
| | HIST-02 | The session history list correctly paginates when there are more sessions than the page size. | Medium | No |
| | HIST-03 | A user can open the filter dialog and apply filters for date range, verifying the results. | Medium | No |
| | HIST-04 | The "filter applied" indicator on the action bar is highlighted when a filter is active. | Low | No |
| | HIST-05 | The empty state notice is shown when no sessions match the filter criteria. | Medium | No |
| | HIST-06 | An error notice is displayed if the session history fails to load. | High | No |
| | HIST-07 | On error, a user can click the retry button to reload the session history. | High | No |

---

### 5. Test Environment and Tools

| Category | Tool / Environment | Configuration / Notes |
| :--- | :--- | :--- |
| **Node.js Version** | Node.js | `22.14.0` (as per `.nvmrc`) |
| **Package Manager**| Yarn | As per `.yarnrc.yml` |
| **Unit/Component Testing** | Vitest | Configured in `vitest.config.ts`. Runs in a `jsdom` environment. |
| **API/Edge Function Testing**| Vitest | Configured in `vitest.config.ts`. Runs in a `node` environment against a local Supabase instance. |
| **E2E Testing** | Cypress | Runs against deployed Staging and Production environments. |
| **E2E Test Filtering**| `@cypress/grep`| Used to selectively run tests tagged with `@smoke`. |
| **Code Coverage** | `@vitest/coverage-v8` | `yarn test:coverage` script generates reports. |
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
| **User Management** | - **Canary User:** Manually created once for all smoke tests.<br>- **Ephemeral Users:** Created on-the-fly for all non-`@smoke` tests using the `service_role` key. | - **Canary User:** Manually created once for all smoke tests.<br>- **Ephemeral Users**: Creation is **not permitted**. |
| **Test Data** | - **Canary Data:** Seeded via a version-controlled SQL script against the Canary User's ID.<br>- **Ephemeral Data:** Created dynamically as part of each non-`@smoke` test. | - **Canary Data:** Seeded via a version-controlled SQL script against the Canary User's ID. |
| **Credential Access** | - **`service_role` key:** For non-`@smoke` tests.<br>- **Staging Canary User Password:** For `@smoke` tests. | - **`service_role` key:** The key **NEVER** used.<br>- **Production Canary User Password:** For `@smoke` tests. |

---

### 6. Test Execution Schedule

Testing will be an ongoing activity integrated into the development lifecycle and CI/CD pipeline.

*   **Unit & Component Tests:** Executed by developers during feature development (`yarn test:watch`). Must pass before a pull request can be created.
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
