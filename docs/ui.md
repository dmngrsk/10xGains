# UI Architecture for 10xGains

## 1. Overview of UI Structure

The UI is built with a mobile-first approach using Angular 22, Tailwind CSS 4, and Angular Material. It provides two primary layouts:

- **AuthLayout**: Displays a simple centered card for the welcome, login, registration and password recovery views. Neither the bottom navigation nor the top app bar are visible.
- **MainLayout**: Shows a top app bar and the bottom navigation bar across the five main tabs (Home, Plans, History, Progress, Settings). When a `backNavigation` target is given instead (Plan Editor, Active Session), the top app bar shows a back button and the bottom navigation is hidden.

Global services (AuthGuard, HttpInterceptor, shared state services) manage authentication, error handling, and data caching.

## 2. List of Views

### 2.1 Welcome View
- **Route**: `/auth`
- **Main Goal**: Auth entry point for unauthenticated users; let them choose an authentication method.
- **Key Info**: No form. Two full-width buttons — "Sign in with Google" (starts the Google OAuth/PKCE flow immediately) and "Sign in with email" (navigates to the Login view).
- **Key Components**: `AuthMethodButtonComponent` (renders the Google or email button by its `method` input), `AuthLayoutComponent`, `noAuthGuard`, `MatSnackBar` for OAuth-initiation errors.
- **UX/Accessibility/Security**: Uncrowded chooser screen; Google sign-in failures surface via snackbar; keyboard-accessible buttons.

### 2.2 Login View
- **Route**: `/auth/login`
- **Main Goal**: Allow users to authenticate with email and password (reached from the Welcome view).
- **Key Info**: Email input, Password input, Submit button, and links to Register, Reset Password, and back to the Welcome view ("Choose authentication method").
- **Key Components**: `ReactiveForm` with `required`/`email` validators, `EmailInputComponent`, `PasswordInputComponent`, `MatButton`, `noAuthGuard` redirect logic.
- **UX/Accessibility/Security**: Inline error messages, password show/hide, CSRF and HTTPS enforced.

### 2.3 Register View
- **Route**: `/auth/register`
- **Main Goal**: Enable new user sign‑up.
- **Key Info**: Email input, Password input, Confirm password, Submit button.
- **Key Components**: `ReactiveForm` with the custom `passwordStrength` and `passwordMatch` validators, `EmailInputComponent`, `PasswordInputComponent`, `MatButton`.
- **UX/Accessibility/Security**: Real‑time validation, feedback snackbars for server errors, secure password requirements.

### 2.4 Reset Password View
- **Route**: `/auth/reset-password`
- **Main Goal**: Allow users to request a password reset email. The new password is not set here — Supabase sends a magic link, and the callback hands the user off to Settings to complete the change.
- **Key Info**: Email input, Submit button, link back to Login view.
- **Key Components**: `ReactiveForm` (required, email), `EmailInputComponent`, `MatButton`.
- **UX/Accessibility/Security**: Inline error messages and snackbar feedback on success/failure.

### 2.5 Auth Callback View
- **Route**: `/auth/callback?type=register|reset-password`
- **Main Goal**: Handle Supabase auth redirects. It renders no UI; it resolves the callback and forwards the user on.
- **Key Info**: No form. `type=register` creates the default user profile, shows a success snackbar, and redirects to `/auth`. `type=reset-password` redirects to `/settings` with a `changePassword` action so the user can set a new password on an authenticated page.
- **Key Components**: `CallbackComponent` (empty template), `AuthService`, `ProfileService`, `MatSnackBar`.
- **UX/Accessibility/Security**: An unrecognized `type` falls back to `/auth` with an error snackbar; the password change itself happens only within an authenticated session.

### 2.6 Home Dashboard
- **Route**: `/home`
- **Main Goal**: Display the next pending or in-progress session and two recent historical sessions.
- **Key Info**: Three `MatCard` tiles:
  1. Next session (date, list of exercises formatted as `Exercise | NxM min–max kg`).
  2. Last session summary or "No training sessions found."
  3. Second-last session summary or placeholder.
