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

	
		var functionIndexes = [];

		//console.log(functionNames) // testing (works)
		
		for (const functionName of functionNames) {
			const functionRegex = new RegExp('\\b' + functionName + '\\b', 'g');
			let match;
			while (match = functionRegex.exec(text)) {
				functionIndexes[match.index] = match.index + functionName?.length;
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
			let multiCommentStartmatch = multiCommentStartRegex.exec(line); 

			if (multiCommentStartmatch) {
				multiCommentStartIndex = lineStartIndex + multiCommentStartmatch.index;
			}

			let commentRegex = new RegExp(/\b(BTW)\b.*$/);
			let match = commentRegex.exec(line);

			if (match) {
				let matchStart = lineStartIndex + match.index;
				let matchEnd = lineStartIndex + line.length-1;
				
				for (let i = matchStart; i < matchEnd; i++) {
					delete functionIndexes[i];
				}
			}

			let stringRegex = new RegExp(/(["'])((?:\\\1|(?:(?!\1)).)*)(\1)/);
			let stringMatch = stringRegex.exec(line);

			if (stringMatch) {
				let matchStart = lineStartIndex + stringMatch.index;
				let matchEnd = lineStartIndex + line.length-1;
				
				for (let i = matchStart; i < matchEnd; i++) {
					delete functionIndexes[i];
				}
			}

			lineStartIndex += line.length;
		}

		for (let i = 0; i < functionIndexes.length; i++) {
			if (functionIndexes[i]) {
				var range = new vscode.Range(document.positionAt(i), document.positionAt(functionIndexes[i]));
				builder.push(range, 'function', ['declaration']);
			}
		}

		return builder.build();
	}
}