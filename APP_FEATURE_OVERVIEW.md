# Vet Nexus / Purple Vets App Overview

## What This App Is

Vet Nexus is a full-stack veterinary clinic management platform for running day-to-day clinical, operational, financial, and client communication workflows from a single system.

It combines:

- A React + TypeScript single-page frontend for staff and administrators
- A Node.js + Express + Prisma backend API
- A PostgreSQL-backed operational data model
- AI-assisted clinical and business tools
- An owner-facing client portal
- Offline-capable browser storage and background sync support

At a product level, the app is designed to help a veterinary hospital or clinic manage the full patient journey:

1. Register the client and patient
2. Triage or book the visit
3. Record treatment, procedures, and medications
4. Admit, monitor, and discharge hospitalized patients
5. Sell products, issue invoices, and track balances
6. Coordinate reminders, referrals, and follow-up care
7. Monitor practice performance through dashboards, reports, and AI tools

## Who The App Serves

The app supports multiple user types and work contexts:

- Clinic administrators
- Veterinarians
- Vet techs and assistants
- Reception/front desk teams
- Branch or network managers
- Super admins managing multiple clinics
- Pet owners through the portal experience

The permission model and navigation structure show that the system is intended for role-based access across different operational responsibilities.

## High-Level Product Scope

The application covers these major product areas:

- Authentication and clinic onboarding
- Client and patient record management
- Treatments, procedures, notes, and medical history
- Appointments, follow-up scheduling, and reminders
- Inventory and pharmacy operations
- Point of sale, billing, invoices, receipts, and financial reporting
- Hospitalization, ICU, triage, surgery, and controlled drug workflows
- Staff, shifts, branches, and audit logging
- AI-powered clinical, operational, imaging, and communication assistants
- Referral intake and referral management
- Pet owner portal access
- Offline usage and sync support

## Core User Workflows

### 1. Client and Patient Intake

Staff can create client records, register pets, maintain owner-patient relationships, and move between client and patient detail views without reloading the app.

This includes:

- Client registration and profile editing
- Patient registration and profile editing
- Owner-to-pet linking
- Medical history visibility from patient details
- Cross-navigation between owner and pet records

### 2. Consultation and Treatment Workflow

The treatment flow is built for consultations and ongoing case management. Staff can:

- Record presenting complaint and assessment
- Capture diagnosis and differential diagnosis
- Add medications and procedures
- Build multi-day care plans
- Create treatment notes and follow-up notes
- Automatically schedule next appointments from the treatment sheet
- Admit a patient to hospitalization directly from a new treatment save

The treatment flow also acts as a handoff point into ICU/hospital care when needed.

### 3. Appointment and Follow-Up Workflow

The appointments module handles scheduling and tracking of clinic visits. It supports:

- Appointment creation and updates
- Procedure-linked appointments
- Status tracking
- Follow-up appointment creation from treatment flow
- Owner-facing visibility through the portal side of the system

### 4. Hospitalization and ICU Workflow

For more critical or admitted patients, the app includes a dedicated ICU/hospitalization suite with:

- Kennel management
- Admission from treatment workflow
- Hospital rounds board
- Digital flowsheet entries
- Prescription tracking for hospitalized patients
- Nursing/progress notes
- Inventory deduction from administered medications
- Discharge workflow with invoice generation
- Historical chart viewing from patient history

This is one of the more advanced clinical modules in the system and is positioned as a premium feature.

### 5. Front Desk and Sales Workflow

The system includes a point-of-sale and billing layer for clinic operations:

- Product sales
- Walk-in or client-linked transactions
- Invoice and receipt generation
- Free invoice generation outside standard POS flow
- Transaction history
- Expense tracking
- Profit and loss reporting
- Account balance visibility from client details

This allows the clinic to combine care delivery and financial operations in the same system.

## Detailed Feature Inventory

### Authentication, Access, and Subscription

The platform includes:

- Staff authentication
- JWT-based session handling
- Role-aware navigation and access control
- Super admin mode for network-level oversight
- Subscription flows and callback handling
- Premium-gated modules for advanced features

Premium gating is used in the frontend for modules such as:

