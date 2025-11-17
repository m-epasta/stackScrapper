import { StackOverflowQuestion, StackOverflowAnswer } from '../types';
import { HtmlUtils } from './htmlUtils';

export class WebviewRenderer {
    static renderQuestion(question: StackOverflowQuestion, answers: StackOverflowAnswer[]): string {
        const topAnswer = answers[0];
        
        return `
            <div class="result-item">
                <div class="question-title">
                    <a href="#" onclick="openLink('${question.link}')">${HtmlUtils.escapeHtml(question.title)}</a>
                </div>
                
                <div class="question-meta">
                    <span class="score ${HtmlUtils.getScoreClass(question.score)}">
                        ▲ ${question.score}
                    </span>
                    • ${question.answer_count} answers
                    • ${question.view_count.toLocaleString()} views
                    • ${question.is_answered ? '✓ Answered' : 'Unanswered'}
                </div>
                
                ${question.tags && question.tags.length > 0 ? `
                    <div class="tags">
                        ${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${topAnswer ? this.renderAnswer(topAnswer) : '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No answers yet</p>'}
                
                <div style="margin-top: 10px;">
                    <button class="copy-btn" onclick="openLink('${question.link}')">
                        View Full Question
                    </button>
                    ${answers.length > 1 ? `
                        <button class="copy-btn" onclick="openLink('${question.link}#answers')">
                            View All Answers (${answers.length})
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    static renderAnswer(answer: StackOverflowAnswer): string {
        const answerBody = HtmlUtils.stripHtmlTags(answer.body).substring(0, 400) + '...';
        const codeBlocks = HtmlUtils.extractCodeBlocks(answer.body);
        
        return `
            <div class="answer ${answer.is_accepted ? 'accepted-answer' : ''}">
                <div class="answer-meta">
                    <span class="score ${HtmlUtils.getScoreClass(answer.score)}">
                        ▲ ${answer.score}
                    </span>
                    ${answer.is_accepted ? '<span class="accepted-badge">✓ ACCEPTED</span>' : ''}
                    ${answer.owner ? `<span>By ${HtmlUtils.escapeHtml(answer.owner.display_name)}</span>` : ''}
                </div>
                
                <div>${answerBody}</div>
                
                ${codeBlocks.length > 0 ? `
                    <div class="code-block">
                        <div style="margin-bottom: 8px; font-size: 0.8em; color: var(--vscode-descriptionForeground);">
                            Code example:
                        </div>
                        <pre style="margin: 0; white-space: pre-wrap;">${HtmlUtils.escapeHtml(codeBlocks[0])}</pre>
                        <button class="copy-btn" onclick="copyCode('${HtmlUtils.escapeCode(codeBlocks[0])}')">
                            Copy Code
                        </button>
                    </div>
                ` : ''}
                
                <div style="margin-top: 10px;">
                    <button class="copy-btn" onclick="openLink('https://stackoverflow.com/a/${answer.answer_id}')">
                        View Full Answer
                    </button>
                </div>
            </div>
        `;
    }

    static renderResultsContainer(questionsCount: number): string {
        return `
            <div style="margin-bottom: 15px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                Found ${questionsCount} results from Stack Overflow
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
}