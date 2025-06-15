# User Journey Diagram for Authentication

This document contains a Mermaid diagram that visualizes the user flows for registration, login, and password recovery based on the specifications.

<mermaid_diagram>
```mermaid
stateDiagram-v2
    [*] --> Unauthenticated

    state "Unauthenticated User" as ExploringApp {
      note left of Unauthenticated
        User has no active session.
        They can navigate between Login,
        Register, and Forgot Password pages.
      end note
      Unauthenticated --> LoginPage: Wants to log in
      Unauthenticated --> RegisterPage: Wants to create account
      LoginPage --> ResetPasswordPage: Clicks 'Forgot Password?'
    }

    state "Registration Process" as Registration {
      RegisterPage --> SubmitRegistration: User submits form
      state verification_check <<choice>>
      SubmitRegistration --> verification_check: Is email verification enabled?
      verification_check --> AwaitVerification: Yes
      verification_check --> Authenticated: No, auto-login

      AwaitVerification --> HandleRegisterCallback: User clicks email link
      note left of AwaitVerification
        User is notified to check email.
        The link is /auth/callback?type=register
      end note
      HandleRegisterCallback --> CreateProfile: Callback handler processes token
      CreateProfile --> LoginPage: Redirect after success
    }

    state "Login Process" as Login {
      LoginPage --> ValidateCredentials: User submits form
      state login_check <<choice>>
      ValidateCredentials --> login_check: Credentials valid?
      login_check --> Authenticated: Yes
      login_check --> LoginPage: No, show error
    }

    state "Password Recovery" as Recovery {
      ResetPasswordPage --> RequestPasswordReset: User submits email
      note right of RequestPasswordReset
        User is notified to check email.
        The link is /auth/callback?type=reset-password
      end note
      RequestPasswordReset --> HandleResetCallback: User clicks magic link
      HandleResetCallback --> AuthenticatedWithReset: User is logged in
    }

    state "Authenticated Session" as AppAccess {
      Authenticated: User has active session
      Authenticated --> HomePage

      AuthenticatedWithReset: User authenticated via reset link
      AuthenticatedWithReset --> SettingsPage
      SettingsPage --> HomePage: Password updated

      HomePage --> Logout: User clicks 'Logout'
      SettingsPage --> Logout: User clicks 'Logout'
      Logout --> ClearSession
      ClearSession --> LoginPage: Redirect after logout
    }

    AppAccess --> [*]: Session ends
```
</mermaid_diagram> 
