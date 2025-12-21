import { WatermarkEngine } from './core/watermarkEngine.js';
import { FileSystemManager } from './core/FileSystemManager.js';
import { Sidebar } from './ui/Sidebar.js';
import { TimeTraceViewer } from './ui/TimeTraceViewer.js';

// App State
let engine = null;
let fs = new FileSystemManager();
let sidebar = null;
let viewer = new TimeTraceViewer();

// Session State
let currentSession = {
    userName: '',
    projectName: '',
    originalBlob: null,
    cleanBlob: null,
    isNew: true
};

// Pending Import State (Welcome Page)
let pendingImport = {
    original: null,
    retouched: null
};

let saveMode = 'existing'; // 'existing' or 'new'

// DOM elements
const mountBtn = document.getElementById('mountBtn');
const newProjectBtn = document.getElementById('newProjectBtn');
const workplacePath = document.getElementById('workplacePath');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const welcomePage = document.getElementById('welcomePage');
const stageContainer = document.getElementById('stageContainer');
const activeProjectLabel = document.getElementById('activeProjectLabel');

// Save Modal Elements
const saveModal = document.getElementById('saveModal');
const tabExisting = document.getElementById('tabExisting');
const tabNew = document.getElementById('tabNew');
const fieldExisting = document.getElementById('fieldExisting');
const fieldNew = document.getElementById('fieldNew');
const selectUser = document.getElementById('selectUser');
const inputNewUser = document.getElementById('inputNewUser');

// Drop Zones
const dropZoneOriginal = document.getElementById('dropZoneOriginal');
const dropZoneRetouched = document.getElementById('dropZoneRetouched');
const inputOriginal = document.getElementById('inputOriginal');
const inputRetouched = document.getElementById('inputRetouched');
const startBtnContainer = document.getElementById('startBtnContainer');
const startProcessBtn = document.getElementById('startProcessBtn');

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
    newProjectBtn.addEventListener('click', resetToHome);
    saveBtn.addEventListener('click', openSaveModal);
    exportBtn.addEventListener('click', handleExport);
    
    // Save Modal
    document.getElementById('cancelSave').addEventListener('click', () => saveModal.classList.add('hidden'));
    document.getElementById('confirmSave').addEventListener('click', confirmSave);
    
    // Save Modal Tabs
    tabExisting.addEventListener('click', () => switchSaveTab('existing'));
    tabNew.addEventListener('click', () => switchSaveTab('new'));

    // Setup Dual Drop Zones
    setupDropZone(dropZoneOriginal, inputOriginal, 'original');
    setupDropZone(dropZoneRetouched, inputRetouched, 'retouched');

    startProcessBtn.addEventListener('click', startPendingSession);

    // Paste handling
    document.addEventListener('paste', handlePaste);
}

/**
 * Save Modal Logic
 */
function switchSaveTab(mode) {
    saveMode = mode;
    if (mode === 'existing') {
        // UI State
        tabExisting.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
        tabExisting.classList.remove('text-gray-500');
        tabNew.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
        tabNew.classList.add('text-gray-500');
        
        // Visibility
        fieldExisting.classList.remove('hidden');
        fieldNew.classList.add('hidden');
    } else {
        // UI State
        tabNew.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
        tabNew.classList.remove('text-gray-500');
        tabExisting.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
        tabExisting.classList.add('text-gray-500');
        
        // Visibility
        fieldNew.classList.remove('hidden');
        fieldExisting.classList.add('hidden');
        
        // Focus
        setTimeout(() => inputNewUser.focus(), 50);
    }
}

