import {
    context
} from '../context.js';
import {
    elements
} from '../dom.js';
import {
    showLoading,
    hideLoading
} from '../utils.js';
import {
    updateSidebar
} from '../app.js'; // Circular ref handled by export later, or move updateSidebar to context/session? Better move updateSidebar logic to session or sidebar module.
// Actually, updateSidebar relies on sidebar instance in context. We can implement it here.

let saveMode = 'existing';

export function openSaveModal() {
    if (!context.session.cleanBlob) return;
    
    // Populate Users
    const users = context.sidebar ? context.sidebar.tree : [];
    elements.selectUser.innerHTML = '<option value="" disabled selected>请选择...</option>';
    
    if (users.length > 0) {
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.name;
            option.textContent = u.name;
            elements.selectUser.appendChild(option);
        });
        
        if (context.session.userName && users.find(u => u.name === context.session.userName)) {
            elements.selectUser.value = context.session.userName;
            switchSaveTab('existing');
        } else {
            switchSaveTab('existing');
        }
    } else {
        switchSaveTab('new');
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    elements.saveProjectName.value = timestamp;
    
    elements.saveModal.classList.remove('hidden');
    lucide.createIcons();
}

export function switchSaveTab(mode) {
    saveMode = mode;
    if (mode === 'existing') {
        elements.tabExisting.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
        elements.tabExisting.classList.remove('text-gray-500');
        elements.tabNew.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
        elements.tabNew.classList.add('text-gray-500');
        elements.fieldExisting.classList.remove('hidden');
        elements.fieldNew.classList.add('hidden');
    } else {
        elements.tabNew.classList.add('bg-gray-700', 'text-white', 'shadow-sm');
        elements.tabNew.classList.remove('text-gray-500');
        elements.tabExisting.classList.remove('bg-gray-700', 'text-white', 'shadow-sm');
        elements.tabExisting.classList.add('text-gray-500');
        elements.fieldNew.classList.remove('hidden');
        elements.fieldExisting.classList.add('hidden');
        setTimeout(() => elements.inputNewUser.focus(), 50);
    }
}

export async function confirmSave() {
    let userName = '';
    
    if (saveMode === 'existing') {
        userName = elements.selectUser.value;
        if (!userName) {
            alert('请选择一个已有用户');
            return;
        }
    } else {
        userName = elements.inputNewUser.value.trim();
        if (!userName) {
            alert('请输入新用户名称');
            return;
        }
        if (/[<>:"/\\|?*]/.test(userName)) {
            alert('用户名称包含非法字符');
            return;
        }
    }

    const projectName = elements.saveProjectName.value.trim();
    if (!projectName) {
        alert('请输入项目名称');
        return;
    }

    if (!await context.fs.verifyPermission()) {
        alert('工作目录权限受限，请重新打开目录');
        return;
    }

    showLoading();
    try {
        const projHandle = await context.fs.getProjectDirectory(userName, projectName);
        
        await context.fs.saveFileToProject(projHandle, 'original.png', context.session.originalBlob);
        
        // Save the raw watermarked retouched image (Backup)
        if (context.session.rawRetouchedBlob) {
            await context.fs.saveFileToProject(projHandle, 'retouched.png', context.session.rawRetouchedBlob);
        }
        
        await context.fs.saveFileToProject(projHandle, 'clean.png', context.session.cleanBlob);
        
        elements.saveModal.classList.add('hidden');
        context.session.userName = userName;
        context.session.projectName = projectName;
        context.session.isNew = false;
        
        // Refresh sidebar
        const tree = await context.fs.refreshTree();
        context.sidebar.render(tree);
        // Recalculate display session to update title
        fromSessionModule_displaySession();
        
        alert('归档成功');
    } catch (err) {
        console.error('Save failed:', err);
        alert('保存失败：' + err.message);
    } finally {
        hideLoading();
    }
}

import { displaySession as fromSessionModule_displaySession } from './session.js';
