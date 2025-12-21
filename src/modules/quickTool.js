import { context } from '../context.js';
import { elements } from '../dom.js';
import { loadImage, canvasToBlob, showLoading, hideLoading } from '../utils.js';
import { TimeTraceViewer } from '../ui/TimeTraceViewer.js';

let batchQueue = [];
let quickViewer = null;

// HTML Template for Quick Preview (Matches ID prefix 'quick-')
const PREVIEW_TEMPLATE = `
    <div id="quick-timeTraceContainer">
        <section id="quick-zoomSection" class="mb-12">
            <div class="mb-4 flex flex-col md:flex-row justify-between md:items-end gap-2">
                <div><h3 class="text-xl font-bold text-white flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-primary"></span> 高清细节透镜</h3></div>
                <div class="flex items-center gap-4 bg-gray-800 border border-gray-700 px-4 py-2 rounded-lg text-xs text-gray-300 shadow-sm">
                    <span class="text-gray-500">透镜大小:</span>
                    <div class="flex items-center gap-2"><i data-lucide="minus" class="w-3 h-3 text-gray-500"></i><input type="range" id="quick-lensSizeSlider" min="1.5" max="6" step="0.1" value="3"><i data-lucide="plus" class="w-3 h-3 text-gray-500"></i></div>
                    <span id="quick-zoomLevelDisplay" class="font-mono text-primary w-12 text-right">3.0x</span>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="relative group rounded-xl overflow-hidden border border-gray-800 shadow-2xl bg-black">
                    <div class="absolute top-2 left-2 z-20 px-2 py-1 bg-black/70 backdrop-blur text-white text-[10px] rounded border border-white/10">ORIGINAL</div>
                    <div class="img-zoom-container" id="quick-imgContainer"><div id="quick-zoomLens" class="img-zoom-lens"></div><img id="quick-beforeImg" class="zoom-source-img"></div>
                </div>
                <div class="relative h-full min-h-[400px] rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                    <div class="absolute top-2 right-2 z-20 px-2 py-1 bg-primary/90 backdrop-blur text-white text-[10px] rounded">CLEAN</div>
                    <div id="quick-zoomResult" class="img-zoom-result bg-gray-900"><div class="result-hint flex flex-col items-center gap-2"><i data-lucide="search" class="w-6 h-6"></i><span>移动左侧透镜查看细节</span></div></div>
                </div>
            </div>
        </section>
        <section id="quick-scanSection" class="mb-12 border-t border-gray-800 pt-12">
            <div class="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
                <div><h3 class="text-xl font-bold text-white flex items-center gap-2"><i data-lucide="wand-2" class="text-primary w-5 h-5"></i> 智能修复演示</h3></div>
                <div class="flex flex-wrap gap-2 items-center">
                     <button id="quick-btnPause" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded border border-gray-700 flex items-center gap-2 transition-colors"><i data-lucide="pause" class="w-3 h-3"></i> 暂停</button>
                     <div class="relative flex items-center"><i data-lucide="timer" class="absolute left-2 w-3 h-3 text-gray-500 z-10"></i><select id="quick-scanSpeed" class="custom-select pl-7 pr-8 py-1.5 bg-gray-800 text-white text-xs rounded border border-gray-700 outline-none cursor-pointer"><option value="0.5">0.5x</option><option value="1.0" selected>1.0x</option><option value="2.0">2.0x</option></select></div>
                     <button id="quick-scanDirH" class="px-3 py-1.5 bg-gray-800 text-white text-xs rounded border border-gray-700 transition-colors">↔ 横向</button>
                     <button id="quick-scanDirV" class="px-3 py-1.5 bg-gray-800 text-white text-xs rounded border border-gray-700 transition-colors">↕ 纵向</button>
                </div>
            </div>
            <div class="scanner-container bg-black" id="quick-scannerContainer"><div class="scanner-stage animate-scan-h" id="quick-scannerStage"><img id="quick-scanBefore" class="scanner-base-img"><div class="scan-line"></div><div class="scanner-reveal-wrapper" id="quick-scannerWrapper"><img id="quick-scanAfter" class="scanner-reveal-img"></div></div></div>
        </section>
        <section id="quick-comparisonSection" class="border-t border-gray-800 pt-12 pb-20">
            <h3 class="text-xl font-bold text-white mb-6">全图效果比对</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div class="relative bg-gray-900 rounded-xl p-2 border border-gray-800"><img id="quick-previewBefore" class="w-full h-auto max-h-[80vh] object-contain mx-auto rounded-lg"><div class="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur text-white text-[10px] font-bold rounded">BEFORE</div></div>
                 <div class="relative bg-gray-900 rounded-xl p-2 border border-gray-800"><img id="quick-previewAfter" class="w-full h-auto max-h-[80vh] object-contain mx-auto rounded-lg"><div class="absolute top-4 left-4 px-3 py-1 bg-primary/90 backdrop-blur text-white text-[10px] font-bold rounded">AFTER</div></div>
            </div>
        </section>
    </div>
`;

