/**
 * Policy Builder — Vue 3 + PrimeVue App (CDN, Composition API)
 * All components defined in this single file.
 */
const { createApp, ref, computed, watch, onMounted, onBeforeUnmount, nextTick, toRaw } = Vue;

// ─── Storage Helpers ────────────────────────────────────────
const STORAGE_INDEX_KEY = 'policy-builder-index';
const STORAGE_DOC_PREFIX = 'policy-builder-doc-';

function loadIndex() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_INDEX_KEY)) || [];
  } catch { return []; }
}

function saveIndex(index) {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index)); // may throw QuotaExceededError
}

function loadDocument(id) {
  return localStorage.getItem(STORAGE_DOC_PREFIX + id) || '';
}

function saveDocument(id, mdString) {
  localStorage.setItem(STORAGE_DOC_PREFIX + id, mdString);
}

function removeDocument(id) {
  localStorage.removeItem(STORAGE_DOC_PREFIX + id);
}

function generateId() {
  return crypto.randomUUID();
}

// ─── Debounce utility ───────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

// ─── SVG sanitization (strip scripts, event handlers, foreignObject) ──
function sanitizeSvg(svgString) {
  if (!svgString) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return '';
  svg.querySelectorAll('script, foreignObject').forEach(el => el.remove());
  for (const el of svg.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
  }
  for (const attr of [...svg.attributes]) {
    if (attr.name.startsWith('on')) svg.removeAttribute(attr.name);
  }
  return svg.outerHTML;
}

// ─── SVG extraction from logo value ─────────────────────────
async function extractSvgFromLogo(logoValue) {
  if (!logoValue) return '';
  if (logoValue.startsWith('data:image/svg+xml;base64,')) {
    try { return sanitizeSvg(atob(logoValue.split(',')[1])); } catch { return ''; }
  }
  if (logoValue.startsWith('data:image/svg+xml,')) {
    try { return sanitizeSvg(decodeURIComponent(logoValue.split(',')[1])); } catch { return ''; }
  }
  if (logoValue.startsWith('https://') || logoValue.startsWith('http://')) {
    try {
      const resp = await fetch(logoValue);
      const text = await resp.text();
      if (text.includes('<svg')) return sanitizeSvg(text);
      return '';
    } catch { return ''; }
  }
  return '';
}

