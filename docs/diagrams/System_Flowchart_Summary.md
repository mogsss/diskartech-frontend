# DiskarTech System Flowchart — Source-Based Summary

Analyzed on 9 October 2026. The editable diagram represents the checked-out Expo mobile application and Laravel API/admin web application. It documents implemented behavior, including important UI/API differences; it is not a proposed design or a claim that production services were tested.

## Detected roles and major functions

| Role | Interface / identity | Implemented major functions |
|---|---|---|
| Student | Mobile; `users.role=student`, `students` profile | Registration/login/email OTP; job browsing, search, nearby and AI recommendations; bookmarks; verified job applications; application tracking/cancellation/deletion; interview and contract details; certificate requests/viewing; contract ratings; profile, skills, availability, resume/documents; messages, notifications, reports and support. |
| Employer / Business | Mobile; `users.role=employer`, `employers` profile | Registration/login/email OTP; verified job posting; own job CRUD/status management; applicants, resume preview, interview scheduling, hiring, contract completion/termination; certificate signing/issuance; student reviews; profile/documents; messages, notifications, reports and support. |
| Household | Mobile; `users.role=household`, `households` profile | The shared hirer modules with household identity: verified job posting; own listings and applicants; interviews/contracts; certificate issuance and reviews; valid-ID/profile management; messages, notifications, reports and support. |
| Admin | Laravel web; separate `admins` table and `admin` session guard | Login/session logout; dashboard statistics; read/search/filter user directory; manual document approval/rejection; job moderation/deletion; incident investigation/status/notes/deletion; report notification polling; conversation oversight and official advisories. |

`type=business` and `type=household` choose variants of the hirer UI. Business is not a fifth role. A public certificate viewer is a route, not a registered user role.

## Authentication versus verification

Three independent concerns are represented:

1. **Authentication:** password login checks the user/password hash and creates a Sanctum token. Google login uses native account selection followed by backend email lookup. Protected API routes require `auth:sanctum`; Admin uses `auth:admin` and session authentication.
2. **Email verification:** `users.isEmailVerified`, `otp_code`, and `otp_expires_at`. Registration issues a token but starts unverified. Login to an unverified account returns 403 with a token and an offer to verify. Sending uses Gmail API with OAuth refresh/access-token caching. The code must match and be unexpired; success clears OTP fields and changes only email verification.
3. **Account approval:** `isVerified` on the role profile, independent of email. Administrator document review approves/rejects the profile. A successful login, successful upload or positive AI document remark does not itself grant account approval.

| Role | Documents required by verification UI | Confirmed restricted action | Enforcement |
|---|---|---|---|
| Student | School ID and COR/COE (enrollment document); resume optional | Apply to a job | UI verification guidance plus independent Student profile `isVerified` check in `JobApplicationController::applyJob`; unverified returns 403/`needs_verification`. |
| Employer | Valid ID and business permit/certificate | Create/post a job | UI verification guidance plus independent Employer profile `isVerified` check in `JobController::store`; unverified returns 403/`needs_verification`. |
| Household | Valid ID | Create/post a job | UI verification guidance plus independent Household profile `isVerified` check in `JobController::store`; unverified returns 403/`needs_verification`. |
| Admin | No mobile account-verification gate | Protected web administration | Separate admin session guard. No admin registration/OTP process exists. |

**Confirmed:** an unverified Household cannot create a job through its posting path; an unverified Student cannot apply; an unverified Employer cannot create a job. Failure shows verification-required feedback and offers the verification-status/upload page or cancellation. It does not log the account out. All three roles can browse their dashboard/profile while account approval is pending.

Approval is a Boolean, not a stored four-state enum. The screens derive Verified from `isVerified`, Rejected from a rejection reason, Pending from uploaded required documents, and Documents Required from missing files. School ID/COR and hirer verification uploads reset approval and clear rejection. Resume/avatar upload does not reset approval. AI analysis supplies document remarks; Admin remains the decision maker.

## Detailed role flows

### Student

Open app → restore local session or use shared registration/login → email OTP where entered by the authentication flow → route to Student home. Read active jobs through all-jobs/nearby/AI feeds; search/filter, open details, save/unsave, contact or report. Apply runs the UI account gate and then the independent backend student/profile gate; missing profile, verification failure, invalid job, duplicate application and persistence/network failures are retained in the grouped validation and error-recovery paths. Success creates a pending application.

Own applications show current status. Student cancellation is allowed only for pending/viewed; deletion only for cancelled/rejected/completed/terminated. Interview/contract information comes from the hirer's updates. Completed/terminated contracts expose UI ratings. The primary application-details screen exposes certificate requests for accepted/completed, checks own application in the API, stores the request, and waits for hirer approval. Approved certificates can be previewed or opened in the browser for Save as PDF. The terminated certificate discrepancy is recorded below.

Profile editing, availability, skills (with suggestions), document/resume/avatar uploads, messaging, notifications, report history and DARA/FAQs remain on the Student page as labeled sections. Logout follows its actual entry-point cleanup behavior.

### Employer / Business

Shared mobile authentication → employer business dashboard. Read own jobs and applicants. New posting requires UI approval, validated fields/schedule, independent current Employer profile approval, and coordinates before creating an active owner-linked job. Posted requirements/skills use local suggestion catalogs. Edit/status/delete are owner-scoped APIs; job deletion removes its applications.

Applicant detail changes pending to viewed. The UI allows interview invitation/editing, hiring after interview, rejection, deletion and messaging; uploaded resume uses a document preview. Hiring defaults days/hours from the post but lets the employer change them, then records accepted contract details. Accepted contracts offer completion or termination. Requested certificates can be previewed, signed and approved; concluded contracts can be reviewed. Auxiliary push/chat failures do not undo saved SQL state. Shared profile/support/logout modules complete the flow.

### Household

Shared mobile authentication → household variant of the hirer dashboard. Household has its own flowchart page and own Valid ID account approval gate. Posting independently loads the current Household profile and blocks unverified creation. Job/applicant/interview/contract/certificate/review modules are the same implemented shared screens/APIs used by the employer, with household identity and profile paths. Its document requirement is not the employer business-permit requirement.

### Admin