- ICU board
- Shift timetable
- Branch management
- Triage
- Surgery hub
- Narcotics lockbox
- Clinical calculators
- Referral management

### Dashboard and Practice Visibility

The dashboard layer gives clinics a central operational landing area. Based on the app shell and routing structure, the dashboard system supports:

- Main clinic dashboard
- Metrics-driven navigation into operational modules
- Inventory and low-stock visibility
- Access to premium operational tools
- Drill-in navigation into AI and clinical modules

### Clients and CRM-Like Features

The client side of the app is more than a simple address book. It includes:

- Client profile management
- Financial history
- Associated patient list
- Communication history
- Media/document access
- Portal claim and login support

This makes the client record a full relationship and billing hub, not just a contact form.

### Patients and Medical Records

Patient records include both profile and clinical context:

- Species, breed, age, weight, gender, color, identifiers
- Owner linkage
- Appointments
- Treatments and treatment history
- Vaccination history
- Hospitalization history
- Lab result visibility
- Consent and media support
- AI-driven actions launched from the patient page

The patient details page also connects to related modules such as surgery, AI summaries, imaging support, calculators, and hospitalization charts.

### Treatments, Procedures, and Clinical Notes

The clinical workflow includes:

- Treatment sheet entry
- Procedure catalog and procedure management
- Procedure-linked medication templates
- Clinical assessments
- SOAP-like note capture patterns
- Follow-up planning
- Multi-day treatment plans
- Treatment editing and treatment note logging
- Medication display for printing and owner instructions

This area appears to be the primary consultation engine of the application.

### Appointments, Vaccinations, and Reminders

The scheduling and preventive care side includes:

- Appointment management
- Procedure-linked booking
- Vaccination records
- Reminder list and reminder infrastructure
- Follow-up appointment generation from treatment

The backend also includes reminder triggering and cleanup routes, indicating scheduled reminder processing and maintenance workflows.

### Inventory, Pharmacy, and Stock Control

The inventory module is a major operational feature. It includes:

- Inventory item creation and editing
- Packaging and product categories
- Stock quantities and low-stock thresholds
- Batch and expiry support in the data model
- Reconciliation workflow
- Search and pagination
- Inventory use within POS
- Inventory linking to hospitalization prescriptions
- Controlled substance handling in the narcotics module

This turns the app into both a retail/clinic stock system and a medication operations system.

### Point of Sale, Invoicing, and Finance

The financial stack covers clinic sales and back-office visibility:

- POS checkout
- Receipts and invoices
- Client-linked sales history
- Transaction history
- Free invoice generation
- Expense tracking
- Profit and loss reporting
- Outstanding balances and financial views inside client records
- Auto-generated hospitalization discharge invoices

This makes the platform suitable for end-to-end financial tracking at clinic level.

### ICU, Hospitalization, Triage, Surgery, and Controlled Drugs

The app contains an advanced clinical operations layer beyond general practice workflows.

### ICU / Hospitalization

- Kennel creation and management
- Admission and discharge workflows
- Hospital rounds board
- Flowsheet charting
- Hospitalization notes
- Hospitalization prescriptions
- Medication administration logging
- Discharge billing support

### Triage

- Active triage board
- Status updates
- Quick-admit workflow

### Surgery

- Surgery hub
- Surgery session initiation from patient details
- Dedicated surgery backend routes

### Controlled Drugs

- Narcotics lockbox
- PIN-gated profile/settings support
- Controlled stock tracking
- Audit-style accountability

These modules position the app closer to a hospital operating system than a simple small-clinic EMR.

### Staff, Shifts, Branches, and Governance

The operational management side includes:

- Staff management
- Shift timetable
- Branch management
- Audit log
- Super admin dashboard
- Clinic details for network/super-admin review

This supports both single-clinic and multi-branch operating models.

### AI Suite

The AI layer is a major differentiator in the product. The AI hub includes several distinct tools:

### Clinical Scribe

- Audio transcription workflow
- Clinical note drafting
- Patient-linked context

### Client Assistant

- AI-driven client communication workflows
- Conversation handling
- Escalation support

### FAQ / Knowledge Base

- Clinic-specific FAQ management
- Structured answers and keywords
- AI client assistant knowledge source

