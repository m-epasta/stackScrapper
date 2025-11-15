import * as vscode from 'vscode';
import { ErrorDetector } from './errorDetector';
import { StackOverflowSearcher } from './stackOverFlowSearcher';
import { ResultsPanel } from './resultsPanel';
import { ErrorHelpCodeActionProvider } from './codeActionsProvider';

export function activate(context: vscode.ExtensionContext) {
    const errorDetector = new ErrorDetector();
    const stackOverflowSearcher = new StackOverflowSearcher();
    let resultsPanel: ResultsPanel | undefined;

    // Register code action provider
    const codeActionProvider = new ErrorHelpCodeActionProvider();
    const codeActionProviderRegistration = vscode.languages.registerCodeActionsProvider(
        [
            'javascript', 'typescript', 'python', 'java', 
            'cpp', 'csharp', 'php', 'ruby', 'go'
        ],
        codeActionProvider,
        {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        }
    );

    // Command: Search current error
    const searchCurrentErrorCommand = vscode.commands.registerCommand('errorHelp.searchCurrentError', async () => {
        try {
            const errorContext = await errorDetector.getCurrentErrorContext(); 
            if (!errorContext) {
                vscode.window.showWarningMessage('No error detected in current file.');
                return;
            }

            await performSearch(errorContext);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error search failed: ${error.message}`);
        }
    });

    // Command: Quick search
    const quickSearchCommand = vscode.commands.registerCommand('errorHelp.quickSearch', async () => {
        try {
            const errorContext = await errorDetector.getCurrentErrorContext() || 
                                await errorDetector.getSelectedErrorContext(); 
            
            if (!errorContext) {
                vscode.window.showWarningMessage('No error detected. Select an error message or ensure there are diagnostics.');
                return;
            }

            await performSearch(errorContext);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Quick search failed: ${error.message}`);
        }
    });

    // Command: Search selected error
    const searchSelectedErrorCommand = vscode.commands.registerCommand('errorHelp.searchSelectedError', async () => {
        try {
            const errorContext = await errorDetector.getSelectedErrorContext(); 
            if (!errorContext) {
                vscode.window.showWarningMessage('Please select an error message to search.');
                return;
            }

            await performSearch(errorContext);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Selected error search failed: ${error.message}`);
        }
    });

    // Command: Manual search
    const searchErrorCommand = vscode.commands.registerCommand('errorHelp.searchError', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter error message or search query',
                placeHolder: 'TypeError: Cannot read properties of undefined'
            });

            if (!query) {
                return;
            }

            const errorContext = {
                errorMessage: query,
                codeSnippet: '',
                language: 'plaintext',
                filePath: '',
                lineNumber: 0
            };

            await performSearch(errorContext);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Manual search failed: ${error.message}`);
        }
    });

    async function performSearch(errorContext: any) {
        console.log("Starting search with context:", errorContext); 
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Searching Stack Overflow for: ${errorContext.errorMessage.substring(0, 50)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                // Search Stack Overflow
                console.log("Calling stackOverflowSearcher.search..."); 
                const searchResult = await stackOverflowSearcher.search(errorContext);
                console.log("Search completed, result:", searchResult); 
                progress.report({ increment: 100 });

                // Show results
                if (!resultsPanel) {
                    console.log("Creating new results panel..."); 
                    resultsPanel = ResultsPanel.createOrShow(context.extensionUri);
                    resultsPanel.onDidDispose(() => {
                        resultsPanel = undefined;
                    });
                }

                console.log("Updating panel with results...");
                resultsPanel.update(searchResult, errorContext);
                resultsPanel.reveal();
                console.log("Panel update complete");
                
            } catch (error: any) {
                console.error("Error in performSearch:", error);
                vscode.window.showErrorMessage(`Search failed: ${error.message}`);
            }
        });
    }

    context.subscriptions.push(
        codeActionProviderRegistration,
        searchCurrentErrorCommand,
        quickSearchCommand,
        searchSelectedErrorCommand,
        searchErrorCommand
    );
}

export function deactivate() {}