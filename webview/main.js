(function() {
    const vscode = acquireVsCodeApi();
    
    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'updateResults') {
            displayResults(message.data);
        }
    });
    
    function displayResults(data) {
        const { result, errorContext } = data;
        const container = document.getElementById('results-container');
        const queryInfo = document.getElementById('query-info');
        const errorContextEl = document.getElementById('error-context');
        
        // Update query info
        queryInfo.textContent = `Search query: "${result.query}"`;
        
        // Show error context if available
        if (errorContext && errorContext.errorMessage) {
            errorContextEl.innerHTML = `
                <strong>Error Context:</strong><br>
                <div style="margin-top: 5px;">
                    <strong>Error:</strong> ${escapeHtml(errorContext.errorMessage)}<br>
                    <strong>File:</strong> ${escapeHtml(errorContext.filePath.split('/').pop() || 'Unknown')}<br>
                    <strong>Language:</strong> ${escapeHtml(errorContext.language)}
                </div>
            `;
            errorContextEl.style.display = 'block';
        }
        
        if (!result.questions || result.questions.length === 0) {
            container.innerHTML = `
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
            return;
        }
        
        let html = `
            <div style="margin-bottom: 15px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                Found ${result.questions.length} results from Stack Overflow
            </div>
        `;
        
        result.questions.forEach(question => {
            const answers = result.answers.get(question.question_id) || [];
            const topAnswer = answers[0];
            
            html += `
                <div class="result-item">
                    <div class="question-title">
                        <a href="#" onclick="openLink('${question.link}')">${escapeHtml(question.title)}</a>
                    </div>
                    
                    <div class="question-meta">
                        <span class="score ${getScoreClass(question.score)}">
                            ▲ ${question.score}
                        </span>
                        • ${question.answer_count} answer${question.answer_count !== 1 ? 's' : ''}
                        • ${question.view_count.toLocaleString()} views
                        • ${question.is_answered ? '✓ Answered' : 'Unanswered'}
                    </div>
                    
                    ${question.tags && question.tags.length > 0 ? `
                        <div class="tags">
                            ${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${topAnswer ? renderAnswer(topAnswer) : '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No answers yet</p>'}
                    
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
        });
        
        container.innerHTML = html;
    }
    
    function renderAnswer(answer) {
        const answerBody = stripHtmlTags(answer.body).substring(0, 400) + '...';
        const codeBlocks = extractCodeBlocks(answer.body);
        
        return `
            <div class="answer ${answer.is_accepted ? 'accepted-answer' : ''}">
                <div class="answer-meta">
                    <span class="score ${getScoreClass(answer.score)}">
                        ▲ ${answer.score}
                    </span>
                    ${answer.is_accepted ? '<span class="accepted-badge">✓ ACCEPTED</span>' : ''}
                    ${answer.owner ? `<span>By ${escapeHtml(answer.owner.display_name)}</span>` : ''}
                </div>
                
                <div>${answerBody}</div>
                
                ${codeBlocks.length > 0 ? `
                    <div class="code-block">
                        <div style="margin-bottom: 8px; font-size: 0.8em; color: var(--vscode-descriptionForeground);">
                            Code example:
                        </div>
                        <pre style="margin: 0; white-space: pre-wrap;">${escapeHtml(codeBlocks[0])}</pre>
                        <button class="copy-btn" onclick="copyCode('${escapeCode(codeBlocks[0])}')">
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
    
    function stripHtmlTags(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }
    
    function extractCodeBlocks(html) {
        const codeMatches = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
        return codeMatches.map(code => {
            return stripHtmlTags(code).trim();
        }).filter(code => code.length > 10); // Only include substantial code blocks
    }
    
    function getScoreClass(score) {
        if (score > 0) return 'score-positive';
        if (score < 0) return 'score-negative';
        return 'score-neutral';
    }
    
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    function escapeCode(code) {
        return code.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }
    
    // Make functions globally available
    window.openLink = function(url) {
        vscode.postMessage({
            type: 'openLink',
            url: url
        });
    };
    
    window.copyCode = function(code) {
        vscode.postMessage({
            type: 'copyCode',
            code: code
        });
    };
})();