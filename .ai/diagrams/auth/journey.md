# User Journey Diagram for Authentication Module

## User Journey Analysis

1. User paths from reference files:
   - Registration: new users create an account via the Register form.
   - Login: existing users enter credentials and authenticate.
   - Password Recovery: users initiate a reset request via Forgot Password, receive an email, and reset their password.
   - Logout: authenticated users log out to end their session.
2. Main journeys and states:
   - Unauthenticated Access: entry point to authentication flow.
   - Login Journey: DisplayLogin -> ValidateLogin -> LoginSuccess or DisplayLogin(Error).
   - Registration Journey: DisplayRegister -> ValidateRegister -> SendVerification -> AwaitEmailVerification -> RegistrationConfirmed -> RegistrationSuccess.
   - Password Recovery Journey: DisplayForgot -> ValidateEmail -> EmailSent -> DisplayReset -> ValidateReset -> ResetSuccess.
   - Authenticated State: main application after successful login or registration.
3. Decision points and alternative paths:
   - Form validation decisions at Submit events (valid vs invalid inputs).
   - Credential verification decision (login success vs failure).
   - Email verification decision in registration (email link clicked vs pending).
   - Token validation and reset input decisions in password recovery.
4. State purpose descriptions:
   - DisplayLogin: user enters email and password.
   - ValidateLogin: inputs are checked client-side and server-side.
   - DisplayRegister: user enters registration details.
   - ValidateRegister: registration inputs are validated.
   - SendVerification: system sends an email verification link.
   - AwaitEmailVerification: user waits to confirm their email.
   - RegistrationConfirmed: user clicks the email link to verify.
   - DisplayForgot: user requests a password reset.
   - EmailSent: system sends password reset link via email.
   - DisplayReset: user sets a new password using the reset link.
   - ValidateReset: new password inputs are validated.
   - ResetSuccess: password has been successfully updated.
   - Authenticated: user has an active session and can access the main app.
   - Logout: user ends their session and returns to Unauthenticated.

## Mermaid Diagram

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated

    state "Authentication Flow" {
        [*] --> Choice

        state Choice <<choice>>
        Choice --> Login : Select Login
        Choice --> Register : Select Register
        Choice --> ForgotPassword : Select Forgot Password

        state "Login Flow" {
            [*] --> DisplayLogin
            DisplayLogin --> InputValidLogin : Submit [valid]
            DisplayLogin --> DisplayLogin : Submit [invalid]
            InputValidLogin --> LoginSuccess : Credentials OK
            InputValidLogin --> DisplayLogin : Credentials Invalid
        }

        state "Registration Flow" {
            [*] --> DisplayRegister
            DisplayRegister --> InputValidReg : Submit [valid]
            DisplayRegister --> DisplayRegister : Submit [invalid]
            InputValidReg --> SendVerification : Inputs Valid
            InputValidReg --> DisplayRegister : Validation Error
            SendVerification --> "Await Email Verification"
            "Await Email Verification" --> RegistrationConfirmed : Email Link Clicked
            RegistrationConfirmed --> RegistrationSuccess
        }

        state "Password Recovery Flow" {
            [*] --> DisplayForgot
            DisplayForgot --> EmailValid : Submit [valid]
            DisplayForgot --> DisplayForgot : Submit [invalid]
            EmailValid --> EmailSent : Request Sent
            EmailValid --> DisplayForgot : Validation Error
            EmailSent --> DisplayReset : Email Link Clicked

            state "Reset Password" {
                [*] --> DisplayReset
                DisplayReset --> InputValidReset : Submit [valid]
                DisplayReset --> DisplayReset : Submit [invalid]
                InputValidReset --> ResetSuccess : Password Updated
                InputValidReset --> DisplayReset : Validation Error
                ResetSuccess --> RecoveryComplete
            }
        }

        LoginSuccess --> EndAuthFlow
        RegistrationSuccess --> Choice
        RecoveryComplete --> Choice
    }

    EndAuthFlow --> Authenticated : Session Established
    Authenticated --> Logout : Logout
    Logout --> Unauthenticated

    Authenticated --> [*]

    note right of DisplayRegister
      Email, password, confirm password fields
    end note

    note right of DisplayLogin
      Email and password fields
    end note

    note right of DisplayForgot
      Email field for reset link
    end note
```
