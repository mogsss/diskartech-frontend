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
  updated: 'October 10, 2026',
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
      paragraphs: ['Review the employment contract, including the final rate, work days, time slots, dates, and other conditions, before accepting it. Contract details may differ from the original job post when the hirer changes an offer.', 'Confirm payment arrangements with the hirer before starting work. Hirers are responsible for the agreed compensation and appropriate working conditions. An advertised rate or an earnings summary is not proof that payment has been received.', 'Report concerns about unpaid or underpaid work, unsafe conditions, or misleading offers through the Help Center.'],
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
  updated: 'October 10, 2026',
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
      paragraphs: ['Addresses and map coordinates are stored when you provide or update a pinned location. Device location permission is used for features such as selecting your location and finding nearby work.', 'Camera, photo, and document access support profile images and document uploads. You can manage these permissions in your device settings. Refusing a permission may limit the related feature.', 'Push notification preferences are available in Settings. Your device also controls whether notifications are allowed and how they appear.'],
    },
    {
      title: 'Information visible to others',
      paragraphs: ['Job posts and hirer details are shown to students browsing jobs. When a student applies, the hirer can view relevant applicant details and an uploaded resume. Messages are shared with the conversation participants, and work reviews can appear on profiles.', 'Administrators review verification documents, account information, and submitted reports to support verification and moderation. Employment and certificate details are used by the parties involved in the request.', 'Uploaded files are opened through document links. People who obtain a working file link may be able to view the file. Keep these links private and upload only the information needed for the relevant process.'],
    },
    {
      title: 'Connected services and AI processing',
      paragraphs: ['Google sign-in is used when you choose to connect a Google account. Firebase supports messaging and notification records, Expo supports push delivery, and the backend stores account and employment records.', 'Google Gemini may process uploaded verification documents to assist document review. It may also process skills, availability, and job details for matching, and the messages and recent conversation history submitted to DARA support.', 'These services process the information sent to them under their own service terms and privacy practices. Avoid sending passwords, OTPs, or unnecessary sensitive information to messages or AI support.'],
    },
    {
      title: 'Storage and account security',
      paragraphs: ['Account, document, application, and employment records are stored by the backend. Messaging data is also stored using Firebase. The app saves sign-in and profile information on your device so you can continue using your account.', 'Passwords used for password-based sign-in are hashed by the backend. Keep your device and account secure, and sign out when using a shared device. No system can guarantee complete protection against every security risk.'],
    },
    {
      title: 'Records and signing out',
      paragraphs: ['Signing out clears saved account session information from the app. It does not automatically delete server-side account, message, application, or employment records.', 'This policy does not specify an automatic deletion schedule. If you want to ask about retained information or request its deletion, raise the request through the Help Center. Deleting an application is separate from deleting your account or all related records.'],
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
