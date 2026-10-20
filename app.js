/**
 * MediCode AI — Interactive Controller
 * Clinical Document Coding Review Workstation
 */

// STATE STORE
const state = {
  currentScreen: 'submission',
  currentVariant: '1',
  activeRowIndex: 0,
  hasUnsavedChanges: false,
  pendingRowIndex: null,
  currentZoom: 100,
  isHighlightFallback: false,
  
  // Clinical Extraction Records
  records: [
    {
      docId: 'DOC-001',
      key: 'Medical Problem',
      value: 'osteoarthritis',
      standard: 'ICD-10',
      code: 'M17.11',
      codeDesc: 'Unilateral primary osteoarthritis, right knee',
      confidence: 0.94,
      offsets: '14,203–14,228',
      page: 37,
      coords: '[Page: 37, X: 140, Y: 380, W: 240, H: 26]',
      decision: 'Pending',
      savedDecision: 'Pending',
      comment: '',
      reason: ''
    },
    {
      docId: 'DOC-001',
      key: 'Procedure',
      value: 'total knee arthroplasty',
      standard: 'SNOMED',
      code: '609588000',
      codeDesc: 'Total replacement of knee joint',
      confidence: 0.96,
      offsets: '15,102–15,145',
      page: 37,
      coords: '[Page: 37, X: 140, Y: 440, W: 220, H: 24]',
      decision: 'Correct',
      savedDecision: 'Correct',
      comment: 'Verified against operative surgical report paragraph 2.',
      reason: ''
    },
    {
      docId: 'DOC-002',
      key: 'Medication',
      value: 'metformin 500 mg',
      standard: 'ATC',
      code: 'A10BA02',
      codeDesc: 'Metformin hydrochloride oral tablet',
      confidence: 0.82,
      offsets: '16,040–16,065',
      page: 38,
      coords: '[Page: 38, X: 120, Y: 510, W: 180, H: 22]',
      decision: 'Incorrect',
      savedDecision: 'Incorrect',
      comment: 'Dose adjusted inpatient; outpatient discharge prescription discontinued.',
      reason: 'guideline'
    },
    {
      docId: 'DOC-001',
      key: 'Diagnosis',
      value: 'Type 2 Diabetes',
      standard: 'ICD-10',
      code: 'E11.9',
      codeDesc: 'Type 2 diabetes mellitus without complications',
      confidence: 0.91,
      offsets: '16,210–16,238',
      page: 37,
      coords: '[Page: 37, X: 140, Y: 485, W: 195, H: 22]',
      decision: 'Correct',
      savedDecision: 'Correct',
      comment: 'Long-term comorbidity documented in medical history.',
      reason: ''
    }
  ],

  // Diagnostic Ontology Autocomplete DB
  ontologyDB: [
    { code: 'M17.11', desc: 'Unilateral primary osteoarthritis, right knee', standard: 'ICD-10' },
    { code: 'M17.12', desc: 'Unilateral primary osteoarthritis, left knee', standard: 'ICD-10' },
    { code: 'M17.0', desc: 'Bilateral primary osteoarthritis of knee', standard: 'ICD-10' },
    { code: 'M17.9', desc: 'Osteoarthritis of knee, unspecified', standard: 'ICD-10' },
    { code: '609588000', desc: 'Total replacement of knee joint (procedure)', standard: 'SNOMED' },
    { code: 'A10BA02', desc: 'Metformin hydrochloride 500mg', standard: 'ATC' }
  ]
};

// DOM INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardListeners();
  updateDecisionCounts();
  window.addEventListener('resize', () => {
    if (state.currentScreen === 'review') {
      updateBoundingBoxPosition();
    }
  });
});