export function setupQuickTool() {
    // Navigation
    elements.navProjectBtn.addEventListener('click', () => switchView('project'));
    elements.navToolBtn.addEventListener('click', () => switchView('tool'));
    
    // Batch Controls
    elements.batchDropZone.addEventListener('click', () => elements.batchInput.click());
    elements.batchInput.addEventListener('change', (e) => addFiles(Array.from(e.target.files)));
    
    // Drag & Drop
    elements.batchDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.batchDropZone.classList.add('border-primary', 'bg-gray-800/80');
    });
    
    elements.batchDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        elements.batchDropZone.classList.remove('border-primary', 'bg-gray-800/80');
    });
    
    elements.batchDropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        elements.batchDropZone.classList.remove('border-primary', 'bg-gray-800/80');
        
        const items = [...e.dataTransfer.items];
        const filesWithHandles = [];
        const filesOnly = [];

        for (const item of items) {
            if (item.kind === 'file') {
                if (item.getAsFileSystemHandle) {
                    const handle = await item.getAsFileSystemHandle();
                    if (handle && handle.kind === 'file') {
                        const file = await handle.getFile();
                        filesWithHandles.push({ file, handle });
                        continue;
                    }
                }
                const file = item.getAsFile();
                if (file) filesOnly.push(file);
            }
        }
        
        if (filesWithHandles.length > 0) addFilesWithHandles(filesWithHandles);
        if (filesOnly.length > 0) addFiles(filesOnly);
    });

    elements.batchClearBtn.addEventListener('click', clearBatch);
    elements.closeQuickPreview.addEventListener('click', closePreview);
}

function switchView(mode) {
    if (mode === 'project') {
        elements.projectView.classList.remove('hidden');
        elements.toolsView.classList.add('hidden');
        elements.navProjectBtn.classList.add('bg-primary/10', 'text-primary', 'ring-1', 'ring-primary/20');
        elements.navProjectBtn.classList.remove('text-gray-400', 'hover:bg-gray-800');
        elements.navToolBtn.classList.remove('bg-primary/10', 'text-primary', 'ring-1', 'ring-primary/20');
        elements.navToolBtn.classList.add('text-gray-400', 'hover:bg-gray-800');
        if(elements.sidebarTree) elements.sidebarTree.style.display = 'block';
        if(elements.projectControls) elements.projectControls.style.display = 'block';
    } else {
        elements.projectView.classList.add('hidden');
        elements.toolsView.classList.remove('hidden');
        elements.navToolBtn.classList.add('bg-primary/10', 'text-primary', 'ring-1', 'ring-primary/20');
        elements.navToolBtn.classList.remove('text-gray-400', 'hover:bg-gray-800');
        elements.navProjectBtn.classList.remove('bg-primary/10', 'text-primary', 'ring-1', 'ring-primary/20');
        elements.navProjectBtn.classList.add('text-gray-400', 'hover:bg-gray-800');
        if(elements.sidebarTree) elements.sidebarTree.style.display = 'none';
        if(elements.projectControls) elements.projectControls.style.display = 'none';
    }
}

export function addFiles(files) {
    files.forEach(file => {
        if (file.type.match('image.*')) {
            createBatchItem({ file, handle: null });
        }
    });
}

function addFilesWithHandles(items) {
    items.forEach(item => {
        if (item.file.type.match('image.*')) {
            createBatchItem(item);
        }
    });
}

