import { StackOverflowQuestion, StackOverflowAnswer } from '../types';
import { HtmlUtils } from './htmlUtils';

export class WebviewRenderer {
    static renderQuestion(question: StackOverflowQuestion, answers: StackOverflowAnswer[]): string {
        const topAnswer = answers[0];
        
        // Escape ALL user-generated content
        const safeLink = HtmlUtils.escapeHtml(question.link);
        const safeTitle = HtmlUtils.escapeHtml(question.title);
        const safeTags = question.tags?.map(tag => HtmlUtils.escapeHtml(tag)) || [];
        const safeAnswerCount = HtmlUtils.escapeHtml(question.answer_count.toString());
        const safeViewCount = HtmlUtils.escapeHtml(question.view_count.toLocaleString());
        
        return `
            <div class="result-item">
                <div class="question-title">
                    <a href="#" data-link="${safeLink}">${safeTitle}</a>
                </div>
                
                <div class="question-meta">
                    <span class="score ${HtmlUtils.getScoreClass(question.score)}">
                        ▲ ${question.score}
                    </span>
                    • ${safeAnswerCount} answers
                    • ${safeViewCount} views
                    • ${question.is_answered ? '✓ Answered' : 'Unanswered'}
                </div>
                
                ${safeTags.length > 0 ? `
                    <div class="tags">
                        ${safeTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${topAnswer ? this.renderAnswer(topAnswer) : '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No answers yet</p>'}
                
                <div style="margin-top: 10px;">
                    <button class="copy-btn" data-link="${safeLink}">
                        View Full Question
                    </button>
                    ${answers.length > 1 ? `
                        <button class="copy-btn" data-link="${safeLink}#answers">
                            View All Answers (${HtmlUtils.escapeHtml(answers.length.toString())})
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    static renderAnswer(answer: StackOverflowAnswer): string {
        // Escape all user-generated content
        const safeBody = HtmlUtils.stripHtmlTags(answer.body).substring(0, 400) + '...';
        const codeBlocks = HtmlUtils.extractCodeBlocks(answer.body);
        const safeOwnerName = answer.owner ? HtmlUtils.escapeHtml(answer.owner.display_name) : '';
        const safeAnswerId = HtmlUtils.escapeHtml(answer.answer_id.toString());
        
        // Escape code block for display and for copy function
        const safeCodeBlock = codeBlocks.length > 0 ? HtmlUtils.escapeHtml(codeBlocks[0]) : '';
        const safeCodeForCopy = codeBlocks.length > 0 ? HtmlUtils.escapeCode(codeBlocks[0]) : '';
        
        return `
            <div class="answer ${answer.is_accepted ? 'accepted-answer' : ''}">
                <div class="answer-meta">
                    <span class="score ${HtmlUtils.getScoreClass(answer.score)}">
                        ▲ ${answer.score}
                    </span>
                    ${answer.is_accepted ? '<span class="accepted-badge">✓ ACCEPTED</span>' : ''}
                    ${safeOwnerName ? `<span>By ${safeOwnerName}</span>` : ''}
                </div>
                
                <div>${HtmlUtils.escapeHtml(safeBody)}</div>
                
                ${codeBlocks.length > 0 ? `
                    <div class="code-block">
                        <div style="margin-bottom: 8px; font-size: 0.8em; color: var(--vscode-descriptionForeground);">
                            Code example:
                        </div>
                        <pre style="margin: 0; white-space: pre-wrap;">${safeCodeBlock}</pre>
                        <button class="copy-btn" data-code="${safeCodeForCopy}">
                            Copy Code
                        </button>
                    </div>
                ` : ''}
                
                <div style="margin-top: 10px;">
                    <button class="copy-btn" data-link="https://stackoverflow.com/a/${safeAnswerId}">
                        View Full Answer
                    </button>
                </div>
            </div>
        `;
    }

    static renderResultsContainer(questionsCount: number): string {
        const safeCount = HtmlUtils.escapeHtml(questionsCount.toString());
        return `
            <div style="margin-bottom: 15px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                Found ${safeCount} results from Stack Overflow
            </div>
        `;
    }

    static renderNoResults(): string {
        return `
            <div class="no-results">
                <h3>No results found</h3>
                <p>Try modifying your search terms or check the error message.</p>
                <p>Common issues:</p>
                <ul style="text-align: left; display: inline-block;">
                    <li>The error message might be too specific</li>
                    <li>Try a more general search term</li>
                    <li>Check your internet connection</li>
                </ul>
            </div>
        `;
    }

    static getEventListenersScript(): string {
        return `
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Handle link buttons
                    document.querySelectorAll('[data-link]').forEach(button => {
                        button.addEventListener('click', function() {
                            const link = this.getAttribute('data-link');
                            openLink(link);
                        });
                    });
                    
                    document.querySelectorAll('[data-code]').forEach(button => {
                        button.addEventListener('click', function() {
                            const code = this.getAttribute('data-code');
                            copyCode(code);
                        });
                    });
                    
                    document.querySelectorAll('a[data-link]').forEach(link => {
                        link.addEventListener('click', function(e) {
                            e.preventDefault();
                            const linkUrl = this.getAttribute('data-link');
                            openLink(linkUrl);
                        });
                    });
                });
            </script>
        `;
    }
}