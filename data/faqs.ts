export interface FaqItem {
  id: string;
  category: 'general' | 'jobs' | 'safety' | 'payments';
  question: string;
  answer: string;
}

export const FAQ_DATA: FaqItem[] = [
  {
    id: '1',
    category: 'general',
    question: 'How does DiskarTech verify students and hirers?',
    answer:
      'All working students submit a valid Student ID or Certificate of Registration (COR) alongside school details. Hirers and employers provide valid government IDs or business permits. Our administration team and automated AI verification review each document to ensure a trustworthy platform.',
  },
  {
    id: '2',
    category: 'payments',
    question: 'What should I do if a hirer underpays or refuses to pay?',
    answer:
      'Compensation must strictly match the agreed rate in the job listing. If a hirer refuses payment or attempts unauthorized deductions, report the incident immediately. Under DiskarTech policies, non-compliant hirers face immediate account suspension and blacklisting.',
  },
  {
    id: '3',
    category: 'jobs',
    question: 'How does the Certificate of Employment (CoE) work?',
    answer:
      'Once your contract is completed or concluded, you can request an official digital Certificate of Employment (CoE) directly in Application Details. Once approved by the employer, you can preview and download a signed verification copy for your academic or professional portfolio.',
  },
  {
    id: '4',
    category: 'safety',
    question: 'How do I report scam postings or suspicious employers?',
    answer:
      'Open the Job Details or Application Details screen and tap the three-dots menu or the flag icon to submit a report. Select the violation category (Scam, Abuse, Fake Job, Underpaid, or Unsafe Workplace) and provide details. You can track the progress of your submitted report in the "My Reports" tab here in Help Center.',
  },
  {
    id: '5',
    category: 'jobs',
    question: 'Can I cancel an application or withdraw from a job?',
    answer:
      'Yes. If your application has not yet been accepted, you can cancel it at any time from your Applications tab without penalty. If you are already hired and have scheduling emergencies, notify your employer promptly through chat and coordinate respectfully.',
  },
  {
    id: '6',
    category: 'safety',
    question: 'What is DiskarTech’s policy on off-platform payments or upfront fees?',
    answer:
      'Legitimate hirers will NEVER ask you to pay an "application fee", "training deposit", or "processing payment". If an employer asks you for money before hiring, report them immediately as a scam.',
  },
  {
    id: '7',
    category: 'general',
    question: 'How does class schedule matching protect students?',
    answer:
      'DiskarTech enables students to define available working days and hours. Part-time shifts are structured to ensure work hours do not conflict with your classes, preserving your academic performance and well-being.',
  },
];
