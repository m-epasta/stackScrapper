import * as vscode from 'vscode';
import * as path from 'path';
import { SearchResult, ErrorContext, StackOverflowQuestion, StackOverflowAnswer } from './types';

export class ResultsPanel {
    public static currentPanel: ResultsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri): ResultsPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ResultsPanel.currentPanel) {
            ResultsPanel.currentPanel._panel.reveal(column);
            return ResultsPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'errorHelpResults',
            'Error Help - Stack Overflow Results',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        ResultsPanel.currentPanel = new ResultsPanel(panel, extensionUri);
        return ResultsPanel.currentPanel;
    }

    // Change constructor to public
    public constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'openLink':
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        break;
                    case 'copyCode':
                        vscode.env.clipboard.writeText(message.code);
                        vscode.window.showInformationMessage('Code copied to clipboard!');
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        ResultsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public update(result: SearchResult, errorContext: ErrorContext) {
        this._panel.webview.postMessage({
            type: 'updateResults',
            data: {
                result,
                errorContext
            }
        });
    }

    public reveal() {
        this._panel.reveal();
    }

    public onDidDispose(callback: () => void) {
        this._panel.onDidDispose(callback);
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get path to resources on disk
        const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'main.js');
        const scriptUri = webview.asWebviewUri(scriptPath);
        
        // Use the external HTML file
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error Help - Stack Overflow Results</title>
                <style>
                    /* CSS will be loaded from external file or kept here */
                    body {
                        padding: 20px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        line-height: 1.4;
                    }
                    
                    .header {
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .query {
                        font-style: italic;
                        color: var(--vscode-descriptionForeground);
                        margin: 10px 0;
                        font-size: 0.9em;
                    }
                    
                    .result-item {
                        margin: 20px 0;
                        padding: 15px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                    }
                    
                    .question-title {
                        font-size: 1.1em;
                        font-weight: bold;
                        margin-bottom: 8px;
                    }
                    
                    .question-title a {
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                    }
                    
                    .question-title a:hover {
                        text-decoration: underline;
                    }
                    
                    .question-meta {
                        font-size: 0.85em;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 10px;
                    }
                    
                    .answer {
                        margin: 12px 0;
                        padding: 12px;
                        background: var(--vscode-editor-background);
                        border-left: 3px solid var(--vscode-inputValidation-infoBorder);
                        border-radius: 2px;
                    }
                    
                    .accepted-answer {
                        border-left-color: var(--vscode-testing-iconPassed);
                        background: var(--vscode-inputValidation-infoBackground);
                    }
                    
                    .answer-meta {
                        font-size: 0.8em;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .code-block {
                        background: var(--vscode-textCodeBlock-background);
                        padding: 12px;
                        border-radius: 4px;
                        margin: 10px 0;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 0.9em;
                        overflow-x: auto;
                        position: relative;
                    }
                    
                    .copy-btn {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 0.8em;
                        margin-top: 8px;
                    }
                    
                    .copy-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔍 Error Help Results</h1>
                    <div id="query-info" class="query"></div>
                    <div id="error-context" class="error-context" style="display: none;"></div>
                </div>
                <div id="results-container">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Loading Stack Overflow results...</p>
                    </div>
                </div>

                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}