// SCREEN SWITCHING
function switchScreen(screenName) {
  if (state.hasUnsavedChanges) {
    state.pendingScreen = screenName;
    openUnsavedModal();
    return;
  }
  
  state.currentScreen = screenName;
  document.body.dataset.screen = screenName;
  
  const viewSubmission = document.getElementById('view-submission');
  const viewReview = document.getElementById('view-review');
  const tabSubmission = document.getElementById('tab-screen-submission');
  const tabReview = document.getElementById('tab-screen-review');

  if (screenName === 'submission') {
    viewSubmission.classList.remove('hidden');
    viewReview.classList.add('hidden');
    tabSubmission.classList.add('active');
    tabSubmission.setAttribute('aria-selected', 'true');
    tabReview.classList.remove('active');
    tabReview.setAttribute('aria-selected', 'false');
  } else {
    viewSubmission.classList.add('hidden');
    viewReview.classList.remove('hidden');
    tabReview.classList.add('active');
    tabReview.setAttribute('aria-selected', 'true');
    tabSubmission.classList.remove('active');
    tabSubmission.setAttribute('aria-selected', 'false');

    // Give browser a frame to compute geometry before positioning bounding box
    requestAnimationFrame(() => {
      setTimeout(() => {
        renderActiveRecord();
      }, 50);
    });
  }
}

// VARIANT SWITCHING (Variant 1: Classic Slate Light, Variant 2: High-Acuity Dark Console)
function switchVariant(variantId) {
  state.currentVariant = variantId;
  document.body.dataset.variant = variantId;
  
  if (variantId === '2') {
    document.body.dataset.theme = 'dark';
  } else {
    document.body.dataset.theme = 'slate';
  }

  const select = document.getElementById('variant-select');
  if (select && select.value !== variantId) {
    select.value = variantId;
  }

  setTimeout(() => {
    if (state.currentScreen === 'review') {
      updateBoundingBoxPosition();
    }
  }, 40);
}

// ROW SELECTION & CONTEXT SWITCH
function selectRow(index) {
  if (index === state.activeRowIndex) {
    // Re-center bounding box on repeated click
    updateBoundingBoxPosition();
    const target = document.getElementById(`finding-target-${index}`);
    if (target) {
      scrollPdfToTarget(target);
    }
    return;
  }

  if (state.hasUnsavedChanges) {
    state.pendingRowIndex = index;
    openUnsavedModal();
    return;
  }

  commitRowSelection(index);
}

function commitRowSelection(index) {
  state.activeRowIndex = index;
  state.hasUnsavedChanges = false;
  hideUnsavedBanner();
  
  // Highlight active row in table
  const rows = document.querySelectorAll('#results-tbody .table-row');
  rows.forEach((row, i) => {
    row.classList.toggle('active', i === index);
  });

  renderActiveRecord();
}

// SCROLL ONLY THE PDF CANVAS INTERNALLY (PREVENTS APPLICATION/WINDOW SCROLLING)
function scrollPdfToTarget(target) {
  const canvas = document.getElementById('document-canvas');
  if (!canvas || !target || state.isHighlightFallback) return;

  const canvasRect = canvas.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // Position of target relative to canvas scroll container
  const relativeTop = targetRect.top - canvasRect.top + canvas.scrollTop;
  // Center the target vertically inside the canvas view
  const scrollTargetY = relativeTop - (canvas.clientHeight / 2) + (targetRect.height / 2);

  canvas.scrollTo({
    top: Math.max(0, scrollTargetY),
    behavior: 'smooth'
  });
}

