import * as vscode from 'vscode';
import axios from 'axios';
import { StackOverflowQuestion, StackOverflowAnswer, SearchResult, ErrorContext } from './types';

export class StackOverflowSearcher {
    private readonly baseUrl = 'https://api.stackexchange.com/2.3';
    private readonly site = 'stackoverflow';

    async search(errorContext: ErrorContext): Promise<SearchResult> {
        const query = this.buildSearchQuery(errorContext);
        const questions = await this.searchQuestions(query);
        const answers = await this.getAnswersForQuestions(questions);

        return {
            query,
            questions,
            answers,
            timestamp: Date.now()
        };
    }

    private buildSearchQuery(errorContext: ErrorContext): string {
        const config = this.getConfig();
        let query = errorContext.errorMessage;
        
        // Add code context if enabled
        if (config.includeCodeContext && errorContext.codeSnippet) {
            const codeKeywords = this.extractKeywordsFromCode(errorContext.codeSnippet);
            if (codeKeywords.length > 0) {
                query += ` ${codeKeywords.join(' ')}`;
            }
        }

        // Add language tag
        if (errorContext.language && errorContext.language !== 'plaintext') {
            query += ` [${errorContext.language}]`;
        }

        return query.trim();
    }

    private async searchQuestions(query: string): Promise<StackOverflowQuestion[]> {
        const config = this.getConfig();
        
        try {
            const params: any = {
                site: this.site,
                order: 'desc',
                sort: 'relevance',
                q: query,
                pagesize: config.maxResults,
                filter: 'withbody',
                answers: 1
            };

            // Add API key if provided
            if (config.apiKey) {
                params.key = config.apiKey;
            }

            const response = await axios.get(`${this.baseUrl}/search/advanced`, {
                params,
                timeout: config.searchTimeout
            });

            return response.data.items || [];
        } catch (error: any) {
            console.error('Stack Overflow search failed:', error);
            throw new Error(`Failed to search Stack Overflow: ${error.message}`);
        }
    }

    private async getAnswersForQuestions(questions: StackOverflowQuestion[]): Promise<Map<number, StackOverflowAnswer[]>> {
        const config = this.getConfig();
        const questionIds = questions.map(q => q.question_id);
        
        if (questionIds.length === 0) {
            return new Map();
        }

        try {
            const params: any = {
                site: this.site,
                order: 'desc',
                sort: 'votes',
                pagesize: 10,
                filter: 'withbody'
            };

            if (config.apiKey) {
                params.key = config.apiKey;
            }

            const response = await axios.get(
                `${this.baseUrl}/questions/${questionIds.join(';')}/answers`,
                { params, timeout: config.searchTimeout }
            );

            const answersMap = new Map<number, StackOverflowAnswer[]>();
            
            (response.data.items || []).forEach((answer: StackOverflowAnswer) => {
                if (!answersMap.has(answer.question_id)) {
                    answersMap.set(answer.question_id, []);
                }
                answersMap.get(answer.question_id)!.push(answer);
            });

            // Sort answers by score and accepted status
            answersMap.forEach((answers, questionId) => {
                answers.sort((a, b) => {
                    if (a.is_accepted && !b.is_accepted) return -1;
                    if (!a.is_accepted && b.is_accepted) return 1;
                    return b.score - a.score;
                });
            });

            return answersMap;
        } catch (error: any) {
            console.error('Failed to fetch answers:', error);
            return new Map();
        }
    }

    private extractKeywordsFromCode(code: string): string[] {
        // Extract potential keywords from code
        const keywords: string[] = [];
        
        // Function/method names
        const functionMatches = code.match(/(function|def|class)\s+(\w+)/g);
        if (functionMatches) {
            functionMatches.forEach(match => {
                const name = match.split(/\s+/)[1];
                if (name) keywords.push(name);
            });
        }
        
        // Variable names (longer ones are more meaningful)
        const variableMatches = code.match(/(const|let|var)\s+(\w+)/g);
        if (variableMatches) {
            variableMatches.forEach(match => {
                const name = match.split(/\s+/)[1];
                if (name && name.length > 3) keywords.push(name);
            });
        }
        
        // API calls, methods
        const methodMatches = code.match(/\.(\w+)\(/g);
        if (methodMatches) {
            methodMatches.forEach(match => {
                const method = match.slice(1, -1);
                if (method && method.length > 2) keywords.push(method);
            });
        }

        return keywords.slice(0, 5); // Limit to 5 keywords
    }

    private getConfig() {
        const config = vscode.workspace.getConfiguration('errorHelp');
        return {
            maxResults: config.get<number>('maxResults') || 10,
            searchTimeout: config.get<number>('searchTimeout') || 15000,
            includeCodeContext: config.get<boolean>('includeCodeContext') || true,
            apiKey: config.get<string>('apiKey') || '',
            filterByAccepted: config.get<boolean>('filterByAccepted') || true,
            minScore: config.get<number>('minScore') || 1
        };
    }
}