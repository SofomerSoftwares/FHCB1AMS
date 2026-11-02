import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db } from './db/store';
import { AuthenticatedRequest, authMiddleware, requireRole, requirePermission, generateToken, logAudit } from './auth';
import {
  IDocument,
  IDocumentRequest,
  IFileMovement,
  IArchiveLocation,
  IMissingFileInvestigation,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
} from '../types';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & PROFILE
// ==========================================

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

apiRouter.get('/health', (_req, res) => {
  return res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);

    const user = db.getUserByUsername(username) || db.getUserByEmail(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
    }

    if (!user.passwordHash) {
      return res.status(500).json({ error: 'Account credentials configuration error.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Update last login
    db.updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    const token = generateToken(user);

    // Set secure cookie
    res.cookie('archivetrack_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    logAudit(user, 'USER_LOGIN', 'USER', user.id, `User ${user.username} logged in successfully`, req);

    // Don't send password hash back
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const firstIssue = err.issues?.[0] || (err as any).errors?.[0];
      return res.status(400).json({ error: firstIssue?.message || 'Invalid input.' });
    }
    return res.status(500).json({ error: 'Internal login error.' });
  }
});

apiRouter.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { passwordHash: _, ...safeUser } = req.user!;
  const department = safeUser.departmentId ? db.getDepartmentById(safeUser.departmentId) : null;
  return res.json({ user: safeUser, department });
});

apiRouter.post('/auth/switch-role', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  const validRoles = ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid target role.' });
  }

  // Generate simulated session token for this user with target role
  const simulatedUser = {
    ...req.user!,
    role: role as any,
  };
  const token = generateToken(simulatedUser);
  logAudit(
    req.user!,
    'ROLE_SWITCH_SIMULATED',
    'USER',
    req.user!.id,
    `Switched role clearance to ${role} (Testing & RBAC Demonstration Mode)`,
    req
  );

  const { passwordHash: _, ...safeUser } = simulatedUser;
  return res.json({
    token,
    user: safeUser,
    message: `Active clearance switched to ${role}`,
  });
});

apiRouter.post('/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('archivetrack_token');
  logAudit(req.user!, 'USER_LOGOUT', 'USER', req.user!.id, `User ${req.user!.username} logged out`, req);
  return res.json({ success: true, message: 'Logged out successfully.' });
});

apiRouter.put('/auth/password', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = db.getUserById(req.user!.id);
    if (!user || !user.passwordHash) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    db.updateUser(user.id, { passwordHash: newHash });

    logAudit(req.user!, 'PASSWORD_CHANGE', 'USER', user.id, 'User changed their password', req);
    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// ==========================================
// 2. USERS MANAGEMENT (Admin Only)
// ==========================================

apiRouter.get('/users', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  // Admins & Auditors can see full user list; others can see active members for request assignment
  const users = db.getUsers().map(({ passwordHash: _, ...u }) => {
    const dept = u.departmentId ? db.getDepartmentById(u.departmentId) : undefined;
    return { ...u, department: dept };
  });

  return res.json({ users });
});

apiRouter.post('/users', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, fullName, amharicName, role, departmentId, phone, employeeId, password } = req.body;

    if (!username || !email || !fullName || !role || !password) {
      return res.status(400).json({ error: 'Missing required user fields.' });
    }

    if (db.getUserByUsername(username)) {
      return res.status(409).json({ error: 'Username already in use.' });
    }

    if (db.getUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = db.addUser({
      id: `usr-${Date.now()}`,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      amharicName: amharicName?.trim(),
      role,
      departmentId,
      active: true,
      passwordHash,
      phone,
      employeeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    logAudit(req.user!, 'USER_CREATED', 'USER', newUser.id, `Created user ${newUser.username} (${newUser.role})`, req);

    const { passwordHash: _, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create user.' });
  }
});

apiRouter.put('/users/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, amharicName, role, departmentId, active, phone, employeeId, password } = req.body;

    const updates: any = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (amharicName !== undefined) updates.amharicName = amharicName;
    if (role !== undefined) updates.role = role;
    if (departmentId !== undefined) updates.departmentId = departmentId;
    if (active !== undefined) updates.active = active;
    if (phone !== undefined) updates.phone = phone;
    if (employeeId !== undefined) updates.employeeId = employeeId;

    if (password && password.length >= 8) {
      const salt = await bcrypt.genSalt(10);
      updates.passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = db.updateUser(id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }

    logAudit(req.user!, 'USER_UPDATED', 'USER', id, `Updated account ${updated.username}`, req);

    const { passwordHash: _, ...safeUser } = updated;
    return res.json({ user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update user.' });
  }
});

apiRouter.delete('/users/:id', authMiddleware, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (req.user?.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    }

    const existingUser = db.getUserById(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if user currently holds borrowed physical documents
    const heldDocuments = db.getDocuments().filter((d) => d.currentHolderId === id);
    if (heldDocuments.length > 0) {
      return res.status(409).json({
        error: `Cannot delete user: They currently hold ${heldDocuments.length} physical document(s) in custody. Return or reassign files first.`,
      });
    }

    const deleted = db.deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ error: 'User could not be removed.' });
    }

    logAudit(
      req.user!,
      'USER_DELETED',
      'USER',
      id,
      `Permanently removed user account @${existingUser.username} (${existingUser.fullName})`,
      req
    );

    return res.json({ success: true, message: 'User account removed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete user.' });
  }
});

// ==========================================
// 3. DEPARTMENTS
// ==========================================

apiRouter.get('/departments', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const departments = db.getDepartments().map((dept) => {
    const manager = dept.managerId ? db.getUserById(dept.managerId) : undefined;
    return {
      ...dept,
      manager: manager ? { id: manager.id, fullName: manager.fullName, email: manager.email } : null,
    };
  });
  return res.json({ departments });
});

apiRouter.post('/departments', authMiddleware, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, nameEn, nameAm, managerId, description } = req.body;
    if (!code || !nameEn || !nameAm) {
      return res.status(400).json({ error: 'Department code, English name, and Amharic name are required.' });
    }

    const existing = db.getDepartments().find((d) => d.code.toUpperCase() === code.trim().toUpperCase());
    if (existing) {
      return res.status(409).json({ error: 'Department code already exists.' });
    }

    const newDept = db.addDepartment({
      id: `dept-${Date.now()}`,
      code: code.trim().toUpperCase(),
      nameEn: nameEn.trim(),
      nameAm: nameAm.trim(),
      managerId: managerId || undefined,
      active: true,
      description: description?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    logAudit(req.user!, 'DEPARTMENT_CREATED', 'DEPARTMENT', newDept.id, `Created department ${newDept.code} - ${newDept.nameEn}`, req);
    return res.status(201).json({ department: newDept });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create department.' });
  }
});

apiRouter.put('/departments/:id', authMiddleware, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { code, nameEn, nameAm, managerId, active, description } = req.body;

  // Check code uniqueness if code is updated
  if (code) {
    const existingCode = db.getDepartments().find(
      (d) => d.id !== id && d.code.toUpperCase() === code.trim().toUpperCase()
    );
    if (existingCode) {
      return res.status(409).json({ error: 'Department code already exists in another department.' });
    }
  }

  const updated = db.updateDepartment(id, {
    ...(code !== undefined && { code: code.trim().toUpperCase() }),
    ...(nameEn !== undefined && { nameEn: nameEn.trim() }),
    ...(nameAm !== undefined && { nameAm: nameAm.trim() }),
    ...(managerId !== undefined && { managerId: managerId || undefined }),
    ...(active !== undefined && { active }),
    ...(description !== undefined && { description }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Department not found.' });
  }

  logAudit(req.user!, 'DEPARTMENT_UPDATED', 'DEPARTMENT', id, `Updated department ${updated.code} (${updated.nameEn})`, req);
  return res.json({ department: updated });
});

apiRouter.delete('/departments/:id', authMiddleware, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingDept = db.getDepartmentById(id);
    if (!existingDept) {
      return res.status(404).json({ error: 'Department not found.' });
    }

    // Check if any documents belong to this department
    const relatedDocs = db.getDocuments().filter((d) => d.departmentId === id);
    if (relatedDocs.length > 0) {
      return res.status(409).json({
        error: `Cannot delete department "${existingDept.code}": ${relatedDocs.length} physical archive document(s) belong to it. Reassign files first.`,
      });
    }

    // Check if any users belong to this department
    const relatedUsers = db.getUsers().filter((u) => u.departmentId === id);
    if (relatedUsers.length > 0) {
      return res.status(409).json({
        error: `Cannot delete department "${existingDept.code}": ${relatedUsers.length} user account(s) are assigned to it. Reassign staff first.`,
      });
    }

    const deleted = db.deleteDepartment(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Department could not be removed.' });
    }

    logAudit(
      req.user!,
      'DEPARTMENT_DELETED',
      'DEPARTMENT',
      id,
      `Permanently removed department ${existingDept.code} (${existingDept.nameEn})`,
      req
    );

    return res.json({ success: true, message: 'Department removed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete department.' });
  }
});

// ==========================================
// 4. ARCHIVE LOCATIONS (Hierarchy)
// ==========================================

apiRouter.get('/locations', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const locations = db.getLocations().map((loc) => {
    const fullPath = db.getLocationPath(loc.id);
    const documentsCount = db.getDocuments().filter((d) => d.currentLocationId === loc.id).length;
    return {
      ...loc,
      fullPath,
      documentsCount,
    };
  });
  return res.json({ locations });
});

apiRouter.post('/locations', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, type, departmentId, description, shelfNumber, boxNumber } = req.body;

    if (!code || !type) {
      return res.status(400).json({ error: 'Code and Type are required.' });
    }

    if (db.getLocationByCode(code)) {
      return res.status(409).json({ error: `Location code '${code}' already exists.` });
    }

    // Resolve shelfNumber and boxNumber
    let resolvedShelfNumber = shelfNumber && typeof shelfNumber === 'string' && shelfNumber.trim() !== '' ? shelfNumber.trim() : null;
    let resolvedBoxNumber = boxNumber && typeof boxNumber === 'string' && boxNumber.trim() !== '' ? boxNumber.trim() : null;

    if (type === 'SHELF' && !resolvedShelfNumber) {
      const match = code.match(/(\d+)/);
      resolvedShelfNumber = match ? match[1].padStart(2, '0') : code.replace(/[^A-Za-z0-9]/g, '');
    } else if (type === 'BOX') {
      if (!resolvedBoxNumber) {
        const match = code.match(/(\d+)/);
        resolvedBoxNumber = match ? match[1].padStart(3, '0') : code.replace(/[^A-Za-z0-9]/g, '');
      }
    }

    const newLoc: IArchiveLocation = {
      id: `loc-${Date.now()}`,
      code: code.trim().toUpperCase(),
      type,
      departmentId: departmentId || null,
      shelfNumber: resolvedShelfNumber,
      boxNumber: resolvedBoxNumber,
      active: true,
      description: description?.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addLocation(newLoc);
    newLoc.fullPath = db.getLocationPath(newLoc.id);

    logAudit(req.user!, 'LOCATION_CREATED', 'LOCATION', newLoc.id, `Created archive location ${newLoc.code} (${newLoc.type})`, req);
    return res.status(201).json({ location: newLoc });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create archive location.' });
  }
});