### Operations Dashboard

- AI-oriented operational analysis layer
- Inventory and practice insights

### Clinical Support

- Case support and decision assistance
- Patient-linked AI context

### Imaging Support

- AI-assisted image analysis and comparison flows

### Activity Log

- AI action logging and review

At backend level, there are dedicated AI routes for:

- General AI endpoints
- AI scribe
- AI activity logging
- AI client communication
- AI operations
- AI diagnostic support
- AI imaging

### Referrals and Specialist Handoff

The referral feature set includes:

- Referral portal for incoming submissions
- Referral management dashboard for clinic-side processing
- Referral backend routes and workflows

This suggests the app supports specialist or inter-clinic handoffs, not only direct owner visits.

### Client Portal

The app includes a separate owner-facing portal flow with:

- Portal login
- Portal account claim flow
- Portal dashboard
- Pet details/history view for the owner side
- Consent interactions

This gives pet owners a self-service layer connected to the clinic’s records.

### Media, Labs, Consent, and Search

Supporting modules also include:

- Lab result management
- Media and file visibility in records
- Digital consent generation and signing flows
- Search endpoints for cross-entity lookup
- Profile management for the logged-in user

These round out the system as a more complete digital clinic platform.

### Offline and Resilience Features

The project includes explicit offline support documentation and local sync infrastructure.

Key offline/resilience capabilities include:

- IndexedDB/Dexie local caching
- Offline treatment save support
- Cached inventory, client, and patient access
- Sync queue behavior when back online
- Local-first UX for some records
- PWA-related dependencies and workbox tooling

This is important for clinics with unreliable connectivity or for performance on hosted environments with cold starts.

## Technical Architecture

### Frontend Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Dexie for local/offline persistence
- Sonner for notifications
- html2pdf for export/print workflows
- Workbox/PWA support

### Backend Stack

- Node.js
- Express
- Prisma ORM
- PostgreSQL
- JWT authentication
- Rate limiting
- Nodemailer support
- Flutterwave payment/subscription integration
- Google AI SDK usage
- Cron-triggered maintenance/reminder routes

### API Surface

The backend exposes route groups for:

- Auth
- Clients
- Patients
- Inventory
- Procedures
- Treatments
- Sales
- Settings
- Audit
- Appointments
- Dashboard
- Reports
- Expenses
- Vaccinations
- Reminders
- Profile
- Reconciliation
- Hospitalization
- Labs
- Shifts
- Branches
- Triage
- Surgery
- Narcotics
- Referrals
- Client portal
- Consent
- Subscription
- Search
- Multiple AI service families

### Deployment Shape

The backend serves both API routes and the built frontend, which suggests a unified deployment target. The repository also includes deployment scripts and Cloud Run-oriented notes, indicating the app is intended for hosted production deployment.

## Product Positioning Summary

This is not just a basic vet records tool. It is a broad veterinary practice operating system that combines:

- EMR-style patient records
- Front desk workflow
- Pharmacy/inventory control
- Billing and finance
- Hospital operations
- AI-assisted productivity
- Owner self-service
- Multi-branch and governance tooling

In practical terms, it is positioned somewhere between:

- A veterinary clinic management system
- A lightweight hospital information system for vets
- A business operations platform for a growing veterinary practice

## Current Notes and Practical Caveats

Based on the code structure, some modules are mature operational features while others depend on environment setup, premium access, or external integrations.

Examples of dependency-sensitive areas include:

- AI features, which require configured AI services
- Email/SMS/reminder delivery infrastructure
- Subscription/payment flows
- Portal/auth deployment setup
- Offline sync behavior, which depends on browser storage and reconnect conditions

So the system already spans a very large surface area, but real-world readiness for each module depends on configuration, data quality, and deployment environment.

## Recommended Use of This Document

This file is best used as:

- A product overview for stakeholders
- A handoff document for developers or implementers
- A starting point for user manuals and feature-based SOPs
- A reference when planning onboarding, training, or subscription packaging

If needed, this overview can be expanded into:

- An admin user manual
- A clinic staff SOP guide
- A technical architecture document
- A module-by-module API and screen map
