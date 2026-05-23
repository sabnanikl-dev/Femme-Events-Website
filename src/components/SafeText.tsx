import { Fragment, cloneElement, isValidElement, type ReactNode } from "react";

const SYMBOL_SPLIT_PATTERN = /([&+@_/()•©·"'‘’“”–—-])/g;
const SYMBOL_ONLY_PATTERN = /^[&+@_/()•©·"'‘’“”–—-]$/;

interface SafeTextProps {
  text: string;
  symbolClassName?: string;
}

export default function SafeText({
  text,
  symbolClassName = "font-symbol",
}: SafeTextProps) {
  const parts = text.split(SYMBOL_SPLIT_PATTERN).filter(Boolean);

  return (
    <>
      {parts.map((part, index): ReactNode =>
        SYMBOL_ONLY_PATTERN.test(part) ? (
          <span key={`${part}-${index}`} className={symbolClassName}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function renderSafeNode(node: ReactNode, symbolClassName: string): ReactNode {
  if (typeof node === "string") {
    return <SafeText text={node} symbolClassName={symbolClassName} />;
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <Fragment key={index}>{renderSafeNode(child, symbolClassName)}</Fragment>
    ));
  }

  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children) {
    return cloneElement(node, {
      children: renderSafeNode(node.props.children, symbolClassName),
    });
  }

  return node;
}

export function SafeTextContent({
  children,
  symbolClassName = "font-symbol",
}: {
  children: ReactNode;
  symbolClassName?: string;
}) {
  return <>{renderSafeNode(children, symbolClassName)}</>;
}
