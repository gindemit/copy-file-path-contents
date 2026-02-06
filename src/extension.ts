import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'copyFilePathContents.copy',
        async (arg1: any, _arg2: any) => {
            // Resolve the URI of the right-clicked tab (if any)
            let clickedUri: vscode.Uri | undefined;
            if (arg1 instanceof vscode.Uri) {
                clickedUri = arg1;
            } else if (arg1 && typeof arg1.scheme === 'string' && typeof arg1.path === 'string') {
                try {
                    clickedUri = vscode.Uri.from({
                        scheme: arg1.scheme,
                        authority: arg1.authority || '',
                        path: arg1.path,
                        query: arg1.query || '',
                        fragment: arg1.fragment || '',
                    });
                } catch { /* ignore */ }
            }

            // Collect all open text tabs
            interface TabInfo {
                label: string;
                uri: vscode.Uri;
                description: string;
            }
            const tabInfos: TabInfo[] = [];
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath ?? '';

            for (const group of vscode.window.tabGroups.all) {
                for (const tab of group.tabs) {
                    let uri: vscode.Uri | undefined;
                    if (tab.input instanceof vscode.TabInputText) {
                        uri = tab.input.uri;
                    }
                    if (!uri && tab.input && 'uri' in (tab.input as any)) {
                        uri = (tab.input as any).uri;
                    }
                    if (uri) {
                        let relPath: string;
                        if (uri.scheme === 'untitled') {
                            relPath = path.basename(uri.path) || uri.path;
                        } else {
                            relPath = workspaceRoot
                                ? path.relative(workspaceRoot, uri.fsPath)
                                : path.basename(uri.fsPath);
                        }
                        tabInfos.push({
                            label: tab.label,
                            uri,
                            description: relPath,
                        });
                    }
                }
            }

            if (tabInfos.length === 0) {
                vscode.window.showWarningMessage('No open files found.');
                return;
            }

            // If there's only one tab, skip the picker
            let selectedTabInfos: TabInfo[];
            if (tabInfos.length === 1) {
                selectedTabInfos = tabInfos;
            } else {
                // Build QuickPick items — pre-select the right-clicked tab
                const items: (vscode.QuickPickItem & { tabInfo: TabInfo })[] = tabInfos.map(info => ({
                    label: info.label,
                    description: info.description,
                    picked: clickedUri ? info.uri.toString() === clickedUri.toString() : false,
                    tabInfo: info,
                }));

                const picked = await vscode.window.showQuickPick(items, {
                    canPickMany: true,
                    title: 'Copy File Path + Contents',
                    placeHolder: 'Select files to copy (path + contents)',
                });

                if (!picked || picked.length === 0) {
                    return;
                }

                selectedTabInfos = picked.map(p => p.tabInfo);
            }

            // Build the result string
            const parts: string[] = [];

            for (const info of selectedTabInfos) {
                let content: string;
                try {
                    const doc = await vscode.workspace.openTextDocument(info.uri);
                    content = doc.getText();
                } catch {
                    const openDoc = vscode.workspace.textDocuments.find(
                        d => d.uri.toString() === info.uri.toString()
                    );
                    if (openDoc) {
                        content = openDoc.getText();
                    } else {
                        content = '[Error reading file]';
                    }
                }

                parts.push(`${info.description}\n${content}`);
            }

            const result = parts.join('\n\n---\n\n');

            await vscode.env.clipboard.writeText(result);
            vscode.window.showInformationMessage(
                `Copied path + contents of ${selectedTabInfos.length} file${selectedTabInfos.length > 1 ? 's' : ''} to clipboard.`
            );
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}