Admin login validates fields, authenticates the `admins` record, regenerates the session and enters the protected dashboard. User directory reads and filters role profiles. Verification lets the admin inspect uploads/AI remarks and manually approve or reject with a reason. Moderation searches jobs, sets active/hidden/closed or deletes a job and applications. Reports can move between pending/investigating/resolved/dismissed, save notes, record resolution time or be deleted; polling supplies open-report alerts. The Messages page reads Firestore conversations/messages and sends official advisories. Logout invalidates the session and regenerates CSRF state. Settings persistence/user administration CRUD beyond the listed routes are not invented.

## Shared processes and storage

- Mobile entry, password/Google login, role registration, OTP delivery/validation and role routing are shared continuations. Admin authentication is separate.
- Account document upload/status and advisory analysis connect to manual Admin review. They never collapse into the email-OTP process.
- Profile editing, messages, notifications, reports/FAQ/DARA support, certificate rendering and contract reviews are shared modules with role-specific entry points.
- SQL entities: `users`, `students`, `employers`, `households`, `admins`, `personal_access_tokens`, `available_jobs`, `job_applications`, `saved_jobs`, `reviews`, `reports`. `Jobs` maps to `available_jobs`; older job-posting/available-job models/tables do not establish an additional live workflow. The migration renames contract reviews to `reviews`.
- Public filesystem stores uploaded documents/avatars. Laravel cache/queue support OTP locks/cooldowns/provider caching and document analysis. Device AsyncStorage caches session/profile/read notices/theme. Firestore stores `chats` with `messages` subcollections, `app_notifications`, and `user_push_tokens`. Expo supports push delivery; providers are external dependencies, not extra users.

## Decisions and failure handling

The revised diagrams show authentication, email/OTP, account approval, action availability, input validation, operation success/failure and logout. Detailed field, ownership, duplicate, status and provider checks are grouped under the relevant validation/action nodes instead of printed as separate backend branches. Each grouped node retains source references and business rules in its editable custom data.

Every displayed decision has explicit Yes/No exits. Related checks are consolidated into user-facing decisions; the detailed business rules below remain authoritative for the grouped actions. Failures point to a local continuation or the relevant recovery section on the same role page instead of long return arrows. HTTP validation, missing-record, unauthorized, verification-denied, provider/network/storage and empty-state paths are shown where implemented; related errors are grouped to keep each role on one page. A generic save-success decision includes server/network failure; it does not assert that every uncaught database exception has a custom UI handler. Protected API 401 cleanup differs from an expected invalid-password 401 on the public login endpoint.

## Current implementation differences and inactive features

These are source findings, not changes made to the application:

1. **Cached-session email bypass:** app entry/login restores a cached token/user and routes by role without checking email verification. Unverified login issues a token; protected API group has no email-verification middleware. OTP is shown as the actual normal registration/unverified-login continuation, not a universal backend permission gate.
2. **Google backend validation:** native Google selection exists, but `/google-login` accepts email only. No Google ID-token verification is implemented on that endpoint.
3. **Partial API authorization:** hirer own-list queries and job edit/delete/status are owner-scoped, but selected-job applicants, applicant details/status/deletion and certificate approval/data retrieval lack independent owner/role checks. They are not drawn with imaginary permission gates. Protected API authentication alone is shown for those operations. Job posting has a fallback for other roles rather than explicit role denial.
4. **Certificate mismatch:** primary Student `application-details.tsx` hides certificate card for terminated, while request API permits accepted/completed/terminated. `accepted-job.tsx` has legacy certificate UI, but primary application list navigates to application-details. The normal primary-screen flow is distinguished from API capability.
5. **Certificate access/issuance:** public `/certificate/{id}/view` renders an existing application's certificate without approval/ownership authentication; the template does not enforce the controller's `is_approved` flag. `certificate-data` requires token auth but not participant/approval validation. Approval API does not require a request/eligible status/owner or signature. Client button visibility is not represented as a server safeguard. Posted schedule is preferred over an edited contract schedule in certificate formatting. PDF export is browser printing, not a PDF-generation/storage job.
6. **Apply/job status:** apply validates job existence but not active status. Duplicate prevention excludes cancelled applications, so cancellation allows a new application. Invalid job validation is caught by the broad exception handler and can return 500 instead of 422.
7. **UI/server validation differences:** the mobile registration password rules exceed backend min-8-plus-digit; hiring fields and interview inputs have stricter UI requirements than server validation. General profile update has field-presence checks rather than comprehensive validation. Hirer document uploads allow nullable/no-file requests. Skill maximum is enforced by UI, not the skills-array API rule.
8. **Advisory analysis:** invalid AI JSON can fall back to AI-valid upload-success remarks; skipped/failed analysis is logged. Neither result automatically sets account approval. Admin approval does not enforce successful AI analysis/document completeness.
9. **State transition checks:** application status API validates supported values but not legal previous→next transitions. UI affordances are narrower. Review API accepts accepted as well as completed/terminated, while primary UI shows concluded-contract rating. Household reviews use reviewerRole employer in current implementation.
10. **Logout differences:** student profile callback attempts server token deletion and still clears locally if it fails. Hirer profile, Settings and drawer fallback use local cleanup without API revocation. Student drawer delegation depends on the supplied callback. Admin session logout is separate. No universal server-token revocation claim is made.
11. **Firestore:** client reads/writes are implemented, but no Firestore security-rule/Firebase Auth source was found; Laravel auth is not assumed to enforce these direct database writes. Clearing the normal conversation hides older messages for the current user rather than removing the other party's history.
12. **Inactive/demo functionality excluded from live flows:** student earnings and standalone schedule/reviews screens use static sample/local data; `students/apply-job.tsx` is a mock resume/cover-letter form whose submit navigates back rather than submitting the implemented apply API. Employer subscription shows a success alert without billing/API persistence. Admin settings toggles/save alert have no persistence route. Forgot Password has no action/API. Remember Me has no separate server behavior. No payment transfer, payroll, attendance, automated suspension or new administrator self-registration was found. Test notification controls are labeled diagnostics, not user workflow requirements.

## Revised four-page diagram

