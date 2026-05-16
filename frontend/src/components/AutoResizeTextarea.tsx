import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function AutoResizeTextarea({ value, defaultValue, onInput, ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  useLayoutEffect(() => {
    resize();
  }, [value, defaultValue]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      defaultValue={defaultValue}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
    />
  );
}
