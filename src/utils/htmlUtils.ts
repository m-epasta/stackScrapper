
export class HtmlUtils {
    static escapeHtml(unsafe: string): string {
        return unsafe   
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    static escapeCode(code: string): string {
        return code
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    static stripHtmlTags(html: string): string {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerHTML || '';
    }

    static extractCodeBlocks(html: string): string[] {
        const codeMatches = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
        return codeMatches.map(code => {
            return HtmlUtils.stripHtmlTags(code).trim();
        }).filter(code => code.length > 10);
    }

    static getScoreClass(score: number): string {
        if (score > 0) return 'score-positive';
        if (score < 0) return 'score-negative';
        return 'score-neutral'
    }
}