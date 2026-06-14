export enum PackagingType {
  BOTTLE = 'Bottle',
  BOX = 'Box',
  BLISTER_PACK = 'Blister Pack',
  VIAL = 'Vial',
  TUBE = 'Tube',
  SACHET = 'Sachet',
  TABS = 'Tabs',
  PLATE = 'Plate',
  BAG = 'Bag',
  OTHER = 'Other'
}

export enum ProductCategory {
  MEDICINE = 'Medicine',
  VACCINE = 'Vaccine',
  SUPPLEMENT = 'Supplement',
  SUPPLIES = 'Supplies',
  CONSUMABLES = 'Consumables',
  FOOD = 'Food',
  EQUIPMENT = 'Equipment',
  TOYS = 'Toys',
  OTHER = 'Other'
}

export interface StockBatch {
  id: string;
  date: string;
  quantity: number;
  note?: string;
}

export interface InventoryReconciliation {
  id: string;
  itemId: string;
  performedBy: string;
  date: string;
  systemCount: number;
  physicalCount: number;
  adjustment: number;
  reason?: string;
  notes?: string;
  createdAt: string;
  item?: {
    name: string;
    sku: string;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  sku: string;
  quantity: number;
  minThreshold: number; // Smart low inventory
  expiryDate: string;
  category: ProductCategory;
  packaging: PackagingType;
  costPrice: number;
  wholesalePrice: number;
  labelInstructions?: string;
  retailPrice: number;
  imageUrl?: string;
  showInClientPortal: boolean;
  batchNumber?: string;
    nafdacNumber?: string;
  manufacturer?: string;
  batches?: StockBatch[]; // Track history of added stock
  sales?: number; // For tracking best sellers
  isControlled: boolean;
  createdAt?: string;
}

export interface CartItem extends InventoryItem {
  cartQuantity: number;
}

export interface ClinicSettings {
  id?: string;
  name: string;
  acronym: string;
  address: string;
  phone: string;
  email: string;
  taxEnabled: boolean;
  taxRate: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currencySymbol: string;
  country: string;
  language: string;
  practiceType?: string;
  useShiftTimetable: boolean;
  googleDriveRefreshToken?: string;
  subscription?: {
    status?: string;
    billingCycle?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    plan?: {
      id?: string;
      name?: string;
      displayName?: string;
      features?: Record<string, boolean>;
    };
  };
}

export interface ScannedProductData {
  name?: string;
  sku?: string;
  description?: string;
  expiryDate?: string; // YYYY-MM-DD
  category?: ProductCategory;
  manufacturer?: string;
  packaging?: PackagingType;
  suggestedRetailPrice?: number;
  composition?: string;
  batchNumber?: string;
  nafdacNumber?: string;
}

export interface Client {
  id: string;
  clientCode?: string;
  title?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  preferredContact?: string;
  referralSource?: string;
  internalNotes?: string;
  tags?: string[];
  registrationDate: string;
  password?: string;
  isPortalEnabled: boolean;
  lastLogin?: string;
  pets?: Pet[];
  clinicId?: string;
  clinic?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  portalAccess?: {
    enabled: boolean;
    lastLogin?: string | null;
    passwordMustChange?: boolean;
    portalConversationCount?: number;
    invite?: PortalInviteSummary | null;
  };
  portalInbox?: PortalInboxSummary;
  patients?: Pet[];
  appointments?: Appointment[];
  reminders?: Reminder[];
  consentForms?: ConsentForm[];
}

export interface PortalInviteSummary {
  id: string;
  status: 'NOT_SENT' | 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  emailSnapshot: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

export interface PortalInboxSummary {
  unreadCount: number;
  conversations: PortalConversationSummary[];
}

export interface PortalShopItem {
  id: string;
  name: string;
  description?: string;
  sku: string;
  category?: string;
  retailPrice: number;
  imageUrl?: string | null;
  manufacturer?: string | null;
}

export interface PortalOrderSummary {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  paymentMethod?: string | null;
  items: Array<{
    id: string;
    name?: string | null;
    quantity: number;
    pricePerUnit: number;
    item?: {
      id: string;
      name: string;
      sku: string;
      retailPrice: number;
    } | null;
  }>;
}

export interface PortalConversationSummary {
  id: string;
  subject?: string;
  category?: string;
  status: 'ACTIVE' | 'CLOSED' | 'ESCALATED';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  startedAt: string;
  updatedAt: string;
  unreadForClient?: number;
  unreadForClinic?: number;
  patient?: {
    id: string;
    name: string;
    species?: string;
    breed?: string;
  } | null;
  latestMessage?: AIMessage | null;
}

export interface ConsentForm {
  id: string;
  clinicId: string;
  patientId: string;
  clientId: string;
  type: string;
  content: string;
  signedBy?: string;
  signatureDate?: string;
  ipAddress?: string;
  status: 'Pending' | 'Signed' | 'Revoked';
  createdAt: string;
  updatedAt: string;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  gender: 'Male' | 'Female';
  age: number; // calculated years
  ageYearsEntry?: number;
  ageMonthsEntry?: number;
  dateOfBirth?: string;
  weight: number;
  color?: string;
  microchipId?: string;
  owner?: Client;
  treatments?: any[];
  vaccinations?: any[];
  hospitalizations?: any[];
  labResults?: LabResult[];
  status?: 'Active' | 'Inactive' | string;
  createdAt?: string;
}

export interface ProcedureMedication {
  id: number;
  drug: string;
  dose: string;
  route: string;
  freq: string;
  duration: string;
}

export interface Procedure {
  id: string;
  name: string;
  description?: string;
  category: string;
  species: string;
  costClinic: number;
  costClient: number;
  medications: ProcedureMedication[];
  instructions: string;
  status: 'Active' | 'Inactive';
}

export type UserRole = 'Admin' | 'Veterinarian' | 'Lab Scientist' | 'Lab Tech' | 'Vet Tech' | 'Vet Assistant' | 'Receptionist' | 'SUPER_ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  password?: string;
  roles: UserRole[];
  status: 'Active' | 'Suspended';
  isSuperAdmin?: boolean;
  clinicId?: string;
  clinic?: ClinicSettings;
  avatarUrl?: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  recordedBy: string;
  notes?: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  userName: string;
  module: string;
  action: string;
  details: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  type: 'RECEIPT' | 'INVOICE';
  status: 'Completed' | 'Pending' | 'Voided' | 'Deleted';
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  clientName?: string;
  issuerName?: string;
  paymentMethod?: string;
  payments?: Payment[];
  createdAt: string;
  items?: {
    id: string;
    itemId?: string;
    name?: string;
    quantity: number;
    pricePerUnit: number;
    item?: InventoryItem;
  }[];
}

export interface Expense {
  id: string;
  clinicId: string;
  name: string;
  amount: number;
  purpose: string;
  date: string;
  status: 'Completed' | 'Pending';
  createdAt: string;
  updatedAt: string;
}

export type ViewState = 'LIST' | 'ADD_ITEM' | 'EDIT_ITEM' | 'ADD_CLIENT' | 'ADD_PATIENT' | 'ADD_PROCEDURE' | 'NEW_TREATMENT' | 'ADD_STAFF' | 'EDIT_STAFF' | 'EDIT_CLIENT' | 'EDIT_PATIENT';
export type AppView = 'DASHBOARD' | 'INVENTORY' | 'POS' | 'PATIENTS' | 'TREATMENTS' | 'PROCEDURES' | 'CLIENTS' | 'APPOINTMENTS' | 'SETTINGS' | 'STAFF' | 'AUDIT_LOG' | 'SUPER_ADMIN' | 'SALES_HISTORY' | 'CLINIC_DETAILS' | 'CLIENT_DETAILS' | 'PATIENT_DETAILS' | 'EXPENSES' | 'FREE_INVOICE' | 'REPORTS' | 'REMINDERS' | 'AI_HUB' | 'LAB_HUB' | 'ICU_BOARD' | 'HOSPITALIZATION' | 'SHIFT_TIMETABLE' | 'BRANCHES' | 'TRIAGE' | 'NARCOTICS_LOCKBOX' | 'CLINICAL_CALCULATORS' | 'PORTAL_DASHBOARD' | 'PORTAL_LOGIN' | 'PORTAL_INVITE' | 'PORTAL_INBOX' | 'SUBSCRIPTION_CALLBACK';
export type SuperAdminView = 'CLINICS' | 'INVITES';
export type Patient = Pet;

export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface Appointment {
  id: string;
  clientId?: string;
  patientId?: string;
  manualClient?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    address?: string;
  };
  procedureId: string;
  date: string;
  time: string;
  notes?: string;
  status: AppointmentStatus;
  staffId?: string; // assigned staff
  client?: Client;
  procedure?: Procedure;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversation {
  id: string;
  clinicId: string;
  clientId?: string;
  patientId?: string | null;
  guestPhone?: string;
  platform: 'WHATSAPP' | 'SMS' | 'WEB_WIDGET' | 'PORTAL';
  status: 'ACTIVE' | 'CLOSED' | 'ESCALATED';
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  subject?: string;
  category?: string;
  startedAt: string;
  updatedAt: string;
  client?: Client;
  patient?: {
    id: string;
    name: string;
    species?: string;
    breed?: string;
  } | null;
  unreadForClient?: number;
  unreadForClinic?: number;
  latestMessage?: AIMessage | null;
  messages?: AIMessage[];
}

export interface AIMessage {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: 'USER' | 'AI' | 'STAFF' | 'CLIENT';
  content: string;
  sentAt: string;
  isRead: boolean;
  attachments?: AIMessageAttachment[];
}

export interface AIMessageAttachment {
  id: string;
  messageId: string;
  type: 'Image' | 'Video' | 'VoiceNote' | string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Reminder {
  id: string;
  clinicId: string;
  clientId: string;
  patientId?: string | null;
  type: string;
  message: string;
  status: string;
  scheduledFor: string;
  sentAt?: string | null;
  patient?: {
    id: string;
    name: string;
    species?: string;
  } | null;
}

export interface FAQ {
  id: string;
  clinicId: string;
  question: string;
  answer: string;
  category?: string;
  keywords: string[];
  isActive: boolean;
}

export interface Kennel {
  id: string;
  clinicId: string;
  name: string;
  type: string;
  status: string;
  size?: string;
  chargePerNight: number;
  category: string;
  hospitalizations?: Hospitalization[];
}

export interface FlowsheetEntry {
  id: string;
  hospitalizationId: string;
  staffId: string;
  time: string;
  temperature?: string;
  heartRate?: string;
  respiratoryRate?: string;
  notes?: string;
  medicationsGiven?: any;
  billedItems?: any;
  staff?: {
    id: string;
    name: string;
  };
}

export interface Hospitalization {
  id: string;
  clinicId: string;
  patientId: string;
  vetId: string;
  kennelId: string;
  saleId?: string;
  status: string;
  admissionDate: string;
  dischargeDate?: string;
  reason?: string;
  estimatedCost: number;
  criticalAlert?: string;
  nursingInstructions?: string;
  treatmentPlan?: string;
  doctorInChargeId?: string;
  doctorInCharge?: { id: string; name: string };
  patient?: Pet;
  kennel?: Kennel;
  vet?: { id: string; name: string };
  flowsheetEntries?: FlowsheetEntry[];
  notes?: HospitalizationNote[];
  prescriptions?: HospitalizationPrescription[];
}

export interface HospitalizationNote {
  id: string;
  hospitalizationId: string;
  vetId: string;
  date: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  vet?: { id: string; name: string };
}

export interface HospitalizationPrescription {
  id: string;
  hospitalizationId: string;
  inventoryItemId?: string;
  vetId: string;
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'Active' | 'Discontinued' | 'Completed';
  datePrescribed: string;
  vet?: { id: string; name: string };
}

export interface LabResult {
  id: string;
  clinicId: string;
  patientId: string;
  testName: string;
  testDate: string;
  numericalValue?: number;
  unit?: string;
  referenceRange?: string;
  result?: string;
  findings?: string;
  mediaUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentNote {
  id: string;
  treatmentId: string;
  vetId: string;
  date: string;
  note: string;
  createdAt: string;
  vet?: {
    id: string;
    name: string;
  };
}

export interface Treatment {
  id: string;
  patientId: string;
  vetId: string;
  date: string;
  endDate?: string;
  chiefComplaint?: string;
  diagnosis?: string;
  notes?: string;
  totalCost: number;
  status: 'Completed' | 'Ongoing' | 'Cancelled' | string;
  createdAt: string;
  updatedAt: string;
  medications?: any[];
  procedures?: any[];
  treatmentNotes?: TreatmentNote[];
  vet?: { id: string; name: string };
  patient?: { id: string; name: string; owner?: { id: string; firstName: string; lastName: string } };
}
