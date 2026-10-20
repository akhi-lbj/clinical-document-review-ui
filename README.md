# MediCode AI — Clinical Document Review & Coding Workstation
### Intelligent Document Ingestion, OCR & Terminology Verification Platform

A specialized clinical document ingestion, OCR extraction, and medical terminology verification interface powered by SAS Viya analytics and modern NLP models.

---

## 🚀 Live Demo & Deployment

This application is built with standard web technologies (HTML5, Vanilla CSS, Modern JavaScript) with zero build steps or heavy dependencies. It deploys natively to **Vercel**, **GitHub Pages**, or any static hosting provider.

### Deploying to Vercel
1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Keep the default settings (Framework Preset: *Other*, Root Directory: `./`).
5. Click **Deploy**. Your application will be live immediately with an automatic SSL URL!

---

## 📋 Key Architecture & Features

### Screen 1: Batch Submission & Ingestion Pipeline Monitor
- **5-Stage Pipeline Simulation**: Tracks ingestion status across:
  1. *Optical Character Recognition (OCR 300 DPI)*
  2. *SAS Viya NLP Extraction*
  3. *ICD-10 / SNOMED CT Ontology Mapping*
  4. *Deterministic Business Rule Validation*
  5. *Persistence & Audit Log Delivery*
- **Audit Logging Terminal**: Real-time streaming log simulation with timestamped, color-coded diagnostic traces.
- **Batch Metadata Bar**: Displays record counts, confidence metrics, and processing velocity.

### Screen 2: Interactive Clinical Review Workspace
- **Dual-Pane Document Inspection**:
  - **Left**: Interactive rendered clinical discharge summary with exact OCR bounding-box positioning and localized scroll synchronization.
  - **Right**: Tabular clinical entity extraction grid (ICD-10, SNOMED CT, ATC codes) with confidence scores, validation flags, and direct verification controls.
- **Correction & Code Lookup Modal**: Allows clinical coders to search standard accredited ontologies (ICD-10-AM / SNOMED-CT / WHO-ATC), correct medical terms, specify reason codes, and sign off.
- **Theme Switcher**:
  - **Variant 1**: Classic Slate Light (clean clinical administrative aesthetic).
  - **Variant 2**: High-Acuity Dark Console (low eye strain for continuous triage shifts).
- **Keyboard Shortcuts**: Rapid verification using `1` (Confirm Correct), `2` (Flag Incorrect), `↑` / `↓` (Row navigation), `Ctrl+Enter` (Save), and `Esc`.

---

## 💻 Local Development

To run the application locally:

```bash
# Using Python built-in server (recommended)
python -m http.server 8080

# Or using Node.js http-server
npx http-server -p 8080
```

Open your browser to [http://localhost:8080](http://localhost:8080).

---

## 📁 Repository Structure

```
├── index.html       # Primary application markup (Screens 1 & 2, modals, SVG icons)
├── styles.css       # Complete design system tokens, typography, layouts, and animations
├── app.js           # Interactive state machine, OCR bounding box calculations, and simulation
├── .gitignore       # Standard exclusions for OS and IDE files
└── README.md        # Documentation and deployment guide
```

---

## 🔒 Clinical Standards & Governance
- **ICD-10**: International Classification of Diseases (10th Revision)
- **SNOMED CT**: Systematized Nomenclature of Medicine Clinical Terms
- **ATC**: Anatomical Therapeutic Chemical Classification System
- Designed in accordance with international healthcare terminology standards and clinical governance guidelines.
