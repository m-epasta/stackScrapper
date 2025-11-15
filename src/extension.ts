import * as vscode from 'vscode';
import { ErrorDetector } from './errorDetector';
import { StackOverflowSearcher } from './stackOverFlowSearcher';
import { ResultsPanel } from './resultsPanel';
import { ErrorHelpCodeActionProvider } from './codeActionsProvider';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('STACKSCRAPPER');
    outputChannel.appendLine('StackScrapper extension activated');
    outputChannel.show();

    const testCommand = vscode.commands.registerCommand('stackscrapper.test', () => {
        outputChannel.appendLine('TEST COMMAND EXECUTED');
        vscode.window.showInformationMessage('StackScrapper test command working!');
    });
    
    const errorDetector = new ErrorDetector();
    const stackOverflowSearcher = new StackOverflowSearcher();
    let resultsPanel: ResultsPanel | undefined;

    function log(message: string) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ${message}`);
        console.log(`STACKSCRAPPER: ${message}`);
    }

    function logError(message: string) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
        console.error(`STACKSCRAPPER ERROR: ${message}`);
    }

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

    log('Code action provider registered');

    const searchCurrentErrorCommand = vscode.commands.registerCommand('errorHelp.searchCurrentError', async () => {
        log('Command: searchCurrentError called');
        
        try {
            const errorContext = await errorDetector.getCurrentErrorContext(); 
            if (!errorContext) {
                log('No error context found in current file');
                vscode.window.showWarningMessage('No error detected in current file.');
                return;
            }

            log(`Error context found: ${errorContext.errorMessage}`);
            await performSearch(errorContext);
        } catch (error: any) {
            logError(`Error in searchCurrentError: ${error.message}`);
            vscode.window.showErrorMessage(`Error search failed: ${error.message}`);
        }
    });

    const quickSearchCommand = vscode.commands.registerCommand('errorHelp.quickSearch', async () => {
        log('Command: quickSearch called');
        
        try {
            const errorContext = await errorDetector.getCurrentErrorContext() || 
                                await errorDetector.getSelectedErrorContext(); 
            
            if (!errorContext) {
                log('No error context found for quick search');
                vscode.window.showWarningMessage('No error detected. Select an error message or ensure there are diagnostics.');
                return;
            }

            log(`Quick search context found: ${errorContext.errorMessage}`);
            await performSearch(errorContext);
        } catch (error: any) {
            logError(`Quick search failed: ${error.message}`);
            vscode.window.showErrorMessage(`Quick search failed: ${error.message}`);
        }
    });

    const searchSelectedErrorCommand = vscode.commands.registerCommand('errorHelp.searchSelectedError', async () => {
        log('Command: searchSelectedError called');
        
        try {
            const errorContext = await errorDetector.getSelectedErrorContext(); 
            if (!errorContext) {
                log('No selected error context found');
                vscode.window.showWarningMessage('Please select an error message to search.');
                return;
            }

            log(`Selected error context found: ${errorContext.errorMessage}`);
            await performSearch(errorContext);
        } catch (error: any) {
            logError(`Selected error search failed: ${error.message}`);
            vscode.window.showErrorMessage(`Selected error search failed: ${error.message}`);
        }
    });

    const searchErrorCommand = vscode.commands.registerCommand('errorHelp.searchError', async () => {
        log('Command: searchError called');
        
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter error message or search query',
                placeHolder: 'TypeError: Cannot read properties of undefined'
            });

            if (!query) {
                log('Manual search cancelled by user');
                return;
            }

            const errorContext = {
                errorMessage: query,
                codeSnippet: '',
                language: 'plaintext',
                filePath: '',
                lineNumber: 0
            };

            log(`Manual search with query: ${query}`);
            await performSearch(errorContext);
        } catch (error: any) {
            logError(`Manual search failed: ${error.message}`);
            vscode.window.showErrorMessage(`Manual search failed: ${error.message}`);
        }
    });

    async function performSearch(errorContext: any) {
        log(`Starting search with context: ${errorContext.errorMessage}`);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Searching Stack Overflow for: ${errorContext.errorMessage.substring(0, 50)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                log('Calling stackOverflowSearcher.search');
                const searchResult = await stackOverflowSearcher.search(errorContext);
                log(`Search completed, found ${searchResult.questions?.length || 0} questions`);
                progress.report({ increment: 100 });

                if (!resultsPanel) {
                    log('Creating new results panel');
                    resultsPanel = ResultsPanel.createOrShow(context.extensionUri);
                    resultsPanel.onDidDispose(() => {
                        resultsPanel = undefined;
                    });
                }

                log('Updating panel with results');
                resultsPanel.update(searchResult, errorContext);
                resultsPanel.reveal();
                log('Panel update complete');
                
            } catch (error: any) {
                logError(`Error in performSearch: ${error.message}`);
                vscode.window.showErrorMessage(`Search failed: ${error.message}`);
            }
        });
    }

    context.subscriptions.push(
        codeActionProviderRegistration,
        searchCurrentErrorCommand,
        quickSearchCommand,
        searchSelectedErrorCommand,
        searchErrorCommand,
        outputChannel
    );
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}