import * as vscode from 'vscode';
import { SearchResult, ErrorContext } from './types';
import { Logger } from './logger';

export class ResultsPanel {
    public static currentPanel: ResultsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _lastResult: { result: SearchResult, errorContext: ErrorContext } | undefined;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri): ResultsPanel {
        const column = vscode.window.activeTextEditor?.viewColumn;

        if (ResultsPanel.currentPanel) {
            ResultsPanel.currentPanel._panel.reveal(column);
            return ResultsPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'stackScrapperResults',
            'Stack Scrapper - Stack Overflow Results',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        ResultsPanel.currentPanel = new ResultsPanel(panel, extensionUri);
        return ResultsPanel.currentPanel;
    }

    public constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
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
                    case 'webviewReady':
                        Logger.debug('Webview is ready to receive messages');
                        if (this._lastResult) {
                            this.sendUpdate(this._lastResult.result, this._lastResult.errorContext);
                        }
                        break;
                    case 'webviewLog':
                        Logger.log(`Webview: ${message.message}`);
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
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    public update(result: SearchResult, errorContext: ErrorContext) {
        this._lastResult = { result, errorContext };
        this.sendUpdate(result, errorContext);
    }

    private sendUpdate(result: SearchResult, errorContext: ErrorContext) {
        Logger.debug('Sending updateResults to webview');

        const serializableAnswers = Array.from(result.answers.entries());

        this._panel.webview.postMessage({
            type: 'updateResults',
            data: { 
                result: {
                    ...result,
                    answers: serializableAnswers
                },
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

    private async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = await this._getHtmlForWebview(webview);
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'index.html');
        
        try {
            const htmlBytes = await vscode.workspace.fs.readFile(htmlPath);
            let html = Buffer.from(htmlBytes).toString('utf8');
            
            const scriptPath = webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'webview', 'main.js')
            );
            
            html = html.replace('src="main.js"', `src="${scriptPath}"`);
            
            return html;
        } catch (error) {
            Logger.error(`Failed to load webview HTML: ${error}`);
            return this._getFallbackHtml();
        }
    }

    private _getFallbackHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>STACKSCRAPPER - Setup Required</title>
                <style>
                    body { 
                        padding: 40px; 
                        font-family: var(--vscode-font-family); 
                        color: var(--vscode-foreground); 
                        background-color: var(--vscode-editor-background); 
                        line-height: 1.6;
                        text-align: center;
                    }
                    .error-container {
                        max-width: 500px;
                        margin: 0 auto;
                        padding: 30px;
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        border-radius: 8px;
                        background: var(--vscode-inputValidation-errorBackground);
                    }
                    .error-icon {
                        font-size: 48px;
                        margin-bottom: 20px;
                    }
                    .error-code {
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-family: monospace;
                        margin: 20px 0;
                        display: inline-block;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h2>Setup Required</h2>
                    <p>The extension needs to be reinstalled or rebuilt.</p>
                    <div class="error-code">ERR_WEBVIEW_MISSING</div>
                    <p>Please restart Visual Studio Code or reinstall the extension.</p>
                </div>
            </body>
            </html>
        `;
    }
}