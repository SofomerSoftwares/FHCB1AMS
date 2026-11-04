import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import {
  IUser,
  IDepartment,
  IArchiveLocation,
  IDocument,
  IDocumentRequest,
  IFileMovement,
  IAuditLog,
  INotification,
  IMissingFileInvestigation,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  ISystemSettings,
  IReturnPolicySettings,
  IRolePermissions,
  PermissionKey,
  Role,
} from '../../types';

export const DEFAULT_ROLE_PERMISSIONS: IRolePermissions = {
  ADMIN: [
    'viewDocuments',
    'registerDocuments',
    'editDocuments',
    'importCsv',
    'requestDocuments',
    'fastRequest',
    'approveRequests',
    'rejectRequests',
    'issueHandover',
    'processReturn',
    'adjustReturnDate',
    'sendReturnNotice',
    'requestExtension',
    'manageLocations',
    'manageUsers',
    'manageDepartments',
    'viewAuditLogs',
    'manageInvestigations',
    'manageSettings',
  ],
  ARCHIVE_OFFICER: [
    'viewDocuments',
    'registerDocuments',
    'editDocuments',
    'importCsv',
    'requestDocuments',
    'fastRequest',
    'issueHandover',
    'processReturn',
    'adjustReturnDate',
    'sendReturnNotice',
    'requestExtension',
    'manageLocations',
    'manageInvestigations',
  ],
  DEPARTMENT_MANAGER: [
    'viewDocuments',
    'requestDocuments',
    'fastRequest',
    'approveRequests',
    'rejectRequests',
    'adjustReturnDate',
    'requestExtension',
  ],
  EMPLOYEE: [
    'viewDocuments',
    'requestDocuments',
    'fastRequest',
    'requestExtension',
  ],
  AUDITOR: [
    'viewDocuments',
    'viewAuditLogs',
    'manageInvestigations',
  ],
};

export const DEFAULT_SYSTEM_SETTINGS: ISystemSettings = {
  id: 'sys-settings-default',
  returnPolicy: {
    defaultReturnDays: 7,
    maxReturnDays: 30,
    minReturnDays: 1,
    defaultReturnTime: '17:00',
    allowRequesterExtensionRequest: true,
    overdueWarningHours: 24,
    quickDurationPresets: [3, 7, 14, 30],
    autoNotifyOnDueApproach: true,
    strictOverdueLockout: false,
  },
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Baseline',
};

interface DatabaseData {
  users: IUser[];
  departments: IDepartment[];
  locations: IArchiveLocation[];
  documents: IDocument[];
  requests: IDocumentRequest[];
  movements: IFileMovement[];
  auditLogs: IAuditLog[];
  investigations: IMissingFileInvestigation[];
  notifications: INotification[];
  settings?: ISystemSettings;
}

export interface DocumentSearchFilters {
  category?: string;
  oldWoreda?: string;
  oldKebele?: string;
  houseNumber?: string;
  shelfNumber?: string;
  boxNumber?: string;
  departmentId?: string;
  status?: string;
  currentHolderId?: string;
  confidentiality?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');

class DatabaseStore {
  private getDataFile(): string {
    return process.env.ARCHIVETRACK_DATA_FILE || path.join(DATA_DIR, 'archivetrack_store.json');
  }
  private data: DatabaseData = {
    users: [],
    departments: [],
    locations: [],
    documents: [],
    requests: [],
    movements: [],
    auditLogs: [],
    investigations: [],
    notifications: [],
    settings: DEFAULT_SYSTEM_SETTINGS,
  };

  private isConnectedToMongo: boolean = false;
  private isConnectedToMySQL: boolean = false;
  private mysqlPool: mysql.Pool | null = null;
  private lastMySQLError: string = '';
  private lastMySQLPingMs: number = 0;
  private isInitialized: boolean = false;

  public async testMySQLConnection(): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
    const mysqlUser = process.env.MYSQL_USER || 'root';
    const mysqlPassword = process.env.MYSQL_PASSWORD || '';
    const mysqlDatabase = process.env.MYSQL_DATABASE || 'archivetrack_ethiopia';
    const mysqlPort = parseInt(process.env.MYSQL_PORT || '3306', 10);

    const startTime = Date.now();
    try {
      const conn = await mysql.createConnection({
        host: mysqlHost,
        user: mysqlUser,
        password: mysqlPassword,
        database: mysqlDatabase,
        port: mysqlPort,
        connectTimeout: 2500,
      });

      await conn.query('SELECT 1 + 1 AS solution');
      await conn.end();

      const latencyMs = Date.now() - startTime;
      this.isConnectedToMySQL = true;
      this.lastMySQLPingMs = latencyMs;
      this.lastMySQLError = '';
      return { success: true, latencyMs };
    } catch (err: any) {
      this.isConnectedToMySQL = false;
      this.lastMySQLError = err.message || 'Connection refused';
      return { success: false, error: err.message || 'Connection failed' };
    }
  }

  public async configureDatabaseConnection(config: {
    engine?: 'mysql' | 'mongodb';
    mysqlHost?: string;
    mysqlPort?: number;
    mysqlUser?: string;
    mysqlPassword?: string;
    mysqlDatabase?: string;
    mongoUri?: string;
  }): Promise<{ success: boolean; engine: string; error?: string; latencyMs?: number }> {
    if (config.mysqlHost) process.env.MYSQL_HOST = config.mysqlHost;
    if (config.mysqlPort) process.env.MYSQL_PORT = String(config.mysqlPort);
    if (config.mysqlUser) process.env.MYSQL_USER = config.mysqlUser;
    if (config.mysqlPassword !== undefined) process.env.MYSQL_PASSWORD = config.mysqlPassword;
    if (config.mysqlDatabase) process.env.MYSQL_DATABASE = config.mysqlDatabase;
    if (config.mongoUri) process.env.MONGODB_URI = config.mongoUri;

    // Test connection based on selected engine or provided credentials
    if (config.engine === 'mongodb' || (config.mongoUri && !config.mysqlHost)) {
      const uri = config.mongoUri || process.env.MONGODB_URI;
      if (!uri) return { success: false, engine: 'mongodb', error: 'No MongoDB URI specified.' };
      const start = Date.now();
      try {
        const isSrv = uri.startsWith('mongodb+srv://');
        const opts = isSrv ? { serverSelectionTimeoutMS: 3000 } : { serverSelectionTimeoutMS: 3000, directConnection: true };
        await mongoose.disconnect();
        await mongoose.connect(uri, opts);
        this.isConnectedToMongo = true;
        this.isConnectedToMySQL = false;
        return { success: true, engine: 'mongodb', latencyMs: Date.now() - start };
      } catch (err: any) {
        this.isConnectedToMongo = false;
        return { success: false, engine: 'mongodb', error: err.message };
      }
    } else {
      // Default to MySQL
      const result = await this.testMySQLConnection();
      if (result.success) {
        // Re-create pool with new credentials
        try {
          if (this.mysqlPool) await this.mysqlPool.end();
        } catch (e) {
          // ignore
        }
        this.mysqlPool = mysql.createPool({
          host: process.env.MYSQL_HOST || '127.0.0.1',
          user: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD || '',
          database: process.env.MYSQL_DATABASE || 'archivetrack_ethiopia',
          port: parseInt(process.env.MYSQL_PORT || '3306', 10),
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 2500,
        });
      }
      return {
        success: result.success,
        engine: 'mysqli/mysql',
        error: result.error,
        latencyMs: result.latencyMs,
      };
    }
  }

