import { ErrorContext, ErrorType } from './types';

export class QueryBuilder {
    private baseQuery: string;
    private parameters: SearchParameters;
    private config: Required<QueryBuilderConfig>;

    private static readonly CLEANING_PATTERNS = {
    whitespace: /\s+/g,
    specialChars: /[^\w\s[\]\-]/g,
    filePaths: /(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+\.\w+)/g,
    urls: /(https?:\/\/[^\s]+)/g,
    lineNumbers: /\b(?:line|at line|position)\s+\d+/gi,
    positionPatterns: /[\(:]\d+[\):]/g,
    standaloneNumbers: /\b\d+\b/g
    }as const;

    constructor(errorContext: ErrorContext, config: QueryBuilderConfig = {}) {
        if (!errorContext?.errorMessage) {
            throw new Error('ErrorContext must contain an errorMessage');
        }

        this.config = {
            maxQueryLength: 200,
            maxKeywords: 8,
            preserveCodeStructure: true,
            ...config 
        };

        this.parameters = {
            errorType: this.detectErrorType(errorContext.errorMessage),
            language: errorContext.language,
            codeContext: errorContext.codeSnippet,
            includeCodeContext: true
        };

        if (this.config.maxQueryLength <= 0) {
        throw new Error('maxQueryLength must be positive');
        }

        if (this.config.maxKeywords < 0) {
            throw new Error('maxKeywords cannot be negative');
        }


        this.baseQuery = this.cleanErrorMessage(errorContext.errorMessage);
    }

    public buildQuery(): string {
        const queryParts: string[] = [this.baseQuery];

        // Add error-specific keywords with higher priority
        const specificKeywords = this.getErrorSpecificKeywords();
        if (specificKeywords) {
            queryParts.push(specificKeywords);
        }

        // Add code context keywords
        if (this.parameters.includeCodeContext && this.parameters.codeContext) {
            const codeKeywords = this.extractKeywordsFromCode(this.parameters.codeContext);
            if (codeKeywords.length > 0) {
                const prioritizedKeywords = codeKeywords
                    .sort((a, b) => b.length - a.length)
                    .slice(0, Math.min(3, this.config.maxKeywords));
                queryParts.push(prioritizedKeywords.join(' '));
            }
        }

        // Add language tag as metadata
        if (this.parameters.language && this.parameters.language !== 'plaintext') {
            queryParts.push(`[${this.parameters.language}]`);
        }

        return this.sanitizeQuery(queryParts.join(' '));
    }
    private sanitizeQuery(query: string): string {
        return query
            .replace(QueryBuilder.CLEANING_PATTERNS.whitespace, ' ')
            .replace(QueryBuilder.CLEANING_PATTERNS.specialChars, ' ')
            .trim()
            .slice(0, this.config.maxQueryLength);
    }

    private cleanErrorMessage(errorMessage: string): string {
        const preservedPatterns = [
            /\b(?:any|string|number|boolean|object|array|function|void|null|undefined)\b/gi,
            /\b(?:const|let|var|function|class|interface|type)\b/gi,
            /\b(?:is not assignable|cannot be applied|missing the following|but required)\b/gi
        ];

        let cleaned = errorMessage
            .replace(/\s+/g, ' ')
            .trim();

        // Store preserved segments with unique placeholders
        const preservedMap = new Map<string, string>();
        preservedPatterns.forEach((pattern, patternIndex) => {
            let match;
            while ((match = pattern.exec(cleaned)) !== null) {
                const placeholder = `__PRESERVED_${patternIndex}_${preservedMap.size}__`;
                preservedMap.set(placeholder, match[0]);
                cleaned = cleaned.replace(match[0], placeholder);
            }
        });

        // Apply cleaning
        cleaned = cleaned
            .replace(/(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+\.\w+)/g, '')
            .replace(/(https?:\/\/[^\s]+)/g, '')
            .replace(/['"`](.*?)['"`]/g, (match, content) => {
                // Only remove quotes if content looks like a path or specific value
                return /^[\w\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(content) ? '' : match;
            })
            .replace(/\b\d+\b/g, '')
            .replace(/\b(?:line|at line|position)\s+\d+/gi, '')
            .replace(/[\(:]\d+[\):]/g, '') // Remove (123) or :123: patterns
            .replace(/\s+/g, ' ')
            .trim();

        // Restore preserved segments
        preservedMap.forEach((value, key) => {
            cleaned = cleaned.replace(key, value);
        });

        return cleaned;
    }

    private detectErrorType(errorMessage: string): ErrorType {
        const patterns: Array<[ErrorType, RegExp]> = [
            ['syntax', /syntax error|unexpected token|expected.*but found|missing.*after/i],
            ['reference', /\b(?:not defined|cannot find name|undefined|is not defined|unresolved)\b/i],
            ['type', /type error|is not a function|cannot read property|not assignable|does not exist on type/i],
            ['runtime', /runtime error|maximum call stack|out of memory|stack overflow/i],
            ['import', /cannot find module|import error|require is not defined|module not found/i]
        ];

        for (const [type, pattern] of patterns) {
            if (pattern.test(errorMessage)) {
                return type;
            }
        }
        return 'unknown';
    }

    private getErrorSpecificKeywords(): string {
        const keywordMap: Record<ErrorType, string> = {
            syntax: 'syntax fix correction example',
            reference: 'undefined variable declaration reference',
            type: 'type typescript interface generic',
            runtime: 'runtime error solution debug',
            import: 'module import require path resolution',
            unknown: 'solution fix example'
        };

        return keywordMap[this.parameters.errorType] || '';
    }

    private extractKeywordsFromCode(code: string): string[] {
        if (!code || code.length < 5) return []; 

        const keywords = new Set<string>();
        
        // Combined regex for better performance
        const patterns = {
            declarations: /(?:function|class|interface|enum|type|const|let|var)\s+(\w+)/g,
            methods: /\.(\w+)\s*\(/g,
            types: /(?:type|interface)\s+(\w+)\s*[= {]/g
        };

        // Extract all matches in single passes
        let match;
        
        // Declaration names
        while ((match = patterns.declarations.exec(code)) !== null) {
            const name = match[1];
            if (this.isValidKeyword(name)) keywords.add(name);
        }
        
        // Method names
        while ((match = patterns.methods.exec(code)) !== null) {
            const method = match[1].trim();
            if (this.isValidKeyword(method)) keywords.add(method);
        }
        
        // Type names
        while ((match = patterns.types.exec(code)) !== null) {
            const typeName = match[1];
            if (this.isValidKeyword(typeName)) keywords.add(typeName);
        }

        return Array.from(keywords).slice(0, this.config.maxKeywords);
    }

    private isValidKeyword(keyword: string): boolean {
        if (!keyword || keyword.length <= 2) return false;
        
        // Skip single letters
        if (/^[a-z]$/i.test(keyword)) return false;
        
        // Skip common language keywords
        if (/^(?:if|for|while|switch|case|return|break|continue|const|let|var|function|class|interface|type)$/i.test(keyword)) {
            return false;
        }
        
        // Skip common built-in methods and properties
        if (/^(?:length|toString|valueOf|constructor|prototype)$/i.test(keyword)) {
            return false;
        }
        
        // Skip numbers and numeric patterns
        if (/^\d+$/.test(keyword)) return false;
        
        return true;
    }
}

interface SearchParameters {
    errorType: ErrorType;
    language: string;
    codeContext: string;
    includeCodeContext: boolean;
}

interface QueryBuilderConfig {
    maxQueryLength?: number;
    maxKeywords?: number;
    preserveCodeStructure?: boolean;
}