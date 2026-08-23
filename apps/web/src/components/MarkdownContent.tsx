import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export function MarkdownContent({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full space-y-2 text-left [&_code]:text-sm [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3",
        className ?? "text-sm",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
