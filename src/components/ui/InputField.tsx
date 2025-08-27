import React from "react";

type InputFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  type?: string;
  large?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

export default function InputField({
  label,
  placeholder = "",
  value,
  type = "text",
  large = false,
  onChange,
}: InputFieldProps) {
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {large ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          rows={3}
          className="w-full rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-3 text-lg resize-none"
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="w-full rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
