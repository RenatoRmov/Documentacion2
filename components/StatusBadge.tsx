
import React from 'react';
import { ExpirationStatus } from '../types';
import { parseDate } from '../constants';

interface StatusBadgeProps {
  dateStr: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ dateStr }) => {
  const getStatus = (dateStr: string): ExpirationStatus => {
    if (!dateStr || dateStr.toLowerCase() === 'no aplica') return 'No Registra';
    const date = parseDate(dateStr);
    if (!date) return 'No Registra';
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    if (date < today) return 'Vencido';
    if (date < thirtyDaysFromNow) return 'Próximo a vencer';
    return 'Al día';
  };

  const status = getStatus(dateStr);

  const variants = {
    'Vencido': 'text-red-900 border-red-900/30 bg-red-900/5',
    'Próximo a vencer': 'text-amber-800 border-amber-900/30 bg-amber-900/5',
    'Al día': 'text-emerald-900 border-emerald-900/30 bg-emerald-900/5',
    'No Registra': 'text-zinc-700 border-zinc-800 bg-zinc-900/50',
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`inline-flex px-1.5 py-0.5 rounded border text-[7px] font-black uppercase tracking-widest w-fit ${variants[status]}`}>
        {status}
      </div>
      <span className="text-[10px] font-mono font-medium text-zinc-400/80 tracking-tighter">{dateStr || '---'}</span>
    </div>
  );
};

export default StatusBadge;