// DYNAMIC BOUNDING BOX POSITIONING CONTROLLER
function updateBoundingBoxPosition() {
  const indicator = document.getElementById('active-bounding-box-indicator');
  const canvas = document.getElementById('document-canvas');
  if (!indicator || !canvas) return;

  const target = document.getElementById(`finding-target-${state.activeRowIndex}`);

  // Update target element highlight states
  document.querySelectorAll('.finding-target').forEach((el) => {
    const idx = parseInt(el.dataset.findingIndex, 10);
    el.classList.toggle('active-target', idx === state.activeRowIndex);
  });

  if (!target) {
    indicator.style.display = 'none';
    return;
  }

  const rec = state.records[state.activeRowIndex];

  // Fallback mode toggle
  if (state.isHighlightFallback) {
    indicator.classList.add('fallback-mode');
  } else {
    indicator.classList.remove('fallback-mode');
  }

  // Calculate coordinates relative to scrollable canvas
  const canvasRect = canvas.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // If view is hidden or not laid out yet, defer
  if (canvasRect.width === 0 || targetRect.width === 0) {
    return;
  }

  // Snug padding: only wrap the exact clinical term, avoiding adjacent words
  const padX = 4;
  const padY = 2;

  const top = targetRect.top - canvasRect.top + canvas.scrollTop - padY;
  const left = targetRect.left - canvasRect.left + canvas.scrollLeft - padX;
  const width = targetRect.width + (padX * 2);
  const height = targetRect.height + (padY * 2);

  indicator.style.top = `${Math.round(top)}px`;
  indicator.style.left = `${Math.round(left)}px`;
  indicator.style.width = `${Math.round(width)}px`;
  indicator.style.height = `${Math.round(height)}px`;
  indicator.style.display = 'block';

  // Update floating badge tag text
  const tagText = document.getElementById('bbox-tag-text');
  if (tagText && rec) {
    tagText.textContent = `Evidence Match : ${rec.standard} ${rec.code} (${Math.round(rec.confidence * 100)}% Conf)`;
  }

  // Update footer coordinates
  const coordInfo = document.getElementById('coord-info');
  if (coordInfo && rec) {
    coordInfo.textContent = `Bounding Box: ${rec.coords}`;
  }

  // Sync document page title & thumbnail rail
  if (rec) {
    const docTitle = document.getElementById('pdf-doc-title');
    if (docTitle) {
      docTitle.textContent = `Page ${rec.page} of 52 • Discharge_Summary_Case1042.pdf`;
    }
    document.querySelectorAll('.thumb-card').forEach(t => t.classList.remove('active'));
    const thumb = document.getElementById(`thumb-${rec.page}`);
    if (thumb) thumb.classList.add('active');
  }
}

function renderActiveRecord() {
  const rec = state.records[state.activeRowIndex];
  if (!rec) return;

  // Metadata update
  document.getElementById('meta-offsets').textContent = `Offset ${rec.offsets}`;
  document.getElementById('meta-page').textContent = `Page ${rec.page} of 52`;
  document.getElementById('meta-conf').innerHTML = `Confidence: <strong>${rec.confidence}</strong>`;
  document.getElementById('reviewer-comment').value = rec.comment || '';

  // Update Decision Controls Active State
  const btnCorrect = document.getElementById('btn-decision-correct');
  const btnIncorrect = document.getElementById('btn-decision-incorrect');
  const correctionDrawer = document.getElementById('correction-drawer');

  btnCorrect.classList.toggle('active', rec.decision === 'Correct');
  btnIncorrect.classList.toggle('active', rec.decision === 'Incorrect');
  
  if (rec.decision === 'Incorrect') {
    correctionDrawer.classList.remove('hidden');
    if (rec.reason) {
      document.getElementById('select-incorrect-reason').value = rec.reason;
    }
  } else {
    correctionDrawer.classList.add('hidden');
  }

  // Highlight active row in table
  const rows = document.querySelectorAll('#results-tbody .table-row');
  rows.forEach((row, i) => {
    row.classList.toggle('active', i === state.activeRowIndex);
  });

  // Move the bounding box over to the clicked finding!
  updateBoundingBoxPosition();

  // Scroll ONLY the PDF canvas (NEVER scroll the whole window/application!)
  const target = document.getElementById(`finding-target-${state.activeRowIndex}`);
  if (target) {
    scrollPdfToTarget(target);
  }
}

