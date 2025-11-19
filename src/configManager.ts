import * as vscode from 'vscode';

export class ConfigManager {
    private static readonly DEFAULTS = {
        MAX_RESULTS: 10,
        MAX_RESULTS_LIMIT: 50,
        SEARCH_TIMEOUT: 15000,
        MIN_TIMEOUT: 5000,
        MAX_TIMEOUT: 60000,
        MIN_SCORE: 1
    } as const;

    static getConfig() {
        const config = vscode.workspace.getConfiguration('stackScrapper');

        return {
            maxResults: Math.min(
                config.get<number>('maxResults') ?? this.DEFAULTS.MAX_RESULTS,
                this.DEFAULTS.MAX_RESULTS_LIMIT
            ),
            searchTimeout: Math.min(
                Math.max(
                    config.get<number>('searchTimeout') ?? this.DEFAULTS.SEARCH_TIMEOUT,
                    this.DEFAULTS.MIN_TIMEOUT
                ),
                this.DEFAULTS.MAX_TIMEOUT
            ),
            includeCodeContext: config.get<boolean>('includeCodeContext') ?? true,
            apiKey: config.get<string>('apiKey') ?? '',
            filterByAccepted: config.get<boolean>('filterByAccepted') ?? true,
            minScore: Math.max(config.get<number>('minScore') ?? this.DEFAULTS.MIN_SCORE, 0)
        };
    }
}