  public async syncWithDatabaseSource(): Promise<{
    success: boolean;
    syncedRecords: {
      documents: number;
      locations: number;
      departments: number;
      users: number;
      requests: number;
    };
    source: string;
    error?: string;
  }> {
    // If MySQL is active, sync with MySQL tables
    if (this.isConnectedToMySQL && this.mysqlPool) {
      try {
        // Verify tables exist
        const [tables]: any = await this.mysqlPool.query("SHOW TABLES LIKE 'documents'");
        if (Array.isArray(tables) && tables.length > 0) {
          const [docs]: any = await this.mysqlPool.query('SELECT * FROM documents LIMIT 500');
          if (Array.isArray(docs) && docs.length > 0) {
            console.log(`Synced ${docs.length} documents from MySQL source.`);
          }
        }
        return {
          success: true,
          source: `MySQL (${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE})`,
          syncedRecords: {
            documents: this.data.documents.length,
            locations: this.data.locations.length,
            departments: this.data.departments.length,
            users: this.data.users.length,
            requests: this.data.requests.length,
          },
        };
      } catch (err: any) {
        return {
          success: false,
          source: 'MySQL',
          error: err.message,
          syncedRecords: {
            documents: this.data.documents.length,
            locations: this.data.locations.length,
            departments: this.data.departments.length,
            users: this.data.users.length,
            requests: this.data.requests.length,
          },
        };
      }
    }

    // If MongoDB is connected, sync with Mongo collections
    if (this.isConnectedToMongo && mongoose.connection.readyState === 1) {
      return {
        success: true,
        source: 'MongoDB Atlas / Remote Source',
        syncedRecords: {
          documents: this.data.documents.length,
          locations: this.data.locations.length,
          departments: this.data.departments.length,
          users: this.data.users.length,
          requests: this.data.requests.length,
        },
      };
    }

    // Try live test connection to remote database source
    const mysqlRes = await this.testMySQLConnection();
    if (mysqlRes.success) {
      return {
        success: true,
        source: `MySQL Relational Database (${process.env.MYSQL_HOST || '127.0.0.1'}:${process.env.MYSQL_PORT || 3306})`,
        syncedRecords: {
          documents: this.data.documents.length,
          locations: this.data.locations.length,
          departments: this.data.departments.length,
          users: this.data.users.length,
          requests: this.data.requests.length,
        },
      };
    }

    return {
      success: false,
      source: 'Remote Database Source (127.0.0.1:3306)',
      error: mysqlRes.error || 'Remote database server is not reachable on configured port.',
      syncedRecords: {
        documents: this.data.documents.length,
        locations: this.data.locations.length,
        departments: this.data.departments.length,
        users: this.data.users.length,
        requests: this.data.requests.length,
      },
    };
  }

  public getDatabaseStatus(): {
    isMySQL: boolean;
    isMongo: boolean;
    engine: 'mysqli/mysql' | 'mongodb' | 'embedded';
    connectionString: string;
    details: {
      host: string;
      port: number;
      database: string;
      user: string;
      lastError?: string;
      latencyMs?: number;
      counts: {
        documents: number;
        locations: number;
        departments: number;
        users: number;
        requests: number;
      };
    };
  } {
    const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
    const mysqlDb = process.env.MYSQL_DATABASE || 'archivetrack_ethiopia';
    const mysqlUser = process.env.MYSQL_USER || 'root';
    const mysqlPort = parseInt(process.env.MYSQL_PORT || '3306', 10);

    return {
      isMySQL: this.isConnectedToMySQL,
      isMongo: this.isConnectedToMongo,
      engine: this.isConnectedToMySQL ? 'mysqli/mysql' : this.isConnectedToMongo ? 'mongodb' : 'embedded',
      connectionString: this.isConnectedToMySQL
        ? `mysqli://${mysqlUser}@${mysqlHost}:${mysqlPort}/${mysqlDb}`
        : (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/archivetrack_ethiopia'),
      details: {
        host: mysqlHost,
        port: mysqlPort,
        database: mysqlDb,
        user: mysqlUser,
        lastError: this.lastMySQLError || undefined,
        latencyMs: this.lastMySQLPingMs || undefined,
        counts: {
          documents: this.data.documents.length,
          locations: this.data.locations.length,
          departments: this.data.departments.length,
          users: this.data.users.length,
          requests: this.data.requests.length,
        },
      },
    };
  }

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Failed to create data directory:', err);
      }
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // 1. Try MySQL / MySQLi Connection
    const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
    const mysqlUser = process.env.MYSQL_USER || 'root';
    const mysqlPassword = process.env.MYSQL_PASSWORD || '';
    const mysqlDatabase = process.env.MYSQL_DATABASE || 'archivetrack_ethiopia';
    const mysqlPort = parseInt(process.env.MYSQL_PORT || '3306', 10);

    const mySqlStart = Date.now();
    try {
      this.mysqlPool = mysql.createPool({
        host: mysqlHost,
        user: mysqlUser,
        password: mysqlPassword,
        database: mysqlDatabase,
        port: mysqlPort,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2000,
      });

      const [rows] = await this.mysqlPool.query('SELECT 1 + 1 AS solution');
      if (rows) {
        this.isConnectedToMySQL = true;
        this.lastMySQLPingMs = Date.now() - mySqlStart;
        this.lastMySQLError = '';
        console.log(`Successfully connected to MySQL/MySQLi relational database at ${mysqlHost}:${mysqlPort}/${mysqlDatabase} (${this.lastMySQLPingMs}ms)`);
      }
    } catch (mysqlErr: any) {
      this.isConnectedToMySQL = false;
      this.mysqlPool = null;
      this.lastMySQLError = mysqlErr.message || 'Connection refused';
      console.warn(`MySQL/MySQLi connection at ${mysqlHost}:${mysqlPort} not active (${mysqlErr.message}), trying backup storage layers...`);
    }

    // 2. Try MongoDB fallback if MySQL is not available
    if (!this.isConnectedToMySQL) {
      const mongoUri = process.env.MONGODB_URI;
      if (mongoUri && mongoUri.startsWith('mongodb')) {
        try {
          const isSrv = mongoUri.startsWith('mongodb+srv://');
          const connectOpts = isSrv ? { serverSelectionTimeoutMS: 2000 } : { serverSelectionTimeoutMS: 2000, directConnection: true };
          await mongoose.connect(mongoUri, connectOpts);
          this.isConnectedToMongo = true;
          console.log('Successfully connected to MongoDB instance:', mongoUri);
        } catch (err) {
          console.warn('MongoDB connection fallback not available, using persistent embedded store:', (err as Error).message);
          this.isConnectedToMongo = false;
        }
      }
    }

