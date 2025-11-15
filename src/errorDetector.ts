import * as vscode from 'vscode';
import { ErrorContext } from './types';

export class ErrorDetector {
    
    async getCurrentErrorContext(): Promise<ErrorContext | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const document = editor.document;
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        // get error at current cursor position
        const position = editor.selection.active;
        const diagnosticAtCursor = diagnostics.find(diagnostic => 
            diagnostic.range.contains(position)
        );


        if (diagnosticAtCursor) {
            return this.createErrorContext(diagnosticAtCursor, document, position.line);
        }

        // if no error where find at cursor: try to find the first error in the file with severity as error
        const firstError = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Error);
        if (firstError) {
            return this.createErrorContext(firstError, document, firstError.range.start.line);
        }

        return null;
    }

    async getSelectedErrorContext(): Promise<ErrorContext | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            return null;
        }

        const selectedText = editor.document.getText(editor.selection).trim();
        if (selectedText.length === 0) {
            return null;
        }

        // check if the selected text looks like an error: maybe add some patterns later
        if (this.looksLikeErrorMessage(selectedText)) {
            const document = editor.document;
            const lineNumber = editor.selection.start.line;
            const codeSnippet = this.getCodeSnippet(document, lineNumber);

            return {
            errorMessage: selectedText,
            codeSnippet: codeSnippet,
            language: document.languageId,
            filePath: document.fileName,
            lineNumber: lineNumber
            };
        }

        return null;
    }


    private createErrorContext(
        diagnostic: vscode.Diagnostic, 
        document: vscode.TextDocument, 
        lineNumber: number
    ): ErrorContext {
        const codeSnippet = this.getCodeSnippet(document, lineNumber);
        
        return {
            errorMessage: diagnostic.message,
            codeSnippet: codeSnippet,
            language: document.languageId,
            filePath: document.fileName,
            lineNumber: lineNumber
        };
    }

    private getCodeSnippet(document: vscode.TextDocument, lineNumber: number): string {
        const startLine = Math.max(0, lineNumber - 2);
        const endLine = Math.min(document.lineCount - 1, lineNumber + 2);

        let snippet = '';
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            snippet += line.text + '\n';
        }

        return snippet.trim();
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
            /undefined is not a function/i,
            /unexpected token/i,
            /failed to/i,
            /not found/i            
        ];

        return errorPatterns.some(pattern => pattern.test(text));
    }
}