import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import { DOCUMENT_CATEGORIES, DocumentCategory } from '../../types';

// User Schema
export interface IUserDocument extends MongooseDocument {
  username: string;
  email: string;
  fullName: string;
  amharicName?: string;
  role: 'ADMIN' | 'ARCHIVE_OFFICER' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE' | 'AUDITOR';
  departmentId?: string;
  active: boolean;
  passwordHash: string;
  lastLoginAt?: Date;
  phone?: string;
  employeeId?: string;
}

export const UserSchema = new Schema<IUserDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, required: true, trim: true },
    amharicName: { type: String, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR'],
      default: 'EMPLOYEE',
      index: true,
    },
    departmentId: { type: String, ref: 'Department', index: true },
    active: { type: Boolean, default: true, index: true },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date },
    phone: { type: String },
    employeeId: { type: String, index: true },
  },
  { timestamps: true }
);

// Department Schema
export interface IDepartmentDocument extends MongooseDocument {
  code: string;
  nameEn: string;
  nameAm: string;
  managerId?: string;
  active: boolean;
  description?: string;
}

export const DepartmentSchema = new Schema<IDepartmentDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    nameEn: { type: String, required: true, trim: true },
    nameAm: { type: String, required: true, trim: true },
    managerId: { type: String, ref: 'User' },
    active: { type: Boolean, default: true, index: true },
    description: { type: String },
  },
  { timestamps: true }
);

// ArchiveLocation Schema (Building -> Archive Room -> Cabinet -> Shelf -> Box)
export interface IArchiveLocationDocument extends MongooseDocument {
  code: string;
  nameEn: string;
  nameAm: string;
  type: 'BUILDING' | 'ROOM' | 'CABINET' | 'SHELF' | 'BOX';
  parentId?: string | null;
  departmentId?: string | null;
  shelfNumber?: string | null;
  boxNumber?: string | null;
  active: boolean;
  description?: string;
  fullPath?: string;
}

export const ArchiveLocationSchema = new Schema<IArchiveLocationDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    nameEn: { type: String, required: true, trim: true },
    nameAm: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['BUILDING', 'ROOM', 'CABINET', 'SHELF', 'BOX'],
      index: true,
    },
    parentId: { type: String, ref: 'ArchiveLocation', index: true, default: null },
    departmentId: { type: String, ref: 'Department', index: true, default: null },
    shelfNumber: { type: String, trim: true, default: null, index: true },
    boxNumber: { type: String, trim: true, default: null, index: true },
    active: { type: Boolean, default: true, index: true },
    description: { type: String },
    fullPath: { type: String },
  },
  { timestamps: true }
);

ArchiveLocationSchema.index({ shelfNumber: 1, boxNumber: 1 });

// Document Schema
export interface IDocumentModel extends MongooseDocument {
  referenceNumber: string;
  titleEn: string;
  titleAm: string;
  description: string;
  category: DocumentCategory;
  oldWoreda?: string | null;
  oldKebele?: string | null;
  houseNumber?: string | null;
  shelfNumber?: string | null;
  boxNumber?: string | null;
  departmentId: string;
  documentDate: Date;
  registrationDate: Date;
  confidentiality: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
  retentionDate?: Date;
  currentLocationId: string;
  currentHolderId?: string | null;
  status: 'AVAILABLE' | 'RESERVED' | 'BORROWED' | 'MISSING' | 'UNDER_INVESTIGATION' | 'ARCHIVED';
  qrIdentifier: string;
  registrationOfficerId: string;
  tags?: string[];
  pageCount?: number;
  conditionNotes?: string;
}

