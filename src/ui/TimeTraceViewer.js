export class TimeTraceViewer {
    constructor(containerId = 'timeTraceContainer') {
        this.beforeImg = null;
        this.afterImgUrl = null;
        this.lastCursorX = 0;
        this.lastCursorY = 0;
        this.isCursorInside = false;
        this.isDragging = false;
        
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        this.prefix = containerId === 'timeTraceContainer' ? '' : 'quick-';

        this.init();
    }

    init() {
        if (!this.container) return; 
        
        this.zoomSection = document.getElementById(this.prefix + 'zoomSection');
        this.scanSection = document.getElementById(this.prefix + 'scanSection');
        this.comparisonSection = document.getElementById(this.prefix + 'comparisonSection');
        
        this.beforeImgEl = document.getElementById(this.prefix + 'beforeImg');
        this.zoomResult = document.getElementById(this.prefix + 'zoomResult');
        this.zoomLens = document.getElementById(this.prefix + 'zoomLens');
        this.imgContainer = document.getElementById(this.prefix + 'imgContainer');
        this.lensSizeSlider = document.getElementById(this.prefix + 'lensSizeSlider');
        this.zoomLevelDisplay = document.getElementById(this.prefix + 'zoomLevelDisplay');
        this.resultHint = this.container.querySelector('.result-hint');
        
        this.scannerStage = document.getElementById(this.prefix + 'scannerStage');
        this.scannerWrapper = document.getElementById(this.prefix + 'scannerWrapper'); // Added
        this.scanBefore = document.getElementById(this.prefix + 'scanBefore');
        this.scanAfter = document.getElementById(this.prefix + 'scanAfter');
        this.btnPause = document.getElementById(this.prefix + 'btnPause');
        this.btnDownload = document.getElementById(this.prefix + 'btnDownload');
        this.scanSpeed = document.getElementById(this.prefix + 'scanSpeed');
        
        this.previewBefore = document.getElementById(this.prefix + 'previewBefore');
        this.previewAfter = document.getElementById(this.prefix + 'previewAfter');
        this.btnCopyComp = document.getElementById(this.prefix + 'btnCopyComp');
        this.btnDownComp = document.getElementById(this.prefix + 'btnDownComp');

        this.bindZoomEvents();
        this.bindScannerEvents();
        this.bindComparisonEvents();

        this.container.style.display = 'none';
    }

    show(originalImgSrc, processedBlob) {
        if (!this.container) return;
        this.container.style.display = 'block';
        const processedUrl = URL.createObjectURL(processedBlob);
        this.updateImages(originalImgSrc, processedUrl);
        if (this.containerId === 'timeTraceContainer') {
            this.container.scrollIntoView({ behavior: 'smooth' });
        }
    }

    updateImages(originalSrc, processedUrl) {
        if (this.beforeImgEl) {
            this.beforeImgEl.src = originalSrc;
            this.beforeImgEl.style.filter = 'none';
        }
        this.afterImgUrl = processedUrl;
        
        if (this.scanBefore) {
            this.scanBefore.src = originalSrc;
            this.scanBefore.style.filter = 'none';
        }
        if (this.scanAfter) this.scanAfter.src = processedUrl;
        
        if (this.previewBefore) {
            this.previewBefore.src = originalSrc;
            this.previewBefore.style.filter = 'none';
        }
        if (this.previewAfter) this.previewAfter.src = processedUrl;

        const initLogic = () => {
            this.initZoom();
            this.detectScanDirection();
            this.syncScannerImageSize();
        };

        if (this.scanBefore && this.scanBefore.complete) {
            initLogic();
        } else if (this.scanBefore) {
            this.scanBefore.onload = initLogic;
        }
    }

    bindZoomEvents() {
        if (!this.imgContainer) return;

        this.imgContainer.addEventListener('mouseenter', () => { 
            if (this.zoomLens) this.zoomLens.style.display = 'block'; 
            this.isCursorInside = true; 
            this.initZoom(); 
        });
        this.imgContainer.addEventListener('mouseleave', () => { 
            if (this.zoomLens) this.zoomLens.style.display = 'none'; 
            this.isCursorInside = false; 
        });
        this.imgContainer.addEventListener('mousemove', (e) => this.moveLens(e));
        this.imgContainer.addEventListener('touchmove', (e) => this.moveLens(e), {passive: false});
        this.imgContainer.addEventListener('touchstart', (e) => { 
            if (this.zoomLens) this.zoomLens.style.display = 'block'; 
            this.isCursorInside = true; 
            this.initZoom(); 
            this.moveLens(e); 
        });
        
        if (this.lensSizeSlider) {
            this.lensSizeSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (this.zoomLevelDisplay) this.zoomLevelDisplay.textContent = val.toFixed(1) + "x";
                if (this.isCursorInside) this.updateLensAndBackground();
                else {
                    const cx = val;
                    if (this.zoomResult && this.beforeImgEl) {
                        this.zoomResult.style.backgroundSize = (this.beforeImgEl.width * cx) + "px " + (this.beforeImgEl.height * cx) + "px";
                    }
                }
            });
        }

        window.addEventListener('resize', () => {
            this.initZoom();
            this.syncScannerImageSize();
        });
    }

    initZoom() {
        if (!this.zoomResult || !this.beforeImgEl) return;
        this.zoomResult.style.backgroundImage = `url('${this.afterImgUrl}')`;
        const cx = this.lensSizeSlider ? parseFloat(this.lensSizeSlider.value) : 3;
        this.zoomResult.style.backgroundSize = (this.beforeImgEl.width * cx) + "px " + (this.beforeImgEl.height * cx) + "px";
    }

    moveLens(e) {
        if (!this.isCursorInside) return;
        e.preventDefault();
        if (this.resultHint) this.resultHint.style.display = 'none';
        
        let pageX = e.pageX || (e.touches ? e.touches[0].pageX : 0);
        let pageY = e.pageY || (e.touches ? e.touches[0].pageY : 0);
        
        this.lastCursorX = pageX - window.scrollX;
        this.lastCursorY = pageY - window.scrollY;
        
        this.updateLensAndBackground();
    }

    updateLensAndBackground() {
        if (!this.isCursorInside || !this.beforeImgEl || !this.zoomLens || !this.zoomResult) return;
        const a = this.beforeImgEl.getBoundingClientRect();
        let x = this.lastCursorX - a.left; 
        let y = this.lastCursorY - a.top;

        const cx = this.lensSizeSlider ? parseFloat(this.lensSizeSlider.value) : 3;
        const lensW = this.zoomResult.offsetWidth / cx;
        const lensH = this.zoomResult.offsetHeight / cx;
        
        this.zoomLens.style.width = lensW + "px";
        this.zoomLens.style.height = lensH + "px";

        let lensX = x - (lensW / 2);
        let lensY = y - (lensH / 2);

        if (lensX > this.beforeImgEl.width - lensW) { lensX = this.beforeImgEl.width - lensW; }
        if (lensX < 0) { lensX = 0; }
        if (lensY > this.beforeImgEl.height - lensH) { lensY = this.beforeImgEl.height - lensH; }
        if (lensY < 0) { lensY = 0; }

        this.zoomLens.style.left = lensX + "px";
        this.zoomLens.style.top = lensY + "px";
        
        this.zoomResult.style.backgroundPosition = "-" + (lensX * cx) + "px -" + (lensY * cx) + "px";
    }

    bindScannerEvents() {
        if (this.btnPause) this.btnPause.addEventListener('click', () => this.toggleScanPause());
        if (this.scanSpeed) this.scanSpeed.addEventListener('change', () => this.updateScanSpeed());
        
        const btnH = document.getElementById(this.prefix + 'scanDirH');
        const btnV = document.getElementById(this.prefix + 'scanDirV');
        if (btnH) btnH.addEventListener('click', () => this.forceScanDirection('h'));
        if (btnV) btnV.addEventListener('click', () => this.forceScanDirection('v'));
        
        if (this.btnDownload) this.btnDownload.addEventListener('click', () => this.generateVideo());

        // Manual Interaction
        if (this.scannerStage) {
            const startDrag = (e) => {
                this.isDragging = true;
                this.stopAnimation(); 
                this.updateScannerPosition(e);
            };
            const onDrag = (e) => {
                if (!this.isDragging) return;
                e.preventDefault();
                this.updateScannerPosition(e);
            };
            const stopDrag = () => {
                this.isDragging = false;
            };

            this.scannerStage.addEventListener('mousedown', startDrag);
            this.scannerStage.addEventListener('mousemove', onDrag);
            this.scannerStage.addEventListener('mouseup', stopDrag);
            this.scannerStage.addEventListener('mouseleave', stopDrag);

            this.scannerStage.addEventListener('touchstart', startDrag, { passive: false });
            this.scannerStage.addEventListener('touchmove', onDrag, { passive: false });
            this.scannerStage.addEventListener('touchend', stopDrag);
        }
    }

    stopAnimation() {
        if (this.scannerStage) {
            this.scannerStage.classList.remove('animate-scan-h', 'animate-scan-v');
            this.scannerStage.classList.add('paused');
            if (this.btnPause) {
                this.btnPause.innerHTML = `<i data-lucide="play" class="w-3 h-3"></i> 继续`;
                lucide.createIcons();
            }
        }
    }

    updateScannerPosition(e) {
        if (!this.scannerStage || !this.scannerWrapper) return;
        
        const rect = this.scannerStage.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const isVertical = this.scannerStage.classList.contains('vertical'); 
        const scanLine = this.scannerStage.querySelector('.scan-line');

        if (isVertical) {
            let y = clientY - rect.top;
            y = Math.max(0, Math.min(y, rect.height));
            const percent = (y / rect.height) * 100;
            
            this.scannerWrapper.style.width = '100%';
            this.scannerWrapper.style.height = percent + '%';
            this.scannerWrapper.style.borderRight = 'none';
            this.scannerWrapper.style.borderBottom = '2px solid #f59e0b';
            
            if (scanLine) {
                scanLine.style.width = '100%';
                scanLine.style.height = '2px';
                scanLine.style.top = percent + '%';
                scanLine.style.left = '0';
                scanLine.style.opacity = '1';
            }
        } else {
            let x = clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            const percent = (x / rect.width) * 100;
            
            this.scannerWrapper.style.height = '100%';
            this.scannerWrapper.style.width = percent + '%';
            this.scannerWrapper.style.borderBottom = 'none';
            this.scannerWrapper.style.borderRight = '2px solid #f59e0b';
            
            if (scanLine) {
                scanLine.style.height = '100%';
                scanLine.style.width = '2px';
                scanLine.style.left = percent + '%';
                scanLine.style.top = '0';
                scanLine.style.opacity = '1';
            }
        }
    }

    syncScannerImageSize() {
        if (!this.scanBefore || !this.scanAfter) return;
        const width = this.scanBefore.offsetWidth;
        const height = this.scanBefore.offsetHeight;
        if (width === 0 || height === 0) return;
        this.scanAfter.style.width = width + 'px';
        this.scanAfter.style.height = height + 'px';
    }

    detectScanDirection() {
        if (!this.scannerStage || !this.scanBefore) return;
        this.scannerStage.classList.remove('animate-scan-h', 'animate-scan-v', 'vertical');
        this.resetScannerStyles();

        if (this.scanBefore.naturalWidth > this.scanBefore.naturalHeight) {
            this.scannerStage.classList.add('animate-scan-h');
        } else {
            this.scannerStage.classList.add('animate-scan-v', 'vertical');
        }
    }

    forceScanDirection(dir) {
        if (!this.scannerStage) return;
        this.scannerStage.classList.remove('animate-scan-h', 'animate-scan-v', 'vertical');
        this.resetScannerStyles();

        if(dir === 'h') {
            this.scannerStage.classList.add('animate-scan-h');
        } else {
            this.scannerStage.classList.add('animate-scan-v', 'vertical');
        }
        this.syncScannerImageSize();
        
        if (this.btnPause) {
            this.btnPause.innerHTML = `<i data-lucide="pause" class="w-3 h-3"></i> 暂停`;
            lucide.createIcons();
        }
    }
    
    resetScannerStyles() {
        if (this.scannerWrapper) {
            this.scannerWrapper.style.width = '';
            this.scannerWrapper.style.height = '';
            this.scannerWrapper.style.borderRight = '';
            this.scannerWrapper.style.borderBottom = '';
        }
        const scanLine = this.scannerStage.querySelector('.scan-line');
        if (scanLine) {
            scanLine.style.top = '';
            scanLine.style.left = '';
            scanLine.style.width = '';
            scanLine.style.height = '';
            scanLine.style.opacity = '';
        }
    }

    toggleScanPause() {
        if (!this.scannerStage || !this.btnPause) return;
        
        const hasAnimH = this.scannerStage.classList.contains('animate-scan-h');
        const hasAnimV = this.scannerStage.classList.contains('animate-scan-v');
        
        if (!hasAnimH && !hasAnimV) {
            this.resetScannerStyles();
            const isVertical = this.scannerStage.classList.contains('vertical');
            if (isVertical) this.scannerStage.classList.add('animate-scan-v');
            else this.scannerStage.classList.add('animate-scan-h');
            
            this.btnPause.innerHTML = `<i data-lucide="pause" class="w-3 h-3"></i> 暂停`;
        } else {
            this.scannerStage.classList.toggle('paused');
            const isPaused = this.scannerStage.classList.contains('paused');
            const icon = isPaused ? 'play' : 'pause';
            this.btnPause.innerHTML = `<i data-lucide="${icon}" class="w-3 h-3"></i> ${isPaused ? '继续' : '暂停'}`;
        }
        lucide.createIcons();
    }

    updateScanSpeed() {
        if (!this.scanSpeed || !this.scannerStage) return;
        const speed = parseFloat(this.scanSpeed.value);
        const baseDuration = 4; 
        const newDuration = baseDuration / speed;
        this.scannerStage.style.setProperty('--scan-duration', newDuration + 's');
    }

    generateVideo() {
        return new Promise((resolve, reject) => {
            if (typeof MediaRecorder === 'undefined') {
                alert("您的浏览器不支持视频录制功能。");
                reject(new Error("MediaRecorder not supported"));
                return;
            }
            if (!this.scanBefore || !this.scanAfter) {
                reject(new Error("Images not loaded"));
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const width = this.scanBefore.naturalWidth;
            const height = this.scanBefore.naturalHeight;
            canvas.width = width;
            canvas.height = height;

            const isHorizontal = this.scannerStage && this.scannerStage.classList.contains('animate-scan-h');
            let mimeType = 'video/webm'; 
            
            if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
                mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            }

            let recorder;
            try {
                const stream = canvas.captureStream(30);
                recorder = new MediaRecorder(stream, { mimeType });
            } catch (e) {
                try {
                    recorder = new MediaRecorder(canvas.captureStream(30));
                } catch (err) {
                    reject(err);
                    return;
                }
            }

            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
                resolve({ blob, ext: mimeType.includes('mp4') ? 'mp4' : 'webm' });
            };

            recorder.start();
            const speed = parseFloat(this.scanSpeed ? this.scanSpeed.value : 1);
            const duration = 4000 / speed;
            const startTime = performance.now();

            const drawFrame = (now) => {
                const elapsed = now - startTime;
                let progress = 0;
                const p = elapsed / duration;
                
                if (p <= 0.05) progress = 0;
                else if (p <= 0.60) progress = (p - 0.05) / 0.55;
                else progress = 1;

                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(this.scanBefore, 0, 0, width, height);

                if (isHorizontal) {
                    const w = width * progress;
                    if (w > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(0, 0, w, height);
                        ctx.clip();
                        ctx.drawImage(this.scanAfter, 0, 0, width, height);
                        ctx.restore();
                        if (progress < 1 && progress > 0) {
                            ctx.beginPath();
                            ctx.moveTo(w, 0);
                            ctx.lineTo(w, height);
                            ctx.lineWidth = 4 * (width / 800);
                            ctx.strokeStyle = '#f59e0b';
                            ctx.stroke();
                        }
                    }
                } else {
                    const h = height * progress;
                    if (h > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(0, 0, width, h);
                        ctx.clip();
                        ctx.drawImage(this.scanAfter, 0, 0, width, height);
                        ctx.restore();
                        if (progress < 1 && progress > 0) {
                            ctx.beginPath();
                            ctx.moveTo(0, h);
                            ctx.lineTo(width, h);
                            ctx.lineWidth = 4 * (height / 800);
                            ctx.strokeStyle = '#f59e0b';
                            ctx.stroke();
                        }
                    }
                }

                if (elapsed < duration) requestAnimationFrame(drawFrame);
                else recorder.stop();
            };
            requestAnimationFrame(drawFrame);
        });
    }

    bindComparisonEvents() {
        if (this.btnCopyComp) this.btnCopyComp.addEventListener('click', () => this.copyComparison());
        if (this.btnDownComp) this.btnDownComp.addEventListener('click', () => this.downloadComparison());
    }

    createComparisonCanvas() {
        if (!this.previewBefore || !this.previewAfter) return null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const imgWidth = this.previewBefore.naturalWidth;
        const imgHeight = this.previewBefore.naturalHeight;
        const gap = Math.max(20, imgWidth * 0.05); 
        const headerHeight = Math.max(80, imgHeight * 0.15); 
        const footerHeight = Math.max(60, imgHeight * 0.1); 
        const padding = Math.max(20, imgWidth * 0.05); 
        const totalWidth = (imgWidth * 2) + gap + (padding * 2);
        const totalHeight = imgHeight + headerHeight + footerHeight;

        canvas.width = totalWidth;
        canvas.height = totalHeight;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, totalWidth, totalHeight);
        ctx.drawImage(this.previewBefore, padding, headerHeight, imgWidth, imgHeight);
        ctx.drawImage(this.previewAfter, padding + imgWidth + gap, headerHeight, imgWidth, imgHeight);

        const drawLabel = (text, x, y, color) => {
            ctx.font = `bold ${Math.max(24, imgHeight * 0.04)}px sans-serif`;
            const metrics = ctx.measureText(text);
            const bgWidth = metrics.width + 40;
            const bgHeight = Math.max(40, imgHeight * 0.06);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, bgWidth, bgHeight);
            ctx.fillStyle = '#ffffff';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + 20, y + (bgHeight / 2));
        }

        drawLabel('BEFORE / 原片', padding + 20, headerHeight + 20, 'rgba(0, 0, 0, 0.7)');
        drawLabel('AFTER / 精修', padding + imgWidth + gap + 20, headerHeight + 20, 'rgba(16, 185, 129, 0.9)');
        return canvas;
    }

    copyComparison() {
        if (!this.btnCopyComp) return;
        const originalHtml = this.btnCopyComp.innerHTML;
        this.btnCopyComp.innerHTML = `<i data-lucide="loader" class="w-3 h-3 spinner"></i> 生成中...`;
        lucide.createIcons();
        setTimeout(() => {
            const canvas = this.createComparisonCanvas();
            if (!canvas) return;
            canvas.toBlob(blob => {
                if (navigator.clipboard && navigator.clipboard.write) {
                    const item = new ClipboardItem({ 'image/png': blob });
                    navigator.clipboard.write([item]).then(() => {
                        this.btnCopyComp.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> 已复制!`;
                        lucide.createIcons();
                        setTimeout(() => { this.btnCopyComp.innerHTML = originalHtml; lucide.createIcons(); }, 2000);
                    });
                }
            }, 'image/png');
        }, 50);
    }

    downloadComparison() {
        if (!this.btnDownComp) return;
        const originalHtml = this.btnDownComp.innerHTML;
        this.btnDownComp.innerHTML = `<i data-lucide="loader" class="w-3 h-3 spinner"></i> 下载中...`;
        lucide.createIcons();
        setTimeout(() => {
            const canvas = this.createComparisonCanvas();
            if (canvas) {
                const link = document.createElement('a');
                link.download = `contrast_${new Date().getTime()}.png`;
                link.href = canvas.toDataURL();
                link.click();
            }
            this.btnDownComp.innerHTML = originalHtml;
            lucide.createIcons();
        }, 50);
    }
}