apiRouter.put('/locations/:id', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { active, description, shelfNumber, boxNumber } = req.body;

  // Check if deactivating while documents exist
  if (active === false) {
    const docsInLoc = db.getDocuments().filter((d) => d.currentLocationId === id);
    if (docsInLoc.length > 0) {
      return res.status(400).json({
        error: `Cannot deactivate location: it currently contains ${docsInLoc.length} physical document(s). Please relocate documents first.`,
      });
    }
  }

  const updated = db.updateLocation(id, {
    ...(shelfNumber !== undefined && { shelfNumber }),
    ...(boxNumber !== undefined && { boxNumber }),
    ...(active !== undefined && { active }),
    ...(description !== undefined && { description }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Location not found.' });
  }

  logAudit(req.user!, 'LOCATION_UPDATED', 'LOCATION', id, `Updated location ${updated.code}`, req);
  return res.json({ location: updated });
});

// ==========================================
// 5. PHYSICAL DOCUMENT REGISTRY & SEARCH
// ==========================================

apiRouter.get('/documents', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const {
    search,
    category,
    status,
    departmentId,
    confidentiality,
    oldWoreda,
    oldKebele,
    houseNumber,
    shelfNumber,
    boxNumber,
    currentHolderId,
    page,
    limit,
  } = req.query;
  const user = req.user!;

  const { documents, total } = db.queryDocuments(
    {
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      status: typeof status === 'string' ? status : undefined,
      departmentId: typeof departmentId === 'string' ? departmentId : undefined,
      confidentiality: typeof confidentiality === 'string' ? confidentiality : undefined,
      oldWoreda: typeof oldWoreda === 'string' ? oldWoreda : undefined,
      oldKebele: typeof oldKebele === 'string' ? oldKebele : undefined,
      houseNumber: typeof houseNumber === 'string' ? houseNumber : undefined,
      shelfNumber: typeof shelfNumber === 'string' ? shelfNumber : undefined,
      boxNumber: typeof boxNumber === 'string' ? boxNumber : undefined,
      currentHolderId: typeof currentHolderId === 'string' ? currentHolderId : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    },
    user.role,
    user.departmentId
  );

  // Populate references
  const enrichedDocs = documents.map((doc) => {
    const dept = db.getDepartmentById(doc.departmentId);
    const loc = db.getLocationById(doc.currentLocationId);
    const holder = doc.currentHolderId ? db.getUserById(doc.currentHolderId) : null;
    const locationPath = db.getLocationPath(doc.currentLocationId);

    return {
      ...doc,
      department: dept ? { id: dept.id, code: dept.code, nameEn: dept.nameEn, nameAm: dept.nameAm } : null,
      location: loc
        ? {
            id: loc.id,
            code: loc.code,
            nameEn: loc.nameEn,
            nameAm: loc.nameAm,
            fullPath: locationPath,
            shelfNumber: loc.shelfNumber,
            boxNumber: loc.boxNumber,
          }
        : null,
      holder: holder ? { id: holder.id, fullName: holder.fullName, email: holder.email } : null,
    };
  });

  return res.json({ documents: enrichedDocs, total });
});

apiRouter.get('/documents/generate-ref', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, departmentId, year, prefixType, customPrefix } = req.query;
    const generated = db.generateReferenceNumber({
      category: typeof category === 'string' ? category : undefined,
      departmentId: typeof departmentId === 'string' ? departmentId : undefined,
      year: year ? parseInt(year as string, 10) : undefined,
      prefixType: (prefixType as any) || (category ? 'CATEGORY' : undefined),
      customPrefix: typeof customPrefix === 'string' ? customPrefix : undefined,
    });
    return res.json(generated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate reference number.' });
  }
});

apiRouter.get('/documents/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const doc = db.getDocumentById(id) || db.getDocumentByRef(id) || db.getDocumentByQR(id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found in archival registry.' });
  }

  const dept = db.getDepartmentById(doc.departmentId);
  const loc = db.getLocationById(doc.currentLocationId);
  const holder = doc.currentHolderId ? db.getUserById(doc.currentHolderId) : null;
  const officer = db.getUserById(doc.registrationOfficerId);
  const locationPath = db.getLocationPath(doc.currentLocationId);
  const movements = db.getMovements(doc.id).map((m) => {
    const actor = db.getUserById(m.actingUserId);
    const prevLoc = m.previousLocationId ? db.getLocationById(m.previousLocationId) : null;
    const newLoc = m.newLocationId ? db.getLocationById(m.newLocationId) : null;
    const prevH = m.previousHolderId ? db.getUserById(m.previousHolderId) : null;
    const newH = m.newHolderId ? db.getUserById(m.newHolderId) : null;

    return {
      ...m,
      actorName: actor?.fullName || 'System',
      previousLocationPath: prevLoc ? db.getLocationPath(prevLoc.id) : null,
      newLocationPath: newLoc ? db.getLocationPath(newLoc.id) : null,
      previousHolderName: prevH?.fullName || null,
      newHolderName: newH?.fullName || null,
    };
  });

  return res.json({
    document: {
      ...doc,
      department: dept,
      location: loc ? { ...loc, fullPath: locationPath } : null,
      holder: holder ? { id: holder.id, fullName: holder.fullName, email: holder.email } : null,
      registrationOfficer: officer ? { id: officer.id, fullName: officer.fullName } : null,
    },
    movements,
  });
});

apiRouter.post('/documents', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      referenceNumber,
      titleEn,
      titleAm,
      description,
      category,
      departmentId,
      documentDate,
      confidentiality,
      retentionDate,
      currentLocationId,
      oldWoreda,
      oldKebele,
      houseNumber,
      shelfNumber,
      boxNumber,
      pageCount,
      conditionNotes,
      tags,
    } = req.body;

    // Validate category against strict DOCUMENT_CATEGORIES (COMMERCIAL, RESIDENT)
    const upperCategory = (category || '').toUpperCase().trim();
    if (!DOCUMENT_CATEGORIES.includes(upperCategory as any)) {
      return res.status(400).json({
        error: `Invalid document category '${category}'. Allowed categories are 'COMMERCIAL' (Commercial) and 'RESIDENT' (Resident).`,
      });
    }

    // Validate required fields (department, location, documentDate)
    if (!departmentId || !currentLocationId || !documentDate) {
      return res.status(400).json({ error: 'Required document fields are missing (department, location, documentDate).' });
    }

    // Auto-generate reference number if missing, empty, or set to AUTO
    let finalRef = typeof referenceNumber === 'string' ? referenceNumber.trim().toUpperCase() : '';
    if (!finalRef || finalRef === 'AUTO') {
      const generated = db.generateReferenceNumber({
        category: upperCategory,
        departmentId,
      });
      finalRef = generated.referenceNumber;
    }

    // Smart default for titles if omitted in physical file registration
    const defaultEn = titleEn?.trim() || `${upperCategory === 'COMMERCIAL' ? 'Commercial' : 'Resident'} Physical File [${finalRef}]`;
    const defaultAm = titleAm?.trim() || `${upperCategory === 'COMMERCIAL' ? 'የንግድ' : 'የነዋሪ'} ማህደር ሰነድ [${finalRef}]`;

    // Check duplicate reference number
    if (db.getDocumentByRef(finalRef)) {
      return res.status(409).json({ error: `Document reference number '${finalRef}' already exists.` });
    }

    // Check location existence
    const location = db.getLocationById(currentLocationId);
    if (!location || !location.active) {
      return res.status(400).json({ error: 'Invalid or inactive archival storage location.' });
    }

    // Determine normalized shelf and box numbers (preserve strings with leading zeros e.g. "05", "012")
    const resolvedShelfNumber = shelfNumber && typeof shelfNumber === 'string' && shelfNumber.trim() !== ''
      ? shelfNumber.trim()
      : (location.shelfNumber || null);

    const resolvedBoxNumber = boxNumber && typeof boxNumber === 'string' && boxNumber.trim() !== ''
      ? boxNumber.trim()
      : (location.boxNumber || null);

    // Validate shelf and box compatibility if location is a shelf or box
    if (location.type === 'SHELF' && location.shelfNumber && resolvedShelfNumber && resolvedShelfNumber !== location.shelfNumber) {
      return res.status(400).json({
        error: `Selected shelf number '${resolvedShelfNumber}' does not match the chosen archive shelf location '${location.shelfNumber}'.`,
      });
    }

    // Generate unique QR identifier
    const qrIdentifier = `QR-${finalRef.replace(/[^A-Za-z0-9]/g, '-')}-${Date.now().toString(36).toUpperCase()}`;

    const newDoc: IDocument = {
      id: `doc-${Date.now()}`,
      referenceNumber: finalRef,
      titleEn: defaultEn,
      titleAm: defaultAm,
      description: description?.trim() || '',
      category: upperCategory as DocumentCategory,
      departmentId,
      documentDate,
      registrationDate: new Date().toISOString(),
      confidentiality: confidentiality || 'INTERNAL',
      retentionDate: retentionDate || undefined,
      currentLocationId,
      currentHolderId: null,
      oldWoreda: oldWoreda && typeof oldWoreda === 'string' && oldWoreda.trim() !== '' ? oldWoreda.trim() : null,
      oldKebele: oldKebele && typeof oldKebele === 'string' && oldKebele.trim() !== '' ? oldKebele.trim() : null,
      houseNumber: houseNumber && typeof houseNumber === 'string' && houseNumber.trim() !== '' ? houseNumber.trim() : null,
      shelfNumber: resolvedShelfNumber,
      boxNumber: resolvedBoxNumber,
      status: 'AVAILABLE',
      qrIdentifier,
      registrationOfficerId: req.user!.id,
      pageCount: pageCount ? Number(pageCount) : undefined,
      conditionNotes: conditionNotes?.trim(),
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addDocument(newDoc);

    // Record Initial Placement in append-only File Movement history with shelf & box coordinates
    db.addMovement({
      id: `mov-${Date.now()}`,
      documentId: newDoc.id,
      movementType: 'REGISTRATION',
      previousLocationId: null,
      newLocationId: currentLocationId,
      previousShelfNumber: null,
      newShelfNumber: resolvedShelfNumber,
      previousBoxNumber: null,
      newBoxNumber: resolvedBoxNumber,
      previousHolderId: null,
      newHolderId: null,
      actingUserId: req.user!.id,
      timestamp: new Date().toISOString(),
      reason: `Initial registration into Shelf ${resolvedShelfNumber || 'N/A'}, Box ${resolvedBoxNumber || 'N/A'}.`,
      acknowledgmentDetails: `Placed in ${db.getLocationPath(currentLocationId)} by ${req.user!.fullName}`,
    });

    logAudit(
      req.user!,
      'DOCUMENT_REGISTERED',
      'DOCUMENT',
      newDoc.id,
      `Registered physical file ${newDoc.referenceNumber}: ${newDoc.titleEn} (${newDoc.category}) at Shelf ${resolvedShelfNumber || '-'} Box ${resolvedBoxNumber || '-'}`,
      req
    );

    return res.status(201).json({ document: newDoc });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to register document.' });
  }
});

// CSV parser helper that supports quotes, commas, and line breaks
function parseCsvText(csvText: string): Array<Record<string, string>> {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
      if (char === '\r') i++;
    } else if (char === '\r' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let col = '';
    let inside = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const nc = line[i + 1];
      if (c === '"') {
        if (inside && nc === '"') {
          col += '"';
          i++;
        } else {
          inside = !inside;
        }
      } else if (c === ',' && !inside) {
        cols.push(col.trim());
        col = '';
      } else {
        col += c;
      }
    }
    cols.push(col.trim());
    return cols;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      rowObj[h] = val.trim();
    });
    rows.push(rowObj);
  }

  return rows;
}

