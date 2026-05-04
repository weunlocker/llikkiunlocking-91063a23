const FONT_MAP: Record<string, string> = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  sans: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  serif: "Georgia, Cambria, Times New Roman, serif",
};
export const fontCss = (key?: string | null) => FONT_MAP[key ?? "mono"] ?? FONT_MAP.mono;

// Renders a result string. Segments wrapped in [[c:#hex|name]]...[[/c]] get colored;
// [[f:name]]...[[/f]] change font. Supports nesting.
export function ColoredResult({ text, font }: { text: string; font?: string }) {
  const lines = (text || "").split("\n");
  const renderLine = (line: string, li: number) => {
    const re = /\[\[(c:#?[0-9a-zA-Z]+|f:[a-zA-Z]+|\/c|\/f)\]\]/g;
    type Run = { text: string; color?: string; font?: string };
    const runs: Run[] = [];
    const colorStack: string[] = [];
    const fontStack: string[] = [];
    let last = 0; let m: RegExpExecArray | null;
    const push = (t: string) => {
      if (!t) return;
      runs.push({ text: t, color: colorStack[colorStack.length - 1], font: fontStack[fontStack.length - 1] });
    };
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) push(line.slice(last, m.index));
      const tag = m[1];
      if (tag.startsWith("c:")) {
        const c = tag.slice(2);
        colorStack.push(/^[0-9a-fA-F]{3,8}$/.test(c) ? `#${c}` : c);
      } else if (tag === "/c") colorStack.pop();
      else if (tag.startsWith("f:")) fontStack.push(tag.slice(2));
      else if (tag === "/f") fontStack.pop();
      last = m.index + m[0].length;
    }
    if (last < line.length) push(line.slice(last));
    return (
      <div key={li}>
        {runs.length ? runs.map((r, i) => (
          <span key={i} style={{ color: r.color, fontFamily: r.font ? fontCss(r.font) : undefined }}>{r.text}</span>
        )) : "\u00a0"}
      </div>
    );
  };
  return (
    <pre
      className="glass rounded-md p-4 text-xs whitespace-pre-wrap break-words max-h-80 overflow-auto leading-relaxed text-foreground"
      style={{ fontFamily: font ?? fontCss("mono") }}
    >
      {lines.map((line, li) => renderLine(line, li))}
    </pre>
  );
}