// DECISION ACTIONS
function markDecision(decisionType) {
  const rec = state.records[state.activeRowIndex];
  rec.decision = decisionType;
  markUnsaved();
  updateDecisionCounts();

  const btnCorrect = document.getElementById('btn-decision-correct');
  const btnIncorrect = document.getElementById('btn-decision-incorrect');
  const correctionDrawer = document.getElementById('correction-drawer');

  if (decisionType === 'Correct') {
    btnCorrect.classList.add('active');
    btnIncorrect.classList.remove('active');
    correctionDrawer.classList.add('hidden');
    if (!rec.comment) {
      document.getElementById('reviewer-comment').value = 'Audited and approved against source PDF evidence.';
      rec.comment = 'Audited and approved against source PDF evidence.';
    }
  } else {
    btnCorrect.classList.remove('active');
    btnIncorrect.classList.add('active');
    correctionDrawer.classList.remove('hidden');
    document.getElementById('reviewer-comment').focus();
  }
}

function handleCommentInput() {
  const rec = state.records[state.activeRowIndex];
  rec.comment = document.getElementById('reviewer-comment').value;
  markUnsaved();
}

function markUnsaved() {
  state.hasUnsavedChanges = true;
  const banner = document.getElementById('unsaved-banner');
  const rec = state.records[state.activeRowIndex];
  document.getElementById('unsaved-doc-id').textContent = `${rec.docId} (${rec.value})`;
  banner.classList.remove('hidden');
}

function hideUnsavedBanner() {
  const banner = document.getElementById('unsaved-banner');
  banner.classList.add('hidden');
}

function saveActiveDecision() {
  const rec = state.records[state.activeRowIndex];
  rec.comment = document.getElementById('reviewer-comment').value;
  
  if (rec.decision === 'Incorrect') {
    rec.reason = document.getElementById('select-incorrect-reason').value;
  }

  // Commit saved state
  rec.savedDecision = rec.decision;

  // Update table chip in DOM
  const chip = document.getElementById(`chip-${state.activeRowIndex}`);
  if (chip) {
    if (rec.decision === 'Correct') {
      chip.className = 'decision-chip correct';
      chip.innerHTML = '<span class="chip-icon">✓</span> Correct';
    } else if (rec.decision === 'Incorrect') {
      chip.className = 'decision-chip incorrect';
      chip.innerHTML = '<span class="chip-icon">✕</span> Incorrect';
    }
  }

  state.hasUnsavedChanges = false;
  hideUnsavedBanner();
  updateDecisionCounts();

  // Visual confirmation feedback
  const saveBtn = document.getElementById('btn-save-decision');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '✓ Saved to Viya Store';
  saveBtn.style.background = '#059669';
  
  setTimeout(() => {
    saveBtn.innerHTML = originalText;
    saveBtn.style.background = '';
  }, 1200);
}

function discardUnsavedChanges() {
  const rec = state.records[state.activeRowIndex];
  if (rec) {
    rec.decision = rec.savedDecision || 'Pending';
  }
  state.hasUnsavedChanges = false;
  hideUnsavedBanner();
  renderActiveRecord();
  updateDecisionCounts();
}

// UNSAVED MODAL HANDLERS
function openUnsavedModal() {
  document.getElementById('unsaved-modal').classList.remove('hidden');
}

function cancelRowSwitch() {
  document.getElementById('unsaved-modal').classList.add('hidden');
  state.pendingRowIndex = null;
  state.pendingScreen = null;
}

function confirmDiscardAndSwitch() {
  document.getElementById('unsaved-modal').classList.add('hidden');
  const rec = state.records[state.activeRowIndex];
  if (rec) {
    rec.decision = rec.savedDecision || 'Pending';
  }
  state.hasUnsavedChanges = false;
  hideUnsavedBanner();
  updateDecisionCounts();

  if (state.pendingRowIndex !== null) {
    commitRowSelection(state.pendingRowIndex);
    state.pendingRowIndex = null;
  } else if (state.pendingScreen) {
    switchScreen(state.pendingScreen);
    state.pendingScreen = null;
  }
}

