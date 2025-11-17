import * as vscode from 'vscode';
import axios from 'axios';
import { StackOverflowQuestion, StackOverflowAnswer, SearchResult, ErrorContext } from './types';
import { Logger } from './logger';

export class StackOverflowSearcher {
    private readonly baseUrl = 'https://api.stackexchange.com/2.3';
    private readonly site = 'stackoverflow';

    async search(errorContext: ErrorContext): Promise<SearchResult> {
        try {
            Logger.log('=== STACKOVERFLOW SEARCHER START ===');
            Logger.log(`Building query from: ${errorContext.errorMessage}`);
            const query = this.buildSearchQuery(errorContext);
            Logger.log(`Final query: ${query}`);
            
            Logger.log('Making API request...');
            const questions = await this.searchQuestions(query);
            Logger.log(`Found ${questions?.length || 0} questions`);
            
            const answers = await this.getAnswersForQuestions(questions);
            Logger.log(`Answers map size: ${answers.size}`);

            Logger.log('=== STACKOVERFLOW SEARCHER END ===');
            return {
                query,
                questions: questions || [],
                answers,
                timestamp: Date.now()
            };
        } catch (error) {
            Logger.error(`=== SEARCH ERROR: ${error} ===`);
            throw error;
        }
    }

    private buildSearchQuery(errorContext: ErrorContext): string {
        const config = this.getConfig();
        let query = errorContext.errorMessage;
        
        query = this.cleanErrorMessage(query);
        
        if (config.includeCodeContext && errorContext.codeSnippet) {
            const codeKeywords = this.extractKeywordsFromCode(errorContext.codeSnippet);
            if (codeKeywords.length > 0) {
                query += ` ${codeKeywords.join(' ')}`;
            }
        }

        if (errorContext.language && errorContext.language !== 'plaintext') {
            query += ` [${errorContext.language}]`;
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

    private async searchQuestions(query: string): Promise<StackOverflowQuestion[]> {
        const config = this.getConfig();
        
        Logger.log(`API Config - hasApiKey: ${!!config.apiKey}, timeout: ${config.searchTimeout}`);
        
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

            if (config.apiKey) {
                params.key = config.apiKey;
            }

            Logger.log(`API URL: ${this.baseUrl}/search/advanced`);
            Logger.log(`Request params: ${JSON.stringify(params)}`);

            const response = await axios.get(`${this.baseUrl}/search/advanced`, {
                params,
                timeout: config.searchTimeout
            });

            Logger.log(`API Response status: ${response.status}`);
            
            if (response.data.error_id) {
                Logger.error(`API Error: ${response.data.error_message}`);
                return [];
            }

            Logger.log(`API returned ${response.data.items?.length || 0} items`);
            return response.data.items || [];
        } catch (error: any) {
            Logger.error(`Stack Overflow search failed: ${error.message}`);
            if (error.response) {
                Logger.log(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Failed to search Stack Overflow: ${error.message}`);
        }
    }

    private async getAnswersForQuestions(questions: StackOverflowQuestion[]): Promise<Map<number, StackOverflowAnswer[]>> {
        const config = this.getConfig();
        const questionIds = questions.map(q => q.question_id);
        
        if (questionIds.length === 0) {
            Logger.warn('No question IDs to fetch answers for');
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

            Logger.log(`Fetching answers for questions: ${questionIds.join(',')}`);

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

            answersMap.forEach((answers, questionId) => {
                answers.sort((a, b) => {
                    if (a.is_accepted && !b.is_accepted) return -1;
                    if (!a.is_accepted && b.is_accepted) return 1;
                    return b.score - a.score;
                });
            });

            Logger.log(`Fetched answers for ${answersMap.size} questions`);
            return answersMap;
        } catch (error: any) {
            Logger.error(`Failed to fetch answers: ${error.message}`);
            return new Map();
        }
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

    private getConfig() {
        const config = vscode.workspace.getConfiguration('stackScrapper');
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