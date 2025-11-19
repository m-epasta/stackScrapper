import { ErrorContext, ErrorType } from './types';

export class QueryBuilder {
    private baseQuery: string;
    private parameters: SearchParameters;

    constructor(errorContext: ErrorContext) {
        this.parameters = {
            errorType: this.detectErrorType(errorContext.errorMessage),
            language: errorContext.language,
            codeContext: errorContext.codeSnippet,
            includeCodeContext: true
        };

        this.baseQuery = this.cleanErrorMessage(errorContext.errorMessage);
    }

    public buildQuery(): string {
        let query = this.baseQuery;

        // Add error-specific keywords
        query += this.getErrorSpecificKeywords();

        // Add code context keywords
        if (this.parameters.includeCodeContext && this.parameters.codeContext) {
            const codeKeywords = this.extractKeywordsFromCode(this.parameters.codeContext);
            if (codeKeywords.length > 0) {
                query += ` ${codeKeywords.join(' ')}`;
            }
        }

        // Add language tag
        if (this.parameters.language && this.parameters.language !== 'plaintext') {
            query += ` [${this.parameters.language}]`;
        }

        return query.trim();
    }

    private cleanErrorMessage(errorMessage: string): string {
        return errorMessage
            .replace(/'.*?'/g, '')
            .replace(/`.*?`/g, '')
            .replace(/\/.*\//g, '')
            .replace(/line \d+/gi, '')
            .replace(/\d+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private detectErrorType(errorMessage: string): ErrorType {
        const patterns = {
            syntax: /syntax error|unexpected token|expected/i,
            reference: /not defined|cannot find name|undefined/i,
            type: /type error|is not a function|cannot read property/i,
            runtime: /runtime error|maximum call stack/i,
            import: /cannot find module|import error|require is not defined/i
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(errorMessage)) {
                return type as ErrorType;
            }
        }
        return 'unknown';
    }

    private getErrorSpecificKeywords(): string {
        const keywordMap: any = {
            syntax: 'syntax fix example',
            reference: 'undefined variable declaration',
            type: 'type checking typescript',
            runtime: 'runtime error solution',
            import: 'module import require'
        };

        return keywordMap[this.parameters.errorType] || '';
    }

    private extractKeywordsFromCode(code: string): string[] {
        const keywords: string[] = [];
        
        const functionMatches = code.match(/(function|def|class)\s+(\w+)/g);
        if (functionMatches) {
            functionMatches.forEach(match => {
                const name = match.split(/\s+/)[1];
                if (name) keywords.push(name);
            });
        }
        
        const variableMatches = code.match(/(const|let|var)\s+(\w+)/g);
        if (variableMatches) {
            variableMatches.forEach(match => {
                const name = match.split(/\s+/)[1];
                if (name && name.length > 3) keywords.push(name);
            });
        }
        
        const methodMatches = code.match(/\.(\w+)\(/g);
        if (methodMatches) {
            methodMatches.forEach(match => {
                const method = match.slice(1, -1);
                if (method && method.length > 2) keywords.push(method);
            });
        }

        return keywords.slice(0, 5);
    }
}

interface SearchParameters {
    errorType: ErrorType;
    language: string;
    codeContext: string;
    includeCodeContext: boolean;
}