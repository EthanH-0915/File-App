"use client";

import { useRef } from "react";

type FileInputProps = {
  onFileSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  buttonText?: string;
  disabled?: boolean;
  containerClassName?: string;  // class for the container
  buttonClassName?: string;     // class for the button
};

export function FileInput({
  onFileSelect,
  accept,
  multiple = false,
  buttonText = "Choose file",
  disabled = false,
  containerClassName,
  buttonClassName,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (disabled) return;

    onFileSelect(files[0]);
    e.target.value = ""; // allow re-selecting same file
  };

  return (
    <div className={containerClassName}>
      <button
        type="button"
        className={buttonClassName}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {buttonText}
      </button>

      <input
        type="file"
        ref={inputRef}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}