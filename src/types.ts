export type Role = 'guardian' | 'tutor';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  institution?: string;
  qualifications?: string;
  experience?: string;
  isVerified: boolean;
  createdAt: any;
}

export interface TuitionPost {
  id: string;
  guardianId: string;
  guardianName: string;
  studentClass: string;
  subjects: string;
  preferredInstitution: 'RUET' | 'RU' | 'RMC' | 'Any';
  location: string;
  coordinates?: { lat: number; lng: number };
  daysPerWeek: number;
  budget: string;
  contactInfo: string;
  status: 'open' | 'filled' | 'closed';
  createdAt: any;
}

export interface TutorRequest {
  id: string;
  postId: string;
  guardianId: string;
  tutorId: string;
  tutorName: string;
  tutorInstitution: string;
  tutorQualifications?: string;
  tutorExperience?: string;
  tutorPhone?: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
