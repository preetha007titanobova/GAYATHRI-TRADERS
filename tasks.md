# Modernize POS & Billing System SPA - Tasks

- [x] **Task 1: Project Setup & Tasks Tracking**
  - [x] Create `tasks.md` root file.
  - [x] Add Apple-inspired glassmorphic design tokens & utilities in `frontend/src/index.css`.

- [x] **Task 2: Layout Architecture & Components**
  - [x] Implement `AppleHeader.tsx` (Top Navigation with Master, Sales, Purchase, Stock, Report links & secondary status buttons).
  - [x] Implement `NavigationDrawer.tsx` (Collapsible side menu overlay replacing legacy right-hand list).
  - [x] Implement `CustomerDetailsPanel.tsx` ("Selective Customer" toggle switch, Shipping Addr, Remarks, customer details).
  - [x] Implement `SalesItemTable.tsx` (Dynamic invoice items table with Barcode, Item Name, Size, Qty (PCS), Rate, Amount, live search & Add Row button).
  - [x] Implement `FinancialSummaryPanel.tsx` (Right-side glass panel calculating Total Qty, Total Amount, Favour Disc ₹, CGST %, SGST %, Round Off, Net Amount, Amount Tendered, Change Return).
  - [x] Implement `ActionFooter.tsx` (Glass bar footer with "Save + Print + WhatsApp" primary button and "Cancel" button).
  - [x] Implement `Modals.tsx` ('Owner Details', 'Daily Stock Status', 'Close Day' modals).

- [x] **Task 3: State Management & Financial Math**
  - [x] Implement live real-time financial math calculations.
  - [x] Connect dynamic table state (add row, remove row, live item search, scanner auto-fill, qty updates).
  - [x] Build `ModernPOSCheckout.tsx` SPA orchestrator.
  - [x] Register route in `App.tsx`.

- [x] **Task 4: Complete Architecture Rebuild of Thermal Printing Subsystem**
  - [x] Main Process Layer: `src/main/printing/types.ts`, `EscPosBuilder.ts`, `ThermalPrinterService.ts`, `PrintManager.ts`.
  - [x] Preload Layer: `src/preload/index.ts` and `electron/preload.js` with secure ContextBridge IPC.
  - [x] Renderer Types & Utils: `receipt.ts`, `receiptFormatters.ts`.
  - [x] Exact Receipt Replica & CSS: `ThermalReceipt.tsx`, `ThermalReceipt.css`.
  - [x] Interactive Billing Form & Live Preview: `ThermalBillingForm.tsx`.
  - [x] Hardware & Layout Config UI: `PrintSettings.tsx`.
  - [x] Integration: Updated `printReceipt.ts` and `App.tsx` routes.

- [x] **Task 5: License Expiry Banner Display Logic**
  - [x] Updated top banner condition in `Layout.tsx` so it appears strictly when `daysRemaining <= 3`.

- [x] **Task 6: Quality Verification & Polish**
  - [x] Verify build and TypeScript compilation.
  - [x] Test glassmorphism aesthetics, responsiveness, and key interactive workflows.
