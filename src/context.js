import { WatermarkEngine } from './core/watermarkEngine.js';
import { FileSystemManager } from './core/FileSystemManager.js';
import { TimeTraceViewer } from './ui/TimeTraceViewer.js';

class AppContext {
    constructor() {
        this.engine = null;
        this.fs = new FileSystemManager();
        this.sidebar = null; // Set after initialization
        this.viewer = new TimeTraceViewer();
        
        // Session State
        this.session = {
            userName: '',
            projectName: '',
            originalBlob: null,
            rawRetouchedBlob: null, // For toggling de-watermark
            cleanBlob: null,
            originalUrl: null,
            cleanUrl: null,
            isNew: true
        };

        // Pending Import State
        this.pendingImport = {
            original: null,
            retouched: null
        };
    }

    async initEngine() {
        this.engine = await WatermarkEngine.create();
    }

    resetSession() {
        this.session = {
            userName: '',
            projectName: '',
            originalBlob: null,
            rawRetouchedBlob: null,
            cleanBlob: null,
            originalUrl: null,
            cleanUrl: null,
            isNew: true
        };
    }
}

export const context = new AppContext();