The file contains exactly **Student System Flowchart**, **Employer System Flowchart**, **Household System Flowchart**, and **Admin System Flowchart**. All duplicate/copy pages and module frames were removed. Existing verified flows were consolidated into short user-facing steps; no application feature or business rule was added.

Each role tab now spans **two physical sheets of 8.5 x 13 inch portrait long/coupon bond paper**. There are still exactly four tabs and one continuous logical graph per role, not separate module diagrams. In diagrams.net, the paper is 850 x 1300 diagram units with a 2x drawing scale; the second sheet is directly below the first. Export/print using the existing portrait page breaks, preserving both sheets per role. Do not fit the entire two-sheet drawing onto a single sheet. Main process labels print at approximately 11.52 pt, with smaller labels at least 10.44 pt. All sheets retain white fills/background, black text, dark-gray arrows and plain headings without section frames.

Start at the top of sheet 1 and follow the authentication flow downward to the dashboard. Sheet 1 uses two vertical tracks, with direct arrows to nearby email/account verification or Admin directory/approval processes. Sheet 2 places the three longer feature branches side by side under their matching B, C and D entries; each branch reads downward. This reduces the previous six-column spread while keeping related validations and retries beside their processes. The E continuation leads to logout and End at the bottom of sheet 2. The branches remain alternatives selected from the dashboard, not an invented mandatory sequence of modules.

All lettered symbols are **off-page connectors between the two physical sheets**. Each letter occurs exactly twice per role: one outgoing symbol and one matching incoming symbol. Shared feature completion paths merge using direct arrows before the single outgoing A. A returns to the original dashboard entry and denotes finishing or closing a feature, rather than an invented automatic route after every API call. Mobile logout cancellation uses its own F pair because the existing flow returns directly to the feature choice, not to role resolution. Nearby links and retry paths use direct arrows.

| Connector | Student / Employer / Household | Admin |
|---|---|---|
| A | Sheet 2 → sheet 1: return to role resolution/dashboard | Sheet 2 → sheet 1: return to dashboard/statistics |
| B | Sheet 1 → sheet 2: Jobs / Apply or Post | Sheet 1 → sheet 2: Job moderation |
| C | Sheet 1 → sheet 2: Applications / applicants and contracts | Sheet 1 → sheet 2: Reports, analytics and alerts |
| D | Sheet 1 → sheet 2: Profile, communication and support | Sheet 1 → sheet 2: Messages and advisories |
| E | Sheet 1 → sheet 2: Confirm logout → logout → End | Sheet 1 → sheet 2: Logout → End |
| F | Sheet 2 → sheet 1: cancelled logout → Choose feature | Not needed: no Admin logout-confirmation process exists |

The same letter is scoped to one role tab and has exactly one matching pair there. A never continues at B. Technical details remain in the source-based sections above and in each shape's **Edit Data** properties, including original section/node references. The portrait revision changes placement, arrow routing and connector artwork only; process/decision labels, source references and business rules are preserved.

## Grouped actions and preserved rules

| Grouped flow | Preserved implemented behavior |
|---|---|
| Login / Sign up / Google | Role-specific fields, unique email/password validation, native Google selection/cancellation, existing-email lookup, error feedback and session creation. A missing Google-linked account offers Student signup. No password reset feature is invented. |
| Email verification | New signup enters OTP; an unverified login offers verification or cancel. Delivery/cooldown errors allow retry; six digits must match and be unexpired. Resend returns to delivery. Cached-session routing still bypasses this check as in the source. |
| Account verification | Role-specific uploads, rejection/pending status and advisory AI remarks; Admin approves manually. Uploading is not automatic approval. Dashboard access remains possible before approval. |
| Student Apply | **Is Account Verified?** gates submission. A current verified profile, existing job and no noncancelled duplicate are required. Both UI and API checks are represented by this gate and validation; denied users return to job details. |
| Hirer Post | **Is Account Verified?** gates creation for each hirer role. Required fields, schedule, rate and location are validated. Edit/status/delete remain owner-scoped actions; no new backend account-approval requirement is invented for them. |
| Student application action | Cancel pending/viewed; delete cancelled/rejected/completed/terminated. Certificate request is displayed for accepted/completed and remains pending until hirer issuance. Issued copies can be previewed/printed. Primary rating UI is for completed/terminated; duplicate reviews and nonparticipants are rejected by the API. |
| Hirer applicant action | View applicants/resume; invite or edit interview; hire after interview in UI; reject/delete; complete or terminate an accepted contract; sign and issue requested certificates; view issued copies; rate concluded work. Posted schedules prefill editable hiring terms. Form/confirmation rules depend on the selected action. |
| Profile / files | Edit own details/location/avatar, Student skills/availability/resume, file viewing, local settings/theme, Terms/Privacy/About. Skill and file validations remain tool-specific. |
| Chat / notices | Read/send messages and public profiles; clear the current user's history; load/read/open notifications. Push/device/provider failure does not roll back the main saved action. |
| Reports / help | Incident submission and own history, duplicate report feedback, FAQs and DARA responses. Invalid input/provider failures show feedback. No ticket system or automatic penalty is added. |
| Contact / maps | Existing phone/email/share/document/map actions, available coordinates/address fallback and optional foreground routing. No attendance or payment process is added. |
| Admin | Existing session login, read-only user directory, manual profile approval/rejection, job moderation, report investigation/status/notes/deletion/alerts, Firestore conversation oversight/advisories and session logout. Inactive settings persistence is omitted from the active flow. |

## Revision validation

The portrait XML was compared against the immediately preceding diagram after resolving connector/junction routing. Every original process-to-process transition and branch label is identical, with no added or removed semantic edges; process/decision labels and their source/business-rule metadata are unchanged. Additional checks cover four exact role titles, standard editable shapes, white portrait paper, two physical sheets per role, unique IDs, exact connector pairs, no symbols crossing paper boundaries, no overlapping symbols/annotations and no arrow segments passing through unrelated symbols. The existing verification gates and all success/failure paths remain intact. Text-fit checks and local rendered previews cover all eight sheets. Native diagrams.net GUI import/PDF export was not exercised; the editable XML remains the master for native vector export.