// Download standardized CSV Template for bulk registration
apiRouter.get('/documents/csv-template', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const templateCsv = `referenceNumber,category,titleEn,titleAm,departmentCode,locationCode,shelfNumber,boxNumber,oldWoreda,oldKebele,houseNumber,confidentiality,documentDate,description,pageCount,conditionNotes,tags
AUTO,COMMERCIAL,Commercial Business Registry Certificate,የንግድ ድርጅት ምዝገባ ምስክር ወረቀት,FIN,BOX-12,02,012,03,12,045,CONFIDENTIAL,2024-05-10,Commercial tax and charter registration file,45,Archived in secure folder,"Commercial,Business,Audit"
AUTO,RESIDENT,Historical Kebele Landholding Title Deed,የቀበሌ ነዋሪነት እና የመሬት ይዞታ ማረጋገጫ,DOC-ARCH,BOX-015,05,015,04,08,102A,INTERNAL,2023-11-20,Original resident residential deed and title agreement,28,Preserved parchment with official seal,"Resident,Kebele,Land"`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="FHC_Branch_One_Registration_Template.csv"');
  return res.send(templateCsv);
});

// Bulk/Batch Import physical documents via CSV
apiRouter.post('/documents/import-csv', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { csvText, rows: inputRows, dryRun } = req.body;

    let rawRows: Array<Record<string, any>> = [];
    if (typeof csvText === 'string' && csvText.trim()) {
      rawRows = parseCsvText(csvText);
    } else if (Array.isArray(inputRows)) {
      rawRows = inputRows;
    } else {
      return res.status(400).json({ error: 'Please provide either raw CSV text or an array of parsed rows.' });
    }

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in CSV import payload.' });
    }

    const departments = db.getDepartments();
    const locations = db.getLocations();
    const defaultDept = departments.find((d) => d.active) || departments[0];
    const defaultLoc = locations.find((l) => l.active && l.type === 'BOX') || locations.find((l) => l.active) || locations[0];

    const getVal = (row: Record<string, any>, ...keys: string[]): string => {
      const lowerMap: Record<string, any> = {};
      Object.keys(row).forEach((k) => {
        lowerMap[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
      });
      for (const k of keys) {
        const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lowerMap[norm] !== undefined && lowerMap[norm] !== null && String(lowerMap[norm]).trim() !== '') {
          return String(lowerMap[norm]).trim();
        }
      }
      return '';
    };

    const validatedItems: Array<{
      index: number;
      valid: boolean;
      error?: string;
      doc?: IDocument;
      preview: {
        referenceNumber: string;
        category: string;
        titleEn: string;
        titleAm: string;
        departmentCode: string;
        locationCode: string;
        shelfNumber: string;
        boxNumber: string;
        oldWoreda: string;
        oldKebele: string;
        houseNumber: string;
        isAutoRef: boolean;
      };
    }> = [];

    const existingRefsInBatch = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowIndex = i + 1;

      // Extract and normalize category
      const rawCat = getVal(row, 'category', 'documentCategory', 'type');
      let normalizedCat: DocumentCategory | null = null;
      const upperCat = rawCat.toUpperCase().trim();
      if (['COMMERCIAL', 'COMMERCE', 'COM', 'ንግድ'].includes(upperCat)) {
        normalizedCat = 'COMMERCIAL';
      } else if (['RESIDENT', 'RESIDENTIAL', 'RES', 'ነዋሪ'].includes(upperCat)) {
        normalizedCat = 'RESIDENT';
      }

      const titleEn = getVal(row, 'titleEn', 'title', 'title_en');
      const titleAm = getVal(row, 'titleAm', 'amharicTitle', 'title_am') || titleEn;
      const description = getVal(row, 'description', 'desc');
      const deptVal = getVal(row, 'departmentCode', 'departmentId', 'department', 'dept');
      const locVal = getVal(row, 'locationCode', 'locationId', 'location', 'loc');
      const shelfNum = getVal(row, 'shelfNumber', 'shelf', 'shelf_number');
      const boxNum = getVal(row, 'boxNumber', 'box', 'box_number');
      const oldWoreda = getVal(row, 'oldWoreda', 'woreda', 'old_woreda');
      const oldKebele = getVal(row, 'oldKebele', 'kebele', 'old_kebele');
      const houseNumber = getVal(row, 'houseNumber', 'houseNo', 'house_number');
      const confidentiality = getVal(row, 'confidentiality', 'security') || 'INTERNAL';
      const docDate = getVal(row, 'documentDate', 'date') || new Date().toISOString().substring(0, 10);
      const pageCount = parseInt(getVal(row, 'pageCount', 'pages') || '15', 10);
      const conditionNotes = getVal(row, 'conditionNotes', 'condition');
      const tagsStr = getVal(row, 'tags');
      const tags = tagsStr ? tagsStr.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];

      let rawRef = getVal(row, 'referenceNumber', 'refNumber', 'ref').toUpperCase();
      const isAutoRef = !rawRef || rawRef === 'AUTO';

      // Validation Checks
      if (!normalizedCat) {
        validatedItems.push({
          index: rowIndex,
          valid: false,
          error: `Invalid category '${rawCat || 'empty'}'. Must be COMMERCIAL or RESIDENT.`,
          preview: {
            referenceNumber: rawRef || 'AUTO',
            category: rawCat || 'UNKNOWN',
            titleEn,
            titleAm,
            departmentCode: deptVal,
            locationCode: locVal,
            shelfNumber: shelfNum,
            boxNumber: boxNum,
            oldWoreda,
            oldKebele,
            houseNumber,
            isAutoRef,
          },
        });
        continue;
      }

      if (!titleEn) {
        validatedItems.push({
          index: rowIndex,
          valid: false,
          error: 'Document English Title (titleEn) is required.',
          preview: {
            referenceNumber: rawRef || 'AUTO',
            category: normalizedCat,
            titleEn: '',
            titleAm,
            departmentCode: deptVal,
            locationCode: locVal,
            shelfNumber: shelfNum,
            boxNumber: boxNum,
            oldWoreda,
            oldKebele,
            houseNumber,
            isAutoRef,
          },
        });
        continue;
      }

      // Department resolution
      let resolvedDept = departments.find(
        (d) => d.code.toUpperCase() === deptVal.toUpperCase() || d.id === deptVal
      );
      if (!resolvedDept) {
        resolvedDept = defaultDept;
      }

      // Location resolution
      let resolvedLoc = locations.find(
        (l) => l.code.toUpperCase() === locVal.toUpperCase() || l.id === locVal
      );
      if (!resolvedLoc) {
        // If boxNumber or shelfNumber provided, try matching by boxNumber or shelfNumber
        if (boxNum) {
          resolvedLoc = locations.find((l) => l.boxNumber === boxNum);
        } else if (shelfNum) {
          resolvedLoc = locations.find((l) => l.shelfNumber === shelfNum);
        }
        if (!resolvedLoc) {
          resolvedLoc = defaultLoc;
        }
      }

      // Preserve strings with leading zeroes (e.g. "05", "012")
      const resolvedShelf = shelfNum || resolvedLoc.shelfNumber || null;
      const resolvedBox = boxNum || resolvedLoc.boxNumber || null;

      // Reference number handling
      let finalRef = rawRef;
      if (isAutoRef) {
        const gen = db.generateReferenceNumber({
          category: normalizedCat,
          departmentId: resolvedDept.id,
        });
        let seq = gen.sequence;
        finalRef = gen.referenceNumber;
        while (db.getDocumentByRef(finalRef) || existingRefsInBatch.has(finalRef)) {
          seq++;
          finalRef = `FHC-B1/${gen.year}/${gen.prefix}-${String(seq).padStart(4, '0')}`;
        }
      } else {
        // Explicit reference number duplicate check
        if (db.getDocumentByRef(finalRef) || existingRefsInBatch.has(finalRef)) {
          validatedItems.push({
            index: rowIndex,
            valid: false,
            error: `Reference number '${finalRef}' already exists in registry.`,
            preview: {
              referenceNumber: finalRef,
              category: normalizedCat,
              titleEn,
              titleAm,
              departmentCode: resolvedDept.code,
              locationCode: resolvedLoc.code,
              shelfNumber: resolvedShelf || '',
              boxNumber: resolvedBox || '',
              oldWoreda,
              oldKebele,
              houseNumber,
              isAutoRef,
            },
          });
          continue;
        }
      }

      existingRefsInBatch.add(finalRef);

      const qrIdentifier = `QR-${finalRef.replace(/[^A-Za-z0-9]/g, '-')}-${Date.now().toString(36).toUpperCase()}-${i}`;

      const newDoc: IDocument = {
        id: `doc-csv-${Date.now()}-${i}`,
        referenceNumber: finalRef,
        titleEn,
        titleAm,
        description,
        category: normalizedCat,
        departmentId: resolvedDept.id,
        documentDate: docDate,
        registrationDate: new Date().toISOString(),
        confidentiality: confidentiality as any,
        currentLocationId: resolvedLoc.id,
        currentHolderId: null,
        oldWoreda: oldWoreda || null,
        oldKebele: oldKebele || null,
        houseNumber: houseNumber || null,
        shelfNumber: resolvedShelf,
        boxNumber: resolvedBox,
        status: 'AVAILABLE',
        qrIdentifier,
        registrationOfficerId: req.user!.id,
        pageCount: isNaN(pageCount) ? 15 : pageCount,
        conditionNotes: conditionNotes || 'CSV batch imported archival record.',
        tags: tags.length > 0 ? tags : [normalizedCat === 'COMMERCIAL' ? 'Commercial' : 'Resident', 'BatchImport'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      validatedItems.push({
        index: rowIndex,
        valid: true,
        doc: newDoc,
        preview: {
          referenceNumber: finalRef,
          category: normalizedCat,
          titleEn,
          titleAm,
          departmentCode: resolvedDept.code,
          locationCode: resolvedLoc.code,
          shelfNumber: resolvedShelf || '',
          boxNumber: resolvedBox || '',
          oldWoreda,
          oldKebele,
          houseNumber,
          isAutoRef,
        },
      });
    }

    const validCount = validatedItems.filter((v) => v.valid).length;
    const invalidCount = validatedItems.length - validCount;

    // If dryRun is requested, return preview without writing to database
    if (dryRun) {
      return res.json({
        preview: true,
        total: validatedItems.length,
        validCount,
        invalidCount,
        items: validatedItems.map((item) => ({
          index: item.index,
          valid: item.valid,
          error: item.error,
          preview: item.preview,
        })),
      });
    }

    // Execute actual import
    const importedDocs: IDocument[] = [];
    validatedItems.forEach((item, idx) => {
      if (item.valid && item.doc) {
        db.addDocument(item.doc);
        importedDocs.push(item.doc);

        // Movement record for initial registration
        db.addMovement({
          id: `mov-csv-${Date.now()}-${idx}`,
          documentId: item.doc.id,
          movementType: 'REGISTRATION',
          previousLocationId: null,
          newLocationId: item.doc.currentLocationId,
          previousShelfNumber: null,
          newShelfNumber: item.doc.shelfNumber,
          previousBoxNumber: null,
          newBoxNumber: item.doc.boxNumber,
          previousHolderId: null,
          newHolderId: null,
          actingUserId: req.user!.id,
          timestamp: new Date().toISOString(),
          reason: `Batch CSV Registration into Shelf ${item.doc.shelfNumber || 'N/A'}, Box ${item.doc.boxNumber || 'N/A'}.`,
          acknowledgmentDetails: `Imported via CSV by ${req.user!.fullName}`,
        });
      }
    });

    logAudit(
      req.user!,
      'DOCUMENTS_BULK_IMPORTED',
      'DOCUMENT',
      'BATCH',
      `Batch imported ${importedDocs.length} physical documents via CSV (Commercial & Resident categories with Shelf/Box coordinates).`,
      req
    );

    return res.status(201).json({
      success: true,
      importedCount: importedDocs.length,
      invalidCount,
      documents: importedDocs,
      errors: validatedItems.filter((v) => !v.valid).map((v) => ({ index: v.index, error: v.error, preview: v.preview })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process CSV import.' });
  }
});

// Generate Printable QR Code Label Data (including Shelf, Box, and Historical Address)
apiRouter.get('/documents/:id/qr', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = db.getDocumentById(id) || db.getDocumentByRef(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const locationPath = db.getLocationPath(doc.currentLocationId);
    const dept = db.getDepartmentById(doc.departmentId);

    // Generate QR code data URL
    const qrPayload = JSON.stringify({
      ref: doc.referenceNumber,
      qrId: doc.qrIdentifier,
      docId: doc.id,
      cat: doc.category,
      shelf: doc.shelfNumber || '',
      box: doc.boxNumber || '',
      woreda: doc.oldWoreda || '',
      kebele: doc.oldKebele || '',
      house: doc.houseNumber || '',
      system: 'FHC Branch One Archive System',
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 256,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return res.json({
      document: {
        id: doc.id,
        referenceNumber: doc.referenceNumber,
        titleEn: doc.titleEn,
        titleAm: doc.titleAm,
        category: doc.category,
        confidentiality: doc.confidentiality,
        departmentName: dept?.nameEn || 'Government Institution',
        departmentNameAm: dept?.nameAm || '',
        locationPath,
        shelfNumber: doc.shelfNumber,
        boxNumber: doc.boxNumber,
        oldWoreda: doc.oldWoreda,
        oldKebele: doc.oldKebele,
        houseNumber: doc.houseNumber,
        qrIdentifier: doc.qrIdentifier,
      },
      qrDataUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate QR code label.' });
  }
});

// Update Document Metadata
apiRouter.put('/documents/:id', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const doc = db.getDocumentById(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const {
    titleEn,
    titleAm,
    description,
    category,
    confidentiality,
    retentionDate,
    oldWoreda,
    oldKebele,
    houseNumber,
    shelfNumber,
    boxNumber,
    conditionNotes,
    tags,
  } = req.body;

  let validatedCategory: DocumentCategory | undefined = undefined;
  if (category !== undefined) {
    const upperCat = (category || '').toUpperCase().trim();
    if (!DOCUMENT_CATEGORIES.includes(upperCat as any)) {
      return res.status(400).json({
        error: `Invalid document category '${category}'. Allowed categories: 'COMMERCIAL' or 'RESIDENT'.`,
      });
    }
    validatedCategory = upperCat as DocumentCategory;
  }

  const updated = db.updateDocument(id, {
    ...(titleEn !== undefined && { titleEn: titleEn.trim() }),
    ...(titleAm !== undefined && { titleAm: titleAm.trim() }),
    ...(description !== undefined && { description: description.trim() }),
    ...(validatedCategory !== undefined && { category: validatedCategory }),
    ...(confidentiality !== undefined && { confidentiality }),
    ...(retentionDate !== undefined && { retentionDate }),
    ...(oldWoreda !== undefined && { oldWoreda: oldWoreda ? oldWoreda.trim() : null }),
    ...(oldKebele !== undefined && { oldKebele: oldKebele ? oldKebele.trim() : null }),
    ...(houseNumber !== undefined && { houseNumber: houseNumber ? houseNumber.trim() : null }),
    ...(shelfNumber !== undefined && { shelfNumber: shelfNumber ? shelfNumber.trim() : null }),
    ...(boxNumber !== undefined && { boxNumber: boxNumber ? boxNumber.trim() : null }),
    ...(conditionNotes !== undefined && { conditionNotes: conditionNotes.trim() }),
    ...(tags !== undefined && { tags }),
  });

  logAudit(req.user!, 'DOCUMENT_UPDATED', 'DOCUMENT', id, `Updated metadata for document ${doc.referenceNumber}`, req);
  return res.json({ document: updated });
});

// Single Document Deletion (Authorized Officers and Administrators)
apiRouter.delete('/documents/:id', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = db.getDocumentById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found in archival registry.' });
    }

    if (doc.status === 'BORROWED') {
      return res.status(409).json({
        error: `Cannot remove file "${doc.referenceNumber}": File is currently borrowed and in physical custody. Process return before removing.`,
      });
    }

    const deleted = db.deleteDocument(id);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to remove document from storage.' });
    }

    logAudit(
      req.user!,
      'DOCUMENT_DELETED',
      'DOCUMENT',
      id,
      `Permanently removed registered file [${doc.referenceNumber}] (${doc.titleEn}) from archive.`,
      req
    );

    return res.json({
      success: true,
      message: `Document [${doc.referenceNumber}] removed successfully.`,
      deletedId: id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete document.' });
  }
});

// Batch Document Deletion for Multi-Selection
apiRouter.post('/documents/batch-delete', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of document IDs to remove.' });
    }

    const { deletedCount, failedIds } = db.deleteDocuments(documentIds);

    logAudit(
      req.user!,
      'DOCUMENT_BATCH_DELETED',
      'DOCUMENT',
      'BATCH',
      `Permanently removed ${deletedCount} registered documents from archive storage. Failed: ${failedIds.length}`,
      req
    );

    return res.json({
      success: true,
      deletedCount,
      failedCount: failedIds.length,
      failedIds,
      message: `Removed ${deletedCount} registered document(s). ${failedIds.length > 0 ? `${failedIds.length} file(s) could not be removed because they are currently borrowed.` : ''}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to batch delete documents.' });
  }
});

// Controlled Relocation of physical document (recording previous & new shelf & box numbers)
apiRouter.post('/documents/:id/relocate', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { newLocationId, reason, newShelfNumber, newBoxNumber } = req.body;

  const doc = db.getDocumentById(id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });

  if (doc.status === 'BORROWED') {
    return res.status(400).json({ error: 'Cannot relocate a document currently borrowed by a staff member. Please process return first.' });
  }

  const targetLocation = db.getLocationById(newLocationId);
  if (!targetLocation || !targetLocation.active) {
    return res.status(400).json({ error: 'Target archive storage location is invalid or inactive.' });
  }

  const prevLocId = doc.currentLocationId;
  const prevShelf = doc.shelfNumber || null;
  const prevBox = doc.boxNumber || null;

  // Determine target shelf & box
  const targetShelf = newShelfNumber && typeof newShelfNumber === 'string' && newShelfNumber.trim() !== ''
    ? newShelfNumber.trim()
    : (targetLocation.shelfNumber || null);

  const targetBox = newBoxNumber && typeof newBoxNumber === 'string' && newBoxNumber.trim() !== ''
    ? newBoxNumber.trim()
    : (targetLocation.boxNumber || null);

  db.updateDocument(id, {
    currentLocationId: newLocationId,
    shelfNumber: targetShelf,
    boxNumber: targetBox,
  });

  // Record movement with full previous & new shelf and box tracking
  db.addMovement({
    id: `mov-${Date.now()}`,
    documentId: id,
    movementType: 'RELOCATION',
    previousLocationId: prevLocId,
    newLocationId,
    previousShelfNumber: prevShelf,
    newShelfNumber: targetShelf,
    previousBoxNumber: prevBox,
    newBoxNumber: targetBox,
    previousHolderId: null,
    newHolderId: null,
    actingUserId: req.user!.id,
    timestamp: new Date().toISOString(),
    reason: reason || 'Scheduled archive shelf re-organization',
    acknowledgmentDetails: `Relocated from Shelf ${prevShelf || '-'} / Box ${prevBox || '-'} (${db.getLocationPath(prevLocId)}) to Shelf ${targetShelf || '-'} / Box ${targetBox || '-'} (${db.getLocationPath(newLocationId)})`,
  });

  logAudit(
    req.user!,
    'DOCUMENT_RELOCATED',
    'DOCUMENT',
    id,
    `Relocated ${doc.referenceNumber} to Shelf ${targetShelf || '-'} Box ${targetBox || '-'} at ${targetLocation.code}`,
    req
  );

  return res.json({ success: true, message: 'Document successfully relocated with shelf & box movement history.' });
});

// ==========================================
// 6. DOCUMENT REQUESTS & WORKFLOW
// ==========================================

apiRouter.get('/requests', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let requests = db.getRequests();

  // Role scoping:
  // - EMPLOYEE: only their own requests
  // - DEPARTMENT_MANAGER: requests within their department
  // - ARCHIVE_OFFICER / ADMIN / AUDITOR: all requests
  if (user.role === 'EMPLOYEE') {
    requests = requests.filter((r) => r.requesterId === user.id);
  } else if (user.role === 'DEPARTMENT_MANAGER') {
    requests = requests.filter((r) => r.requestingDepartmentId === user.departmentId);
  }

  const enriched = requests
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => {
      const doc = db.getDocumentById(r.documentId);
      const requester = db.getUserById(r.requesterId);
      const dept = db.getDepartmentById(r.requestingDepartmentId);
      const approver = r.approverId ? db.getUserById(r.approverId) : null;
      const issuer = r.issuedOfficerId ? db.getUserById(r.issuedOfficerId) : null;
      const receiver = r.receivingOfficerId ? db.getUserById(r.receivingOfficerId) : null;

      // Calculate overdue flag
      const isOverdue = r.status === 'ISSUED' && new Date(r.requestedReturnDate).getTime() < Date.now();

      return {
        ...r,
        document: doc ? { id: doc.id, referenceNumber: doc.referenceNumber, titleEn: doc.titleEn, titleAm: doc.titleAm, status: doc.status } : null,
        requester: requester ? { id: requester.id, fullName: requester.fullName, email: requester.email, role: requester.role } : null,
        department: dept ? { id: dept.id, code: dept.code, nameEn: dept.nameEn, nameAm: dept.nameAm } : null,
        approver: approver ? { id: approver.id, fullName: approver.fullName } : null,
        issuer: issuer ? { id: issuer.id, fullName: issuer.fullName } : null,
        receiver: receiver ? { id: receiver.id, fullName: receiver.fullName } : null,
        isOverdue,
      };
    });

  return res.json({ requests: enriched });
});

apiRouter.post('/requests', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, purpose, requestedReturnDate, priority, notes } = req.body;
    const user = req.user!;

    if (!documentId || !purpose || !requestedReturnDate) {
      return res.status(400).json({ error: 'Document, business purpose, and requested return date are required.' });
    }

    const doc = db.getDocumentById(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Physical document record not found.' });
    }

    // Check availability
    if (doc.status !== 'AVAILABLE') {
      return res.status(400).json({
        error: `Document is currently not available for request. Current status: ${doc.status}.`,
      });
    }

    // Check for conflicting active pending or issued request for same document
    const activeReq = db
      .getRequests()
      .find((r) => r.documentId === documentId && (r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'ISSUED'));
    if (activeReq) {
      return res.status(409).json({
        error: `A request (${activeReq.requestNumber}) is already in progress for this document.`,
      });
    }

    // Verify return date is in future
    if (new Date(requestedReturnDate).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Requested return date must be in the future.' });
    }

    const requestNumber = `REQ-${new Date().getFullYear()}-${String(db.getRequests().length + 1).padStart(4, '0')}`;

    const newRequest: IDocumentRequest = {
      id: `req-${Date.now()}`,
      requestNumber,
      documentId: doc.id,
      requesterId: user.id,
      requestingDepartmentId: user.departmentId || doc.departmentId,
      purpose: purpose.trim(),
      requestDate: new Date().toISOString(),
      requestedReturnDate,
      priority: priority || 'NORMAL',
      status: 'PENDING',
      notes: notes?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addRequest(newRequest);

    // Mark document as RESERVED
    db.updateDocument(doc.id, { status: 'RESERVED' });

    // Notify Department Manager
    const dept = db.getDepartmentById(newRequest.requestingDepartmentId);
    if (dept?.managerId && dept.managerId !== user.id) {
      db.addNotification({
        id: `notif-${Date.now()}-mgr`,
        userId: dept.managerId,
        titleEn: 'New Document Access Request',
        titleAm: 'አዲስ የሰነድ ጥያቄ ቀርቧል',
        messageEn: `Employee ${user.fullName} submitted request ${requestNumber} for "${doc.titleEn}".`,
        messageAm: `ሰራተኛ ${user.fullName} ለሰነድ "${doc.titleAm}" ጥያቄ ${requestNumber} አቅርበዋል።`,
        type: 'INFO',
        read: false,
        link: '/approvals',
        createdAt: new Date().toISOString(),
      });
    }

    // Also notify Archive Officers and Admins of the new request
    const officersAndAdmins = db.getUsers().filter((u) => u.active && (u.role === 'ARCHIVE_OFFICER' || u.role === 'ADMIN'));
    officersAndAdmins.forEach((officer, oIdx) => {
      if (officer.id !== user.id) {
        db.addNotification({
          id: `notif-req-${Date.now()}-${oIdx}`,
          userId: officer.id,
          titleEn: 'New Physical Document Request',
          titleAm: 'አዲስ የሰነድ ጥያቄ ቀርቧል',
          messageEn: `Request ${requestNumber} submitted by ${user.fullName} (${dept?.code || ''}) for "${doc.titleEn}" (${doc.referenceNumber}).`,
          messageAm: `በሰራተኛ ${user.fullName} ለሰነድ "${doc.titleAm}" (${doc.referenceNumber}) አዲስ ጥያቄ ${requestNumber} ቀርቧል።`,
          type: 'INFO',
          read: false,
          link: '/approvals',
          createdAt: new Date().toISOString(),
        });
      }
    });

    logAudit(
      user,
      'REQUEST_SUBMITTED',
      'DOCUMENT_REQUEST',
      newRequest.id,
      `Submitted request ${requestNumber} for ${doc.referenceNumber}`,
      req
    );

    return res.status(201).json({ request: newRequest });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit document request.' });
  }
});

// Review request (Approve / Reject)
apiRouter.post('/requests/:id/review', authMiddleware, requireRole('ADMIN', 'DEPARTMENT_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { decision, rejectionReason } = req.body; // 'APPROVE' or 'REJECT'
  const user = req.user!;

  const request = db.getRequestById(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: `Cannot review request with status '${request.status}'.` });
  }

  // If department manager, ensure request belongs to their department
  if (user.role === 'DEPARTMENT_MANAGER' && user.departmentId !== request.requestingDepartmentId) {
    return res.status(403).json({ error: 'You may only approve requests within your designated department.' });
  }

  const doc = db.getDocumentById(request.documentId);

  if (decision === 'APPROVE') {
    db.updateRequest(id, {
      status: 'APPROVED',
      approverId: user.id,
      decisionDate: new Date().toISOString(),
    });

    // Notify requester
    db.addNotification({
      id: `notif-${Date.now()}-app-req`,
      userId: request.requesterId,
      titleEn: 'Document Request Approved - Ready for Pickup',
      titleAm: 'የሰነድ ጥያቄዎ ፀድቋል - ለመረከብ ዝግጁ',
      messageEn: `Your request ${request.requestNumber} for "${doc?.titleEn}" (${doc?.referenceNumber}) was approved. Please visit the Archive Office for physical collection.`,
      messageAm: `ለሰነድ "${doc?.titleAm}" (${doc?.referenceNumber}) ያቀረቡት ጥያቄ ${request.requestNumber} ፀድቋል። ሰነዱን በአካል ለመረከብ ማህደር ክፍል ይቅረቡ።`,
      type: 'SUCCESS',
      read: false,
      link: '/requests',
      createdAt: new Date().toISOString(),
    });

    // Also notify Archive Officers to prepare physical handover
    const requester = db.getUserById(request.requesterId);
    const archiveOfficers = db.getUsers().filter((u) => u.active && (u.role === 'ARCHIVE_OFFICER' || u.role === 'ADMIN'));
    archiveOfficers.forEach((ao, idx) => {
      if (ao.id !== user.id) {
        db.addNotification({
          id: `notif-app-ao-${Date.now()}-${idx}`,
          userId: ao.id,
          titleEn: 'Request Approved - Ready for Issuance',
          titleAm: 'የፀደቀ ሰነድ ርክክብ ይጠበቃል',
          messageEn: `Request ${request.requestNumber} for "${doc?.titleEn}" was approved for ${requester?.fullName}. Ready for physical issue.`,
          messageAm: `ለ${requester?.fullName} የቀረበው ጥያቄ ${request.requestNumber} ፀድቋል። ሰነዱን ለማስረከብ ያዘጋጁ።`,
          type: 'INFO',
          read: false,
          link: '/requests',
          createdAt: new Date().toISOString(),
        });
      }
    });

    logAudit(user, 'REQUEST_APPROVED', 'DOCUMENT_REQUEST', id, `Approved request ${request.requestNumber}`, req);
    return res.json({ success: true, message: 'Request approved successfully.' });
  } else if (decision === 'REJECT') {
    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    db.updateRequest(id, {
      status: 'REJECTED',
      approverId: user.id,
      decisionDate: new Date().toISOString(),
      rejectionReason: rejectionReason.trim(),
    });

    // Revert document status back to AVAILABLE
    if (doc && doc.status === 'RESERVED') {
      db.updateDocument(doc.id, { status: 'AVAILABLE' });
    }

    // Notify requester
    db.addNotification({
      id: `notif-${Date.now()}`,
      userId: request.requesterId,
      titleEn: 'Document Request Rejected',
      titleAm: 'የሰነድ ጥያቄዎ ውድቅ ተደርጓል',
      messageEn: `Your request ${request.requestNumber} was rejected. Reason: ${rejectionReason}`,
      messageAm: `የሰነድ ጥያቄዎ ${request.requestNumber} ውድቅ ተደርጓል። ምክንያት: ${rejectionReason}`,
      type: 'ALERT',
      read: false,
      link: '/requests',
      createdAt: new Date().toISOString(),
    });

    logAudit(user, 'REQUEST_REJECTED', 'DOCUMENT_REQUEST', id, `Rejected request ${request.requestNumber}. Reason: ${rejectionReason}`, req);
    return res.json({ success: true, message: 'Request rejected.' });
  } else {
    return res.status(400).json({ error: 'Decision must be APPROVE or REJECT.' });
  }
});

// ==========================================
// 7. PHYSICAL FILE ISSUE & RETURN (Atomic Handover)
// ==========================================

apiRouter.post('/requests/:id/issue', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { notes, acknowledgmentDetails } = req.body;
  const officer = req.user!;

  const request = db.getRequestById(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.status !== 'APPROVED') {
    return res.status(400).json({
      error: `Cannot issue physical file for request with status '${request.status}'. Request must be APPROVED first.`,
    });
  }

  const doc = db.getDocumentById(request.documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Document record not found.' });
  }

  // Prevent concurrent double-issue
  if (doc.status === 'BORROWED') {
    return res.status(409).json({ error: 'Physical file is already recorded as BORROWED.' });
  }

  const requester = db.getUserById(request.requesterId);
  const previousLocationId = doc.currentLocationId;

  // 1. Atomically update document status & holder
  db.updateDocument(doc.id, {
    status: 'BORROWED',
    currentHolderId: request.requesterId,
  });

  // 2. Update request status to ISSUED
  db.updateRequest(id, {
    status: 'ISSUED',
    issuedOfficerId: officer.id,
    issuedDate: new Date().toISOString(),
    notes: notes ? `${request.notes || ''} [Issue Note: ${notes}]` : request.notes,
  });

  // 3. Create immutable FileMovement record
  db.addMovement({
    id: `mov-${Date.now()}`,
    documentId: doc.id,
    movementType: 'ISSUE',
    previousLocationId,
    newLocationId: null,
    previousHolderId: null,
    newHolderId: request.requesterId,
    actingUserId: officer.id,
    timestamp: new Date().toISOString(),
    requestId: request.id,
    reason: `Physical handover to ${requester?.fullName || 'Requester'} under authorized request ${request.requestNumber}.`,
    acknowledgmentDetails: acknowledgmentDetails || `Handed over by Archive Officer ${officer.fullName}. Due: ${request.requestedReturnDate}`,
  });

  // 4. Create Audit Log
  logAudit(
    officer,
    'FILE_ISSUED',
    'DOCUMENT',
    doc.id,
    `Physical handover of ${doc.referenceNumber} to ${requester?.fullName} (Due: ${request.requestedReturnDate})`,
    req
  );

  // 5. Notify Requester
  db.addNotification({
    id: `notif-${Date.now()}`,
    userId: request.requesterId,
    titleEn: 'Physical File Handover Confirmed',
    titleAm: 'የሰነድ ርክክብ ተረጋግጧል',
    messageEn: `You have received physical custody of "${doc.titleEn}". Please handle carefully and return by ${new Date(request.requestedReturnDate).toLocaleDateString()}.`,
    messageAm: `ሰነድ "${doc.titleAm}" በአካል ተረክበዋል። እባክዎ ሰነዱን በጥንቃቄ ይዘው እስከ ${new Date(request.requestedReturnDate).toLocaleDateString()} ይመልሱ።`,
    type: 'INFO',
    read: false,
    link: '/requests',
    createdAt: new Date().toISOString(),
  });

  return res.json({ success: true, message: 'Physical file successfully issued and recorded in custody ledger.' });
});

apiRouter.post('/requests/:id/return', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { returnLocationId, condition, conditionNotes } = req.body;
  const officer = req.user!;

  const request = db.getRequestById(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.status !== 'ISSUED') {
    return res.status(400).json({ error: `Cannot process return for request with status '${request.status}'.` });
  }

  const doc = db.getDocumentById(request.documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Document record not found.' });
  }

  // Verified destination storage location
  const destinationLocId = returnLocationId || doc.currentLocationId;
  const destinationLoc = db.getLocationById(destinationLocId);
  if (!destinationLoc || !destinationLoc.active) {
    return res.status(400).json({ error: 'Invalid destination archival storage location.' });
  }

  const previousHolderId = doc.currentHolderId;

  // 1. Atomically restore document status, location, and clear holder
  db.updateDocument(doc.id, {
    status: 'AVAILABLE',
    currentLocationId: destinationLocId,
    currentHolderId: null,
    conditionNotes: conditionNotes ? `[Return Condition: ${condition}] ${conditionNotes}` : doc.conditionNotes,
  });

  // 2. Update request status to RETURNED
  db.updateRequest(id, {
    status: 'RETURNED',
    receivingOfficerId: officer.id,
    actualReturnDate: new Date().toISOString(),
    returnCondition: condition || 'GOOD',
    returnConditionNotes: conditionNotes?.trim(),
  });

  // 3. Create immutable FileMovement record
  db.addMovement({
    id: `mov-${Date.now()}`,
    documentId: doc.id,
    movementType: 'RETURN',
    previousLocationId: null,
    newLocationId: destinationLocId,
    previousHolderId,
    newHolderId: null,
    actingUserId: officer.id,
    timestamp: new Date().toISOString(),
    requestId: request.id,
    reason: `Verified return of physical file from borrower. Stored at ${db.getLocationPath(destinationLocId)}.`,
    acknowledgmentDetails: `Inspected and confirmed in ${condition || 'GOOD'} condition by Archive Officer ${officer.fullName}.`,
  });

  // 4. Create Audit Log
  logAudit(
    officer,
    'FILE_RETURNED',
    'DOCUMENT',
    doc.id,
    `Physical file ${doc.referenceNumber} returned to shelf location ${destinationLoc.code} (${condition || 'GOOD'})`,
    req
  );

  // 5. Notify Requester of verified return
  db.addNotification({
    id: `notif-${Date.now()}`,
    userId: request.requesterId,
    titleEn: 'Physical File Return Verified',
    titleAm: 'የሰነድ መመለስ በይፋ ተረጋግጧል',
    messageEn: `The return of "${doc.titleEn}" has been verified by the Archive Office. Your custody has ended.`,
    messageAm: `የሰነድ "${doc.titleAm}" ርክክብ በማህደር ክፍሉ ተረጋግጧል። የሰነድ ሀላፊነትዎ ተጠናቋል።`,
    type: 'SUCCESS',
    read: false,
    link: '/requests',
    createdAt: new Date().toISOString(),
  });

  return res.json({ success: true, message: 'Document physical return confirmed and placed back in archive.' });
});

// Borrower / User initiates return ("Request to Return" notice to Archive Officers)
apiRouter.post('/requests/:id/request-return', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { returnNotes } = req.body;
  const user = req.user!;

  const request = db.getRequestById(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  // Only the requester or an administrator can initiate the return
  if (request.requesterId !== user.id && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only the file borrower can request to return this document.' });
  }

  if (request.status !== 'ISSUED') {
    return res.status(400).json({ error: `Cannot request return for request in status '${request.status}'.` });
  }

  const doc = db.getDocumentById(request.documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Associated document not found.' });
  }

  // Mark request with returnRequested flag
  db.updateRequest(id, {
    returnRequested: true,
    returnRequestedAt: new Date().toISOString(),
  });

  // Notify all Archive Officers and Admins
  const officersAndAdmins = db.getUsers().filter((u) => u.active && (u.role === 'ARCHIVE_OFFICER' || u.role === 'ADMIN'));
  officersAndAdmins.forEach((officer, idx) => {
    db.addNotification({
      id: `notif-ret-req-${Date.now()}-${idx}`,
      userId: officer.id,
      titleEn: 'Physical File Return Notice from Borrower',
      titleAm: 'የሰነድ መመለስ ጥያቄ ከያዥ ቀርቧል',
      messageEn: `Borrower ${user.fullName} has requested to return "${doc.titleEn}" (${doc.referenceNumber}). Please inspect and process intake at the archive desk.`,
      messageAm: `ተጠቃሚ ${user.fullName} ሰነድ "${doc.titleAm}" (${doc.referenceNumber}) ለመመለስ አሳውቀዋል። እባክዎ በማህደር ክፍል ተረክበው ይመዝግቡ።`,
      type: 'INFO',
      read: false,
      link: '/requests',
      createdAt: new Date().toISOString(),
    });
  });

  // Also send confirmation notification to the borrower
  db.addNotification({
    id: `notif-ret-conf-${Date.now()}`,
    userId: user.id,
    titleEn: 'Return Notice Submitted Successfully',
    titleAm: 'የመመለሻ ጥያቄዎ በተሳካ ሁኔታ ደርሷል',
    messageEn: `Your notice to return "${doc.titleEn}" has been submitted. Please present the physical document to the Archive Office for verified intake.`,
    messageAm: `ለሰነድ "${doc.titleAm}" ያቀረቡት የመመለሻ ጥያቄ ተመዝግቧል። እባክዎ ሰነዱን በማህደር ክፍል በአካል አስረክበው ርክክቡን ያረጋግጡ።`,
    type: 'SUCCESS',
    read: false,
    link: '/requests',
    createdAt: new Date().toISOString(),
  });

  logAudit(user, 'RETURN_REQUESTED', 'DOCUMENT_REQUEST', id, `Borrower requested return of ${doc.referenceNumber}${returnNotes ? ': ' + returnNotes : ''}`, req);

  return res.json({
    success: true,
    message: 'Return request submitted. Archive Officers have been notified via browser alert.',
  });
});

// Archive Officer or Admin sends urgent return notice to borrower
apiRouter.post('/requests/:id/send-return-notice', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { customMessage } = req.body;
  const officer = req.user!;

  const request = db.getRequestById(id);
  if (!request) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  if (request.status !== 'ISSUED') {
    return res.status(400).json({ error: `Cannot send return notice for file in status '${request.status}'.` });
  }

  const doc = db.getDocumentById(request.documentId);
  const borrower = db.getUserById(request.requesterId);

  // Mark request with returnNoticeSent flag
  db.updateRequest(id, {
    returnNoticeSent: true,
    returnNoticeSentAt: new Date().toISOString(),
  });

  // Dispatch high-priority alert notification to borrower
  db.addNotification({
    id: `notif-ret-urge-${Date.now()}`,
    userId: request.requesterId,
    titleEn: 'Urgent: Archive Document Return Required',
    titleAm: 'አስቸኳይ፡ የማህደር ሰነድ እንዲመልሱ ይጠየቃል',
    messageEn: customMessage || `Archive Officer ${officer.fullName} requests immediate return of document "${doc?.titleEn}" (${doc?.referenceNumber}). Return deadline was ${new Date(request.requestedReturnDate).toLocaleDateString()}.`,
    messageAm: customMessage || `የማህደር ኃላፊ ${officer.fullName} ሰነድ "${doc?.titleAm}" (${doc?.referenceNumber}) በአስቸኳይ እንዲመልሱ ጠይቀዋል። እባክዎ ዛሬውኑ ወደ ማህደር ክፍል ይመልሱ።`,
    type: 'ALERT',
    read: false,
    link: '/requests',
    createdAt: new Date().toISOString(),
  });

  logAudit(officer, 'RETURN_NOTICE_SENT', 'DOCUMENT_REQUEST', id, `Sent return notice to borrower ${borrower?.fullName} for file ${doc?.referenceNumber}`, req);

  return res.json({
    success: true,
    message: `Return notice dispatched to borrower ${borrower?.fullName || ''}.`,
  });
});

// Adjust returning time and date for an active request (RBAC-guarded)
apiRouter.post(
  '/requests/:id/adjust-return',
  authMiddleware,
  requirePermission('adjustReturnDate'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { newReturnDate, newReturnTime, reason, notifyBorrower } = req.body;
      const officer = req.user!;

      if (!newReturnDate) {
        return res.status(400).json({ error: 'New return date is required.' });
      }

      const request = db.getRequestById(id);
      if (!request) {
        return res.status(404).json({ error: 'Request record not found.' });
      }

      if (request.status === 'RETURNED' || request.status === 'REJECTED' || request.status === 'CANCELLED') {
        return res.status(400).json({
          error: `Cannot adjust return date for request in '${request.status}' status.`,
        });
      }

      const timeStr =
        newReturnTime && /^\d{2}:\d{2}$/.test(newReturnTime.trim())
          ? newReturnTime.trim()
          : '17:00';
      const rawDate = newReturnDate.includes('T') ? newReturnDate.split('T')[0] : newReturnDate;
      const combinedDate = new Date(`${rawDate}T${timeStr}:00`);

      if (isNaN(combinedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid return date or time format.' });
      }

      if (combinedDate.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'New return date and time must be set in the future.' });
      }

      // Check max return duration from system settings
      const settings = db.getSettings();
      const maxDays = settings.returnPolicy?.maxReturnDays || 60;
      const maxFutureTime = Date.now() + maxDays * 24 * 60 * 60 * 1000;
      if (combinedDate.getTime() > maxFutureTime) {
        return res.status(400).json({
          error: `Target return date exceeds maximum allowable borrowing period of ${maxDays} days.`,
        });
      }

      const previousDate = request.requestedReturnDate;
      const finalIso = combinedDate.toISOString();

      const updated = db.updateRequest(id, {
        requestedReturnDate: finalIso,
        returnDateAdjusted: true,
        previousReturnDate: previousDate,
        adjustedBy: officer.id,
        adjustedAt: new Date().toISOString(),
        adjustmentReason: reason?.trim() || 'Official schedule adjustment',
        extensionRequested: false, // Clears pending extension
      });

      const doc = db.getDocumentById(request.documentId);
      const borrower = db.getUserById(request.requesterId);

      // Record administrative movement log
      db.addMovement({
        id: `mov-adj-${Date.now()}`,
        documentId: request.documentId,
        movementType: 'ADMIN_CORRECTION',
        previousLocationId: null,
        newLocationId: null,
        previousShelfNumber: null,
        newShelfNumber: null,
        previousBoxNumber: null,
        newBoxNumber: null,
        previousHolderId: request.requesterId,
        newHolderId: request.requesterId,
        actingUserId: officer.id,
        timestamp: new Date().toISOString(),
        requestId: request.id,
        reason: `Return deadline adjusted to ${combinedDate.toLocaleDateString()} ${timeStr}. Reason: ${reason || 'Official extension granted'}.`,
        acknowledgmentDetails: `Adjusted by ${officer.fullName} (${officer.role})`,
      });

      // Notify Borrower via real-time browser notification
      if (notifyBorrower !== false && borrower) {
        db.addNotification({
          id: `notif-adj-${Date.now()}`,
          userId: request.requesterId,
          titleEn: 'Return Schedule Adjusted',
          titleAm: 'የሰነድ መመለሻ ቀጠሮ ተስተካክሏል',
          messageEn: `The return deadline for "${doc?.titleEn}" (${doc?.referenceNumber}) has been adjusted to ${combinedDate.toLocaleDateString()} ${timeStr}. Reason: ${reason || 'Official schedule adjustment'}.`,
          messageAm: `ለሰነድ "${doc?.titleAm}" (${doc?.referenceNumber}) የተሰጠው የመመለሻ ቀጠሮ ወደ ${combinedDate.toLocaleDateString()} ${timeStr} ተስተካክሏል። ምክንያት: ${reason || 'የይፋዊ አሰራር ማስተካከያ'}።`,
          type: 'INFO',
          read: false,
          link: '/requests',
          createdAt: new Date().toISOString(),
        });
      }

      logAudit(
        officer,
        'RETURN_DATE_ADJUSTED',
        'DOCUMENT_REQUEST',
        id,
        `Adjusted return date for request ${request.requestNumber} (${doc?.referenceNumber}) to ${combinedDate.toLocaleDateString()} ${timeStr}. Reason: ${reason || 'N/A'}`,
        req
      );

      return res.json({
        success: true,
        message: 'Return time and date adjusted successfully.',
        request: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to adjust return date.' });
    }
  }
);

// Borrower / Employee submits formal extension request
apiRouter.post(
  '/requests/:id/request-extension',
  authMiddleware,
  requirePermission('requestExtension'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { requestedDate, requestedTime, reason } = req.body;
      const user = req.user!;

      const settings = db.getSettings();
      if (!settings.returnPolicy?.allowRequesterExtensionRequest) {
        return res.status(403).json({ error: 'Requester extensions are currently disabled in Return Policy settings.' });
      }

      const request = db.getRequestById(id);
      if (!request) {
        return res.status(404).json({ error: 'Request record not found.' });
      }

      if (request.requesterId !== user.id && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only the borrower or an administrator can request an extension.' });
      }

      if (request.status !== 'ISSUED' && request.status !== 'APPROVED') {
        return res.status(400).json({ error: `Cannot request extension for request in status '${request.status}'.` });
      }

      if (!requestedDate) {
        return res.status(400).json({ error: 'Target extension date is required.' });
      }

      const timeStr = requestedTime && /^\d{2}:\d{2}$/.test(requestedTime.trim()) ? requestedTime.trim() : '17:00';
      const rawDate = requestedDate.includes('T') ? requestedDate.split('T')[0] : requestedDate;
      const combinedDate = new Date(`${rawDate}T${timeStr}:00`);

      if (isNaN(combinedDate.getTime()) || combinedDate.getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Target extension date must be in the future.' });
      }

      const updated = db.updateRequest(id, {
        extensionRequested: true,
        extensionRequestedDate: combinedDate.toISOString(),
        extensionReason: reason?.trim() || 'Extension requested by borrower',
      });

      const doc = db.getDocumentById(request.documentId);

      // Alert all Archive Officers & Department Managers
      const reviewers = db
        .getUsers()
        .filter((u) => u.active && (u.role === 'ARCHIVE_OFFICER' || u.role === 'ADMIN' || u.role === 'DEPARTMENT_MANAGER'));

      reviewers.forEach((rev, idx) => {
        db.addNotification({
          id: `notif-ext-req-${Date.now()}-${idx}`,
          userId: rev.id,
          titleEn: 'Return Extension Requested',
          titleAm: 'የጊዜ ማራዘሚያ ጥያቄ ቀርቧል',
          messageEn: `Borrower ${user.fullName} requested extension to ${combinedDate.toLocaleDateString()} for "${doc?.titleEn}". Reason: ${reason || 'N/A'}.`,
          messageAm: `ተጠቃሚ ${user.fullName} ለሰነድ "${doc?.titleAm}" እስከ ${combinedDate.toLocaleDateString()} ድረስ የጊዜ ማራዘሚያ ጠይቀዋል። ምክንያት: ${reason || 'ያልተገለጸ'}።`,
          type: 'INFO',
          read: false,
          link: '/requests',
          createdAt: new Date().toISOString(),
        });
      });

      logAudit(
        user,
        'EXTENSION_REQUESTED',
        'DOCUMENT_REQUEST',
        id,
        `Requested extension to ${combinedDate.toLocaleDateString()} for ${doc?.referenceNumber}. Reason: ${reason || 'N/A'}`,
        req
      );

      return res.json({
        success: true,
        message: 'Extension request submitted. Archive Officers have been notified.',
        request: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to submit extension request.' });
    }
  }
);

// ==========================================
// 8. MISSING FILE INVESTIGATIONS WORKFLOW
// ==========================================

apiRouter.get('/investigations', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const investigations = db.getInvestigations().map((inv) => {
    const doc = db.getDocumentById(inv.documentId);
    const reporter = db.getUserById(inv.reportedBy);
    const investigator = inv.assignedInvestigatorId ? db.getUserById(inv.assignedInvestigatorId) : null;
    const lastLoc = inv.lastKnownLocationId ? db.getLocationById(inv.lastKnownLocationId) : null;
    const lastHolder = inv.lastKnownHolderId ? db.getUserById(inv.lastKnownHolderId) : null;

    return {
      ...inv,
      document: doc ? { id: doc.id, referenceNumber: doc.referenceNumber, titleEn: doc.titleEn, titleAm: doc.titleAm, status: doc.status } : null,
      reporter: reporter ? { id: reporter.id, fullName: reporter.fullName } : null,
      investigator: investigator ? { id: investigator.id, fullName: investigator.fullName } : null,
      lastLocationPath: lastLoc ? db.getLocationPath(lastLoc.id) : null,
      lastHolderName: lastHolder?.fullName || null,
    };
  });

  return res.json({ investigations });
});

apiRouter.post('/investigations', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, initialNote, assignedInvestigatorId } = req.body;
    const user = req.user!;

    const doc = db.getDocumentById(documentId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (doc.status === 'MISSING' || doc.status === 'UNDER_INVESTIGATION') {
      return res.status(400).json({ error: 'Document is already marked as missing or under investigation.' });
    }

    const lastKnownLocationId = doc.currentLocationId;
    const lastKnownHolderId = doc.currentHolderId;

    // Update document status
    db.updateDocument(doc.id, { status: 'UNDER_INVESTIGATION' });

    // Create investigation record
    const investigation: IMissingFileInvestigation = {
      id: `inv-${Date.now()}`,
      documentId: doc.id,
      reportedBy: user.id,
      lastKnownLocationId,
      lastKnownHolderId,
      assignedInvestigatorId: assignedInvestigatorId || user.id,
      status: 'UNDER_INVESTIGATION',
      notes: [
        {
          authorId: user.id,
          note: initialNote?.trim() || 'Missing file reported during physical inventory check.',
          timestamp: new Date().toISOString(),
        },
      ],
      reportedAt: new Date().toISOString(),
    };

    db.addInvestigation(investigation);

    // Record in movement timeline
    db.addMovement({
      id: `mov-${Date.now()}`,
      documentId: doc.id,
      movementType: 'MISSING_REPORT',
      previousLocationId: lastKnownLocationId,
      newLocationId: null,
      previousHolderId: lastKnownHolderId,
      newHolderId: null,
      actingUserId: user.id,
      timestamp: new Date().toISOString(),
      reason: `Flagged as missing. Investigation INC-${investigation.id} initiated.`,
      acknowledgmentDetails: initialNote || 'Not located at designated storage box.',
    });

    logAudit(
      user,
      'FILE_REPORTED_MISSING',
      'DOCUMENT',
      doc.id,
      `Reported document ${doc.referenceNumber} missing. Investigation opened.`,
      req
    );

    return res.status(201).json({ investigation });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to initiate investigation.' });
  }
});

apiRouter.post('/investigations/:id/notes', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body;
  const user = req.user!;

  if (!note || note.trim() === '') {
    return res.status(400).json({ error: 'Investigation note cannot be empty.' });
  }

  const inv = db.getInvestigationById(id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation not found.' });
  }

  const updatedNotes = [
    ...inv.notes,
    {
      authorId: user.id,
      note: note.trim(),
      timestamp: new Date().toISOString(),
    },
  ];

  db.updateInvestigation(id, { notes: updatedNotes });

  logAudit(user, 'INVESTIGATION_NOTE_ADDED', 'INVESTIGATION', id, `Added investigation finding to ${id}`, req);
  return res.json({ success: true, notes: updatedNotes });
});

apiRouter.post('/investigations/:id/resolve', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { resolutionType, resolutionDetails, restoredLocationId } = req.body;
  const user = req.user!;

  const inv = db.getInvestigationById(id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation not found.' });
  }

  const doc = db.getDocumentById(inv.documentId);
  if (!doc) {
    return res.status(404).json({ error: 'Associated document not found.' });
  }

  if (resolutionType === 'RESOLVED_FOUND') {
    const locId = restoredLocationId || inv.lastKnownLocationId || doc.currentLocationId;
    db.updateDocument(doc.id, {
      status: 'AVAILABLE',
      currentLocationId: locId,
      currentHolderId: null,
    });

    db.updateInvestigation(id, {
      status: 'RESOLVED_FOUND',
      resolutionDetails: resolutionDetails?.trim() || 'Physical file located and verified back in archive.',
      resolvedAt: new Date().toISOString(),
    });

    db.addMovement({
      id: `mov-${Date.now()}`,
      documentId: doc.id,
      movementType: 'RECOVERY',
      previousLocationId: null,
      newLocationId: locId,
      previousHolderId: null,
      newHolderId: null,
      actingUserId: user.id,
      timestamp: new Date().toISOString(),
      reason: `Missing file successfully recovered and verified by ${user.fullName}.`,
      acknowledgmentDetails: resolutionDetails,
    });

    logAudit(user, 'FILE_RECOVERED', 'DOCUMENT', doc.id, `Recovered missing file ${doc.referenceNumber}`, req);
    return res.json({ success: true, message: 'Document recovered and restored to active archive.' });
  } else if (resolutionType === 'RESOLVED_LOST') {
    db.updateDocument(doc.id, { status: 'MISSING' });

    db.updateInvestigation(id, {
      status: 'RESOLVED_LOST',
      resolutionDetails: resolutionDetails?.trim() || 'File deemed formally lost after exhaustive search.',
      resolvedAt: new Date().toISOString(),
    });

    logAudit(user, 'FILE_CONFIRMED_LOST', 'DOCUMENT', doc.id, `Confirmed file ${doc.referenceNumber} lost`, req);
    return res.json({ success: true, message: 'Document declared formally lost and logged in auditor incident registry.' });
  } else {
    return res.status(400).json({ error: 'Invalid resolution type.' });
  }
});

// ==========================================
// 9. DASHBOARD SUMMARY & REPORTING METRICS
// ==========================================

apiRouter.get('/reports/summary', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const documents = db.getDocuments();
  const requests = db.getRequests();
  const investigations = db.getInvestigations();
  const movements = db.getMovements();
  const departments = db.getDepartments();

  const totalDocuments = documents.length;
  const availableDocuments = documents.filter((d) => d.status === 'AVAILABLE').length;
  const borrowedDocuments = documents.filter((d) => d.status === 'BORROWED').length;
  const missingDocuments = documents.filter((d) => d.status === 'MISSING' || d.status === 'UNDER_INVESTIGATION').length;
  const archivedDocuments = documents.filter((d) => d.status === 'ARCHIVED').length;

  const pendingRequests = requests.filter((r) => r.status === 'PENDING').length;
  const approvedRequests = requests.filter((r) => r.status === 'APPROVED').length;
  const issuedRequests = requests.filter((r) => r.status === 'ISSUED').length;

  // Real calculated overdue requests: status === ISSUED && requestedReturnDate < now
  const nowTime = Date.now();
  const overdueRequests = requests.filter(
    (r) => r.status === 'ISSUED' && new Date(r.requestedReturnDate).getTime() < nowTime
  );

  // Category distribution: Commercial vs Resident metrics
  const categoryCounts: Record<string, number> = {
    COMMERCIAL: 0,
    RESIDENT: 0,
  };
  const woredaDistribution: Record<string, number> = {};
  const shelfDistribution: Record<string, number> = {};
  const boxDistribution: Record<string, number> = {};

  documents.forEach((d) => {
    const cat = d.category || 'COMMERCIAL';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    if (d.oldWoreda) {
      const key = `Woreda ${d.oldWoreda}`;
      woredaDistribution[key] = (woredaDistribution[key] || 0) + 1;
    }
    if (d.shelfNumber) {
      const key = `Shelf ${d.shelfNumber}`;
      shelfDistribution[key] = (shelfDistribution[key] || 0) + 1;
    }
    if (d.boxNumber) {
      const key = `Box ${d.boxNumber}`;
      boxDistribution[key] = (boxDistribution[key] || 0) + 1;
    }
  });

  const commercialCount = categoryCounts['COMMERCIAL'] || 0;
  const residentCount = categoryCounts['RESIDENT'] || 0;

  // Department activity
  const departmentStats = departments.map((dept) => {
    const deptDocs = documents.filter((d) => d.departmentId === dept.id).length;
    const deptReqs = requests.filter((r) => r.requestingDepartmentId === dept.id).length;
    return {
      departmentId: dept.id,
      code: dept.code,
      nameEn: dept.nameEn,
      nameAm: dept.nameAm,
      documentCount: deptDocs,
      requestCount: deptReqs,
    };
  });

  return res.json({
    metrics: {
      totalDocuments,
      availableDocuments,
      borrowedDocuments,
      missingDocuments,
      archivedDocuments,
      commercialCount,
      residentCount,
      pendingRequests,
      approvedRequests,
      issuedRequests,
      overdueCount: overdueRequests.length,
      activeInvestigations: investigations.filter((i) => i.status === 'UNDER_INVESTIGATION' || i.status === 'OPEN').length,
    },
    categoryCounts,
    woredaDistribution,
    shelfDistribution,
    boxDistribution,
    departmentStats,
    recentMovements: movements.slice(0, 8).map((m) => {
      const doc = db.getDocumentById(m.documentId);
      const user = db.getUserById(m.actingUserId);
      return {
        ...m,
        documentRef: doc?.referenceNumber || 'Unknown Ref',
        documentTitle: doc?.titleEn || 'Untitled Document',
        actorName: user?.fullName || 'System',
      };
    }),
  });
});

// CSV / Tabular Export
apiRouter.get('/reports/export', authMiddleware, requireRole('ADMIN', 'ARCHIVE_OFFICER', 'AUDITOR'), (req: AuthenticatedRequest, res: Response) => {
  const { type } = req.query; // 'inventory', 'borrowed', 'overdue', 'movements', 'audit'

  if (type === 'inventory') {
    const docs = db.getDocuments().map((d) => {
      const dept = db.getDepartmentById(d.departmentId);
      const locPath = db.getLocationPath(d.currentLocationId);
      const holder = d.currentHolderId ? db.getUserById(d.currentHolderId) : null;
      return {
        Reference_Number: d.referenceNumber,
        Title_EN: `"${d.titleEn.replace(/"/g, '""')}"`,
        Title_AM: `"${d.titleAm.replace(/"/g, '""')}"`,
        Category: d.category,
        Old_Woreda: d.oldWoreda ? `"${d.oldWoreda}"` : '""',
        Old_Kebele: d.oldKebele ? `"${d.oldKebele}"` : '""',
        House_Number: d.houseNumber ? `"${d.houseNumber}"` : '""',
        Shelf_Number: d.shelfNumber ? `"${d.shelfNumber}"` : '""',
        Box_Number: d.boxNumber ? `"${d.boxNumber}"` : '""',
        Confidentiality: d.confidentiality,
        Status: d.status,
        Department: dept?.code || '',
        Location: `"${locPath.replace(/"/g, '""')}"`,
        Current_Holder: holder?.fullName || 'In Archive',
        Registration_Date: d.registrationDate.substring(0, 10),
      };
    });

    const headers = Object.keys(docs[0] || {}).join(',');
    const rows = docs.map((row) => Object.values(row).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="archivetrack_inventory.csv"');
    return res.send(`\uFEFF${headers}\n${rows}`);
  }

  if (type === 'overdue') {
    const overdueList = db
      .getRequests()
      .filter((r) => r.status === 'ISSUED' && new Date(r.requestedReturnDate).getTime() < Date.now())
      .map((r) => {
        const doc = db.getDocumentById(r.documentId);
        const reqUser = db.getUserById(r.requesterId);
        const dept = db.getDepartmentById(r.requestingDepartmentId);
        return {
          Request_Number: r.requestNumber,
          Document_Ref: doc?.referenceNumber || '',
          Document_Title: `"${doc?.titleEn?.replace(/"/g, '""') || ''}"`,
          Borrower_Name: reqUser?.fullName || '',
          Borrower_Email: reqUser?.email || '',
          Department: dept?.nameEn || '',
          Issued_Date: r.issuedDate || '',
          Due_Date: r.requestedReturnDate,
          Days_Overdue: Math.floor((Date.now() - new Date(r.requestedReturnDate).getTime()) / (1000 * 60 * 60 * 24)),
        };
      });

    if (overdueList.length === 0) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send('Request_Number,Document_Ref,Document_Title,Borrower_Name,Borrower_Email,Department,Issued_Date,Due_Date,Days_Overdue\n');
    }

    const headers = Object.keys(overdueList[0]).join(',');
    const rows = overdueList.map((row) => Object.values(row).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="archivetrack_overdue_files.csv"');
    return res.send(`\uFEFF${headers}\n${rows}`);
  }

  if (type === 'movements') {
    const movements = db.getMovements().map((m) => {
      const doc = db.getDocumentById(m.documentId);
      const actor = db.getUserById(m.actingUserId);
      return {
        Timestamp: m.timestamp,
        Movement_Type: m.movementType,
        Document_Ref: doc?.referenceNumber || '',
        Document_Title: `"${doc?.titleEn?.replace(/"/g, '""') || ''}"`,
        Previous_Shelf: m.previousShelfNumber || '',
        New_Shelf: m.newShelfNumber || '',
        Previous_Box: m.previousBoxNumber || '',
        New_Box: m.newBoxNumber || '',
        Actor: actor?.fullName || '',
        Reason: `"${m.reason.replace(/"/g, '""')}"`,
        Details: `"${(m.acknowledgmentDetails || '').replace(/"/g, '""')}"`,
      };
    });

    const headers = Object.keys(movements[0] || {}).join(',');
    const rows = movements.map((row) => Object.values(row).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="archivetrack_file_movements.csv"');
    return res.send(`\uFEFF${headers}\n${rows}`);
  }

  return res.status(400).json({ error: 'Invalid export type. Allowed: inventory, overdue, movements' });
});