function saveAndProceed() {
  saveActiveDecision();
  confirmDiscardAndSwitch();
}

// DYNAMIC DECISION & AUDIT COUNTERS
function updateDecisionCounts() {
  const total = state.records.length;
  const correct = state.records.filter(r => r.decision === 'Correct').length;
  const incorrect = state.records.filter(r => r.decision === 'Incorrect').length;
  const pending = state.records.filter(r => r.decision !== 'Correct' && r.decision !== 'Incorrect').length;

  const animateVal = (el, val) => {
    if (!el) return;
    if (el.textContent !== String(val)) {
      el.textContent = val;
      el.classList.remove('count-changed');
      void el.offsetWidth; // trigger reflow for css animation
      el.classList.add('count-changed');
    }
  };

  // Nav Strip Badges
  const badgeTotal = document.getElementById('badge-total-items');
  if (badgeTotal) badgeTotal.textContent = `${total} Entities`;
  animateVal(document.getElementById('count-correct-val'), correct);
  animateVal(document.getElementById('count-incorrect-val'), incorrect);
  animateVal(document.getElementById('count-pending-val'), pending);

  // Results Header Stats Bar
  animateVal(document.getElementById('stat-correct-num'), correct);
  animateVal(document.getElementById('stat-incorrect-num'), incorrect);
  animateVal(document.getElementById('stat-pending-num'), pending);

  // Stepper Subtitle (Step 5 Review)
  const stepReviewSub = document.getElementById('step-subtitle-review');
  if (stepReviewSub) {
    if (pending === 0) {
      stepReviewSub.textContent = `All Audited (${correct} Correct, ${incorrect} Flagged)`;
    } else {
      stepReviewSub.textContent = `${correct}/${total} Correct (${pending} pending)`;
    }
  }
}

