import * as vscode from 'vscode';
import axios from 'axios';
import { StackOverflowQuestion, StackOverflowAnswer, SearchResult, ErrorContext } from './types';
import { Logger } from './logger';
import { QueryBuilder } from './buildQuery';
import { ConfigManager } from './configManager';

export class StackOverflowSearcher {
    private readonly baseUrl = 'https://api.stackexchange.com/2.3';
    private readonly site = 'stackoverflow';

    async search(errorContext: ErrorContext): Promise<SearchResult> {
        try {
            Logger.log('=== STACKOVERFLOW SEARCHER START ===');
            
            const queryBuilder = new QueryBuilder(errorContext);
            const query = queryBuilder.buildQuery();
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

    private async searchQuestions(query: string): Promise<StackOverflowQuestion[]> {
        const config = ConfigManager.getConfig();
        
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
        const config = ConfigManager.getConfig();
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
}