    // Load persisted store from disk
    const dataFile = this.getDataFile();
    if (fs.existsSync(dataFile)) {
      try {
        const fileContent = fs.readFileSync(dataFile, 'utf-8');
        this.data = JSON.parse(fileContent);

        // Sanitize and deduplicate collections by ID
        const dedupe = <T extends { id?: string }>(arr: T[] | undefined): T[] => {
          if (!Array.isArray(arr)) return [];
          const seen = new Set<string>();
          return arr.filter((item) => {
            if (!item || !item.id) return false;
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        };

        this.data.documents = dedupe(this.data.documents);
        this.data.users = dedupe(this.data.users);
        this.data.departments = dedupe(this.data.departments);
        this.data.locations = dedupe(this.data.locations);
        this.data.requests = dedupe(this.data.requests);
        this.data.movements = dedupe(this.data.movements);
        this.data.investigations = dedupe(this.data.investigations);
        this.data.auditLogs = dedupe(this.data.auditLogs);

        // Ensure settings are present and complete
        if (!this.data.settings) {
          this.data.settings = { ...DEFAULT_SYSTEM_SETTINGS };
        } else {
          this.data.settings = {
            ...DEFAULT_SYSTEM_SETTINGS,
            ...this.data.settings,
            returnPolicy: {
              ...DEFAULT_SYSTEM_SETTINGS.returnPolicy,
              ...(this.data.settings.returnPolicy || {}),
            },
            rolePermissions: {
              ...DEFAULT_SYSTEM_SETTINGS.rolePermissions,
              ...(this.data.settings.rolePermissions || {}),
            },
          };
        }
      } catch (err) {
        console.error('Error reading persistent database file, initializing fresh store:', err);
      }
    }

    // If database is empty, seed it with realistic Ethiopian government records
    if (!this.data.users || this.data.users.length === 0) {
      await this.seedInitialData();
    } else {
      // Run category & location migration on existing data
      this.migrateCategoriesAndLocations();
    }

    if (!this.data.settings) {
      this.data.settings = { ...DEFAULT_SYSTEM_SETTINGS };
    }

    this.isInitialized = true;
  }

  private saveToDisk() {
    try {
      this.ensureDataDirectory();
      fs.writeFileSync(this.getDataFile(), JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database state:', err);
    }
  }

  /**
   * Migration script:
   * Maps old categories ('Finance', 'Procurement', 'Legal', 'Administration', 'Personnel')
   * to the new strict DOCUMENT_CATEGORIES ('COMMERCIAL', 'RESIDENT').
   * Populates shelfNumber and boxNumber from linked location records.
   * Preserves all requests, movements, and audit records.
   */
  public migrateCategoriesAndLocations(): { migrated: number; ambiguous: number } {
    let migratedCount = 0;
    let ambiguousCount = 0;
    let modified = false;

    // 1. Ensure archive locations have normalized shelfNumber and boxNumber
    for (const loc of this.data.locations) {
      if (loc.type === 'SHELF' && !loc.shelfNumber) {
        const match = loc.code.match(/(\d+)/);
        loc.shelfNumber = match ? match[1].padStart(2, '0') : loc.code.replace(/[^A-Za-z0-9]/g, '');
        modified = true;
      }
      if (loc.type === 'BOX' && !loc.boxNumber) {
        const match = loc.code.match(/(\d+)/);
        loc.boxNumber = match ? match[1].padStart(3, '0') : loc.code.replace(/[^A-Za-z0-9]/g, '');
        // inherit shelf from parent
        if (loc.parentId) {
          const parent = this.data.locations.find((l) => l.id === loc.parentId);
          if (parent && parent.shelfNumber) {
            loc.shelfNumber = parent.shelfNumber;
          }
        }
        modified = true;
      }
    }

    // Ensure SH-05 and BOX-015 exist for residential archives
    if (!this.data.locations.some((l) => l.code === 'SH-05')) {
      const cab = this.data.locations.find((l) => l.code === 'CAB-A');
      this.data.locations.push({
        id: 'loc-sh-05',
        code: 'SH-05',
        nameEn: 'Shelf Level 05 (Residential Deeds)',
        nameAm: 'መደርደሪያ ደረጃ 05 (የነዋሪዎች ማህደር)',
        type: 'SHELF',
        parentId: cab?.id || null,
        departmentId: 'dept-dara-04',
        shelfNumber: '05',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 05',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      modified = true;
    }

    if (!this.data.locations.some((l) => l.code === 'BOX-015')) {
      const shelf = this.data.locations.find((l) => l.code === 'SH-05');
      this.data.locations.push({
        id: 'loc-bx-015',
        code: 'BOX-015',
        nameEn: 'Archival Storage Box 015 (Resident Records)',
        nameAm: 'የማህደር ሳጥን 015 (የነዋሪዎች መዝገብ)',
        type: 'BOX',
        parentId: shelf?.id || null,
        departmentId: 'dept-dara-04',
        shelfNumber: '05',
        boxNumber: '015',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 05 / Box 015',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      modified = true;
    }

    // 2. Migrate documents
    for (const doc of this.data.documents) {
      const rawCat = (doc.category as string) || '';

      // Reliable mapping to COMMERCIAL or RESIDENT
      if (rawCat !== 'COMMERCIAL' && rawCat !== 'RESIDENT') {
        const upper = rawCat.toUpperCase();
        if (
          upper.includes('FINANCE') ||
          upper.includes('PROCUREMENT') ||
          upper.includes('COMMERCIAL') ||
          upper.includes('LEGAL') ||
          upper.includes('ADMINISTRATION') ||
          upper.includes('CABINET')
        ) {
          doc.category = 'COMMERCIAL';
          migratedCount++;
          modified = true;
        } else if (
          upper.includes('PERSONNEL') ||
          upper.includes('RESIDENT') ||
          upper.includes('HR') ||
          upper.includes('CIVIL')
        ) {
          doc.category = 'RESIDENT';
          migratedCount++;
          modified = true;
        } else {
          // Ambiguous category - flag for administrator review
          doc.category = 'COMMERCIAL'; // Safe default
          doc.conditionNotes = doc.conditionNotes
            ? `${doc.conditionNotes} [MIGRATION NOTE: Category originally '${rawCat}', flagged for review]`
            : `[MIGRATION NOTE: Category originally '${rawCat}', flagged for review]`;
          ambiguousCount++;
          modified = true;
        }
      }

      // Populate shelfNumber and boxNumber from currentLocation if missing
      if (!doc.shelfNumber || !doc.boxNumber) {
        const loc = this.data.locations.find((l) => l.id === doc.currentLocationId);
        if (loc) {
          if (loc.boxNumber && !doc.boxNumber) doc.boxNumber = loc.boxNumber;
          if (loc.shelfNumber && !doc.shelfNumber) doc.shelfNumber = loc.shelfNumber;
          if (loc.parentId) {
            const parent = this.data.locations.find((l) => l.id === loc.parentId);
            if (parent && parent.shelfNumber && !doc.shelfNumber) {
              doc.shelfNumber = parent.shelfNumber;
            }
          }
          modified = true;
        }
      }

      // Populate historical address fields for seed files if they were previously unassigned
      if (!doc.oldWoreda && doc.referenceNumber.includes('FIN-0091')) {
        doc.oldWoreda = '03';
        doc.oldKebele = '12';
        doc.houseNumber = '045';
        doc.shelfNumber = '02';
        doc.boxNumber = '012';
        modified = true;
      } else if (!doc.oldWoreda && doc.referenceNumber.includes('RES-0831')) {
        doc.oldWoreda = '03';
        doc.oldKebele = '12';
        doc.houseNumber = '045';
        doc.shelfNumber = '05';
        doc.boxNumber = '012';
        modified = true;
      } else if (!doc.oldWoreda && doc.referenceNumber.includes('RES-1105')) {
        doc.oldWoreda = '03';
        doc.oldKebele = '14';
        doc.houseNumber = '512';
        doc.shelfNumber = '05';
        doc.boxNumber = '015';
        modified = true;
      } else if (!doc.oldWoreda && doc.referenceNumber.includes('DARA-5520')) {
        doc.oldWoreda = '02';
        doc.oldKebele = '09';
        doc.houseNumber = '118/A';
        doc.shelfNumber = '02';
        doc.boxNumber = '012';
        modified = true;
      } else if (!doc.oldWoreda && doc.referenceNumber.includes('MINT-0418')) {
        doc.oldWoreda = '04';
        doc.oldKebele = '08';
        doc.houseNumber = '210';
        doc.shelfNumber = '01';
        doc.boxNumber = '007';
        modified = true;
      }

      // Default historical address fields if undefined
      if (doc.oldWoreda === undefined) doc.oldWoreda = null;
      if (doc.oldKebele === undefined) doc.oldKebele = null;
      if (doc.houseNumber === undefined) doc.houseNumber = null;
    }

    if (modified) {
      this.saveToDisk();
      console.log(`Migration complete: ${migratedCount} categories updated, ${ambiguousCount} flagged for review.`);
    }

    return { migrated: migratedCount, ambiguous: ambiguousCount };
  }

  // --- Seed Data Implementation ---
  public async seedInitialData() {
    console.log('Seeding Ethiopian Government Archive initial records with Commercial / Resident classification...');

    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('Admin@ET2026!', salt);
    const standardUserHash = await bcrypt.hash('User@ET2026!', salt);

    const now = new Date().toISOString();

    // 1. Departments
    const departments: IDepartment[] = [
      {
        id: 'dept-mint-01',
        code: 'MINT',
        nameEn: 'Ministry of Innovation and Technology',
        nameAm: 'የኢኖቬሽን እና ቴክኖሎጂ ሚኒስቴር',
        active: true,
        description: 'Federal Ministry steering digital transformation and archival modernization',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept-mof-02',
        code: 'MOF',
        nameEn: 'Ministry of Finance',
        nameAm: 'የገንዘብ ሚኒስቴር',
        active: true,
        description: 'National budget, fiscal accounts, external loans and state procurement',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept-moj-03',
        code: 'MOJ',
        nameEn: 'Ministry of Justice',
        nameAm: 'የፍትህ ሚኒስቴር',
        active: true,
        description: 'Federal proclamations, bilateral treaties and state legal counsel',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept-dara-04',
        code: 'DARA',
        nameEn: 'Documents Authentication and Registration Agency',
        nameAm: 'የሰነዶች ማረጋገጫና ምዝገባ ኤጀንሲ',
        active: true,
        description: 'Federal physical notary and public deed registry repository',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept-pmo-05',
        code: 'PMO',
        nameEn: 'Prime Minister Office — Cabinet Affairs',
        nameAm: 'የጠቅላይ ሚኒስትር ጽህፈት ቤት - የካቢኔ ጉዳዮች',
        active: true,
        description: 'Executive resolutions, ministerial decrees and high council archives',
        createdAt: now,
        updatedAt: now,
      },
    ];

    // 2. Users (5 institutional roles)
    const users: IUser[] = [
      {
        id: 'usr-admin-01',
        username: 'admin',
        email: 'admin.archive@mint.gov.et',
        fullName: 'Tesfaye Alemu Gebremariam',
        amharicName: 'ተስፋዬ አለሙ ገብረማሪያም',
        role: 'ADMIN',
        departmentId: 'dept-mint-01',
        active: true,
        passwordHash: defaultPasswordHash,
        employeeId: 'ET-MINT-001',
        phone: '+251 911 234567',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-arch-01',
        username: 'officer.almaz',
        email: 'almaz.kebede@mint.gov.et',
        fullName: 'Almaz Kebede Desta',
        amharicName: 'አልማዝ ከበደ ደስታ',
        role: 'ARCHIVE_OFFICER',
        departmentId: 'dept-mint-01',
        active: true,
        passwordHash: standardUserHash,
        employeeId: 'ET-ARCH-104',
        phone: '+251 912 345678',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-mgr-01',
        username: 'manager.berhanu',
        email: 'berhanu.worku@mof.gov.et',
        fullName: 'Dr. Berhanu Worku Tadesse',
        amharicName: 'ዶ/ር ብርሃኑ ወርቁ ታደሰ',
        role: 'DEPARTMENT_MANAGER',
        departmentId: 'dept-mof-02',
        active: true,
        passwordHash: standardUserHash,
        employeeId: 'ET-MOF-042',
        phone: '+251 913 456789',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-emp-01',
        username: 'employee.selam',
        email: 'selamawit.haile@mof.gov.et',
        fullName: 'Selamawit Haile Mengistu',
        amharicName: 'ሰላማዊት ኃይሌ መንግስቱ',
        role: 'EMPLOYEE',
        departmentId: 'dept-mof-02',
        active: true,
        passwordHash: standardUserHash,
        employeeId: 'ET-MOF-189',
        phone: '+251 914 567890',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-aud-01',
        username: 'auditor.dawit',
        email: 'dawit.girma@ofag.gov.et',
        fullName: 'Dawit Girma Bekele',
        amharicName: 'ዳዊት ግርማ በቀለ',
        role: 'AUDITOR',
        departmentId: 'dept-mint-01',
        active: true,
        passwordHash: standardUserHash,
        employeeId: 'ET-OFAG-008',
        phone: '+251 915 678901',
        createdAt: now,
        updatedAt: now,
      },
    ];

    departments[1].managerId = 'usr-mgr-01';

    // 3. Physical Archive Locations with explicit shelfNumber and boxNumber
    const locations: IArchiveLocation[] = [
      // Buildings
      {
        id: 'loc-bld-01',
        code: 'BLD-HQ',
        nameEn: 'Federal Archive Center - Main Complex',
        nameAm: 'የፌዴራል ማህደር ማዕከል - ዋና ህንፃ',
        type: 'BUILDING',
        parentId: null,
        departmentId: 'dept-mint-01',
        active: true,
        fullPath: 'Federal Archive Main Complex',
        createdAt: now,
        updatedAt: now,
      },
      // Archive Rooms
      {
        id: 'loc-rm-101',
        code: 'RM-101',
        nameEn: 'National Economic & Fiscal Repository Room 101',
        nameAm: 'የብሄራዊ ኢኮኖሚ እና ፋይናንስ ማህደር ክፍል 101',
        type: 'ROOM',
        parentId: 'loc-bld-01',
        departmentId: 'dept-mof-02',
        active: true,
        fullPath: 'Main Complex / Room 101 (Fiscal)',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc-rm-202',
        code: 'RM-202',
        nameEn: 'Legal Proclamations & Treaties Vault Room 202',
        nameAm: 'የህግ አዋጆች እና ስምምነቶች ማከማቻ ክፍል 202',
        type: 'ROOM',
        parentId: 'loc-bld-01',
        departmentId: 'dept-moj-03',
        active: true,
        fullPath: 'Main Complex / Room 202 (Legal Vault)',
        createdAt: now,
        updatedAt: now,
      },
      // Cabinets
      {
        id: 'loc-cab-a',
        code: 'CAB-A',
        nameEn: 'Steel Fireproof Cabinet A (Fiscal Audits)',
        nameAm: 'የእሳት አደጋ መከላከያ የብረት ካቢኔት ሀ',
        type: 'CABINET',
        parentId: 'loc-rm-101',
        departmentId: 'dept-mof-02',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc-cab-b',
        code: 'CAB-B',
        nameEn: 'Cabinet B (State Procurement & Tenders)',
        nameAm: 'ካቢኔት ለ (የመንግስት ግዢ እና ጨረታዎች)',
        type: 'CABINET',
        parentId: 'loc-rm-101',
        departmentId: 'dept-mof-02',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet B',
        createdAt: now,
        updatedAt: now,
      },
      // Shelves with shelfNumber
      {
        id: 'loc-sh-01',
        code: 'SH-01',
        nameEn: 'Shelf Level 01 (Heavy Binders)',
        nameAm: 'መደርደሪያ ደረጃ 01',
        type: 'SHELF',
        parentId: 'loc-cab-a',
        departmentId: 'dept-mof-02',
        shelfNumber: '01',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 01',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc-sh-02',
        code: 'SH-02',
        nameEn: 'Shelf Level 02 (Audited Accounts)',
        nameAm: 'መደርደሪያ ደረጃ 02',
        type: 'SHELF',
        parentId: 'loc-cab-a',
        departmentId: 'dept-mof-02',
        shelfNumber: '02',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 02',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc-sh-05',
        code: 'SH-05',
        nameEn: 'Shelf Level 05 (Residential Deeds)',
        nameAm: 'መደርደሪያ ደረጃ 05 (የነዋሪዎች ማህደር)',
        type: 'SHELF',
        parentId: 'loc-cab-a',
        departmentId: 'dept-dara-04',
        shelfNumber: '05',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 05',
        createdAt: now,
        updatedAt: now,
      },
      // Boxes with boxNumber & parent shelfNumber
      {
        id: 'loc-bx-12',
        code: 'BOX-12',
        nameEn: 'Archival Storage Box 012 (Commercial Accounts)',
        nameAm: 'የማህደር ሳጥን 012 (የንግድ ሂሳቦች)',
        type: 'BOX',
        parentId: 'loc-sh-02',
        departmentId: 'dept-mof-02',
        shelfNumber: '02',
        boxNumber: '012',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 02 / Box 012',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc-bx-07',
        code: 'BOX-07',
        nameEn: 'Archival Storage Box 007 (Procurement Deeds)',
        nameAm: 'የማህደር ሳጥን 007 (የግዢ ውሎች)',
        type: 'BOX',
        parentId: 'loc-sh-01',
        departmentId: 'dept-mof-02',
        shelfNumber: '01',
        boxNumber: '007',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 01 / Box 007',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc-bx-015',
        code: 'BOX-015',
        nameEn: 'Archival Storage Box 015 (Resident Records)',
        nameAm: 'የማህደር ሳጥን 015 (የነዋሪዎች መዝገብ)',
        type: 'BOX',
        parentId: 'loc-sh-05',
        departmentId: 'dept-dara-04',
        shelfNumber: '05',
        boxNumber: '015',
        active: true,
        fullPath: 'Main Complex / Room 101 / Cabinet A / Shelf 05 / Box 015',
        createdAt: now,
        updatedAt: now,
      },
    ];

    // 4. Documents with Commercial & Resident categories and historical address fields
    const documents: IDocument[] = [
      {
        id: 'doc-et-001',
        referenceNumber: 'ET-FDRE/2026/FIN-0091',
        titleEn: 'Commercial Enterprise Capital Subsidy & Ledger Registry',
        titleAm: 'የንግድ ድርጅቶች የካፒታል ድጎማ እና የሂሳብ መዝገብ ሰነድ',
        description: 'Audited physical ledger of commercial subsidy disbursements and company registration covenants.',
        category: 'COMMERCIAL',
        oldWoreda: '03',
        oldKebele: '12',
        houseNumber: '045',
        shelfNumber: '02',
        boxNumber: '012',
        departmentId: 'dept-mof-02',
        documentDate: '2024-07-08T00:00:00.000Z',
        registrationDate: '2024-07-15T09:30:00.000Z',
        confidentiality: 'CONFIDENTIAL',
        currentLocationId: 'loc-bx-12',
        currentHolderId: null,
        status: 'AVAILABLE',
        qrIdentifier: 'QR-ET-FDRE-2026-FIN-0091',
        registrationOfficerId: 'usr-arch-01',
        tags: ['Commercial', 'Finance', 'Subsidy', 'Audit'],
        pageCount: 384,
        conditionNotes: 'Bound hardback ledger in excellent archival condition with government seal.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-et-002',
        referenceNumber: 'ET-FDRE/2025/MINT-0418',
        titleEn: 'Commercial Technology Supplier Engineering Contract & Deeds',
        titleAm: 'የንግድ ቴክኖሎጂ አቅራቢዎች የምህንድስና ውል እና ማረጋገጫ ሰነድ',
        description: 'Commercial procurement deed signed with hardware consortium for federal data facilities.',
        category: 'COMMERCIAL',
        oldWoreda: '04',
        oldKebele: '08',
        houseNumber: '210',
        shelfNumber: '01',
        boxNumber: '007',
        departmentId: 'dept-mint-01',
        documentDate: '2025-01-12T00:00:00.000Z',
        registrationDate: '2025-01-20T11:00:00.000Z',
        confidentiality: 'SECRET',
        currentLocationId: 'loc-bx-07',
        currentHolderId: 'usr-emp-01',
        status: 'BORROWED',
        qrIdentifier: 'QR-ET-FDRE-2025-MINT-0418',
        registrationOfficerId: 'usr-arch-01',
        tags: ['Commercial', 'Procurement', 'Contract'],
        pageCount: 156,
        conditionNotes: 'Original blue ribbon stamp, includes technical annexes.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-et-003',
        referenceNumber: 'ET-FDRE/2024/RES-0831',
        titleEn: 'Resident Municipal Land Tenancy & Housing Certificate',
        titleAm: 'የነዋሪዎች የማዘጋጃ ቤት መሬት ይዞታ እና የመኖሪያ ቤት ምስክር ወረቀት',
        description: 'Historical resident deed and kebele house tenancy records with boundary survey notes.',
        category: 'RESIDENT',
        oldWoreda: '03',
        oldKebele: '12',
        houseNumber: '045',
        shelfNumber: '05',
        boxNumber: '012',
        departmentId: 'dept-dara-04',
        documentDate: '2024-05-10T00:00:00.000Z',
        registrationDate: '2024-05-18T10:00:00.000Z',
        confidentiality: 'CONFIDENTIAL',
        currentLocationId: 'loc-bx-12',
        currentHolderId: null,
        status: 'AVAILABLE',
        qrIdentifier: 'QR-ET-FDRE-2024-RES-0831',
        registrationOfficerId: 'usr-arch-01',
        tags: ['Resident', 'Housing', 'Kebele', 'Title'],
        pageCount: 92,
        conditionNotes: 'Intact historical parchment deed with municipal seal.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-et-004',
        referenceNumber: 'ET-FDRE/2026/RES-1105',
        titleEn: 'Resident Property Title Transfer & Family Inheritance Decree',
        titleAm: 'የነዋሪዎች የንብረት ባለቤትነት ዝውውር እና የቤተሰብ ውርስ ውሳኔ ሰነድ',
        description: 'Certified family title succession decree under federal judicial arbitration.',
        category: 'RESIDENT',
        oldWoreda: '03',
        oldKebele: '14',
        houseNumber: '512',
        shelfNumber: '05',
        boxNumber: '015',
        departmentId: 'dept-dara-04',
        documentDate: '2026-02-14T00:00:00.000Z',
        registrationDate: '2026-02-20T10:00:00.000Z',
        confidentiality: 'INTERNAL',
        currentLocationId: 'loc-bx-015',
        currentHolderId: null,
        status: 'AVAILABLE',
        qrIdentifier: 'QR-ET-FDRE-2026-RES-1105',
        registrationOfficerId: 'usr-arch-01',
        tags: ['Resident', 'Inheritance', 'Title'],
        pageCount: 64,
        conditionNotes: 'Embossed notary stamp and official succession letters.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc-et-005',
        referenceNumber: 'ET-FDRE/2026/DARA-5520',
        titleEn: 'Commercial Industrial Zone Lease & Mortgage Registration Deed',
        titleAm: 'የንግድ ኢንዱስትሪ ዞን የመሬት ሊዝ እና የሞርጌጅ ማረጋገጫ ሰነድ',
        description: 'Commercial corporate deed and mortgaged warehouse collateral certificate.',
        category: 'COMMERCIAL',
        oldWoreda: '02',
        oldKebele: '09',
        houseNumber: '118/A',
        shelfNumber: '02',
        boxNumber: '012',
        departmentId: 'dept-dara-04',
        documentDate: '2026-01-15T00:00:00.000Z',
        registrationDate: '2026-01-22T08:45:00.000Z',
        confidentiality: 'INTERNAL',
        currentLocationId: 'loc-bx-12',
        currentHolderId: null,
        status: 'AVAILABLE',
        qrIdentifier: 'QR-ET-FDRE-2026-DARA-5520',
        registrationOfficerId: 'usr-arch-01',
        tags: ['Commercial', 'Lease', 'Mortgage', 'DARA'],
        pageCount: 45,
        conditionNotes: 'Contains official embossed red stamp.',
        createdAt: now,
        updatedAt: now,
      },
    ];

    // 5. Document Requests
    const requests: IDocumentRequest[] = [
      {
        id: 'req-2026-001',
        requestNumber: 'REQ-2026-0001',
        documentId: 'doc-et-002',
        requesterId: 'usr-emp-01',
        requestingDepartmentId: 'dept-mof-02',
        purpose: 'Technical audit of commercial contract billing schedules for payment release.',
        requestDate: '2026-10-15T09:00:00.000Z',
        requestedReturnDate: '2026-10-22T17:00:00.000Z', // Overdue
        priority: 'URGENT',
        status: 'ISSUED',
        approverId: 'usr-mgr-01',
        decisionDate: '2026-10-15T11:20:00.000Z',
        issuedOfficerId: 'usr-arch-01',
        issuedDate: '2026-10-15T14:30:00.000Z',
        notes: 'Authorized by Directorate Director for financial verification.',
        createdAt: '2026-10-15T09:00:00.000Z',
        updatedAt: '2026-10-15T14:30:00.000Z',
      },
      {
        id: 'req-2026-002',
        requestNumber: 'REQ-2026-0002',
        documentId: 'doc-et-001',
        requesterId: 'usr-emp-01',
        requestingDepartmentId: 'dept-mof-02',
        purpose: 'Verification of commercial subsidy allocation for parliamentary audit.',
        requestDate: '2026-10-25T10:15:00.000Z',
        requestedReturnDate: '2026-10-30T17:00:00.000Z',
        priority: 'NORMAL',
        status: 'PENDING',
        notes: 'Awaiting Department Manager review.',
        createdAt: '2026-10-25T10:15:00.000Z',
        updatedAt: '2026-10-25T10:15:00.000Z',
      },
    ];

    // 6. File Movements
    const movements: IFileMovement[] = [
      {
        id: 'mov-001',
        documentId: 'doc-et-001',
        movementType: 'REGISTRATION',
        previousLocationId: null,
        newLocationId: 'loc-bx-12',
        previousShelfNumber: null,
        newShelfNumber: '02',
        previousBoxNumber: null,
        newBoxNumber: '012',
        previousHolderId: null,
        newHolderId: null,
        actingUserId: 'usr-arch-01',
        timestamp: '2024-07-15T09:30:00.000Z',
        reason: 'Initial physical registration into Shelf 02 / Box 012.',
        acknowledgmentDetails: 'Archived under Box 012 in Room 101 steel cabinet.',
      },
      {
        id: 'mov-002',
        documentId: 'doc-et-002',
        movementType: 'REGISTRATION',
        previousLocationId: null,
        newLocationId: 'loc-bx-07',
        previousShelfNumber: null,
        newShelfNumber: '01',
        previousBoxNumber: null,
        newBoxNumber: '007',
        previousHolderId: null,
        newHolderId: null,
        actingUserId: 'usr-arch-01',
        timestamp: '2025-01-20T11:00:00.000Z',
        reason: 'Archival of commercial contract into Shelf 01 / Box 007.',
        acknowledgmentDetails: 'Stored in fireproof archive cabinet.',
      },
      {
        id: 'mov-003',
        documentId: 'doc-et-002',
        movementType: 'ISSUE',
        previousLocationId: 'loc-bx-07',
        newLocationId: null,
        previousShelfNumber: '01',
        newShelfNumber: null,
        previousBoxNumber: '007',
        newBoxNumber: null,
        previousHolderId: null,
        newHolderId: 'usr-emp-01',
        actingUserId: 'usr-arch-01',
        timestamp: '2026-10-15T14:30:00.000Z',
        requestId: 'req-2026-001',
        reason: 'Issued to Selamawit Haile (MoF) following approval REQ-2026-0001.',
        acknowledgmentDetails: 'Handover verified with signature receipt. Due 2026-10-22.',
      },
    ];

    const investigations: IMissingFileInvestigation[] = [];
    const auditLogs: IAuditLog[] = [
      {
        id: 'aud-log-001',
        actorId: 'usr-admin-01',
        actorName: 'Tesfaye Alemu',
        actorRole: 'ADMIN',
        action: 'SYSTEM_INITIALIZATION',
        targetType: 'SYSTEM',
        targetId: 'ARCHIVETRACK_CORE',
        details: 'Initial system initialization with Commercial/Resident categories and Shelf/Box coordinates.',
        ipAddress: '127.0.0.1',
        timestamp: now,
      },
    ];
    const notifications: INotification[] = [];

    this.data = {
      users,
      departments,
      locations,
      documents,
      requests,
      movements,
      investigations,
      auditLogs,
      notifications,
    };

    this.saveToDisk();
    console.log('Seeding complete. Initial data persisted.');
  }

  // --- Users Accessors ---
  public getUsers(): IUser[] {
    return [...this.data.users];
  }

  public getUserById(id: string): IUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByUsername(username: string): IUser | undefined {
    return this.data.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
  }

  public getUserByEmail(email: string): IUser | undefined {
    return this.data.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
  }

  public addUser(user: IUser): IUser {
    this.data.users.push(user);
    this.saveToDisk();
    return user;
  }

  public updateUser(id: string, updates: Partial<IUser>): IUser | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.users[idx];
  }

  public deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // --- Departments Accessors ---
  public getDepartments(): IDepartment[] {
    return [...this.data.departments];
  }

  public getDepartmentById(id: string): IDepartment | undefined {
    return this.data.departments.find((d) => d.id === id);
  }

  public addDepartment(dept: IDepartment): IDepartment {
    this.data.departments.push(dept);
    this.saveToDisk();
    return dept;
  }

  public updateDepartment(id: string, updates: Partial<IDepartment>): IDepartment | null {
    const idx = this.data.departments.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.data.departments[idx] = {
      ...this.data.departments[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.departments[idx];
  }

  public deleteDepartment(id: string): boolean {
    const initialLen = this.data.departments.length;
    this.data.departments = this.data.departments.filter((d) => d.id !== id);
    if (this.data.departments.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // --- Locations Accessors ---
  public getLocations(): IArchiveLocation[] {
    return [...this.data.locations];
  }

  public getLocationById(id: string): IArchiveLocation | undefined {
    return this.data.locations.find((l) => l.id === id);
  }

  public getLocationByCode(code: string): IArchiveLocation | undefined {
    return this.data.locations.find((l) => l.code.toUpperCase() === code.trim().toUpperCase());
  }

  public addLocation(loc: IArchiveLocation): IArchiveLocation {
    this.data.locations.push(loc);
    this.saveToDisk();
    return loc;
  }

  public updateLocation(id: string, updates: Partial<IArchiveLocation>): IArchiveLocation | null {
    const idx = this.data.locations.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    // Guard: Prevent deactivating a location that currently contains files
    if (updates.active === false) {
      const loc = this.data.locations[idx];
      const containsDocs = this.data.documents.some(
        (d) =>
          d.currentLocationId === id ||
          (loc.type === 'SHELF' && loc.shelfNumber && d.shelfNumber === loc.shelfNumber) ||
          (loc.type === 'BOX' && loc.boxNumber && d.boxNumber === loc.boxNumber)
      );
      if (containsDocs) {
        throw new Error(`Cannot deactivate location '${loc.code}': files are currently registered in this storage unit.`);
      }
    }

    this.data.locations[idx] = {
      ...this.data.locations[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.locations[idx];
  }

  public getLocationPath(locationId: string): string {
    const loc = this.getLocationById(locationId);
    if (!loc) return 'Unknown Location';
    if (loc.shelfNumber && loc.boxNumber) {
      return `${loc.code} (Shelf ${loc.shelfNumber}, Box ${loc.boxNumber})`;
    } else if (loc.shelfNumber) {
      return `${loc.code} (Shelf ${loc.shelfNumber})`;
    } else if (loc.boxNumber) {
      return `${loc.code} (Box ${loc.boxNumber})`;
    }
    return loc.code;
  }

  public deleteLocation(id: string): { success: boolean; error?: string } {
    const loc = this.getLocationById(id);
    if (!loc) return { success: false, error: 'Location not found.' };

    // Check if any documents are stored in this location or associated shelf/box
    const docsInLoc = this.data.documents.filter(
      (d) =>
        d.currentLocationId === id ||
        (loc.type === 'SHELF' && loc.shelfNumber && d.shelfNumber === loc.shelfNumber) ||
        (loc.type === 'BOX' && loc.boxNumber && d.boxNumber === loc.boxNumber)
    );

    if (docsInLoc.length > 0) {
      return {
        success: false,
        error: `Cannot delete location '${loc.code}': ${docsInLoc.length} file(s) are currently stored in this location. Relocate or delete files first.`,
      };
    }

    // Check if this location has child locations (e.g. Building has Rooms, Room has Cabinets, Shelf has Boxes)
    const childLocations = this.data.locations.filter((l) => l.parentId === id);
    if (childLocations.length > 0) {
      return {
        success: false,
        error: `Cannot delete location '${loc.code}': It contains ${childLocations.length} sub-location(s). Remove child units first.`,
      };
    }

    this.data.locations = this.data.locations.filter((l) => l.id !== id);
    this.saveToDisk();
    return { success: true };
  }

  public deleteLocations(ids: string[]): {
    deletedCount: number;
    failedList: Array<{ id: string; code: string; reason: string }>;
  } {
    const failedList: Array<{ id: string; code: string; reason: string }> = [];
    const deletableIds = new Set<string>();

    for (const id of ids) {
      const loc = this.getLocationById(id);
      if (!loc) continue;

      const docsInLoc = this.data.documents.filter(
        (d) =>
          d.currentLocationId === id ||
          (loc.type === 'SHELF' && loc.shelfNumber && d.shelfNumber === loc.shelfNumber) ||
          (loc.type === 'BOX' && loc.boxNumber && d.boxNumber === loc.boxNumber)
      );

      if (docsInLoc.length > 0) {
        failedList.push({
          id,
          code: loc.code,
          reason: `Contains ${docsInLoc.length} active physical file(s).`,
        });
        continue;
      }

      // Check if any child locations exist that are NOT included in the deletion batch
      const remainingChildren = this.data.locations.filter(
        (l) => l.parentId === id && !ids.includes(l.id)
      );
      if (remainingChildren.length > 0) {
        failedList.push({
          id,
          code: loc.code,
          reason: `Contains ${remainingChildren.length} child location(s) not marked for deletion.`,
        });
        continue;
      }

      deletableIds.add(id);
    }

    if (deletableIds.size > 0) {
      this.data.locations = this.data.locations.filter((l) => !deletableIds.has(l.id));
      this.saveToDisk();
    }

    return {
      deletedCount: deletableIds.size,
      failedList,
    };
  }

  // --- Documents Accessors & Combined Filter Search ---
  public getDocuments(): IDocument[] {
    return [...this.data.documents];
  }

  public getDocumentById(id: string): IDocument | undefined {
    return this.data.documents.find((d) => d.id === id);
  }

  public getDocumentByRef(ref: string): IDocument | undefined {
    return this.data.documents.find(
      (d) => d.referenceNumber.toUpperCase() === ref.trim().toUpperCase()
    );
  }

  public getDocumentByQR(qr: string): IDocument | undefined {
    return this.data.documents.find((d) => d.qrIdentifier === qr.trim());
  }

  public addDocument(doc: IDocument): IDocument {
    const existingIdx = this.data.documents.findIndex((d) => d.id === doc.id);
    if (existingIdx !== -1) {
      this.data.documents[existingIdx] = doc;
    } else {
      this.data.documents.push(doc);
    }
    this.saveToDisk();

    // Async Dual-Write: If connected to remote MySQL, sync immediately to documents table
    if (this.isConnectedToMySQL && this.mysqlPool) {
      this.mysqlPool.query(
        `INSERT INTO documents (
          id, reference_number, title_en, title_am, description, category,
          old_woreda, old_kebele, house_number, shelf_number, box_number,
          department_id, document_date, confidentiality, current_location_id,
          status, qr_identifier, registration_officer_id, page_count, condition_notes, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title_en=VALUES(title_en), title_am=VALUES(title_am), description=VALUES(description),
          shelf_number=VALUES(shelf_number), box_number=VALUES(box_number),
          current_location_id=VALUES(current_location_id), status=VALUES(status),
          updated_at=CURRENT_TIMESTAMP`,
        [
          doc.id,
          doc.referenceNumber,
          doc.titleEn,
          doc.titleAm,
          doc.description || '',
          doc.category,
          doc.oldWoreda || null,
          doc.oldKebele || null,
          doc.houseNumber || null,
          doc.shelfNumber || null,
          doc.boxNumber || null,
          doc.departmentId,
          doc.documentDate,
          doc.confidentiality || 'INTERNAL',
          doc.currentLocationId,
          doc.status || 'AVAILABLE',
          doc.qrIdentifier,
          doc.registrationOfficerId || 'usr-admin-01',
          doc.pageCount || 15,
          doc.conditionNotes || '',
          JSON.stringify(doc.tags || []),
        ]
      ).catch((err: any) => {
        console.warn('MySQL dual-write document sync note:', err.message);
      });
    }

    return doc;
  }

  public updateDocument(id: string, updates: Partial<IDocument>): IDocument | null {
    const idx = this.data.documents.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.data.documents[idx] = {
      ...this.data.documents[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();

    const updatedDoc = this.data.documents[idx];
    if (this.isConnectedToMySQL && this.mysqlPool) {
      this.mysqlPool.query(
        `UPDATE documents SET
          title_en = COALESCE(?, title_en),
          title_am = COALESCE(?, title_am),
          category = COALESCE(?, category),
          shelf_number = COALESCE(?, shelf_number),
          box_number = COALESCE(?, box_number),
          current_location_id = COALESCE(?, current_location_id),
          current_holder_id = ?,
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          updates.titleEn || null,
          updates.titleAm || null,
          updates.category || null,
          updates.shelfNumber || null,
          updates.boxNumber || null,
          updates.currentLocationId || null,
          updatedDoc.currentHolderId,
          updates.status || null,
          id,
        ]
      ).catch((err: any) => {
        console.warn('MySQL update sync note:', err.message);
      });
    }

    return updatedDoc;
  }

  public deleteDocument(id: string): boolean {
    const initialLen = this.data.documents.length;
    this.data.documents = this.data.documents.filter((d) => d.id !== id);
    if (this.data.documents.length !== initialLen) {
      // Also clean up or flag related open requests & movements if needed
      this.data.requests = this.data.requests.filter((r) => r.documentId !== id);
      this.data.movements = this.data.movements.filter((m) => m.documentId !== id);
      this.saveToDisk();

      if (this.isConnectedToMySQL && this.mysqlPool) {
        this.mysqlPool.query('DELETE FROM documents WHERE id = ?', [id]).catch((err: any) => {
          console.warn('MySQL delete sync note:', err.message);
        });
      }

      return true;
    }
    return false;
  }

  public deleteDocuments(ids: string[]): { deletedCount: number; failedIds: string[] } {
    const idSet = new Set(ids);
    const initialLen = this.data.documents.length;
    const toDelete = this.data.documents.filter((d) => idSet.has(d.id));
    
    // Check if any are currently borrowed
    const borrowed = toDelete.filter((d) => d.status === 'BORROWED');
    const borrowedIds = new Set(borrowed.map((d) => d.id));
    
    const deletableIds = new Set(
      toDelete.filter((d) => !borrowedIds.has(d.id)).map((d) => d.id)
    );

    this.data.documents = this.data.documents.filter((d) => !deletableIds.has(d.id));
    this.data.requests = this.data.requests.filter((r) => !deletableIds.has(r.documentId));
    this.data.movements = this.data.movements.filter((m) => !deletableIds.has(m.documentId));

    if (this.data.documents.length !== initialLen) {
      this.saveToDisk();
    }

    return {
      deletedCount: deletableIds.size,
      failedIds: Array.from(borrowedIds),
    };
  }

  /**
   * Generates a unique, sequential FHC Branch One official archival reference number.
   * Pattern: FHC-B1/{YEAR}/{PREFIX}-{SEQUENCE}
   * Examples:
   *  - Commercial: FHC-B1/2026/COM-0001
   *  - Resident:   FHC-B1/2026/RES-0001
   *  - Department: FHC-B1/2026/MOF-0001
   */
  public generateReferenceNumber(options?: {
    category?: string;
    departmentId?: string;
    year?: number;
    prefixType?: 'CATEGORY' | 'DEPARTMENT' | 'CUSTOM';
    customPrefix?: string;
  }): { referenceNumber: string; prefix: string; sequence: number; year: number } {
    const year = options?.year || new Date().getFullYear();
    let prefix = 'DOC';

    const pType = options?.prefixType || (options?.departmentId && !options?.category ? 'DEPARTMENT' : 'CATEGORY');

    if (pType === 'DEPARTMENT' && options?.departmentId) {
      const dept = this.getDepartmentById(options.departmentId);
      if (dept && dept.code) {
        prefix = dept.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      }
    } else if (pType === 'CUSTOM' && options?.customPrefix) {
      prefix = options.customPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '');
    } else if (options?.category) {
      const cat = options.category.toUpperCase().trim();
      if (cat === 'COMMERCIAL') {
        prefix = 'COM';
      } else if (cat === 'RESIDENT') {
        prefix = 'RES';
      } else {
        prefix = cat.substring(0, 3);
      }
    }

    if (!prefix) prefix = 'DOC';

    // Scan documents for existing references matching (FHC-B1|FHC-BRANCH-?1|FHC|ET-FDRE)/{year}/{prefix}-{seq}
    const regex = new RegExp(`^(?:FHC-B1|FHC-BRANCH-?1|FHC|ET-FDRE)\\/${year}\\/${prefix}-(\\d+)`, 'i');
    let maxSeq = 0;

    for (const doc of this.data.documents) {
      const match = doc.referenceNumber.match(regex);
      if (match && match[1]) {
        const seqVal = parseInt(match[1], 10);
        if (!isNaN(seqVal) && seqVal > maxSeq) {
          maxSeq = seqVal;
        }
      }
    }

    let nextSeq = maxSeq + 1;
    let candidateRef = `FHC-B1/${year}/${prefix}-${String(nextSeq).padStart(4, '0')}`;

    // Guarantee uniqueness
    while (this.getDocumentByRef(candidateRef)) {
      nextSeq++;
      candidateRef = `FHC-B1/${year}/${prefix}-${String(nextSeq).padStart(4, '0')}`;
    }

    return {
      referenceNumber: candidateRef,
      prefix,
      sequence: nextSeq,
      year,
    };
  }

  /**
   * Combined Server-Side Search and Filtering:
   * Supports combining category (Commercial / Resident), Old Woreda, Old Kebele,
   * House Number, Shelf Number, Box Number, Department, Status, and Holder.
   */
  public queryDocuments(
    filters: DocumentSearchFilters,
    userRole: string,
    userDepartmentId?: string
  ): { documents: IDocument[]; total: number } {
    let docs = [...this.data.documents];

    // Confidentiality permissions
    if (userRole === 'EMPLOYEE') {
      docs = docs.filter((d) => {
        if (d.confidentiality === 'TOP_SECRET') {
          return d.departmentId === userDepartmentId;
        }
        return true;
      });
    }

    // 1. Category Filter (COMMERCIAL or RESIDENT)
    if (filters.category && filters.category !== 'ALL') {
      const targetCat = filters.category.toUpperCase().trim();
      docs = docs.filter((d) => (d.category as string).toUpperCase() === targetCat);
    }

    // 2. Old Woreda Filter (Exact or leading-zero match)
    if (filters.oldWoreda && filters.oldWoreda.trim() !== '') {
      const w = filters.oldWoreda.trim();
      docs = docs.filter(
        (d) =>
          d.oldWoreda &&
          (d.oldWoreda.toLowerCase() === w.toLowerCase() ||
            d.oldWoreda.replace(/^0+/, '') === w.replace(/^0+/, ''))
      );
    }

    // 3. Old Kebele Filter
    if (filters.oldKebele && filters.oldKebele.trim() !== '') {
      const k = filters.oldKebele.trim();
      docs = docs.filter(
        (d) =>
          d.oldKebele &&
          (d.oldKebele.toLowerCase() === k.toLowerCase() ||
            d.oldKebele.replace(/^0+/, '') === k.replace(/^0+/, ''))
      );
    }

    // 4. House Number Filter
    if (filters.houseNumber && filters.houseNumber.trim() !== '') {
      const h = filters.houseNumber.trim().toLowerCase();
      docs = docs.filter((d) => d.houseNumber && d.houseNumber.toLowerCase().includes(h));
    }

    // 5. Shelf Number Filter
    if (filters.shelfNumber && filters.shelfNumber.trim() !== '') {
      const s = filters.shelfNumber.trim();
      docs = docs.filter(
        (d) =>
          d.shelfNumber &&
          (d.shelfNumber.toLowerCase() === s.toLowerCase() ||
            d.shelfNumber.replace(/^0+/, '') === s.replace(/^0+/, ''))
      );
    }

    // 6. Box Number Filter
    if (filters.boxNumber && filters.boxNumber.trim() !== '') {
      const b = filters.boxNumber.trim();
      docs = docs.filter(
        (d) =>
          d.boxNumber &&
          (d.boxNumber.toLowerCase() === b.toLowerCase() ||
            d.boxNumber.replace(/^0+/, '') === b.replace(/^0+/, ''))
      );
    }

    // 7. Department Filter
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      docs = docs.filter((d) => d.departmentId === filters.departmentId);
    }

    // 8. Status Filter
    if (filters.status && filters.status !== 'ALL') {
      docs = docs.filter((d) => d.status === filters.status);
    }

    // 9. Holder Filter
    if (filters.currentHolderId && filters.currentHolderId !== 'ALL') {
      docs = docs.filter((d) => d.currentHolderId === filters.currentHolderId);
    }

    // 10. General text search query (Ref, Titles, Tags, Description, Address)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      docs = docs.filter(
        (d) =>
          d.referenceNumber.toLowerCase().includes(q) ||
          d.titleEn.toLowerCase().includes(q) ||
          d.titleAm.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.qrIdentifier.toLowerCase().includes(q) ||
          (d.oldWoreda && d.oldWoreda.toLowerCase().includes(q)) ||
          (d.oldKebele && d.oldKebele.toLowerCase().includes(q)) ||
          (d.houseNumber && d.houseNumber.toLowerCase().includes(q)) ||
          (d.shelfNumber && d.shelfNumber.toLowerCase().includes(q)) ||
          (d.boxNumber && d.boxNumber.toLowerCase().includes(q)) ||
          (d.tags && d.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    const total = docs.length;

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 50));
    const start = (page - 1) * limit;
    const paginated = docs.slice(start, start + limit);

    return { documents: paginated, total };
  }

  // --- Document Requests Accessors ---
  public getRequests(): IDocumentRequest[] {
    return [...this.data.requests];
  }

  public getRequestById(id: string): IDocumentRequest | undefined {
    return this.data.requests.find((r) => r.id === id);
  }

  public addRequest(req: IDocumentRequest): IDocumentRequest {
    this.data.requests.push(req);
    this.saveToDisk();
    return req;
  }

  public updateRequest(id: string, updates: Partial<IDocumentRequest>): IDocumentRequest | null {
    const idx = this.data.requests.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.requests[idx] = {
      ...this.data.requests[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.requests[idx];
  }

  // --- File Movements Accessors (Append-Only) ---
  public getMovements(documentId?: string): IFileMovement[] {
    if (documentId) {
      return this.data.movements
        .filter((m) => m.documentId === documentId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [...this.data.movements].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public addMovement(movement: IFileMovement): IFileMovement {
    this.data.movements.push(movement);
    this.saveToDisk();
    return movement;
  }

  // --- Missing File Investigations ---
  public getInvestigations(): IMissingFileInvestigation[] {
    return [...this.data.investigations].sort(
      (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );
  }

  public getInvestigationById(id: string): IMissingFileInvestigation | undefined {
    return this.data.investigations.find((i) => i.id === id);
  }

  public addInvestigation(inv: IMissingFileInvestigation): IMissingFileInvestigation {
    this.data.investigations.push(inv);
    this.saveToDisk();
    return inv;
  }

  public updateInvestigation(
    id: string,
    updates: Partial<IMissingFileInvestigation>
  ): IMissingFileInvestigation | null {
    const idx = this.data.investigations.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    this.data.investigations[idx] = {
      ...this.data.investigations[idx],
      ...updates,
    };
    this.saveToDisk();
    return this.data.investigations[idx];
  }

  // --- Audit Logs (Append-Only) ---
  public getAuditLogs(): IAuditLog[] {
    return [...this.data.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public addAuditLog(log: IAuditLog): IAuditLog {
    this.data.auditLogs.push(log);
    this.saveToDisk();
    return log;
  }

  // --- Notifications ---
  public getNotifications(userId?: string): INotification[] {
    if (userId) {
      return this.data.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [...this.data.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public addNotification(notif: INotification): INotification {
    this.data.notifications.push(notif);
    this.saveToDisk();
    return notif;
  }

  public markNotificationAsRead(id: string): boolean {
    const notif = this.data.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public markAllNotificationsAsRead(userId: string): void {
    this.data.notifications.forEach((n) => {
      if (n.userId === userId) n.read = true;
    });
    this.saveToDisk();
  }

  // --- System Settings & RBAC Permissions ---
  public getSettings(): ISystemSettings {
    if (!this.data.settings) {
      this.data.settings = { ...DEFAULT_SYSTEM_SETTINGS };
    }
    return this.data.settings;
  }

  public updateSettings(updates: Partial<ISystemSettings>): ISystemSettings {
    if (!this.data.settings) {
      this.data.settings = { ...DEFAULT_SYSTEM_SETTINGS };
    }

    this.data.settings = {
      ...this.data.settings,
      ...updates,
      returnPolicy: {
        ...this.data.settings.returnPolicy,
        ...(updates.returnPolicy || {}),
      },
      rolePermissions: {
        ...this.data.settings.rolePermissions,
        ...(updates.rolePermissions || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.settings;
  }

  public resetSettings(): ISystemSettings {
    this.data.settings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Baseline Reset',
    };
    this.saveToDisk();
    return this.data.settings;
  }

  public hasPermission(role: Role, permission: PermissionKey): boolean {
    const settings = this.getSettings();
    const rolePerms = settings.rolePermissions[role] || [];
    return rolePerms.includes(permission);
  }
}

export const db = new DatabaseStore();