- **Key Components**: `MatCard`, `Flex/Grid` (Tailwind), Skeleton loaders for loading state, inline CTA for empty state.
- **UX/Accessibility/Security**: High contrast text, swipe or tap navigations.

### 2.7 Plans List
- **Route**: `/plans`
- **Main Goal**: List all user training plans with infinite scroll.
- **Key Info**: Plan title, creation date, description preview.
- **Key Components**: `cdk-virtual-scroll-viewport` or `IntersectionObserver`, `MatCard` for items, Skeleton loader, `MatButton` to add a new plan.
- **UX/Accessibility/Security**: Announce loading state, predictable scroll, RLS ensures user sees only own plans.

### 2.8 Plan Editor
- **Route**: `/plans/:planId/edit`
- **Main Goal**: Create or modify a training plan, reorder days and exercises.
- **Key Info**: Days are a tab strip, one day on screen at a time - nobody edits Workout A and Workout B at once. Within the selected day, each exercise is a `MatCard`, always open: the sets are the reason to be in the editor, so nothing is behind a chevron. The card header carries a drag handle, the exercise name, the progression as a filled pink chip (`▲ 2.5 kg`, or an outlined "Set progression" when there is none) and a `⋮` menu. Each exercise's sets are a table - `Reps × Weight` - so a row reads as `5 × 100 kg`, with an inline weight stepper per row and a centred `+ Add Set` row. Rows are separated by a rule dimmer than `outline-variant`, which is drawn for surfaces rather than rows, and every control a row has - the stepper and the pencil - is gathered at its right-hand end as bare primary-coloured icons, so the value stays where the eye reads it and the controls stay where the thumb reaches them, reading as one group rather than as a control panel competing with the weight. A row is a fixed 48px whether it is editable or read-only, so a plan does not visibly change shape when it is activated. Sets are not reorderable: within one exercise they differ only by reps and weight, both editable in place, so moving a row is the long way round to changing two numbers. The plan name is the page title rather than a heading, and a pen beside the description edits both. The plan's one primary action sits at the end of the page: `Activate Training Plan`, or `Deactivate And Edit Plan` once it is active - the two states of the same decision, in the same place. Activate is never greyed out on an incomplete plan; it stays live and reports what is still missing, since a disabled control says the user cannot proceed without saying why. The completeness check runs day by day and exercise by exercise - a plan whose second day is a list of empty exercises cannot be activated, because activating it would produce a workout with nothing in it once the rotation reached that day.
- **Key Components**: `MatTabGroup` for days, `MatCard` for exercises, `CDK DragDrop` for reordering exercises and sets, a reorder-days `MatDialog` (the tab strip has nowhere to drag to), `MatMenu` for plan/day/exercise actions, `MatDialog` for add/edit day/exercise/set, `MatAutocomplete` with "Add new exercise" option, real-time PUT calls.
- **The weight stepper**: value first, then the two buttons paired (`100 kg  − +`), never `− 100 kg +` - with the value between the buttons it shifts horizontally as digits change, so neither button holds still down a column of sets. It steps by that exercise's own `weight_increment`, falling back to 2.5 kg. Taps apply optimistically and the write is debounced per set, so a run of taps sends one request carrying the value the user settled on.
- **Editability**: an active plan is read-only. Changing the programme you are part-way through is a decision rather than a side effect of tapping a stepper, so it is taken through **Deactivate And Edit Plan** - the only action the page offers while a plan is active. That clears `profiles.active_plan_id` and nothing else: the plan, its structure and every session trained from it are untouched, and re-activating cancels any workout left open exactly as switching plans always has. A notice on the page says all of this rather than leaving the editor inert and unexplained. Once a plan is inactive, editability is still not a single read-only switch. `derivePlanEditCapabilities` yields one flag per action, because history restricts *deleting* structure, not editing it - a session carries its own snapshot of what it prescribed, so changing a weight cannot rewrite the past. Editing values, adding items, reordering and editing metadata all stay available on a trained plan, including under an open session - reordering was withdrawn there until the session snapshot landed, but the verdict is now read off the session's own copy, so moving an exercise cannot change what a recorded set is measured against. Deleting a day or exercise that anything references is replaced by archiving. An action the server would refuse is omitted rather than shown disabled - deleting disappears once a day or exercise has been trained, and archiving appears in its place, the same way archiving is absent while there is no history to protect. For a day, both live in its Edit Day dialog rather than beside the menu item that opens it: editing a day and disposing of one are the same errand, and the dialog is handed the same capabilities the menu reads, so the two surfaces cannot disagree about whether a day may be deleted.
- **UX/Accessibility/Security**: Drag-and-drop, focus management on dialogs, error snackbar on server failures, a `tabular-nums` weight column so values do not jitter, and `aria-label`s on the steppers naming both the set and the increment. At `md:` and up the tab strip becomes a left rail and the content column takes a readable measure.

