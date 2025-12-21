export function loadImage(fileOrUrl) {
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

export function canvasToBlob(canvas, type = 'image/png', quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

export function showLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

export function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        el.classList.add('hidden');
        el.classList.remove('flex');
    }
}
