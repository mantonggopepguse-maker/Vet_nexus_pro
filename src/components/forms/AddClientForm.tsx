import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, User, Phone, Mail, MapPin, Loader2, AlertCircle, Shield, Heart, Tag, MessageCircle, Users, ChevronDown } from 'lucide-react';
import { Client } from '../../types';
import { api } from '../../services/apiService';

interface AddClientFormProps {
  onBack: () => void;
  onSave: (client: Omit<Client, 'id' | 'registrationDate'>) => void;
  isSaving?: boolean;
  initialData?: Client;
}

const TITLE_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Chief', 'Engr.', 'Barr.', 'Alhaji', 'Alhaja'];
const CONTACT_METHODS = ['Phone', 'WhatsApp', 'Email', 'SMS'];
const REFERRAL_SOURCES = ['Walk-in', 'Referral', 'Social Media', 'Google Search', 'Returning Client', 'Friend/Family', 'Flyer/Advert', 'Other'];
const TAG_OPTIONS = ['VIP', 'New Client', 'Debtor', 'Breeder', 'Rescue/Shelter', 'Farm Owner', 'Regular', 'Staff Family'];

export const AddClientForm: React.FC<AddClientFormProps> = ({ onBack, onSave, isSaving = false, initialData }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    alternatePhone: initialData?.alternatePhone || '',
    address: initialData?.address || '',
    emergencyContactName: initialData?.emergencyContactName || '',
    emergencyContactPhone: initialData?.emergencyContactPhone || '',
    emergencyContactRelation: initialData?.emergencyContactRelation || '',
    preferredContact: initialData?.preferredContact || 'Phone',
    referralSource: initialData?.referralSource || '',
    internalNotes: initialData?.internalNotes || '',
    tags: initialData?.tags || [] as string[],
  });

  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ exists: boolean; client?: any } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const isEdit = !!initialData;

  const validateEmail = (email: string) => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Debounced duplicate check on phone
  useEffect(() => {
    if (isEdit || !formData.phone || formData.phone.length < 7) {
      setDuplicateWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const result = await api.get(`/clients/check-duplicate?phone=${encodeURIComponent(formData.phone)}`);
        setDuplicateWarning(result);
      } catch {
        // Silently fail
      } finally {
        setCheckingDuplicate(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formData.phone, isEdit]);

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    if (formData.email && !validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    onSave({ ...formData, isPortalEnabled: initialData?.isPortalEnabled || false });
  };

  const sectionTitleClass = "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2";
  const inputClass = "w-full soft-input px-4 py-3.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 text-sm";
  const labelClass = "text-xs font-bold text-slate-600 ml-1 mb-1.5 block";

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 md:mb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 md:w-12 md:h-12 soft-btn flex items-center justify-center text-slate-500 hover:text-orange-500 hover:bg-orange-50"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{isEdit ? 'Edit Client' : 'New Client'}</h1>
          <p className="text-orange-400 text-xs md:text-sm font-bold tracking-wide">{isEdit ? 'Update pet owner details' : 'Register a new pet owner'}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-bold">{error}</p>
        </div>
      )}

      {duplicateWarning?.exists && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl flex items-center gap-3 mb-6 animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold">Possible duplicate detected!</p>
            <p className="text-sm font-medium mt-0.5">
              A client named <strong>{duplicateWarning.client?.firstName} {duplicateWarning.client?.lastName}</strong> already exists with this phone number.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="soft-card p-5 md:p-8 border-t-4 border-orange-400 space-y-6">
          <p className={sectionTitleClass}>
            <User className="w-3.5 h-3.5 text-orange-400" /> Personal Information
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Title</label>
              <select
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className={inputClass}
              >
                <option value="">Select...</option>
                {TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>First Name <span className="text-rose-400">*</span></label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-300 w-4 h-4" />
                <input
                  required type="text" value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className={`${inputClass} pl-11`} placeholder="e.g. John"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Last Name <span className="text-rose-400">*</span></label>
              <input
                required type="text" value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                className={inputClass} placeholder="e.g. Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Phone Number <span className="text-rose-400">*</span></label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-300 w-4 h-4" />
                <input
                  required type="tel" value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className={`${inputClass} pl-11`} placeholder="+234..."
                />
                {checkingDuplicate && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>Alternate Phone <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-300 w-4 h-4" />
                <input
                  type="tel" value={formData.alternatePhone}
                  onChange={e => setFormData({ ...formData, alternatePhone: e.target.value })}
                  className={`${inputClass} pl-11`} placeholder="Work / other number"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Email Address <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-300 w-4 h-4" />
                <input
                  type="email" value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={`${inputClass} pl-11`} placeholder="john@example.com"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Preferred Contact Method</label>
              <div className="flex flex-wrap gap-2">
                {CONTACT_METHODS.map(method => (
                  <button
                    key={method} type="button"
                    onClick={() => setFormData({ ...formData, preferredContact: method })}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-200 ${
                      formData.preferredContact === method
                        ? 'bg-orange-50 border-orange-300 text-orange-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/50'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Home Address <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 text-orange-300 w-4 h-4" />
              <textarea
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                rows={2} className={`${inputClass} pl-11`} placeholder="Street address, City..."
              />
            </div>
          </div>
        </div>

        {/* Section 2: Emergency Contact */}
        <div className="soft-card p-5 md:p-8 space-y-6">
          <p className={sectionTitleClass}>
            <Shield className="w-3.5 h-3.5 text-rose-400" /> Emergency Contact
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Contact Name</label>
              <input
                type="text" value={formData.emergencyContactName}
                onChange={e => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className={inputClass} placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <label className={labelClass}>Contact Phone</label>
              <input
                type="tel" value={formData.emergencyContactPhone}
                onChange={e => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                className={inputClass} placeholder="+234..."
              />
            </div>
            <div>
              <label className={labelClass}>Relationship</label>
              <select
                value={formData.emergencyContactRelation}
                onChange={e => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                className={inputClass}
              >
                <option value="">Select...</option>
                <option>Spouse</option>
                <option>Sibling</option>
                <option>Parent</option>
                <option>Friend</option>
                <option>Colleague</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Tags & Referral */}
        <div className="soft-card p-5 md:p-8 space-y-6">
          <p className={sectionTitleClass}>
            <Tag className="w-3.5 h-3.5 text-amber-400" /> Classification & Source
          </p>

          <div>
            <label className={labelClass}>Client Tags</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag} type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                    formData.tags.includes(tag)
                      ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm ring-1 ring-amber-200'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:bg-amber-50/50'
                  }`}
                >
                  {formData.tags.includes(tag) ? '✓ ' : ''}{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>How did they find us?</label>
              <select
                value={formData.referralSource}
                onChange={e => setFormData({ ...formData, referralSource: e.target.value })}
                className={inputClass}
              >
                <option value="">Select referral source...</option>
                {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Internal Notes */}
        <div className="soft-card p-5 md:p-8 space-y-6">
          <p className={sectionTitleClass}>
            <MessageCircle className="w-3.5 h-3.5 text-blue-400" /> Internal Staff Notes
          </p>
          <div>
            <label className={labelClass}>Private Notes <span className="text-xs text-slate-400 font-normal">(Not visible to client)</span></label>
            <textarea
              value={formData.internalNotes}
              onChange={e => setFormData({ ...formData, internalNotes: e.target.value })}
              rows={3} className={inputClass}
              placeholder="Any internal notes about this client (allergies of owner, special requests, behavioral notes, etc.)"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <button
            type="button" onClick={onBack}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={isSaving}
            className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-[0.98] bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Client')}
          </button>
        </div>
      </form>
    </div>
  );
};
