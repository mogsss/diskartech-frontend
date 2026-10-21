export interface PolicySection {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export interface PolicyDocument {
  title: string;
  introduction: string;
  updated: string;
  sections: readonly PolicySection[];
}

export const TERMS_AND_CONDITIONS: PolicyDocument = {
  title: 'Terms and Conditions',
  introduction: 'Please read these terms when using DiskarTech to find work, post jobs, and manage employment activities.',
  updated: 'October 21, 2026',
  sections: [
    {
      title: 'About DiskarTech',
      paragraphs: ['DiskarTech connects students with employers and household hirers for part-time work. The app supports job listings, applications, messaging, employment contracts, reviews, and certificate requests.', 'Students and hirers are responsible for reviewing job details and agreeing on their employment arrangements. A listing or match score does not guarantee a job, a suitable applicant, or payment.'],
    },
    {
      title: 'Your account',
      paragraphs: ['Provide accurate registration, contact, school, business, and profile details. Keep your information up to date and submit only documents that belong to you or that you are authorized to provide.', 'Keep your password and email verification codes private. Do not impersonate another person, share an account to misrepresent your identity, or use someone else\'s documents.'],
    },
    {
      title: 'Email and account verification',
      paragraphs: ['Email verification and account document verification are separate steps. Follow the email or OTP instructions shown during registration and sign-in.', 'Students must have a verified account before applying for jobs. Employers and household hirers must have a verified account before posting jobs. Document analysis may use AI to assist administrators; submitting a document does not guarantee approval.', 'If verification is rejected, review the displayed reason, correct your documents, and resubmit them through the verification screens.'],
    },
    {
      title: 'Job posts and applications',
      paragraphs: ['Hirers must clearly describe the work, location, requirements, skills, schedule, and pay rate. Specify whether the advertised rate is per day or per hour. Do not publish misleading, unlawful, unsafe, or discriminatory job offers.', 'Students should review the schedule, requirements, and rate before applying. Keep availability accurate and communicate changes with the hirer. Application updates describe the recruitment stage; being accepted as an applicant does not by itself confirm an active employment contract.'],
    },
    {
      title: 'Contracts, schedules, and compensation',
      paragraphs: ['Review the employment contract, including the final rate, work days, time slots, dates, and other conditions, before accepting it. Contract details may differ from the original job post when the hirer changes an offer.', 'Confirm the amount, payment dates, payment method, and any lawful deductions with the hirer before starting work. Hirers are responsible for the agreed compensation and appropriate working conditions.', 'Report concerns about unpaid or underpaid work, unsafe conditions, or misleading offers through the Help Center.'],
    },
    {
      title: 'Salary payments outside DiskarTech',
      paragraphs: [
        'Salary and other work compensation are paid directly by the hirer to the student outside DiskarTech, using the lawful payment method agreed by the parties. DiskarTech does not collect, hold, transfer, or release salary payments and does not provide payroll or salary escrow services.',
        'Job rates, contract amounts, and earnings summaries shown in the app are records or estimates, not confirmation that payment was made or received. Keep your own payment records and receipts.',
        'Payments for a DiskarTech Pro subscription are separate from salary payments. Buying a subscription does not pay a student\'s wages.',
      ],
    },
    {
      title: 'Mandatory benefits and legal obligations',
      paragraphs: [
        'Employers and household hirers must comply with applicable Philippine labor and social protection requirements. Where required by law, they are responsible for registration, reporting, and remittance of SSS, PhilHealth, and Pag-IBIG contributions and for providing other mandatory employment benefits, including any required employer share.',
        'DiskarTech does not calculate, deduct, or remit these contributions or administer statutory benefits. These limits on the app\'s features do not remove or waive rights and obligations under applicable law. Coverage depends on the actual work arrangement and applicable legal requirements; describing work as student, part-time, temporary, or a quick errand does not by itself establish an exemption.',
        'For questions about coverage or employment rights, contact the relevant agency, such as DOLE, SSS, PhilHealth, or Pag-IBIG. Reporting a concern in DiskarTech does not replace the appropriate government complaint or assistance process.',
      ],
    },
    {
      title: 'Safe and respectful use',
      paragraphs: ['Use messages, reviews, and reports respectfully and honestly. Do not harass others, upload forged documents, expose another person\'s private information, or submit knowingly false reports.', 'Do not demand registration fees, deposits, or other upfront payments from students in exchange for a job offer. Do not share passwords, OTPs, or unnecessary financial information in chat or support conversations.'],
    },
    {
      title: 'Reviews and employment certificates',
      paragraphs: ['Reviews should describe an actual work experience and should not contain threats or private information about another person.', 'Certificate requests depend on the available actions and employment status shown in the app. A request does not automatically issue a certificate; the hirer must process the request. Certificate details should accurately reflect the employment record.'],
    },
    {
      title: 'AI assistance and service availability',
      paragraphs: ['Job matching, document analysis, and DARA support may use automated assistance. AI suggestions can be incomplete or inaccurate. Review the job, verification status, and contract information rather than relying only on an AI response.', 'Features may be temporarily unavailable because of maintenance, connection problems, or external service interruptions. Use the Help Center for guidance and to report problems.'],
    },
    {
      title: 'Privacy, updates, and questions',
      paragraphs: ['Read the Privacy Policy to understand how the app uses account information, documents, location, and communication records.', 'These terms may be updated as DiskarTech changes. The updated date on this screen identifies the current text. For questions or concerns about using the platform, visit the Help Center.'],
    },
  ],
};

export const PRIVACY_POLICY: PolicyDocument = {
  title: 'Privacy Policy',
  introduction: 'This policy explains the information used by DiskarTech and the choices available when you use the app.',
  updated: 'October 16, 2026',
  sections: [
    {
      title: 'Information you provide',
      paragraphs: ['The information stored depends on your role and the features you use. It can include:'],
      bullets: [
        'Account and profile information: name, email, contact number, age where provided, profile photo, and account role.',
        'Student information: school, course, year level, skills, availability, and resume.',
        'Hirer information: business or household representative name, business type, contact details, and job posts.',
        'Verification documents: school ID, enrollment or registration documents, valid ID, and business permit where applicable.',
        'Activity records: applications, messages, contracts, reviews, certificate requests, incident reports, and notification information.',
      ],
    },
    {
      title: 'How information is used',
      paragraphs: ['DiskarTech uses this information to create and authenticate accounts, verify email addresses and account documents, display profiles and jobs, process applications and contracts, support messaging, manage certificate requests, and review reports.', 'Skills and availability help recommend jobs. Location information supports nearby job results. Notification information helps deliver messages and application updates.'],
    },
    {
      title: 'Location and device permissions',
      paragraphs: ['DiskarTech uses device access for the features described below. Depending on your device and operating system, you may be asked to allow a permission or select a photo or document through a system picker.'],
      bullets: [
        'Location: Used to find your current position on the map and help select a workplace or profile location. Saved addresses and map coordinates support nearby jobs and distance information. If you decline device location access, you can still search for an address or select a map pin where that option is available.',
        'Camera: Used to share your video with the other participant during an online interview.',
        'Microphone: Used to share your voice with the other participant during an online interview.',
        'Photos and selected documents: Used when you choose a profile photo, resume, verification document, or chat attachment. Files you select and submit are uploaded for the relevant feature. Declining access or cancelling the picker may prevent that upload.',
        'Notifications: Used to deliver message alerts and application updates. When push notifications are enabled, a device push token is registered to deliver these alerts. If notifications are denied or disabled, system push alerts may not appear; you can still open the app to check messages and updates.',
      ],
    },
    {
      title: 'Managing permissions and interview controls',
      paragraphs: ['You can review, allow, or revoke available permissions in your phone settings for DiskarTech. Push notification preferences are also available in the app Settings. The names and available options may vary by device and operating system.', 'If either camera or microphone permission is denied, joining an online interview may be unavailable. Once connected, the call controls let you turn your camera off, mute your microphone, or leave the interview.', 'Declining a permission may limit the related feature. Revoking a permission does not automatically remove previously saved profile information or uploaded documents. See the records and privacy rights sections for information about requesting deletion.'],
    },
    {
      title: 'Information visible to others',
      paragraphs: ['Job posts and hirer details are shown to students browsing jobs. When a student applies, the hirer can view relevant applicant details and an uploaded resume. Messages are shared with the conversation participants, and work reviews can appear on profiles.', 'Administrators review verification documents, account information, and submitted reports to support verification and moderation. Employment and certificate details are used by the parties involved in the request.', 'Uploaded files are opened through document links. People who obtain a working file link may be able to view the file. Keep these links private and upload only the information needed for the relevant process.'],
    },
    {
      title: 'Connected services and AI processing',
      paragraphs: ['Google sign-in is used when you choose to connect a Google account. Firebase supports messaging and notification records, Expo supports push delivery, and the backend stores account and employment records.', 'Online interviews use LiveKit to transmit camera video and microphone audio to the other participant in the interview.', 'Google Gemini may process uploaded verification documents to assist document review. It may also process skills, availability, and job details for matching, and the messages and recent conversation history submitted to DARA support.', 'These services process the information sent to them under their own service terms and privacy practices. Avoid sending passwords, OTPs, or unnecessary sensitive information to messages or AI support.'],
    },
    {
      title: 'Storage and account security',
      paragraphs: ['Account, document, application, and employment records are stored by the backend. Messaging data is also stored using Firebase. The app saves sign-in and profile information on your device so you can continue using your account.', 'Read the Cookie Policy in Related information for details about website cookies, app storage, and how to manage them.', 'Passwords used for password-based sign-in are hashed by the backend. Keep your device and account secure, and sign out when using a shared device. No system can guarantee complete protection against every security risk.'],
    },
    {
      title: 'Records and signing out',
      paragraphs: ['Signing out clears saved account session information from the app. It does not automatically delete server-side account, message, application, or employment records.', 'To permanently delete your account, open Settings > Account > Delete account, or use Delete my account in Related information. Confirm using the deletion code sent to your registered email. This is available for password and Google accounts, including accounts with ongoing work or an active Pro plan.', 'Deletion revokes all DiskarTech login sessions, removes identifying details from your account profile, closes your job posts, cancels open applications, and marks ongoing engagements as ended in DiskarTech. Pro access ends without an automatic refund. Deletion does not settle outstanding work, payment, or other obligations. Save any documents or certificates you need before proceeding.', 'An anonymous account reference and shared work, certificate, review, payment, and safety-report records are retained. Shared messages and attachments, including copies held by other participants or connected services, are not automatically erased. Profile-file removal is processed separately and may be delayed while storage services are unavailable. This policy does not specify an automatic deletion schedule for retained records. Contact the Help Center about retained information or further deletion requests.'],
    },
    {
      title: 'Your privacy rights and choices',
      paragraphs: ['The Philippine Data Privacy Act of 2012 recognizes rights concerning personal data, including being informed, access, correction, objection, and erasure or blocking in applicable circumstances. You may also raise a privacy complaint with the National Privacy Commission.', 'You can update supported profile fields through Edit Profile and manage permissions through your device settings. For access, correction, or deletion requests that are not available as an app action, use the Help Center to raise your concern. Requests may require identity confirmation and remain subject to applicable legal requirements.'],
    },
    {
      title: 'Policy updates and questions',
      paragraphs: ['This policy may be updated when the app or its data handling changes. Refer to the updated date on this screen for the current text.', 'For questions about information used in your DiskarTech account, visit the Help Center. You can also read the National Privacy Commission\'s guidance about data subject rights using the link below.'],
    },
  ],
};

export const COOKIE_POLICY: PolicyDocument = {
  title: 'Cookie Policy',
  introduction: 'This policy explains the cookies used by DiskarTech web pages and the local storage used by the app, including the choices available to you.',
  updated: 'October 16, 2026',
  sections: [
    {
      title: 'Cookies and app storage',
      paragraphs: ['Cookies are small pieces of information stored by a browser and sent to a website with relevant requests. DiskarTech web pages, including the landing page and admin console, use browser sessions and security cookies.', 'The installed mobile app saves information using app storage. This is different from browser cookies. When you open a website, checkout page, or other external page from the app, that page can also use cookies or browser storage.'],
    },
    {
      title: 'Essential website cookies',
      paragraphs: ['These cookies support website sessions, sign-in, and form security. Cookie names and expiry settings can depend on the deployed website configuration.'],
      bullets: [
        'Session cookie: Identifies your browser session so the website can maintain sign-in state and temporary information between page requests.',
        'XSRF-TOKEN: Supports protection of form requests against cross-site request forgery.',
        'diskartech_admin_owner: Helps an admin browser prove ownership of its active admin session, including recovery after a session is lost. This cookie alone does not replace the need for authenticated access.',
      ],
    },
    {
      title: 'Information saved by the app',
      paragraphs: ['DiskarTech stores information on your device to keep your account and selected preferences available between visits. Depending on the features you use, this includes:'],
      bullets: [
        'Sign-in token and saved account/profile details used to authenticate requests and display your account.',
        'Theme preference, such as light, dark, or system appearance.',
        'Push notification preference and a saved push token used to manage delivery of message alerts and application updates.',
      ],
    },
    {
      title: 'Third-party pages and content',
      paragraphs: ['Google sign-in, the Expo app download page, and PayMongo checkout may use their own cookies or storage when you open those services. Their privacy notices and browser controls apply to those pages.', 'Some DiskarTech web pages also load fonts or interface scripts from external providers. Those providers receive technical connection information when their content is requested. Their own notices describe how they handle that information.'],
    },
    {
      title: 'How long information stays',
      paragraphs: ['Website sessions and admin ownership cookies use server-configured lifetimes. They can expire or be renewed during use. Admin logout invalidates the relevant session and clears the admin ownership cookie.', 'In the app, logout clears saved sign-in, account, and profile information. Preferences such as theme and notification settings can remain until you change them or clear app storage. Signing out or clearing device storage does not automatically delete server-side account, chat, application, or employment records.'],
    },
    {
      title: 'Your controls and choices',
      paragraphs: ['Use your browser settings to inspect, block, or clear cookies and website data for DiskarTech or an external service. Blocking essential cookies can prevent admin sign-in, session recovery, or form submissions from working correctly.', 'Use the app Settings to change theme and push notification preferences, or log out to clear the saved app session. Your phone settings may also provide an option to clear app storage; doing so can sign you out and reset preferences.', 'Camera, microphone, location, and notification permissions are managed separately in your phone settings. Clearing cookies or local app data is separate from requesting deletion of records held by DiskarTech. See the Privacy Policy or raise a request through the Help Center.'],
    },
    {
      title: 'Updates and questions',
      paragraphs: ['This policy may be updated when DiskarTech changes its use of cookies, local storage, or connected services. Refer to the updated date on this screen for the current text.', 'For questions about your information or privacy choices, read the Privacy Policy or visit the Help Center.'],
    },
  ],
};