function openSaveModal() {
    if (!currentSession.cleanBlob) return;
    
    // 1. Populate Users Select
    const users = sidebar ? sidebar.tree : [];
    selectUser.innerHTML = '<option value="" disabled selected>请选择...</option>';
    
    if (users.length > 0) {
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.name;
            option.textContent = u.name;
            selectUser.appendChild(option);
        });
        
        // Default to last used user if available
        if (currentSession.userName && users.find(u => u.name === currentSession.userName)) {
            selectUser.value = currentSession.userName;
            switchSaveTab('existing');
        } else {
            switchSaveTab('existing');
        }
    } else {
        // No users yet, force new mode
        switchSaveTab('new');
    }

    // 2. Generate Timestamp Name
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('saveProjectName').value = timestamp;
    
    // 3. Show Modal
    saveModal.classList.remove('hidden');
    lucide.createIcons();
}

async function confirmSave() {
    let userName = '';
    
    if (saveMode === 'existing') {
        userName = selectUser.value;
        if (!userName) {
            alert('请选择一个已有用户');
            return;
        }
    } else {
        userName = inputNewUser.value.trim();
        if (!userName) {
            alert('请输入新用户名称');
            return;
        }
        // Basic validation for folder name
        if (/[<>:"/\\|?*]/.test(userName)) {
            alert('用户名称包含非法字符');
            return;
        }
    }

    const projectName = document.getElementById('saveProjectName').value.trim();
    if (!projectName) {
        alert('请输入项目名称');
        return;
    }

    if (!await fs.verifyPermission()) {
        alert('工作目录权限受限，请重新打开目录');
        return;
    }

    showLoading();
    try {
        const projHandle = await fs.getProjectDirectory(userName, projectName);
        
        await fs.saveFileToProject(projHandle, 'original.png', currentSession.originalBlob);
        await fs.saveFileToProject(projHandle, 'clean.png', currentSession.cleanBlob);
        
        saveModal.classList.add('hidden');
        currentSession.userName = userName;
        currentSession.projectName = projectName;
        currentSession.isNew = false;
        
        await updateSidebar();
        displaySession();
        
        alert('归档成功');
    } catch (err) {
        console.error('Save failed:', err);
        alert('保存失败：' + err.message);
    } finally {
        hideLoading();
    }
}

/**
 * Drop Zone Logic
 */
function setupDropZone(zone, input, type) {
    zone.addEventListener('click', () => input.click());
    
    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            setPendingFile(type, e.target.files[0]);
        }
        input.value = ''; 
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('border-primary', 'bg-gray-800/80');
    });

    zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        zone.classList.remove('border-primary', 'bg-gray-800/80');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('border-primary', 'bg-gray-800/80');
        if (e.dataTransfer.files.length > 0) {
            setPendingFile(type, e.dataTransfer.files[0]);
        }
    });
}

function setPendingFile(type, file) {
    if (!file.type.match('image.*')) {
        alert('请上传图片文件');
        return;
    }

    pendingImport[type] = file;
    
    const capType = type.charAt(0).toUpperCase() + type.slice(1);
    const previewEl = document.getElementById(`previewThumb${capType}`);
    const statusEl = document.getElementById(`status${capType}`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewEl.src = e.target.result;
        previewEl.classList.remove('hidden');
        statusEl.classList.remove('hidden');
        checkReadyState();
    };
    reader.readAsDataURL(file);
}

function checkReadyState() {
    if (pendingImport.original && pendingImport.retouched) {
        startBtnContainer.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
        lucide.createIcons();
    }
}

async function startPendingSession() {
    if (!pendingImport.original || !pendingImport.retouched) return;

    showLoading();
    try {
        const originalImg = await loadImage(pendingImport.original);
        const retouchedImg = await loadImage(pendingImport.retouched);
        
        // Auto-Dewatermark
        const resultCanvas = await engine.removeWatermarkFromImage(retouchedImg);
        const cleanBlob = await canvasToBlob(resultCanvas);

        currentSession = {
            originalBlob: pendingImport.original,
            cleanBlob: cleanBlob,
            originalUrl: URL.createObjectURL(pendingImport.original),
            cleanUrl: URL.createObjectURL(cleanBlob),
            isNew: true
        };

        displaySession();
        resetWelcomePage();
        
    } catch (err) {
        console.error('Processing failed:', err);
        alert('去水印处理失败，请重试');
    } finally {
        hideLoading();
    }
}