// ─── File download helper ───────────────────────────────────
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── MarkdownEditor Component ───────────────────────────────
const MarkdownEditor = {
  name: 'MarkdownEditor',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<div style="height:100%"><textarea ref="editorRef"></textarea></div>`,
  setup(props, { emit }) {
    const editorRef = ref(null);
    let editorInstance = null;
    let isUpdating = false;

    onMounted(() => {
      editorInstance = new EasyMDE({
        element: editorRef.value,
        initialValue: props.modelValue || '',
        spellChecker: false,
        minHeight: '420px',
        placeholder: 'Start writing your policy in markdown...',
        toolbar: [
          'bold', 'italic', 'heading', '|',
          'quote', 'unordered-list', 'ordered-list', '|',
          'link', 'image', 'table', '|',
          'guide',
        ],
        status: false,
      });

      editorInstance.codemirror.on('change', () => {
        if (isUpdating) return;
        emit('update:modelValue', editorInstance.value());
      });
    });

    watch(() => props.modelValue, (newVal) => {
      if (!editorInstance) return;
      const current = editorInstance.value();
      if (current !== newVal) {
        isUpdating = true;
        editorInstance.value(newVal || '');
        isUpdating = false;
      }
    });

    onBeforeUnmount(() => {
      if (editorInstance) {
        editorInstance.toTextArea();
        editorInstance = null;
      }
    });

    return { editorRef };
  },
};

// ─── PdfPreview Component (iframe with real PDF) ────────────
const PdfPreview = {
  name: 'PdfPreview',
  props: ['title', 'logoSvg', 'versions', 'pdfStyles', 'markdownBody', 'pageSize'],
  template: `
    <div style="height:100%; display:flex; flex-direction:column; background:#f5f5f5">
      <div v-if="loading" style="display:flex; align-items:center; justify-content:center; height:100%; color:#64748b">
        <div style="text-align:center">
          <i class="pi pi-spin pi-spinner" style="font-size:24px; display:block; margin-bottom:8px"></i>
          <span style="font-size:13px">Generating preview...</span>
        </div>
      </div>
      <iframe v-show="!loading && pdfUrl" :src="pdfUrl" style="width:100%; flex:1; border:none"></iframe>
      <div v-if="!loading && !pdfUrl && error" style="display:flex; align-items:center; justify-content:center; height:100%; color:#dc2626; padding:20px; text-align:center">
        <span style="font-size:13px">{{ error }}</span>
      </div>
    </div>
  `,
  setup(props) {
    const pdfUrl = ref('');
    const loading = ref(true);
    const error = ref('');
    let alive = true;

    const regenerate = debounce(async () => {
      if (!alive) return;
      loading.value = true;
      error.value = '';
      try {
        const blob = await PdfGenerator.getBlob({
          title: props.title,
          logoSvg: props.logoSvg,
          versions: toRaw(props.versions),
          pdfStyles: toRaw(props.pdfStyles),
          markdown: props.markdownBody,
          pageSize: props.pageSize,
        });
        if (!alive) return;
        if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
        pdfUrl.value = URL.createObjectURL(blob);
      } catch (e) {
        console.error('PDF preview error:', e);
        if (alive) error.value = 'Failed to generate preview.';
      }
      if (alive) loading.value = false;
    }, 800);

    watch(
      [() => props.title, () => props.logoSvg, () => props.versions, () => props.pdfStyles, () => props.markdownBody, () => props.pageSize],
      regenerate,
      { deep: true, immediate: true }
    );

    onBeforeUnmount(() => {
      alive = false;
      regenerate.cancel();
      if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
    });

    return { pdfUrl, loading, error };
  },
};

// ─── StylePanel Component ───────────────────────────────────
const StylePanel = {
  name: 'StylePanel',
  props: ['pdfStyles'],
  emits: ['update:pdfStyles', 'applyColorsToAll'],
  template: `
    <div>
      <!-- Color Theme Palette -->
      <span class="sidebar-label">Color Theme</span>
      <div style="display:flex; gap:6px; margin-bottom:16px">
        <div v-for="p in palettes" :key="p.label"
          :title="p.label"
          style="width:26px; height:26px; border-radius:50%; cursor:pointer; border:3px solid transparent; transition: all 0.15s; flex-shrink:0"
          :style="{ backgroundColor: p.swatch, borderColor: isActivePalette(p) ? '#0f172a' : 'transparent', transform: isActivePalette(p) ? 'scale(1.15)' : '' }"
          @click="applyPalette(p)"
        ></div>
      </div>

      <!-- Heading Sizes -->
      <span class="sidebar-label">Heading Sizes</span>
      <div style="display:flex; flex-direction:column; gap:4px">
        <div v-for="key in headingKeys" :key="key" class="style-heading-row">
          <label>{{ key }}</label>
          <div style="width:14px; height:14px; border-radius:3px; flex-shrink:0" :style="{ backgroundColor: merged[key].color }"></div>
          <div style="display:flex; align-items:center; gap:4px">
            <input
              type="number"
              :value="parseInt(merged[key].size)"
              @input="updateSize(key, $event.target.value + 'px')"
              style="width:48px; border:1px solid #e0e0e0; padding:4px 6px; font-size:12px; border-radius:4px; text-align:center"
              min="8" max="72"
            >
            <span style="font-size:10px; color:#94a3b8">px</span>
          </div>
        </div>
        <div class="style-heading-row">
          <label>Body</label>
          <div style="width:14px; height:14px; border-radius:3px; flex-shrink:0" :style="{ backgroundColor: merged.body.color }"></div>
          <div style="display:flex; align-items:center; gap:4px">
            <input
              type="number"
              :value="parseInt(merged.body.size)"
              @input="updateBodySize($event.target.value + 'px')"
              style="width:48px; border:1px solid #e0e0e0; padding:4px 6px; font-size:12px; border-radius:4px; text-align:center"
              min="8" max="72"
            >
            <span style="font-size:10px; color:#94a3b8">px</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px">
        <p-button label="Apply Colors to All Docs" icon="pi pi-palette" severity="secondary" size="small" outlined @click="$emit('applyColorsToAll')" />
        <p-button label="Reset to Defaults" severity="secondary" size="small" outlined @click="resetToDefaults" />
      </div>
    </div>
  `,
  setup(props, { emit }) {
    const headingKeys = StyleManager.HEADING_KEYS;
    const palettes = StyleManager.COLOR_PALETTES;

    const merged = computed(() => StyleManager.mergeStyles(props.pdfStyles));

    function isActivePalette(p) {
      return merged.value.h1.color.toLowerCase() === p.h1.toLowerCase();
    }

    function emitStyles(updated) {
      emit('update:pdfStyles', { ...updated });
    }

    function applyPalette(p) {
      const current = { ...props.pdfStyles };
      for (const key of headingKeys) {
        current[key] = { ...(current[key] || {}), color: p[key] };
      }
      emitStyles(current);
    }

    function updateSize(key, value) {
      const current = { ...props.pdfStyles };
      if (!current[key]) current[key] = {};
      current[key] = { ...current[key], size: value };
      emitStyles(current);
    }

    function updateBodySize(value) {
      const current = { ...props.pdfStyles };
      if (!current.body) current.body = {};
      current.body = { ...current.body, size: value };
      emitStyles(current);
    }

    function resetToDefaults() {
      emitStyles({});
    }

    return {
      headingKeys, palettes, merged,
      isActivePalette, applyPalette, updateSize, updateBodySize, resetToDefaults,
    };
  },
};

// ─── App Root ───────────────────────────────────────────────
const App = {
  components: { MarkdownEditor, PdfPreview, StylePanel },
  template: `
    <div style="height:100vh; display:flex; flex-direction:column; overflow:hidden">
      <p-toast />
      <p-confirmdialog />

      <!-- Toolbar -->
      <p-toolbar style="border-radius:0; border-left:0; border-right:0; border-top:0; padding:8px 16px">
        <template #start>
          <div style="display:flex; align-items:center; gap:12px">
            <div style="display:flex; align-items:center; gap:8px">
              <div style="width:28px; height:28px; border-radius:8px; background:#0f172a; display:flex; align-items:center; justify-content:center">
                <span style="color:#fff; font-size:12px; font-weight:700">P</span>
              </div>
              <span style="font-size:14px; font-weight:600; color:#334155">Policy Builder</span>
            </div>
            <div style="width:1px; height:24px; background:#e2e8f0"></div>
            <p-select
              :modelValue="currentDocId"
              @update:modelValue="selectDocument"
              :options="docOptions"
              optionLabel="title"
              optionValue="id"
              placeholder="Select document..."
              style="min-width:220px"
            >
              <template #option="{ option }">
                <div style="line-height:1.3">
                  <div style="font-size:13px">{{ option.title }}</div>
                  <div v-if="option.lastModified" style="font-size:10px; color:#94a3b8">{{ formatTimestamp(option.lastModified) }}</div>
                </div>
              </template>
            </p-select>
            <p-button icon="pi pi-plus" severity="success" size="small" outlined @click="createDocument" />
            <p-button icon="pi pi-trash" severity="danger" size="small" outlined @click="confirmDeleteDoc" :disabled="documents.length <= 1" />
          </div>
        </template>
        <template #end>
          <div style="display:flex; align-items:center; gap:8px">
            <label>
              <p-button icon="pi pi-upload" label="Upload" severity="secondary" size="small" outlined @click="triggerUpload" />
              <input ref="fileInput" type="file" accept=".md,.markdown,.txt" @change="onFileUpload" style="display:none">
            </label>
            <p-splitbutton label="Download" icon="pi pi-download" severity="secondary" size="small" outlined @click="onDownloadMd" :model="downloadMenuItems" />
            <p-button icon="pi pi-file-pdf" label="Export PDF" size="small" @click="onDownloadPdf" />
            <div style="width:1px; height:24px; background:#e2e8f0; margin:0 4px"></div>
            <p-selectbutton
              :modelValue="mode"
              @update:modelValue="val => { if (val) mode = val }"
              :options="modeOptions"
              optionLabel="label"
              optionValue="value"
              :allowEmpty="false"
            />
            <p-button icon="pi pi-question-circle" label="Guide" severity="secondary" size="small" outlined @click="showGuide" title="Formatting Guide" />
          </div>
        </template>
      </p-toolbar>

      <!-- Formatting Guide Dialog -->
      <p-dialog v-model:visible="guideVisible" header="Formatting Guide" :style="{ width: '720px', maxHeight: '85vh' }" modal :dismissableMask="true">
        <div v-html="guideHtml" style="font-size:13px; line-height:1.7; color:#334155; overflow-y:auto; max-height:70vh; padding-right:8px" class="scrollbar-thin guide-content"></div>
      </p-dialog>

      <!-- Main content area -->
      <div style="flex:1; display:flex; overflow:hidden; min-height:0">
        <!-- Left: Editor or Preview -->
        <div style="flex:1; overflow-y:auto; overflow-x:hidden; min-width:0" class="scrollbar-thin">
          <MarkdownEditor
            v-if="mode === 'edit'"
            v-model="markdownBody"
          />
          <PdfPreview
            v-else
            :title="title"
            :logoSvg="logoSvg"
            :versions="versions"
            :pdfStyles="pdfStyles"
            :markdownBody="markdownBody"
            :pageSize="pageSize"
          />
        </div>

        <!-- Right sidebar -->
        <div style="width:360px; flex-shrink:0; border-left:1px solid var(--p-surface-200); overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:4px" class="scrollbar-thin">

          <!-- Metadata (disabled in preview) -->
          <div :style="mode === 'read' ? 'opacity:0.45; pointer-events:none' : ''">
            <div>
              <span class="sidebar-label">Policy Title</span>
              <p-inputtext v-model="title" placeholder="e.g. Information Security Policy" fluid size="small" />
              <div v-if="created || updated" style="font-size:11px; color:#94a3b8; margin-top:4px">
                <span v-if="created">Created: {{ formatTimestamp(created) }}</span>
                <span v-if="created && updated"> &middot; </span>
                <span v-if="updated">Updated: {{ formatTimestamp(updated) }}</span>
              </div>
            </div>
            <div style="margin-top:8px">
              <span class="sidebar-label">Logo (SVG)</span>
              <div style="display:flex; gap:8px; align-items:flex-start">
                <p-inputtext v-model="logo" placeholder="https://example.com/logo.svg" fluid size="small" style="flex:1" />
                <label>
                  <p-button icon="pi pi-upload" severity="secondary" size="small" outlined @click="triggerLogoUpload" title="Upload SVG file" />
                  <input ref="logoInput" type="file" accept=".svg,image/svg+xml" @change="onLogoUpload" style="display:none">
                </label>
              </div>
              <div v-if="logoSvg" style="margin-top:6px; padding:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; text-align:center">
                <div v-html="logoPreviewHtml" style="max-height:48px; overflow:hidden"></div>
              </div>
              <p-button v-if="logo && documents.length > 1" label="Apply Logo to All Docs" icon="pi pi-images" severity="secondary" size="small" text style="margin-top:4px; padding:4px 0; font-size:12px" @click="applyLogoToAllDocs" />
            </div>

            <p-divider />

            <!-- Version Table -->
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
                <span class="sidebar-label" style="margin-bottom:0">Version History</span>
                <p-button icon="pi pi-plus" label="Add" severity="success" size="small" outlined @click="addVersion" />
              </div>
              <div v-if="versions.length > 0" style="max-height:200px; overflow-y:auto" class="scrollbar-thin">
                <table style="width:100%; border-collapse:collapse; font-size:13px">
                  <thead>
                    <tr style="border-bottom:1px solid var(--p-surface-200)">
                      <th style="text-align:left; padding:6px 8px; font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8">Version</th>
                      <th style="text-align:left; padding:6px 8px; font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8">Date</th>
                      <th style="text-align:left; padding:6px 8px; font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8">Updated By</th>
                      <th style="width:36px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(v, i) in reversedVersions" :key="v._origIndex" style="border-bottom:1px solid var(--p-surface-100)">
                      <td style="padding:4px 8px">
                        <input :value="v.version" @input="e => { versions[v._origIndex].version = e.target.value; emitVersions() }" placeholder="1.0"
                          style="border:none; border-bottom:1px solid transparent; padding:4px 0; width:100%; font-size:13px; background:transparent; outline:none"
                        >
                      </td>
                      <td style="padding:4px 8px">
                        <input :value="v.date" @input="e => { versions[v._origIndex].date = e.target.value; emitVersions() }" placeholder="YYYY-MM-DD" type="date"
                          style="border:none; border-bottom:1px solid transparent; padding:4px 0; width:100%; font-size:13px; background:transparent; outline:none"
                        >
                      </td>
                      <td style="padding:4px 8px">
                        <input :value="v.updatedBy" @input="e => { versions[v._origIndex].updatedBy = e.target.value; emitVersions() }" placeholder="Name"
                          style="border:none; border-bottom:1px solid transparent; padding:4px 0; width:100%; font-size:13px; background:transparent; outline:none"
                        >
                      </td>
                      <td style="padding:4px; text-align:center">
                        <p-button icon="pi pi-times" severity="danger" text rounded size="small" @click="removeVersion(v._origIndex)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else style="font-size:13px; color:#94a3b8; padding:8px 0">No versions added yet.</div>
            </div>
          </div>

          <p-divider />

          <!-- Page Size (always enabled — changes rerender preview) -->
          <div>
            <span class="sidebar-label">Page Size</span>
            <p-select
              v-model="pageSize"
              :options="pageSizeOptions"
              optionLabel="label"
              optionValue="value"
              fluid
              size="small"
            />
          </div>

          <p-divider />

          <!-- PDF Styles (disabled in preview) -->
          <div :style="mode === 'read' ? 'opacity:0.45; pointer-events:none' : ''">
            <p-panel header="PDF Export Styles" toggleable collapsed>
              <StylePanel
                :pdfStyles="pdfStyles"
                @update:pdfStyles="pdfStyles = $event"
                @applyColorsToAll="applyColorsToAllDocs"
              />
            </p-panel>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const toast = PrimeVue.useToast();
    const confirmSvc = PrimeVue.useConfirm();

    const mode = ref('edit');
    const title = ref('');
    const logo = ref('');
    const logoSvg = ref('');
    const versions = ref([]);
    const pdfStyles = ref({});
    const markdownBody = ref('');
    const pageSize = ref('Legal');
    const created = ref('');
    const updated = ref('');
    const currentDocId = ref('');
    const documents = ref([]);
    const fileInput = ref(null);
    const logoInput = ref(null);
    const guideVisible = ref(false);
    const guideHtml = ref('');

    const modeOptions = [
      { label: 'Edit', value: 'edit' },
      { label: 'Preview', value: 'read' },
    ];

    const pageSizeOptions = Object.entries(PdfGenerator.PAGE_CONFIGS).map(([key, val]) => ({
      label: val.label,
      value: key,
    }));

    const downloadMenuItems = [
      { label: 'Download All', icon: 'pi pi-file-export', command: () => onDownloadAll() },
    ];

    function formatTimestamp(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return iso; }
    }

    const docOptions = computed(() =>
      documents.value.map(d => ({
        id: d.id,
        title: d.title || 'Untitled',
        lastModified: d.lastModified || '',
      })).sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
    );

    const reversedVersions = computed(() =>
      versions.value.map((v, i) => ({ ...v, _origIndex: i })).reverse()
    );

    const logoPreviewHtml = computed(() => {
      if (!logoSvg.value) return '';
      return `<div style="display:inline-block; max-width:120px; max-height:48px">${sanitizeSvg(logoSvg.value)}</div>`;
    });

    const extractLogo = debounce(async (url) => {
      logoSvg.value = await extractSvgFromLogo(url);
    }, 500);

    watch(logo, (url) => extractLogo(url));

    onMounted(() => {
      documents.value = loadIndex();
      if (documents.value.length > 0) {
        selectDocument(documents.value[0].id);
      } else {
        createDocument();
      }
    });

    const isLoadingDoc = ref(false);

    const autoSave = debounce(() => {
      if (!currentDocId.value) return;
      updated.value = new Date().toISOString();
      const metadata = {
        title: title.value,
        logo: logo.value,
        versions: toRaw(versions.value),
        pdfStyles: toRaw(pdfStyles.value),
        pageSize: pageSize.value,
        created: created.value,
        updated: updated.value,
      };
      const md = MdParser.serialize(metadata, markdownBody.value);
      try {
        saveDocument(currentDocId.value, md);
        const idx = documents.value.findIndex(d => d.id === currentDocId.value);
        if (idx !== -1) {
          documents.value[idx].title = title.value || 'Untitled';
          documents.value[idx].lastModified = updated.value;
          saveIndex(toRaw(documents.value));
        }
      } catch (e) {
        console.error('Auto-save failed:', e);
        toast.add({ severity: 'error', summary: 'Storage Full', detail: 'Could not save. Try deleting unused documents.', life: 5000 });
      }
    }, 500);

    watch([title, logo, versions, pdfStyles, markdownBody, pageSize], autoSave, { deep: true });

    // Auto-add version only on content edits (title/body), not metadata changes
    watch([title, markdownBody], () => {
      if (!currentDocId.value || isLoadingDoc.value) return;
      autoAddVersionIfNeeded();
    });

    function loadDocumentState(mdString) {
      const parsed = MdParser.parse(mdString);
      title.value = parsed.title;
      logo.value = parsed.logo;
      versions.value = parsed.versions;
      pdfStyles.value = parsed.pdfStyles;
      pageSize.value = parsed.pageSize || 'Legal';
      created.value = parsed.created || '';
      updated.value = parsed.updated || '';
      markdownBody.value = parsed.body;
    }

    function selectDocument(id) {
      currentDocId.value = id;
      isLoadingDoc.value = true;
      const md = loadDocument(id);
      loadDocumentState(md);
      nextTick(() => { isLoadingDoc.value = false; });
    }

    function autoAddVersionIfNeeded() {
      const today = new Date().toISOString().split('T')[0];
      const last = versions.value.length > 0 ? versions.value[versions.value.length - 1] : null;
      if (!last || last.date !== today) {
        let nextVersion = '1.0';
        if (last && last.version) {
          const match = last.version.trim().match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1]) + 1;
            nextVersion = last.version.trim().slice(0, match.index) + num;
          } else {
            nextVersion = last.version.trim() + '.1';
          }
        }
        versions.value.push({ version: nextVersion, date: today, updatedBy: last ? last.updatedBy : '' });
      }
    }

    function createDocument() {
      const id = generateId();
      const now = new Date().toISOString();

      // Copy logo & colors from the most recently modified doc
      let templateLogo = '';
      let templateStyles = {};
      if (documents.value.length > 0) {
        const sorted = [...documents.value].sort((a, b) =>
          (b.lastModified || '').localeCompare(a.lastModified || '')
        );
        const latestMd = loadDocument(sorted[0].id);
        const latestParsed = MdParser.parse(latestMd);
        templateLogo = latestParsed.logo;
        templateStyles = latestParsed.pdfStyles;
      }

      const doc = { id, title: 'Untitled', created: now, lastModified: now };
      documents.value.push(doc);
      saveIndex(toRaw(documents.value));
      saveDocument(id, '');
      currentDocId.value = id;
      title.value = '';
      logo.value = templateLogo;
      const today = now.split('T')[0];
      versions.value = [{ version: '1.0', date: today, updatedBy: 'Reviewer' }];
      pdfStyles.value = templateStyles;
      pageSize.value = 'Legal';
      created.value = now;
      updated.value = now;
      markdownBody.value = '';
    }

    function confirmDeleteDoc() {
      if (documents.value.length <= 1) return;
      confirmSvc.require({
        message: 'Delete this document? This cannot be undone.',
        header: 'Confirm Delete',
        acceptClass: 'p-button-danger',
        accept: () => deleteDocument(currentDocId.value),
      });
    }

    function deleteDocument(id) {
      documents.value = documents.value.filter(d => d.id !== id);
      saveIndex(toRaw(documents.value));
      removeDocument(id);
      if (documents.value.length > 0) {
        selectDocument(documents.value[0].id);
      } else {
        createDocument();
      }
    }

    function triggerUpload() {
      fileInput.value?.click();
    }

    function triggerLogoUpload() {
      logoInput.value?.click();
    }

    function onFileUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result;
        const parts = MdParser.splitMultiDoc(content);
        if (parts.length === 1) {
          // Single doc — load into current
          loadDocumentState(parts[0]);
        } else {
          // Multi-doc — create a new doc for each
          for (const part of parts) {
            const parsed = MdParser.parse(part);
            const id = generateId();
            const now = new Date().toISOString();
            const doc = { id, title: parsed.title || 'Imported', created: parsed.created || now, lastModified: parsed.updated || now };
            documents.value.push(doc);
            saveDocument(id, part);
          }
          saveIndex(toRaw(documents.value));
          // Select the first imported doc
          const firstNew = documents.value[documents.value.length - parts.length];
          if (firstNew) selectDocument(firstNew.id);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    function onLogoUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const svgText = reader.result;
        if (!svgText.includes('<svg')) {
          alert('Please upload a valid SVG file.');
          return;
        }
        logoSvg.value = sanitizeSvg(svgText);
        const encoded = new TextEncoder().encode(svgText);
        const binary = Array.from(encoded, b => String.fromCharCode(b)).join('');
        logo.value = 'data:image/svg+xml;base64,' + btoa(binary);
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    function onDownloadMd() {
      const metadata = {
        title: title.value,
        logo: logo.value,
        versions: toRaw(versions.value),
        pdfStyles: toRaw(pdfStyles.value),
        pageSize: pageSize.value,
        created: created.value,
        updated: updated.value,
      };
      const md = MdParser.serialize(metadata, markdownBody.value);
      const safeName = (title.value || 'Policy').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Policy';
      downloadFile(`${safeName}.md`, md, 'text/markdown');
    }

    function onDownloadAll() {
      const docs = [];
      for (const doc of documents.value) {
        const md = loadDocument(doc.id);
        if (md) docs.push(md);
      }
      const combined = MdParser.joinMultiDoc(docs);
      downloadFile('all-policies.md', combined, 'text/markdown');
    }

    async function onDownloadPdf() {
      try {
        await PdfGenerator.generate({
          title: title.value,
          logoSvg: logoSvg.value,
          versions: toRaw(versions.value),
          pdfStyles: toRaw(pdfStyles.value),
          markdown: markdownBody.value,
          pageSize: pageSize.value,
        });
      } catch (e) {
        console.error('PDF export error:', e);
        toast.add({ severity: 'error', summary: 'PDF Export Failed', detail: e.message || 'Unknown error', life: 5000 });
      }
    }

    function addVersion() {
      const today = new Date().toISOString().split('T')[0];
      let nextVersion = '1.0';
      if (versions.value.length > 0) {
        const last = (versions.value[versions.value.length - 1].version || '').trim();
        if (last) {
          // Find trailing number: "v2" → 2, "1.3" → 3, "rev-5" → 5, "abc" → none
          const match = last.match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1]) + 1;
            nextVersion = last.slice(0, match.index) + num;
          } else {
            // No trailing number — append .1
            nextVersion = last + '.1';
          }
        }
      }
      const lastUpdatedBy = versions.value.length > 0 ? (versions.value[versions.value.length - 1].updatedBy || '') : '';
      versions.value.push({ version: nextVersion, date: today, updatedBy: lastUpdatedBy });
    }

    function removeVersion(index) {
      versions.value.splice(index, 1);
    }

    function emitVersions() {
      versions.value = [...versions.value];
    }

    // ─── Apply to All Documents ───────────────────────────
    function applyColorsToAllDocs() {
      const count = documents.value.length - 1;
      if (count < 1) return;
      confirmSvc.require({
        message: `Apply current heading colors to ${count} other document${count > 1 ? 's' : ''}? This cannot be undone.`,
        header: 'Apply Colors to All',
        accept: () => {
          const currentStyles = toRaw(pdfStyles.value);
          const colorOverrides = {};
          const merged = StyleManager.mergeStyles(currentStyles);
          for (const key of [...StyleManager.HEADING_KEYS, 'body']) {
            colorOverrides[key] = { color: merged[key].color };
          }
          for (const doc of documents.value) {
            if (doc.id === currentDocId.value) continue;
            const md = loadDocument(doc.id);
            const parsed = MdParser.parse(md);
            const updatedStyles = { ...(parsed.pdfStyles || {}) };
            for (const [key, val] of Object.entries(colorOverrides)) {
              updatedStyles[key] = { ...(updatedStyles[key] || {}), ...val };
            }
            const newMd = MdParser.serialize({ ...parsed, pdfStyles: updatedStyles }, parsed.body);
            saveDocument(doc.id, newMd);
          }
        },
      });
    }

    function applyLogoToAllDocs() {
      const count = documents.value.length - 1;
      if (count < 1) return;
      confirmSvc.require({
        message: `Apply current logo to ${count} other document${count > 1 ? 's' : ''}? This cannot be undone.`,
        header: 'Apply Logo to All',
        accept: () => {
          const currentLogo = logo.value;
          for (const doc of documents.value) {
            if (doc.id === currentDocId.value) continue;
            const md = loadDocument(doc.id);
            const parsed = MdParser.parse(md);
            const newMd = MdParser.serialize({ ...parsed, logo: currentLogo }, parsed.body);
            saveDocument(doc.id, newMd);
          }
        },
      });
    }

    async function showGuide() {
      if (!guideHtml.value) {
        try {
          const resp = await fetch('assets/formatting-guide.md');
          const md = await resp.text();
          guideHtml.value = DOMPurify.sanitize(marked.parse(md));
        } catch (e) {
          guideHtml.value = '<p>Could not load formatting guide.</p>';
        }
      }
      guideVisible.value = true;
    }

    return {
      mode, title, logo, logoSvg, logoPreviewHtml, versions, pdfStyles, markdownBody,
      pageSize, created, updated, currentDocId, documents, fileInput, logoInput,
      guideVisible, guideHtml,
      modeOptions, pageSizeOptions, docOptions, reversedVersions, downloadMenuItems,
      formatTimestamp,
      selectDocument, createDocument, confirmDeleteDoc, deleteDocument,
      triggerUpload, triggerLogoUpload, onFileUpload, onLogoUpload,
      onDownloadMd, onDownloadAll, onDownloadPdf,
      addVersion, removeVersion, emitVersions,
      applyColorsToAllDocs, applyLogoToAllDocs, showGuide,
    };
  },
};

