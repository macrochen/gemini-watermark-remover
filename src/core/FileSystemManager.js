/**
 * FileSystemManager - Handles interaction with the local file system using FileSystem Access API.
 */
export class FileSystemManager {
    constructor() {
        this.rootHandle = null;
        this.tree = [];
    }

    /**
     * Request user to select a directory as the root workspace
     */
    async mountWorkspace() {
        try {
            this.rootHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            await this.refreshTree();
            return this.rootHandle;
        } catch (err) {
            console.error('Failed to mount workspace:', err);
            return null;
        }
    }

    /**
     * Scan the directory to build a tree structure (Users > Projects)
     */
    async refreshTree() {
        if (!this.rootHandle) return [];
        
        const tree = [];
        for await (const [name, handle] of this.rootHandle.entries()) {
            if (handle.kind === 'directory') {
                const userNode = {
                    name,
                    handle,
                    projects: []
                };

                // Scan projects under this user
                for await (const [projName, projHandle] of handle.entries()) {
                    if (projHandle.kind === 'directory') {
                        userNode.projects.push({
                            name: projName,
                            handle: projHandle
                        });
                    }
                }
                tree.push(userNode);
            }
        }
        this.tree = tree;
        return tree;
    }

    /**
     * Get or create a project directory
     * @param {string} userName 
     * @param {string} projectName 
     */
    async getProjectDirectory(userName, projectName) {
        if (!this.rootHandle) throw new Error('No workspace mounted');

        const userHandle = await this.rootHandle.getDirectoryHandle(userName, { create: true });
        const projHandle = await userHandle.getDirectoryHandle(projectName, { create: true });
        return projHandle;
    }

    /**
     * Save a file (Blob) to a project directory
     * @param {FileSystemDirectoryHandle} projectHandle 
     * @param {string} fileName 
     * @param {Blob} blob 
     */
    async saveFileToProject(projectHandle, fileName, blob) {
        const fileHandle = await projectHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    /**
     * Save export files to [project]/export/
     */
    async saveExportFile(projectHandle, fileName, blob) {
        const exportHandle = await projectHandle.getDirectoryHandle('export', { create: true });
        await this.saveFileToProject(exportHandle, fileName, blob);
    }

    /**
     * Load an image file from a project as a DataURL
     */
    async loadFileAsDataURL(projectHandle, fileName) {
        try {
            const fileHandle = await projectHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        } catch (err) {
            console.warn(`File ${fileName} not found in project`);
            return null;
        }
    }

    /**
     * Check if workspace is mounted and permissions are granted
     */
    async verifyPermission() {
        if (!this.rootHandle) return false;
        const options = { mode: 'readwrite' };
        if ((await this.rootHandle.queryPermission(options)) === 'granted') return true;
        if ((await this.rootHandle.requestPermission(options)) === 'granted') return true;
        return false;
    }
}
