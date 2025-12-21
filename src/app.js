import { WatermarkEngine } from './core/watermarkEngine.js';
import { FileSystemManager } from './core/FileSystemManager.js';
import { Sidebar } from './ui/Sidebar.js';
import { TimeTraceViewer } from './ui/TimeTraceViewer.js';

// App State
let engine = null;
let fs = new FileSystemManager();
let sidebar = null;
let viewer = new TimeTraceViewer();

let currentSession = {
    userName: '',
    projectName: '',
    originalBlob: null,
    cleanBlob: null,
    isNew: true // true if it's a fresh import, false if loaded from disk
};

// DOM elements
const mountBtn = document.getElementById('mountBtn');
const workplacePath = document.getElementById('workplacePath');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const welcomePage = document.getElementById('welcomePage');
const stageContainer = document.getElementById('stageContainer');
const activeProjectLabel = document.getElementById('activeProjectLabel');
const saveModal = document.getElementById('saveModal');
const dropZone = document.getElementById('dropZone');

/**
 * Initialize the App
 */
async function init() {
    try {
        engine = await WatermarkEngine.create();
        sidebar = new Sidebar('sidebarTree', loadProject);
        
        setupEventListeners();
        lucide.createIcons();
    } catch (err) {
        console.error('Initialization failed:', err);
    }
}

/**
 * Global event listeners
 */
function setupEventListeners() {
    mountBtn.addEventListener('click', mountWorkplace);
    saveBtn.addEventListener('click', openSaveModal);
    exportBtn.addEventListener('click', handleExport);
    
    // Save Modal
    document.getElementById('cancelSave').addEventListener('click', () => saveModal.classList.add('hidden'));
    document.getElementById('confirmSave').addEventListener('click', confirmSave);

    // Drop Zone
    dropZone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*';
        input.onchange = (e) => handleFiles(Array.from(e.target.files));
        input.click();
    });

    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFiles(Array.from(e.dataTransfer.files));
    });

    // Paste handling
    document.addEventListener('paste', handlePaste);
}

/**
 * Mount workspace and sync tree
 */
async function mountWorkplace() {
    const handle = await fs.mountWorkspace();
    if (handle) {
        workplacePath.textContent = handle.name;
        updateSidebar();
    }
}

async function updateSidebar() {
    const tree = await fs.refreshTree();
    sidebar.render(tree);
    
    // Update user datalist for autocomplete
    const datalist = document.getElementById('userList');
    datalist.innerHTML = tree.map(u => `<option value="${u.name}">`).join('');
}

/**
 * File processing logic
 */
async function handleFiles(files) {
    let original = files.find(f => f.name.toLowerCase().includes('original')) || files[0];
    let retouched = files.find(f => f.name.toLowerCase().includes('retouched')) || files[1] || files[0];

    if (!original) return;

    showLoading();
    try {
        const originalImg = await loadImage(original);
        const retouchedImg = await loadImage(retouched);
        
        // Auto-Dewatermark the retouched image
        const resultCanvas = await engine.removeWatermarkFromImage(retouchedImg);
        const cleanBlob = await canvasToBlob(resultCanvas);

        currentSession = {
            originalBlob: original,
            cleanBlob: cleanBlob,
            originalUrl: URL.createObjectURL(original),
            cleanUrl: URL.createObjectURL(cleanBlob),
            isNew: true
        };

        displaySession();
    } catch (err) {
        console.error('Processing failed:', err);
    } finally {
        hideLoading();
    }
}

/**
 * Paste handling - logic for smart replacement
 */
async function handlePaste(e) {
    const items = e.clipboardData.items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            showLoading();
            try {
                const img = await loadImage(blob);
                const resultCanvas = await engine.removeWatermarkFromImage(img);
                const cleanBlob = await canvasToBlob(resultCanvas);

                if (!currentSession.originalBlob) {
                    // If no original, treat this paste as BOTH original and retouched for preview
                    currentSession.originalBlob = blob;
                    currentSession.originalUrl = URL.createObjectURL(blob);
                }

                currentSession.cleanBlob = cleanBlob;
                currentSession.cleanUrl = URL.createObjectURL(cleanBlob);
                currentSession.isNew = true;

                displaySession();
            } catch (err) {
                console.error('Paste processing failed:', err);
            } finally {
                hideLoading();
            }
            break; 
        }
    }
}

