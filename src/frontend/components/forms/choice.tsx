"use client";

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

export function Choice({ label, value, onChange, items }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <label>
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="choice"><SelectValue /></SelectTrigger>
        <SelectContent>
          {items.map(item => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}
