import React from 'react'

type FormCheckboxProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  error?: string
  className?: string
}

export default function FormCheckbox({
  label,
  checked,
  onChange,
  disabled = false,
  error,
  className = '',
}: FormCheckboxProps) {
  return (
    <div className={className}>
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mr-2 text-blue-500 focus:ring-blue-500"
        />
        <span className={`text-gray-700 ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      </label>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
