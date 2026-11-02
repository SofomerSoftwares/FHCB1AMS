import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Plus,
  QrCode,
  MapPin,
  User,
  History,
  AlertTriangle,
  MoveRight,
  Printer,
  X,
  Send,
  Building,
  CheckCircle,
  Eye,
  Filter,
  RotateCcw,
  Edit,
  Tag,
  Home,
  Layers,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  RefreshCw,
  Wand2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  FileUp,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusBadge } from '../ui/StatusBadge';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';
import { safeJson } from '../../lib/apiUtils';
import {
  IDocument,
  IArchiveLocation,
  IDepartment,
  IUser,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
} from '../../types';

export const DocumentsView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { user, token, hasRole, logout } = useAuth();
  const { notify } = useNotification();

  const [documents, setDocuments] = useState<any[]>([]);
  const [locations, setLocations] = useState<IArchiveLocation[]>([]);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [staffUsers, setStaffUsers] = useState<IUser[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Initialize filters from URL query parameters to support bookmarking & refresh
  const getInitialParams = () => {
    if (typeof window === 'undefined') return {};
    const sp = new URLSearchParams(window.location.search);
    return {
      search: sp.get('search') || '',
      category: sp.get('category') || 'ALL',
      status: sp.get('status') || 'ALL',
      departmentId: sp.get('departmentId') || 'ALL',
      confidentiality: sp.get('confidentiality') || 'ALL',
      oldWoreda: sp.get('oldWoreda') || '',
      oldKebele: sp.get('oldKebele') || '',
      houseNumber: sp.get('houseNumber') || '',
      shelfNumber: sp.get('shelfNumber') || '',
      boxNumber: sp.get('boxNumber') || '',
      currentHolderId: sp.get('currentHolderId') || 'ALL',
      page: parseInt(sp.get('page') || '1', 10),
      limit: [10, 20, 25, 50, 100].includes(parseInt(sp.get('limit') || '20', 10))
        ? parseInt(sp.get('limit') || '20', 10)
        : 20,
    };
  };

  const initialParams = getInitialParams();

  // Search and Combined Filters state
  const [search, setSearch] = useState<string>(initialParams.search || '');
  const [category, setCategory] = useState<string>(initialParams.category || 'ALL');
  const [status, setStatus] = useState<string>(initialParams.status || 'ALL');
  const [departmentId, setDepartmentId] = useState<string>(initialParams.departmentId || 'ALL');
  const [confidentiality, setConfidentiality] = useState<string>(initialParams.confidentiality || 'ALL');
  const [oldWoreda, setOldWoreda] = useState<string>(initialParams.oldWoreda || '');
  const [oldKebele, setOldKebele] = useState<string>(initialParams.oldKebele || '');
  const [houseNumber, setHouseNumber] = useState<string>(initialParams.houseNumber || '');
  const [shelfNumber, setShelfNumber] = useState<string>(initialParams.shelfNumber || '');
  const [boxNumber, setBoxNumber] = useState<string>(initialParams.boxNumber || '');
  const [currentHolderId, setCurrentHolderId] = useState<string>(initialParams.currentHolderId || 'ALL');
  const [page, setPage] = useState<number>(initialParams.page || 1);
  const [limit, setLimit] = useState<number>(initialParams.limit || 20);

  // CSV Import State on Registration
  const [showCsvImportModal, setShowCsvImportModal] = useState<boolean>(false);
  const [csvInputMode, setCsvInputMode] = useState<'FILE' | 'TEXT'>('FILE');
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvRowsPreview, setCsvRowsPreview] = useState<any[]>([]);
  const [csvSummary, setCsvSummary] = useState<{ total: number; validCount: number; invalidCount: number }>({
    total: 0,
    validCount: 0,
    invalidCount: 0,
  });
  const [isImportingCsv, setIsImportingCsv] = useState<boolean>(false);
  const [csvImportSuccessMsg, setCsvImportSuccessMsg] = useState<string>('');
  const [csvImportErrorMsg, setCsvImportErrorMsg] = useState<string>('');

  // Modals state
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [docMovements, setDocMovements] = useState<any[]>([]);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showRelocateModal, setShowRelocateModal] = useState<boolean>(false);
  const [showReportMissingModal, setShowReportMissingModal] = useState<boolean>(false);
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [qrModalData, setQrModalData] = useState<any | null>(null);

  // Registration Form State (strictly COMMERCIAL or RESIDENT)
  const [registerForm, setRegisterForm] = useState({
    referenceNumber: '',
    titleEn: '',
    titleAm: '',
    description: '',
    category: 'COMMERCIAL' as DocumentCategory,
    departmentId: '',
    currentLocationId: '',
    oldWoreda: '',
    oldKebele: '',
    houseNumber: '',
    shelfNumber: '',
    boxNumber: '',
    documentDate: new Date().toISOString().substring(0, 10),
    confidentiality: 'INTERNAL',
    retentionDate: '',
    pageCount: 15,
    conditionNotes: '',
    tags: '',
  });

  // Auto-generate reference number state
  const [autoGenerateRef, setAutoGenerateRef] = useState<boolean>(true);
  const [refPrefixType, setRefPrefixType] = useState<'CATEGORY' | 'DEPARTMENT'>('CATEGORY');
  const [isGeneratingRef, setIsGeneratingRef] = useState<boolean>(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    titleEn: '',
    titleAm: '',
    description: '',
    category: 'COMMERCIAL' as DocumentCategory,
    oldWoreda: '',
    oldKebele: '',
    houseNumber: '',
    shelfNumber: '',
    boxNumber: '',
    confidentiality: 'INTERNAL',
    conditionNotes: '',
  });

  // Relocation State (with Shelf and Box delta tracking)
  const [relocateLocationId, setRelocateLocationId] = useState<string>('');
  const [relocateShelfNumber, setRelocateShelfNumber] = useState<string>('');
  const [relocateBoxNumber, setRelocateBoxNumber] = useState<string>('');
  const [relocateReason, setRelocateReason] = useState<string>('');

  const [missingNote, setMissingNote] = useState<string>('');

  const [requestPurpose, setRequestPurpose] = useState<string>('');
  const [requestReturnDate, setRequestReturnDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().substring(0, 10);
  });
  const [requestPriority, setRequestPriority] = useState<string>('NORMAL');

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  // Sync search state to URL query parameters
  const syncUrlParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (category !== 'ALL') sp.set('category', category);
    if (status !== 'ALL') sp.set('status', status);
    if (departmentId !== 'ALL') sp.set('departmentId', departmentId);
    if (confidentiality !== 'ALL') sp.set('confidentiality', confidentiality);
    if (oldWoreda) sp.set('oldWoreda', oldWoreda);
    if (oldKebele) sp.set('oldKebele', oldKebele);
    if (houseNumber) sp.set('houseNumber', houseNumber);
    if (shelfNumber) sp.set('shelfNumber', shelfNumber);
    if (boxNumber) sp.set('boxNumber', boxNumber);
    if (currentHolderId !== 'ALL') sp.set('currentHolderId', currentHolderId);
    if (limit !== 20) sp.set('limit', limit.toString());
    if (page > 1) sp.set('page', page.toString());

    const queryString = sp.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [
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
  ]);

  // Fetch list of documents via server-side combined query
  const fetchDocuments = useCallback(async () => {
    if (!token || token === 'null' || token === 'undefined') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorState(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search.trim());
      if (category !== 'ALL') params.append('category', category);
      if (status !== 'ALL') params.append('status', status);
      if (departmentId !== 'ALL') params.append('departmentId', departmentId);
      if (confidentiality !== 'ALL') params.append('confidentiality', confidentiality);
      if (oldWoreda) params.append('oldWoreda', oldWoreda.trim());
      if (oldKebele) params.append('oldKebele', oldKebele.trim());
      if (houseNumber) params.append('houseNumber', houseNumber.trim());
      if (shelfNumber) params.append('shelfNumber', shelfNumber.trim());
      if (boxNumber) params.append('boxNumber', boxNumber.trim());
      if (currentHolderId !== 'ALL') params.append('currentHolderId', currentHolderId);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/documents?${params.toString()}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (res.status === 401) {
        logout();
        return;
      }

      const { ok, data } = await safeJson<{ documents: any[]; total: number; error?: string }>(res);

      if (!ok) {
        setErrorState(data?.error || `Failed to fetch documents: HTTP ${res.status}`);
        return;
      }

      setDocuments(data.documents || []);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      setErrorState(err.message || 'Error loading records.');
    } finally {
      setLoading(false);
    }
  }, [
    token,
    logout,
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
  ]);

  // Fetch auxiliary locations, departments, and users
  const fetchAuxData = async () => {
    if (!token || token === 'null' || token === 'undefined') return;
    try {
      const [locRes, deptRes, userRes] = await Promise.all([
        fetch('/api/locations', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/departments', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (locRes.status === 401 || deptRes.status === 401 || userRes.status === 401) {
        logout();
        return;
      }

      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData.locations || []);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
        if (deptData.departments?.length > 0 && !registerForm.departmentId) {
          setRegisterForm((prev) => ({
            ...prev,
            departmentId: deptData.departments[0].id,
          }));
        }
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        setStaffUsers(userData.users || []);
      }
    } catch (err) {
      console.warn('Auxiliary data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    syncUrlParams();
  }, [fetchDocuments, syncUrlParams]);

  useEffect(() => {
    fetchAuxData();
  }, [token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('ALL');
    setStatus('ALL');
    setDepartmentId('ALL');
    setConfidentiality('ALL');
    setOldWoreda('');
    setOldKebele('');
    setHouseNumber('');
    setShelfNumber('');
    setBoxNumber('');
    setCurrentHolderId('ALL');
    setPage(1);
  };

  // When a location is selected in register form, auto-fill shelf & box coordinates
  const handleLocationChange = (locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    let inferredShelf = loc?.shelfNumber || '';
    let inferredBox = loc?.boxNumber || '';

    // If parent has shelf number
    if (!inferredShelf && loc?.parentId) {
      const parent = locations.find((l) => l.id === loc.parentId);
      if (parent?.shelfNumber) inferredShelf = parent.shelfNumber;
    }

    setRegisterForm((prev) => ({
      ...prev,
      currentLocationId: locationId,
      shelfNumber: prev.shelfNumber || inferredShelf,
      boxNumber: prev.boxNumber || inferredBox,
    }));
  };

  // View document details
  const handleOpenDetail = async (docId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSelectedDoc(data.document);
        setDocMovements(data.movements || []);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (doc: any) => {
    setSelectedDoc(doc);
    setEditForm({
      titleEn: doc.titleEn || '',
      titleAm: doc.titleAm || '',
      description: doc.description || '',
      category: (doc.category === 'RESIDENT' ? 'RESIDENT' : 'COMMERCIAL') as DocumentCategory,
      oldWoreda: doc.oldWoreda || '',
      oldKebele: doc.oldKebele || '',
      houseNumber: doc.houseNumber || '',
      shelfNumber: doc.shelfNumber || '',
      boxNumber: doc.boxNumber || '',
      confidentiality: doc.confidentiality || 'INTERNAL',
      conditionNotes: doc.conditionNotes || '',
    });
    setFormError('');
    setFormSuccess('');
    setShowEditModal(true);
  };

  // Fetch QR label
  const handleOpenQrLabel = async (docId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/documents/${docId}/qr`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQrModalData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-generate official Ethiopian archival reference number
  const handleAutoGenerateRef = async (
    categoryOverride?: DocumentCategory,
    prefixTypeOverride?: 'CATEGORY' | 'DEPARTMENT',
    deptOverride?: string
  ) => {
    setIsGeneratingRef(true);
    try {
      const cat = categoryOverride || registerForm.category;
      const pType = prefixTypeOverride || refPrefixType;
      const deptId = deptOverride !== undefined ? deptOverride : registerForm.departmentId;
      const year = new Date().getFullYear();

      const params = new URLSearchParams({
        category: cat,
        prefixType: pType,
        year: year.toString(),
      });
      if (deptId && pType === 'DEPARTMENT') {
        params.set('departmentId', deptId);
      }

      const res = await fetch(`/api/documents/generate-ref?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRegisterForm((prev) => ({
          ...prev,
          referenceNumber: data.referenceNumber,
        }));
      }
    } catch (err) {
      console.error('Failed to auto-generate reference number:', err);
    } finally {
      setIsGeneratingRef(false);
    }
  };

  const handleOpenRegisterModal = () => {
    setFormError('');
    setFormSuccess('');
    setShowRegisterModal(true);
    if (!registerForm.referenceNumber || autoGenerateRef) {
      handleAutoGenerateRef(registerForm.category, refPrefixType);
    }
  };

  // Register physical document
  const handleRegisterDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    let refToSubmit = registerForm.referenceNumber.trim();
    if (!refToSubmit) {
      refToSubmit = 'AUTO';
    }

    if (!registerForm.titleEn || !registerForm.titleAm) {
      setFormError('English title and Amharic title are required.');
      return;
    }

    if (!registerForm.currentLocationId) {
      setFormError('Please select a storage box or shelf location.');
      return;
    }

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...registerForm,
          referenceNumber: refToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to register document.');
        return;
      }

      setFormSuccess(
        `Physical document registered successfully [${data.document?.referenceNumber || refToSubmit}].`
      );
      setTimeout(() => {
        setShowRegisterModal(false);
        fetchDocuments();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Network error.');
    }
  };

  // Download Standardized CSV Template
  const handleDownloadTemplate = () => {
    const csvContent =
      `\uFEFF` +
      `referenceNumber,category,titleEn,titleAm,departmentCode,locationCode,shelfNumber,boxNumber,oldWoreda,oldKebele,houseNumber,confidentiality,documentDate,description,pageCount,conditionNotes,tags\r\n` +
      `AUTO,COMMERCIAL,Commercial Business Registry Certificate,የንግድ ድርጅት ምዝገባ ምስክር ወረቀት,FIN,BOX-12,02,012,03,12,045,CONFIDENTIAL,2024-05-10,Commercial tax and charter registration file,45,Archived in secure folder,"Commercial,Business,Audit"\r\n` +
      `AUTO,RESIDENT,Historical Kebele Landholding Title Deed,የቀበሌ ነዋሪነት እና የመሬት ይዞታ ማረጋገጫ,DOC-ARCH,BOX-015,05,015,04,08,102A,INTERNAL,2023-11-20,Original resident residential deed and title agreement,28,Preserved parchment with official seal,"Resident,Kebele,Land"\r\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'FHC_Branch_One_Registration_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Client-side CSV Text Parser
  const parseCsvTextClient = (text: string): Array<Record<string, string>> => {
    const cleaned = text.replace(/^\uFEFF/, '').trim();
    if (!cleaned) return [];

    const lines: string[] = [];
    let curLine = '';
    let insideQuote = false;

    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      const nc = cleaned[i + 1];
      if (c === '"') {
        if (insideQuote && nc === '"') {
          curLine += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if ((c === '\n' || (c === '\r' && nc === '\n')) && !insideQuote) {
        lines.push(curLine);
        curLine = '';
        if (c === '\r') i++;
      } else if (c === '\r' && !insideQuote) {
        lines.push(curLine);
        curLine = '';
      } else {
        curLine += c;
      }
    }
    if (curLine.trim()) lines.push(curLine);

    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const cols: string[] = [];
      let col = '';
      let inside = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const nch = line[i + 1];
        if (ch === '"') {
          if (inside && nch === '"') {
            col += '"';
            i++;
          } else {
            inside = !inside;
          }
        } else if (ch === ',' && !inside) {
          cols.push(col.trim());
          col = '';
        } else {
          col += ch;
        }
      }
      cols.push(col.trim());
      return cols;
    };

    const headers = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const result: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        let val = values[idx] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        row[h] = val.trim();
      });
      result.push(row);
    }

    return result;
  };

  // Validate Parsed Rows
  const validateParsedRows = (rawRows: Array<Record<string, any>>) => {
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

    const seenRefs = new Set<string>();
    const items = rawRows.map((row, index) => {
      const rawCat = getVal(row, 'category', 'documentCategory', 'type');
      let cat: 'COMMERCIAL' | 'RESIDENT' | null = null;
      const upperCat = rawCat.toUpperCase().trim();
      if (['COMMERCIAL', 'COMMERCE', 'COM', 'ንግድ'].includes(upperCat)) {
        cat = 'COMMERCIAL';
      } else if (['RESIDENT', 'RESIDENTIAL', 'RES', 'ነዋሪ'].includes(upperCat)) {
        cat = 'RESIDENT';
      }

      const titleEn = getVal(row, 'titleEn', 'title', 'title_en');
      const titleAm = getVal(row, 'titleAm', 'amharicTitle', 'title_am') || titleEn;
      const deptCode = getVal(row, 'departmentCode', 'departmentId', 'department', 'dept');
      const locCode = getVal(row, 'locationCode', 'locationId', 'location', 'loc');
      const shelfNumber = getVal(row, 'shelfNumber', 'shelf', 'shelf_number');
      const boxNumber = getVal(row, 'boxNumber', 'box', 'box_number');
      const oldWoreda = getVal(row, 'oldWoreda', 'woreda', 'old_woreda');
      const oldKebele = getVal(row, 'oldKebele', 'kebele', 'old_kebele');
      const houseNumber = getVal(row, 'houseNumber', 'houseNo', 'house_number');
      const rawRef = getVal(row, 'referenceNumber', 'refNumber', 'ref');
      const isAutoRef = !rawRef || rawRef.toUpperCase() === 'AUTO';

      let valid = true;
      let error = '';

      if (!cat) {
        valid = false;
        error = `Invalid category '${rawCat}'. Must be COMMERCIAL or RESIDENT.`;
      } else if (!titleEn) {
        valid = false;
        error = 'English Title (titleEn) is required.';
      } else if (!isAutoRef) {
        if (seenRefs.has(rawRef.toUpperCase())) {
          valid = false;
          error = `Duplicate reference '${rawRef}' in batch.`;
        } else {
          seenRefs.add(rawRef.toUpperCase());
        }
      }

      return {
        index: index + 1,
        valid,
        error,
        row,
        preview: {
          referenceNumber: isAutoRef ? 'AUTO (Sequential)' : rawRef,
          category: cat || rawCat || 'UNKNOWN',
          titleEn,
          titleAm,
          departmentCode: deptCode || 'DEFAULT',
          locationCode: locCode || 'DEFAULT',
          shelfNumber,
          boxNumber,
          oldWoreda,
          oldKebele,
          houseNumber,
          isAutoRef,
        },
      };
    });

    const validCount = items.filter((i) => i.valid).length;
    const invalidCount = items.length - validCount;

    setCsvRowsPreview(items);
    setCsvSummary({
      total: items.length,
      validCount,
      invalidCount,
    });
  };

  // Handle File Input Selection
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvImportErrorMsg('');
    setCsvImportSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawCsvText(content);
      const parsed = parseCsvTextClient(content);
      if (parsed.length === 0) {
        setCsvImportErrorMsg('No valid rows found in the selected CSV file.');
        setCsvRowsPreview([]);
        setCsvSummary({ total: 0, validCount: 0, invalidCount: 0 });
        return;
      }
      validateParsedRows(parsed);
    };
    reader.readAsText(file);
  };

  // Handle Raw Text Parse
  const handleParseRawText = () => {
    setCsvImportErrorMsg('');
    setCsvImportSuccessMsg('');
    if (!rawCsvText.trim()) {
      setCsvImportErrorMsg('Please paste CSV text first.');
      return;
    }
    const parsed = parseCsvTextClient(rawCsvText);
    if (parsed.length === 0) {
      setCsvImportErrorMsg('No valid rows could be parsed. Ensure headers and commas are present.');
      setCsvRowsPreview([]);
      setCsvSummary({ total: 0, validCount: 0, invalidCount: 0 });
      return;
    }
    validateParsedRows(parsed);
  };

  // Execute Batch CSV Import via API
  const handleExecuteCsvImport = async () => {
    const validRowsToImport = csvRowsPreview.filter((r) => r.valid).map((r) => r.row);
    if (validRowsToImport.length === 0) {
      setCsvImportErrorMsg('No valid documents to import. Please resolve validation errors.');
      return;
    }

    setIsImportingCsv(true);
    setCsvImportErrorMsg('');
    setCsvImportSuccessMsg('');

    try {
      const res = await fetch('/api/documents/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rows: validRowsToImport,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCsvImportErrorMsg(data.error || 'Failed to import documents from CSV.');
        return;
      }

      setCsvImportSuccessMsg(
        isAmharic
          ? `${data.importedCount} ሰነዶች በተሳካ ሁኔታ ተመዝግበዋል!`
          : `Successfully registered ${data.importedCount} physical documents via CSV!`
      );

      // Auto-refresh document list
      fetchDocuments();

      setTimeout(() => {
        setShowCsvImportModal(false);
        setCsvRowsPreview([]);
        setRawCsvText('');
        setCsvFileName('');
      }, 1800);
    } catch (err: any) {
      setCsvImportErrorMsg(err.message || 'Network error during CSV import.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleOpenCsvImportModal = () => {
    setCsvImportErrorMsg('');
    setCsvImportSuccessMsg('');
    setCsvRowsPreview([]);
    setRawCsvText('');
    setCsvFileName('');
    setCsvSummary({ total: 0, validCount: 0, invalidCount: 0 });
    setShowCsvImportModal(true);
  };

  // Save Document Metadata Changes
  const handleEditDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    setFormError('');
    setFormSuccess('');

    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update document.');
        return;
      }

      setFormSuccess('Document updated successfully.');
      setTimeout(() => {
        setShowEditModal(false);
        fetchDocuments();
        if (showDetailModal) {
          handleOpenDetail(selectedDoc.id);
        }
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Network error.');
    }
  };

  // Open Fast Request Modal with prefilled defaults
  const handleOpenFastRequest = (doc: any) => {
    setSelectedDoc(doc);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setRequestReturnDate(d.toISOString().substring(0, 10));
    setRequestPriority('NORMAL');
    if (!requestPurpose) {
      setRequestPurpose('Official Directorate Review');
    }
    setFormError('');
    setFormSuccess('');
    setShowRequestModal(true);
  };

  // Submit request for document
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedDoc) return;
    if (!requestPurpose) {
      setFormError('Business purpose is required.');
      return;
    }

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: selectedDoc.id,
          purpose: requestPurpose,
          requestedReturnDate: new Date(requestReturnDate).toISOString(),
          priority: requestPriority,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to submit request.');
        return;
      }

      setFormSuccess(`Request ${data.request?.requestNumber} submitted for manager review.`);
      notify({
        titleEn: 'Document Request Submitted',
        titleAm: 'የሰነድ ጥያቄ ተመዝግቧል',
        messageEn: `Request ${data.request?.requestNumber} for "${selectedDoc.titleEn}" submitted. Manager and Archive Officers alerted.`,
        messageAm: `ለሰነድ "${selectedDoc.titleAm}" ያቀረቡት ጥያቄ ${data.request?.requestNumber} ተመዝግቧል። ለኃላፊዎች ማሳወቂያ ተልኳል።`,
        type: 'SUCCESS',
        sound: true,
      });
      setTimeout(() => {
        setShowRequestModal(false);
        setShowDetailModal(false);
        fetchDocuments();
      }, 1500);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Open Relocate Modal with prefilled shelf and box from target
  const handleOpenRelocate = (doc: any) => {
    setSelectedDoc(doc);
    setRelocateLocationId(doc.currentLocationId || '');
    setRelocateShelfNumber(doc.shelfNumber || '');
    setRelocateBoxNumber(doc.boxNumber || '');
    setRelocateReason('');
    setShowRelocateModal(true);
  };

  const handleRelocateTargetChange = (locationId: string) => {
    setRelocateLocationId(locationId);
    const loc = locations.find((l) => l.id === locationId);
    if (loc) {
      let inferredShelf = loc.shelfNumber || '';
      if (!inferredShelf && loc.parentId) {
        const parent = locations.find((l) => l.id === loc.parentId);
        if (parent?.shelfNumber) inferredShelf = parent.shelfNumber;
      }
      setRelocateShelfNumber(inferredShelf);
      setRelocateBoxNumber(loc.boxNumber || '');
    }
  };

  // Relocate document
  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !relocateLocationId) return;

    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/relocate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newLocationId: relocateLocationId,
          newShelfNumber: relocateShelfNumber,
          newBoxNumber: relocateBoxNumber,
          reason: relocateReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowRelocateModal(false);
        handleOpenDetail(selectedDoc.id);
        fetchDocuments();
      } else {
        alert(data.error || 'Relocation failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Report missing file
  const handleReportMissingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;

    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: selectedDoc.id,
          initialNote: missingNote,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowReportMissingModal(false);
        setShowDetailModal(false);
        fetchDocuments();
        alert('Missing file formal investigation initiated.');
      } else {
        alert(data.error || 'Failed to file report.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate active filter count
  const activeFilterCount = [
    category !== 'ALL',
    status !== 'ALL',
    departmentId !== 'ALL',
    confidentiality !== 'ALL',
    Boolean(oldWoreda),
    Boolean(oldKebele),
    Boolean(houseNumber),
    Boolean(shelfNumber),
    Boolean(boxNumber),
    currentHolderId !== 'ALL',
    Boolean(search),
  ].filter(Boolean).length;

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header and action bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {t('nav.documents')}
            </h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {totalCount} {isAmharic ? 'ሰነዶች' : 'Files'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAmharic
              ? 'የመንግስት አካላዊ ሰነዶች፣ የቀድሞ አድራሻ መረጃዎች (ወረዳ/ቀበሌ/ቤት ቁጥር) እና የማከማቻ መደርደሪያ/ሳጥን መዝገብ'
              : 'Physical government archive registry, historical addresses (Woreda/Kebele/House #), and Shelf/Box storage.'}
          </p>
        </div>

        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenCsvImportModal}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
              title={isAmharic ? 'የሰነዶች የጅምላ CSV ማስመጫ' : 'Batch Register Physical Documents via CSV'}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>{t('importCsv.button')}</span>
            </button>
            <button
              onClick={handleOpenRegisterModal}
              className="inline-flex items-center space-x-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
            >
              <Plus className="h-4 w-4" />
              <span>{t('actions.newDocument')}</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* COMBINED SEARCH & FILTER PANEL */}
      {/* ========================================================= */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          {/* Main Search Row */}
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isAmharic
                    ? 'በንብረት መለያ ቁጥር (Property ID)፣ በርዕስ፣ በአድራሻ፣ በመደርደሪያ ወይም በሳጥን ፈልግ...'
                    : 'Search by Property ID, title, address, shelf, box, tags...'
                }
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-xs placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                {isAmharic ? 'ፈልግ' : 'Search'}
              </button>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center space-x-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  title="Clear All Filters"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>{isAmharic ? 'አጽዳ' : 'Clear'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Combined Filters Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 border-t border-slate-100 pt-3">
            {/* 1. Category Filter (COMMERCIAL or RESIDENT only) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.category')}
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-emerald-600 focus:outline-none"
              >
                <option value="ALL">{isAmharic ? 'ሁሉም ምድቦች' : 'All Categories'}</option>
                <option value="COMMERCIAL">
                  {isAmharic ? 'ንግድ (Commercial)' : 'Commercial'}
                </option>
                <option value="RESIDENT">
                  {isAmharic ? 'ነዋሪ (Resident)' : 'Resident'}
                </option>
              </select>
            </div>

            {/* 2. Old Woreda Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.oldWoreda')}
              </label>
              <input
                type="text"
                value={oldWoreda}
                onChange={(e) => {
                  setOldWoreda(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 03 or 3"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* 3. Old Kebele Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.oldKebele')}
              </label>
              <input
                type="text"
                value={oldKebele}
                onChange={(e) => {
                  setOldKebele(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 12"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* 4. House Number Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.houseNumber')}
              </label>
              <input
                type="text"
                value={houseNumber}
                onChange={(e) => {
                  setHouseNumber(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 045 or 118/A"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* 5. Shelf Number Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.shelfNumber')}
              </label>
              <input
                type="text"
                value={shelfNumber}
                onChange={(e) => {
                  setShelfNumber(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 05 or 02"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* 6. Box Number Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.boxNumber')}
              </label>
              <input
                type="text"
                value={boxNumber}
                onChange={(e) => {
                  setBoxNumber(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 012"
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Secondary Row: Department, Status, Holder */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 border-t border-slate-100 pt-3">
            {/* 7. Department Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.department')}
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
              >
                <option value="ALL">{isAmharic ? 'ሁሉም የስራ ክፍሎች' : 'All Departments'}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {isAmharic ? d.nameAm : d.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* 8. Status Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.status')}
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
              >
                <option value="ALL">{isAmharic ? 'ሁሉም ሁኔታዎች' : 'All Statuses'}</option>
                <option value="AVAILABLE">{t('status.AVAILABLE')}</option>
                <option value="BORROWED">{t('status.BORROWED')}</option>
                <option value="RESERVED">{t('status.RESERVED')}</option>
                <option value="UNDER_INVESTIGATION">{t('status.UNDER_INVESTIGATION')}</option>
                <option value="MISSING">{t('status.MISSING')}</option>
              </select>
            </div>

            {/* 9. Current Holder Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {t('document.holder')}
              </label>
              <select
                value={currentHolderId}
                onChange={(e) => {
                  setCurrentHolderId(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
              >
                <option value="ALL">{isAmharic ? 'ሁሉም ሰነድ ያዦች' : 'All Holders / In Archive'}</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Results Header with Active Count & Quick Reset */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          <span>
            {isAmharic
              ? `ከ ${totalCount} ሰነዶች ውስጥ ${documents.length} ተገኝተዋል (ገጽ ${page} ከ ${totalPages})`
              : `Showing ${documents.length} of ${totalCount} matching records (Page ${page} of ${totalPages})`}
          </span>
        </div>
        {activeFilterCount > 0 && (
          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Filter className="h-3 w-3 text-emerald-600" />
            <span>{activeFilterCount} active filter(s) combined</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* DOCUMENTS TABLE */}
      {/* ========================================================= */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mb-2"></div>
            <p>{isAmharic ? 'ሰነዶች በመጫን ላይ ናቸው...' : 'Loading archival records from server...'}</p>
          </div>
        ) : errorState ? (
          <div className="p-8 text-center text-rose-600 text-xs">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
            <p className="font-semibold">{errorState}</p>
            <button
              onClick={fetchDocuments}
              className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {isAmharic ? 'ምንም የሚመሳሰል ሰነድ አልተገኘም' : 'No matching physical documents found'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isAmharic
                ? 'የተመረጡትን ማጣሪያዎች (ምድብ፣ ወረዳ፣ ቀበሌ፣ መደርደሪያ) በመቀየር ደግመው ይሞክሩ።'
                : 'Try adjusting your combined filters (Category, Woreda, Kebele, Shelf, Box).'}
            </p>
            <button
              onClick={handleClearFilters}
              className="mt-3 inline-flex items-center space-x-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear Filters</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t('document.refNumber')}</th>
                  <th className="px-4 py-3">{t('document.title')}</th>
                  <th className="px-4 py-3">{t('document.category')}</th>
                  <th className="px-4 py-3">Physical Coordinates</th>
                  <th className="px-4 py-3">Historical Address</th>
                  <th className="px-4 py-3">{t('document.holder')}</th>
                  <th className="px-4 py-3">{t('document.status')}</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc, idx) => {
                  const isCommercial = doc.category === 'COMMERCIAL';
                  return (
                    <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/80 transition">
                      {/* Ref & Dept */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {doc.referenceNumber}
                        <span className="block text-[10px] text-slate-400 font-sans font-normal">
                          {doc.department?.code}
                        </span>
                      </td>

                      {/* Titles */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-semibold text-slate-900 line-clamp-1">{doc.titleEn}</p>
                        <p className="text-[11px] text-slate-600 line-clamp-1 font-amharic">
                          {doc.titleAm}
                        </p>
                      </td>

                      {/* Primary Category: Commercial vs Resident */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            isCommercial
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {isCommercial
                            ? isAmharic
                              ? 'ንግድ'
                              : 'Commercial'
                            : isAmharic
                            ? 'ነዋሪ'
                            : 'Resident'}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {t(`confidentiality.${doc.confidentiality}`)}
                        </span>
                      </td>

                      {/* Physical Coordinates (Shelf & Box) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="inline-flex items-center rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800 border border-slate-200"
                            title="Shelf Number"
                          >
                            SH: {doc.shelfNumber || '-'}
                          </span>
                          <span
                            className="inline-flex items-center rounded-sm bg-amber-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 border border-amber-200"
                            title="Box Number"
                          >
                            BX: {doc.boxNumber || '-'}
                          </span>
                        </div>
                        <span
                          className="block text-[10px] text-slate-500 truncate max-w-[180px] mt-0.5"
                          title={doc.location?.fullPath}
                        >
                          {doc.location?.nameEn || 'Vault'}
                        </span>
                      </td>

                      {/* Historical Address: Woreda, Kebele, House # */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {doc.oldWoreda || doc.oldKebele || doc.houseNumber ? (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-semibold text-slate-900">
                              W:{doc.oldWoreda || '-'} / K:{doc.oldKebele || '-'}
                            </span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              H.No: {doc.houseNumber || '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">No historical addr</span>
                        )}
                      </td>

                      {/* Current Custodian */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {doc.holder ? (
                          <span className="inline-flex items-center text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200 text-[11px]">
                            <User className="h-3 w-3 mr-1" />
                            {doc.holder.fullName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            {isAmharic ? 'በማከማቻ ውስጥ' : 'In Storage'}
                          </span>
                        )}
                      </td>

                      {/* Operational Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={doc.status} />
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Fast Request Link / Action */}
                          {doc.status === 'AVAILABLE' && (
                            <button
                              onClick={() => handleOpenFastRequest(doc)}
                              className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 border border-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition shadow-2xs"
                              title={isAmharic ? 'ፈጣን የሰነድ ጥያቄ አቅርብ' : 'Fast Request this file'}
                            >
                              <Zap className="h-3.5 w-3.5 text-emerald-600 fill-emerald-500" />
                              <span>{isAmharic ? 'ፈጣን ጥያቄ' : 'Fast Request'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenDetail(doc.id)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition"
                            title="View Full File Record & Movement Timeline"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
                            <button
                              onClick={() => handleOpenEdit(doc)}
                              className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition"
                              title="Edit Metadata & Coordinates"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenQrLabel(doc.id)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition"
                            title="Generate Official QR Archival Jacket Label"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Enhanced Pagination Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 bg-slate-50/90 px-4 py-3 text-xs">
          {/* Left: Range and Page Size selector */}
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span>
              {isAmharic ? (
                <>
                  ከ <span className="font-bold text-slate-900">{totalCount}</span> ሰነዶች ውስጥ{' '}
                  <span className="font-bold text-slate-900">
                    {totalCount === 0 ? 0 : (page - 1) * limit + 1}
                  </span>{' '}
                  -{' '}
                  <span className="font-bold text-slate-900">
                    {Math.min(page * limit, totalCount)}
                  </span>{' '}
                  በመታየት ላይ
                </>
              ) : (
                <>
                  Showing{' '}
                  <span className="font-bold text-slate-900">
                    {totalCount === 0 ? 0 : (page - 1) * limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-slate-900">
                    {Math.min(page * limit, totalCount)}
                  </span>{' '}
                  of <span className="font-bold text-slate-900">{totalCount}</span> documents
                </>
              )}
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-300">
              <label htmlFor="pageSizeSelect" className="text-[11px] text-slate-500 font-medium">
                {t('pagination.rowsPerPage')}
              </label>
              <select
                id="pageSizeSelect"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-600 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Right: Navigation Buttons */}
          <div className="flex items-center space-x-1 self-end sm:self-auto">
            {/* First Page */}
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title={t('pagination.first')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            {/* Previous Page */}
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title={t('pagination.previous')}
              className="inline-flex items-center space-x-1 h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pagination.previous')}</span>
            </button>

            {/* Page Number Chips */}
            <div className="flex items-center space-x-1 px-1">
              {(() => {
                const maxButtons = 5;
                let startPage = Math.max(1, page - 2);
                let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                if (endPage - startPage < maxButtons - 1) {
                  startPage = Math.max(1, endPage - maxButtons + 1);
                }

                const pagesArr: number[] = [];
                for (let i = startPage; i <= endPage; i++) {
                  pagesArr.push(i);
                }

                return pagesArr.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`h-8 w-8 rounded-md text-xs font-bold transition ${
                      pageNum === page
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
            </div>

            {/* Next Page */}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title={t('pagination.next')}
              className="inline-flex items-center space-x-1 h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <span className="hidden sm:inline">{t('pagination.next')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Last Page */}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              title={t('pagination.last')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. DOCUMENT DETAIL & MOVEMENT TIMELINE MODAL */}
      {/* ========================================================= */}
      {showDetailModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="font-mono text-sm font-bold text-slate-900">
                {selectedDoc.referenceNumber}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                  selectedDoc.category === 'COMMERCIAL'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                <Tag className="h-3 w-3 mr-1" />
                {selectedDoc.category === 'COMMERCIAL'
                  ? isAmharic
                    ? 'ንግድ (Commercial)'
                    : 'Commercial'
                  : isAmharic
                  ? 'ነዋሪ (Resident)'
                  : 'Resident'}
              </span>
              <StatusBadge status={selectedDoc.status} />
              <StatusBadge status={selectedDoc.confidentiality} />
            </div>

            <h3 className="mt-2 text-lg font-bold text-slate-900">{selectedDoc.titleEn}</h3>
            <p className="text-sm font-semibold text-slate-600 font-amharic">
              {selectedDoc.titleAm}
            </p>

            {/* Fast Request Banner */}
            {selectedDoc.status === 'AVAILABLE' && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-300 p-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                    <Zap className="h-4 w-4 text-emerald-600 fill-emerald-500" />
                    <span>{isAmharic ? 'ይህ ሰነድ ዝግጁ ነው' : 'This Document is Available for Custody'}</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    {isAmharic
                      ? 'የማህደር ሰነዱን በአፋጣኝ ለመጠየቅ ከዚህ በታች ያለውን ፈጣን ጥያቄ ይጫኑ።'
                      : 'Need access to this official record? Request physical handover now.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenFastRequest(selectedDoc);
                  }}
                  className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs flex items-center space-x-1.5 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isAmharic ? 'ፈጣን ጥያቄ አቅርብ' : 'Fast Request Now'}</span>
                </button>
              </div>
            )}

            {/* Physical Storage & Historical Address Highlights */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Storage Coordinates */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center">
                  <Archive className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                  Physical File Location
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="rounded-md bg-white border border-slate-300 px-2 py-1 font-mono text-xs font-bold text-slate-800">
                    Shelf #: {selectedDoc.shelfNumber || 'N/A'}
                  </span>
                  <span className="rounded-md bg-white border border-slate-300 px-2 py-1 font-mono text-xs font-bold text-amber-900">
                    Box #: {selectedDoc.boxNumber || 'N/A'}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 truncate" title={selectedDoc.location?.fullPath}>
                  <MapPin className="h-3 w-3 inline mr-1 text-slate-400" />
                  {selectedDoc.location?.fullPath || 'Archive Vault'}
                </p>
              </div>

              {/* Historical Address Details */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center">
                  <Home className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Historical Address Coordinates
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-white border border-slate-200 p-1.5">
                    <span className="block text-[10px] text-slate-400 font-bold">Old Woreda</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedDoc.oldWoreda || '-'}
                    </span>
                  </div>
                  <div className="rounded-md bg-white border border-slate-200 p-1.5">
                    <span className="block text-[10px] text-slate-400 font-bold">Old Kebele</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedDoc.oldKebele || '-'}
                    </span>
                  </div>
                  <div className="rounded-md bg-white border border-slate-200 p-1.5">
                    <span className="block text-[10px] text-slate-400 font-bold">House No.</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedDoc.houseNumber || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Custodian Banner if Borrowed */}
            {selectedDoc.holder && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">
                  {isAmharic ? 'የአሁኑ ሰነድ ያዥ:' : 'Current Custodian:'}
                </span>
                <span className="font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-sm border border-amber-300">
                  {selectedDoc.holder.fullName} ({selectedDoc.holder.email})
                </span>
              </div>
            )}

            {/* Additional Details */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-medium">{t('document.department')}:</span>
                <p className="font-semibold text-slate-800">
                  {selectedDoc.department?.code} - {isAmharic ? selectedDoc.department?.nameAm : selectedDoc.department?.nameEn}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">{t('document.date')}:</span>
                <p className="font-semibold text-slate-800">
                  {formatBilingualDate(selectedDoc.documentDate, locale)}
                </p>
              </div>
            </div>

            {selectedDoc.description && (
              <div className="mt-3">
                <span className="text-xs font-medium text-slate-400">Description:</span>
                <p className="mt-0.5 text-xs text-slate-700 bg-white p-2.5 rounded-md border border-slate-100">
                  {selectedDoc.description}
                </p>
              </div>
            )}

            {selectedDoc.conditionNotes && (
              <div className="mt-2 text-xs text-slate-600 italic bg-amber-50/50 p-2 rounded border border-amber-100">
                Condition / Notes: {selectedDoc.conditionNotes}
              </div>
            )}

            {/* Movement Timeline with Shelf & Box Delta */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                <History className="h-4 w-4 mr-1.5 text-blue-600" />
                {t('actions.viewHistory')} (Immutable Physical Custody & Location Ledger)
              </h4>

              <div className="mt-3 space-y-3 max-h-52 overflow-y-auto pr-1">
                {docMovements.length === 0 ? (
                  <p className="text-xs text-slate-400">No previous movements recorded.</p>
                ) : (
                  docMovements.map((m) => (
                    <div key={m.id} className="relative pl-5 border-l-2 border-emerald-600 pb-2">
                      <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-emerald-600"></div>
                      <div className="flex items-center justify-between text-[11px]">
                        <StatusBadge status={m.movementType} size="sm" />
                        <span className="text-slate-400 font-mono">
                          {formatBilingualDate(m.timestamp, locale)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-800">{m.reason}</p>
                      {(m.newShelfNumber || m.newBoxNumber) && (
                        <p className="text-[10px] text-blue-700 font-mono font-medium">
                          Shelf: {m.previousShelfNumber || '-'} → {m.newShelfNumber || '-'} | Box:{' '}
                          {m.previousBoxNumber || '-'} → {m.newBoxNumber || '-'}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        {m.acknowledgmentDetails} • Officer: <span className="font-semibold">{m.actorName}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons in Modal */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleOpenQrLabel(selectedDoc.id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{t('actions.printLabel')}</span>
                </button>

                {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenEdit(selectedDoc);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit Metadata</span>
                  </button>
                )}

                {hasRole('ADMIN', 'ARCHIVE_OFFICER') && selectedDoc.status !== 'BORROWED' && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenRelocate(selectedDoc);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1"
                  >
                    <MoveRight className="h-3.5 w-3.5" />
                    <span>{t('actions.relocate')}</span>
                  </button>
                )}

                {hasRole('ADMIN', 'ARCHIVE_OFFICER') &&
                  selectedDoc.status !== 'MISSING' &&
                  selectedDoc.status !== 'UNDER_INVESTIGATION' && (
                    <button
                      onClick={() => setShowReportMissingModal(true)}
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center space-x-1"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{t('actions.reportMissing')}</span>
                    </button>
                  )}
              </div>

              {selectedDoc.status === 'AVAILABLE' && (
                <button
                  onClick={() => {
                    setRequestPurpose('');
                    setFormError('');
                    setFormSuccess('');
                    setShowRequestModal(true);
                  }}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 flex items-center space-x-1.5 shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{t('actions.newRequest')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PRINTABLE OFFICIAL ARCHIVAL QR LABEL MODAL */}
      {/* ========================================================= */}
      {qrModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-300 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setQrModalData(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Official Label Sheet Card */}
            <div
              id="printable-label"
              className="rounded-lg border-2 border-slate-900 p-4 bg-white text-slate-900 text-center"
            >
              <div className="border-b border-slate-300 pb-2">
                <p className="text-[10px] font-black tracking-wider uppercase text-slate-800">
                  Federal Democratic Republic of Ethiopia
                </p>
                <p className="text-[9px] font-bold text-slate-600 font-amharic">
                  የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ ብሔራዊ ማህደር
                </p>
                <p className="text-[10px] font-bold text-emerald-800 mt-0.5">
                  {qrModalData.document.departmentName}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-center">
                <img
                  src={qrModalData.qrDataUrl}
                  alt="Document QR Code"
                  className="h-36 w-36 border border-slate-300 p-1 rounded-sm"
                />
              </div>

              <p className="mt-2 font-mono text-xs font-black tracking-wider">
                {qrModalData.document.referenceNumber}
              </p>

              <div className="mt-1 flex items-center justify-center space-x-2">
                <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                  {qrModalData.document.category}
                </span>
                <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Shelf: {qrModalData.document.shelfNumber || 'N/A'} | Box:{' '}
                  {qrModalData.document.boxNumber || 'N/A'}
                </span>
              </div>

              <p className="mt-2 text-xs font-bold line-clamp-1">{qrModalData.document.titleEn}</p>
              <p className="text-[11px] font-semibold text-slate-700 font-amharic line-clamp-1">
                {qrModalData.document.titleAm}
              </p>

              {/* Historical Address Box in Label */}
              {(qrModalData.document.oldWoreda ||
                qrModalData.document.oldKebele ||
                qrModalData.document.houseNumber) && (
                <div className="mt-2 rounded bg-slate-50 border border-slate-200 p-1.5 text-[10px] text-left">
                  <span className="font-bold text-slate-600">Historical Address: </span>
                  <span>
                    Woreda {qrModalData.document.oldWoreda || '-'}, Kebele{' '}
                    {qrModalData.document.oldKebele || '-'}, House #{' '}
                    {qrModalData.document.houseNumber || '-'}
                  </span>
                </div>
              )}

              <div className="mt-2 border-t border-slate-300 pt-2 text-[10px] text-left space-y-0.5 font-medium">
                <p>
                  <span className="font-bold">Storage Path:</span>{' '}
                  {qrModalData.document.locationPath}
                </p>
                <p>
                  <span className="font-bold">Security Level:</span>{' '}
                  {qrModalData.document.confidentiality}
                </p>
                <p className="font-mono text-[9px] text-slate-400 truncate">
                  QR ID: {qrModalData.document.qrIdentifier}
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <span className="text-[11px] text-slate-500">
                {isAmharic ? 'የአካላዊ ሰነድ ማጣበቂያ መለያ' : 'Physical File Jacket Label'}
              </span>
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Label</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. REGISTER NEW PHYSICAL DOCUMENT MODAL */}
      {/* ========================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.newDocument')}</h3>
            <p className="text-xs text-slate-500">
              {isAmharic
                ? 'አዲስ ይፋዊ የመንግስት አካላዊ ሰነድ በንግድ ወይም በነዋሪ ምድብ፣ የቀድሞ አድራሻ እና የመደርደሪያ/ሳጥን ቁጥሮች መመዝገቢያ'
                : 'Register a new physical file with Commercial/Resident category, address, and Shelf/Box coordinates.'}
            </p>

            {/* Mode Switcher Tabs */}
            <div className="mt-3 flex items-center space-x-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-300"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{t('importCsv.switchSingle')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterModal(false);
                  handleOpenCsvImportModal();
                }}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t('importCsv.switchBatch')}</span>
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleRegisterDocument} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      {t('document.refNumber')} *
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateRef()}
                      disabled={isGeneratingRef}
                      className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition"
                      title={t('document.autoGenerate')}
                    >
                      <Sparkles className={`h-3 w-3 ${isGeneratingRef ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
                      <span>{isGeneratingRef ? '...' : t('document.autoGenerate')}</span>
                    </button>
                  </div>

                  <div className="relative mt-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. FHC-B1/2026/COM-0001"
                      value={registerForm.referenceNumber}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, referenceNumber: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateRef()}
                      className="absolute right-2 top-2 p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                      title={isAmharic ? 'የንብረት መለያ ቁጥር (Property ID) እንደገና አፍልቅ' : 'Regenerate Property ID'}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingRef ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                  </div>

                  {/* Archival Reference Number Pattern & Options */}
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    <div className="flex items-center space-x-2 text-slate-500">
                      <label className="inline-flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoGenerateRef}
                          onChange={(e) => setAutoGenerateRef(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3 w-3"
                        />
                        <span className="font-medium text-slate-600">
                          {t('document.autoSync')}
                        </span>
                      </label>
                      <span className="text-slate-300">|</span>
                      <select
                        value={refPrefixType}
                        onChange={(e) => {
                          const pType = e.target.value as 'CATEGORY' | 'DEPARTMENT';
                          setRefPrefixType(pType);
                          handleAutoGenerateRef(registerForm.category, pType);
                        }}
                        className="rounded border border-slate-200 bg-white py-0.5 px-1 text-[10px] text-slate-700 focus:outline-none"
                      >
                        <option value="CATEGORY">{t('document.prefixCategory')}</option>
                        <option value="DEPARTMENT">{t('document.prefixDepartment')}</option>
                      </select>
                    </div>

                    <span className="font-mono text-[9px] text-slate-400">
                      {t('document.officialFormat')}
                    </span>
                  </div>
                </div>

                {/* Primary Category: STRICTLY COMMERCIAL or RESIDENT */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('document.category')} *
                  </label>
                  <select
                    value={registerForm.category}
                    onChange={(e) => {
                      const newCat = e.target.value as DocumentCategory;
                      setRegisterForm({
                        ...registerForm,
                        category: newCat,
                      });
                      if (autoGenerateRef && refPrefixType === 'CATEGORY') {
                        handleAutoGenerateRef(newCat, 'CATEGORY');
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="COMMERCIAL">
                      {isAmharic ? 'ንግድ (Commercial)' : 'Commercial'}
                    </option>
                    <option value="RESIDENT">
                      {isAmharic ? 'ነዋሪ (Resident)' : 'Resident'}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('document.title')} (English) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Official English Title"
                  value={registerForm.titleEn}
                  onChange={(e) => setRegisterForm({ ...registerForm, titleEn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t('document.titleAm')} (አማርኛ ርዕስ) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ይፋዊ የአማርኛ ርዕስ"
                  value={registerForm.titleAm}
                  onChange={(e) => setRegisterForm({ ...registerForm, titleAm: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-amharic focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Historical Address-Based Document Fields */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                  <Home className="h-3.5 w-3.5 mr-1.5 text-emerald-700" />
                  Historical Address Coordinates (Searchable Registry)
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Old Woreda (የቀድሞ ወረዳ)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 03"
                      value={registerForm.oldWoreda}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, oldWoreda: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Old Kebele (የቀድሞ ቀበሌ)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12"
                      value={registerForm.oldKebele}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, oldKebele: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      House Number (የቤት ቁጥር)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 045 or 118/A"
                      value={registerForm.houseNumber}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, houseNumber: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Storage Location: Hierarchy, Shelf Number, Box Number */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                  <Archive className="h-3.5 w-3.5 mr-1.5 text-blue-700" />
                  Physical File Location (Shelf & Box)
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Target Archive Location Record *
                  </label>
                  <select
                    required
                    value={registerForm.currentLocationId}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="">Select Archival Storage Unit</option>
                    {locations
                      .filter((l) => l.type === 'BOX' || l.type === 'SHELF')
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} ({l.type}) - {l.fullPath}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Shelf Number (መደርደሪያ ቁጥር)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 05 or B-05"
                      value={registerForm.shelfNumber}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, shelfNumber: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">Preserves leading zeros</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Box Number (የሳጥን ቁጥር)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 012"
                      value={registerForm.boxNumber}
                      onChange={(e) =>
                        setRegisterForm({ ...registerForm, boxNumber: e.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">Preserves leading zeros</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('document.department')} *
                  </label>
                  <select
                    required
                    value={registerForm.departmentId}
                    onChange={(e) => {
                      const newDeptId = e.target.value;
                      setRegisterForm({ ...registerForm, departmentId: newDeptId });
                      if (autoGenerateRef && refPrefixType === 'DEPARTMENT') {
                        handleAutoGenerateRef(registerForm.category, 'DEPARTMENT', newDeptId);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {isAmharic ? d.nameAm : d.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('document.confidentiality')}
                  </label>
                  <select
                    value={registerForm.confidentiality}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, confidentiality: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="PUBLIC">{t('confidentiality.PUBLIC')}</option>
                    <option value="INTERNAL">{t('confidentiality.INTERNAL')}</option>
                    <option value="CONFIDENTIAL">{t('confidentiality.CONFIDENTIAL')}</option>
                    <option value="SECRET">{t('confidentiality.SECRET')}</option>
                    <option value="TOP_SECRET">{t('confidentiality.TOP_SECRET')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('document.date')}
                  </label>
                  <input
                    type="date"
                    value={registerForm.documentDate}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, documentDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Condition Notes & Seal Integrity
                </label>
                <input
                  type="text"
                  placeholder="e.g. Original ribbon seal intact, clean ledger"
                  value={registerForm.conditionNotes}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, conditionNotes: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  {t('actions.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3.1 BATCH CSV DATA IMPORT MODAL */}
      {/* ========================================================= */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setShowCsvImportModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div>
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">{t('importCsv.title')}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('importCsv.description')}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCsvImportModal(false);
                    handleOpenRegisterModal();
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{t('importCsv.switchSingle')}</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-300"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>{t('importCsv.switchBatch')}</span>
                </button>
              </div>

              {/* Template Download Button */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-emerald-300 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                title="Download CSV format template with sample Commercial and Resident records"
              >
                <Download className="h-3.5 w-3.5 text-emerald-700" />
                <span>{t('importCsv.downloadTemplate')}</span>
              </button>
            </div>

            {/* Auto Reference Notice Banner */}
            <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-3 text-xs text-blue-900 flex items-start space-x-2.5">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {isAmharic ? 'የንብረት መለያ ቁጥር (Property ID) በራስ-ሰር ይፈጠራል' : 'Auto Property ID Generation'}
                </p>
                <p className="text-[11px] text-blue-800">
                  {t('importCsv.autoRefNotice')}
                </p>
              </div>
            </div>

            {/* Error & Success Messages */}
            {csvImportErrorMsg && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{csvImportErrorMsg}</span>
              </div>
            )}
            {csvImportSuccessMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="font-semibold">{csvImportSuccessMsg}</span>
              </div>
            )}

            {/* CSV Source Input (File vs Raw Text) */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCsvInputMode('FILE')}
                  className={`rounded-md px-3 py-1 font-semibold transition ${
                    csvInputMode === 'FILE'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isAmharic ? 'የCSV ፋይል ጫን' : 'Upload CSV File'}
                </button>
                <button
                  type="button"
                  onClick={() => setCsvInputMode('TEXT')}
                  className={`rounded-md px-3 py-1 font-semibold transition ${
                    csvInputMode === 'TEXT'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isAmharic ? 'የCSV ጽሑፍ ለጥፍ' : 'Paste CSV Text'}
                </button>
              </div>

              {csvInputMode === 'FILE' ? (
                <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center hover:border-emerald-500 hover:bg-emerald-50/20 transition">
                  <input
                    type="file"
                    id="csvFileInput"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="csvFileInput"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-emerald-600 mb-2" />
                    <span className="text-xs font-semibold text-slate-800">
                      {csvFileName ? (
                        <span className="text-emerald-700 font-bold">{csvFileName}</span>
                      ) : (
                        t('importCsv.dropHere')
                      )}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      {isAmharic
                        ? 'የተደገፉ አምዶች፡ referenceNumber, category, titleEn, titleAm, departmentCode, locationCode, shelfNumber, boxNumber...'
                        : 'Supported columns: referenceNumber, category, titleEn, titleAm, departmentCode, locationCode, shelfNumber, boxNumber...'}
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={rawCsvText}
                    onChange={(e) => setRawCsvText(e.target.value)}
                    placeholder={t('importCsv.pastePlaceholder')}
                    className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-[11px] focus:border-emerald-600 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParseRawText}
                      className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{isAmharic ? 'ፈትሽ እና ቅድመ-ዕይታ' : 'Parse & Validate CSV'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Preview & Validation Table */}
            {csvRowsPreview.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                {/* Summary Metrics */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-bold text-slate-800">{t('importCsv.previewTitle')}:</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 border border-slate-200">
                      {csvSummary.total} {t('importCsv.totalRows')}
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800 border border-emerald-200 inline-flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>{csvSummary.validCount} {t('importCsv.validRows')}</span>
                    </span>
                    {csvSummary.invalidCount > 0 && (
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-800 border border-rose-200 inline-flex items-center space-x-1">
                        <XCircle className="h-3 w-3 text-rose-600" />
                        <span>{csvSummary.invalidCount} {t('importCsv.invalidRows')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 sticky top-0 uppercase">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">{isAmharic ? 'የንብረት መለያ ቁጥር' : 'Property ID'}</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Titles</th>
                        <th className="px-3 py-2">Dept / Location</th>
                        <th className="px-3 py-2">Shelf / Box</th>
                        <th className="px-3 py-2">Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvRowsPreview.map((item) => (
                        <tr
                          key={item.index}
                          className={item.valid ? 'hover:bg-slate-50' : 'bg-rose-50/50 hover:bg-rose-50'}
                        >
                          <td className="px-3 py-2 font-mono text-slate-500">{item.index}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {item.valid ? (
                              <span className="inline-flex items-center space-x-1 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Valid</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center space-x-1 rounded-sm bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800"
                                title={item.error}
                              >
                                <XCircle className="h-3 w-3 text-rose-600" />
                                <span className="line-clamp-1 max-w-[120px]">{item.error}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                            {item.preview.isAutoRef ? (
                              <span className="inline-flex items-center rounded-sm bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                AUTO (Sequential)
                              </span>
                            ) : (
                              <span className="font-bold text-slate-800">
                                {item.preview.referenceNumber}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold border ${
                                item.preview.category === 'COMMERCIAL'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : item.preview.category === 'RESIDENT'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {item.preview.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-[180px]">
                            <p className="font-semibold text-slate-800 truncate">
                              {item.preview.titleEn || <span className="italic text-rose-500">Missing</span>}
                            </p>
                            <p className="text-[10px] text-slate-500 font-amharic truncate">
                              {item.preview.titleAm}
                            </p>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                            <span className="text-slate-800 font-semibold">{item.preview.departmentCode}</span>
                            <span className="text-slate-400 block text-[10px]">{item.preview.locationCode}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-slate-700 font-bold border border-slate-200 mr-1">
                              S:{item.preview.shelfNumber || '-'}
                            </span>
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-slate-700 font-bold border border-slate-200">
                              B:{item.preview.boxNumber || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap font-mono">
                            {item.preview.oldWoreda || item.preview.oldKebele || item.preview.houseNumber ? (
                              <span>
                                W:{item.preview.oldWoreda || '-'} K:{item.preview.oldKebele || '-'} H:{item.preview.houseNumber || '-'}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setShowCsvImportModal(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {t('actions.cancel')}
              </button>

              <button
                type="button"
                disabled={csvSummary.validCount === 0 || isImportingCsv}
                onClick={handleExecuteCsvImport}
                className="inline-flex items-center space-x-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition"
              >
                {isImportingCsv ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{t('importCsv.importing')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {isAmharic
                        ? `${csvSummary.validCount} ትክክለኛ ሰነዶችን መዝግብ`
                        : `Register ${csvSummary.validCount} Valid Documents`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. EDIT DOCUMENT METADATA MODAL */}
      {/* ========================================================= */}
      {showEditModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">
              Edit Document: {selectedDoc.referenceNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Update classification category, address coordinates, or shelf/box identifiers.
            </p>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleEditDocumentSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Document Category *
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category: e.target.value as DocumentCategory })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="COMMERCIAL">Commercial (ንግድ)</option>
                  <option value="RESIDENT">Resident (ነዋሪ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Title (English) *</label>
                <input
                  type="text"
                  required
                  value={editForm.titleEn}
                  onChange={(e) => setEditForm({ ...editForm, titleEn: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Title (አማርኛ) *</label>
                <input
                  type="text"
                  required
                  value={editForm.titleAm}
                  onChange={(e) => setEditForm({ ...editForm, titleAm: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-amharic focus:outline-none"
                />
              </div>

              {/* Address Fields */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Historical Address Coordinates
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Old Woreda</label>
                    <input
                      type="text"
                      value={editForm.oldWoreda}
                      onChange={(e) => setEditForm({ ...editForm, oldWoreda: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">Old Kebele</label>
                    <input
                      type="text"
                      value={editForm.oldKebele}
                      onChange={(e) => setEditForm({ ...editForm, oldKebele: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600">House No.</label>
                    <input
                      type="text"
                      value={editForm.houseNumber}
                      onChange={(e) => setEditForm({ ...editForm, houseNumber: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Shelf and Box coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Shelf Number (መደርደሪያ ቁጥር)
                  </label>
                  <input
                    type="text"
                    value={editForm.shelfNumber}
                    onChange={(e) => setEditForm({ ...editForm, shelfNumber: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Box Number (የሳጥን ቁጥር)
                  </label>
                  <input
                    type="text"
                    value={editForm.boxNumber}
                    onChange={(e) => setEditForm({ ...editForm, boxNumber: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Condition Notes</label>
                <input
                  type="text"
                  value={editForm.conditionNotes}
                  onChange={(e) => setEditForm({ ...editForm, conditionNotes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. RELOCATE DOCUMENT MODAL (Shelf & Box Tracking) */}
      {/* ========================================================= */}
      {showRelocateModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowRelocateModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.relocate')}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedDoc.referenceNumber}</p>

            <form onSubmit={handleRelocateSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Archival Shelf / Box *
                </label>
                <select
                  required
                  value={relocateLocationId}
                  onChange={(e) => handleRelocateTargetChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                >
                  <option value="">Select Destination</option>
                  {locations
                    .filter((l) => l.type === 'BOX' || l.type === 'SHELF')
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} ({l.type}) - {l.fullPath}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    New Shelf Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 05"
                    value={relocateShelfNumber}
                    onChange={(e) => setRelocateShelfNumber(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    New Box Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 012"
                    value={relocateBoxNumber}
                    onChange={(e) => setRelocateBoxNumber(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Relocation Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Relocated to secure cabinet shelf for audits"
                  value={relocateReason}
                  onChange={(e) => setRelocateReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRelocateModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Confirm Relocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. SUBMIT REQUEST MODAL */}
      {/* ========================================================= */}
      {showRequestModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowRequestModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-emerald-800">
              <Zap className="h-5 w-5 text-emerald-600 fill-emerald-500" />
              <h3 className="text-base font-bold text-slate-900">
                {isAmharic ? 'ፈጣን የሰነድ ጥያቄ' : 'Fast Document Request'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {selectedDoc.referenceNumber} — {selectedDoc.titleEn}
            </p>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('requests.purpose')} *
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {isAmharic ? 'ፈጣን ምርጫዎች:' : 'Quick Select:'}
                  </span>
                </div>

                {/* Quick Purpose Chips */}
                <div className="mt-1 flex flex-wrap gap-1.5 mb-1.5">
                  {[
                    { en: 'Official Directorate Review', am: 'የስራ አስፈፃሚ ግምገማ' },
                    { en: 'Financial & Contract Audit', am: 'የፋይናንስ እና ውል ኦዲት' },
                    { en: 'Legal Court Verification', am: 'የህግና ፍርድ ቤት ማረጋገጫ' },
                    { en: 'Administrative Public Deed Check', am: 'የህዝብ ሰነድ ምዝገባ ማጣሪያ' },
                  ].map((preset) => (
                    <button
                      key={preset.en}
                      type="button"
                      onClick={() => setRequestPurpose(preset.en)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                        requestPurpose === preset.en
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {isAmharic ? preset.am : preset.en}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  required
                  placeholder="Describe legitimate official government purpose for physical custody..."
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      {t('requests.returnDate')} *
                    </label>
                  </div>
                  {/* Quick Return Date Chips */}
                  <div className="mt-1 flex gap-1 mb-1">
                    {[3, 7, 14, 30].map((days) => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      const dateStr = d.toISOString().substring(0, 10);
                      const isSelected = requestReturnDate === dateStr;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setRequestReturnDate(dateStr)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                            isSelected
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          +{days}d
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="date"
                    required
                    value={requestReturnDate}
                    onChange={(e) => setRequestReturnDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    {t('requests.priority')}
                  </label>
                  <select
                    value={requestPriority}
                    onChange={(e) => setRequestPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                  >
                    <option value="NORMAL">Normal (መደበኛ)</option>
                    <option value="URGENT">Urgent (አስቸኳይ)</option>
                    <option value="VERY_URGENT">Very Urgent (በጣም አስቸኳይ)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs"
                >
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  <span>{isAmharic ? 'ፈጣን ጥያቄ ላክ' : 'Send Fast Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. REPORT MISSING FILE MODAL */}
      {/* ========================================================= */}
      {showReportMissingModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowReportMissingModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">{t('actions.reportMissing')}</h3>
            </div>
            <p className="text-xs text-rose-700 mt-1">
              Warning: This launches a formal security investigation case and locks the document
              from issuing.
            </p>

            <form onSubmit={handleReportMissingSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Initial Investigation Finding / Shelf Inspection Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail exact shelf checked, adjacent boxes, and staff interviewed..."
                  value={missingNote}
                  onChange={(e) => setMissingNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReportMissingModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
                >
                  Initiate Investigation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
