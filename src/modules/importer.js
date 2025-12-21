import { context } from '../context.js';
import { elements } from '../dom.js';
import { showLoading, hideLoading, loadImage, canvasToBlob } from '../utils.js';
import { displaySession } from './session.js';
import { addFiles as addToQuickTool } from './quickTool.js';

export function setupDropZones() {
    setupDropZone(elements.dropZoneOriginal, elements.inputOriginal, 'original');
    setupDropZone(elements.dropZoneRetouched, elements.inputRetouched, 'retouched');
    
    // Paste
    document.addEventListener('paste', handlePaste);
}

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

    context.pendingImport[type] = file;
    
    const capType = type.charAt(0).toUpperCase() + type.slice(1);
    const previewEl = elements[`previewThumb${capType}`];
    const statusEl = elements[`status${capType}`];
    
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
    if (context.pendingImport.original && context.pendingImport.retouched) {
        elements.startBtnContainer.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
        lucide.createIcons();
    }
}

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

    // SCENARIO 0: Quick Tool View
    if (elements.toolsView && !elements.toolsView.classList.contains('hidden')) {
        addToQuickTool([pastedBlob]);
        return;
    }

    // SCENARIO 1: On Welcome Page
    if (elements.welcomePage.style.display !== 'none') {
        if (!context.pendingImport.original) {
            setPendingFile('original', pastedBlob);
        } else {
            setPendingFile('retouched', pastedBlob);
        }
        return;
    }

    // SCENARIO 2: In Active Session (Hot Replace)
    if (context.session.originalBlob) {
        if (confirm('检测到粘贴图片，是否将其作为【新的精修图】替换当前画面？')) {
            showLoading();
            try {
                const img = await loadImage(pastedBlob);
                let cleanBlob = null;

                if (elements.dewatermarkToggle.checked) {
                    const resultCanvas = await context.engine.removeWatermarkFromImage(img);
                    cleanBlob = await canvasToBlob(resultCanvas);
                } else {
                    cleanBlob = pastedBlob;
                }

                context.session.rawRetouchedBlob = pastedBlob;
                context.session.cleanBlob = cleanBlob;
                context.session.cleanUrl = URL.createObjectURL(cleanBlob);
                context.session.isNew = true; 

                displaySession();
            } catch (err) {
                console.error('Hot replace failed:', err);
            } finally {
                hideLoading();
            }
        }
    }
}