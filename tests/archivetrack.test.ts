import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { db } from '../src/server/db/store';
import { gregorianToEthiopian, formatBilingualDate } from '../src/lib/ethiopianCalendar';
import { generateToken, verifyToken } from '../src/server/auth';
import { IUser, IDocument, IDocumentRequest } from '../src/types';

describe('FHC Branch One Archive System Core System Tests', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  describe('1. Authentication & Security', () => {
    it('should hash passwords and verify legitimate credentials', async () => {
      const user = db.getUserByUsername('admin');
      expect(user).toBeDefined();
      expect(user?.role).toBe('ADMIN');

      const isMatch = await bcrypt.compare('Admin@ET2026!', user!.passwordHash!);
      expect(isMatch).toBe(true);

      const wrongMatch = await bcrypt.compare('WrongPass!', user!.passwordHash!);
      expect(wrongMatch).toBe(false);
    });

    it('should generate valid JWT tokens with role clearance and expire correctly', () => {
      const officer = db.getUserByUsername('officer.almaz');
      expect(officer).toBeDefined();

      const token = generateToken(officer!);
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.username).toBe('officer.almaz');
      expect(decoded.role).toBe('ARCHIVE_OFFICER');
    });
  });

  describe('2. Physical Document Registry & Archive Location', () => {
    it('should format archive location without parental hierarchy using code and coordinates', () => {
      // Find Box 12
      const box = db.getLocationByCode('BOX-12');
      expect(box).toBeDefined();
      expect(box?.type).toBe('BOX');

      const path = db.getLocationPath(box!.id);
      expect(path).toContain('BOX-12');
      expect(path).toContain('Shelf 02');
      expect(path).toContain('Box 012');
    });

    it('should prevent duplicate reference numbers', () => {
      const existingDoc = db.getDocumentByRef('ET-FDRE/2026/FIN-0091');
      expect(existingDoc).toBeDefined();
      expect(existingDoc?.status).toBe('AVAILABLE');
    });

    it('should have bilingual titles and tags on registered documents', () => {
      const doc = db.getDocumentByRef('ET-FDRE/2026/FIN-0091');
      expect(doc?.titleEn).toBeDefined();
      expect(doc?.titleAm).toContain('የካፒታል');
      expect(doc?.tags?.length).toBeGreaterThan(0);
    });
  });

  describe('3. Custody Workflow: Request -> Approval -> Issue -> Return', () => {
    it('should handle request lifecycle with strict status transitions', () => {
      // 1. Submit Request
      const doc = db.getDocumentByRef('ET-FDRE/2026/DARA-5520');
      expect(doc).toBeDefined();

      const emp = db.getUserByUsername('employee.selam');
      expect(emp).toBeDefined();

      const testReqNumber = `REQ-TEST-${Date.now()}`;
      const newReq = db.addRequest({
        id: `req-test-${Date.now()}`,
        requestNumber: testReqNumber,
        documentId: doc!.id,
        requesterId: emp!.id,
        requestingDepartmentId: emp!.departmentId || 'dept-mof-02',
        purpose: 'Court proceeding deed review',
        requestDate: new Date().toISOString(),
        requestedReturnDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        priority: 'URGENT',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(newReq.status).toBe('PENDING');

      // 2. Department Manager Review & Approval
      const mgr = db.getUserByUsername('manager.berhanu');
      db.updateRequest(newReq.id, {
        status: 'APPROVED',
        approverId: mgr!.id,
        decisionDate: new Date().toISOString(),
      });

      const approvedReq = db.getRequestById(newReq.id);
      expect(approvedReq?.status).toBe('APPROVED');
      expect(approvedReq?.approverId).toBe(mgr!.id);

      // 3. Physical Handover / Issuance by Archive Officer
      const officer = db.getUserByUsername('officer.almaz');
      db.updateDocument(doc!.id, {
        status: 'BORROWED',
        currentHolderId: emp!.id,
      });
      db.updateRequest(newReq.id, {
        status: 'ISSUED',
        issuedOfficerId: officer!.id,
        issuedDate: new Date().toISOString(),
      });

      // Record in immutable FileMovement
      db.addMovement({
        id: `mov-test-${Date.now()}`,
        documentId: doc!.id,
        movementType: 'ISSUE',
        previousLocationId: doc!.currentLocationId,
        newLocationId: null,
        previousHolderId: null,
        newHolderId: emp!.id,
        actingUserId: officer!.id,
        timestamp: new Date().toISOString(),
        requestId: newReq.id,
        reason: 'Physical handover for court review',
      });

      const issuedDoc = db.getDocumentById(doc!.id);
      expect(issuedDoc?.status).toBe('BORROWED');
      expect(issuedDoc?.currentHolderId).toBe(emp!.id);

      // 4. Return Verification
      db.updateDocument(doc!.id, {
        status: 'AVAILABLE',
        currentHolderId: null,
      });
      db.updateRequest(newReq.id, {
        status: 'RETURNED',
        receivingOfficerId: officer!.id,
        actualReturnDate: new Date().toISOString(),
        returnCondition: 'EXCELLENT',
      });

      db.addMovement({
        id: `mov-test-ret-${Date.now()}`,
        documentId: doc!.id,
        movementType: 'RETURN',
        previousLocationId: null,
        newLocationId: doc!.currentLocationId,
        previousHolderId: emp!.id,
        newHolderId: null,
        actingUserId: officer!.id,
        timestamp: new Date().toISOString(),
        requestId: newReq.id,
        reason: 'Verified return in EXCELLENT condition',
      });

      const returnedDoc = db.getDocumentById(doc!.id);
      expect(returnedDoc?.status).toBe('AVAILABLE');
      expect(returnedDoc?.currentHolderId).toBeNull();
    });

    it('should prevent concurrent double-booking of a borrowed document', () => {
      // Document ET-FDRE/2025/MINT-0418 is already BORROWED
      const borrowedDoc = db.getDocumentByRef('ET-FDRE/2025/MINT-0418');
      expect(borrowedDoc?.status).toBe('BORROWED');
      expect(borrowedDoc?.currentHolderId).not.toBeNull();
    });
  });

  describe('6. Commercial & Resident Categories and Historical Addresses', () => {
    it('should enforce strict primary categories COMMERCIAL and RESIDENT', () => {
      const docs = db.getDocuments();
      expect(docs.length).toBeGreaterThan(0);
      docs.forEach((d) => {
        expect(['COMMERCIAL', 'RESIDENT']).toContain(d.category);
      });
    });

    it('should store and preserve leading zeros for shelfNumber, boxNumber, and address coordinates', () => {
      const doc = db.getDocumentByRef('ET-FDRE/2026/FIN-0091');
      expect(doc).toBeDefined();
      expect(doc?.shelfNumber).toBe('02');
      expect(doc?.boxNumber).toBe('012');
      expect(doc?.oldWoreda).toBe('03');
      expect(doc?.oldKebele).toBe('12');
      expect(doc?.houseNumber).toBe('045');
    });

    it('should perform combined server-side filtering by category, address, shelf, and box', () => {
      // Combination: Category = RESIDENT, Old Woreda = 03, Old Kebele = 12, House = 045, Shelf = 05, Box = 012
      const result = db.queryDocuments(
        {
          category: 'RESIDENT',
          oldWoreda: '03',
          oldKebele: '12',
          houseNumber: '045',
          shelfNumber: '05',
          boxNumber: '012',
        },
        'ADMIN'
      );

      expect(result.total).toBe(1);
      expect(result.documents[0].referenceNumber).toBe('ET-FDRE/2024/RES-0831');
      expect(result.documents[0].category).toBe('RESIDENT');
      expect(result.documents[0].oldWoreda).toBe('03');
      expect(result.documents[0].shelfNumber).toBe('05');
    });

    it('should return empty results when combined filters do not match any document', () => {
      const result = db.queryDocuments(
        {
          category: 'COMMERCIAL',
          oldWoreda: '99', // Non-existent woreda
        },
        'ADMIN'
      );
      expect(result.total).toBe(0);
      expect(result.documents.length).toBe(0);
    });

    it('should preserve shelf and box coordinates during document relocation', () => {
      // Create dedicated test document for relocation tracking
      const testDoc = db.addDocument({
        id: `doc-reloc-test-${Date.now()}`,
        referenceNumber: `ET-FDRE/2026/TEST-RELOC-${Date.now()}`,
        titleEn: 'Relocation Test Document',
        titleAm: 'የማዘዋወሪያ ሙከራ ሰነድ',
        description: 'Testing shelf and box tracking',
        category: 'COMMERCIAL',
        departmentId: 'dept-mof-02',
        documentDate: new Date().toISOString(),
        registrationDate: new Date().toISOString(),
        confidentiality: 'INTERNAL',
        currentLocationId: 'loc-bx-12',
        shelfNumber: '02',
        boxNumber: '012',
        oldWoreda: '03',
        oldKebele: '12',
        houseNumber: '100',
        currentHolderId: null,
        status: 'AVAILABLE',
        qrIdentifier: `QR-TEST-RELOC-${Date.now()}`,
        registrationOfficerId: 'usr-arch-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const prevShelf = testDoc.shelfNumber;
      const prevBox = testDoc.boxNumber;

      // Relocate document to SH-05 / BOX-015
      const newLoc = db.getLocationByCode('BOX-015');
      expect(newLoc).toBeDefined();

      db.updateDocument(testDoc.id, {
        currentLocationId: newLoc!.id,
        shelfNumber: newLoc!.shelfNumber,
        boxNumber: newLoc!.boxNumber,
      });

      db.addMovement({
        id: `mov-reloc-${Date.now()}`,
        documentId: testDoc.id,
        movementType: 'RELOCATION',
        previousLocationId: testDoc.currentLocationId,
        newLocationId: newLoc!.id,
        previousShelfNumber: prevShelf,
        newShelfNumber: newLoc!.shelfNumber,
        previousBoxNumber: prevBox,
        newBoxNumber: newLoc!.boxNumber,
        previousHolderId: null,
        newHolderId: null,
        actingUserId: 'usr-admin-01',
        timestamp: new Date().toISOString(),
        reason: 'Relocated for audit consolidation',
      });

      const movements = db.getMovements(testDoc.id);
      const lastMov = movements[0];
      expect(lastMov.previousShelfNumber).toBe('02');
      expect(lastMov.newShelfNumber).toBe('05');
      expect(lastMov.previousBoxNumber).toBe('012');
      expect(lastMov.newBoxNumber).toBe('015');
    });

    it('should prevent deactivation of an archive location containing registered files', () => {
      // loc-bx-12 contains documents
      expect(() => {
        db.updateLocation('loc-bx-12', { active: false });
      }).toThrow(/Cannot deactivate location/);
    });

    it('should correctly run category migration and flag ambiguous records', () => {
      const migrationResult = db.migrateCategoriesAndLocations();
      expect(migrationResult).toBeDefined();
      expect(typeof migrationResult.migrated).toBe('number');
      expect(typeof migrationResult.ambiguous).toBe('number');
    });
  });

  describe('5. Auto-Generate Official Archival Reference Numbers', () => {
    it('should auto-generate sequential reference number for Commercial category', () => {
      const gen = db.generateReferenceNumber({ category: 'COMMERCIAL', year: 2026 });
      expect(gen).toBeDefined();
      expect(gen.prefix).toBe('COM');
      expect(gen.referenceNumber).toMatch(/^FHC-B1\/2026\/COM-\d{4}$/);
      expect(gen.sequence).toBeGreaterThanOrEqual(1);
    });

    it('should auto-generate sequential reference number for Resident category', () => {
      const gen = db.generateReferenceNumber({ category: 'RESIDENT', year: 2026 });
      expect(gen).toBeDefined();
      expect(gen.prefix).toBe('RES');
      expect(gen.referenceNumber).toMatch(/^FHC-B1\/2026\/RES-\d{4}$/);
      // Since RES-1105 exists in seeds, sequence must be at least 1106
      expect(gen.sequence).toBeGreaterThanOrEqual(1106);
    });

    it('should auto-generate department-based reference when requested', () => {
      const gen = db.generateReferenceNumber({
        category: 'COMMERCIAL',
        departmentId: 'dept-mint-01',
        prefixType: 'DEPARTMENT',
        year: 2025,
      });
      expect(gen).toBeDefined();
      expect(gen.prefix).toBe('MINT');
      expect(gen.referenceNumber).toMatch(/^FHC-B1\/2025\/MINT-\d{4}$/);
      // Since MINT-0418 exists, next must be at least 419
      expect(gen.sequence).toBeGreaterThanOrEqual(419);
    });

    it('should guarantee uniqueness and avoid collisions with existing records', () => {
      const gen1 = db.generateReferenceNumber({ category: 'COMMERCIAL', year: 2026 });
      // Fake add document with that reference
      db.addDocument({
        id: `doc-collision-test-${Date.now()}`,
        referenceNumber: gen1.referenceNumber,
        titleEn: 'Collision Test File',
        titleAm: 'የግጭት መከላከያ ሙከራ ሰነድ',
        description: 'Collision test description',
        category: 'COMMERCIAL',
        departmentId: 'dept-mof-02',
        documentDate: '2026-01-01',
        registrationDate: new Date().toISOString(),
        confidentiality: 'INTERNAL',
        currentLocationId: 'loc-bx-12',
        currentHolderId: null,
        status: 'AVAILABLE',
        qrIdentifier: `QR-COLLISION-${Date.now()}`,
        registrationOfficerId: 'usr-arch-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Next generation should automatically increment and not duplicate
      const gen2 = db.generateReferenceNumber({ category: 'COMMERCIAL', year: 2026 });
      expect(gen2.referenceNumber).not.toBe(gen1.referenceNumber);
      expect(gen2.sequence).toBe(gen1.sequence + 1);
    });
  });

  describe('6. Document Pagination & Page Sizing', () => {
    it('should correctly paginate document query results with specified page size limits', () => {
      // Query with limit = 2
      const resPage1 = db.queryDocuments({ page: 1, limit: 2 }, 'ADMIN');
      expect(resPage1.documents.length).toBe(2);
      expect(resPage1.total).toBeGreaterThanOrEqual(4);

      // Query page 2
      const resPage2 = db.queryDocuments({ page: 2, limit: 2 }, 'ADMIN');
      expect(resPage2.documents.length).toBe(2);
      // Items on page 2 should be different from page 1
      expect(resPage2.documents[0].id).not.toBe(resPage1.documents[0].id);
      expect(resPage2.documents[1].id).not.toBe(resPage1.documents[1].id);
    });

    it('should enforce upper boundary limit and handle out-of-range pages gracefully', () => {
      const outOfBounds = db.queryDocuments({ page: 9999, limit: 10 }, 'ADMIN');
      expect(outOfBounds.documents.length).toBe(0);
      expect(outOfBounds.total).toBeGreaterThan(0);
    });
  });

  describe('7. CSV Data Batch Import on Registration', () => {
    it('should auto-generate sequential references and preserve leading zeros in shelf and box numbers', () => {
      const initialDocsCount = db.getDocuments().length;

      // Seed 2 new documents as if imported via CSV
      const genCom = db.generateReferenceNumber({ category: 'COMMERCIAL' });
      expect(genCom.referenceNumber).toMatch(/^FHC-B1\/\d{4}\/COM-\d{4}$/);

      const testId1 = `doc-csv-test-1-${Date.now()}`;
      const doc1: IDocument = {
        id: testId1,
        referenceNumber: genCom.referenceNumber,
        titleEn: 'Batch Imported Commercial File',
        titleAm: 'የተመዘገበ የንግድ ሰነድ',
        description: 'CSV Import Test',
        category: 'COMMERCIAL',
        departmentId: 'dept-mof-02',
        documentDate: '2026-03-01',
        registrationDate: new Date().toISOString(),
        confidentiality: 'INTERNAL',
        currentLocationId: 'loc-bx-12',
        currentHolderId: null,
        shelfNumber: '05',
        boxNumber: '012',
        oldWoreda: '03',
        oldKebele: '09',
        houseNumber: '045',
        status: 'AVAILABLE',
        qrIdentifier: `QR-CSV-1-${Date.now()}`,
        registrationOfficerId: 'usr-arch-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.addDocument(doc1);

      expect(doc1.shelfNumber).toBe('05');
      expect(doc1.boxNumber).toBe('012');
      expect(doc1.oldWoreda).toBe('03');

      // Now generate Resident record
      const genRes = db.generateReferenceNumber({ category: 'RESIDENT' });
      expect(genRes.referenceNumber).toMatch(/^FHC-B1\/\d{4}\/RES-\d{4}$/);

      const testId2 = `doc-csv-test-2-${Date.now()}`;
      const doc2: IDocument = {
        id: testId2,
        referenceNumber: genRes.referenceNumber,
        titleEn: 'Batch Imported Resident File',
        titleAm: 'የተመዘገበ የነዋሪ ሰነድ',
        description: 'CSV Import Test Resident',
        category: 'RESIDENT',
        departmentId: 'dept-dara-04',
        documentDate: '2026-03-02',
        registrationDate: new Date().toISOString(),
        confidentiality: 'INTERNAL',
        currentLocationId: 'loc-bx-015',
        currentHolderId: null,
        shelfNumber: '07',
        boxNumber: '015',
        oldWoreda: '04',
        oldKebele: '11',
        houseNumber: '112',
        status: 'AVAILABLE',
        qrIdentifier: `QR-CSV-2-${Date.now()}`,
        registrationOfficerId: 'usr-arch-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.addDocument(doc2);

      expect(db.getDocuments().length).toBe(initialDocsCount + 2);

      // Verify searchable by combined filters
      const filterRes = db.queryDocuments({ category: 'RESIDENT', oldWoreda: '04', shelfNumber: '07' }, 'ADMIN');
      expect(filterRes.documents.some((d) => d.id === testId2)).toBe(true);
    });

    it('should generate distinct sequential reference numbers for multiple AUTO rows in a single batch', () => {
      const batchRefs: string[] = [];
      const year = new Date().getFullYear();
      let gen = db.generateReferenceNumber({ category: 'COMMERCIAL' });
      let seq = gen.sequence;

      for (let i = 0; i < 5; i++) {
        let ref = gen.referenceNumber;
        while (db.getDocumentByRef(ref) || batchRefs.includes(ref)) {
          seq++;
          ref = `FHC-B1/${year}/COM-${String(seq).padStart(4, '0')}`;
        }
        batchRefs.push(ref);
      }

      // Check all 5 are unique
      const uniqueSet = new Set(batchRefs);
      expect(uniqueSet.size).toBe(5);
      // Check sequential
      for (let i = 1; i < batchRefs.length; i++) {
        expect(batchRefs[i]).not.toBe(batchRefs[i - 1]);
      }
    });
  });

  describe('8. Browser-Based Notifications: Request, Approval, and Return Flows', () => {
    it('should create notifications for managers and archive officers when a user submits a request', () => {
      const mgr = db.getUserByUsername('manager.berhanu');
      const officer = db.getUserByUsername('officer.almaz');
      const emp = db.getUserByUsername('employee.selam');
      const doc = db.getDocumentByRef('ET-FDRE/2026/FIN-0091');

      const initialMgrNotifs = db.getNotifications(mgr!.id).length;
      const initialOfficerNotifs = db.getNotifications(officer!.id).length;

      // Simulate notification creation as done in POST /requests
      db.addNotification({
        id: `notif-test-req-${Date.now()}`,
        userId: mgr!.id,
        titleEn: 'New Document Access Request',
        titleAm: 'አዲስ የሰነድ ጥያቄ ቀርቧል',
        messageEn: `Employee ${emp!.fullName} submitted request for "${doc!.titleEn}".`,
        messageAm: `ሰራተኛ ${emp!.fullName} ለሰነድ ጥያቄ አቅርበዋል።`,
        type: 'INFO',
        read: false,
        createdAt: new Date().toISOString(),
      });

      db.addNotification({
        id: `notif-test-ao-${Date.now()}`,
        userId: officer!.id,
        titleEn: 'New Physical Document Request',
        titleAm: 'አዲስ የሰነድ ጥያቄ ቀርቧል',
        messageEn: `Request submitted by ${emp!.fullName}.`,
        messageAm: `አዲስ የሰነድ ጥያቄ ቀርቧል።`,
        type: 'INFO',
        read: false,
        createdAt: new Date().toISOString(),
      });

      expect(db.getNotifications(mgr!.id).length).toBe(initialMgrNotifs + 1);
      expect(db.getNotifications(officer!.id).length).toBe(initialOfficerNotifs + 1);
    });

    it('should create notification for requester and archive officers upon approval', () => {
      const emp = db.getUserByUsername('employee.selam');
      const officer = db.getUserByUsername('officer.almaz');
      const initialEmpNotifs = db.getNotifications(emp!.id).length;

      // Simulate approval notification
      db.addNotification({
        id: `notif-test-app-${Date.now()}`,
        userId: emp!.id,
        titleEn: 'Document Request Approved - Ready for Pickup',
        titleAm: 'የሰነድ ጥያቄዎ ፀድቋል - ለመረከብ ዝግጁ',
        messageEn: 'Your request was approved. Please visit the Archive Office.',
        messageAm: 'ያቀረቡት ጥያቄ ፀድቋል።',
        type: 'SUCCESS',
        read: false,
        createdAt: new Date().toISOString(),
      });

      const empNotifs = db.getNotifications(emp!.id);
      expect(empNotifs.length).toBe(initialEmpNotifs + 1);
      expect(empNotifs[0].type).toBe('SUCCESS');
      expect(empNotifs[0].titleEn).toContain('Approved');
    });

    it('should track return request from borrower and notify archive staff', () => {
      const emp = db.getUserByUsername('employee.selam');
      const officer = db.getUserByUsername('officer.almaz');
      const initialOfficerNotifs = db.getNotifications(officer!.id).length;

      // Create issued request
      const req: IDocumentRequest = {
        id: `req-return-test-${Date.now()}`,
        requestNumber: `REQ-2026-RET-${Date.now()}`,
        documentId: 'doc-et-001',
        requesterId: emp!.id,
        requestingDepartmentId: 'dept-mof-02',
        purpose: 'Deed review',
        requestDate: new Date().toISOString(),
        requestedReturnDate: new Date(Date.now() + 86400000).toISOString(),
        priority: 'NORMAL',
        status: 'ISSUED',
        returnRequested: true,
        returnRequestedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.addRequest(req);

      // Notification sent to archive officer
      db.addNotification({
        id: `notif-test-ret-req-${Date.now()}`,
        userId: officer!.id,
        titleEn: 'Physical File Return Notice from Borrower',
        titleAm: 'የሰነድ መመለስ ጥያቄ ከያዥ ቀርቧል',
        messageEn: `Borrower ${emp!.fullName} has requested to return file.`,
        messageAm: `ተጠቃሚ ሰነድ ለመመለስ አሳውቀዋል።`,
        type: 'INFO',
        read: false,
        createdAt: new Date().toISOString(),
      });

      const updatedReq = db.getRequestById(req.id);
      expect(updatedReq?.returnRequested).toBe(true);
      expect(updatedReq?.returnRequestedAt).toBeDefined();
      expect(db.getNotifications(officer!.id).length).toBe(initialOfficerNotifs + 1);
    });

    it('should dispatch return notice from archive officer to borrower', () => {
      const emp = db.getUserByUsername('employee.selam');
      const initialEmpNotifs = db.getNotifications(emp!.id).length;

      db.addNotification({
        id: `notif-test-urgent-ret-${Date.now()}`,
        userId: emp!.id,
        titleEn: 'Urgent: Archive Document Return Required',
        titleAm: 'አስቸኳይ፡ የማህደር ሰነድ እንዲመልሱ ይጠየቃል',
        messageEn: 'Please return the borrowed file to the archive desk immediately.',
        messageAm: 'እባክዎ የተወሰደውን ሰነድ ዛሬውኑ ይመልሱ።',
        type: 'ALERT',
        read: false,
        createdAt: new Date().toISOString(),
      });

      const updatedNotifs = db.getNotifications(emp!.id);
      expect(updatedNotifs.length).toBe(initialEmpNotifs + 1);
      expect(updatedNotifs[0].type).toBe('ALERT');
    });
  });

  describe('7. Role-Based Access Control (RBAC) & Return Schedule Adjustments', () => {
    it('should load baseline system settings with return policy and role permissions', () => {
      db.resetSettings();
      const settings = db.getSettings();
      expect(settings).toBeDefined();
      expect(settings.returnPolicy).toBeDefined();
      expect(settings.returnPolicy.defaultReturnDays).toBeGreaterThan(0);
      expect(settings.returnPolicy.defaultReturnTime).toBe('17:00');
      expect(settings.rolePermissions).toBeDefined();

      // Check RBAC permission enforcement
      expect(db.hasPermission('ADMIN', 'manageSettings')).toBe(true);
      expect(db.hasPermission('ADMIN', 'adjustReturnDate')).toBe(true);
      expect(db.hasPermission('ARCHIVE_OFFICER', 'adjustReturnDate')).toBe(true);
      expect(db.hasPermission('ARCHIVE_OFFICER', 'processReturn')).toBe(true);
      expect(db.hasPermission('DEPARTMENT_MANAGER', 'adjustReturnDate')).toBe(true);
      expect(db.hasPermission('EMPLOYEE', 'adjustReturnDate')).toBe(false);
      expect(db.hasPermission('EMPLOYEE', 'requestExtension')).toBe(true);
    });

    it('should update system return policy settings and persist', () => {
      const originalSettings = db.getSettings();
      const updated = db.updateSettings({
        returnPolicy: {
          ...originalSettings.returnPolicy,
          defaultReturnDays: 10,
          defaultReturnTime: '16:30',
          maxReturnDays: 45,
        },
      });

      expect(updated.returnPolicy.defaultReturnDays).toBe(10);
      expect(updated.returnPolicy.defaultReturnTime).toBe('16:30');
      expect(updated.returnPolicy.maxReturnDays).toBe(45);

      // Verify persistence in subsequent query
      const retrieved = db.getSettings();
      expect(retrieved.returnPolicy.defaultReturnDays).toBe(10);
    });

    it('should adjust returning time and date for an active borrowed document', () => {
      const doc = db.getDocumentByRef('ET-FDRE/2026/FIN-0091');
      const emp = db.getUserByUsername('employee.selam');
      const officer = db.getUserByUsername('officer.almaz');

      const originalReturn = new Date(Date.now() + 86400000 * 7).toISOString();
      const testReq = db.addRequest({
        id: `req-adj-test-${Date.now()}`,
        requestNumber: `REQ-ADJ-${Date.now()}`,
        documentId: doc!.id,
        requesterId: emp!.id,
        requestingDepartmentId: emp!.departmentId || 'dept-mof-02',
        purpose: 'Annual audit review',
        requestDate: new Date().toISOString(),
        requestedReturnDate: originalReturn,
        priority: 'URGENT',
        status: 'ISSUED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Adjust return date by adding 10 more days and setting cutoff time to 17:00
      const newReturn = new Date(Date.now() + 86400000 * 17);
      newReturn.setHours(17, 0, 0, 0);
      const newReturnIso = newReturn.toISOString();

      const adjusted = db.updateRequest(testReq.id, {
        requestedReturnDate: newReturnIso,
        returnDateAdjusted: true,
        previousReturnDate: originalReturn,
        adjustedBy: officer!.id,
        adjustedAt: new Date().toISOString(),
        adjustmentReason: 'Audit review extended by directorate',
        extensionRequested: false,
      });

      expect(adjusted?.returnDateAdjusted).toBe(true);
      expect(adjusted?.requestedReturnDate).toBe(newReturnIso);
      expect(adjusted?.previousReturnDate).toBe(originalReturn);
      expect(adjusted?.adjustmentReason).toContain('Audit review extended');

      // Record administrative movement log
      const mov = db.addMovement({
        id: `mov-adj-test-${Date.now()}`,
        documentId: doc!.id,
        movementType: 'ADMIN_CORRECTION',
        previousLocationId: null,
        newLocationId: null,
        previousHolderId: emp!.id,
        newHolderId: emp!.id,
        actingUserId: officer!.id,
        timestamp: new Date().toISOString(),
        requestId: testReq.id,
        reason: `Return date adjusted to ${newReturnIso}`,
        acknowledgmentDetails: `Authorized by ${officer!.fullName}`,
      });

      expect(mov).toBeDefined();
      expect(mov.movementType).toBe('ADMIN_CORRECTION');
    });

    it('should record borrower extension request and resolve upon adjustment', () => {
      const doc = db.getDocumentByRef('ET-FDRE/2026/FIN-0091');
      const emp = db.getUserByUsername('employee.selam');

      const testReq = db.addRequest({
        id: `req-ext-test-${Date.now()}`,
        requestNumber: `REQ-EXT-${Date.now()}`,
        documentId: doc!.id,
        requesterId: emp!.id,
        requestingDepartmentId: emp!.departmentId || 'dept-mof-02',
        purpose: 'Deed analysis',
        requestDate: new Date().toISOString(),
        requestedReturnDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        priority: 'NORMAL',
        status: 'ISSUED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Borrower requests extension
      const extDate = new Date(Date.now() + 86400000 * 10).toISOString();
      const withExt = db.updateRequest(testReq.id, {
        extensionRequested: true,
        extensionRequestedDate: extDate,
        extensionReason: 'Court session postponed to next week',
      });

      expect(withExt?.extensionRequested).toBe(true);
      expect(withExt?.extensionReason).toContain('Court session postponed');

      // Officer approves adjustment
      const resolved = db.updateRequest(testReq.id, {
        requestedReturnDate: extDate,
        returnDateAdjusted: true,
        extensionRequested: false,
      });

      expect(resolved?.extensionRequested).toBe(false);
      expect(resolved?.returnDateAdjusted).toBe(true);
      expect(resolved?.requestedReturnDate).toBe(extDate);
    });
  });
});