### 2.9 Active Session View
- **Route**: `/sessions/:sessionId`
- **Main Goal**: Track an ongoing workout session.
- **Key Info**: Fixed order list of exercises; for each exercise a row of set bubbles showing expected sets; "+" icon next to last bubble to add new sets via dialog; floating notes button opening a dialog with the session note and the plan note (shared across sessions of the plan).
- **Key Components**: `MatButton` for bubbles, `MatDialog` to add set (pre-filled weight/reps), real-time PATCH to update set status, mini-FAB + `MatDialog` for session/plan notes (saved on 'Save' or backdrop click).
- **UX/Accessibility/Security**: Clear visual feedback for completed/failed sets, confirmation snackbars, offline warning if network drops.

### 2.10 History View
- **Route**: `/history`
- **Main Goal**: Browse past workout sessions with filters and pagination.
- **Key Info**: Chronological list of sessions (date, status), swipe or icon to open filter panel, pagination controls; sessions with a note show an indicator that opens the session note (plan notes are not shown here).
- **Key Components**: `MatDrawer` for filters (`debounceTime(100ms)` + `switchMap`), `MatPaginator`, list items with Skeleton loader, notes dialog reused from the session view.
- **UX/Accessibility/Security**: Secure RLS filter parameters.

### 2.11 Progress View
- **Route**: `/progress`
- **Main Goal**: Visualize strength progression as a weight-over-time line chart, with one line per exercise.
- **Key Info**: Time-scaled chart of the top completed set per session; a scrollable chip row selecting which exercises are plotted; a sticky actions bar summarizing the active filters. Defaults to the user's active plan over the last 3 months, with all of its exercises plotted. Point tooltips show `Exercise: <weight> kg – <reps>` (reps collapse to `5x5` when uniform, else `5/5/4/0/0`), plus the plan name when "All plans" is selected.
- **Key Components**: Chart.js line chart via `ng2-charts` (`BaseChartDirective`), `MatChipListbox` for the exercise toggles, `MatDialog` filter with plan and date-range-preset `MatSelect`s, `txg-notice` for empty/error states.
- **UX/Accessibility/Security**: Series are exercise-scoped, so a line spans training plans under the "All plans" filter; empty and error states offer a corrective action; RLS and an explicit `user_id` filter scope all data to the authenticated user.

### 2.12 Settings View
- **Route**: `/settings`
- **Main Goal**: Allow profile editing, password changes, and logout.
- **Key Info**: Email (read-only or editable), First name, Save button, Logout button. Also the destination of the password-reset callback (see 2.4), which arrives with a `changePassword` action to prompt the user for a new password.
- **Key Components**: `ReactiveForm`, `MatInput`, `MatButton`, `HttpInterceptor` auto token refresh.
- **UX/Accessibility/Security**: Confirm dialog on logout, inline validation, HTTPS.

## 3. User Journey Map

