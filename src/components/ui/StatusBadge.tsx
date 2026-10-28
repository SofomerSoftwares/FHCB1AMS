import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { DocumentStatus, RequestStatus, ConfidentialityLevel } from '../../types';

interface StatusBadgeProps {
  status: DocumentStatus | RequestStatus | ConfidentialityLevel | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const { t, isAmharic } = useLanguage();

  let colorClasses = 'bg-slate-100 text-slate-800 border-slate-300';

  switch (status) {
    case 'AVAILABLE':
      colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      break;
    case 'APPROVED':
      colorClasses = 'bg-blue-50 text-blue-800 border-blue-300';
      break;
    case 'ISSUED':
    case 'BORROWED':
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-300';
      break;
    case 'RESERVED':
    case 'PENDING':
      colorClasses = 'bg-indigo-50 text-indigo-800 border-indigo-300';
      break;
    case 'RETURNED':
      colorClasses = 'bg-teal-50 text-teal-800 border-teal-300';
      break;
    case 'REJECTED':
      colorClasses = 'bg-rose-50 text-rose-800 border-rose-300';
      break;
    case 'MISSING':
    case 'UNDER_INVESTIGATION':
      colorClasses = 'bg-red-100 text-red-900 border-red-400 animate-pulse';
      break;
    case 'ARCHIVED':
      colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';
      break;
    case 'PUBLIC':
      colorClasses = 'bg-green-50 text-green-700 border-green-200';
      break;
    case 'INTERNAL':
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-300';
      break;
    case 'CONFIDENTIAL':
      colorClasses = 'bg-orange-50 text-orange-800 border-orange-300';
      break;
    case 'SECRET':
      colorClasses = 'bg-purple-50 text-purple-800 border-purple-300';
      break;
    case 'TOP_SECRET':
      colorClasses = 'bg-red-50 text-red-800 border-red-500 font-bold';
      break;
  }

  const label = t(`status.${status}`, t(`confidentiality.${status}`, status));

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${colorClasses}`}
    >
      {label}
    </span>
  );
};
