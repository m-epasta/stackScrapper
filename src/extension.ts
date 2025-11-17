import * as vscode from 'vscode';
import { ErrorDetector } from './errorDetector';
import { StackOverflowSearcher } from './stackOverFlowSearcher';
import { ResultsPanel } from './resultsPanel';
import { stackScrapperCodeActionProvider } from './codeActionsProvider';
import { Logger } from './logger';

export let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('STACKSCRAPPER');
    outputChannel.show();
    Logger.init(outputChannel);
    

    const testCommand = vscode.commands.registerCommand('stackscrapper.test', () => {
        Logger.debug('TEST COMMAND EXECUTED');
        vscode.window.showInformationMessage('StackScrapper test command working!');
    });
    
    const errorDetector = new ErrorDetector();
    const stackOverflowSearcher = new StackOverflowSearcher();
    let resultsPanel: ResultsPanel | undefined;

    const codeActionProvider = new stackScrapperCodeActionProvider();
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

    Logger.log('Code action provider registered');

    const searchCurrentErrorCommand = vscode.commands.registerCommand('stackScrapper.searchCurrentError', async () => {
        Logger.log('Command: searchCurrentError called');
        
        try {
            const errorContext = await errorDetector.getCurrentErrorContext(); 
            if (!errorContext) {
                Logger.log('No error context found in current file');
                vscode.window.showWarningMessage('No error detected in current file.');
                return;
            }

            Logger.log(`Error context found: ${errorContext.errorMessage}`);
            await performSearch(errorContext);
        } catch (error: any) {
            Logger.error(`Error in searchCurrentError: ${error.message}`);
            vscode.window.showErrorMessage(`Error search failed: ${error.message}`);
        }
    });

    const quickSearchCommand = vscode.commands.registerCommand('stackScrapper.quickSearch', async () => {
        Logger.log('Command: quickSearch called');
        
        try {
            const errorContext = await errorDetector.getCurrentErrorContext() || 
                                await errorDetector.getSelectedErrorContext(); 
            
            if (!errorContext) {
                Logger.log('No error context found for quick search');
                vscode.window.showWarningMessage('No error detected. Select an error message or ensure there are diagnostics.');
                return;
            }

            Logger.log(`Quick search context found: ${errorContext.errorMessage}`);
            await performSearch(errorContext);
        } catch (error: any) {
            Logger.error(`Quick search failed: ${error.message}`);
            vscode.window.showErrorMessage(`Quick search failed: ${error.message}`);
        }
    });

    const searchSelectedErrorCommand = vscode.commands.registerCommand('stackScrapper.searchSelectedError', async () => {
        Logger.log('Command: searchSelectedError called');
        
        try {
            const errorContext = await errorDetector.getSelectedErrorContext(); 
            if (!errorContext) {
                Logger.log('No selected error context found');
                vscode.window.showWarningMessage('Please select an error message to search.');
                return;
            }

            Logger.error(`Selected error context found: ${errorContext.errorMessage}`);
            await performSearch(errorContext);
        } catch (error: any) {
            Logger.error(`Selected error search failed: ${error.message}`);
            vscode.window.showErrorMessage(`Selected error search failed: ${error.message}`);
        }
    });

    const searchErrorCommand = vscode.commands.registerCommand('stackScrapper.searchError', async () => {
        Logger.log('Command: searchError called');
        
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter error message or search query',
                placeHolder: 'TypeError: Cannot read properties of undefined'
            });

            if (!query) {
                Logger.log('Manual search cancelled by user');
                return;
            }

            const errorContext = {
                errorMessage: query,
                codeSnippet: '',
                language: 'plaintext',
                filePath: '',
                lineNumber: 0
            };

            Logger.log(`Manual search with query: ${query}`);
            await performSearch(errorContext);
        } catch (error: any) {
            Logger.error(`Manual search failed: ${error.message}`);
            vscode.window.showErrorMessage(`Manual search failed: ${error.message}`);
        }
    });

    async function performSearch(errorContext: any) {
        Logger.log(`Starting search with context: ${errorContext.errorMessage}`);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Searching Stack Overflow for: ${errorContext.errorMessage.substring(0, 50)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                Logger.log('Calling stackOverflowSearcher.search');
                const searchResult = await stackOverflowSearcher.search(errorContext);
                Logger.log(`Search completed, found ${searchResult.questions?.length || 0} questions`);
                progress.report({ increment: 100 });

                if (!resultsPanel) {
                    Logger.log('Creating new results panel');
                    resultsPanel = ResultsPanel.createOrShow(context.extensionUri);
                    resultsPanel.onDidDispose(() => {
                        resultsPanel = undefined;
                    });
                }

                Logger.log('Updating panel with results');
                resultsPanel.update(searchResult, errorContext);
                resultsPanel.reveal();
                Logger.log('Panel update complete');
                
            } catch (error: any) {
                Logger.error(`Error in performSearch: ${error.message}`);
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