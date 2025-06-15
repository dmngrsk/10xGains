<authentication_analysis>

### 1. Authentication Flows

Based on the `auth-spec.md` document, the following authentication flows are defined:

*   **User Registration (with Email Verification):** A new user signs up, receives a verification email, and clicks a link to confirm their account before they can log in.
*   **User Login:** An existing user provides their credentials (email and password) to gain access to the application.
*   **User Logout:** An authenticated user signs out, terminating their session.
*   **Password Recovery:** A user who has forgotten their password can request a reset link via email. Clicking the link allows them to access a secure page to set a new password.

### 2. Actors and Interactions

*   **Browser:** The client-side environment where the user interacts with the Angular application. It initiates all authentication requests.
*   **Angular AuthService:** A service within the Angular application responsible for encapsulating authentication logic and communicating with the Supabase backend.
*   **Supabase Auth:** The backend-as-a-service provider that handles user management, credential verification, session management (JWTs), and sending transactional emails (e.g., verification, password reset).

### 3. Token Verification and Refresh

*   **Initial Authentication:** Upon successful login, Supabase Auth issues an access token and a refresh token. The Supabase client library stores these securely in the browser.
*   **Authenticated Requests:** For subsequent requests to protected resources, the access token is sent in the Authorization header.
*   **Token Expiration & Refresh:** When the access token expires, the Supabase client library automatically uses the refresh token to request a new access token from Supabase Auth without interrupting the user. If the refresh token is also invalid or expired, the user is logged out and must re-authenticate. This process is transparent to the user.

### 4. Authentication Steps Description

*   **Registration:** The user submits their details. `AuthService` calls Supabase `signUp`. Supabase sends a confirmation email and the user is redirected to a callback URL upon clicking the link to verify their account.
*   **Login:** The user submits credentials. `AuthService` calls Supabase `signInWithPassword`. On success, Supabase returns a session (including tokens), which the client library stores, and the user is redirected to the home page.
*   **Logout:** `AuthService` calls Supabase `signOut`. The client library clears the stored session, and the user is redirected to the login page.
*   **Password Recovery:** The user requests a password reset. `AuthService` calls Supabase `resetPasswordForEmail`. The user receives a magic link. Clicking it validates their session via a callback and redirects them to a settings page to update their password.

</authentication_analysis>

<mermaid_diagram>
```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Angular AuthService
    participant Supabase Auth

    %% User Registration Flow
    Note right of Browser: User Registration Flow
    Browser->>Angular AuthService: User submits registration form
    activate Angular AuthService
    Angular AuthService->>Supabase Auth: signUp(email, password, { redirectTo: callback })
    activate Supabase Auth
    Supabase Auth-->>Angular AuthService: Returns success (user created, email sent)
    deactivate Supabase Auth
    Angular AuthService-->>Browser: Display "Check your email" message
    deactivate Angular AuthService

    Note right of Browser: User clicks verification link in email
    Browser->>Supabase Auth: User is redirected to verification URL
    activate Supabase Auth
    Supabase Auth->>Browser: Verifies token, redirects to app callback
    deactivate Supabase Auth

    Browser->>Angular AuthService: Handles /auth/callback?type=register
    activate Angular AuthService
    Angular AuthService-->>Browser: Creates user profile, redirects to /auth/login
    deactivate Angular AuthService

    %% User Login Flow
    Note right of Browser: User Login Flow
    Browser->>Angular AuthService: User submits login form
    activate Angular AuthService
    Angular AuthService->>Supabase Auth: signInWithPassword(email, password)
    activate Supabase Auth
    Supabase Auth-->>Angular AuthService: Returns session (access & refresh tokens)
    deactivate Supabase Auth
    Angular AuthService-->>Browser: Stores session, redirects to /home
    deactivate Angular AuthService

    %% Authenticated Action & Token Refresh
    Note right of Browser: Authenticated Action & Session Refresh
    Browser->>Angular AuthService: Request protected data
    activate Angular AuthService
    Angular AuthService->>Supabase Auth: API call with Access Token
    activate Supabase Auth

    alt Access Token is valid
        Supabase Auth-->>Angular AuthService: Returns protected data
    else Access Token is expired
        Supabase Auth-->>Angular AuthService: Returns "Token expired" error
        Angular AuthService->>Supabase Auth: Request new token using Refresh Token
        activate Supabase Auth
        Supabase Auth-->>Angular AuthService: Returns new session (access & refresh tokens)
        deactivate Supabase Auth
        Angular AuthService->>Supabase Auth: Retry API call with new Access Token
        activate Supabase Auth
        Supabase Auth-->>Angular AuthService: Returns protected data
        deactivate Supabase Auth
    end

    deactivate Supabase Auth
    Angular AuthService-->>Browser: Returns protected data to component
    deactivate Angular AuthService

    %% Password Reset Flow
    Note right of Browser: Password Reset Flow
    Browser->>Angular AuthService: User requests password reset for email
    activate Angular AuthService
    Angular AuthService->>Supabase Auth: resetPasswordForEmail(email, { redirectTo: callback })
    activate Supabase Auth
    Supabase Auth-->>Angular AuthService: Acknowledges request (email sent)
    deactivate Supabase Auth
    Angular AuthService-->>Browser: Display "Check your email" message
    deactivate Angular AuthService

    Note right of Browser: User clicks magic link in email
    Browser->>Supabase Auth: User is redirected to magic link URL
    activate Supabase Auth
    Supabase Auth->>Browser: Verifies user, redirects to app callback
    deactivate Supabase Auth

    Browser->>Angular AuthService: Handles /auth/callback?type=reset-password
    activate Angular AuthService
    Angular AuthService-->>Browser: Redirects to /settings to update password
    deactivate Angular AuthService

    %% Logout Flow
    Note right of Browser: Logout Flow
    Browser->>Angular AuthService: User clicks logout
    activate Angular AuthService
    Angular AuthService->>Supabase Auth: signOut()
    activate Supabase Auth
    Supabase Auth-->>Angular AuthService: Session invalidated successfully
    deactivate Supabase Auth
    Angular AuthService-->>Browser: Clears local session, redirects to /auth/login
    deactivate Angular AuthService
```
</mermaid_diagram>
