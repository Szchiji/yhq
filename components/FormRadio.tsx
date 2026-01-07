import React from 'react'

type RadioOption = {
  value: string
  label: string
}

type FormRadioProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: RadioOption[]
  required?: boolean
  disabled?: boolean
  error?: string
  className?: string
}

export default function FormRadio({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error,
  className = '',
}: FormRadioProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center">
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="mr-2 text-blue-500 focus:ring-blue-500"
            />
            <span className={`text-gray-700 ${disabled ? 'opacity-50' : ''}`}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