| Role | Flow symbols (excluding routing junctions) | Decisions | Off-page connector symbols / pairs |
|---|---:|---:|---:|
| Student | 82 | 22 | 12 / 6 |
| Employer | 80 | 21 | 12 / 6 |
| Household | 80 | 21 | 12 / 6 |
| Admin | 63 | 14 | 10 / 5 |

The preceding source audit covered 268 files and 45,229 lines, with SHA-256 `9b73997b20efc9d9ba8b6c7d4d4ca009a0466813eff975e1b774f3d9ae2cc702` (sorted path + NUL + raw bytes + NUL). That audit checked routes, authorization/verification controllers and relevant screens. This portrait-only revision preserves the audited graph rather than introducing new source-derived behavior. Application code and production data were not modified.

### Route coverage

The API base prefix is `/api`; rows below use the path as declared in each route file. The four role pages group these declared routes into their on-page sections. Public file/certificate serving is shown as a supporting process, not an additional role. Inactive settings routes are retained in this source audit; settings persistence is omitted from the active diagram.

| Source | Method | Declared path | Handler |
|---|---|---|---|
| `api.php` | GET | `/user` | `Inline route closure` |
| `api.php` | POST | `/register/student` | `AuthController::registerStudent` |
| `api.php` | POST | `/register/employer` | `AuthController::registerEmployer` |
| `api.php` | POST | `/register/household` | `AuthController::registerHousehold` |
| `api.php` | POST | `/login` | `AuthController::login` |
| `api.php` | POST | `/google-login` | `AuthController::googleLogin` |
| `api.php` | GET | `/dashboard-data` | `DashboardController::getDashboardData` |
| `api.php` | POST | `/jobs` | `JobController::store` |
| `api.php` | GET | `/jobs/{id}` | `JobController::show` |
| `api.php` | PUT | `/jobs/{id}` | `JobController::update` |
| `api.php` | DELETE | `/jobs/{id}` | `JobController::destroy` |
| `api.php` | POST | `/employer/add-profile` | `EmployerController::addAvatar` |
| `api.php` | GET | `/employer/jobs` | `EmployerController::postedJobs` |
| `api.php` | GET | `/employer/jobs/{jobId}/applicants` | `EmployerController::getJobApplicants` |
| `api.php` | PATCH | `/employer/jobs/{jobId}/status` | `EmployerController::updateJobStatus` |
| `api.php` | GET | `/employer/applicants` | `EmployerController::getAllApplicants` |
| `api.php` | GET | `/employer/applications/{applicationId}` | `EmployerController::getApplicationDetails` |
| `api.php` | PUT | `/employer/applications/{applicationId}/status` | `EmployerController::updateApplicationStatus` |
| `api.php` | DELETE | `/employer/applications/{applicationId}` | `EmployerController::deleteApplication` |
| `api.php` | GET | `/user/profile` | `AuthController::getUserProfile` |
| `api.php` | GET | `/users/verification-statuses` | `AuthController::getVerificationStatuses` |
| `api.php` | GET | `/user/{id}/public-profile` | `AuthController::getPublicUserProfile` |
| `api.php` | POST | `/user/update-profile` | `AuthController::updateUserProfile` |
| `api.php` | POST | `/email/send-otp` | `AuthController::sendOtp` |
| `api.php` | POST | `/email/verify-otp` | `AuthController::verifyOtp` |
| `api.php` | GET | `/student/profile` | `StudentController::getProfile` |
| `api.php` | POST | `/student/update-push-token` | `StudentController::updatePushToken` |
| `api.php` | POST | `/student/update-availability` | `StudentController::updateAvailability` |
| `api.php` | POST | `/student/update-skills` | `StudentController::updateSkills` |
| `api.php` | POST | `/student/upload-doc` | `StudentController::uploadStudentDoc` |
| `api.php` | GET | `/student/nearby-jobs` | `JobMatchingController::getNearbyJobs` |
| `api.php` | GET | `/student/all-jobs` | `StudentController::getAllJobs` |
| `api.php` | GET | `/student/applications` | `StudentController::myApplications` |
| `api.php` | GET | `/student/applications/{id}` | `JobApplicationController::getApplicationDetails` |
| `api.php` | GET | `/student/ai-matched-jobs` | `JobMatchingController::getMatchedJobs` |
| `api.php` | POST | `/student/apply-job` | `JobApplicationController::applyJob` |
| `api.php` | POST | `/student/applications/{id}/cancel` | `JobApplicationController::cancelApplication` |
| `api.php` | DELETE | `/student/applications/{id}` | `JobApplicationController::deleteApplication` |
| `api.php` | POST | `/student/applications/{id}/delete` | `JobApplicationController::deleteApplication` |
| `api.php` | GET | `/student/saved-jobs` | `StudentController::getSavedJobs` |
| `api.php` | POST | `/student/toggle-save-job` | `StudentController::toggleSaveJob` |
| `api.php` | POST | `/student/applications/{id}/request-certificate` | `CertificateController::requestCertificate` |
| `api.php` | POST | `/employer/applications/{id}/approve-certificate` | `CertificateController::approveCertificate` |
| `api.php` | GET | `/applications/{id}/certificate-data` | `CertificateController::getCertificateData` |
| `api.php` | GET | `/applications/{id}/reviews` | `ContractReviewController::getReviews` |
| `api.php` | POST | `/applications/{id}/reviews` | `ContractReviewController::submitReview` |
| `api.php` | POST | `/reports` | `ReportApiController::store` |
| `api.php` | GET | `/reports/my-reports` | `ReportApiController::myReports` |
| `api.php` | POST | `/support/ai-chat` | `SupportAiController::chat` |
| `api.php` | POST | `/logout` | `AuthController::logout` |
| `api.php` | POST | `/upload-verification-doc` | `VerificationController::uploadVerificationDoc` |
| `web.php` | GET | `/` | `Inline route closure` |
| `web.php` | GET | `/certificate/{id}/view` | `CertificateWebController::viewCertificate` |
| `web.php` | GET | `/storage/{path}` | `Inline route closure` |
| `web.php` | GET | `/admin/login` | `AuthController::showLoginForm` |
| `web.php` | GET | `/login` | `AuthController::showLoginForm` |
| `web.php` | POST | `/admin/login` | `AuthController::login` |
| `web.php` | POST | `/login` | `AuthController::login` |
| `web.php` | GET | `/admin/dashboard` | `DashboardController::index` |
| `web.php` | GET | `/admin/verification` | `VerificationController::verificationIndex` |
| `web.php` | POST | `/admin/verification/reject/{id}` | `VerificationController::rejectVerification` |
| `web.php` | POST | `/admin/verification/approve/{id}` | `VerificationController::approveVerification` |
| `web.php` | GET | `/admin/users` | `UserController::usersIndex` |
| `web.php` | GET | `/admin/job-moderation` | `JobModerationController::index` |
| `web.php` | POST | `/admin/job-moderation/{id}/toggle` | `JobModerationController::toggleStatus` |
| `web.php` | PATCH | `/admin/job-moderation/{id}/status` | `JobModerationController::updateStatus` |
| `web.php` | DELETE | `/admin/job-moderation/{id}` | `JobModerationController::destroy` |
| `web.php` | GET | `/admin/reports` | `ReportController::index` |
| `web.php` | GET | `/admin/notifications/poll` | `ReportController::pollNotifications` |
| `web.php` | PATCH | `/admin/reports/{id}/status` | `ReportController::updateStatus` |
| `web.php` | DELETE | `/admin/reports/{id}` | `ReportController::destroy` |
| `web.php` | GET | `/admin/messages` | `MessageController::index` |
| `web.php` | GET | `/admin/settings` | `Inline route closure` |
| `web.php` | POST | `/admin/logout` | `AuthController::logout` |

