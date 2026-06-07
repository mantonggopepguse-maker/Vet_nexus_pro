
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  detectRuntime,
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.10.0
 * Query Engine version: 5a9203d0590c951969e85a7d07215503f4672eb9
 */
Prisma.prismaVersion = {
  client: "5.10.0",
  engine: "5a9203d0590c951969e85a7d07215503f4672eb9"
}

Prisma.PrismaClientKnownRequestError = () => {
  throw new Error(`PrismaClientKnownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  throw new Error(`PrismaClientUnknownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  throw new Error(`PrismaClientRustPanicError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  throw new Error(`PrismaClientInitializationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  throw new Error(`PrismaClientValidationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  throw new Error(`NotFoundError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  throw new Error(`sqltag is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  throw new Error(`empty is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  throw new Error(`join is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  throw new Error(`raw is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  throw new Error(`Extensions.getExtensionContext is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  throw new Error(`Extensions.defineExtension is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ClinicScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  status: 'status',
  storageUsage: 'storageUsage',
  ramUsage: 'ramUsage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  acronym: 'acronym',
  address: 'address',
  phone: 'phone',
  email: 'email',
  taxEnabled: 'taxEnabled',
  taxRate: 'taxRate',
  bankName: 'bankName',
  accountName: 'accountName',
  accountNumber: 'accountNumber',
  currencySymbol: 'currencySymbol',
  country: 'country',
  language: 'language',
  googleDriveRefreshToken: 'googleDriveRefreshToken',
  googleDriveAccessToken: 'googleDriveAccessToken',
  googleDriveFolderId: 'googleDriveFolderId',
  googleEmail: 'googleEmail'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  username: 'username',
  roles: 'roles',
  status: 'status',
  clinicId: 'clinicId',
  isSuperAdmin: 'isSuperAdmin',
  avatarUrl: 'avatarUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  address: 'address',
  registrationDate: 'registrationDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientScalarFieldEnum = {
  id: 'id',
  name: 'name',
  species: 'species',
  breed: 'breed',
  gender: 'gender',
  age: 'age',
  dateOfBirth: 'dateOfBirth',
  ageYearsEntry: 'ageYearsEntry',
  ageMonthsEntry: 'ageMonthsEntry',
  weight: 'weight',
  color: 'color',
  microchipId: 'microchipId',
  ownerId: 'ownerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryItemScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  description: 'description',
  sku: 'sku',
  quantity: 'quantity',
  minThreshold: 'minThreshold',
  expiryDate: 'expiryDate',
  category: 'category',
  packaging: 'packaging',
  costPrice: 'costPrice',
  wholesalePrice: 'wholesalePrice',
  retailPrice: 'retailPrice',
  imageUrl: 'imageUrl',
  showInClientPortal: 'showInClientPortal',
  batchNumber: 'batchNumber',
  manufacturer: 'manufacturer',
  sales: 'sales',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockBatchScalarFieldEnum = {
  id: 'id',
  itemId: 'itemId',
  date: 'date',
  quantity: 'quantity',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.InventoryReconciliationScalarFieldEnum = {
  id: 'id',
  itemId: 'itemId',
  performedBy: 'performedBy',
  date: 'date',
  systemCount: 'systemCount',
  physicalCount: 'physicalCount',
  adjustment: 'adjustment',
  reason: 'reason',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.ProcedureScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  description: 'description',
  category: 'category',
  species: 'species',
  costClinic: 'costClinic',
  costClient: 'costClient',
  instructions: 'instructions',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProcedureMedicationScalarFieldEnum = {
  id: 'id',
  procedureId: 'procedureId',
  drug: 'drug',
  dose: 'dose',
  route: 'route',
  freq: 'freq',
  duration: 'duration'
};

exports.Prisma.TreatmentScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  vetId: 'vetId',
  date: 'date',
  chiefComplaint: 'chiefComplaint',
  diagnosis: 'diagnosis',
  notes: 'notes',
  totalCost: 'totalCost',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TreatmentMedicationScalarFieldEnum = {
  id: 'id',
  treatmentId: 'treatmentId',
  itemId: 'itemId',
  drug: 'drug',
  dose: 'dose',
  route: 'route',
  freq: 'freq',
  duration: 'duration',
  cost: 'cost'
};

exports.Prisma.TreatmentProcedureScalarFieldEnum = {
  id: 'id',
  treatmentId: 'treatmentId',
  procedureId: 'procedureId',
  cost: 'cost'
};

exports.Prisma.SaleScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  invoiceNumber: 'invoiceNumber',
  type: 'type',
  status: 'status',
  subtotal: 'subtotal',
  discount: 'discount',
  tax: 'tax',
  total: 'total',
  paymentMethod: 'paymentMethod',
  clientId: 'clientId',
  clientName: 'clientName',
  amountPaid: 'amountPaid',
  balanceDue: 'balanceDue',
  issuerName: 'issuerName',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CartItemScalarFieldEnum = {
  id: 'id',
  saleId: 'saleId',
  itemId: 'itemId',
  procedureId: 'procedureId',
  name: 'name',
  quantity: 'quantity',
  pricePerUnit: 'pricePerUnit'
};

exports.Prisma.InviteLinkScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  code: 'code',
  isUsed: 'isUsed',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  userId: 'userId',
  userName: 'userName',
  module: 'module',
  action: 'action',
  details: 'details',
  timestamp: 'timestamp'
};

exports.Prisma.AppointmentScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  clientId: 'clientId',
  patientId: 'patientId',
  procedureId: 'procedureId',
  date: 'date',
  time: 'time',
  notes: 'notes',
  status: 'status',
  manualClient: 'manualClient',
  staffId: 'staffId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CommunicationScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  type: 'type',
  content: 'content',
  status: 'status',
  sentAt: 'sentAt'
};

exports.Prisma.MediaScalarFieldEnum = {
  id: 'id',
  clientId: 'clientId',
  patientId: 'patientId',
  type: 'type',
  url: 'url',
  name: 'name',
  size: 'size',
  createdAt: 'createdAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  amount: 'amount',
  purpose: 'purpose',
  date: 'date',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionPlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  displayName: 'displayName',
  priceMonthly: 'priceMonthly',
  priceYearly: 'priceYearly',
  currency: 'currency',
  features: 'features',
  maxClients: 'maxClients',
  maxPatients: 'maxPatients',
  maxStaff: 'maxStaff',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  planId: 'planId',
  status: 'status',
  billingCycle: 'billingCycle',
  currentPeriodStart: 'currentPeriodStart',
  currentPeriodEnd: 'currentPeriodEnd',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  flutterwaveCustomerId: 'flutterwaveCustomerId',
  flutterwaveSubId: 'flutterwaveSubId',
  lastPaymentDate: 'lastPaymentDate',
  nextPaymentDate: 'nextPaymentDate',
  failedPaymentCount: 'failedPaymentCount',
  lastReminderSent: 'lastReminderSent',
  reminderCount: 'reminderCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentTransactionScalarFieldEnum = {
  id: 'id',
  subscriptionId: 'subscriptionId',
  flutterwaveRef: 'flutterwaveRef',
  flutterwaveTxId: 'flutterwaveTxId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  paymentMethod: 'paymentMethod',
  cardLast4: 'cardLast4',
  description: 'description',
  metadata: 'metadata',
  paidAt: 'paidAt',
  createdAt: 'createdAt'
};

exports.Prisma.VaccinationScalarFieldEnum = {
  id: 'id',
  patientId: 'patientId',
  name: 'name',
  dateGiven: 'dateGiven',
  nextDueDate: 'nextDueDate',
  batchNumber: 'batchNumber',
  manufacturer: 'manufacturer',
  administeredBy: 'administeredBy',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReminderScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  clientId: 'clientId',
  patientId: 'patientId',
  type: 'type',
  message: 'message',
  status: 'status',
  scheduledFor: 'scheduledFor',
  sentAt: 'sentAt',
  referenceId: 'referenceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  Clinic: 'Clinic',
  User: 'User',
  Client: 'Client',
  Patient: 'Patient',
  InventoryItem: 'InventoryItem',
  StockBatch: 'StockBatch',
  InventoryReconciliation: 'InventoryReconciliation',
  Procedure: 'Procedure',
  ProcedureMedication: 'ProcedureMedication',
  Treatment: 'Treatment',
  TreatmentMedication: 'TreatmentMedication',
  TreatmentProcedure: 'TreatmentProcedure',
  Sale: 'Sale',
  CartItem: 'CartItem',
  InviteLink: 'InviteLink',
  AuditLog: 'AuditLog',
  Appointment: 'Appointment',
  Communication: 'Communication',
  Media: 'Media',
  Expense: 'Expense',
  SubscriptionPlan: 'SubscriptionPlan',
  Subscription: 'Subscription',
  PaymentTransaction: 'PaymentTransaction',
  Vaccination: 'Vaccination',
  Reminder: 'Reminder'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        const runtime = detectRuntime()
        const edgeRuntimeName = {
          'workerd': 'Cloudflare Workers',
          'deno': 'Deno and Deno Deploy',
          'netlify': 'Netlify Edge Functions',
          'edge-light': 'Vercel Edge Functions or Edge Middleware',
        }[runtime]

        let message = 'PrismaClient is unable to run in '
        if (edgeRuntimeName !== undefined) {
          message += edgeRuntimeName + '. As an alternative, try Accelerate: https://pris.ly/d/accelerate.'
        } else {
          message += 'this browser environment, or has been bundled for the browser (running in `' + runtime + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
