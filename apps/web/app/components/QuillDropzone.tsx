"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";

type Props = {
  onFile: (text: string, name: string) => void;
  disabled?: boolean;
};

export function QuillDropzone({ onFile, disabled }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const text = await file.text();
    onFile(text, file.name);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    setOver(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    void handleFiles(event.dataTransfer.files);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <div
      className={`dropzone${over ? " is-over" : ""}${disabled ? " is-disabled" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      aria-disabled={disabled}
    >
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onChange} hidden />
      <span className="wax-flap" aria-hidden="true" />
      <p className="dropzone-title">
        <em>Drop a roll of names upon the desk;</em> the quill shall transcribe in good order.
      </p>
      <p className="smallcaps-help">DROP CSV · NAME, DEGREE, MAJOR, GRADUATION_DATE, GPA</p>
    </div>
  );
}
