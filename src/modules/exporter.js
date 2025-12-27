import { context } from '../context.js';
import { showLoading, hideLoading, loadImage, canvasToBlob } from '../utils.js';

export async function handleExportImage() {
    showLoading();
    try {
        const canvas = await generateExportCanvas(context.session.cleanUrl, 1080);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
        const fileName = `preview_${Date.now()}.jpg`;
        
        await saveOrDownload(fileName, blob);
    } catch (err) {
        console.error('Export Image failed:', err);
        alert('导出图片失败');
    } finally {
        hideLoading();
    }
}

export async function handleCopyImage() {
    showLoading();
    try {
        // Use smaller size (800px height limit) for clipboard to keep size small (~500KB)
        const canvas = await generateExportCanvas(context.session.cleanUrl, 800);
        const blob = await canvasToBlob(canvas, 'image/png'); 
        
        if (navigator.clipboard && navigator.clipboard.write) {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            alert('样片(800p)已复制到剪贴板！');
        } else {
            throw new Error('Clipboard API not supported');
        }
    } catch (err) {
        console.error('Copy Image failed:', err);
        alert('复制失败：' + err.message);
    } finally {
        hideLoading();
    }
}

export async function handleExportVideo() {
    showLoading();
    try {
        const result = await context.viewer.generateVideo();
        const fileName = `scan_video_${Date.now()}.${result.ext}`;
        await saveOrDownload(fileName, result.blob);
    } catch (err) {
        console.error('Export Video failed:', err);
        alert('导出视频失败: ' + err.message);
    } finally {
        hideLoading();
    }
}

async function saveOrDownload(fileName, blob) {
    if (!context.session.isNew && context.fs.rootHandle) {
        const userHandle = await context.fs.rootHandle.getDirectoryHandle(context.session.userName);
        const projHandle = await userHandle.getDirectoryHandle(context.session.projectName);
        await context.fs.saveExportFile(projHandle, fileName, blob);
        alert(`已保存至本地：\n${context.session.userName}/${context.session.projectName}/export/${fileName}`);
    } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
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