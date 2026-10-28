# ArchiveTrack Ethiopia (አርካይቭ ትራክ ኢትዮጵያ)
## Government Physical Archive & Document Request Management System

ArchiveTrack Ethiopia is a secure, production-oriented physical archive and custody tracking web application engineered for Ethiopian government ministries, federal agencies, and public institutions.

---

### Core Questions Answered Instantly

1. **Unique Reference Number**: Standardized archival accession code (e.g., `ET-FDRE/2026/FIN-0091`).
2. **Physical Location**: Hierarchical storage path: `Federal Archive Main Complex / Room 101 / Cabinet A / Shelf 02 / Box 12`.
3. **Operational Status**: `AVAILABLE`, `RESERVED`, `BORROWED`, `MISSING`, `UNDER_INVESTIGATION`, `ARCHIVED`.
4. **Current Custodian**: Identifies who physically holds the document, their ministry/department, and handover timestamp.
5. **Request & Approval**: Transparent business purpose justification with authorized Department Manager approval.
6. **Handover & Return Verification**: Atomic physical file issue and return confirmation with condition inspection (`EXCELLENT`, `GOOD`, `FAIR`, `DAMAGED`).
7. **Append-Only Movement History**: Cryptographic and historical tracking that prevents rewriting or deleting movement events.
8. **Missing File Investigation**: Controlled investigative workflow with finding notes and formal resolution.

---

### Preloaded Institutional Test Accounts

| Role | Username | Password | Full Name (English & Amharic) | Department / Ministry |
|---|---|---|---|---|
| **ADMIN** | `admin` | `Admin@ET2026!` | Tesfaye Alemu (ተስፋዬ አለሙ) | Ministry of Innovation & Technology (MInT) |
| **ARCHIVE_OFFICER** | `officer.almaz` | `User@ET2026!` | Almaz Kebede (አልማዝ ከበደ) | Ministry of Innovation & Technology (MInT) |
| **DEPARTMENT_MANAGER** | `manager.berhanu` | `User@ET2026!` | Dr. Berhanu Worku (ዶ/ር ብርሃኑ ወርቁ) | Ministry of Finance (MoF) |
| **EMPLOYEE** | `employee.selam` | `User@ET2026!` | Selamawit Haile (ሰላማዊት ኃይሌ) | Ministry of Finance (MoF) |
| **AUDITOR** | `auditor.dawit` | `User@ET2026!` | Dawit Girma (ዳዊት ግርማ) | Office of the Federal Auditor General (OFAG) |

*Note: In the application UI, you can also use the 1-Click Fast Role Switcher in the top navigation bar to seamlessly test all 5 security personas.*

---

### Key Features & Technology Stack

- **Dual English & Amharic Localization**: Instant locale toggle (EN / አማርኛ) with reviewed Amharic translations (`messages/en.json`, `messages/am.json`) and Ethiopian Calendar integration.
- **Physical QR Code Labels**: Automatic QR code generation for physical file jackets with institutional crest and location hierarchy path.
- **Hierarchical Storage Architecture**: Building → Archive Room → Cabinet → Shelf → Box with containment validations.
- **Atomic Custody Transitions**: Concurrency-safe physical handover preventing double-issuance of physical files.
- **Full-Stack Architecture**: Next.js/React TypeScript frontend on Vite, Express server on port 3000, Mongoose schemas, and automated Vitest test suite.
- **Automated Tests**: Unit and integration test suite passing with 100% success (`npm test`).