export const DocumentSchema = new Schema<IDocumentModel>(
  {
    referenceNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    titleEn: { type: String, required: true, trim: true, index: true },
    titleAm: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: DOCUMENT_CATEGORIES,
      index: true,
    },
    oldWoreda: { type: String, trim: true, default: null, index: true },
    oldKebele: { type: String, trim: true, default: null, index: true },
    houseNumber: { type: String, trim: true, default: null, index: true },
    shelfNumber: { type: String, trim: true, default: null, index: true },
    boxNumber: { type: String, trim: true, default: null, index: true },
    departmentId: { type: String, required: true, ref: 'Department', index: true },
    documentDate: { type: Date, required: true, index: true },
    registrationDate: { type: Date, default: Date.now, index: true },
    confidentiality: {
      type: String,
      required: true,
      enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET'],
      default: 'INTERNAL',
      index: true,
    },
    retentionDate: { type: Date },
    currentLocationId: { type: String, required: true, ref: 'ArchiveLocation', index: true },
    currentHolderId: { type: String, ref: 'User', default: null, index: true },
    status: {
      type: String,
      required: true,
      enum: ['AVAILABLE', 'RESERVED', 'BORROWED', 'MISSING', 'UNDER_INVESTIGATION', 'ARCHIVED'],
      default: 'AVAILABLE',
      index: true,
    },
    qrIdentifier: { type: String, required: true, unique: true, index: true },
    registrationOfficerId: { type: String, required: true, ref: 'User' },
    tags: [{ type: String }],
    pageCount: { type: Number },
    conditionNotes: { type: String },
  },
  { timestamps: true }
);

// Compound Indexes for fast combined queries
DocumentSchema.index({ category: 1, oldWoreda: 1, oldKebele: 1, houseNumber: 1 });
DocumentSchema.index({ oldWoreda: 1, oldKebele: 1, houseNumber: 1 });
DocumentSchema.index({ category: 1, departmentId: 1, status: 1 });
DocumentSchema.index({ shelfNumber: 1, boxNumber: 1 });

// Document Request Schema
export interface IDocumentRequestModel extends MongooseDocument {
  requestNumber: string;
  documentId: string;
  requesterId: string;
  requestingDepartmentId: string;
  purpose: string;
  requestDate: Date;
  requestedReturnDate: Date;
  priority: 'NORMAL' | 'URGENT' | 'VERY_URGENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'RETURNED' | 'CANCELLED';
  approverId?: string | null;
  decisionDate?: Date | null;
  rejectionReason?: string | null;
  issuedOfficerId?: string | null;
  issuedDate?: Date | null;
  actualReturnDate?: Date | null;
  receivingOfficerId?: string | null;
  returnCondition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';
  returnConditionNotes?: string;
  notes?: string;
}