// Admin Migration: Map legacy categories to Commercial & Resident, flag ambiguous records
apiRouter.post('/admin/migrate-categories', authMiddleware, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const result = db.migrateCategoriesAndLocations();
  logAudit(
    req.user!,
    'SYSTEM_MIGRATION',
    'SYSTEM',
    'CATEGORIES_AND_LOCATIONS',
    `Migration completed: ${result.migrated} migrated, ${result.ambiguous} ambiguous records flagged for admin review`,
    req
  );
  return res.json({
    success: true,
    message: `Migration completed successfully. ${result.migrated} document(s) categorized, ${result.ambiguous} ambiguous record(s) flagged for review.`,
    ...result,
  });
});

// ==========================================
// 10. AUDIT LOGS (Immutable)
// ==========================================

apiRouter.get('/audit-logs', authMiddleware, requireRole('ADMIN', 'AUDITOR'), (req: AuthenticatedRequest, res: Response) => {
  const { action, targetType } = req.query;
  let logs = db.getAuditLogs();

  if (action && typeof action === 'string' && action !== 'ALL') {
    logs = logs.filter((l) => l.action === action);
  }

  if (targetType && typeof targetType === 'string' && targetType !== 'ALL') {
    logs = logs.filter((l) => l.targetType === targetType);
  }

  return res.json({ auditLogs: logs });
});

