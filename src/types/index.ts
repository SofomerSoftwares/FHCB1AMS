export type Role = 'ADMIN' | 'ARCHIVE_OFFICER' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE' | 'AUDITOR';

export const DOCUMENT_CATEGORIES = [
  'COMMERCIAL',
  'RESIDENT',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type DocumentStatus = 
  | 'AVAILABLE' 
  | 'RESERVED' 
  | 'BORROWED' 
  | 'MISSING' 
  | 'UNDER_INVESTIGATION' 
  | 'ARCHIVED';

export type RequestStatus = 
  | 'PENDING' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'ISSUED' 
  | 'RETURNED' 
  | 'CANCELLED';

export type ConfidentialityLevel = 
  | 'PUBLIC' 
  | 'INTERNAL' 
  | 'CONFIDENTIAL' 
  | 'SECRET' 
  | 'TOP_SECRET';

export type LocationType = 
  | 'BUILDING' 
  | 'ROOM' 
  | 'CABINET' 
  | 'SHELF' 
  | 'BOX';

export type MovementType = 
  | 'REGISTRATION'
  | 'INITIAL_PLACEMENT'
  | 'RELOCATION'
  | 'ISSUE'
  | 'RETURN'
  | 'TRANSFER_DEPT'
  | 'TRANSFER_ROOM'
  | 'MISSING_REPORT'
  | 'RECOVERY'
  | 'ADMIN_CORRECTION';

export type PriorityLevel = 'NORMAL' | 'URGENT' | 'VERY_URGENT';

export interface IUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  amharicName?: string;
  role: Role;
  departmentId?: string;
  active: boolean;
  passwordHash?: string;
  lastLoginAt?: string;
  phone?: string;
  employeeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDepartment {
  id: string;
  code: string;
  nameEn: string;
  nameAm: string;
  managerId?: string;
  active: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IArchiveLocation {
  id: string;
  code: string; // e.g. "BLD-HQ", "RM-101", "CAB-A", "SH-01", "BOX-12"
  type: LocationType;
  shelfNumber?: string | null; // e.g. "05", "B-03"
  boxNumber?: string | null;   // e.g. "012", "BX-44"
  departmentId?: string | null;
  active: boolean;
  description?: string;
  nameEn?: string;
  nameAm?: string;
  parentId?: string | null;
  fullPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDocument {
  id: string;
  referenceNumber: string; // e.g. "ET-FDRE/2026/FIN-0091"
  titleEn: string;
  titleAm: string;
  description: string;
  category: DocumentCategory;
  
  // Historical Address-Based Fields
  oldWoreda?: string | null;  // የቀድሞ ወረዳ (e.g. "03", "14")
  oldKebele?: string | null;  // የቀድሞ ቀበሌ (e.g. "08", "12")
  houseNumber?: string | null; // የቤት ቁጥር (e.g. "045", "B-129")
  
  // Explicit physical archive location coordinates
  shelfNumber?: string | null; // e.g. "05"
  boxNumber?: string | null;   // e.g. "012"
  
  departmentId: string;
  documentDate: string;
  registrationDate: string;
  confidentiality: ConfidentialityLevel;
  retentionDate?: string;
  currentLocationId: string;
  currentHolderId?: string | null; // User id if borrowed
  status: DocumentStatus;
  qrIdentifier: string; // unique UUID or code
  registrationOfficerId: string;
  barcode?: string;
  tags?: string[];
  pageCount?: number;
  conditionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDocumentRequest {
  id: string;
  requestNumber: string; // e.g. "REQ-2026-0042"
  documentId: string;
  requesterId: string;
  requestingDepartmentId: string;
  purpose: string;
  requestDate: string;
  requestedReturnDate: string;
  priority: PriorityLevel;
  status: RequestStatus;
  approverId?: string | null;
  decisionDate?: string | null;
  rejectionReason?: string | null;
  issuedOfficerId?: string | null;
  issuedDate?: string | null;
  actualReturnDate?: string | null;
  receivingOfficerId?: string | null;
  returnCondition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';
  returnConditionNotes?: string;
  returnRequested?: boolean;
  returnRequestedAt?: string | null;
  returnNoticeSent?: boolean;
  returnNoticeSentAt?: string | null;
  returnDateAdjusted?: boolean;
  previousReturnDate?: string | null;
  adjustedBy?: string | null;
  adjustedAt?: string | null;
  adjustmentReason?: string | null;
  extensionRequested?: boolean;
  extensionRequestedDate?: string | null;
  extensionReason?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PermissionKey =
  | 'viewDocuments'
  | 'registerDocuments'
  | 'editDocuments'
  | 'importCsv'
  | 'requestDocuments'
  | 'fastRequest'
  | 'approveRequests'
  | 'rejectRequests'
  | 'issueHandover'
  | 'processReturn'
  | 'adjustReturnDate'
  | 'sendReturnNotice'
  | 'requestExtension'
  | 'manageLocations'
  | 'manageUsers'
  | 'manageDepartments'
  | 'viewAuditLogs'
  | 'manageInvestigations'
  | 'manageSettings';

export interface IReturnPolicySettings {
  defaultReturnDays: number;
  maxReturnDays: number;
  minReturnDays: number;
  defaultReturnTime: string; // e.g. "17:00"
  allowRequesterExtensionRequest: boolean;
  overdueWarningHours: number;
  quickDurationPresets: number[]; // e.g. [3, 7, 14, 30]
  autoNotifyOnDueApproach: boolean;
  strictOverdueLockout: boolean;
}

export interface IRolePermissions {
  ADMIN: PermissionKey[];
  ARCHIVE_OFFICER: PermissionKey[];
  DEPARTMENT_MANAGER: PermissionKey[];
  EMPLOYEE: PermissionKey[];
  AUDITOR: PermissionKey[];
}

export interface ISystemSettings {
  id: string;
  returnPolicy: IReturnPolicySettings;
  rolePermissions: IRolePermissions;
  updatedAt: string;
  updatedBy?: string;
}

export interface IFileMovement {
  id: string;
  documentId: string;
  movementType: MovementType;
  previousLocationId?: string | null;
  newLocationId?: string | null;
  previousShelfNumber?: string | null;
  newShelfNumber?: string | null;
  previousBoxNumber?: string | null;
  newBoxNumber?: string | null;
  previousHolderId?: string | null;
  newHolderId?: string | null;
  actingUserId: string;
  timestamp: string;
  requestId?: string | null;
  reason: string;
  acknowledgmentDetails?: string;
}

export interface IMissingFileInvestigation {
  id: string;
  documentId: string;
  reportedBy: string;
  lastKnownLocationId?: string | null;
  lastKnownHolderId?: string | null;
  assignedInvestigatorId?: string | null;
  status: 'OPEN' | 'UNDER_INVESTIGATION' | 'RESOLVED_FOUND' | 'RESOLVED_LOST';
  notes: Array<{
    authorId: string;
    note: string;
    timestamp: string;
  }>;
  resolutionDetails?: string;
  reportedAt: string;
  resolvedAt?: string;
}

export interface IAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface INotification {
  id: string;
  userId: string;
  titleEn: string;
  titleAm: string;
  messageEn: string;
  messageAm: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  read: boolean;
  link?: string;
  createdAt: string;
}
