import React from 'react';
import { Pill, AlertCircle, Phone, Calendar } from 'lucide-react';
import { Pet, ClinicSettings } from '../../types';

interface PharmacyLabelProps {
  patient: Pet;
  clinic: ClinicSettings;
  drug: string;
  dose: string;
  instructions: string;
  vetName: string;
  date: string;
}

const PharmacyLabel: React.FC<PharmacyLabelProps> = ({
  patient,
  clinic,
  drug,
  dose,
  instructions,
  vetName,
  date
}) => {
  return (
    <div className="w-[4in] h-[2in] bg-white text-black p-4 flex flex-col justify-between border border-slate-200 overflow-hidden print:border-0 print:p-2" id="pharmacy-label">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-800 pb-1 mb-2">
        <div>
          <h1 className="text-lg font-black tracking-tighter uppercase leading-none">{clinic.name}</h1>
          <p className="text-[10px] font-bold opacity-80 leading-none mt-0.5">{clinic.address}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black flex items-center justify-end gap-1">
            <Phone className="w-2.5 h-2.5" /> {clinic.phone}
          </p>
          <p className="text-[10px] font-bold flex items-center justify-end gap-1 uppercase">
            <Calendar className="w-2.5 h-2.5" /> {date}
          </p>
        </div>
      </div>

      {/* Patient & Rx Info */}
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-sm font-black uppercase">PATIENT: <span className="text-base">{patient.name}</span></p>
          <p className="text-[10px] font-bold">OWNER: {patient.owner ? `${patient.owner.firstName} ${patient.owner.lastName}` : 'N/A'}</p>
        </div>

        <div className="bg-slate-100 p-2 rounded border border-slate-300 mb-2">
          <div className="flex items-center gap-2 mb-1">
            <Pill className="w-4 h-4 text-slate-800" />
            <p className="text-base font-black tracking-tight">{drug} {dose}</p>
          </div>
          <p className="text-sm font-bold leading-tight uppercase italic">{instructions}</p>
        </div>
      </div>

      {/* Footer / Warnings */}
      <div className="mt-auto">
        <div className="flex justify-between items-end border-t border-slate-400 pt-1">
          <p className="text-[10px] font-bold">PRESCRIBER: Dr. {vetName}</p>
          <div className="flex items-center gap-1 text-[9px] font-black bg-black text-white px-2 py-0.5 rounded italic">
            <AlertCircle className="w-2.5 h-2.5" /> KEEP OUT OF REACH OF CHILDREN
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #pharmacy-label, #pharmacy-label * { visibility: visible; }
          #pharmacy-label {
            position: fixed;
            left: 0;
            top: 0;
            width: 4in;
            height: 2in;
            margin: 0;
            padding: 0.2in;
            border: 0;
          }
        }
      `}} />
    </div>
  );
};

export default PharmacyLabel;