// ==========================================
// 11. NOTIFICATIONS
// ==========================================

apiRouter.get('/notifications', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const notifs = db.getNotifications(req.user!.id);
  const unreadCount = notifs.filter((n) => !n.read).length;
  return res.json({ notifications: notifs, unreadCount });
});

apiRouter.put('/notifications/:id/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.markNotificationAsRead(id);
  return res.json({ success: true });
});

apiRouter.put('/notifications/mark-all-read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  db.markAllNotificationsAsRead(req.user!.id);
  return res.json({ success: true });
});

// Automated/Client-triggered check for return deadlines
apiRouter.get('/notifications/check-returns', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const allRequests = db.getRequests();
  const now = Date.now();
  let alertedCount = 0;

  // Filter requests that are currently ISSUED (in borrower custody)
  const issuedRequests = allRequests.filter((r) => r.status === 'ISSUED');

  // If regular employee, check their own borrowed files; if admin/officer, check all
  const targetRequests = user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER'
    ? issuedRequests.filter((r) => r.requesterId === user.id)
    : issuedRequests;

  const existingNotifs = db.getNotifications(user.id);
  const recentAlertCutoff = now - 12 * 60 * 60 * 1000; // 12 hours

  targetRequests.forEach((r, idx) => {
    const returnTime = new Date(r.requestedReturnDate).getTime();
    const isOverdue = returnTime < now;
    const isDueToday = !isOverdue && returnTime <= now + 24 * 60 * 60 * 1000;

    if (isOverdue || isDueToday) {
      // Check if user was already alerted for this request in the last 12 hours
      const alreadyAlerted = existingNotifs.some(
        (n) => n.link?.includes(r.id) && new Date(n.createdAt).getTime() > recentAlertCutoff
      );

      if (!alreadyAlerted) {
        const doc = db.getDocumentById(r.documentId);
        const titleEn = isOverdue ? 'Overdue Document Return Required' : 'Physical File Due for Return Today';
        const titleAm = isOverdue ? 'የመመለሻ ጊዜው ያለፈበት ሰነድ ማስጠንቀቂያ' : 'ሰነድ ዛሬ መመለስ አለበት';
        const messageEn = isOverdue
          ? `File "${doc?.titleEn || 'Archived File'}" (${doc?.referenceNumber || ''}) was due on ${new Date(r.requestedReturnDate).toLocaleDateString()}. Please return it immediately.`
          : `File "${doc?.titleEn || 'Archived File'}" (${doc?.referenceNumber || ''}) is due for return today by 5:00 PM.`;
        const messageAm = isOverdue
          ? `ሰነድ "${doc?.titleAm || ''}" (${doc?.referenceNumber || ''}) የመመለሻ ቀኑ ${new Date(r.requestedReturnDate).toLocaleDateString()} አልፏል። እባክዎ በአስቸኳይ ይመልሱ።`
          : `ሰነድ "${doc?.titleAm || ''}" (${doc?.referenceNumber || ''}) ዛሬ እስከ 11፡00 ሰዓት መመለስ አለበት።`;

        db.addNotification({
          id: `notif-check-ret-${now}-${idx}`,
          userId: user.id,
          titleEn,
          titleAm,
          messageEn,
          messageAm,
          type: isOverdue ? 'ALERT' : 'WARNING',
          read: false,
          link: `/requests?id=${r.id}`,
          createdAt: new Date().toISOString(),
        });
        alertedCount++;
      }
    }
  });

  return res.json({ alertedCount, checkedTotal: targetRequests.length });
});