function resetWelcomePage() {
    pendingImport = { original: null, retouched: null };
    ['Original', 'Retouched'].forEach(type => {
        const previewEl = document.getElementById(`previewThumb${type}`);
        const statusEl = document.getElementById(`status${type}`);
        if(previewEl) {
            previewEl.classList.add('hidden');
            previewEl.src = '';
        }
        if(statusEl) statusEl.classList.add('hidden');
    });
    startBtnContainer.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
}

/**
 * Reset Application State to Home
 */
function resetToHome() {
    currentSession = {
        userName: '',
        projectName: '',
        originalBlob: null,
        cleanBlob: null,
        isNew: true
    };

    resetWelcomePage();
    stageContainer.style.display = 'none';
    welcomePage.style.display = 'flex';
    activeProjectLabel.textContent = '准备开始新项目';
    saveBtn.disabled = true;
    exportBtn.disabled = true;
    
    if (sidebar) sidebar.setActive({ classList: { add: () => {}, remove: () => {} } }); 
}

/**
 * Mount workspace
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
    
    // Note: The selectUser logic is handled dynamically in openSaveModal now
}

/**
 * Paste handling
 */
async function handlePaste(e) {
    const items = e.clipboardData.items;
    let pastedBlob = null;

    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            pastedBlob = item.getAsFile();
            break;
        }
    }

    if (!pastedBlob) return;

    if (welcomePage.style.display !== 'none') {
        if (!pendingImport.original) {
            setPendingFile('original', pastedBlob);
        } else {
            setPendingFile('retouched', pastedBlob);
        }
        return;
    }

    if (currentSession.originalBlob) {
        if (confirm('检测到粘贴图片，是否将其作为【新的精修图】替换当前画面？')) {
            showLoading();
            try {
                const img = await loadImage(pastedBlob);
                const resultCanvas = await engine.removeWatermarkFromImage(img);
                const cleanBlob = await canvasToBlob(resultCanvas);

                currentSession.cleanBlob = cleanBlob;
                currentSession.cleanUrl = URL.createObjectURL(cleanBlob);
                currentSession.isNew = true; 

                displaySession();
            } catch (err) {
                console.error('Hot replace failed:', err);
            } finally {
                hideLoading();
            }
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
 * Load Project
 */
async function loadProject(userName, project) {
    showLoading();
    try {
        const originalUrl = await fs.loadFileAsDataURL(project.handle, 'original.png');
        const cleanDataUrl = await fs.loadFileAsDataURL(project.handle, 'clean.png');
        
        if (!originalUrl || !cleanDataUrl) throw new Error('Files missing (original.png or clean.png)');

        const cleanBlob = await (await fetch(cleanDataUrl)).blob();
        const originalBlob = await (await fetch(originalUrl)).blob();

        currentSession = {
            userName,
            projectName: project.name,
            originalUrl,
            cleanUrl: cleanDataUrl,
            cleanBlob,
            originalBlob,
            isNew: false
        };

        displaySession();
    } catch (err) {
        console.error('Load failed:', err);
        alert('加载失败：' + err.message);
    } finally {
        hideLoading();
    }
}

/**
 * Export Logic
 */
async function handleExport() {
    showLoading();
    try {
        const canvas = await generateExportCanvas(currentSession.cleanUrl, 1080);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
        const fileName = `preview_${Date.now()}.jpg`;
        
        if (!currentSession.isNew && fs.rootHandle) {
            const userHandle = await fs.rootHandle.getDirectoryHandle(currentSession.userName);
            const projHandle = await userHandle.getDirectoryHandle(currentSession.projectName);
            await fs.saveExportFile(projHandle, fileName, blob);
            alert(`预览图已保存至本地：\n${currentSession.userName}/${currentSession.projectName}/export/${fileName}`);
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
        }
    } catch (err) {
        console.error('Export failed:', err);
        alert('导出失败');
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
    const el = document.getElementById('loadingOverlay');
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}

init();