async function createBatchItem(item) {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const itemData = { ...item, id, processed: null, status: 'pending' };
    batchQueue.push(itemData);
    
    const div = document.createElement('div');
    div.id = `batch-${id}`;
    div.className = 'bg-gray-800/50 rounded-lg p-3 flex items-center gap-4 border border-gray-700 animate-fade-in';
    
    const imgUrl = URL.createObjectURL(item.file);
    
    div.innerHTML = `
        <img src="${imgUrl}" class="w-12 h-12 rounded object-cover bg-black/50 cursor-pointer hover:opacity-80 transition-opacity" onclick="previewItem('${id}')">
        <div class="flex-1 min-w-0">
            <h4 class="text-sm font-medium text-gray-200 truncate" title="${item.file.name}">${item.file.name}</h4>
            <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">${(item.file.size/1024).toFixed(1)} KB</span>
                <span id="status-${id}" class="text-[10px] text-amber-500 flex items-center gap-1"><i data-lucide="loader" class="w-3 h-3 animate-spin"></i> 处理中...</span>
            </div>
        </div>
        <div class="flex items-center gap-2" id="actions-${id}">
            <!-- Buttons will be injected -->
        </div>
        <button onclick="removeBatchItem('${id}')" class="p-2 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-colors">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;
    
    elements.batchList.appendChild(div);
    lucide.createIcons();
    
    processItem(itemData);
}

async function processItem(item) {
    try {
        const img = await loadImage(item.file);
        const canvas = await context.engine.removeWatermarkFromImage(img);
        const blob = await canvasToBlob(canvas);
        
        item.processed = blob;
        item.status = 'done';
        
        const statusEl = document.getElementById(`status-${item.id}`);
        statusEl.className = 'text-[10px] text-primary flex items-center gap-1';
        statusEl.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> 处理完成`;
        
        const actionContainer = document.getElementById(`actions-${item.id}`);
        
        // Preview Button
        const previewBtn = document.createElement('button');
        previewBtn.className = 'px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded border border-gray-600 transition-colors flex items-center gap-1';
        previewBtn.innerHTML = `<i data-lucide="eye" class="w-3 h-3"></i> 预览`;
        previewBtn.onclick = () => previewItem(item.id);
        actionContainer.appendChild(previewBtn);

        // Save Button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded border border-gray-600 transition-colors flex items-center gap-1';
        saveBtn.innerHTML = `<i data-lucide="download" class="w-3 h-3"></i> 另存为`;
        saveBtn.onclick = () => saveItem(item);
        actionContainer.appendChild(saveBtn);

        // Overwrite Button
        if (item.handle) {
            const overwriteBtn = document.createElement('button');
            overwriteBtn.className = 'px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30 transition-colors flex items-center gap-1';
            overwriteBtn.innerHTML = `<i data-lucide="file-edit" class="w-3 h-3"></i> 覆盖`;
            overwriteBtn.onclick = () => overwriteItem(item);
            actionContainer.appendChild(overwriteBtn);
        }
        
        lucide.createIcons();

    } catch (err) {
        console.error(err);
        const statusEl = document.getElementById(`status-${item.id}`);
        statusEl.className = 'text-[10px] text-red-500';
        statusEl.textContent = '处理失败';
    }
}

async function saveItem(item) {
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `clean_${item.file.name}`,
                types: [{
                    description: 'Image',
                    accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(item.processed);
            await writable.close();
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Save File Picker failed:', err);
            } else {
                return; // User canceled
            }
        }
    }

    // Fallback for browsers without FileSystem Access API
    const url = URL.createObjectURL(item.processed);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clean_${item.file.name}`;
    a.click();
}

async function overwriteItem(item) {
    if (!item.handle) return;
    if (!confirm(`确定要覆盖原始文件 "${item.file.name}" 吗？此操作不可撤销。`)) return;
    
    try {
        const writable = await item.handle.createWritable();
        await writable.write(item.processed);
        await writable.close();
        alert('文件已覆盖');
    } catch (err) {
        console.error('Overwrite failed:', err);
        alert('覆盖失败，可能权限不足');
    }
}

window.previewItem = function(id) {
    const item = batchQueue.find(i => i.id === id);
    if (!item || !item.processed) return;

    // Inject Viewer Structure if not present
    if (!document.getElementById('quick-timeTraceContainer')) {
        elements.quickTimeTraceContainer.innerHTML = PREVIEW_TEMPLATE;
        // Init Viewer once DOM is ready
        quickViewer = new TimeTraceViewer('quickTimeTraceContainer');
    }

    const originalUrl = URL.createObjectURL(item.file);
    quickViewer.show(originalUrl, item.processed);
    
    elements.quickPreviewModal.classList.remove('hidden');
    lucide.createIcons(); // Refresh new icons
}

function closePreview() {
    elements.quickPreviewModal.classList.add('hidden');
}

window.removeBatchItem = function(id) {
    const el = document.getElementById(`batch-${id}`);
    if (el) el.remove();
    batchQueue = batchQueue.filter(i => i.id !== id);
}

function clearBatch() {
    elements.batchList.innerHTML = '';
    batchQueue = [];
}