// ==========================================
// 11. SYSTEM SETTINGS & ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================

// Get current System Settings (Return Policy & RBAC Matrix)
apiRouter.get('/settings', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const settings = db.getSettings();
  return res.json({ settings });
});

// Update System Settings (Return Policy & Role-Based Permissions)
apiRouter.put(
  '/settings',
  authMiddleware,
  requirePermission('manageSettings'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { returnPolicy, rolePermissions } = req.body;

      const current = db.getSettings();
      const updated = db.updateSettings({
        ...(returnPolicy && {
          returnPolicy: {
            ...current.returnPolicy,
            ...returnPolicy,
          },
        }),
        ...(rolePermissions && {
          rolePermissions: {
            ...current.rolePermissions,
            ...rolePermissions,
          },
        }),
        updatedBy: `${user.fullName} (${user.role})`,
      });

      logAudit(
        user,
        'SETTINGS_UPDATED',
        'SYSTEM_SETTINGS',
        updated.id,
        `Updated System Settings: Return Policy & Role-Based Access Control matrix modified.`,
        req
      );

      return res.json({
        success: true,
        message: 'System settings and RBAC permissions updated successfully.',
        settings: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update system settings.' });
    }
  }
);

// Reset System Settings and RBAC to baseline government standards
apiRouter.post(
  '/settings/reset',
  authMiddleware,
  requireRole('ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const reset = db.resetSettings();

      logAudit(
        user,
        'SETTINGS_RESET',
        'SYSTEM_SETTINGS',
        reset.id,
        `Reset System Settings & RBAC matrix to official Ethiopian Government Archive standards.`,
        req
      );

      return res.json({
        success: true,
        message: 'Settings and RBAC matrix restored to baseline government standards.',
        settings: reset,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to reset system settings.' });
    }
  }
);