// QUICK FILTER TABLE BY STANDARD
function filterTableByStandard(standard, el) {
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(p => p.classList.remove('active'));
  el.classList.add('active');

  const rows = document.querySelectorAll('#results-tbody .table-row');
  rows.forEach((row, i) => {
    const rec = state.records[i];
    if (standard === 'ALL' || rec.standard === standard) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// BOUNDING BOX FALLBACK TOGGLE
function toggleFallbackHighlightState() {
  state.isHighlightFallback = !state.isHighlightFallback;
  const alertBox = document.getElementById('highlight-fallback-alert');
  const btn = document.getElementById('btn-toggle-fallback');

  if (state.isHighlightFallback) {
    alertBox.classList.remove('hidden');
    btn.textContent = 'Restore Bounding-Box Highlight';
  } else {
    alertBox.classList.add('hidden');
    btn.textContent = 'Toggle Bounding-Box Availability';
  }
  updateBoundingBoxPosition();
}

// PDF ZOOM CONTROLS
function zoomPdf(delta) {
  state.currentZoom = Math.max(50, Math.min(200, state.currentZoom + delta));
  applyZoom();
}

function resetZoom() {
  state.currentZoom = 100;
  applyZoom();
}

function applyZoom() {
  const canvas = document.getElementById('document-canvas');
  const zoomText = document.getElementById('zoom-text');
  zoomText.textContent = `${state.currentZoom}%`;
  canvas.style.transform = `scale(${state.currentZoom / 100})`;
  canvas.style.transformOrigin = 'top center';
  setTimeout(updateBoundingBoxPosition, 40);
}

function jumpToPage(pageNum) {
  const canvas = document.getElementById('document-canvas');
  const thumbs = document.querySelectorAll('.thumb-card');
  thumbs.forEach(t => t.classList.remove('active'));
  const currentThumb = document.getElementById(`thumb-${pageNum}`);
  if (currentThumb) currentThumb.classList.add('active');

  document.getElementById('pdf-doc-title').textContent = `Page ${pageNum} of 52 • Discharge_Summary_Case1042.pdf`;
  
  if (canvas) {
    if (pageNum === 38) {
      const page38 = document.getElementById('page-break-38');
      if (page38) {
        const canvasRect = canvas.getBoundingClientRect();
        const p38Rect = page38.getBoundingClientRect();
        const relativeTop = p38Rect.top - canvasRect.top + canvas.scrollTop;
        canvas.scrollTo({ top: Math.max(0, relativeTop - 10), behavior: 'smooth' });
      }
    } else {
      canvas.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  setTimeout(updateBoundingBoxPosition, 250);
}

// AUTOCOMPLETE FOR OVERRIDE CODES
function filterCodeSuggestions(query) {
  const container = document.getElementById('code-suggestions');
  if (!query || query.length < 2) {
    container.classList.add('hidden');
    return;
  }

  const q = query.toLowerCase();
  const matches = state.ontologyDB.filter(item => 
    item.code.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.innerHTML = matches.map(m => `
    <div class="suggestion-item" onclick="selectSuggestion('${m.code}', '${m.desc}')">
      <strong>${m.code}</strong> — ${m.desc} (${m.standard})
    </div>
  `).join('');
  container.classList.remove('hidden');
}

function selectSuggestion(code, desc) {
  document.getElementById('input-search-replacement').value = `${code} - ${desc}`;
  document.getElementById('code-suggestions').classList.add('hidden');
  document.getElementById('reviewer-comment').value = `Replaced with validated code ${code}: ${desc}.`;
  markUnsaved();
}

// DROPZONE & FILE SIMULATION
function triggerFileSelect() {
  document.getElementById('file-input').click();
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    const file = files[0];
    const pill = document.getElementById('staged-file-pill');
    pill.querySelector('.file-name').textContent = `${file.name} (${(file.size / (1024*1024)).toFixed(1)} MB)`;
    pill.style.display = 'inline-flex';
  }
}

function updateOcrEngine(radio) {
  const cards = document.querySelectorAll('.ocr-card');
  cards.forEach(c => c.classList.remove('active'));
  radio.closest('.ocr-card').classList.add('active');
}

function validateLauncherContext() {
  const feedback = document.getElementById('validation-feedback');
  const btn = document.getElementById('btn-validate-context');
  btn.textContent = 'Testing context...';
  
  setTimeout(() => {
    btn.textContent = 'Validate context';
    feedback.className = 'feedback-msg success';
    feedback.innerHTML = '✓ SAS Launcher Context authenticated on Viya Kubernetes (Pod: <code>viya-compute-02</code>, TLS 1.3 encrypted)';
    feedback.classList.remove('hidden');
  }, 600);
}

// SIMULATED RUN CONTROLLER
let elapsedTimer = null;
let elapsedSeconds = 0;

function startSimulatedRun() {
  const btn = document.getElementById('btn-start-run');
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="dot-pulse" style="display:inline-block; margin-right:6px;"></span> Executing Flow...';

  // Update telemetry & status badge
  const badge = document.getElementById('pipeline-run-badge');
  badge.className = 'badge badge-active';
  badge.innerHTML = '<span class="dot-pulse"></span> Active Execution';

  const runIdEl = document.getElementById('telem-run-id');
  if (runIdEl) runIdEl.textContent = 'RUN-8924-VIYA-SDA';

  const nodeEl = document.getElementById('telem-assigned-node');
  if (nodeEl) nodeEl.textContent = 'viya-worker-gpu-03 (Allocated)';

  const footerStatus = document.getElementById('pipeline-footer-status');
  if (footerStatus) footerStatus.innerHTML = '<span class="dot-pulse"></span> Flow executing on Viya Kubernetes cluster...';

  // Start elapsed timer
  elapsedSeconds = 0;
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    elapsedSeconds++;
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    const elapsedEl = document.getElementById('telem-elapsed');
    if (elapsedEl) elapsedEl.textContent = `00:${mins}:${secs}`;
  }, 1000);

  // Stepper elements
  const scUpload = document.getElementById('step-card-upload');
  const scOcr = document.getElementById('step-card-ocr');
  const scExtract = document.getElementById('step-card-extract');
  const scCode = document.getElementById('step-card-code');
  const scReview = document.getElementById('step-card-review');

  // Timeline elements
  const tl1 = document.getElementById('tl-step-1');
  const tl2 = document.getElementById('tl-step-2');
  const tl3 = document.getElementById('tl-step-3');
  const tl4 = document.getElementById('tl-step-4');
  const tl5 = document.getElementById('tl-step-5');
  const extractBar = document.getElementById('extract-progress-fill');

  // STAGE 1: Upload & scan
  if (scUpload) {
    scUpload.className = 'step-card running';
    scUpload.querySelector('.step-icon').textContent = '●';
    scUpload.querySelector('.step-subtitle').textContent = 'Uploading batch...';
  }
  if (tl1) {
    tl1.className = 'timeline-step step-running';
    tl1.querySelector('.tl-node').textContent = '●';
    tl1.querySelector('.tl-status').className = 'tl-status status-running';
    tl1.querySelector('.tl-status').textContent = '● Running (1.8s)';
  }

  // STAGE 2: SDA OCR .flw (at 900ms)
  setTimeout(() => {
    if (scUpload) {
      scUpload.className = 'step-card completed';
      scUpload.querySelector('.step-icon').textContent = '✓';
      scUpload.querySelector('.step-subtitle').textContent = 'PDF batch (4.2 MB)';
    }
    if (tl1) {
      tl1.className = 'timeline-step step-done';
      tl1.querySelector('.tl-node').textContent = '✓';
      tl1.querySelector('.tl-status').className = 'tl-status status-done';
      tl1.querySelector('.tl-status').textContent = '✓ Completed (1.8s)';
    }
    if (scOcr) {
      scOcr.className = 'step-card running';
      scOcr.querySelector('.step-icon').textContent = '●';
      scOcr.querySelector('.step-subtitle').textContent = 'Parsing layout...';
    }
    if (tl2) {
      tl2.className = 'timeline-step step-running';
      tl2.querySelector('.tl-node').textContent = '●';
      tl2.querySelector('.tl-status').className = 'tl-status status-running';
      tl2.querySelector('.tl-status').textContent = '● Running (52 pages)';
    }
  }, 900);

  // STAGE 3: HRR Extraction (at 1900ms)
  setTimeout(() => {
    if (scOcr) {
      scOcr.className = 'step-card completed';
      scOcr.querySelector('.step-icon').textContent = '✓';
      scOcr.querySelector('.step-subtitle').textContent = 'SDA .flw (52 p.)';
    }
    if (tl2) {
      tl2.className = 'timeline-step step-done';
      tl2.querySelector('.tl-node').textContent = '✓';
      tl2.querySelector('.tl-status').className = 'tl-status status-done';
      tl2.querySelector('.tl-status').textContent = '✓ Completed (14.2s)';
    }
    if (scExtract) {
      scExtract.className = 'step-card running';
      scExtract.querySelector('.step-icon').textContent = '●';
      scExtract.querySelector('.step-subtitle').textContent = 'Extracting entities...';
    }
    if (tl3) {
      tl3.className = 'timeline-step step-running';
      tl3.querySelector('.tl-node').textContent = '●';
      tl3.querySelector('.tl-status').className = 'tl-status status-running';
      tl3.querySelector('.tl-status').textContent = '● Running';
    }
    if (extractBar) extractBar.style.width = '65%';
  }, 1900);

  // STAGE 4: VLM Coding (at 2900ms)
  setTimeout(() => {
    if (scExtract) {
      scExtract.className = 'step-card completed';
      scExtract.querySelector('.step-icon').textContent = '✓';
      scExtract.querySelector('.step-subtitle').textContent = 'HRR .flw (4 entities)';
    }
    if (tl3) {
      tl3.className = 'timeline-step step-done';
      tl3.querySelector('.tl-node').textContent = '✓';
      tl3.querySelector('.tl-status').className = 'tl-status status-done';
      tl3.querySelector('.tl-status').textContent = '✓ Completed (48s)';
    }
    if (extractBar) extractBar.style.width = '100%';

    if (scCode) {
      scCode.className = 'step-card running';
      scCode.querySelector('.step-icon').textContent = '●';
      scCode.querySelector('.step-subtitle').textContent = 'VLM coding...';
    }
    if (tl4) {
      tl4.className = 'timeline-step step-running';
      tl4.querySelector('.tl-node').textContent = '●';
      tl4.querySelector('.tl-status').className = 'tl-status status-running';
      tl4.querySelector('.tl-status').textContent = '● Running (ICD/SNOMED)';
    }
  }, 2900);

  // STAGE 5: Ready for Review (at 3900ms)
  setTimeout(() => {
    if (scCode) {
      scCode.className = 'step-card completed';
      scCode.querySelector('.step-icon').textContent = '✓';
      scCode.querySelector('.step-subtitle').textContent = 'VLM .flw (Mapped)';
    }
    if (tl4) {
      tl4.className = 'timeline-step step-done';
      tl4.querySelector('.tl-node').textContent = '✓';
      tl4.querySelector('.tl-status').className = 'tl-status status-done';
      tl4.querySelector('.tl-status').textContent = '✓ Completed (32s)';
    }
    if (scReview) {
      scReview.className = 'step-card active';
      scReview.innerHTML = `
        <div class="step-icon">⚠</div>
        <div class="step-details">
          <div class="step-title">5 Review</div>
          <div class="step-subtitle">Verify + save</div>
        </div>
        <span class="active-pill">Needs Review</span>
      `;
    }
    if (tl5) {
      tl5.className = 'timeline-step step-done';
      tl5.querySelector('.tl-node').textContent = '✓';
      tl5.querySelector('.tl-status').className = 'tl-status status-done';
      tl5.querySelector('.tl-status').textContent = '✓ Ready for review';
      tl5.querySelector('.tl-meta').textContent = '4 clinical entities extracted & validated for review';
    }

    if (badge) {
      badge.className = 'badge badge-success';
      badge.innerHTML = '✓ Complete';
    }

    if (elapsedTimer) clearInterval(elapsedTimer);

    btn.className = 'btn btn-success';
    btn.disabled = false;
    btn.innerHTML = 'Handoff to Reviewer (4 Entities) ➔';
    btn.onclick = () => switchScreen('review');

    if (footerStatus) {
      footerStatus.innerHTML = '<span class="dot-ok"></span> All 5 pipeline stages completed. Ready for clinical auditor review.';
    }
  }, 3900);
}

// KEYBOARD ACCELERATORS
function setupKeyboardListeners() {
  window.addEventListener('keydown', (e) => {
    // If typing in comment or input, avoid trigger
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      if (e.key === 'Enter' && e.ctrlKey) {
        saveActiveDecision();
      }
      return;
    }

    if (e.key === '1') {
      markDecision('Correct');
    } else if (e.key === '2') {
      markDecision('Incorrect');
    } else if (e.key === 'Enter' && e.ctrlKey) {
      saveActiveDecision();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(state.records.length - 1, state.activeRowIndex + 1);
      selectRow(nextIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(0, state.activeRowIndex - 1);
      selectRow(prevIndex);
    } else if (e.key === '?' && !e.ctrlKey) {
      openShortcutsModal();
    } else if (e.key === 'Escape') {
      closeShortcutsModal();
      document.getElementById('unsaved-modal').classList.add('hidden');
    }
  });
}

function openShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.remove('hidden');
}

function closeShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('hidden');
}
