export interface StackOverflowQuestion {
    question_id: number;
    title: string;
    link: string;
    score: number;
    view_count: number;
    answer_count: number;
    is_answered: boolean;
    tags: string[];
    body?: string;
    owner?: {
        display_name: string;
        reputation: number;
    };
}

export interface StackOverflowAnswer {
    answer_id: number;
    score: number;
    is_accepted: boolean;
    body: string;
    owner?: {
        display_name: string;
        reputation: number;
    };
    question_id: number;
}

export interface SearchResult {
    query: string;
    questions: StackOverflowQuestion[];
    answers: Map<number, StackOverflowAnswer[]>;
    timestamp: number;
}

export interface ErrorContext {
    errorMessage: string;
    codeSnippet: string;
    language: string;
    filePath: string;
    lineNumber: number;
}