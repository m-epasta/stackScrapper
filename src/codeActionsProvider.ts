import * as vscode from 'vscode';
import { ErrorDetector } from './errorDetector';

export class stackScrapperCodeActionProvider implements vscode.CodeActionProvider {
    private errorDetector: ErrorDetector;

    constructor() {
        this.errorDetector = new ErrorDetector();
    }

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // Check if there are diagnostics at the current position
        const diagnosticsAtCursor = context.diagnostics.filter(diagnostic => 
            diagnostic.range.intersection(range)
        );

        if (diagnosticsAtCursor.length > 0) {
            const errorAction = this.createSearchAction(document, range, diagnosticsAtCursor[0]);
            actions.push(errorAction);
        }

        // Check selected text for error-like patterns
        if (!range.isEmpty) {
            const selectedText = document.getText(range);
            if (this.looksLikeErrorMessage(selectedText)) {
                const selectedAction = this.createSelectedTextAction(document, range, selectedText);
                actions.push(selectedAction);
            }
        }

        return actions;
    }

    private createSearchAction(
        document: vscode.TextDocument,
        range: vscode.Range,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Search Error on Stack Overflow',
            vscode.CodeActionKind.QuickFix
        );

        action.command = {
            command: 'stackScrapper.searchCurrentError',
            title: 'Search Error on Stack Overflow',
            tooltip: 'Search Stack Overflow for this error solution'
        };

        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        return action;
    }

    private createSelectedTextAction(
        document: vscode.TextDocument,
        range: vscode.Range,
        selectedText: string
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            'Search Selected Error on Stack Overflow',
            vscode.CodeActionKind.QuickFix
        );

        action.command = {
            command: 'stackScrapper.searchSelectedError',
            title: 'Search Selected Error on Stack Overflow'
        };

        return action;
    }

    private looksLikeErrorMessage(text: string): boolean {
        const errorPatterns = [
            /error:/i,
            /exception:/i,
            /typeerror/i,
            /referenceerror/i,
            /syntaxerror/i,
            /is not defined/i,
            /cannot read property/i,
            /undefined is not a function/i
        ];

        return errorPatterns.some(pattern => pattern.test(text));
    }
}