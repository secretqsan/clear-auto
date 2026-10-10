const vscode = require('vscode');
const debounce = require('lodash.debounce');
const range = require('lodash.range');

const annotationColor = 'rgba(96, 96, 96, 1)';
const annotationBorder = '0.5px solid rgba(96, 96, 96, 0.55); border-radius: 4px; padding: 0 0.25em;';

const hidden = vscode.window.createTextEditorDecorationType({
	textDecoration: 'none; display: none;',
});
const shown = vscode.window.createTextEditorDecorationType({});
const documentStates = new Map();

function activate(context) {
	context.subscriptions.push(
		hidden,
		shown,
		vscode.workspace.onDidChangeTextDocument(event => update(event.document)),
		vscode.window.onDidChangeTextEditorSelection(event => update(event.textEditor.document)),
		vscode.window.onDidChangeVisibleTextEditors(show),
		new vscode.Disposable(() => documentStates.forEach(state => state.run.cancel())),
	);
	show(vscode.window.visibleTextEditors);
}

function show(editors) {
	for (const editor of editors) {
		createEntry(editor.document);
		update(editor.document);
	}
}

function update(document) {
	if (document.languageId == 'cpp') {
    	const state = documentStates.get(document.uri.toString());
    	if (state) {
			if (state.version === document.version) {
				paint(
					vscode.window.visibleTextEditors.filter(
						editor => editor.document === document
					), state.hits
				);
			} else {
				state.run(document);
			}
		}
	}
}

function createEntry(document) {
	const key = document.uri.toString();
	if (document.languageId == 'cpp' && !documentStates.has(key)) {
		documentStates.set(key, {
			hits: [],
			run: debounce(async (doc) => {
				const oldVersion = doc.version;
				const ast = await requestAst(doc);
				if (doc.version == oldVersion && ast) {
					const current = documentStates.get(doc.uri.toString());
					current.hits = collect(doc, ast);
					current.version = doc.version;
					update(doc);
				}
			}, 200),
		});
	}
}

function paint(editors, hits) {
	for (const editor of editors) {
		const editing = new Set(editor.selections.flatMap(selection =>
			range(selection.start.line, selection.end.line + 1)
		));
		const covered = hits.filter(hit => !editing.has(hit.range.start.line));
		editor.setDecorations(hidden, covered.map(hit => hit.range));
		editor.setDecorations(shown, covered.map(hit => ({
			range: hit.range,
			renderOptions: {
				after: {
					contentText: hit.text,
					color: annotationColor,
					fontStyle: 'normal',
					border: annotationBorder,
				},
			},
		})));
	}
}

async function requestAst(document) {
	const clangd = vscode.extensions.getExtension('llvm-vs-code-extensions.vscode-clangd');
	if (!clangd) {
		return;
	}
	const client = (await clangd.activate()).getApi(1).languageClient;
	const textDocument = client.code2ProtocolConverter.asTextDocumentIdentifier(document);
	for (let attempt = 1; attempt <= 6; attempt++) {
		try {
			return await client.sendRequest('textDocument/ast', { textDocument }) ?? undefined;
		} catch (error) {
			if (!error?.message?.includes('non-added')) {
				return;
			}
			await new Promise(resolve => setTimeout(resolve, 400));
		}
	}
}

function collect(document, root) {
	const hits = new Map();
	walk(document, root, hit => {
		const key = `${hit.range.start.line}:${hit.range.start.character}`;
		hits.set(key, hit);
	});
	return [...hits.values()];
}

function walk(document, node, add) {
	if (node.role === 'declaration') {
		if (node.kind === 'Function' || node.kind === 'CXXMethod') {
			addFunction(document, node, add);
		} else if (node.kind === 'Var' || node.kind === 'Decomposition') {
			addVariable(document, node, add);
		}
	}
	for (const child of node.children ?? []) {
		walk(document, child, add);
	}
}

function addFunction(document, node, add) {
	// The type child's range starts at the written return type. In auto f() -> int
	// the placeholder auto has no Auto node, but this start still lands on it.
	const type = node.children?.find(child => child.role === 'type');
	if (type?.range) {
		const { line, character } = type.range.start;
		const text = document.lineAt(line).text.slice(character);
		const pattern = /^(?:(?:const|volatile)\s+)?(decltype\(auto\)|auto(?![A-Za-z0-9_]))/;
		const match = pattern.exec(text);
		if (match) {
			const begin = character + match[0].length - match[1].length;
			add({
				range: new vscode.Range(line, begin, line, begin + match[1].length),
				text: 'function',
			});
		}
	}
}

function addVariable(document, node, add) {
	for (const child of node.children ?? []) {
		if (child.role !== 'type') {
			continue;
		}
		if (child.kind === 'Auto' && child.range) {
			const range = new vscode.Range(
				child.range.start.line,
				child.range.start.character,
				child.range.end.line,
				child.range.end.character,
			);
			const before = document.getText(
				new vscode.Range(range.start.line, 0, range.start.line, range.start.character)
			);
			const pattern = /(^|[^A-Za-z0-9_])((?:const|constexpr)\s+)$/;
			const match = pattern.exec(before);
			if (match) {
				add({
					range: new vscode.Range(
						range.start.line,
						range.start.character - match[2].length,
						range.end.line,
						range.end.character
					),
					text: match[2].trimEnd(),
				});
			} else {
				add({ range, text: 'var' });
			}
		}
		addVariable(document, child, add);
	}
}

module.exports = { activate };
