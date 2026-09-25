import { htmlToText } from "./text";

/** text が null のものは削除済みコメント */
export type CommentNode = { text: string | null; children: CommentNode[] };

export type CommentFormatOptions = {
  maxTopLevel: number;
  maxReplyDepth: number;
  maxChars: number;
};

/** コメントツリーを、インデントで階層を表したテキストにする（LLM への入力用） */
export function formatComments(
  comments: CommentNode[],
  opts: CommentFormatOptions,
): string {
  const lines: string[] = [];
  let length = 0;
  let full = false;

  const visit = (node: CommentNode, depth: number) => {
    if (full) return;
    if (node.text !== null) {
      const body = htmlToText(node.text).replace(/\s+/g, " ");
      const line = `${"  ".repeat(depth)}- ${body}`;
      const added = line.length + (lines.length > 0 ? 1 : 0);
      if (length + added > opts.maxChars) {
        full = true;
        return;
      }
      lines.push(line);
      length += added;
    }
    if (depth < opts.maxReplyDepth) {
      for (const child of node.children) visit(child, depth + 1);
    }
  };

  for (const top of comments.slice(0, opts.maxTopLevel)) visit(top, 0);
  return lines.join("\n");
}
