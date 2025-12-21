import { Sidebar } from './ui/Sidebar.js';
import { context } from './context.js';
import { elements } from './dom.js';

// Module Imports
import { startPendingSession, reprocessCurrentSession, resetToHome, loadProject } from './modules/session.js';
import { setupDropZones } from './modules/importer.js';
import { openSaveModal, confirmSave, switchSaveTab } from './modules/saver.js';
import { handleExportImage, handleExportVideo } from './modules/exporter.js';

async function init() {
    try {
        await context.initEngine();
        context.sidebar = new Sidebar('sidebarTree', loadProject);
        
        setupEventListeners();
        lucide.createIcons();
    } catch (err) {
        console.error('Initialization failed:', err);
    }
}

function setupEventListeners() {
    // Toolbar
    elements.mountBtn.addEventListener('click', mountWorkplace);
    elements.newProjectBtn.addEventListener('click', resetToHome);
    elements.saveBtn.addEventListener('click', openSaveModal);
    elements.exportBtn.addEventListener('click', handleExportImage);
    elements.exportVideoBtn.addEventListener('click', handleExportVideo);
    
    // Toggle
    elements.dewatermarkToggle.addEventListener('change', reprocessCurrentSession);
    
    // Save Modal
    elements.cancelSave.addEventListener('click', () => elements.saveModal.classList.add('hidden'));
    elements.confirmSave.addEventListener('click', confirmSave);
    elements.tabExisting.addEventListener('click', () => switchSaveTab('existing'));
    elements.tabNew.addEventListener('click', () => switchSaveTab('new'));

    // Importer
    setupDropZones();
    elements.startProcessBtn.addEventListener('click', startPendingSession);
}

async function mountWorkplace() {
    const handle = await context.fs.mountWorkspace();
    if (handle) {
        elements.workplacePath.textContent = handle.name;
        const tree = await context.fs.refreshTree();
        context.sidebar.render(tree);
    }
}

init();
