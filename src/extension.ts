import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'lolcode' }, new DocumentSemanticTokensProvider(), legend));
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const text = document.getText();
        const builder = new vscode.SemanticTokensBuilder(legend);

        const functionNames = [...text.matchAll(/(?:HOW IZ I|HOW DUZ I)\s+(\w+)/g)].map(match => match[1]);

        const functionIndexes: (number | undefined)[] = [];

        const commentRegex = new RegExp('\\b(BTW)\\b.*$', 'g');
        const commentMatches = [...text.matchAll(commentRegex)];

        for (const match of commentMatches) {
            const commentIndex = match.index;
            if (commentIndex !== undefined && commentIndex < functionIndexes.length) {
                delete functionIndexes[commentIndex];
            }
        }

        for (const functionName of functionNames) {
            const functionRegex = new RegExp('\\b' + functionName + '\\b', 'g');
            let match;
            while ((match = functionRegex.exec(text))) {
                functionIndexes[match.index] = match.index + (functionName?.length || 0);
            }
        }

        let lineStartIndex = 0;
        let multiCommentStartIndex = 0;

        const lines = text.split(/\r\n|\r|\n/);
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            let multiCommentEndRegex = new RegExp(/(?<!\\S)TLDR(?!\\S)/);
            let multiCommentEndMatch = multiCommentEndRegex.exec(line);

            if (multiCommentEndMatch) {
                let matchEnd = lineStartIndex + multiCommentEndMatch.index + 4;

                for (let i = multiCommentStartIndex; i < matchEnd; i++) {
                    delete functionIndexes[i];
                }
            }

            let multiCommentStartRegex = new RegExp(/(?<!\\S)OBTW(?!\\S)/);
            let multiCommentStartMatch = multiCommentStartRegex.exec(line);

            if (multiCommentStartMatch) {
                multiCommentStartIndex = lineStartIndex + multiCommentStartMatch.index;
            }

            let commentRegex = new RegExp(/\b(BTW)\b.*$/);
            let match = commentRegex.exec(line);

            if (match) {
                let matchStart = lineStartIndex + match.index;
                let matchEnd = lineStartIndex + line.length - 1;

                for (let i = matchStart; i < matchEnd; i++) {
                    delete functionIndexes[i];
                }
            }

            let stringRegex = new RegExp(/(["'])((?:\\\1|(?:(?!\1)).)*)(\1)/);
            let stringMatch = stringRegex.exec(line);

            if (stringMatch) {
                let matchStart = lineStartIndex + stringMatch.index;
                let matchEnd = lineStartIndex + line.length - 1;

                for (let i = matchStart; i < matchEnd; i++) {
                    delete functionIndexes[i];
                }
            }

            lineStartIndex += line.length;
        }

        for (let i = 0; i < functionIndexes.length; i++) {
            if (functionIndexes[i] !== undefined) {
                const range = new vscode.Range(document.positionAt(i), document.positionAt(functionIndexes[i] as number));
                const isCommented = document.getWordRangeAtPosition(document.positionAt(i), commentRegex);
                const isInString = isInsideString(document.positionAt(i), document);
                const isMultiCommented = isInsideMultiComment(document.positionAt(i), document);

                if (!isCommented && !isInString && !isMultiCommented) {
                    builder.push(range, 'function', ['declaration']);
                }
            }
        }

        return builder.build();
    }
}

function isInsideString(position: vscode.Position, document: vscode.TextDocument): boolean {
    const line = document.lineAt(position.line).text;
    const quoteRegex = /(["'])/g;

    let isInString = false;
    let match;
    while ((match = quoteRegex.exec(line))) {
        const quoteIndex = match.index;
        if (position.character > quoteIndex) {
            isInString = !isInString;
        } else {
            break;
        }
    }

    return isInString;
}

function isInsideMultiComment(position: vscode.Position, document: vscode.TextDocument): boolean {
    const line = document.lineAt(position.line).text;
    const multiCommentStartRegex = /(?<!\\S)OBTW(?!\\S)/;
    const multiCommentEndRegex = /(?<!\\S)TLDR(?!\\S)/;

    const multiCommentStartMatch = multiCommentStartRegex.exec(line);
    if (multiCommentStartMatch) {
        return true;
    }

    let isInMultiComment = false;
    for (let lineNumber = position.line - 1; lineNumber >= 0; lineNumber--) {
        const currentLine = document.lineAt(lineNumber).text;

        if (multiCommentEndRegex.test(currentLine)) {
            break;
        }

        if (multiCommentStartRegex.test(currentLine)) {
            isInMultiComment = true;
            break;
        }
    }

    return isInMultiComment;
}