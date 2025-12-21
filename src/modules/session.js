import { context } from '../context.js';
import { elements } from '../dom.js';
import { showLoading, hideLoading, loadImage, canvasToBlob } from '../utils.js';

export async function startPendingSession() {
    if (!context.pendingImport.original || !context.pendingImport.retouched) return;

    showLoading();
    try {
        // Reuse logic from processor? Or keep it simple here.
        const originalImg = await loadImage(context.pendingImport.original);
        const retouchedImg = await loadImage(context.pendingImport.retouched);
        let cleanBlob = null;

        // Check Toggle State
        if (elements.dewatermarkToggle.checked) {
            const resultCanvas = await context.engine.removeWatermarkFromImage(retouchedImg);
            cleanBlob = await canvasToBlob(resultCanvas);
        } else {
            cleanBlob = context.pendingImport.retouched;
        }

        context.session = {
            ...context.session,
            originalBlob: context.pendingImport.original,
            rawRetouchedBlob: context.pendingImport.retouched,
            cleanBlob: cleanBlob,
            originalUrl: URL.createObjectURL(context.pendingImport.original),
            cleanUrl: URL.createObjectURL(cleanBlob),
            isNew: true
        };

        displaySession();
        resetWelcomePage();
        
    } catch (err) {
        console.error('Processing failed:', err);
        alert('处理失败，请重试');
    } finally {
        hideLoading();
    }
}

export async function reprocessCurrentSession() {
    if (!context.session.originalBlob || !context.session.rawRetouchedBlob) return;

    showLoading();
    try {
        const retouchedImg = await loadImage(context.session.rawRetouchedBlob);
        let cleanBlob = null;

        if (elements.dewatermarkToggle.checked) {
            const resultCanvas = await context.engine.removeWatermarkFromImage(retouchedImg);
            cleanBlob = await canvasToBlob(resultCanvas);
        } else {
            cleanBlob = context.session.rawRetouchedBlob; 
        }

        context.session.cleanBlob = cleanBlob;
        context.session.cleanUrl = URL.createObjectURL(cleanBlob);
        
        context.viewer.show(context.session.originalUrl, context.session.cleanBlob);

    } catch (err) {
        console.error('Reprocess failed:', err);
    } finally {
        hideLoading();
    }
}

export function displaySession() {
    elements.welcomePage.style.display = 'none';
    elements.stageContainer.style.display = 'block';
    
    context.viewer.show(context.session.originalUrl, context.session.cleanBlob);
    
    elements.saveBtn.disabled = false;
    elements.exportBtn.disabled = false;
    elements.exportVideoBtn.disabled = false;
    
    elements.activeProjectLabel.textContent = context.session.isNew ? 
        '待归档项目' : 
        `${context.session.userName} / ${context.session.projectName}`;
}

export function resetToHome() {
    context.resetSession();
    resetWelcomePage();

    elements.stageContainer.style.display = 'none';
    elements.welcomePage.style.display = 'flex';
    elements.activeProjectLabel.textContent = '准备开始新项目';
    elements.saveBtn.disabled = true;
    elements.exportBtn.disabled = true;
    elements.exportVideoBtn.disabled = true;
    
    if (context.sidebar) context.sidebar.setActive({ classList: { add: () => {}, remove: () => {} } }); 
}

export function resetWelcomePage() {
    context.pendingImport = { original: null, retouched: null };
    ['Original', 'Retouched'].forEach(type => {
        const previewEl = elements[`previewThumb${type}`];
        const statusEl = elements[`status${type}`];
        if(previewEl) {
            previewEl.classList.add('hidden');
            previewEl.src = '';
        }
        if(statusEl) statusEl.classList.add('hidden');
    });
    elements.startBtnContainer.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
}

export async function loadProject(userName, project) {
    showLoading();
    try {
        const originalUrl = await context.fs.loadFileAsDataURL(project.handle, 'original.png');
        const cleanDataUrl = await context.fs.loadFileAsDataURL(project.handle, 'clean.png');
        
        if (!originalUrl || !cleanDataUrl) throw new Error('Files missing (original.png or clean.png)');

        const cleanBlob = await (await fetch(cleanDataUrl)).blob();
        const originalBlob = await (await fetch(originalUrl)).blob();

        context.session = {
            ...context.session,
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
