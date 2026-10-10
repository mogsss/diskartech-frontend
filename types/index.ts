export interface Job {
  id: string;
  companyLogo: string;
  companyName: string;
  jobTitle: string;
  salary: string;
  salary_type?: 'day' | 'hour';
  distance: string;
  workingHours: string;
  location: string;
  verified: boolean;
  bookmarked: boolean;
  isApplied?: boolean;
  description: string;
  requirements: string[];
  skills: string[];
  benefits: string[];
  category: string;
  schedule: string;
  jobType: string;
  postedDate: string;
  applicants: number;
  employerInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
    businessType: string;
  };
}

export interface Application {
  id: string;
  jobId: string;
  companyLogo: string;
  companyName: string;
  jobTitle: string;
  salary: string;
  status: 'pending' | 'viewed' | 'shortlisted' | 'interview' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  appliedDate: string;
  employerName: string;
}

export interface Earning {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  amount: number;
  status: 'completed' | 'pending';
  date: string;
}

export interface ScheduleDay {
  day: string;
  jobs: { id: string; title: string; time: string; company: string }[];
  hasConflict: boolean;
}

export interface Review {
  id: string;
  employerId: string;
  employerName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Report {
  id: string;
  employerId: string;
  reason: 'scam' | 'abuse' | 'fake_job' | 'unsafe' | 'other';
  description: string;
  date: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  online: boolean;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
}

export interface Notification {
  id: string;
  type: 'job_recommendation' | 'application_accepted' | 'interview_reminder' | 'verification' | 'message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  jobId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}

export interface StudentProfile {
  fullName: string;
  email: string;
  phone: string;
  school: string;
  course: string;
  yearLevel: string;
  skills: string[];
  availableSchedule: string;
  preferredJobType: string;
  location: string;
  hasResume: boolean;
  hasSchoolId: boolean;
  hasGovernmentId: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  profilePicture: string;
}

export interface EmployerProfile {
  businessName: string;
  employerName: string;
  businessType: string;
  email: string;
  phone: string;
  businessAddress: string;
  hasPermit: boolean;
  hasGovernmentId: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  profilePicture: string;
}
