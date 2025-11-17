(function() {
    const vscode = acquireVsCodeApi();
    const container = document.getElementById('results-container');
    
    function log(message) {
        vscode.postMessage({
            type: 'webviewLog',
            message: message
        });
    }
    
    // HTML utilities
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

    function stripHtmlTags(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    function extractCodeBlocks(html) {
        const codeMatches = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
        return codeMatches.map(code => {
            return stripHtmlTags(code).trim();
        }).filter(code => code.length > 10);
    }

    function getScoreClass(score) {
        if (score > 0) return 'score-positive';
        if (score < 0) return 'score-negative';
        return 'score-neutral';
    }

    // Rendering functions
    function renderQuestion(question, answers) {
        const topAnswer = answers[0];
        
        return `
            <div class="result-item">
                <div class="question-title">
                    <a href="#" onclick="openLink('${question.link}')">${escapeHtml(question.title)}</a>
                </div>
                
                <div class="question-meta">
                    <span class="score ${getScoreClass(question.score)}">
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
                
                ${topAnswer ? renderAnswer(topAnswer) : '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No answers yet</p>'}
                
                <div style="margin-top: 10px;">
                    <button class="copy-btn" onclick="openLink('${question.link}')">
                        View Full Question
                    </button>
                </div>
            </div>
        `;
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
            </div>
        `;
    }

    function renderNoResults() {
        return `
            <div class="no-results">
                <h3>No results found</h3>
                <p>Try modifying your search terms or check the error message.</p>
            </div>
        `;
    }

    // Main display function
    function displayResults(data) {
        try {
            const { result, errorContext } = data;
            const queryInfo = document.getElementById('query-info');
            const errorContextEl = document.getElementById('error-context');
            
            const answersMap = new Map(result.answers);
            
            queryInfo.textContent = `Search query: "${result.query}"`;
            
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
                container.innerHTML = renderNoResults();
                return;
            }
            
            let html = `
                <div style="margin-bottom: 15px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                    Found ${result.questions.length} results from Stack Overflow
                </div>
            `;
            
            result.questions.forEach(question => {
                const answers = answersMap.get(question.question_id) || [];
                html += renderQuestion(question, answers);
            });
            
            container.innerHTML = html;
            log('Successfully displayed ' + result.questions.length + ' questions');
            
        } catch (error) {
            log('Error in displayResults: ' + error.message);
            container.innerHTML = '<div style="color: red;">Error: ' + error.message + '</div>';
        }
    }

    // Initialize
    log('Webview script loaded');
    container.innerHTML = '<div style="color: var(--vscode-testing-iconPassed); padding: 10px;">✓ Webview loaded, waiting for data...</div>';
    vscode.postMessage({ type: 'webviewReady' });
    
    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;
        log('Received message type: ' + message.type);
        
        if (message.type === 'updateResults') {
            log('Processing updateResults with ' + (message.data.result.questions?.length || 0) + ' questions');
            displayResults(message.data);
        }
    });
    
    // Global functions
    window.openLink = function(url) {
        log('Opening link: ' + url);
        vscode.postMessage({
            type: 'openLink',
            url: url
        });
    };
    
    window.copyCode = function(code) {
        log('Copying code to clipboard');
        vscode.postMessage({
            type: 'copyCode',
            code: code
        });
    };
})();