import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import JSZip from 'jszip';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  path: string;
  expanded?: boolean; // Add this property for tracking expansion state
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  fileStructure: FileNode[] = [];
  showFileExplorer = false;
  selectedFileContent: string | null = null;
  selectedFileName: string = '';
  fileMetadata: Map<string, string> = new Map();
  allowedExtensions = ['.cs', '.json'];
  uploadProgress: number = 0;
  isUploading: boolean = false;
  selectedFile: File | null = null;

  // Add trackBy functions
  trackByPath(index: number, node: FileNode): string {
    return node.path;
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  toggleFolder(node: FileNode) {
    if (node.type === 'folder') {
      node.expanded = !node.expanded;
    }
  }

  async startUpload() {
    if (!this.selectedFile) {
      alert('Please select a file first');
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      const zip = new JSZip();
      
      const progressInterval = setInterval(() => {
        if (this.uploadProgress < 90) {
          this.uploadProgress += 10;
        }
      }, 200);

      const zipContents = await zip.loadAsync(this.selectedFile);
      this.fileStructure = [];
      this.fileMetadata.clear();

      // Process all files
      for (const [filePath, zipEntry] of Object.entries(zipContents.files)) {
        if (!zipEntry.name) continue;

        if (!zipEntry.dir && !this.isAllowedFile(zipEntry.name)) continue;

        if (!zipEntry.dir) {
          const content = await zipEntry.async('text').catch(() => 'Unable to read file content');
          this.fileMetadata.set(filePath, content);
        }

        this.addToFileStructure(filePath, zipEntry.dir);
      }

      // Cleanup and finalize
      this.cleanupEmptyFolders(this.fileStructure);
      clearInterval(progressInterval);
      this.uploadProgress = 100;
      
      setTimeout(() => {
        this.showFileExplorer = true;
        this.isUploading = false;
      }, 500);

    } catch (error) {
      console.error('Error processing zip file:', error);
      alert('Error processing zip file. Please try another file.');
      this.isUploading = false;
      this.uploadProgress = 0;
    }
  }

  isAllowedFile(filename: string): boolean {
    return this.allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  shouldShowNode(node: FileNode): boolean {
    if (node.type === 'file') {
      return this.isAllowedFile(node.name);
    }
    if (node.type === 'folder' && node.children) {
      return node.children.some(child => 
        child.type === 'file' ? this.isAllowedFile(child.name) : this.shouldShowNode(child)
      );
    }
    return false;
  }

  cleanupEmptyFolders(nodes: FileNode[]): boolean {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.type === 'folder' && node.children) {
        const hasValidChildren = !this.cleanupEmptyFolders(node.children);
        if (!hasValidChildren) {
          nodes.splice(i, 1);
        }
      }
    }
    return nodes.length === 0;
  }

  addToFileStructure(path: string, isDirectory: boolean) {
    const parts = path.split('/');
    let currentLevel = this.fileStructure;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const isLastPart = i === parts.length - 1;
      const existingNode = currentLevel.find(node => node.name === part);

      if (existingNode) {
        if (existingNode.type === 'folder') {
          currentLevel = existingNode.children!;
        }
      } else {
        const newNode: FileNode = {
          name: part,
          type: isLastPart && !isDirectory ? 'file' : 'folder',
          path: parts.slice(0, i + 1).join('/'),
          children: isLastPart && !isDirectory ? undefined : [],
          expanded: false // Initialize as collapsed
        };

        currentLevel.push(newNode);
        if (newNode.type === 'folder') {
          currentLevel = newNode.children!;
        }
      }
    }
  }

  onFileClick(node: FileNode) {
    if (node.type === 'file') {
      this.selectedFileName = node.name;
      this.selectedFileContent = this.fileMetadata.get(node.path) || 'Unable to read file content';
    } else if (node.type === 'folder') {
      this.toggleFolder(node);
    }
  }
}