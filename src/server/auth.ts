import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db/store';
import { IUser, Role, PermissionKey } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'archivetrack_secure_session_secret_2026';
const TOKEN_EXPIRY = '24h';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export function generateToken(user: IUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Check cookie if available
  if (!token && (req as any).cookies && (req as any).cookies.archivetrack_token) {
    token = (req as any).cookies.archivetrack_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session token provided.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }

  const user = db.getUserById(decoded.id);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'User account is inactive or not found.' });
  }

  req.user = user;
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' lacks permission for this action. Required: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    }

    // Admins always have clearance as ultimate fallback
    if (req.user.role === 'ADMIN' || db.hasPermission(req.user.role, permission)) {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied: Your active role '${req.user.role}' lacks clearance for '${permission}'. Contact your Archive Administrator to adjust RBAC privileges.`,
      requiredPermission: permission,
    });
  };
}

export function logAudit(
  actor: IUser,
  action: string,
  targetType: string,
  targetId: string,
  details: string,
  req?: Request
) {
  const ip = req?.ip || req?.socket.remoteAddress || 'internal';
  db.addAuditLog({
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    actorId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    action,
    targetType,
    targetId,
    details,
    ipAddress: ip,
    timestamp: new Date().toISOString(),
  });
}
