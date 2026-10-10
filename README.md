# Clear Auto

A VS Code extension that overlays C++ `auto` with what it actually declares: `function` or `var`. The classification comes from the clangd AST, not text matching.

```cpp
auto answer() -> int;   // shown as: function answer() -> int;
auto value = 42;        // shown as: var value = 42;
```

Overlays on the line being edited are hidden so the real `auto` stays editable.

## Usage

Install the extension together with the [clangd extension](https://marketplace.visualstudio.com/items?itemName=llvm-vs-code-extensions.vscode-clangd) (declared as a dependency, installed automatically), then open any C++ file. No commands or settings.

## Development

```sh
npm install
npm run compile
```

Press F5 to debug in an Extension Development Host.