/**
 * UI Sync
 */
function displaySession() {
    welcomePage.style.display = 'none';
    stageContainer.style.display = 'block';
    
    viewer.show(currentSession.originalUrl, currentSession.cleanBlob);
    
    saveBtn.disabled = false;
    exportBtn.disabled = false;
    
    activeProjectLabel.textContent = currentSession.isNew ? 
        '待归档项目' : 
        `${currentSession.userName} / ${currentSession.projectName}`;
}

/**
 * Persistence
 */
function openSaveModal() {
    if (!currentSession.cleanBlob) return;
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    
    document.getElementById('saveProjectName').value = timestamp;
    saveModal.classList.remove('hidden');
}

async function confirmSave() {
    const userName = document.getElementById('saveUser').value.trim();
    const projectName = document.getElementById('saveProjectName').value.trim();
    
    if (!userName || !projectName) {
        alert('请输入用户名称和项目名称');
        return;
    }

    if (!await fs.verifyPermission()) {
        alert('工作目录权限受限');
        return;
    }

    showLoading();
    try {
        const projHandle = await fs.getProjectDirectory(userName, projectName);
        
        // Save original and clean
        await fs.saveFileToProject(projHandle, 'original.png', currentSession.originalBlob);
        await fs.saveFileToProject(projHandle, 'clean.png', currentSession.cleanBlob);
        
        saveModal.classList.add('hidden');
        currentSession.userName = userName;
        currentSession.projectName = projectName;
        currentSession.isNew = false;
        
        await updateSidebar();
        displaySession();
    } catch (err) {
        console.error('Save failed:', err);
        alert('保存失败，请检查磁盘权限');
    } finally {
        hideLoading();
    }
}

/**
 * Loading from sidebar
 */
async function loadProject(userName, project) {
    showLoading();
    try {
        const originalUrl = await fs.loadFileAsDataURL(project.handle, 'original.png');
        const cleanDataUrl = await fs.loadFileAsDataURL(project.handle, 'clean.png');
        
        if (!originalUrl || !cleanDataUrl) throw new Error('Files missing in project');

        const cleanBlob = await (await fetch(cleanDataUrl)).blob();

        currentSession = {
            userName,
            projectName: project.name,
            originalUrl,
            cleanUrl: cleanDataUrl,
            cleanBlob,
            originalBlob: await (await fetch(originalUrl)).blob(),
            isNew: false
        };

        displaySession();
    } catch (err) {
        console.error('Load failed:', err);
        alert('加载失败，文件可能已损坏');
    } finally {
        hideLoading();
    }
}

/**
 * Export Sample Logic
 */
async function handleExport() {
    // Generate small sample (e.g. max 1080px)
    showLoading();
    try {
        // Logic for creating comparison long image or scan video...
        // For simplicity, let's export current clean image at 1080px height
        const canvas = await generateExportCanvas(currentSession.cleanUrl, 1080);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
        
        const fileName = `preview_${Date.now()}.jpg`;
        
        if (!currentSession.isNew && fs.rootHandle) {
            const userHandle = await fs.rootHandle.getDirectoryHandle(currentSession.userName);
            const projHandle = await userHandle.getDirectoryHandle(currentSession.projectName);
            await fs.saveExportFile(projHandle, fileName, blob);
            alert(`预览图已保存至项目 export 目录：${fileName}`);
        } else {
            // If not archived, trigger download
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
        }
    } catch (err) {
        console.error('Export failed:', err);
    } finally {
        hideLoading();
    }
}

async function generateExportCanvas(src, maxHeight) {
    const img = await loadImage(src);
    const scale = Math.min(1, maxHeight / img.height);
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/**
 * Utils
 */
function loadImage(fileOrUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        if (typeof fileOrUrl === 'string') {
            img.src = fileOrUrl;
        } else {
            const reader = new FileReader();
            reader.onload = (e) => img.src = e.target.result;
            reader.readAsDataURL(fileOrUrl);
        }
    });
}

function canvasToBlob(canvas, type = 'image/png', quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('flex');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('loadingOverlay').classList.remove('flex');
}

init();