// ─── Mount with PrimeVue ────────────────────────────────────
const app = createApp(App);

const SlatePreset = PrimeVue.definePreset(PrimeUIX.Themes.Aura, {
  semantic: {
    primary: {
      50: '{slate.50}', 100: '{slate.100}', 200: '{slate.200}',
      300: '{slate.300}', 400: '{slate.400}', 500: '{slate.500}',
      600: '{slate.600}', 700: '{slate.700}', 800: '{slate.800}',
      900: '{slate.900}', 950: '{slate.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{slate.950}',
          inverseColor: '#ffffff',
          hoverColor: '{slate.900}',
          activeColor: '{slate.800}',
        },
        highlight: {
          background: '{slate.200}',
          focusBackground: '{slate.300}',
          color: '{slate.950}',
          focusColor: '{slate.950}',
        },
      },
    },
  },
});

app.use(PrimeVue.Config, {
  theme: {
    preset: SlatePreset,
    options: { darkModeSelector: false },
  },
});
app.use(PrimeVue.ToastService);
app.use(PrimeVue.ConfirmationService);

app.component('p-button', PrimeVue.Button);
app.component('p-inputtext', PrimeVue.InputText);
app.component('p-select', PrimeVue.Select);
app.component('p-toolbar', PrimeVue.Toolbar);
app.component('p-panel', PrimeVue.Panel);
app.component('p-dialog', PrimeVue.Dialog);
app.component('p-confirmdialog', PrimeVue.ConfirmDialog);
app.component('p-toast', PrimeVue.Toast);
app.component('p-divider', PrimeVue.Divider);
app.component('p-selectbutton', PrimeVue.SelectButton);
app.component('p-splitbutton', PrimeVue.SplitButton);

app.mount('#app');