### Source inventory

<details>
<summary>First-party source/config/schema files scanned (paths and line counts)</summary>

| File | Lines |
|---|---:|
| `DISKARTECH/api/axios.ts` | 82 |
| `DISKARTECH/app.json` | 86 |
| `DISKARTECH/app/_layout.tsx` | 212 |
| `DISKARTECH/app/about-diskartech.tsx` | 555 |
| `DISKARTECH/app/auth/employer-register.tsx` | 399 |
| `DISKARTECH/app/auth/household-register.tsx` | 410 |
| `DISKARTECH/app/auth/login.tsx` | 431 |
| `DISKARTECH/app/auth/student-register.tsx` | 456 |
| `DISKARTECH/app/auth/verify-email.tsx` | 337 |
| `DISKARTECH/app/auth/welcome.tsx` | 196 |
| `DISKARTECH/app/chat.tsx` | 622 |
| `DISKARTECH/app/edit-profile.tsx` | 699 |
| `DISKARTECH/app/employer/(tabs)/_layout.tsx` | 84 |
| `DISKARTECH/app/employer/(tabs)/dashboard.tsx` | 596 |
| `DISKARTECH/app/employer/(tabs)/jobs.tsx` | 427 |
| `DISKARTECH/app/employer/(tabs)/messages.tsx` | 322 |
| `DISKARTECH/app/employer/(tabs)/profile.tsx` | 814 |
| `DISKARTECH/app/employer/applicant-details.tsx` | 878 |
| `DISKARTECH/app/employer/applicants-list.tsx` | 257 |
| `DISKARTECH/app/employer/job-posting.tsx` | 905 |
| `DISKARTECH/app/employer/subscription.tsx` | 193 |
| `DISKARTECH/app/employer/verification-status.tsx` | 295 |
| `DISKARTECH/app/help-center.tsx` | 645 |
| `DISKARTECH/app/index.tsx` | 135 |
| `DISKARTECH/app/notifications.tsx` | 844 |
| `DISKARTECH/app/onboarding.tsx` | 177 |
| `DISKARTECH/app/reviews/rate-contract.tsx` | 508 |
| `DISKARTECH/app/settings.tsx` | 303 |
| `DISKARTECH/app/students/(tabs)/_layout.tsx` | 87 |
| `DISKARTECH/app/students/(tabs)/applications.tsx` | 732 |
| `DISKARTECH/app/students/(tabs)/home.tsx` | 584 |
| `DISKARTECH/app/students/(tabs)/messages.tsx` | 314 |
| `DISKARTECH/app/students/(tabs)/profile.tsx` | 420 |
| `DISKARTECH/app/students/(tabs)/search.tsx` | 468 |
| `DISKARTECH/app/students/accepted-job.tsx` | 1143 |
| `DISKARTECH/app/students/application-details.tsx` | 1081 |
| `DISKARTECH/app/students/apply-job.tsx` | 97 |
| `DISKARTECH/app/students/earnings.tsx` | 107 |
| `DISKARTECH/app/students/job-details.tsx` | 718 |
| `DISKARTECH/app/students/reviews.tsx` | 71 |
| `DISKARTECH/app/students/schedule.tsx` | 102 |
| `DISKARTECH/app/students/verification-status.tsx` | 317 |
| `DISKARTECH/babel.config.js` | 10 |
| `DISKARTECH/components/_template/collapsible.tsx` | 45 |
| `DISKARTECH/components/_template/external-link.tsx` | 25 |
| `DISKARTECH/components/_template/hello-wave.tsx` | 19 |
| `DISKARTECH/components/_template/parallax-scroll-view.tsx` | 79 |
| `DISKARTECH/components/_template/themed-text.tsx` | 60 |
| `DISKARTECH/components/_template/themed-view.tsx` | 14 |
| `DISKARTECH/components/auth/GoogleRegisterButton.tsx` | 498 |
| `DISKARTECH/components/common/CertificateModal.tsx` | 290 |
| `DISKARTECH/components/common/ReportModal.tsx` | 303 |
| `DISKARTECH/components/common/SupportAiModal.tsx` | 491 |
| `DISKARTECH/components/employer/applicant-details/ApplicantDetailsContent.tsx` | 228 |
| `DISKARTECH/components/employer/job-details/JobActionsBar.tsx` | 229 |
| `DISKARTECH/components/employer/job-details/JobDetailsCards.tsx` | 139 |
| `DISKARTECH/components/employer/modals/BusinessTypeModal.tsx` | 71 |
| `DISKARTECH/components/employer/modals/DigitalSignatureModal.tsx` | 435 |
| `DISKARTECH/components/employer/modals/HireModal.tsx` | 489 |
| `DISKARTECH/components/employer/modals/InterviewModal.tsx` | 311 |
| `DISKARTECH/components/employer/modals/JobDetailsModal.tsx` | 128 |
| `DISKARTECH/components/employer/modals/TerminateContractModal.tsx` | 251 |
| `DISKARTECH/components/household/modals/HireModal.tsx` | 1 |
| `DISKARTECH/components/household/modals/TerminateContractModal.tsx` | 1 |
| `DISKARTECH/components/student/ApplicationHiredCard.tsx` | 50 |
| `DISKARTECH/components/student/ApplicationRejectedCard.tsx` | 17 |
| `DISKARTECH/components/student/CertificateOfEmploymentCard.tsx` | 62 |
| `DISKARTECH/components/student/ContractConcludedCard.tsx` | 94 |
| `DISKARTECH/components/student/ContractRatingCard.tsx` | 45 |
| `DISKARTECH/components/student/DocumentCard.tsx` | 116 |
| `DISKARTECH/components/student/DocumentPlaceholderCard.tsx` | 39 |
| `DISKARTECH/components/student/EmployerContactCard.tsx` | 64 |
| `DISKARTECH/components/student/EmploymentContractCard.tsx` | 105 |
| `DISKARTECH/components/student/InterviewInformationCard.tsx` | 58 |
| `DISKARTECH/components/student/JobCard.tsx` | 186 |
| `DISKARTECH/components/student/JobOverviewCard.tsx` | 46 |
| `DISKARTECH/components/student/application-details/ApplicationSection.tsx` | 25 |
| `DISKARTECH/components/student/application-details/ApplicationStatusCard.tsx` | 71 |
| `DISKARTECH/components/student/modals/AddSkillModal.tsx` | 117 |
| `DISKARTECH/components/student/modals/ApplicationDetailsModal.tsx` | 490 |
| `DISKARTECH/components/student/modals/CourseModal.tsx` | 71 |
| `DISKARTECH/components/student/modals/EditAvailabilityModal.tsx` | 132 |
| `DISKARTECH/components/student/modals/YearLevelModal.tsx` | 62 |
| `DISKARTECH/components/ui/Avatar.tsx` | 89 |
| `DISKARTECH/components/ui/Badge.tsx` | 65 |
| `DISKARTECH/components/ui/BaseRegisterScreen.tsx` | 147 |
| `DISKARTECH/components/ui/CategoryCard.tsx` | 57 |
| `DISKARTECH/components/ui/Chip.tsx` | 117 |
| `DISKARTECH/components/ui/EmptyState.tsx` | 87 |
| `DISKARTECH/components/ui/GlassCard.tsx` | 27 |
| `DISKARTECH/components/ui/InfoRow.tsx` | 26 |
| `DISKARTECH/components/ui/InputField.tsx` | 109 |
| `DISKARTECH/components/ui/InputSuggestions.tsx` | 99 |
| `DISKARTECH/components/ui/LoadingSkeleton.tsx` | 131 |
| `DISKARTECH/components/ui/NotificationCard.tsx` | 77 |
| `DISKARTECH/components/ui/PrimaryButton.tsx` | 168 |
| `DISKARTECH/components/ui/SafeStatusBar.tsx` | 70 |
| `DISKARTECH/components/ui/SearchBar.tsx` | 100 |
| `DISKARTECH/components/ui/haptic-tab.tsx` | 18 |
| `DISKARTECH/components/ui/icon-symbol.ios.tsx` | 32 |
| `DISKARTECH/components/ui/icon-symbol.tsx` | 41 |
| `DISKARTECH/components/ui/modals/ChatOptionsModal.tsx` | 115 |
| `DISKARTECH/components/ui/modals/DocumentViewerModal.tsx` | 362 |
| `DISKARTECH/components/ui/modals/GenderModal.tsx` | 59 |
| `DISKARTECH/components/ui/modals/LoadingModal.tsx` | 71 |
| `DISKARTECH/components/ui/modals/LocationPickerModal.tsx` | 599 |
| `DISKARTECH/components/ui/modals/MapViewerModal.tsx` | 1178 |
| `DISKARTECH/components/ui/modals/NotificationModal.tsx` | 100 |
| `DISKARTECH/components/ui/modals/SideDrawerMenu.tsx` | 823 |
| `DISKARTECH/components/ui/modals/UserProfileModal.tsx` | 354 |
| `DISKARTECH/constants/colors.ts` | 44 |
| `DISKARTECH/constants/theme.ts` | 24 |
| `DISKARTECH/constants/typography.ts` | 148 |
| `DISKARTECH/data/applications.ts` | 81 |
| `DISKARTECH/data/faqs.ts` | 58 |
| `DISKARTECH/data/jobRequirements.ts` | 28 |
| `DISKARTECH/data/jobSchedule.ts` | 8 |
| `DISKARTECH/data/jobs.ts` | 189 |
| `DISKARTECH/data/messages.ts` | 76 |
| `DISKARTECH/data/notifications.ts` | 74 |
| `DISKARTECH/data/skills.ts` | 61 |
| `DISKARTECH/hooks/use-color-scheme.ts` | 14 |
| `DISKARTECH/hooks/use-color-scheme.web.ts` | 21 |
| `DISKARTECH/hooks/use-theme-color.ts` | 21 |
| `DISKARTECH/hooks/useDarkMode.tsx` | 150 |
| `DISKARTECH/hooks/useStudentProfile.ts` | 489 |
| `DISKARTECH/hooks/useUnreadNotifications.ts` | 168 |
| `DISKARTECH/package.json` | 70 |
| `DISKARTECH/scripts/reset-project.js` | 112 |
| `DISKARTECH/tsconfig.json` | 18 |
| `DISKARTECH/utils/authNavigation.ts` | 22 |
| `DISKARTECH/utils/chat.ts` | 676 |
| `DISKARTECH/utils/chatHelpers.ts` | 345 |
| `DISKARTECH/utils/firebase.ts` | 30 |
| `DISKARTECH/utils/fuzzySearch.ts` | 231 |
| `DISKARTECH/utils/googleAuth.ts` | 82 |
| `DISKARTECH/utils/helpers.ts` | 84 |
| `DISKARTECH/utils/notifications.ts` | 567 |
| `diskartech-backend/app/Http/Controllers/Admin/AuthController.php` | 48 |
| `diskartech-backend/app/Http/Controllers/Admin/DashboardController.php` | 36 |
| `diskartech-backend/app/Http/Controllers/Admin/JobModerationController.php` | 118 |
| `diskartech-backend/app/Http/Controllers/Admin/MessageController.php` | 83 |
| `diskartech-backend/app/Http/Controllers/Admin/ReportController.php` | 258 |
| `diskartech-backend/app/Http/Controllers/Admin/UserController.php` | 42 |
| `diskartech-backend/app/Http/Controllers/Admin/VerificationController.php` | 86 |
| `diskartech-backend/app/Http/Controllers/Api/AuthController.php` | 719 |
| `diskartech-backend/app/Http/Controllers/Api/CertificateController.php` | 191 |
| `diskartech-backend/app/Http/Controllers/Api/ContractReviewController.php` | 235 |
| `diskartech-backend/app/Http/Controllers/Api/DashboardController.php` | 39 |
| `diskartech-backend/app/Http/Controllers/Api/EmployerController.php` | 253 |
| `diskartech-backend/app/Http/Controllers/Api/JobApplicationController.php` | 250 |
| `diskartech-backend/app/Http/Controllers/Api/JobController.php` | 209 |
| `diskartech-backend/app/Http/Controllers/Api/JobMatchingController.php` | 354 |
| `diskartech-backend/app/Http/Controllers/Api/ReportApiController.php` | 107 |
| `diskartech-backend/app/Http/Controllers/Api/ReviewController.php` | 10 |
| `diskartech-backend/app/Http/Controllers/Api/StudentController.php` | 273 |
| `diskartech-backend/app/Http/Controllers/Api/SupportAiController.php` | 146 |
| `diskartech-backend/app/Http/Controllers/Api/VerificationController.php` | 84 |
| `diskartech-backend/app/Http/Controllers/CertificateWebController.php` | 87 |
| `diskartech-backend/app/Http/Controllers/Controller.php` | 8 |
| `diskartech-backend/app/Jobs/AnalyzeVerificationDocument.php` | 149 |
| `diskartech-backend/app/Models/Admin.php` | 23 |
| `diskartech-backend/app/Models/AvailableJob.php` | 39 |
| `diskartech-backend/app/Models/ContractReview.php` | 12 |
| `diskartech-backend/app/Models/Employer.php` | 50 |
| `diskartech-backend/app/Models/Household.php` | 50 |
| `diskartech-backend/app/Models/JobApplication.php` | 50 |
| `diskartech-backend/app/Models/Jobs.php` | 49 |
| `diskartech-backend/app/Models/Report.php` | 43 |
| `diskartech-backend/app/Models/Review.php` | 43 |
| `diskartech-backend/app/Models/SavedJob.php` | 10 |
| `diskartech-backend/app/Models/Student.php` | 76 |
| `diskartech-backend/app/Models/User.php` | 55 |
| `diskartech-backend/app/Providers/AppServiceProvider.php` | 27 |
| `diskartech-backend/app/Services/GmailDeliveryException.php` | 10 |
| `diskartech-backend/app/Services/GmailOtpMailer.php` | 76 |
| `diskartech-backend/bootstrap/app.php` | 19 |
| `diskartech-backend/bootstrap/providers.php` | 7 |
| `diskartech-backend/composer.json` | 89 |
| `diskartech-backend/config/app.php` | 126 |
| `diskartech-backend/config/auth.php` | 126 |
| `diskartech-backend/config/cache.php` | 117 |
| `diskartech-backend/config/database.php` | 185 |
| `diskartech-backend/config/filesystems.php` | 80 |
| `diskartech-backend/config/logging.php` | 132 |
| `diskartech-backend/config/mail.php` | 118 |
| `diskartech-backend/config/queue.php` | 129 |
| `diskartech-backend/config/sanctum.php` | 87 |
| `diskartech-backend/config/services.php` | 57 |
| `diskartech-backend/config/session.php` | 217 |
| `diskartech-backend/database/factories/UserFactory.php` | 45 |
| `diskartech-backend/database/migrations/0001_01_01_000000_create_users_table.php` | 24 |
| `diskartech-backend/database/migrations/0001_01_01_000001_create_cache_table.php` | 35 |
| `diskartech-backend/database/migrations/0001_01_01_000002_create_jobs_table.php` | 57 |
| `diskartech-backend/database/migrations/2026_08_14_023508_create_job_postings_table.php` | 35 |
| `diskartech-backend/database/migrations/2026_08_14_025124_create_personal_access_tokens_table.php` | 33 |
| `diskartech-backend/database/migrations/2026_08_14_052501_create_students_table.php` | 34 |
| `diskartech-backend/database/migrations/2026_08_14_052502_create_employers_table.php` | 28 |
| `diskartech-backend/database/migrations/2026_08_14_052503_create_households_table.php` | 28 |
| `diskartech-backend/database/migrations/2026_08_14_052632_create_available_jobs_table.php` | 31 |
| `diskartech-backend/database/migrations/2026_08_14_052633_create_job_applications_table.php` | 24 |
| `diskartech-backend/database/migrations/2026_08_14_054501_add_verification_and_subscription_columns.php` | 24 |
| `diskartech-backend/database/migrations/2026_08_14_054735_change_status_to_is_verified.php` | 28 |
| `diskartech-backend/database/migrations/2026_08_14_054840_add_is_verified_column_to_profiles.php` | 33 |
| `diskartech-backend/database/migrations/2026_08_14_055049_add_subscription_columns_to_employers_table.php` | 27 |
| `diskartech-backend/database/migrations/2026_08_14_055222_add_is_subscribed_columns_to_employers_table.php` | 31 |
| `diskartech-backend/database/migrations/2026_08_14_055406_rename_contact_person_to_contact_number_in_students_table.php` | 26 |
| `diskartech-backend/database/migrations/2026_08_14_055708_add_contact_columns_to_employers_table.php` | 27 |
| `diskartech-backend/database/migrations/2026_08_14_055816_add_contact_number_to_households_table.php` | 24 |
| `diskartech-backend/database/migrations/2026_08_14_061117_drop_contact_person_from_employers_table.php` | 24 |
| `diskartech-backend/database/migrations/2026_08_14_062223_add_age_and_gender_to_households_table.php` | 27 |
| `diskartech-backend/database/migrations/2026_08_14_064619_rename_contact_number_to_cp_number_in_households_table.php` | 26 |
| `diskartech-backend/database/migrations/2026_08_14_065411_add_missing_columns_to_households_table.php` | 30 |
| `diskartech-backend/database/migrations/2026_08_14_080148_add_course_to_students_table.php` | 25 |
| `diskartech-backend/database/migrations/2026_08_14_080659_add_missing_columns_to_students_table.php` | 33 |
| `diskartech-backend/database/migrations/2026_08_14_081831_add_detailed_address_to_employers_table.php` | 24 |
| `diskartech-backend/database/migrations/2026_08_14_082413_add_hirer_name_to_employers_table.php` | 24 |
| `diskartech-backend/database/migrations/2026_08_14_092718_create_admins_table.php` | 31 |
| `diskartech-backend/database/migrations/2026_08_14_195603_add_valid_id_path_to_employers_table.php` | 29 |
| `diskartech-backend/database/migrations/2026_08_15_055703_add_business_type_to_employers_table.php` | 26 |
| `diskartech-backend/database/migrations/2026_08_15_082210_add_ai_verification_to_profiles_table.php` | 35 |
| `diskartech-backend/database/migrations/2026_08_18_110630_add_availability_columns_to_student_table.php` | 27 |
| `diskartech-backend/database/migrations/2026_08_19_102725_add_cert_ai_columns_to_employers_table.php` | 26 |
| `diskartech-backend/database/migrations/2026_08_21_164702_add_category_to_job_postings_table.php` | 28 |
| `diskartech-backend/database/migrations/2026_08_21_172720_update_job_postings_schedule_columns.php` | 30 |
| `diskartech-backend/database/migrations/2026_08_22_112919_create_available_jobs_table.php` | 39 |
| `diskartech-backend/database/migrations/2026_08_22_115419_add_status_and_location_to_available_jobs_table.php` | 27 |
| `diskartech-backend/database/migrations/2026_08_22_161259_create_saved_jobs_table.php` | 29 |
| `diskartech-backend/database/migrations/2026_08_23_180841_add_expo_push_token_to_students_table.php` | 22 |
| `diskartech-backend/database/migrations/2026_09_24_171703_add_is_email_verified_to_users_table.php` | 25 |
| `diskartech-backend/database/migrations/2026_09_24_172447_add_otp_columns_to_users_table.php` | 26 |
| `diskartech-backend/database/migrations/2026_10_03_054826_add_interview_details_to_job_applications_table.php` | 31 |
| `diskartech-backend/database/migrations/2026_10_03_063000_add_hiring_details_to_job_applications_table.php` | 32 |
| `diskartech-backend/database/migrations/2026_10_03_080706_add_contract_and_termination_to_job_applications_table.php` | 31 |
| `diskartech-backend/database/migrations/2026_10_03_093000_add_certificate_fields_to_job_applications_table.php` | 34 |
| `diskartech-backend/database/migrations/2026_10_03_093609_add_employer_signature_to_job_applications_table.php` | 28 |
| `diskartech-backend/database/migrations/2026_10_03_140441_create_contract_reviews_table.php` | 36 |
| `diskartech-backend/database/migrations/2026_10_05_123627_add_rejection_reason_to_students_table.php` | 28 |
| `diskartech-backend/database/migrations/2026_10_05_140029_create_reports_table.php` | 37 |
| `diskartech-backend/database/migrations/2026_10_06_061000_rename_contract_reviews_to_reviews_table.php` | 23 |
| `diskartech-backend/database/migrations/2026_10_06_093000_add_ai_verification_columns_to_students_table.php` | 36 |
| `diskartech-backend/database/migrations/2026_10_08_065000_add_avatar_to_students_and_employers_table.php` | 44 |
| `diskartech-backend/database/migrations/2026_10_08_070000_add_remaining_missing_columns_to_profiles_and_jobs.php` | 79 |
| `diskartech-backend/database/seeders/DatabaseSeeder.php` | 25 |
| `diskartech-backend/resources/css/app.css` | 11 |
| `diskartech-backend/resources/js/app.js` | 1 |
| `diskartech-backend/resources/js/bootstrap.js` | 4 |
| `diskartech-backend/resources/views/admin/auth/login.blade.php` | 60 |
| `diskartech-backend/resources/views/admin/dashboard.blade.php` | 246 |
| `diskartech-backend/resources/views/admin/job-moderation.blade.php` | 552 |
| `diskartech-backend/resources/views/admin/messages.blade.php` | 599 |
| `diskartech-backend/resources/views/admin/partials/verification-modal.blade.php` | 280 |
| `diskartech-backend/resources/views/admin/reports.blade.php` | 596 |
| `diskartech-backend/resources/views/admin/settings.blade.php` | 81 |
| `diskartech-backend/resources/views/admin/users.blade.php` | 89 |
| `diskartech-backend/resources/views/admin/verification.blade.php` | 212 |
| `diskartech-backend/resources/views/certificate/print.blade.php` | 328 |
| `diskartech-backend/resources/views/components/admin-layout.blade.php` | 504 |
| `diskartech-backend/resources/views/landing.blade.php` | 77 |
| `diskartech-backend/routes/api.php` | 104 |
| `diskartech-backend/routes/console.php` | 8 |
| `diskartech-backend/routes/web.php` | 74 |
| `diskartech-backend/tests/Feature/EmailOtpTest.php` | 219 |
| `diskartech-backend/tests/Feature/ExampleTest.php` | 19 |
| `diskartech-backend/tests/Feature/JobMatchingProviderTest.php` | 259 |
| `diskartech-backend/tests/Feature/JobMatchingTest.php` | 234 |
| `diskartech-backend/tests/TestCase.php` | 10 |
| `diskartech-backend/tests/Unit/ExampleTest.php` | 16 |

</details>