export const DocumentRequestSchema = new Schema<IDocumentRequestModel>(
  {
    requestNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    documentId: { type: String, required: true, ref: 'Document', index: true },
    requesterId: { type: String, required: true, ref: 'User', index: true },
    requestingDepartmentId: { type: String, required: true, ref: 'Department', index: true },
    purpose: { type: String, required: true },
    requestDate: { type: Date, default: Date.now, index: true },
    requestedReturnDate: { type: Date, required: true, index: true },
    priority: {
      type: String,
      required: true,
      enum: ['NORMAL', 'URGENT', 'VERY_URGENT'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'RETURNED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    approverId: { type: String, ref: 'User', default: null },
    decisionDate: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    issuedOfficerId: { type: String, ref: 'User', default: null },
    issuedDate: { type: Date, default: null },
    actualReturnDate: { type: Date, default: null },
    receivingOfficerId: { type: String, ref: 'User', default: null },
    returnCondition: { type: String, enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'] },
    returnConditionNotes: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// File Movement Schema (Append-only)
export interface IFileMovementModel extends MongooseDocument {
  documentId: string;
  movementType: 'REGISTRATION' | 'INITIAL_PLACEMENT' | 'RELOCATION' | 'ISSUE' | 'RETURN' | 'TRANSFER_DEPT' | 'TRANSFER_ROOM' | 'MISSING_REPORT' | 'RECOVERY' | 'ADMIN_CORRECTION';
  previousLocationId?: string | null;
  newLocationId?: string | null;
  previousShelfNumber?: string | null;
  newShelfNumber?: string | null;
  previousBoxNumber?: string | null;
  newBoxNumber?: string | null;
  previousHolderId?: string | null;
  newHolderId?: string | null;
  actingUserId: string;
  timestamp: Date;
  requestId?: string | null;
  reason: string;
  acknowledgmentDetails?: string;
}

export const FileMovementSchema = new Schema<IFileMovementModel>(
  {
    documentId: { type: String, required: true, ref: 'Document', index: true },
    movementType: {
      type: String,
      required: true,
      enum: [
        'REGISTRATION',
        'INITIAL_PLACEMENT',
        'RELOCATION',
        'ISSUE',
        'RETURN',
        'TRANSFER_DEPT',
        'TRANSFER_ROOM',
        'MISSING_REPORT',
        'RECOVERY',
        'ADMIN_CORRECTION',
      ],
      index: true,
    },
    previousLocationId: { type: String, ref: 'ArchiveLocation', default: null },
    newLocationId: { type: String, ref: 'ArchiveLocation', default: null },
    previousShelfNumber: { type: String, default: null },
    newShelfNumber: { type: String, default: null },
    previousBoxNumber: { type: String, default: null },
    newBoxNumber: { type: String, default: null },
    previousHolderId: { type: String, ref: 'User', default: null },
    newHolderId: { type: String, ref: 'User', default: null },
    actingUserId: { type: String, required: true, ref: 'User', index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    requestId: { type: String, ref: 'DocumentRequest', default: null },
    reason: { type: String, required: true },
    acknowledgmentDetails: { type: String },
  },
  { timestamps: false }
);

// Audit Log Schema
export interface IAuditLogModel extends MongooseDocument {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  ipAddress?: string;
  timestamp: Date;
}

export const AuditLogSchema = new Schema<IAuditLogModel>(
  {
    actorId: { type: String, required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    details: { type: String, required: true },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Missing File Investigation Schema
export interface IMissingFileInvestigationModel extends MongooseDocument {
  documentId: string;
  reportedBy: string;
  lastKnownLocationId?: string | null;
  lastKnownHolderId?: string | null;
  assignedInvestigatorId?: string | null;
  status: 'OPEN' | 'UNDER_INVESTIGATION' | 'RESOLVED_FOUND' | 'RESOLVED_LOST';
  notes: Array<{
    authorId: string;
    note: string;
    timestamp: Date;
  }>;
  resolutionDetails?: string;
  reportedAt: Date;
  resolvedAt?: Date;
}

export const MissingFileInvestigationSchema = new Schema<IMissingFileInvestigationModel>(
  {
    documentId: { type: String, required: true, ref: 'Document', index: true },
    reportedBy: { type: String, required: true, ref: 'User' },
    lastKnownLocationId: { type: String, ref: 'ArchiveLocation', default: null },
    lastKnownHolderId: { type: String, ref: 'User', default: null },
    assignedInvestigatorId: { type: String, ref: 'User', default: null },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'UNDER_INVESTIGATION', 'RESOLVED_FOUND', 'RESOLVED_LOST'],
      default: 'OPEN',
      index: true,
    },
    notes: [
      {
        authorId: { type: String, required: true },
        note: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    resolutionDetails: { type: String },
    reportedAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// Notification Schema
export interface INotificationModel extends MongooseDocument {
  userId: string;
  titleEn: string;
  titleAm: string;
  messageEn: string;
  messageAm: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  read: boolean;
  link?: string;
  createdAt: Date;
}

export const NotificationSchema = new Schema<INotificationModel>(
  {
    userId: { type: String, required: true, ref: 'User', index: true },
    titleEn: { type: String, required: true },
    titleAm: { type: String, required: true },
    messageEn: { type: String, required: true },
    messageAm: { type: String, required: true },
    type: { type: String, enum: ['INFO', 'WARNING', 'ALERT', 'SUCCESS'], default: 'INFO' },
    read: { type: Boolean, default: false, index: true },
    link: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Compile Mongoose models
export const UserModel = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
export const DepartmentModel = mongoose.models.Department || mongoose.model<IDepartmentDocument>('Department', DepartmentSchema);
export const ArchiveLocationModel = mongoose.models.ArchiveLocation || mongoose.model<IArchiveLocationDocument>('ArchiveLocation', ArchiveLocationSchema);
export const DocumentRecordModel = mongoose.models.Document || mongoose.model<IDocumentModel>('Document', DocumentSchema);
export const DocumentRequestModel = mongoose.models.DocumentRequest || mongoose.model<IDocumentRequestModel>('DocumentRequest', DocumentRequestSchema);
export const FileMovementModel = mongoose.models.FileMovement || mongoose.model<IFileMovementModel>('FileMovement', FileMovementSchema);
export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLogModel>('AuditLog', AuditLogSchema);
export const MissingFileInvestigationModel = mongoose.models.MissingFileInvestigation || mongoose.model<IMissingFileInvestigationModel>('MissingFileInvestigation', MissingFileInvestigationSchema);
export const NotificationModel = mongoose.models.Notification || mongoose.model<INotificationModel>('Notification', NotificationSchema);