1. **Onboarding**: `/auth` ➔ Sign in with email ➔ `/auth/register` ➔ successful signup ➔ if email verification is enabled, the user verifies via `/auth/callback?type=register` and lands on `/auth`; if it is disabled, the user is auto-logged-in to `/home`.
2. **Authentication**: `/auth` ➔ Sign in with Google (immediate OAuth) or Sign in with email ➔ `/auth/login` ➔ successful login ➔ `/home`.
3. **Password Recovery**: `/auth` ➔ `/auth/login` ➔ `/auth/reset-password` ➔ magic link ➔ `/auth/callback?type=reset-password` ➔ `/settings` to set the new password.
4. **Overview**: `/home` (view next session or history snapshot).
5. **Plan Management**:
   - Tap Plans ➔ `/plans` ➔ tap "+" ➔ open `MatDialog` ➔ create plan ➔ navigate to `/plans/:planId/edit`.
   - In editor: add days/exercises, tune weights with the inline steppers, reorder ➔ snackbar confirmation.
   - On a plan already trained: adjust weights and reps freely; remove a day or exercise by archiving it, which keeps the workouts recorded against it readable in History.
6. **Workout Tracking**:
   - From Home or Plans, tap session ➔ `/sessions/:sessionId` ➔ mark sets complete or add sets ➔ auto-save and PATCH calls.
7. **History & Filter**:
   - Tap History ➔ `/history` ➔ open filter panel, apply filters, page results.
8. **Progress**:
   - Tap Progress ➔ `/progress` ➔ review the weight-over-time chart of the active plan ➔ toggle exercises, or widen the plan/date filters.
9. **Settings**:
   - Tap Settings ➔ `/settings` ➔ update profile, change password, or log out.

## 4. Layout and Navigation Structure

- **AuthLayout**: Used for the `/auth` welcome screen and the `/auth/*` form routes (login, register, reset-password) — centered card layout, hides bottom navigation and top toolbar. `/auth/callback` renders no layout at all.
- **BottomNavigation**: Visible on the five main tabs: Home, Plans, History, Progress, Settings.
- **Back navigation**: Views reached from a tab (Plan Editor, Active Session) hide the bottom navigation and show a top `MatToolbar` with a back button that returns to the originating tab.
- **Router Setup**: Angular Router with `authGuard` on protected routes (Home, Plans, Session, History, Progress, Settings), and `noAuthGuard` on `/auth` and the `/auth/*` form routes to bounce already-authenticated users to `/home`. `authGuard` sends unauthenticated users to `/auth`.
- **HttpInterceptor**: Injects Supabase JWT, handles 401 by redirecting to `/auth`, and globally catches errors to show snackbars.

## 5. Key Components

- **BottomNavigationComponent**: Manages mobile tab bar, responsive, accessible.
- **SkeletonLoaderComponent**: Generic placeholder for list and card loading states.
- **SessionCardComponent**: Renders a single session tile for Home.
- **PlanListItemComponent**: Displays plan info in the Plans list.
- **PlanDayListComponent**: The day tab strip and the selected day's panel. Selection is keyed by day id, not by position, so reordering or archiving a day cannot leave the strip and the panel disagreeing.
- **PlanExerciseSetListComponent / PlanExerciseSetItemComponent**: The set table and its rows. The row component uses an attribute selector because it *is* a `<tr>`; a custom element between `<tbody>` and `<tr>` is not valid table structure.
- **ExerciseSelectorComponent**: `MatAutocomplete` with remote search and "Add new exercise" option.
- **FilterDrawerComponent**: Wraps `MatDrawer`, filter form with debounce.
- **SessionNotesDialogComponent**: `MatDialog` for session and plan notes, opened from the session view's notes button and from history entries.
- **PaginatorComponent**: Wraps `MatPaginator` for unified styling.
- **AuthGuard & HttpInterceptor**: Enforce security and error handling.
- **DialogService**: Centralized service to open confirmation and form dialogs.

This architecture ensures each user story from the PRD is mapped to a concrete view and set of components, aligns with the API endpoints, and prioritizes a seamless, accessible, and secure mobile-first experience.
