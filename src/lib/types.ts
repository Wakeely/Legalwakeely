export type DocumentType = "rental" | "employment" | "traffic" | "consumer" | "general";
export type LawyerScore = "LOW" | "MEDIUM" | "HIGH";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
export type DocStatus = "PENDING" | "PROCESSED" | "REVIEWED" | "FAILED";
export type LeadStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CONVERTED";
export type Role = "CITIZEN" | "LAWYER" | "ADMIN";

export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  role: Role;
  language: "ar" | "en";
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  title: string;
  fileType: "pdf" | "image";
  documentType: DocumentType;
  status: DocStatus;
  contentExcerpt: string;
  createdAt: string;
}

export interface NextStep {
  title: string;
  description: string;
  isPaid: boolean;
}

export interface LegalSource {
  lawName: string;
  articleNumber?: string;
  excerpt: string;
}

export interface Analysis {
  id: string;
  documentId: string;
  userId: string;
  documentType: DocumentType;
  documentTitle: string;
  summary: string;
  rights: string[];
  obligations: string[];
  risks: { text: string; severity: "low" | "medium" | "high" }[];
  lawyerScore: LawyerScore;
  lawyerReason: string;
  nextSteps: NextStep[];
  sources: LegalSource[];
  confidenceScore: number;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface LawyerProfile {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  specialties: string[];
  cities: string[];
  hourlyRate: number;
  bio: { ar: string; en: string };
  verified: boolean;
  rating: number;
  totalReviews: number;
  barNumber: string;
  isAvailable: boolean;
  languages: ("ar" | "en")[];
  yearsExperience: number;
  successStories: number;
}

export interface Lead {
  id: string;
  userId: string;
  userName: string;
  analysisId?: string;
  analysisSummary?: string;
  lawyerId: string;
  documentType: DocumentType;
  status: LeadStatus;
  message: string;
  feeOffered?: number;
  createdAt: string;
}
