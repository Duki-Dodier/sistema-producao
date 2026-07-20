"use client";

import { useRef } from "react";
import { updateStatusOP } from "@/lib/actions/ops";
import { STATUS_OP_LABEL } from "@/lib/labels";

export function StatusSelect({
  opId,
  status,
}: {
  opId: number;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateStatusOP}>
      <input type="hidden" name="id" value={opId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {Object.entries(STATUS_OP_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
