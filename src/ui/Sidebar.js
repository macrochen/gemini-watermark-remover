/**
 * Sidebar Component - Displays the User > Project tree structure
 */
export class Sidebar {
    constructor(containerId, onSelectProject) {
        this.container = document.getElementById(containerId);
        this.onSelectProject = onSelectProject;
        this.tree = [];
    }

    render(tree) {
        this.tree = tree;
        if (!this.container) return;

        if (tree.length === 0) {
            this.container.innerHTML = `
                <div class="p-4 text-gray-500 text-sm italic">
                    工作区为空，请导入或选择目录
                </div>
            `;
            return;
        }

        let html = '<div class="space-y-2 p-2">';
        
        // Sort users alphabetically
        const sortedUsers = [...tree].sort((a, b) => a.name.localeCompare(b.name));

        sortedUsers.forEach(user => {
            html += `
                <div class="user-group">
                    <div class="flex items-center gap-2 px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <i data-lucide="user" class="w-3 h-3"></i>
                        <span>${user.name}</span>
                    </div>
                    <div class="mt-1 space-y-0.5 ml-2">
            `;

            // Sort projects by name (usually timestamp) descending
            const sortedProjects = [...user.projects].sort((a, b) => b.name.localeCompare(a.name));

            sortedProjects.forEach(proj => {
                html += `
                    <button 
                        class="project-item w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2"
                        data-user="${user.name}"
                        data-project="${proj.name}"
                    >
                        <i data-lucide="folder" class="w-4 h-4 text-gray-500"></i>
                        <span class="truncate">${proj.name}</span>
                    </button>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        this.container.innerHTML = html;
        
        // Bind events
        this.container.querySelectorAll('.project-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const userName = btn.dataset.user;
                const projName = btn.dataset.project;
                const project = this.tree.find(u => u.name === userName)?.projects.find(p => p.name === projName);
                if (project) {
                    this.setActive(btn);
                    this.onSelectProject(userName, project);
                }
            });
        });

        lucide.createIcons();
    }

    setActive(activeBtn) {
        this.container.querySelectorAll('.project-item').forEach(btn => {
            btn.classList.remove('bg-primary/20', 'text-primary', 'ring-1', 'ring-primary/30');
        });
        activeBtn.classList.add('bg-primary/20', 'text-primary', 'ring-1', 'ring-primary/30');
    }
}
